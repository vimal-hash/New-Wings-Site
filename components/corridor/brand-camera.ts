import { lensControls } from "./lens-controls";
import { createLensMotion, projectBrandPlane } from "./lens-motion";
import { cinemaControls } from "./cinema-controls";

/** A perspective camera for the existing flat artwork, without a second WebGL canvas. */
export function createBrandCamera(section: HTMLElement) {
  const preference = matchMedia("(prefers-reduced-motion: reduce)"),
    touch = matchMedia("(hover: none)");
  const motion = createLensMotion();
  const targets = [...section.querySelectorAll<HTMLElement>("[data-lens-depth]")].map((element) => ({
    element,
    base: element.style.transform,
    cx: 0,
    cy: 0,
    depth: Number(element.dataset.lensDepth),
  }));
  let frame = 0,
    last = 0,
    weight = 0,
    dirty = true,
    layout = "",
    disposed = false,
    usingMouse = false;
  function measure() {
    targets.forEach((target) => {
      target.element.style.transform = target.base;
    });
    targets.forEach((target) => {
      const rect = target.element.getBoundingClientRect();
      target.cx = rect.x + rect.width / 2;
      target.cy = rect.y + rect.height / 2;
    });
    dirty = false;
  }
  function paint(now: number) {
    frame = 0;
    if (disposed) return;
    const preset = lensControls.read().presets.brand,
      values = cinemaControls.read().baseline ? { ...preset, enabled: false } : preset,
      hidden = document.hidden || weight === 0;
    if (hidden) {
      last = 0;
      return;
    }
    if (dirty) measure();
    const sample = motion.tick(
      last ? Math.min(0.05, (now - last) / 1000) : 1 / 60,
      values,
      preference.matches || (touch.matches && !usingMouse),
    );
    last = now;
    for (const target of targets) {
      const p = projectBrandPlane(
        target.cx,
        target.cy,
        innerWidth,
        innerHeight,
        target.depth,
        values,
        sample,
        weight,
      );
      const lens = `translate(${p.x.toFixed(3)}px,${p.y.toFixed(3)}px) rotate(${p.roll.toFixed(
        4,
      )}deg) scale(${p.sx.toFixed(6)},${p.sy.toFixed(6)})`;
      target.element.style.transform = target.base ? `${target.base} ${lens}` : lens;
    }
    section.dataset.lensFov = String(values.enabled ? values.fov : 40);
    section.dataset.lensSqueeze = String(values.enabled ? values.squeeze : 1);
    if (sample.moving) frame = requestAnimationFrame(paint);
    else last = 0;
  }
  function wake() {
    if (!frame && !disposed && weight > 0 && !document.hidden) frame = requestAnimationFrame(paint);
  }
  function pointer(event: PointerEvent) {
    if (event.pointerType !== "mouse") {
      usingMouse = false;
      motion.pointer(0, 0);
      wake();
      return;
    }
    if (!weight) return;
    usingMouse = true;
    const ui = event.target instanceof Element && event.target.closest("[data-cinema-controls]");
    motion.pointer(
      ui ? 0 : (event.clientX / innerWidth) * 2 - 1,
      ui ? 0 : (event.clientY / innerHeight) * 2 - 1,
    );
    wake();
  }
  function leave() {
    motion.pointer(0, 0);
    wake();
  }
  function resize() {
    dirty = true;
    wake();
  }
  function visibility() {
    last = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    motion.reset();
    wake();
  }
  const unsubscribe = lensControls.subscribe(wake);
  const unsubscribeCompare = cinemaControls.subscribe(wake);
  window.addEventListener("pointermove", pointer, { passive: true });
  window.addEventListener("blur", leave);
  window.addEventListener("resize", resize);
  document.documentElement.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  preference.addEventListener("change", visibility);
  touch.addEventListener("change", visibility);
  return {
    update(progress: number, entrance: number) {
      const t = Math.max(0, Math.min(1, (progress - entrance) / Math.max(0.01, 1 - entrance)));
      weight = t * t * (3 - 2 * t);
      const next = `${innerWidth}/${innerHeight}/${section.style.getPropertyValue("--brand-logo-width")}`;
      if (next !== layout) {
        layout = next;
        dirty = true;
      }
      if (!weight) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        motion.reset();
        targets.forEach((target) => {
          target.element.style.transform = target.base;
        });
      } else wake();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      unsubscribe();
      unsubscribeCompare();
      targets.forEach((target) => {
        target.element.style.transform = target.base;
      });
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("blur", leave);
      window.removeEventListener("resize", resize);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", visibility);
      touch.removeEventListener("change", visibility);
    },
  };
}
