"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultLoadingManager } from "three";
import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import { traceMark } from "./loading-trace";

/** Six cinema objects, drawn as one-weight line icons. */
const ICONS: { name: string; d: string }[] = [
  {
    name: "Projector",
    d: "M6 18h28v14H6zM34 22l8-3v12l-8-3M12 32v4M28 32v4M11 25a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  },
  { name: "Screen", d: "M5 9q19-4 38 0v22q-19-4-38 0zM24 31v8M16 41h16" },
  { name: "Lamp", d: "M18 6h12l5 14H13zM24 20v16M16 40h16M24 36v4" },
  { name: "3D glasses", d: "M4 18h40M6 18l2 12h11l3-6h4l3 6h11l2-12" },
  { name: "Sound system", d: "M13 5h22v38H13zM24 17a3 3 0 1 0 0 .1M24 34a6 6 0 1 0 0 .1" },
  { name: "Chair", d: "M12 8q12-4 24 0v18H12zM8 24h6v12H8zM34 24h6v12h-6zM14 30h20M12 36v6M36 36v6" },
];

/**
 * White opening loader. The number follows real downloads but never waits on them alone:
 * an eased clock carries it to 90% within a few seconds, then it completes when
 * the theatre and the next projector shot are ready.
 */
export default function SiteLoader({ sceneFailed }: { sceneFailed: boolean }) {
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  const projector = useSyncExternalStore(
    projectorControls.subscribe,
    projectorControls.read,
    projectorControls.read,
  );
  const [value, setValue] = useState(0),
    [icon, setIcon] = useState(0),
    [gone, setGone] = useState(false);
  const shown = useRef(0),
    real = useRef(0),
    finish = useRef<number | null>(null),
    start = useRef(0);
  const ready = journey.openingPrepared && projector.ready;
  const failed = sceneFailed || projector.failed;

  useEffect(() => {
    const manager = DefaultLoadingManager,
      previous = manager.onProgress;
    manager.onProgress = (url, loaded, total) => {
      previous?.(url, loaded, total);
      real.current = Math.max(real.current, total ? loaded / total : 0);
    };
    return () => {
      manager.onProgress = previous;
    };
  }, []);

  useEffect(() => {
    if (gone || failed) return;
    const timer = window.setInterval(() => setIcon((i) => (i + 1) % ICONS.length), 620);
    return () => window.clearInterval(timer);
  }, [gone, failed]);

  useEffect(() => {
    if (gone || failed) return;
    let frame = 0;
    start.current ||= performance.now();
    const tick = (now: number) => {
      const seconds = (now - start.current) / 1000;
      if (ready && finish.current === null) finish.current = now;
      const clock = 0.9 * (1 - Math.exp(-seconds / 1.7));
      let target = Math.max(clock, 0.9 * real.current);
      if (finish.current !== null)
        target = Math.min(1, Math.max(shown.current, target) + (now - finish.current) / 420);
      shown.current = Math.max(shown.current, shown.current + (target - shown.current) * 0.18);
      if (finish.current !== null && target >= 1 && shown.current > 0.995) shown.current = 1;
      setValue(Math.floor(shown.current * 100));
      if (shown.current >= 1) {
        traceMark("Journey opening loader released");
        journeyControls.update({ loaderDone: true });
        window.setTimeout(() => setGone(true), 650);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, gone, failed]);

  if (gone) return null;
  if (failed)
    return (
      <div className="site-loader" role="alert">
        <p>The 3D journey couldn’t load.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload view
        </button>
      </div>
    );
  const done = value >= 100;
  return (
    <div
      className={`site-loader${done ? " site-loader--done" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${value}%`}
    >
      <div className="site-loader__icon" aria-hidden="true">
        {ICONS.map((item, i) => (
          <svg key={item.name} viewBox="0 0 48 48" className={i === icon ? "is-on" : ""}>
            <path d={item.d} />
          </svg>
        ))}
      </div>
      <p className="site-loader__name">{ICONS[icon].name}</p>
      <p className="site-loader__value">
        <span>{String(value).padStart(2, "0")}</span>%
      </p>
      <div className="site-loader__bar">
        <i style={{ transform: `scaleX(${value / 100})` }} />
      </div>
      <p className="site-loader__brand">New Wings Solutions</p>
    </div>
  );
}
