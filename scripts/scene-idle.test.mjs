import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync("components/corridor/scene-idle.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
test("page-return loading runs critical mounts while movement still defers background work", () => {
  let phase = "pageReturnLoading",
    tick;
  const order = [],
    fixture = { exports: {} };
  vm.runInNewContext(code, {
    module: fixture,
    exports: fixture.exports,
    Map,
    Set,
    document: { hidden: false },
    window: { addEventListener() {} },
    performance: { now: () => 1000 },
    setTimeout: (callback) => {
      tick = callback;
      return 1;
    },
    require: (name) =>
      name === "./journey-controls"
        ? { journeyControls: { read: () => ({ phase }) } }
        : name === "./texture-quality"
          ? { isMobileDevice: () => false }
          : { projectorControls: { read: () => ({ phase: "assembled" }) } },
  });
  fixture.exports.scheduleSceneIdle(() => order.push("detail"), 20);
  fixture.exports.scheduleSceneIdle(() => order.push("mount"), 0);
  tick();
  assert.deepEqual(order, ["mount"]);
  phase = "pageReturning";
  tick();
  assert.deepEqual(order, ["mount"]);
  phase = "panel";
  tick();
  assert.deepEqual(order, ["mount", "detail"]);
});

test("opening preflight runs in the hold while projector and detail preparation wait until after the first move", () => {
  let moving = false,
    phase = "intro",
    tick;
  const order = [],
    fixture = { exports: {} };
  vm.runInNewContext(code, {
    module: fixture,
    exports: fixture.exports,
    Map,
    Set,
    document: { hidden: false },
    window: { addEventListener() {} },
    performance: { now: () => 1000 },
    setTimeout: (callback) => {
      tick = callback;
      return 1;
    },
    require: (name) =>
      name === "./journey-controls"
        ? { journeyControls: { read: () => ({ phase, openingMoving: moving }) } }
        : name === "./theatre-opening-state"
          ? { theatreOpening: { house: { value: 1 } } }
          : name === "./texture-quality"
            ? { isMobileDevice: () => false }
            : { projectorControls: { read: () => ({ phase: "hidden" }) } },
  });
  fixture.exports.scheduleSceneIdle(() => order.push("detail"), 20);
  fixture.exports.scheduleSceneIdle(() => order.push("projector"), 0);
  fixture.exports.scheduleSceneIdle(() => order.push("opening"), -100);
  tick();
  assert.deepEqual(order, ["opening"]);
  tick();
  assert.deepEqual(order, ["opening"]);
  moving = true;
  tick();
  assert.deepEqual(order, ["opening"]);
  phase = "glassesExit";
  tick();
  assert.deepEqual(order, ["opening"]);
  fixture.exports.sceneIdleUrgent.value = true;
  tick();
  assert.deepEqual(order, ["opening", "projector"]);
  phase = "pullback";
  tick();
  assert.deepEqual(order, ["opening", "projector"]);
  phase = "done";
  tick();
  assert.deepEqual(order, ["opening", "projector", "detail"]);
});

for (const [mobile, hidden] of [[false, false], [true, false], [false, true], [true, true]])
  test(`projector prepares under the opening loader (${mobile ? "phone" : "computer"}, ${hidden ? "hidden" : "visible"})`, () => {
    let prepared = false,
      moving = false,
      tick;
    const order = [],
      fixture = { exports: {} };
    const modules = {
      "./journey-controls": { journeyControls: { read: () => ({ phase: "intro", openingMoving: moving }) } },
      "./projector-controls": { projectorControls: { read: () => ({ phase: "hidden" }) } },
      "./texture-quality": { isMobileDevice: () => mobile },
    };
    vm.runInNewContext(code, {
      module: fixture,
      exports: fixture.exports,
      document: { hidden },
      window: { addEventListener() {} },
      performance: { now: () => 1000 },
      setTimeout: (callback) => {
        tick = callback;
        return 1;
      },
      require: (name) => modules[name],
    });
    const { scheduleSceneIdle, OPENING_PROJECTOR_PRIORITY } = fixture.exports;
    scheduleSceneIdle(
      () => order.push("projector"),
      OPENING_PROJECTOR_PRIORITY,
      () => prepared,
    );
    scheduleSceneIdle(() => order.push("later detail"), 0);
    scheduleSceneIdle(() => {
      order.push("theatre");
      prepared = true;
    }, -100);
    tick();
    assert.deepEqual(order, ["theatre"]);
    tick();
    assert.deepEqual(order, ["theatre", "projector"]);
    moving = true;
    tick();
    assert.deepEqual(order, ["theatre", "projector"]);
  });

test("phone eye preparation waits out the morph and runs while the section covers the returning eye", () => {
  let phase = "panel",
    tick;
  const order = [],
    fixture = { exports: {} };
  const modules = {
    "./journey-controls": { journeyControls: { read: () => ({ phase }) } },
    "./projector-controls": { projectorControls: { read: () => ({ phase: "assembled" }) } },
    "./texture-quality": { isMobileDevice: () => true },
  };
  vm.runInNewContext(code, {
    module: fixture,
    exports: fixture.exports,
    document: { hidden: false },
    window: { addEventListener() {} },
    performance: { now: () => 1000 },
    setTimeout: (callback) => {
      tick = callback;
      return 1;
    },
    require: (name) => modules[name],
  });
  const { scheduleSceneIdle, phoneEyePreparationWindow } = fixture.exports;
  scheduleSceneIdle(() => order.push("eye"), 20, phoneEyePreparationWindow);
  scheduleSceneIdle(() => order.push("liquid"), 10);
  tick();
  assert.deepEqual(order, ["liquid"]);
  tick();
  assert.deepEqual(order, ["liquid"]);
  phase = "pageReturnLoading";
  tick();
  assert.deepEqual(order, ["liquid", "eye"]);
});
