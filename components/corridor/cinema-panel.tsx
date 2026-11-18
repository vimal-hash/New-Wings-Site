"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  cinemaControls,
  cinemaStopFor,
  CINEMA_LABELS,
  CINEMA_RANGES,
  CINEMA_STOPS,
  type CinemaNumber,
  type CinemaStop,
  type CinemaValues,
} from "./cinema-controls";
import { journeyControls } from "./journey-controls";
import { diagonalFeatherControls, DIAGONAL_FEATHER_DEFAULT } from "./diagonal-feather-controls";
import LensPanel from "./lens-panel";
import { lensControls } from "./lens-controls";
import GlassesPanel from "./glasses-panel";
import { glassesControls } from "./glasses-controls";

const labels: Record<CinemaNumber, string> = {
  starBloom: "Star halo",
  starRadius: "Star softness",
  heroBloom: "Pulse bloom (all)",
  heroRadius: "Pulse softness",
  logoGlow: "Logo border glow",
  logoPeak: "Logo peak flash",
  rayStrength: "Side ray brightness",
  particleReaction: "Particle reaction",
  nebulaStrength: "Nebula strength",
  pools: "Nebula variation",
  contrast: "Contrast",
  shadowToe: "Deep blacks",
  silver: "Cool platinum",
  shadowCool: "Cool shadows",
  vignette: "Vignette",
  grain: "Fine grain",
  focusDistance: "Focus distance",
  focusRange: "Focus range",
  bokeh: "Bokeh size",
};
const stopEvent = { view1: "slide", view2: "turned", final: "final" } as const;

