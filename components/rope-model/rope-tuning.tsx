"use client";
import { useEffect, useState, type CSSProperties, type RefObject } from "react";

/** Live look controls. TUNING_BASE is the look the user approved, set by them on this panel (2026-11-04). Each value multiplies the look matched to the Blender picture, where 1 is that match. Gloss is new: 0 adds nothing. Drafts stay in this browser until they are written into the code. */
export type RopeTuning = {
  red: { glow: number; shine: number; gloss: number };
  white: { glow: number; shine: number; gloss: number; speed: number };
  flow: { speed: number };
};
export type RopeTuningView = { values: RopeTuning; holdWhite: boolean };

export const TUNING_BASE: RopeTuning = {
  red: { glow: 1.2, shine: 0.8, gloss: 0 },
  white: { glow: 4, shine: 1.8, gloss: 0, speed: 3 },
  flow: { speed: 0.3 },
};
const STORE = "rope-tuning-v1";

type Item = { key: string; label: string; hint: string; max: number };
const GROUPS: { group: keyof RopeTuning; title: string; note?: string; items: Item[] }[] = [
  {
    group: "red",
    title: "Red threads",
    items: [
      { key: "glow", label: "Glow", hint: "soft halo around the threads", max: 4 },
      { key: "shine", label: "Shine", hint: "how bright the threads are", max: 4 },
      { key: "gloss", label: "Gloss", hint: "sharp highlights along the threads", max: 2 },
    ],
  },
  {
    group: "white",
    title: "White spread",
    note: "While your mouse is in this box, a rope stays white so you can see it.",
    items: [
      { key: "glow", label: "Glow", hint: "soft halo around the white", max: 4 },
      { key: "shine", label: "Shine", hint: "how bright the white is", max: 3 },
      { key: "gloss", label: "Gloss", hint: "sharp highlights on the white", max: 2 },
      { key: "speed", label: "Speed", hint: "how fast the white creeps", max: 5 },
    ],
  },
  {
    group: "flow",
    title: "Energy flow",
    items: [{ key: "speed", label: "Speed", hint: "how fast the light travels", max: 5 }],
  },
];

const clone = (from: RopeTuning): RopeTuning => JSON.parse(JSON.stringify(from));
const numberOr = (value: unknown, fallback: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;

// Anything missing or broken in the saved draft falls back to the approved value.
function readSaved(): RopeTuning {
  const values = clone(TUNING_BASE);
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE) ?? "{}");
    for (const { group, items } of GROUPS)
      for (const { key, max } of items) {
        const target = values[group] as Record<string, number>;
        target[key] = numberOr(saved?.[group]?.[key], target[key], max);
      }
  } catch {}
  return values;
}
function save(values: RopeTuning) {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(values));
  } catch {}
}

const box: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 272,
  maxHeight: "calc(100dvh - 24px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: 12,
  borderRadius: 10,
  background: "rgba(14,8,10,.86)",
  border: "1px solid rgba(255,255,255,.14)",
  color: "#eee",
  font: "12px/1.35 system-ui,sans-serif",
  backdropFilter: "blur(8px)",
  colorScheme: "dark",
};
const button: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,.08)",
  border: "1px solid rgba(255,255,255,.18)",
  color: "#eee",
  font: "inherit",
  cursor: "pointer",
};
const quiet: CSSProperties = { color: "#a99", fontSize: 11 };

export function RopeTuningPanel({
  view,
  onChange,
}: {
  view: RefObject<RopeTuningView>;
  onChange: () => void;
}) {
  const [values, setValues] = useState<RopeTuning>(TUNING_BASE);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState("");
  // Saved values can only be read in the browser, so they are picked up just after the page appears.
  useEffect(() => {
    const saved = readSaved();
    setValues(saved);
    view.current.values = saved;
    onChange();
  }, [view, onChange]);
  const change = (next: RopeTuning) => {
    setValues(next);
    view.current.values = next;
    save(next);
    setCopied("");
    onChange();
  };
  const set = (group: keyof RopeTuning, key: string, value: number) => {
    const next = clone(values);
    (next[group] as Record<string, number>)[key] = value;
    change(next);
  };
  const hold = (white: boolean) => {
    view.current.holdWhite = white;
    onChange();
  };
  const peek = (base: boolean) => {
    view.current.values = base ? TUNING_BASE : values;
    onChange();
  };
  const copy = async () => {
    const text = JSON.stringify(values);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied. Paste it to me in chat.");
    } catch {
      setCopied(text);
    }
  };
  if (!open)
    return (
      <button
        type="button"
        style={{ ...button, position: "absolute", top: 12, right: 12 }}
        onClick={() => setOpen(true)}
      >
        Look controls
      </button>
    );
  return (
    <div data-rope-tuning style={box}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
      >
        <strong style={{ fontSize: 13 }}>Look controls</strong>
        <button type="button" style={button} onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>
      <div style={{ ...quiet, marginBottom: 10 }}>
        These starting values are the look you approved. Gloss starts at 0.
      </div>
      {GROUPS.map(({ group, title, note, items }) => (
        <section
          key={group}
          style={{ borderTop: "1px solid rgba(255,255,255,.12)", padding: "8px 0" }}
          onPointerEnter={group === "white" ? () => hold(true) : undefined}
          onPointerLeave={group === "white" ? () => hold(false) : undefined}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <strong>{title}</strong>
            <button
              type="button"
              style={button}
              onClick={() => {
                const next = clone(values);
                (next[group] as Record<string, number>) = clone(TUNING_BASE)[group];
                change(next);
              }}
            >
              Reset
            </button>
          </div>
          {note ? <div style={{ ...quiet, marginBottom: 6 }}>{note}</div> : null}
          {items.map(({ key, label, hint, max }) => {
            const value = (values[group] as Record<string, number>)[key],
              id = `rope-${group}-${key}`;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label htmlFor={id}>
                    {label} <span style={quiet}>{hint}</span>
                  </label>
                  <input
                    aria-label={`${title} ${label} value`}
                    type="number"
                    min={0}
                    max={max}
                    step={0.01}
                    value={Number(value.toFixed(2))}
                    style={{
                      width: 52,
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,.18)",
                      borderRadius: 4,
                      color: "#eee",
                      font: "inherit",
                      textAlign: "right",
                    }}
                    onChange={(event) => {
                      const typed = Number(event.target.value);
                      if (Number.isFinite(typed)) set(group, key, Math.min(max, Math.max(0, typed)));
                    }}
                  />
                </div>
                <input
                  id={id}
                  type="range"
                  min={0}
                  max={max}
                  step={0.01}
                  value={value}
                  style={{ width: "100%", accentColor: "#e9b48c", margin: "2px 0 0" }}
                  onChange={(event) => set(group, key, Number(event.target.value))}
                />
              </div>
            );
          })}
        </section>
      ))}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.12)",
          paddingTop: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <button
          type="button"
          style={button}
          onPointerDown={() => peek(true)}
          onPointerUp={() => peek(false)}
          onPointerLeave={() => peek(false)}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") peek(true);
          }}
          onKeyUp={() => peek(false)}
        >
          Hold to see approved look
        </button>
        <button type="button" style={button} onClick={() => change(clone(TUNING_BASE))}>
          Reset all
        </button>
        <button type="button" style={button} onClick={copy}>
          Copy values
        </button>
      </div>
      {copied ? (
        <div style={{ ...quiet, marginTop: 6, wordBreak: "break-all" }} role="status">
          {copied}
        </div>
      ) : null}
    </div>
  );
}
