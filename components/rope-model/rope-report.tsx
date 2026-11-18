"use client";
import { useEffect, useState } from "react";
import type { WebGLRenderer } from "three";
import { createFrameStatistics } from "../corridor/frame-statistics";
import { diagnosticsEnabled, loadingReport, traceMark, traceSpan } from "../corridor/loading-trace";

/** The site's loading report on the rope page, only with ?diagnostics=1. It adds the graphics chip's name and frame times along the tunnel. Nothing here runs on the normal link. */
const PARTS = 10; // the tunnel is measured in this many stretches
const ENOUGH_FRAMES = 30; // a stretch counts as measured after this many frames
const MOST_SAMPLES = 5000; // per stretch, so a long visit cannot grow without limit

type Times = { gaps: number[]; scene: number[]; post: number[] };
const newTimes = (): Times => ({ gaps: [], scene: [], post: [] });
const parts = Array.from({ length: PARTS }, newTimes),
  all = newTimes(),
  stats = createFrameStatistics();
const add = (list: number[], value: number) => {
  if (list.length < MOST_SAMPLES) list.push(value);
};
const rounded = (value: number) => Math.round(value * 10) / 10;
const mean = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const round = (value: number | null) => (value === null ? null : rounded(value));
function summary(times: Times) {
  const sorted = [...times.gaps].sort((a, b) => a - b),
    average = mean(times.gaps);
  return {
    frames: times.gaps.length,
    fps: average ? rounded(1000 / average) : null,
    frameMs: round(average),
    slowestFivePercentMs: sorted.length
      ? rounded(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)])
      : null,
    worstMs: sorted.length ? rounded(sorted[sorted.length - 1]) : null,
    chipThreadsMs: round(mean(times.scene)),
    chipGlowMs: round(mean(times.post)),
  };
}

const device = { chip: "", maker: "", version: "", chipTimer: false, edgeSamples: 0, mostEdgeSamples: 0 };
const scene = { triangles: 0, calls: 0 };
const drawing = { cssWidth: 0, cssHeight: 0, scale: 0, width: 0, height: 0 };
let live: ReturnType<typeof stats.sample> = null;

type Timer = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
// One query per step at a time: a step is skipped while its last answer has not come back, so this never waits on the graphics chip.
function makeStage(context: WebGL2RenderingContext, timer: Timer | null, into: keyof Times) {
  const query = timer ? context.createQuery() : null;
  let open = false,
    waiting = false,
    bucket = 0;
  return {
    begin(part: number) {
      if (timer && query && !waiting) {
        context.beginQuery(timer.TIME_ELAPSED_EXT, query);
        open = true;
        bucket = part;
      }
    },
    end() {
      if (timer && open) {
        context.endQuery(timer.TIME_ELAPSED_EXT);
        open = false;
        waiting = true;
      }
    },
    read() {
      if (!timer || !query || !waiting || !context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE))
        return;
      waiting = false;
      if (context.getParameter(timer.GPU_DISJOINT_EXT)) return;
      const ms = context.getQueryParameter(query, context.QUERY_RESULT) / 1e6;
      add(parts[bucket][into], ms);
      add(all[into], ms);
    },
    dispose() {
      if (query) context.deleteQuery(query);
    },
  };
}

export function createRopeMeter(gl: WebGLRenderer, edgeSamples: number) {
  if (!diagnosticsEnabled()) return null;
  const context = gl.getContext() as WebGL2RenderingContext;
  const names = context.getExtension("WEBGL_debug_renderer_info"),
    timer = context.getExtension("EXT_disjoint_timer_query_webgl2") as Timer | null;
  Object.assign(device, {
    chip: String(context.getParameter(names ? names.UNMASKED_RENDERER_WEBGL : context.RENDERER)),
    maker: String(context.getParameter(names ? names.UNMASKED_VENDOR_WEBGL : context.VENDOR)),
    version: String(context.getParameter(context.VERSION)),
    chipTimer: !!timer,
    edgeSamples,
    mostEdgeSamples: Number(context.getParameter(context.MAX_SAMPLES)),
  });
  const threads = makeStage(context, timer, "scene"),
    glow = makeStage(context, timer, "post");
  let part = 0,
    first: ReturnType<typeof traceSpan> | null = null,
    fresh = true,
    started = false;
  return {
    sceneStart(progress: number) {
      if (fresh) {
        fresh = false;
        first = traceSpan("First rope frame: upload and draw", "render submission");
      }
      part = Math.min(PARTS - 1, Math.floor(Math.max(0, progress) * PARTS));
      threads.begin(part);
    },
    sceneEnd() {
      threads.end();
      const { triangles, calls } = gl.info.render;
      scene.triangles = triangles;
      scene.calls = calls;
      glow.begin(part);
    },
    frameEnd() {
      glow.end();
      threads.read();
      glow.read();
      const now = performance.now();
      if (first) {
        first();
        first = null;
        traceMark("First rope frame drawn");
        requestAnimationFrame(() => traceMark("First rope frame shown"));
      }
      Object.assign(drawing, {
        cssWidth: gl.domElement.clientWidth,
        cssHeight: gl.domElement.clientHeight,
        scale: gl.getPixelRatio(),
        width: gl.domElement.width,
        height: gl.domElement.height,
      });
      if (document.hidden) {
        stats.resetClock();
        started = false;
        return;
      }
      const sampled = stats.sample(now);
      if (!started) {
        started = true;
        return;
      } // the gap into the first frame after a pause is not a frame time
      if (sampled) {
        live = sampled;
        add(parts[part].gaps, sampled.gap);
        add(all.gaps, sampled.gap);
      }
    },
    dispose() {
      threads.dispose();
      glow.dispose();
    },
  };
}
export type RopeMeter = NonNullable<ReturnType<typeof createRopeMeter>>;

