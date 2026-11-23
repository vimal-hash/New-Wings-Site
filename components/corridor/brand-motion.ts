import { brandRepulsion } from "./brand-repulsion";

/** One DOM owner: finite entrances, compositor idle motion and event-driven mouse easing. */
export function createBrandMotion(section: HTMLElement, root: HTMLElement, preference: MediaQueryList) {
  const layers = [...root.querySelectorAll<HTMLElement>("[data-brand-layer]")];
  const targets = [...section.querySelectorAll<HTMLElement>("[data-brand-repel]")].map((element) => ({
    element,
    x: 0,
    y: 0,
    rect: { x: 0, y: 0, width: 0, height: 0 },
  }));
  const entrances = new Set<Animation>();
  let ready = false,
    visible: boolean | undefined,
    generation = 0,
    frame = 0,
    last = 0,
    dirty = true;
  let pointer: { x: number; y: number } | null = null;
  function clearEntrances() {
    generation++;
    entrances.forEach((animation) => {
      animation.onfinish = null;
      animation.cancel();
    });
    entrances.clear();
  }
  function reveal(next: boolean, force = false) {
    if (next === ready && !force) return;
    ready = next;
    clearEntrances();
    const run = generation;
    root.dataset.revealed = String(next);
    root.setAttribute("aria-hidden", String(!next));
    layers.forEach((layer) => {
      const type = layer.dataset.brandLayer;
      const finalMask = type === "left" ? "100% 0" : "0% 0";
      layer.style.opacity = next && preference.matches ? "1" : "0";
      layer.style.transform = "none";
      layer.style.clipPath = "none";
      if (type === "left" || type === "right") {
        layer.style.maskImage =
          next && preference.matches
            ? "none"
            : `linear-gradient(to ${type === "left" ? "right" : "left"},transparent 45%,#000 50%)`;
        layer.style.maskPosition =
          next && preference.matches ? finalMask : type === "left" ? "0% 0" : "100% 0";
      }
      if (!next || preference.matches) return;
      let keys: Keyframe[],
        duration = 1000;
      if (type === "left" || type === "right") {
        duration = 1150;
        keys = [
          { opacity: 1, maskPosition: type === "left" ? "0% 0" : "100% 0" },
          { opacity: 1, maskPosition: finalMask },
        ];
      } else if (type === "ring") {
        duration = 1050;
        keys = [
          { opacity: 0, transform: "scale(.42)" },
          { opacity: 1, transform: "scale(1)" },
        ];
      } else if (type === "screen") {
        keys = [
          { opacity: 0, clipPath: "inset(0 50% 0 50%)" },
          { opacity: 1, clipPath: "inset(0 0 0 0)" },
        ];
      } else if (type === "seats") {
        keys = [
          { opacity: 0, clipPath: "inset(100% 0 0 0)", transform: "translateY(8px)" },
          { opacity: 1, clipPath: "inset(0 0 0 0)", transform: "translateY(0)" },
        ];
      } else {
        const y = Number(layer.dataset.brandShift || 0);
        keys = [
          { opacity: 0, transform: `translateY(${y}px)` },
          { opacity: 1, transform: "translateY(0)" },
        ];
      }
      const animation = layer.animate(keys, {
        duration,
        delay: Number(layer.dataset.brandDelay || 0),
        easing: "cubic-bezier(.22,.7,.24,1)",
        fill: "both",
      });
      entrances.add(animation);
      animation.onfinish = () => {
        if (run === generation && ready) {
          layer.style.opacity = "1";
          layer.style.transform = "none";
          layer.style.clipPath = "none";
          if (type === "left" || type === "right") {
            layer.style.maskPosition = finalMask;
            layer.style.maskImage = "none";
          }
        }
        animation.cancel();
        entrances.delete(animation);
      };
    });
  }
  function resetPointer() {
    pointer = null;
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    targets.forEach((target) => {
      target.x = target.y = 0;
      target.element.style.translate = "0px 0px";
    });
    dirty = true;
  }
  function lifecycle() {
    const asleep = document.hidden || !visible;
    root.style.setProperty(
      "--brand-play-state",
      ready && !asleep && !preference.matches ? "running" : "paused",
    );
    entrances.forEach((animation) => (asleep ? animation.pause() : animation.play()));
    if (asleep || preference.matches) resetPointer();
    root.dataset.motionEnabled = String(!asleep && !preference.matches);
  }
  function measure() {
    targets.forEach((target) => {
      const rect = target.element.getBoundingClientRect();
      target.rect = { x: rect.x - target.x, y: rect.y - target.y, width: rect.width, height: rect.height };
    });
    dirty = false;
  }
  function tick(now: number) {
    frame = 0;
    if (!visible || document.hidden || preference.matches) return;
    if (dirty) measure();
    const blend = 1 - Math.exp(-Math.min(0.05, last ? (now - last) / 1000 : 1 / 60) / 0.13);
    last = now;
    let moving = false;
    targets.forEach((target) => {
      const kind = target.element.dataset.brandRepel || "object";
      const offset =
        pointer && (ready || kind === "logo")
          ? brandRepulsion(
              pointer.x,
              pointer.y,
              target.rect,
              kind,
              Number(target.element.dataset.brandRing || 0),
            )
          : { x: 0, y: 0 };
      if (offset.x === target.x && offset.y === target.y) return;
      target.x += (offset.x - target.x) * blend;
      target.y += (offset.y - target.y) * blend;
      if (Math.hypot(offset.x - target.x, offset.y - target.y) < 0.02) {
        target.x = offset.x;
        target.y = offset.y;
      } else moving = true;
      target.element.style.translate = `${target.x.toFixed(3)}px ${target.y.toFixed(3)}px`;
    });
    if (moving) frame = requestAnimationFrame(tick);
    else last = 0;
  }
  function wake() {
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  function pointerMove(event: PointerEvent) {
    if (!visible || document.hidden || preference.matches) return;
    if (root.dataset.pointerKind !== event.pointerType) root.dataset.pointerKind = event.pointerType;
    if (event.pointerType !== "mouse") return;
    pointer =
      event.target instanceof Element && event.target.closest("[data-cinema-controls]")
        ? null
        : { x: event.clientX, y: event.clientY };
    root.dataset.pointerLocation = pointer ? `${pointer.x},${pointer.y}` : "";
    dirty = true;
    wake();
  }
  function leave(event: Event) {
    pointer = null;
    root.dataset.pointerExit = event.type;
    wake();
  }
  function resized() {
    dirty = true;
    if (pointer) wake();
  }
  function reduced() {
    reveal(ready, true);
    lifecycle();
  }
  window.addEventListener("pointermove", pointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  window.addEventListener("blur", leave);
  window.addEventListener("resize", resized);
  document.addEventListener("visibilitychange", lifecycle);
  preference.addEventListener("change", reduced);
  return {
    update(next: boolean, shown: boolean) {
      const changed = shown !== visible || next !== ready;
      visible = shown;
      dirty = true;
      if (!changed) return;
      reveal(next);
      lifecycle();
    },
    dispose() {
      clearEntrances();
      resetPointer();
      window.removeEventListener("pointermove", pointerMove);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      window.removeEventListener("resize", resized);
      document.removeEventListener("visibilitychange", lifecycle);
      preference.removeEventListener("change", reduced);
      root.style.setProperty("--brand-play-state", "paused");
    },
  };
}
