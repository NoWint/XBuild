import * as Cordis from "@deepseek-ai/cordis";
import { Context, type Plugin } from "@deepseek-ai/cordis";
import {
  type ClientBootstrapModule,
  type ClientBundleRegistration,
  type ClientModuleCreateOptions,
  type ClientModuleLoaderTarget,
  type ClientModuleSystem,
} from "@deepseek-ai/dsh-client-modules/client";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import { logger } from "@/logger.js";
import { fetchNativeBytes, type DshNativeTransport } from "./native-transport.js";

interface ClientBundleRequire {
  (specifier: string): unknown;
  async(specifier: string): Promise<unknown>;
  asset(reference: string): string;
}

export interface DshNativeClientGraph {
  rev: string;
  release?: { version: string; commit?: string };
  entries: Array<{
    id: string;
    url: string;
    rev: string;
    inject?: string[];
    immediately?: boolean;
    external?: string[];
  }>;
  batches: Array<{
    phase: "bootstrap" | "application";
    url: string;
    rev: string;
    entries: string[];
  }>;
}

export interface DshNativeClient {
  readonly modules: ClientModuleSystem;
  readonly context: Context;
  readonly graph: DshNativeClientGraph;
  import(specifier: string): Promise<unknown>;
  dispose(): Promise<void>;
}

export interface DshNativeClientOptions {
  transport: DshNativeTransport;
  graph: DshNativeClientGraph;
  signal?: AbortSignal;
}

const moduleLoaderGlobal = "__ModuleLoader__";
let bundleExecutionQueue: Promise<void> = Promise.resolve();

interface BrowserEntry {
  id: string;
  options: { id: string; name: string; config?: unknown };
  fiber?: { await(): Promise<unknown>; dispose(): Promise<unknown> };
  refresh(): Promise<void>;
}

/** Browser-only entry owner; avoids importing the Node Loader's fs/path seam. */
class BrowserLoader {
  readonly name = "loader";
  readonly builtins: Record<string, unknown> = Object.create(null);
  readonly store = new Map<string, BrowserEntry>();
  readonly internal: ClientModuleSystem;

  constructor(readonly ctx: Context, modules: ClientModuleSystem) {
    this.internal = modules;
    ctx.reflect.provide("loader", this);
  }

  ensureId(options: { id?: string; name: string }): string {
    const base = options.id ?? options.name;
    let id = base;
    let suffix = 1;
    while (this.store.has(id)) id = `${base}:${suffix++}`;
    options.id = id;
    return id;
  }

  async create(options: { id?: string; name: string; config?: unknown }): Promise<string> {
    const id = this.ensureId(options);
    const entry: BrowserEntry = {
      id,
      options: { id, name: options.name, ...(options.config === undefined ? {} : { config: options.config }) },
      refresh: async () => {
        if (entry.fiber) return;
        const namespace = await modulesImport(this.internal, entry.options.name);
        const plugin = asPlugin(namespace);
        if (plugin === undefined) throw new Error(`Native module ${entry.options.name} has no plugin export`);
        entry.fiber = this.ctx.registry.plugin(plugin, entry.options.config) as unknown as BrowserEntry["fiber"];
        await entry.fiber?.await();
      },
    };
    this.store.set(id, entry);
    await entry.refresh();
    return id;
  }

  resolve(id: string): BrowserEntry {
    const entry = this.store.get(id);
    if (!entry) throw new Error(`Native browser loader entry not found: ${id}`);
    return entry;
  }

  remove(id: string): void {
    const entry = this.store.get(id);
    if (!entry) return;
    this.store.delete(id);
    void entry.fiber?.dispose();
  }

  entries(): Iterable<BrowserEntry> { return this.store.values(); }
  async await(): Promise<void> {
    await Promise.allSettled([...this.store.values()].flatMap((entry) => entry.fiber ? [entry.fiber.await()] : []));
  }
}

async function modulesImport(modules: ClientModuleSystem, specifier: string): Promise<unknown> {
  return modules.import(specifier);
}

