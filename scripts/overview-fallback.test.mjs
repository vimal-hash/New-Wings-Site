import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("components/corridor/overview-fallback.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function browser(journey = {}) {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const urls = [];
  let now = 0, timer;
  const api = {};
  vm.runInNewContext(source, {
    exports: api, URL, document,
    require: () => ({ journeyControls: { read: () => journey } }),
    location: { href: "https://example.org/?campaign=cinema", replace: (u) => urls.push(new URL(u)) },
    performance: { now: () => now },
    window: {
      setTimeout(fn, delay) { timer = { fn, at: now + delay }; return 1; },
      clearTimeout() { timer = undefined; },
    },
  });
  return {
    api, urls,
    advance(ms) { now += ms; if (timer && now >= timer.at) timer.fn(); },
    hide(hidden) { document.hidden = hidden; document.dispatchEvent(new Event("visibilitychange")); },
  };
}

test("the default deadline fires once after ten visible seconds", () => {
  const b = browser();
  let calls = 0;
  b.api.onVisibleLoadTimeout(() => calls++);
  b.advance(6000);
  b.hide(true);
  b.advance(1000);
  b.hide(false);
  b.advance(3999);
  assert.equal(calls, 0);
  b.advance(1);
  b.hide(true);
  b.hide(false);
  b.advance(100);
  assert.equal(calls, 1);
});

test("a completed load cancels the deadline even while the tab is hidden", () => {
  const b = browser();
  const stop = b.api.onVisibleLoadTimeout(() => assert.fail("switched after readiness"), 100);
  b.hide(true);
  stop();
  b.hide(false);
  b.advance(1000);
});

test("handoff preserves the current section and URL options, even if two failures arrive together", () => {
  for (const [journey, expected] of [
    [{ phase: "intro" }, "theatre"],
    [{ phase: "drawings", loaderDone: true }, "products"],
    [{ phase: "page", visiblePageSection: 2 }, "about"],
    [{ phase: "page", pageSection: 1, visiblePageSection: 3 }, "team"],
    [{ phase: "pageReturnLoading" }, "testimonials"],
    [{ phase: "logoDone" }, "vision"],
  ]) {
    const b = browser(journey);
    b.api.switchToOverview();
    b.api.switchToOverview();
    assert.equal(b.urls.length, 1);
    assert.equal(b.urls[0].hash, "#" + expected);
    assert.equal(b.urls[0].searchParams.get("view"), "overview");
    assert.equal(b.urls[0].searchParams.get("campaign"), "cinema");
  }
});
