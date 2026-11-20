"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DefaultLoadingManager } from "three";
import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import { traceMark } from "./loading-trace";

/** Six cinema objects, drawn as one-weight line icons. */
const ICONS: { name: string; d: string; transform?: string }[] = [
  {
    name: "Projector",
    d: "M6 18h28v14H6zM34 22l8-3v12l-8-3M12 32v4M28 32v4M11 25a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  },
  { name: "Screen", d: "M3 9q21 5 42 0v25q-21 5-42 0z M6 13q18 4 36 0v18q-18 4-36 0z M5 39q19 4 38 0" },
  {
    name: "Lamp",
    transform: "rotate(-16 24 24)",
    // Xenon arc lamp: two ferrules, glass envelope and opposing electrodes.
    d: "M2 21h8v6H2z M38 21h8v6h-8z M10 22h3c3 0 4-7 11-7s8 7 11 7h3v4h-3c-3 0-4 7-11 7s-8-7-11-7h-3z M14 24h6l1.5-1v2L20 24 M34 24h-6l-3-1.5v3l3-1.5",
  },
  { name: "3D glasses", d: "M4 18h40M6 18l2 12h11l3-6h4l3 6h11l2-12" },
  {
    name: "Sound system",
    d: "M4 9h16v30H4z M7 13h10l-2 5H9z M17 29a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M28 9h16v30H28z M31 13h10l-2 5h-6z M41 29a5 5 0 1 1-10 0 5 5 0 0 1 10 0z",
  },
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
    let removeTimer = 0;
    start.current ||= performance.now();
    const tick = (now: number, catchUp = false) => {
      const seconds = (now - start.current) / 1000;
      if (ready && finish.current === null) finish.current = now;
      const clock = 0.9 * (1 - Math.exp(-seconds / 1.7));
      let target = Math.max(clock, 0.9 * real.current);
      if (finish.current !== null)
        target = Math.min(1, Math.max(shown.current, target) + (now - finish.current) / 420);
      shown.current = Math.max(shown.current, shown.current + (target - shown.current) * (catchUp ? 1 : 0.18));
      if (finish.current !== null && target >= 1 && shown.current > 0.995) shown.current = 1;
      if (document.hidden && ready) shown.current = 1;
      setValue(Math.floor(shown.current * 100));
      if (shown.current >= 1) {
        traceMark("Journey opening loader released");
        journeyControls.update({ loaderDone: true });
        if (document.hidden) setGone(true);
        else removeTimer = window.setTimeout(() => setGone(true), 650);
        return;
      }
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      if (removeTimer && document.hidden) setGone(true);
      else if (!removeTimer) tick(performance.now(), true);
    };
    document.addEventListener("visibilitychange", refresh);
    refresh();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(removeTimer);
      document.removeEventListener("visibilitychange", refresh);
    };
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
            <path d={item.d} transform={item.transform} />
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