function ropeReport() {
  const base = loadingReport();
  if (!base) return null;
  return {
    ...base,
    rope: {
      device,
      drawing,
      scene,
      frames: summary(all),
      byTunnel: parts.map((times, i) => ({
        fromPercent: (i * 100) / PARTS,
        toPercent: ((i + 1) * 100) / PARTS,
        ...summary(times),
      })),
      notes: [
        "Frame times assume the light is running: they mean little with ?still, ?flowAt or reduced motion, where frames are only drawn on demand.",
        "chipThreadsMs is the graphics chip's time drawing the rope scene with edge smoothing. chipGlowMs is its time for glow and the final picture. Null means the browser does not offer this timer.",
        "Frame times include everything the browser did, not only drawing.",
      ],
    },
  };
}

const seconds = (value: number | undefined) =>
  value === undefined ? "waiting…" : `${(value / 1000).toFixed(2)} s`;
export function RopeReportPanel() {
  const [report, setReport] = useState<ReturnType<typeof ropeReport>>(null);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!diagnosticsEnabled()) return;
    traceMark("Application mounted");
    const update = () => setReport(ropeReport());
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, []);
  if (!report) return null;
  const { marks, rope } = report,
    model = report.resources.find((entry) => entry.path.endsWith(".glb"));
  const measured = rope.byTunnel.filter((part) => part.frames >= ENOUGH_FRAMES).length;
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(ropeReport(), null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `rope-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setSaved(true);
  };
  const chipTime = rope.device.chipTimer
    ? `${rope.frames.chipThreadsMs ?? "—"} / ${rope.frames.chipGlowMs ?? "—"} ms`
    : "not offered";
  return (
    <aside className="loading-diagnostics" aria-label="Rope report" data-rope-report>
      <button className="diagnosis-heading" onClick={() => setOpen(!open)} aria-expanded={open}>
        Rope report <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
          <p>
            {marks["First rope frame shown"] === undefined
              ? `Measuring… ${seconds(report.elapsed)}`
              : measured < PARTS
                ? `Scroll slowly from start to end. Measured ${measured} of ${PARTS} parts.`
                : "Whole tunnel measured — save this report."}
          </p>
          <dl>
            <div>
              <dt>Graphics chip</dt>
              <dd>{rope.device.chip || "waiting…"}</dd>
            </div>
            <div>
              <dt>Drawing size</dt>
              <dd>
                {drawing.width} × {drawing.height} · scale {drawing.scale.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Frames per second</dt>
              <dd>{live ? live.fps.toFixed(0) : "—"}</dd>
            </div>
            <div>
              <dt>Frame / slowest 5%</dt>
              <dd>{live ? `${live.frameMs.toFixed(1)} / ${live.p95.toFixed(1)} ms` : "—"}</dd>
            </div>
            <div>
              <dt>Worst pause / freezes</dt>
              <dd>{live ? `${live.worstFrame.toFixed(0)} ms / ${live.freezes}` : "—"}</dd>
            </div>
            <div>
              <dt>Chip: threads / glow</dt>
              <dd>{chipTime}</dd>
            </div>
            <div>
              <dt>Triangles / draw calls</dt>
              <dd>
                {rope.scene.triangles.toLocaleString("en-US")} / {rope.scene.calls}
              </dd>
            </div>
            <div>
              <dt>Model downloaded</dt>
              <dd>{seconds(model?.end)}</dd>
            </div>
            <div>
              <dt>Model ready</dt>
              <dd>{seconds(marks["Rope model ready"])}</dd>
            </div>
            <div>
              <dt>First frame shown</dt>
              <dd>{seconds(marks["First rope frame shown"])}</dd>
            </div>
            <div>
              <dt>Errors</dt>
              <dd>{report.errors.length}</dd>
            </div>
          </dl>
          <button className="diagnosis-save" onClick={save}>
            Save report
          </button>
          {saved && <p role="status">Report download requested.</p>}
          <small>Times from opening the page. Reload and save again to compare a second load.</small>
        </>
      )}
    </aside>
  );
}
