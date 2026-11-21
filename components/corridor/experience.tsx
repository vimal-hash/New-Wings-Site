"use client";

import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMetrics, createMetricsStore, type MetricsStore } from "./metrics";
import theatreAssets from "./theatre-assets.json";
import corridorAssets from "./corridor-assets.json";
import ProjectorButtons from "./projector-buttons";
import { journeyControls } from "./journey-controls";
import NormalPage, { PageReturnCover } from "./normal-page";
import sofaAssets from "./sofa-assets.json";
import { SOFAS_ENABLED } from "./scene-features";
import SiteLoader from "./site-loader";
import SiteChrome from "./site-chrome";
import SoundToggle from "./sound-toggle";
import EnquiryDialog from "./enquiry-dialog";
import LoadingDiagnostics from "./loading-diagnostics";
import { traceMark } from "./loading-trace";
import { assetURL } from "./asset-url";
import CinemaPanel from "./cinema-panel";
import DiagonalSection from "./diagonal-section";
import { prepareQuality, ropeFlightDevice } from "./effect-quality";
import { scheduleSceneIdle } from "./scene-idle";
import { isMobileDevice } from "./texture-quality";

const Scene = dynamic(
  () => {
    traceMark("Scene import requested");
    const scene = import("./scene").then((module) => {
      traceMark("Scene import resolved");
      return module;
    });
    // The scene's code and, on computers, the opening's files download while the graphics speed test runs; the scene
    // mounts once the code and the test are done, so each effect is chosen from this device's measured speed. Phones
    // skip the test and load as before.
    if (!isMobileDevice())
      void import("./opening-files")
        .then(({ startOpeningDownloads }) => startOpeningDownloads())
        .catch(() => {}); // The scene's own loaders still fetch everything.
    return Promise.all([scene, prepareQuality()]).then(([module]) => module);
  },
  { ssr: false },
);

const SOFA_TRIANGLES = SOFAS_ENABLED ? sofaAssets.sourceTriangles * sofaAssets.count : 0;
/** Theatre models, the corridor, the sofas and the projector. */
const MODEL_COUNT = theatreAssets.models + 1 + (SOFAS_ENABLED ? 1 : 0) + 1;

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    if (this.state.failed)
      return (
        <div className="scene-message" role="alert">
          <h1>The 3D view couldn’t load.</h1>
          <p>Check that WebGL is enabled, then reload to try again.</p>
          <button onClick={() => window.location.reload()}>Reload view</button>
        </div>
      );
    return this.props.children;
  }
}

