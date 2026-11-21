"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import type { JourneyPhase } from "./journey-controls";
import { sceneMotion } from "./scene-idle";

const FOLLOW = 4.2;
const acceptsMouse = (phase: JourneyPhase) => phase === "idle" || phase === "drawings";
const departures = new Set<JourneyPhase>(["glassesExit", "pullback", "screens", "corridor"]);

type Props = {
  journey: RefObject<{ phase: JourneyPhase; reduce: boolean }>;
  orbit: boolean;
};

/** Add local yaw and pitch after FullJourney has placed the camera for this frame. */
export default function StopMouseLook({ journey, orbit }: Props) {
  const invalidate = useThree((state) => state.invalidate);
  const look = useRef({ target: new Vector2(), current: new Vector2(), velocity: new Vector2(), active: false });

  const reset = useCallback(() => {
    const gaze = look.current;
    gaze.active = false;
    gaze.current.set(0, 0);
    gaze.target.set(0, 0);
    gaze.velocity.set(0, 0);
  }, []);

  useEffect(() => {
    const gaze = look.current;
    reset();
    if (orbit) return;
    const clear = () => {
      if (!gaze.active) return;
      gaze.target.set(0, 0);
      invalidate();
    };
    const pointer = (event: PointerEvent) => {
      if (!acceptsMouse(journey.current.phase) || journey.current.reduce) return;
      if (
        event.pointerType !== "mouse" ||
        (event.target instanceof Element && event.target.closest("button,a,input,[data-cinema-controls]"))
      ) {
        clear();
        return;
      }
      gaze.active = true;
      gaze.target.set(
        (1 - (event.clientX / innerWidth) * 2) * 0.065,
        (1 - (event.clientY / innerHeight) * 2) * 0.042,
      );
      invalidate();
    };
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("blur", clear);
    document.documentElement.addEventListener("pointerleave", clear);
    window.addEventListener("journey-jump", reset);
    window.addEventListener("eye-camera-view", reset);
    return () => {
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("blur", clear);
      document.documentElement.removeEventListener("pointerleave", clear);
      window.removeEventListener("journey-jump", reset);
      window.removeEventListener("eye-camera-view", reset);
    };
  }, [invalidate, journey, orbit, reset]);

  useFrame(({ camera }, dt) => {
    const gaze = look.current;
    if (!gaze.active || orbit || document.hidden) return;
    const { phase, reduce } = journey.current;
    const atStop = acceptsMouse(phase);
    if (reduce || (!atStop && !departures.has(phase))) {
      reset();
      return;
    }
    // Once scrolling, ease the offset back to zero over the moving camera's authored orientation.
    if (!atStop) gaze.target.set(0, 0);
    const step = Math.min(dt, 0.05) / 4;
    for (let i = 0; i < 4; i++) {
      gaze.velocity.x += (FOLLOW * FOLLOW * (gaze.target.x - gaze.current.x) - 2 * FOLLOW * gaze.velocity.x) * step;
      gaze.velocity.y += (FOLLOW * FOLLOW * (gaze.target.y - gaze.current.y) - 2 * FOLLOW * gaze.velocity.y) * step;
      gaze.current.addScaledVector(gaze.velocity, step);
    }
    if (gaze.current.distanceToSquared(gaze.target) > 1.6e-7 || gaze.velocity.lengthSq() > 1e-8) {
      sceneMotion.at = performance.now();
      invalidate();
    } else {
      gaze.current.copy(gaze.target);
      gaze.velocity.set(0, 0);
      gaze.active = gaze.current.lengthSq() > 0;
    }
    camera.rotateY(gaze.current.x);
    camera.rotateX(gaze.current.y);
  }, -0.95);

  return null;
}
