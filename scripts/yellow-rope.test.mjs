import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  FLIGHT,
  YELLOW_FLIGHT,
  flightZ,
  flightAtStop,
  sectionWhiteShare,
} from "../components/rope-model/rope-flight.ts";

test("yellow/green has the original joined flight and its green stop in both directions", () => {
  for (const key of ["travel", "stopAt", "holdFrom", "holdTo", "scrollScreens"])
    assert.equal(YELLOW_FLIGHT[key], FLIGHT[key]);
  for (let i = 0; i <= 1000; i++) assert.equal(flightZ(i / 1000, YELLOW_FLIGHT), flightZ(i / 1000, FLIGHT));
  assert.ok(Math.abs(flightZ(YELLOW_FLIGHT.holdFrom, YELLOW_FLIGHT) + 9) < 1e-12);
  assert.equal(flightAtStop(YELLOW_FLIGHT.holdTo, -9, YELLOW_FLIGHT), true);
  assert.equal(sectionWhiteShare(YELLOW_FLIGHT), sectionWhiteShare(FLIGHT));
});

test("desktop and laptop yellow lookups reproduce the actual Blender ramp without baked bloom", () => {
  const look = JSON.parse(
    fs.readFileSync(new URL("../components/rope-model/yellow-look.json", import.meta.url)),
  );
  const encode = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
  assert.equal(look.geometryHash, "7af2c0d27b363682");
  assert.deepEqual(look.toe, [0.25, 0.66]);
  for (const [file, width] of [
    ["palette-desktop.png", 1024],
    ["palette-laptop.png", 256],
  ]) {
    const b = fs.readFileSync(new URL("../public/rope-model/yellow/" + file, import.meta.url));
    assert.equal(b.readUInt32BE(16), width);
    assert.equal(b.readUInt32BE(20), 1);
    let at = 8;
    const chunks = [];
    while (at < b.length) {
      const n = b.readUInt32BE(at);
      if (b.toString("ascii", at + 4, at + 8) === "IDAT") chunks.push(b.subarray(at + 8, at + 8 + n));
      at += n + 12;
    }
    const pixels = inflateSync(Buffer.concat(chunks));
    assert.equal(pixels[0], 0);
    for (let stop = 0; stop < look.redHue[1].length; stop++) {
      const x = Math.round(look.redHue[1][stop][0] * (width - 1));
      for (let c = 0; c < 3; c++)
        assert.ok(Math.abs(pixels[1 + x * 3 + c] / 255 - encode(look.yellowHue[1][stop][c])) < 0.015);
    }
  }
});

test("the shared desktop and laptop model downloads remain the existing files", () => {
  for (const [file, hash] of [
    ["../public/rope-model/rope-red.glb", "e90f514da0f8a82f5ce607d618f5afe0471afd73dda85d98ea3022a1570472f7"],
    [
      "../public/rope-flight-laptop/rope.bin",
      "668315ceda4bc60b86054dc8ab30b930a9b745e03629157a979d7358e2e415b5",
    ],
  ])
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(new URL(file, import.meta.url)))
        .digest("hex"),
      hash,
    );
});