export default function CinemaPanel() {
  const state = useSyncExternalStore(
    cinemaControls.subscribe,
    cinemaControls.read,
    cinemaControls.serverRead,
  );
  const lensState = useSyncExternalStore(lensControls.subscribe, lensControls.read, lensControls.serverRead);
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  const feather = useSyncExternalStore(
    diagonalFeatherControls.subscribe,
    diagonalFeatherControls.read,
    diagonalFeatherControls.serverRead,
  );
  const current = cinemaStopFor(journey.phase, journey.revealStage),
    active = journey.phase === "logoReveal" || journey.phase === "logoDone";
  const [open, setOpen] = useState(false),
    [follow, setFollow] = useState(true),
    [selected, setSelected] = useState<CinemaStop>("view1");
  const [message, setMessage] = useState(""),
    [exportText, setExportText] = useState("");
  const exportArea = useRef<HTMLTextAreaElement>(null),
    stop = follow ? current : selected,
    values = state.presets[stop];
  useEffect(() => {
    try {
      cinemaControls.load(localStorage);
    } catch {
      cinemaControls.load({
        getItem: () => null,
        setItem: () => {
          throw Error("Storage unavailable");
        },
      });
    }
  }, []);
  useEffect(() => {
    try {
      diagonalFeatherControls.load(localStorage);
    } catch {
      /* Default remains available. */
    }
  }, []);
  useEffect(() => {
    try {
      lensControls.load(localStorage);
    } catch {
      lensControls.load({ getItem: () => null, setItem: () => {} });
    }
  }, []);
  useEffect(() => {
    glassesControls.load(localStorage);
  }, []);
  useEffect(() => {
    if (!lensState.loaded) return;
    const timer = setTimeout(() => {
      try {
        lensControls.save(localStorage);
      } catch {
        /* Export remains available. */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [lensState]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        diagonalFeatherControls.save(localStorage);
      } catch {
        /* Storage is optional. */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [feather]);
  useEffect(() => {
    if (!state.loaded) return;
    const timer = setTimeout(() => {
      try {
        if (!cinemaControls.save(localStorage))
          setMessage("Browser storage unavailable. Copy or download your values.");
      } catch {
        setMessage("Copy or download to keep your values.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state.presets, state.loaded]);
  useEffect(() => {
    if (exportText) {
      exportArea.current?.focus();
      exportArea.current?.select();
    }
  }, [exportText]);
  const set = (key: keyof CinemaValues, value: number | boolean) => {
    cinemaControls.set(stop, key, value);
    setMessage("");
  };
  const exportValues = () =>
    JSON.stringify(
      {
        ...JSON.parse(cinemaControls.export()),
        sectionFeather: diagonalFeatherControls.read(),
        lensCameras: lensControls.export(),
        glasses: glassesControls.read(),
      },
      null,
      2,
    );
  const saveAll = () => {
    const viewsSaved = cinemaControls.save(localStorage),
      featherSaved = diagonalFeatherControls.save(localStorage),
      lensSaved = lensControls.save(localStorage);
    return viewsSaved && featherSaved && lensSaved;
  };
  const copy = async () => {
    const text = exportValues();
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(text);
      setMessage("Copied view presets and section feather.");
    } catch {
      setExportText(text);
      setMessage("Select the values below and copy with Ctrl+C.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportValues()], { type: "application/json" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "eye-cinema-presets.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Downloaded view presets and section feather.");
  };
  const toggle = (key: "post" | "grade" | "bloom" | "dof" | "autofocus", label: string) => (
    <label className="cinema-toggle" key={key}>
      <span>{label}</span>
      <input type="checkbox" checked={values[key]} onChange={(e) => set(key, e.target.checked)} />
    </label>
  );
  const number = (key: CinemaNumber, disabled = false) => {
    const [min, max, step] = CINEMA_RANGES[key],
      digits = step < 0.01 ? 3 : step < 0.1 ? 2 : 1;
    return (
      <div className="cinema-slider" key={key}>
        <label htmlFor={"cinema-" + key}>{labels[key]}</label>
        <input
          id={"cinema-" + key}
          aria-label={labels[key]}
          type="range"
          min={min}
          max={max}
          step={step}
          value={values[key]}
          disabled={disabled || state.baseline}
          onChange={(e) => set(key, Number(e.target.value))}
        />
        <input
          aria-label={labels[key] + " value"}
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number(values[key].toFixed(digits))}
          disabled={disabled || state.baseline}
          onChange={(e) => {
            if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber))
              set(key, e.target.valueAsNumber);
          }}
        />
      </div>
    );
  };
  const hero = stop === "final";
  return (
    <aside
      className="cinema-panel"
      style={{ zIndex: 42, visibility: journey.finalCovered ? "visible" : undefined, pointerEvents: "auto" }}
      data-cinema-controls
      data-open={open}
      aria-label="Temporary cinema tuning"
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button type="button" className="cinema-heading" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          ◈ Look tuning <small>temporary</small>
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="cinema-body">
          <p className="cinema-current">
            {active ? "On screen: " + CINEMA_LABELS[current] : "Eye look presets · choose a view below"}
          </p>
          <GlassesPanel />
          <label className="cinema-toggle">
            <span>Follow camera</span>
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => {
                setSelected(current);
                setFollow(e.target.checked);
              }}
            />
          </label>
          <label className="cinema-select">
            Editing{" "}
            <select
              aria-label="Editing preset"
              value={stop}
              onChange={(e) => {
                setFollow(false);
                setSelected(e.target.value as CinemaStop);
              }}
            >
              {CINEMA_STOPS.map((id) => (
                <option key={id} value={id}>
                  {CINEMA_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cinema-go"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("eye-camera-view", { detail: stopEvent[stop] }))
            }
          >
            Go to {stop === "final" ? "final eye" : stop === "view1" ? "View 1" : "View 2"}
          </button>
          <label className="cinema-toggle cinema-baseline">
            <span>Before / approved baseline</span>
            <input
              type="checkbox"
              checked={state.baseline}
              onChange={(e) => cinemaControls.baseline(e.target.checked)}
            />
          </label>
          <LensPanel covered={journey.finalCovered} />
          {state.baseline && (
            <p className="cinema-hint">Showing the approved look. Turn comparison off to continue tuning.</p>
          )}
          <fieldset disabled={state.baseline}>
            {toggle("post", "Post-processing")}
            <details open>
              <summary>Glow</summary>
              {toggle("bloom", "Bloom")}
              {hero ? (
                <>
                  {number("heroBloom")}
                  {number("heroRadius")}
                  {number("logoGlow")}
                  {number("logoPeak")}
                  {number("rayStrength")}
                  {number("particleReaction")}
                  <p className="cinema-hint">Peak flash changes only the logo launch. Replay to see it.</p>
                  <button
                    type="button"
                    className="cinema-go"
                    disabled={journey.phase !== "logoDone"}
                    onClick={() => window.dispatchEvent(new Event("eye-pupil-replay"))}
                  >
                    Replay light
                  </button>
                </>
              ) : (
                <>
                  {number("starBloom")}
                  {number("starRadius")}
                </>
              )}
            </details>
            <details>
              <summary>Colour & space</summary>
              {toggle("grade", "Colour grade")}
              {!hero && (
                <>
                  {number("nebulaStrength")}
                  {number("pools")}
                </>
              )}
              {number("contrast")}
              {number("shadowToe")}
              {number("silver")}
              {number("shadowCool")}
              {number("vignette")}
              {number("grain")}
            </details>
            <details>
              <summary>Focus · optional</summary>
              {toggle("dof", "Depth of field")}
              {toggle("autofocus", "Autofocus on silver")}
              {number("focusDistance", !values.dof || values.autofocus)}
              {number("focusRange", !values.dof)}
              {number("bokeh", !values.dof)}
              <p className="cinema-hint">
                Distance and range use scene units. Focus adds a depth pass only while enabled.
              </p>
            </details>
          </fieldset>
          <details>
            <summary>Next section · diagonal edge</summary>
            <div className="cinema-slider">
              <label htmlFor="section-feather">Edge feather (px)</label>
              <input
                id="section-feather"
                aria-label="Edge feather"
                type="range"
                min={0}
                max={240}
                step={1}
                value={feather}
                onChange={(e) => diagonalFeatherControls.set(Number(e.target.value))}
              />
              <input
                aria-label="Edge feather value"
                type="number"
                min={0}
                max={240}
                step={1}
                value={feather}
                onChange={(e) => {
                  if (e.target.value !== "") diagonalFeatherControls.set(e.target.valueAsNumber);
                }}
              />
            </div>
            <p className="cinema-hint">
              0 = hard edge. Higher values soften only the diagonal boundary. Auto-saved in this browser.
            </p>
            <button
              type="button"
              disabled={journey.phase !== "logoDone"}
              onClick={() => window.dispatchEvent(new CustomEvent("eye-diagonal-preview", { detail: 0.5 }))}
            >
              Preview edge
            </button>{" "}
            <button
              type="button"
              disabled={journey.phase !== "logoDone"}
              onClick={() => window.dispatchEvent(new CustomEvent("eye-diagonal-preview", { detail: 0 }))}
            >
              Back to eye
            </button>{" "}
            <button type="button" onClick={() => diagonalFeatherControls.set(DIAGONAL_FEATHER_DEFAULT)}>
              Reset feather
            </button>
            {journey.phase !== "logoDone" && (
              <p className="cinema-hint">Go to final eye to preview this transition.</p>
            )}
          </details>
          <div className="cinema-actions">
            <button
              type="button"
              onClick={() => {
                try {
                  setMessage(
                    saveAll() ? "Saved in this browser." : "Use Copy values or Download to keep this preset.",
                  );
                } catch {
                  setMessage("Use Copy values or Download to keep this preset.");
                }
              }}
            >
              Save
            </button>
            <button type="button" onClick={copy}>
              Copy values
            </button>
            <button type="button" onClick={download}>
              Download
            </button>
            <button
              type="button"
              onClick={() => {
                cinemaControls.reset(stop);
                setMessage("This view restored to the approved baseline.");
              }}
            >
              Reset this view
            </button>
          </div>
          <p className="cinema-hint">
            Auto-saved per browser. Send me Copy values or the JSON file when you like the result.
          </p>
          <p className="cinema-status" role="status">
            {message}
          </p>
          {exportText && (
            <>
              <textarea
                ref={exportArea}
                aria-label="Preset values to copy"
                value={exportText}
                readOnly
                rows={6}
              />
              <button type="button" onClick={() => setExportText("")}>
                Close values
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
