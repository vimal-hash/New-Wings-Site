import test from "node:test";
import assert from "node:assert/strict";
import {
  lightingAt,
  stageLighting,
  theatrePullbackDim,
  updateStageLighting,
  ROOM_DARK_LEVEL,
} from "../components/corridor/stage-lighting.ts";

test("the theatre starts dimming early and reaches its dark level at the end of the pullback", () => {
  assert.equal(theatrePullbackDim(0), 0);
  assert.ok(theatrePullbackDim(0.25) > 0.09);
  assert.ok(theatrePullbackDim(0.5) > 0.4);
  assert.equal(theatrePullbackDim(1), 1);
  for (let i = 1; i <= 100; i++) assert.ok(theatrePullbackDim(i / 100) >= theatrePullbackDim((i - 1) / 100));
});

test("formation dims the room without a room-wide flash and holds projector light", () => {
  assert.equal(lightingAt(1, true).room, 1);
  assert.equal(lightingAt(13, true).flash, 0);
  assert.ok(lightingAt(30, true).flash < 1e-10);
  for (const frame of [96, 200, 400, 576]) {
    const light = lightingAt(frame, true);
    assert.ok(Math.abs(light.room - ROOM_DARK_LEVEL) < 1e-9);
    assert.equal(light.key, 1);
    assert.ok(light.indirect > light.room);
  }
});

test("darkness is monotonic through formation, assembly, idle and replay", () => {
  let previous = 1;
  for (const [frame, active] of [
    ...Array.from({ length: 96 }, (_, i) => [i + 1, true]),
    [576, false],
    [576, false],
    [1, true],
    [12, true],
    [96, true],
    [576, false],
  ]) {
    updateStageLighting(frame, active);
    assert.ok(stageLighting.room.value <= previous + 1e-12);
    assert.equal(stageLighting.flash.value, 0);
    previous = stageLighting.room.value;
  }
  assert.ok(Math.abs(stageLighting.room.value - ROOM_DARK_LEVEL) < 1e-9);
  assert.equal(stageLighting.key.value, 1);
});
