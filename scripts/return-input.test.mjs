import test from "node:test";
import assert from "node:assert/strict";
import { createReturnInputGate } from "../components/corridor/return-input.ts";

test("long closing momentum cannot reopen the panel after the cooldown",()=>{
  const gate=createReturnInputGate();gate.arm(1000);
  for(let now=1016;now<=4000;now+=16)assert.equal(gate.accept(now),false);
  assert.equal(gate.accept(4300),true);
  assert.equal(gate.accept(4316),true);
});
test("a separate gesture works after settling; a later return resets the protection",()=>{
  const gate=createReturnInputGate();
  assert.equal(gate.accept(10),true);
  gate.arm(1000);assert.equal(gate.accept(1400),false);
  assert.equal(gate.accept(1700),true);
  gate.arm(2000);assert.equal(gate.accept(2100),false);
  assert.equal(gate.accept(2700),true);
});