function asPlugin(namespace: unknown): Plugin | undefined {
  if (!namespace || (typeof namespace !== "object" && typeof namespace !== "function")) return undefined;
  const value = namespace as { default?: unknown; __esModule?: boolean };
  const first = value.default ?? namespace;
  const candidate = value.__esModule && first && typeof first === "object" && "default" in first
    ? (first as { default?: unknown }).default ?? first
    : first;
  if (typeof candidate === "function") return candidate as Plugin;
  if (candidate && typeof candidate === "object" && typeof (candidate as { apply?: unknown }).apply === "function") {
    return candidate as Plugin;
  }
  return undefined;
}

function nativeResourcePath(path: string): string {
  const parsed = new URL(path, "http://dsh.native");
  const pathname = parsed.pathname.startsWith("/plugins/")
    ? parsed.pathname
    : `/plugins${parsed.pathname}`;
  return `${pathname}${parsed.search}`;
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function assertNativeGraph(value: DshNativeClientGraph): void {
  if (
    !value ||
    typeof value.rev !== "string" ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.batches)
  ) {
    throw new Error("Invalid native client module graph");
  }
}

function executeClassicBundle(source: string, url: string, target: ClientModuleLoaderTarget): void {
  const previous = Reflect.get(window, moduleLoaderGlobal);
  Object.defineProperty(window, moduleLoaderGlobal, {
    configurable: true,
    value: target,
  });
  try {
    const script = document.createElement("script");
    script.dataset.dshNativeBundle = "true";
    script.text = `${source}\n//# sourceURL=${url}`;
    document.head.append(script);
    script.remove();
  } finally {
    if (previous === undefined) delete (window as unknown as Record<string, unknown>)[moduleLoaderGlobal];
    else Object.defineProperty(window, moduleLoaderGlobal, { configurable: true, value: previous });
  }
}

/**
 * Run the original DSH browser graph in a domain-owned Cordis context.
 * Bundle transport and the module table are scoped to one attachment lease.
 */