/** Polls the metrics twice a second on its own, so only this panel re-renders. */
function PerformancePanel({ metrics }: { metrics: MetricsStore }) {
  const [snapshot, setSnapshot] = useState(createMetrics);
  const [idle, setIdle] = useState(true);
  const [showStats, setShowStats] = useState(true);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = metrics.read();
      setSnapshot({ ...current });
      setIdle(performance.now() - current.lastFrame > 400);
    }, 500);
    return () => window.clearInterval(timer);
  }, [metrics]);
  return (
    <aside
      className={`performance-panel ${showStats ? "" : "collapsed"}`}
      aria-label="Performance indicators"
    >
      <button className="panel-heading" onClick={() => setShowStats(!showStats)} aria-expanded={showStats}>
        <span>
          <i className={snapshot.firstFrame ? "ready-dot" : "pending-dot"} /> Performance
        </span>
        <span>{showStats ? "−" : "+"}</span>
      </button>
      {showStats && (
        <>
          <dl>
            <div>
              <dt>Render</dt>
              <dd>{!snapshot.firstFrame ? "Loading" : idle ? "Paused · idle" : "Moving"}</dd>
            </div>
            <div>
              <dt>Browser FPS</dt>
              <dd>{snapshot.fps ? snapshot.fps.toFixed(0) : "—"}</dd>
            </div>
            <div>
              <dt>Frame / p95</dt>
              <dd>
                {snapshot.frameMs ? `${snapshot.frameMs.toFixed(1)} / ${snapshot.p95.toFixed(1)} ms` : "—"}
              </dd>
            </div>
            <div>
              <dt>Worst pause / freezes</dt>
              <dd>
                {snapshot.worstFrame.toFixed(0)} ms / {snapshot.freezes}
              </dd>
            </div>
            <div>
              <dt>First 3D frame¹</dt>
              <dd>{snapshot.firstFrame ? `${(snapshot.firstFrame / 1000).toFixed(2)} s` : "—"}</dd>
            </div>
            <div>
              <dt>GLB decoded¹</dt>
              <dd>{snapshot.modelReady ? `${(snapshot.modelReady / 1000).toFixed(2)} s` : "—"}</dd>
            </div>
            <div>
              <dt>Models loaded</dt>
              <dd>
                {(snapshot.loaded ? theatreAssets.models + (SOFAS_ENABLED ? 1 : 0) : 0) +
                  (snapshot.projectorReady ? 1 : 0) +
                  (snapshot.corridorReady ? 1 : 0)}{" "}
                / {MODEL_COUNT}
              </dd>
            </div>
            <div>
              <dt>Draw calls / triangles²</dt>
              <dd>
                {snapshot.calls} / {snapshot.triangles.toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt>GPU textures / geometries³</dt>
              <dd>
                {snapshot.textures} / {snapshot.geometries}
              </dd>
            </div>
            <div>
              <dt>Resolution · DPR</dt>
              <dd>
                {snapshot.width} × {snapshot.height} · {snapshot.dpr.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{Math.round(snapshot.progress * 100)}%</dd>
            </div>
            <div>
              <dt>Picture · speed⁴</dt>
              <dd>{snapshot.picture || "—"}</dd>
            </div>
          </dl>
          <a href="?diagnostics=1">Open loading report</a>
          <p className="metric-note">
            ¹ From navigation. ² Last rendered frame, after culling. ³ Resource counts, not VRAM. ⁴ Chosen
            from a short drawing test while the page loads; speed is times slower than the reference PC,
            threads / pixels. Browser FPS includes foreground pauses; freezes are pauses of 250 ms or more.
            WebGL pauses at rest.
          </p>
        </>
      )}
    </aside>
  );
}

const REVIEW_BUTTON = {
  padding: "8px 14px",
  border: "1px solid #4d5963",
  borderRadius: 6,
  background: "#111820",
  color: "#fff",
  fontSize: 12,
  cursor: "pointer",
} as const;

export default function CorridorExperience() {
  // Emit fetch hints in the initial HTML, before canvas/texture requests can
  // occupy the HTTP/1.1 connection slots. Match Three's fetch credentials so
  // its normal loaders consume the same responses, without another decoder.
  preload(assetURL("/draco/draco_wasm_wrapper.js"), {
    as: "fetch",
    crossOrigin: "anonymous",
    fetchPriority: "high",
  });
  preload(assetURL("/draco/draco_decoder.wasm"), {
    as: "fetch",
    crossOrigin: "anonymous",
    fetchPriority: "high",
  });
  const [metrics] = useState(createMetricsStore);
  const [sceneFailed, setSceneFailed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const progressElement = useRef<HTMLDivElement>(null);
  // Only what the page itself shows; each changes a few times, so the page re-renders only then.
  const [firstFrame, setFirstFrame] = useState(false);
  const [waitingForCorridor, setWaitingForCorridor] = useState(false);
  const [waitingForProjector, setWaitingForProjector] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [endOrbit, setEndOrbit] = useState(false);
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  // Temporary framing review: release the camera once the complete journey ends.
  const orbitActive = orbit || (journey.phase === "logoDone" && endOrbit);
  const fullPage = journey.phase === "page" || journey.phase === "pageReturnLoading" || journey.pageReturning;
  const [prepareFlight, setPrepareFlight] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element || journey.loaderDone) return;
    // A lost opening canvas may never produce a first frame or throw a React error.
    const lost = () => setSceneFailed(true);
    element.addEventListener("webglcontextlost", lost, true);
    return () => element.removeEventListener("webglcontextlost", lost, true);
  }, [journey.loaderDone]);
  useEffect(() => {
    if (journey.phase !== "done" || ropeFlightDevice() !== "desktop") return;
    // Desktop flies the rope GLB. It used to load and parse only when the pages opened (a ~210 ms freeze on that
    // move); parse it at a resting stop into the same R3F loader cache rope-model.tsx reads (same loader + URL).
    return scheduleSceneIdle(() => {
      void Promise.all([
        import("@react-three/fiber"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
        import("../rope-model/rope-model"),
      ])
        .then(([{ useLoader }, { GLTFLoader }, { MeshoptDecoder }, { ROPE_MODEL }]) =>
          useLoader.preload(GLTFLoader, ROPE_MODEL, (loader) => {
            loader.setMeshoptDecoder(MeshoptDecoder);
          }),
        )
        .catch(() => {}); // The page still loads it itself if this fails.
    }, 20);
  }, [journey.phase]);
  useEffect(() => {
    if ((journey.phase !== "awaitAssembly" && journey.phase !== "done") || ropeFlightDevice() !== "laptop")
      return;
    void import("../rope-laptop/laptop-data")
      .then(({ preloadLaptopFlight }) => preloadLaptopFlight())
      .catch(() => {}); // The visible flight can retry a failed preload.
  }, [journey.phase]);
  useEffect(() => {
    if (prepareFlight || journey.phase !== "done") return;
    const device = ropeFlightDevice();
    // Mount the page and its film reel while the camera is resting so the
    // liquid handoff only has to reveal them.
    return scheduleSceneIdle(() => setPrepareFlight(true), device === "mobile" ? 12 : 20);
  }, [journey.phase, prepareFlight]);
  const hiddenFlight = prepareFlight && ["done", "screens", "drawings", "corridor", "panel"].includes(journey.phase);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = metrics.read();
      setFirstFrame(!!current.firstFrame);
      setWaitingForCorridor(current.waitingForCorridor);
      setWaitingForProjector(current.waitingForProjector);
      if (progressElement.current) progressElement.current.style.transform = `scaleX(${current.progress})`;
    }, 500);
    return () => window.clearInterval(timer);
  }, [metrics]);

  useEffect(() => {
    if (!firstFrame || waitingForCorridor) return;
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector(".loading-card")) traceMark("Opening loading card removed");
    });
    return () => cancelAnimationFrame(frame);
  }, [firstFrame, waitingForCorridor]);

  const restart = () => window.location.reload();

  return (
    <main
      className="corridor-study"
      data-page={fullPage}
      data-journey-phase={journey.phase}
      data-cinema-stage={journey.cinemaStage}
      data-opening-stage={journey.openingStage}
      data-panel-stage={journey.panelStage}
      data-reveal-stage={journey.revealStage}
      data-finale-covered={journey.finalCovered}
    >
      {/* Section 4's white on screen until the camera starts back; then the white panel fixed in the corridor takes over (end-box.ts). */}
      {journey.pageReturning && <PageReturnCover />}
      {!journey.pageReturning && (fullPage || hiddenFlight) && (
        <NormalPage key={journey.pageJump} returnToCorridor active={fullPage} />
      )}
      <div
        id="corridor-viewport"
        ref={viewport}
        className="scene-fixed"
        style={{ pointerEvents: orbitActive ? "auto" : "none" }}
      >
        <SceneBoundary onFailure={() => setSceneFailed(true)}>
          <Scene metrics={metrics} orbit={orbitActive} />
        </SceneBoundary>
      </div>
      <header className="study-header">
        <div>
          <span className="eyebrow">SPATIAL STUDY / 01</span>
          <p>Theatre & corridor</p>
        </div>
        <nav aria-label="Study tools">
          <button
            aria-pressed={orbitActive}
            onClick={() => (journey.phase === "logoDone" ? setEndOrbit(!orbitActive) : setOrbit(!orbit))}
          >
            Orbit: {orbitActive ? "On" : "Off"}
          </button>
          <a href="/object-colour-key.html" target="_blank" rel="noreferrer">
            Colour key ↗
          </a>
          <button onClick={restart}>Restart</button>
        </nav>
      </header>
      {!fullPage && (
        <nav
          aria-label="Temporary camera views"
          style={{
            position: "fixed",
            bottom: 118,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
            zIndex: 4,
          }}
        >
          {(["slide", "turned"] as const).map((target, index) => (
            <button
              key={target}
              type="button"
              disabled={!firstFrame}
              aria-pressed={
                journey.reviewCamera && journey.revealStage === (target === "slide" ? "top" : target)
              }
              onClick={() => {
                setOrbit(false);
                setEndOrbit(false);
                window.dispatchEvent(new CustomEvent("eye-camera-view", { detail: target }));
              }}
              style={REVIEW_BUTTON}
            >
              View {index + 1}
            </button>
          ))}
          {journey.phase === "logoDone" && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("eye-pupil-replay"))}
              style={REVIEW_BUTTON}
            >
              Replay light
            </button>
          )}
        </nav>
      )}
      <ProjectorButtons />
      <CinemaPanel />
      {waitingForProjector && (
        <div className="scene-wait" role="status">
          Preparing projector…
        </div>
      )}
      <LoadingDiagnostics />
      <SiteChrome />
      <EnquiryDialog />
      <SiteLoader sceneFailed={sceneFailed} />
      <SoundToggle />
      {waitingForCorridor && (
        <div className="loading-card" role="status" aria-live="polite">
          <span className="loading-dot" />
          <span>Loading corridor</span>
        </div>
      )}
      <PerformancePanel metrics={metrics} />
      <footer className="study-footer">
        <span>
          {journey.phase === "logoDone"
            ? "FULL LOGO"
            : journey.phase === "logoReveal"
              ? {
                  slide: journey.pageReturning ? "BACK UP THE SLIDE" : "SCROLL UP THE SLIDE",
                  top: journey.cameraMoving ? "TURNING TOWARD LOGO" : "SCROLL TO TURN",
                  turn: "TURNING TOWARD LOGO",
                  turned: "SCROLL TO REVEAL THE LOGO",
                  pullback: "REVEALING LOGO",
                  done: "FULL LOGO",
                }[journey.revealStage]
              : journey.phase === "glassesExit"
                ? "REMOVING GLASSES · SCREEN OFF"
                : waitingForProjector
                  ? "PREPARING PROJECTOR"
                  : journey.phase === "idle" && journey.cinemaStage === "wearing"
                    ? "SCROLL TO CONTINUE"
                    : journey.phase === "awaitAssembly"
                      ? "PARTS READY · SCROLL TO ASSEMBLE"
                      : journey.phase === "idle" || journey.phase === "done"
                        ? "SCROLL TO CONTINUE"
                        : "CAMERA JOURNEY"}
        </span>
        <span className="asset-caption">
          {(corridorAssets.triangles + theatreAssets.triangles + SOFA_TRIANGLES).toLocaleString("en-US")}{" "}
          triangles · geometry study
        </span>
        <div className="journey-track" aria-hidden="true">
          <div ref={progressElement} />
        </div>
      </footer>
      {journey.loaderDone && <DiagonalSection />}
    </main>
  );
}
