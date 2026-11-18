import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [dependencyRoot, outputPath] = process.argv.slice(2);
assert.ok(dependencyRoot && outputPath, "Provide dependency root and output path");
const packageRoot = resolve(dependencyRoot, "node_modules/@deepseek-ai/cordis");
const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
assert.equal(manifest.version, "4.1.0");
const { Context } = await import(pathToFileURL(resolve(packageRoot, "lib/index.js")).href);
const observations = [];
async function probe(name, run) {
  const observed = await run();
  observations.push({ name, status: "passed", observed });
}

await probe("serial-zero-is-a-blocking-return", async () => {
  const ctx = new Context();
  const order = [];
  ctx.on("probe/serial", () => {
    order.push("first");
    return false;
  });
  ctx.on("probe/serial", () => {
    order.push("second");
    return 0;
  });
  ctx.on("probe/serial", () => {
    order.push("third");
    return true;
  });
  const result = await ctx.serial("probe/serial");
  assert.equal(result, 0);
  assert.deepEqual(order, ["first", "second"]);
  return { order, result };
});

await probe("waterfall-preserves-veto-and-result-transformation", async () => {
  const ctx = new Context();
  const order = [];
  ctx.on("probe/wrap", async (next) => {
    order.push("before");
    const result = await next();
    order.push("after");
    return { ...result, transformed: true };
  });
  const result = await ctx.waterfall("probe/wrap", async () => {
    order.push("execute");
    return { value: 7 };
  });
  assert.deepEqual(order, ["before", "execute", "after"]);
  assert.deepEqual(result, { value: 7, transformed: true });
  let executed = false;
  ctx.on("probe/veto", () => ({ denied: true }));
  const denied = await ctx.waterfall("probe/veto", () => {
    executed = true;
  });
  assert.equal(executed, false);
  assert.deepEqual(denied, { denied: true });
  return { order, result, vetoPreventedExecution: !executed };
});

await probe("parallel-settles-all-before-aggregating-errors", async () => {
  const ctx = new Context();
  const order = [];
  const first = new Error("first controlled error");
  const second = new Error("second controlled error");
  ctx.on("probe/parallel", () => {
    order.push("first");
    throw first;
  });
  ctx.on("probe/parallel", async () => {
    await Promise.resolve();
    order.push("second");
    throw second;
  });
  await assert.rejects(ctx.parallel("probe/parallel"), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [first, second]);
    assert.deepEqual(order, ["first", "second"]);
    return true;
  });
  return { settled: order, aggregatedErrors: 2 };
});

await probe("ordinary-emit-propagates-synchronous-errors", async () => {
  const ctx = new Context();
  const order = [];
  const failure = new Error("controlled listener error");
  ctx.on("probe/emit", () => {
    order.push("first");
    throw failure;
  });
  ctx.on("probe/emit", () => {
    order.push("second");
  });
  assert.throws(
    () => ctx.emit("probe/emit"),
    (error) => error === failure,
  );
  assert.deepEqual(order, ["first"]);
  return { order, secondListenerRan: false, originalErrorPropagated: true };
});

await probe("plugin-services-share-live-references-and-synchronous-callbacks", async () => {
  const ctx = new Context();
  const shared = { count: 0, object: { marker: "same-object" } };
  const owner = await ctx.plugin({
    name: "probe-provider",
    apply(local) {
      local.provide("probeShared", shared);
    },
  });
  let observed;
  const consumer = await ctx.plugin({
    name: "probe-consumer",
    inject: ["probeShared"],
    apply(local) {
      local.on("probe/change", () => {
        local.probeShared.count += 1;
        observed = local.probeShared.object;
      });
    },
  });
  ctx.emit("probe/change");
  assert.equal(shared.count, 1);
  assert.strictEqual(observed, shared.object);
  await consumer.dispose();
  await owner.dispose();
  return { mutationVisibleBeforeEmitReturned: true, sameObjectIdentity: true };
});

await probe("tracked-plugin-listeners-are-disposed", async () => {
  const ctx = new Context();
  let calls = 0;
  const fiber = await ctx.plugin({
    name: "probe-dispose",
    apply(local) {
      local.on("probe/lifecycle", () => {
        calls += 1;
      });
    },
  });
  ctx.emit("probe/lifecycle");
  await fiber.dispose();
  ctx.emit("probe/lifecycle");
  assert.equal(calls, 1);
  return { callsBeforeAndAfterDisposal: calls, trackedListenerRemoved: true };
});

await probe("separate-contexts-do-not-isolate-untracked-global-effects", async () => {
  const key = Symbol("xbuild-dsh-controlled-probe");
  const first = new Context();
  const second = new Context();
  let seenByOtherContext = false;
  let afterDispose;
  try {
    const writer = await first.plugin({
      name: "probe-global-writer",
      apply() {
        globalThis[key] = { controlledProbe: true };
      },
    });
    const reader = await second.isolate("probeShared").plugin({
      name: "probe-global-reader",
      apply() {
        seenByOtherContext = globalThis[key]?.controlledProbe === true;
      },
    });
    await writer.dispose();
    afterDispose = globalThis[key]?.controlledProbe === true;
    await reader.dispose();
    assert.equal(seenByOtherContext, true);
    assert.equal(afterDispose, true);
  } finally {
    delete globalThis[key];
  }
  return { seenByOtherContext, untrackedEffectRemainedAfterDisposal: afterDispose };
});

const report = {
  kind: "upstream-contract-probe-not-xbuild-compatibility-acceptance",
  executedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  package: manifest.name,
  version: manifest.version,
  upstreamTag: "dsh-v0.2.2-rc.3",
  upstreamCommit: "38a6a5c965aa99ab525161efb7cc5cf1fe62fced",
  integrity:
    "sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==",
  observations,
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