export async function createDshNativeClient(
  options: DshNativeClientOptions,
): Promise<DshNativeClient> {
  assertNativeGraph(options.graph);
  const { transport, graph } = options;
  let active = true;
  let modules: ClientModuleSystem | undefined;
  let context: Context | undefined;
  let target: ClientModuleLoaderTarget | undefined;
  let bootstrapCreate: ((
    target: ClientModuleLoaderTarget,
    bootstrapModule: ClientBootstrapModule,
    options: ClientModuleCreateOptions,
  ) => ClientModuleSystem) | undefined;
  let releaseGeneration: (() => void) | undefined;
  const ensureActive = () => {
    if (!active) throw new Error("Native UI client is disposed");
  };

  const loadBundleSource = async (url: string): Promise<string> => {
    ensureActive();
    const response = await fetchNativeBytes(transport, nativeResourcePath(url), {
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`Native bundle failed: ${response.status}`);
    return response.text();
  };

  const executeBundle = async (url: string): Promise<void> => {
    const run = bundleExecutionQueue.then(async () => {
      const source = await loadBundleSource(url);
      ensureActive();
      if (!target) throw new Error("Native module target is not initialized");
      executeClassicBundle(source, url, target);
    });
    bundleExecutionQueue = run.catch(() => undefined);
    await run;
  };

  const bootstrapModule: ClientBootstrapModule = {
    id: "@deepseek-ai/dsh-client-modules",
    exports: {},
  };
  const registrationTarget: ClientModuleLoaderTarget = {
    mode: "queue",
    pendingQueue: [],
    load(registration: ClientBundleRegistration) {
      if (this.mode !== "queue") throw new Error("Native module registration arrived after boot");
      this.pendingQueue.push(registration);
    },
    create(createOptions) {
      if (!bootstrapCreate) throw new Error("Native client-modules bootstrap is not ready");
      modules = bootstrapCreate(this, bootstrapModule, {
        ...createOptions,
        loadBundle: executeBundle,
        resolveAsset: nativeResourcePath,
      });
      return modules;
    },
  };
  target = registrationTarget;

  const fetchRpc = async (input: string | URL, init: RequestInit): Promise<Response> => {
    ensureActive();
    const url = new URL(input.toString(), "http://dsh.native");
    const body = typeof init.body === "string" ? encodeBase64(init.body) : undefined;
    return fetchNativeBytes(transport, `${url.pathname}${url.search}`, {
      method: (init.method as "GET" | "HEAD" | "POST" | undefined) ?? "POST",
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      ...(body === undefined ? {} : { bodyBase64: body }),
      signal: init.signal ?? undefined,
    });
  };

  const eventRelease = transport.subscribe((event) => {
    if (!active) return;
    if (event.kind === "lifecycle") {
      active = false;
      releaseGeneration?.();
    }
  });
  releaseGeneration = eventRelease;

  try {
    const bootstrapBatches = graph.batches.filter((batch) => batch.phase === "bootstrap");
    if (bootstrapBatches.length === 0) {
      throw new Error("Native client graph has no bootstrap batch");
    }
    for (const batch of bootstrapBatches) await executeBundle(batch.url);
    const bootstrapIndex = target.pendingQueue.findIndex(
      (registration) => registration.id === "@deepseek-ai/dsh-client-modules",
    );
    const registration = target.pendingQueue.splice(bootstrapIndex, 1)[0];
    if (!registration) throw new Error("Native bootstrap bundle did not register client-modules");
    const bootstrapRequire = ((specifier: string) => {
      throw new Error(`client-modules bootstrap requested an external module: ${specifier}`);
    }) as unknown as ClientBundleRequire;
    bootstrapRequire.async = async (specifier: string) => bootstrapRequire(specifier);
    bootstrapRequire.asset = (reference: string) => reference;
    const bootstrapExports = registration.factory(bootstrapRequire);
    if (
      typeof bootstrapExports.createClientModuleSystem !== "function" ||
      typeof bootstrapExports.apply !== "function"
    ) {
      throw new Error("Native client-modules bootstrap export is incomplete");
    }
    bootstrapModule.exports = bootstrapExports;
    bootstrapCreate = bootstrapExports.createClientModuleSystem as typeof bootstrapCreate;

    const created = target.create({ boot: graph, staticModules: {
      react: React,
      "react-dom": ReactDOM,
      "react-dom/client": ReactDOMClient,
      "react/jsx-runtime": React,
      "react/jsx-dev-runtime": React,
      "@deepseek-ai/cordis": Cordis,
    } });
    context = new Context();
    const globalRecord = globalThis as typeof globalThis & {
      __DSH_TRANSPORT__?: Record<string, unknown>;
    };
    const previousTransport = globalRecord.__DSH_TRANSPORT__;
    globalRecord.__DSH_TRANSPORT__ = {
      fetch: fetchRpc,
      loadBundle: executeBundle,
      resolveAsset: nativeResourcePath,
    };
    try {
      const loader = new BrowserLoader(context, created);
      context.reflect.provide("modules", created);
      await created.entries.start(
        loader as unknown as Parameters<ClientModuleSystem["entries"]["start"]>[0],
        created.manifest,
      );
    } finally {
      if (previousTransport === undefined) delete globalRecord.__DSH_TRANSPORT__;
      else globalRecord.__DSH_TRANSPORT__ = previousTransport;
    }
    return {
      modules: created,
      context,
      graph,
      async import(specifier) {
        ensureActive();
        return created.import(specifier);
      },
      async dispose() {
        if (!active) return;
        active = false;
        releaseGeneration?.();
        releaseGeneration = undefined;
        await context?.fiber.dispose();
        await transport.detach();
      },
    };
  } catch (error) {
    active = false;
    releaseGeneration?.();
    releaseGeneration = undefined;
    await context?.fiber.dispose().catch((disposeError: unknown) => {
      logger.warn("[dsh] client cleanup failed", { error: String(disposeError) });
    });
    throw error;
  }
}
