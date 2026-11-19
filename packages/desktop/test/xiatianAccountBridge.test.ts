import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiKeyProviders,
  ensureDefaultModel,
  readJson,
  saveApiKeyProvider,
} from "../vendor/open-claude-desktop/harness/packages/zcode-bridge/src/accounts.js";
import { createXiatianAccount } from "../vendor/open-claude-desktop/harness/packages/zcode-bridge/src/xiatian-account.js";

const builtin = {
  config: {
    providerConfigRules: {
      templateRules: [
        {
          templateId: "zai-standard-api",
          templateNameMap: { "en-US": "Xiatian AI (OpenAI format)" },
          config: {
            access: { type: "api-key" },
            api: { type: "openai-chat-completions", baseUrl: "https://nowint.qzz.io/v1" },
          },
        },
        {
          templateId: "zai-api",
          templateNameMap: { "en-US": "Xiatian AI" },
          config: { access: { type: "api-key" }, api: { type: "anthropic-messages", baseUrl: "https://nowint.qzz.io" } },
        },
      ],
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("XBuild desktop Xiatian AI account", () => {
  let dir = "";

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "xbuild-xiatian-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("uses a server-issued session key as the relay credential and never the dashboard JWT", async () => {
    const calls: { url: string; method: string; authorization: string | null }[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, method: init?.method ?? "GET", authorization: headers.get("authorization") });
      if (url.endsWith("/api/xbuild/device/start")) {
        return jsonResponse({ success: true, data: { device_code: "dev-1", verification_uri: "/xbuild/device?code=dev-1", expires_in: 600, interval: 0 } });
      }
      if (url.endsWith("/api/xbuild/device/token")) {
        return jsonResponse({ success: true, data: { access_token: "dashboard-jwt", token_type: "Bearer", access_expires_at: Math.floor(Date.now() / 1000) + 3600, session: { sid: "sid-1" }, refresh_token: "refresh-1" } });
      }
      if (url.endsWith("/api/xbuild/session-key") && init?.method === "DELETE") return jsonResponse({ success: true });
      if (url.endsWith("/api/xbuild/session-key")) {
        expect(init?.method).toBe("POST");
        expect(headers.get("authorization")).toBe("Bearer dashboard-jwt");
        return jsonResponse({ success: true, data: { api_key: "relaykey48chars", expires_at: Math.floor(Date.now() / 1000) + 43200, group: "default", models: ["z-ai/glm-5.3-flash"] } });
      }
      throw new Error(`unexpected request ${init?.method} ${url}`);
    }) as unknown as typeof fetch;

    const account = createXiatianAccount({ env: { CODE_DESKTOP_XIATIAN_ORIGIN: "https://nowint.qzz.io" }, notify: () => {}, fetchImpl });
    const started = await account.start();
    expect(started.authUrl).toBe("https://nowint.qzz.io/xbuild/device?code=dev-1");
    await vi.waitFor(() => expect(account.accessToken).toBe("dashboard-jwt"), { timeout: 5000 });

    const key = await account.sessionKey();
    expect(key?.apiKey).toBe("relaykey48chars");
    expect(key?.group).toBe("default");
    expect(key?.models).toEqual(["z-ai/glm-5.3-flash"]);

    const settingsFile = join(dir, "provider_config.json");
    saveApiKeyProvider({ personalFile: settingsFile, builtin, apiKey: key!.apiKey, templateId: "zai-standard-api", baseUrl: "https://nowint.qzz.io/v1", apiType: "openai-chat-completions", models: key!.models, providerId: "code-desktop-xiatian-account", displayName: "Xiatian AI account", allowManaged: true });
    const saved = readJson(settingsFile);
    const provider = apiKeyProviders(saved)[0];
    expect(provider.apiKey).toBe("relaykey48chars");
    expect(provider.apiKey).not.toBe("dashboard-jwt");
    expect(provider.apiType).toBe("openai-chat-completions");
    expect(provider.baseUrl).toBe("https://nowint.qzz.io/v1");

    await account.logout();
    const revoked = calls.find((call) => call.url.endsWith("/api/xbuild/session-key") && call.method === "DELETE");
    expect(revoked?.authorization).toBe("Bearer dashboard-jwt");
    expect(account.accessToken).toBeNull();
  });

  it("rejects custom writes to managed Xiatian provider ids", async () => {
    const file = join(dir, "provider_config.json");
    expect(() => saveApiKeyProvider({ personalFile: file, builtin, apiKey: "spoofed", templateId: "zai-standard-api", baseUrl: "https://evil.example/v1", models: ["evil-model"], providerId: "code-desktop-xiatian-account" })).toThrow(/Managed Xiatian AI/);
  });

  it("keeps an explicitly chosen third-party provider as the default model", async () => {
    const file = join(dir, "provider_config.json");
    saveApiKeyProvider({ personalFile: file, builtin, apiKey: "third-party-key", templateId: "zai-standard-api", baseUrl: "https://api.example.com/v1", models: ["vendor-model"], providerId: "code-desktop-vendor", displayName: "Vendor" });
    saveApiKeyProvider({ personalFile: file, builtin, apiKey: "relay-key", templateId: "zai-standard-api", baseUrl: "https://nowint.qzz.io/v1", models: ["z-ai/glm-5.3-flash"], providerId: "code-desktop-xiatian-account", displayName: "Xiatian AI account", allowManaged: true });
    expect(ensureDefaultModel(file, { providerId: "code-desktop-xiatian-account", modelId: "z-ai/glm-5.3-flash" })).toBe(false);
    const saved = readJson(file);
    expect(saved.config.defaultModelSelection).toEqual({ providerId: "code-desktop-vendor", modelId: "vendor-model" });
  });

  it("moves the default to a surviving bridge provider when a managed provider is removed", async () => {
    const file = join(dir, "provider_config.json");
    saveApiKeyProvider({ personalFile: file, builtin, apiKey: "vendor-key", templateId: "zai-standard-api", baseUrl: "https://vendor.example/v1", models: ["vendor-model"], providerId: "code-desktop-vendor", displayName: "Vendor" });
    saveApiKeyProvider({ personalFile: file, builtin, apiKey: "relay-key", templateId: "zai-standard-api", baseUrl: "https://nowint.qzz.io/v1", models: ["z-ai/glm-5.3-flash"], providerId: "code-desktop-xiatian-account", displayName: "Xiatian AI account", allowManaged: true });
    const document = readJson(file);
    document.config.defaultModelSelection = { providerId: "code-desktop-xiatian-account", modelId: "z-ai/glm-5.3-flash" };
    await writeFile(file, JSON.stringify(document));
    const { removeApiKeyProvider } = await import("../vendor/open-claude-desktop/harness/packages/zcode-bridge/src/accounts.js");
    expect(removeApiKeyProvider(file, "code-desktop-xiatian-account")).toBe(true);
    expect(readJson(file).config.defaultModelSelection).toEqual({ providerId: "code-desktop-vendor", modelId: "vendor-model" });
  });

  it("adopts the Xiatian AI model when the previous default provider is gone", async () => {
    const file = join(dir, "provider_config.json");
    saveApiKeyProvider({ personalFile: file, builtin, apiKey: "relay-key", templateId: "zai-standard-api", baseUrl: "https://nowint.qzz.io/v1", models: ["z-ai/glm-5.3-flash"], providerId: "code-desktop-xiatian-account", displayName: "Xiatian AI account", allowManaged: true });
    const document = readJson(file);
    document.config.defaultModelSelection = { providerId: "code-desktop-removed", modelId: "gone" };
    await writeFile(file, JSON.stringify(document));
    expect(ensureDefaultModel(file, { providerId: "code-desktop-xiatian-account", modelId: "z-ai/glm-5.3-flash" })).toBe(true);
    const reopened = JSON.parse(await readFile(file, "utf8"));
    expect(reopened.config.defaultModelSelection).toEqual({ providerId: "code-desktop-xiatian-account", modelId: "z-ai/glm-5.3-flash" });
  });
});
