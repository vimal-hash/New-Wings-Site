import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("components/corridor/graphics-support.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

for (const [renderer, expected] of [
  [null, false],
  ["ANGLE (Google, SwiftShader Device)", false],
  ["llvmpipe (LLVM)", false],
  ["Intel HD Graphics", true],
  ["WebGL Renderer", true], // A privacy-preserving browser can withhold the chip name.
]) {
  test(`theatre startup with ${renderer ?? "no WebGL 2 context"}`, () => {
    let contexts = 0,
      releases = 0;
    const canvas = {
      getContext(type, options) {
        contexts++;
        assert.equal(type, "webgl2");
        assert.equal(options.failIfMajorPerformanceCaveat, true);
        return (
          renderer && {
            isContextLost: () => false,
            getParameter: () => renderer,
            getExtension: (name) =>
              name === "WEBGL_lose_context" ? { loseContext: () => releases++ } : null,
          }
        );
      },
    };
    const exports = {};
    vm.runInNewContext(source, { exports, document: { createElement: () => canvas } });
    assert.equal(exports.supportsTheatreGraphics(), expected);
    assert.equal(exports.supportsTheatreGraphics(), expected);
    assert.equal(contexts, 1);
    assert.equal(releases, renderer ? 1 : 0);
  });
}
