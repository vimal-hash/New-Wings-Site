"use client";

import { useEffect, useRef } from "react";
import { journeyControls } from "./journey-controls";
import {
  createDiagonalSectionState,
  diagonalSectionClip,
  diagonalSectionMask,
} from "./diagonal-section-state";
import { diagonalFeatherControls } from "./diagonal-feather-controls";
import { diagonalTransition, diagonalEyeZoom } from "./diagonal-transition";
import BrandArtwork from "./brand-artwork";
import { brandRevealPoint } from "./brand-reveal";
import { createBrandMotion } from "./brand-motion";
import { createBrandCamera } from "./brand-camera";
import { listenSteps, ownInput } from "./scroll-step";

/** One shared feather reveals white and the colour mark across the silver pupil. */
export default function DiagonalSection() {
  const section = useRef<HTMLElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const artwork = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const motion = createDiagonalSectionState(),
      preference = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0;
    const artMotion = createBrandMotion(element, artwork.current!, preference);
    const brandCamera = createBrandCamera(element);
    const active = () => journeyControls.read().phase === "logoDone";
    function paint(progress: number) {
      const feather = diagonalFeatherControls.read(),
        mask = diagonalSectionMask(progress, innerWidth, innerHeight, feather);
      element!.style.clipPath = diagonalSectionClip(
        progress,
        innerWidth,
        innerHeight,
        mask === "none" ? 0 : feather,
      );
      element!.style.maskImage = mask;
      element!.style.setProperty("-webkit-mask-image", mask);
      element!.style.visibility = progress > 0 ? "visible" : "hidden";
      element!.style.pointerEvents = progress > 0 ? "auto" : "none";
      element!.dataset.progress = progress.toFixed(5);
      element!.dataset.feather = String(feather);
      diagonalTransition.setProgress(progress);
      const zoom = diagonalEyeZoom(progress);
      element!.dataset.eyeZoom = zoom.toFixed(4);
      // The camera supplies the real, unzoomed projected pupil diameter. Keep
      // source pixels intact; the SVG viewBox removes only the PNG's margins.
      const diameter = diagonalTransition.pupilDiameter || Math.min(innerWidth, innerHeight) * 0.245;
      const logoWidth = diameter * zoom * 1.17;
      if (logo.current) logo.current.style.width = `${logoWidth.toFixed(3)}px`;
      element!.style.setProperty("--brand-logo-width", `${logoWidth.toFixed(3)}px`);
      const entrancePoint = brandRevealPoint(innerWidth, innerHeight, logoWidth, feather);
      element!.dataset.brandEntrancePoint = entrancePoint.toFixed(5);
      artMotion.update(progress >= entrancePoint, progress > 0);
      brandCamera.update(progress, entrancePoint);
      element!.setAttribute("aria-hidden", progress > 0 ? "false" : "true");
    }
    function publish(covered: boolean) {
      if (journeyControls.read().finalCovered !== covered) journeyControls.update({ finalCovered: covered });
    }
    function tick(now: number) {
      frame = 0;
      if (!active()) return;
      const result = motion.tick(last ? (now - last) / 1000 : 1 / 60, preference.matches);
      last = now;
      paint(result.progress);
      publish(result.covered);
      if (result.moving) frame = requestAnimationFrame(tick);
      else last = 0;
    }
    function wake() {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }
    // One step of the site's scroll (scroll-step.ts) sweeps the whole section in, or back out. Heard first (capture), so
    // the journey below never also takes it; a step back from the bare eye is passed on to the journey (back to View 2).
    const stopSteps = listenSteps(
      window,
      (step, _pixels, event) => {
        if (!active() || !motion.step(step)) return false;
        event.stopImmediatePropagation();
        if (step) wake();
        return true;
      },
      { capture: true },
    );
    // Home and End: straight to the bare eye or the whole section.
    function key(event: KeyboardEvent) {
      if (!active() || ownInput(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      motion.seek(event.key === "Home" ? 0 : 1);
      wake();
    }
    function resize() {
      paint(motion.read().progress);
    }
    const unsubscribeFeather = diagonalFeatherControls.subscribe(resize);
    const unsubscribeLayout = diagonalTransition.subscribeLayout(resize);
    const preview = (event: Event) => {
      if (!active()) return;
      const detail = (event as CustomEvent).detail;
      // Menu jumps arrive as {value, instant}: land on the covered section without the sweep.
      if (detail && typeof detail === "object" && Number.isFinite(detail.value)) {
        motion.seek(detail.value);
        const shot = motion.tick(0, true);
        paint(shot.progress);
        publish(shot.covered);
        return;
      }
      if (typeof detail === "number" && Number.isFinite(detail)) {
        motion.seek(detail);
        wake();
      }
    };
    window.addEventListener("eye-diagonal-preview", preview);
    const unsubscribe = journeyControls.subscribe(() => {
      if (active()) return;
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      motion.reset();
      paint(0);
      publish(false);
    });
    paint(0);
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    return () => {
      unsubscribe();
      unsubscribeFeather();
      unsubscribeLayout();
      artMotion.dispose();
      brandCamera.dispose();
      cancelAnimationFrame(frame);
      stopSteps();
      window.removeEventListener("eye-diagonal-preview", preview);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", resize);
      diagonalTransition.setProgress(0);
      publish(false);
    };
  }, []);
  return (
    <section
      ref={section}
      className="diagonal-next-section"
      aria-label="Next section"
      aria-hidden="true"
      data-progress="0"
    >
      <BrandArtwork root={artwork} />
      <div
        ref={logo}
        className="diagonal-colour-logo"
        data-lens-depth="0"
        data-brand-repel="logo"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "29vmin",
          aspectRatio: "390 / 355",
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
        }}
      >
        <svg
          viewBox="864 398 390 355"
          role="img"
          aria-label="New Wings colour logo"
          style={{ display: "block", width: "100%", height: "100%", overflow: "hidden" }}
        >
          <image href="/images/new-wings-logo-layer-2048x1152.png" width="2048" height="1152" />
        </svg>
      </div>
    </section>
  );
}
