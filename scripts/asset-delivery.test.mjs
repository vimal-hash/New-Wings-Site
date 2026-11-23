import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { Cache, FileLoader } from "three";
import ts from "typescript";
const previews = JSON.parse(fs.readFileSync("components/corridor/first-paint-textures.json"));
const revisions = JSON.parse(fs.readFileSync("components/corridor/asset-revisions.json"));
const compiled = ts.transpileModule(fs.readFileSync("components/corridor/asset-url.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const fixture = { exports: {} };
vm.runInNewContext(compiled, {
  module: fixture,
  exports: fixture.exports,
  URLSearchParams,
  require: (name) => (name.includes("asset-revisions") ? revisions : previews),
});
const { assetURL } = fixture.exports;
test("all first-paint textures reuse the approved compressed mip bytes exactly", () => {
  for (const [full, preview] of Object.entries(previews)) {
    const a = fs.readFileSync("public" + full),
      b = fs.readFileSync("public" + preview);
    assert.equal(a.readUInt32LE(20) >> 1, b.readUInt32LE(20));
    assert.equal(a.readUInt32LE(24) >> 1, b.readUInt32LE(24));
    for (let i = 0; i < b.readUInt32LE(40); i++) {
      const x = 80 + (i + 1) * 24,
        y = 80 + i * 24;
      const ao = Number(a.readBigUInt64LE(x)),
        bo = Number(b.readBigUInt64LE(y)),
        size = Number(b.readBigUInt64LE(y + 8));
      assert.deepEqual(b.subarray(bo, bo + size), a.subarray(ao, ao + size));
    }
  }
});
test("first-paint and full-detail requests have distinct content versions and stable repeated resolution", () => {
  for (const full of Object.keys(previews)) {
    const first = assetURL(full),
      detail = assetURL(full + "?detail=1");
    assert.ok(first.startsWith(previews[full] + "?v="));
    assert.ok(detail.startsWith(full + "?v="));
    assert.equal(assetURL(first), first);
    assert.equal(assetURL(detail), detail);
    assert.notEqual(first, detail);
  }
  assert.equal(assetURL("data:example"), "data:example");
  assert.equal(assetURL("/unrelated.png"), "/unrelated.png");
});

test("opening transfers serve both pending and completed FileLoader requests once", async (t) => {
  const requests = new Map();
  const url = (path) => new URL(path, "https://theatre.test").href;
  t.mock.method(globalThis, "fetch", async (request) => {
    requests.set(request.url, (requests.get(request.url) ?? 0) + 1);
    return { status: 200, text: async () => "decoder", arrayBuffer: async () => Uint8Array.of(12).buffer };
  });
  const code = ts.transpileModule(fs.readFileSync("components/corridor/opening-files.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const opening = {};
  const helpers = {
    three: { Cache, FileLoader },
    "react-dom": { preload() {} },
    "./asset-url": { assetURL: url },
    "./compressed-buffer": { preloadCompressedBuffer() {} },
    "./loading-trace": { traceMark() {} },
    "./cinema-glasses-state": { CINEMA_GLASSES: "/models/glasses.glb" },
    "./scene-features": { SOFAS_ENABLED: true },
  };
  vm.runInNewContext(code, {
    exports: opening, window: new EventTarget(),
    require: (id) => id.endsWith(".json")
      ? JSON.parse(fs.readFileSync("components/corridor/" + id))
      : helpers[id],
  });

  const previousFiles = Cache.files;
  t.after(() => opening.releaseOpeningDownloads());
  opening.startOpeningDownloads();
  const model = url("/models/theatre-marked.glb");
  const loader = new FileLoader().setResponseType("arraybuffer");
  const inFlight = await loader.loadAsync(model);
  assert.deepEqual(new Uint8Array(inFlight), Uint8Array.of(12));
  assert.equal(await loader.loadAsync(model), inFlight);
  assert.equal(await new FileLoader().loadAsync(url("/draco/draco_wasm_wrapper.js")), "decoder");
  assert.equal(requests.get(model), 1);
  assert.equal(requests.get(url("/draco/draco_wasm_wrapper.js")), 1);
  opening.releaseOpeningDownloads();
  assert.equal(Cache.enabled, false);
  assert.equal(Cache.files, previousFiles);
});

test("a failed opening transfer can retry and concurrent callers share its result", async () => {
  const data = Uint8Array.of(7, 9);
  let fetches = 0;
  const code = ts.transpileModule(fs.readFileSync("components/corridor/compressed-buffer.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const buffers = {};
  vm.runInNewContext(code, {
    exports: buffers,
    require: (id) => id === "./asset-url" ? { assetURL: (url) => url } : {},
    fetch: async () => {
      if (++fetches === 1) throw Error("disconnected");
      return new Response(gzipSync(data));
    },
    Response,
    DecompressionStream,
  });

  const url = "/fixture.gz";
  buffers.preloadCompressedBuffer(url);
  await assert.rejects(buffers.loadCompressedBuffer(url), /disconnected/);
  buffers.preloadCompressedBuffer(url);
  const retry = buffers.loadCompressedBuffer(url);
  assert.equal(buffers.loadCompressedBuffer(url), retry);
  assert.deepEqual(new Uint8Array(await retry), data);
  assert.equal(buffers.loadCompressedBuffer(url), retry);
  assert.equal(fetches, 2);
});
