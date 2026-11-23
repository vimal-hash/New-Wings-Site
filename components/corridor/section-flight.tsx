"use client";
/* eslint-disable react-hooks/immutability -- The link is an imperative scroll/frame controller; its mutations occur in event/effect callbacks, outside React rendering. */
import dynamic from "next/dynamic";
import { Component, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import {
  BLUE_FLIGHT,
  YELLOW_FLIGHT,
  FLIGHT,
  flightDistance,
  sectionFlightShare,
  sectionWhiteShare,
} from "../rope-model/rope-flight";
import { BLUE_PORTAL, PORTAL } from "../rope-model/rope-portal";
import type { RopeLink } from "../rope-model/rope-link";
import { createSectionFade } from "../rope-model/section-fade";
import { journeyControls } from "./journey-controls";
import { onVisibleLoadTimeout } from "./overview-fallback";

const RopeModel = dynamic(() => import("../rope-model/rope-model"), { ssr: false });
const RopeLaptop = dynamic(() => import("../rope-laptop/rope-laptop"), { ssr: false });
const ARRIVE_AT = 1.5,
  WHITE_BY = ARRIVE_AT * (1 - 1 / 1.4) - 0.01; // the arriving plane is opaque from scale 1.4 down
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (u: number) => {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
};
// The rope camera: Blender's 24 mm lens on a 36 mm sensor, holding the width of the view.
const ACROSS = 36 / 2 / 24,
  DOOR_MARGIN = 1.05;
// At the far end the next section's plane is whole until the camera is this close: it rests there, not deeper in it.
const END_DOOR = WHITE_BY * 0.9;
/** where: the flight or the page has the scroll. step: the flight's answer to one step of the site's scroll
 *  (scroll-step.ts), passed on by the page while `where` is "flight"; false at either end, where the page has it. */
export type FlightControl = { where: "flight" | "rest"; step?: (step: number) => boolean };
type Props = {
  device: "desktop" | "laptop";
  interactive: RefObject<boolean>;
  first: string;
  second: string;
  startAtEnd: boolean;
  control: RefObject<FlightControl>;
  onArrive: (side: "start" | "end", inWhite: boolean) => void;
  onFailure: () => void;
  children?: ReactNode;
  blue?: boolean;
  yellow?: boolean;
  autoEnter?: boolean;
  entry: number;
  entryDistance: number;
};

class FlightBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One reusable canvas: green/red 1→2, blue 2→3, yellow/green 3→4. */
export default function SectionFlight({
  device,
  interactive,
  first,
  second,
  startAtEnd,
  control,
  onArrive,
  onFailure,
  children,
  blue = false,
  yellow = false,
  autoEnter = false,
  entry,
  entryDistance,
}: Props) {
  const layer = useRef<HTMLDivElement>(null),
    section = useRef<HTMLDivElement>(null),
    info = useRef<HTMLDivElement>(null),
    white = useRef<HTMLDivElement>(null),
    arriving = useRef<HTMLDivElement>(null);
  const profile = yellow ? YELLOW_FLIGHT : blue ? BLUE_FLIGHT : FLIGHT;
  const link = useMemo(() => {
    const whiteOutAt = sectionWhiteShare(profile);
    const eased = (blue || yellow) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      fade = createSectionFade(startAtEnd ? 1 : 0);
    // The white door: the camera rests where the white opening just fills the screen, corners and all, so the section's
    // white is the opening itself, and its edge is seen opening out from the corners as the camera leaves. Flying back,
    // it lands there as the opening swallows the screen.
    const portal = blue ? BLUE_PORTAL : PORTAL,
      reach = ACROSS * Math.hypot(1, window.innerHeight / Math.max(window.innerWidth, 1));
    const doorDepth = (portal.radius - portal.edge) / (reach * DOOR_MARGIN),
      home = portal.z + doorDepth,
      door = Math.max(home + profile.travel, 0);
    const whiteWithin = doorDepth * (1 - 1 / DOOR_MARGIN) * 0.8; // past the door by less than this, the screen is still all white
    const homeShare = (door * profile.holdFrom) / profile.stopAt,
      endSpan = profile.travel - profile.stopAt;
    const fromHome = (share: number) =>
      share < profile.holdFrom
        ? homeShare + share * (1 - door / profile.stopAt)
        : share > profile.holdTo
          ? profile.holdTo + ((share - profile.holdTo) * (endSpan - END_DOOR)) / endSpan
          : share;
    let element: HTMLDivElement | null = null,
      scrollShare = startAtEnd ? 1 : 0,
      departureHidden: boolean | undefined,
      lastArrivalSize = -1,
      ready = false,
      away = false,
      launchFrame = 0,
      fadeFrame = 0,
      fadeTime = 0,
      fadeTarget = startAtEnd ? 1 : 0,
      lastBehind = -Infinity,
      lastAt = NaN, // NaN: the first frame of a leg is never "returning"
      way = 0;
    let stopWaiting: (() => void) | undefined;
    function waitForFlight() {
      if (ready || !interactive.current || stopWaiting) return;
      stopWaiting = onVisibleLoadTimeout(() => {
        stopWaiting = undefined;
        if (!ready && interactive.current && control.current.where === "flight") onFailure();
      });
    }
    const whiteOut = (at: number) => {
      const turned = smooth(at / whiteOutAt),
        gone = smooth(at / (whiteOutAt * 0.7));
      if (white.current) white.current.style.opacity = String(turned);
      if (info.current) {
        info.current.style.opacity = String(1 - gone);
        info.current.style.filter =
          gone > 0 && gone < 1
            ? `blur(${(gone * 14).toFixed(1)}px) brightness(${(1 + gone * 0.6).toFixed(2)})`
            : "none";
        info.current.style.visibility = gone >= 1 ? "hidden" : "inherit";
      }
    };
    const wake = () => {
      const at = scrollShare;
      if (
        ready &&
        made.covered &&
        control.current.where === "flight" &&
        at > whiteOutAt * 0.9 &&
        (at < 1 || !startAtEnd) &&
        (!eased || startAtEnd || fade.value >= 0.98)
      ) {
        made.covered = false;
        made.wake?.();
      }
    };
    const animateFade = (now: number) => {
      fadeFrame = 0;
      const moving = fade.move(fadeTarget, fadeTime ? (now - fadeTime) / 1000 : 1 / 60);
      fadeTime = now;
      whiteOut(fade.value * whiteOutAt);
      wake();
      if (made.covered && away && scrollShare <= 0.0005 && fade.value === 0 && control.current.where === "flight")
        made.camera(home);
      // A reversing fade can finish after the camera reaches its start.
      made.wake?.();
      if (moving) fadeFrame = requestAnimationFrame(animateFade);
      else fadeTime = 0;
    };
    const scroll = (at: number) => {
      scrollShare = at;
      const next = clamp01(at / whiteOutAt);
      if (next !== fadeTarget) {
        fadeTarget = next;
        if (eased) {
          if (!fadeFrame) fadeFrame = requestAnimationFrame(animateFade);
        } else {
          fade.snap(next);
          whiteOut(at);
        }
      }
      if (startAtEnd ? at < 0.9995 : at > 0.0005) away = true;
      if (away && control.current.where === "flight") waitForFlight();
      // Reversing during the white fade never wakes the covered canvas. Finish
      // that return here so Section 2 can immediately scroll back into red.
      if (made.covered && away && at <= 0.0005 && control.current.where === "flight" && !fadeFrame)
        made.camera(home);
      wake();
    };
    const made: RopeLink & { entry: number; waitForFlight(): void; step(way: number): boolean; dispose(): void } = {
      entry,
      scroll,
      waitForFlight,
      startZ: startAtEnd ? -END_DOOR : home,
      covered: true,
      wake: null,
      shouldWarm() {
        const phase = journeyControls.read().phase;
        return (
          interactive.current || phase === "awaitAssembly" || phase === "done" ||
          phase === "drawings" || phase === "page"
        );
      },
      attach(found) {
        element = found;
        // Never scrolled by the browser: the page passes each step of the site's scroll on to the glide (step below).
        found.style.overflowY = "hidden";
        found.tabIndex = -1;
        found.scrollTop = startAtEnd ? found.scrollHeight : 0;
        whiteOut(scrollShare);
      },
      flightShare(at) {
        return fromHome(eased && !startAtEnd && fade.value < 0.98 ? 0 : sectionFlightShare(at, profile));
      },
      glide: {
        lead: eased ? 0.3 : 0,
        leadShare: whiteOutAt,
        units: (at) => flightDistance(fromHome(sectionFlightShare(at, profile)), profile),
      },
      camera(z) {
        const flown = z - home,
          behind = -z,
          at = scrollShare,
          a = section.current,
          b = arriving.current;
        const hidden = flown > 0.01;
        if (a && departureHidden !== hidden) {
          departureHidden = hidden;
          a.style.visibility = hidden ? "hidden" : "inherit";
        }
        if (b) {
          const size = behind < ARRIVE_AT * 0.8 ? ARRIVE_AT / (ARRIVE_AT - behind) : 5;
          if (size !== lastArrivalSize) {
            lastArrivalSize = size;
            b.style.transform = `scale(${size})`;
            b.style.opacity = String(1 - clamp01((size - 1.4) / 3.6));
            b.style.visibility = size >= 5 ? "hidden" : "inherit";
          }
        }
        if (control.current.where === "rest") {
          made.covered = true;
          return;
        }
        // The white portal is fully over the screen before the camera has settled: land there, and the reveal needs no dead wait.
        const closing = behind < lastBehind - 1e-4;
        lastBehind = behind;
        // Flying back, the same: land as soon as the leaving section's white is whole again, so the section's own white
        // lifts off it as slowly as it does going forwards (it used to fade out in the last fraction of a second).
        // The white opening fills the screen from a little before the door, so there the canvas is all white; once the
        // leaving plane is back on top, its own white must be whole too. The leg's way is kept after its scroll has
        // ended, while the camera is still coming in.
        if (at !== lastAt && !Number.isNaN(lastAt)) way = Math.sign(at - lastAt);
        lastAt = at;
        const returning = way < 0;
        const backInWhite =
          returning &&
          flown < whiteWithin &&
          (flown > 0.01 || Number(white.current?.style.opacity || 0) >= 0.97);
        const atEnd =
            (at >= 0.9995 && behind < END_DOOR + 0.002) || (closing && at >= 0.97 && behind < WHITE_BY),
          atStart = backInWhite || (at <= 0.0005 && flown < 0.0005 && (!eased || fade.value === 0));
        if (atEnd || atStart) made.covered = true;
        if (away && (atEnd || atStart)) {
          away = false;
          control.current.where = "rest";
          if (layer.current) layer.current.style.visibility = "hidden";
          onArrive(atEnd ? "end" : "start", atEnd || backInWhite);
        }
      },
      ready() {
        if (!element || ready) return;
        ready = true;
        stopWaiting?.();
        if (autoEnter) {
          control.current.where = "flight";
          element.focus({ preventScroll: true });
          const found = element;
          // Continue the gesture that entered this connection, just as the
          // first section does. A fabricated .1-screen step felt like a replay.
          // At least a few pixels: a touchpad's first event can be under one, which the glide reads as still resting at
          // the end, and the visitor was left on the white portal.
          launchFrame = requestAnimationFrame(() => {
            found.scrollTop += Math.sign(entryDistance || 1) * Math.max(Math.abs(entryDistance), 8);
          });
        } else if (!startAtEnd && interactive.current) element.focus({ preventScroll: true });
        wake();
      },
      failed: onFailure,
      // One step of the site's scroll. With motion the glide flies the leg (rope-flight.ts); with reduced motion there is
      // no glide, and the step goes straight to the next resting place, as the glide would end it.
      step(way) {
        if (way) waitForFlight();
        if (!element || !way) return true;
        if (made.glide.take) return made.glide.take(way);
        const total = element.scrollHeight - element.clientHeight,
          top = element.scrollTop,
          from = profile.holdFrom * total,
          to = profile.holdTo * total;
        if ((way < 0 && top <= 1) || (way > 0 && top >= total - 1)) return false;
        const atStop = top >= from - 2 && top <= to + 2;
        element.scrollTop = profile.through
          ? way > 0
            ? total
            : 0
          : atStop
            ? way > 0
              ? total
              : 0
            : top < from
              ? way > 0
                ? from
                : 0
              : way > 0
                ? total
                : to;
        return true;
      },
      dispose() {
        stopWaiting?.();
        stopWaiting = undefined;
        cancelAnimationFrame(launchFrame);
        cancelAnimationFrame(fadeFrame);
      },
    };
    return made;
  }, [
    interactive,
    control,
    onArrive,
    onFailure,
    startAtEnd,
    autoEnter,
    profile,
    entry,
    entryDistance,
    blue,
    yellow,
  ]);
  // The page passes each step of the site's scroll on to this flight while it has the scroll.
  useLayoutEffect(() => {
    const flight = control.current,
      step = (way: number) => link.step(way);
    flight.step = step;
    return () => {
      if (flight.step === step) flight.step = undefined;
    };
  }, [link, control]);
  useLayoutEffect(() => {
    const node = layer.current;
    node?.addEventListener("webglcontextlost", onFailure, true);
    return () => node?.removeEventListener("webglcontextlost", onFailure, true);
  }, [onFailure]);
  useLayoutEffect(() => {
    // A new connection reuses these DOM planes. Reset them before paint: the
    // previous destination must not flash as the next destination during load.
    if (section.current) section.current.style.visibility = startAtEnd ? "hidden" : "inherit";
    if (white.current) white.current.style.opacity = startAtEnd ? "1" : "0";
    if (info.current) {
      info.current.style.visibility = startAtEnd ? "hidden" : "inherit";
      info.current.style.opacity = startAtEnd ? "0" : "1";
      info.current.style.filter = "none";
    }
    if (arriving.current) {
      arriving.current.style.visibility = startAtEnd ? "inherit" : "hidden";
      arriving.current.style.transform = "scale(1)";
      arriving.current.style.opacity = "1";
    }
    if (layer.current) layer.current.style.visibility = startAtEnd && !autoEnter ? "hidden" : "visible";
    if (autoEnter) link.waitForFlight();
    return () => link.dispose();
  }, [link, startAtEnd, autoEnter]);
  const plane = { position: "absolute", inset: 0, pointerEvents: "none" } as const;
  const over = (
    <>
      <div ref={section} data-section-leaving aria-hidden="true" style={{ ...plane, background: first }}>
        <div ref={info} data-section-info style={{ ...plane, willChange: "opacity,filter" }}>
          {children}
        </div>
        <div ref={white} data-section-white style={{ ...plane, background: "#fff", opacity: 0 }} />
      </div>
      <div
        ref={arriving}
        data-section-arriving
        aria-hidden="true"
        style={{ ...plane, background: second, visibility: "hidden", willChange: "transform,opacity" }}
      />
    </>
  );
  return (
    <div ref={layer} data-section-flight={yellow ? "yellow-green" : blue ? "blue" : "green-red"}>
      <FlightBoundary onFailure={onFailure}>
        {device === "desktop" ? (
          <RopeModel flight blue={blue} yellow={yellow} link={link} over={over} />
        ) : (
          <RopeLaptop flight blue={blue} yellow={yellow} link={link} over={over} />
        )}
      </FlightBoundary>
    </div>
  );
}
