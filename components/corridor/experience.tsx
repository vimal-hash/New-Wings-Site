"use client";

import dynamic from "next/dynamic";
import { preload } from "react-dom";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createMetrics, createMetricsStore } from "./metrics";
import type { StudyView } from "./scene";
import theatreAssets from "./theatre-assets.json";
import corridorAssets from "./corridor-assets.json";
import ProjectorButtons from "./projector-buttons";
import { journeyControls } from "./journey-controls";
import NormalPage from "./normal-page";
import sofaAssets from "./sofa-assets.json";
import { SOFAS_ENABLED } from "./scene-features";
import assetBudget from "./asset-budget.json";
import LoadingDiagnostics from "./loading-diagnostics";
import { traceMark } from "./loading-trace";
import { assetURL } from "./asset-url";
import CinemaPanel from './cinema-panel';
import DiagonalSection from './diagonal-section';

const Scene = dynamic(() => {
  traceMark("Scene import requested");
  return import("./scene").then(module => { traceMark("Scene import resolved"); return module; });
}, { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return (
      <div className="scene-message" role="alert">
        <h1>The 3D view couldn’t load.</h1>
        <p>Check that WebGL is enabled, then reload to try again.</p>
        <button onClick={() => window.location.reload()}>Reload view</button>
      </div>
    );
    return this.props.children;
  }
}

export default function CorridorExperience({ view = "corridor" }: { view?: StudyView }) {
  // Emit fetch hints in the initial HTML, before canvas/texture requests can
  // occupy the HTTP/1.1 connection slots. Match Three's fetch credentials so
  // its normal loaders consume the same responses, without another decoder.
  preload(assetURL("/draco/draco_wasm_wrapper.js"), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high" });
  preload(assetURL("/draco/draco_decoder.wasm"), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high" });
  const isCorridor = view === "corridor";
  const showSofas = SOFAS_ENABLED && view !== "floor";
  const modelCount = theatreAssets.models + (isCorridor ? 1 : 0) + (showSofas ? 1 : 0) + 1;
  const sofaTriangles = showSofas ? sofaAssets.sourceTriangles * sofaAssets.count : 0;
  const [metrics] = useState(createMetricsStore);
  const progressElement = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState(createMetrics);
  const [idle, setIdle] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [orbit, setOrbit] = useState(false);
  const [endOrbit, setEndOrbit] = useState(false);
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  // Temporary framing review: release the camera once the complete journey ends.
  const orbitActive = orbit || (isCorridor && journey.phase === "logoDone" && endOrbit);
  const fullPage = journey.phase === "page" || journey.phase === "pageReturnLoading";

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = metrics.read();
      setSnapshot({ ...current });
      setIdle(performance.now() - current.lastFrame > 400);
      if (progressElement.current) progressElement.current.style.transform = `scaleX(${current.progress})`;
    }, 500);
    return () => window.clearInterval(timer);
  }, [metrics]);

  useEffect(() => {
    if (!snapshot.firstFrame || snapshot.waitingForCorridor) return;
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector(".loading-card")) traceMark("Opening loading card removed");
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot.firstFrame, snapshot.waitingForCorridor]);

  const restart = () => window.location.reload();

  return (
    <main className="corridor-study" data-page={fullPage} data-journey-phase={journey.phase} data-cinema-stage={journey.cinemaStage} data-opening-stage={journey.openingStage} data-panel-stage={journey.panelStage} data-reveal-stage={journey.revealStage} data-finale-covered={journey.finalCovered}>
      {fullPage && <NormalPage />}
      <div id="corridor-viewport" className="scene-fixed" style={{ pointerEvents: orbitActive ? "auto" : "none" }}><SceneBoundary><Scene metrics={metrics} view={view} orbit={orbitActive} /></SceneBoundary></div>
      <header className="study-header">
        <div><span className="eyebrow">SPATIAL STUDY / 01</span><p>Theatre & corridor</p></div>
        <nav aria-label="Study tools">
          <button aria-pressed={orbitActive} onClick={() => journey.phase === "logoDone" ? setEndOrbit(!orbitActive) : setOrbit(!orbit)}>Orbit: {orbitActive ? "On" : "Off"}</button>
          <a href="/object-colour-key.html" target="_blank" rel="noreferrer">Colour key ↗</a><button onClick={restart}>Restart</button>
        </nav>
      </header>
      {isCorridor&&<nav aria-label="Temporary camera views" style={{position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",display:"flex",gap:8,zIndex:4}}>
        {(["slide","turned"] as const).map((target,index)=><button key={target} type="button" disabled={!snapshot.firstFrame}
          aria-pressed={journey.reviewCamera&&journey.revealStage===target}
          onClick={()=>{setOrbit(false);setEndOrbit(false);window.dispatchEvent(new CustomEvent("eye-camera-view",{detail:target}));}}
          style={{padding:"8px 14px",border:"1px solid #4d5963",borderRadius:6,background:"#111820",color:"#fff",fontSize:12,cursor:"pointer"}}>View {index+1}</button>)}
        {journey.phase==="logoDone"&&<button type="button" onClick={()=>window.dispatchEvent(new Event('eye-pupil-replay'))}
          style={{padding:"8px 14px",border:"1px solid #4d5963",borderRadius:6,background:"#111820",color:"#fff",fontSize:12,cursor:"pointer"}}>Replay light</button>}
      </nav>}
      {isCorridor&&!['panel','page','pageReturnLoading','pageReturning','logoReveal','logoDone'].includes(journey.phase)&&<nav aria-label="Temporary glasses controls" data-cinema-controls style={{position:'fixed',bottom:96,left:'50%',transform:'translateX(-50%)',display:'flex',gap:8,zIndex:5}}>
        {(['remove','wear'] as const).map(action=><button key={action} type="button" onClick={()=>window.dispatchEvent(new CustomEvent('cinema-glasses-action',{detail:action}))}
          style={{padding:'8px 14px',border:'1px solid #4d5963',borderRadius:6,background:'#111820',color:'#fff',fontSize:12,cursor:'pointer'}}>{action==='remove'?'Remove glasses':'Wear 3D glasses'}</button>)}
      </nav>}
      <ProjectorButtons />
      {isCorridor&&<CinemaPanel/>}
      {snapshot.waitingForProjector&&<div className="scene-wait" role="status">Preparing projector…</div>}
      <LoadingDiagnostics />
      {(!snapshot.firstFrame || snapshot.waitingForCorridor) && <div className="loading-card" role="status" aria-live="polite">
        <span className="loading-dot" /><span>{snapshot.waitingForCorridor ? "Loading corridor" : snapshot.loaded ? "Preparing the view" : "Loading theatre"}</span>
        <small>{Math.round((snapshot.waitingForCorridor ? (snapshot.desktopTextures?assetBudget.desktopCorridorBytes:assetBudget.corridorBytes) : (snapshot.desktopTextures?assetBudget.desktopOpeningBytes:assetBudget.openingBytes)) / 1000)} KB - {snapshot.waitingForCorridor ? "corridor" : "opening"} assets</small>
      </div>}
      <aside className={`performance-panel ${showStats ? "" : "collapsed"}`} aria-label="Performance indicators">
        <button className="panel-heading" onClick={() => setShowStats(!showStats)} aria-expanded={showStats}>
          <span><i className={snapshot.firstFrame ? "ready-dot" : "pending-dot"} /> Performance</span>
          <span>{showStats ? "−" : "+"}</span>
        </button>
        {showStats && <>
          <dl>
            <div><dt>Render</dt><dd>{!snapshot.firstFrame ? "Loading" : idle ? "Paused · idle" : "Moving"}</dd></div>
            <div><dt>Browser FPS</dt><dd>{snapshot.fps ? snapshot.fps.toFixed(0) : "—"}</dd></div>
            <div><dt>Frame / p95</dt><dd>{snapshot.frameMs ? `${snapshot.frameMs.toFixed(1)} / ${snapshot.p95.toFixed(1)} ms` : "—"}</dd></div>
            <div><dt>Worst pause / freezes</dt><dd>{snapshot.worstFrame.toFixed(0)} ms / {snapshot.freezes}</dd></div>
            <div><dt>First 3D frame¹</dt><dd>{snapshot.firstFrame ? `${(snapshot.firstFrame / 1000).toFixed(2)} s` : "—"}</dd></div>
            <div><dt>GLB decoded¹</dt><dd>{snapshot.modelReady ? `${(snapshot.modelReady / 1000).toFixed(2)} s` : "—"}</dd></div>
            <div><dt>Models loaded</dt><dd>{(snapshot.loaded?theatreAssets.models+(showSofas?1:0):0)+(snapshot.projectorReady?1:0)+(isCorridor&&snapshot.corridorReady?1:0)} / {modelCount}</dd></div>
            <div><dt>Draw calls / triangles²</dt><dd>{snapshot.calls} / {snapshot.triangles.toLocaleString("en-US")}</dd></div>
            <div><dt>GPU textures / geometries³</dt><dd>{snapshot.textures} / {snapshot.geometries}</dd></div>
            <div><dt>Resolution · DPR</dt><dd>{snapshot.width} × {snapshot.height} · {snapshot.dpr.toFixed(2)}</dd></div>
            <div><dt>Path</dt><dd>{Math.round(snapshot.progress * 100)}%</dd></div>
          </dl>
          <a href="?diagnostics=1">Open loading report</a>
          <p className="metric-note">¹ From navigation. ² Last rendered frame, after culling. ³ Resource counts, not VRAM. Browser FPS includes foreground pauses; freezes are pauses of 250 ms or more. WebGL pauses at rest.</p>
        </>}
      </aside>
      <footer className="study-footer">
        <span>{isCorridor ? journey.phase === "logoDone" ? "FULL LOGO" : journey.phase === "logoReveal" ? ({slide:"SCROLL UP THE SLIDE",top:"SCROLL TO TURN",turn:"TURNING TOWARD LOGO",turned:"SCROLL TO REVEAL THE LOGO",pullback:"REVEALING LOGO",done:"FULL LOGO"}[journey.revealStage]) : journey.phase === "glassesExit" ? "REMOVING GLASSES · LIGHTS RISING" : journey.phase === "idle" && journey.cinemaStage === "wearing" ? "SCROLL TO CONTINUE" : journey.phase === "awaitAssembly" ? "PARTS READY · SCROLL TO ASSEMBLE" : journey.phase === "panel" ? journey.pageAtEnd ? "SCROLL TO REVEAL THE LOGO" : "SCROLL TO EXPAND THE PAGE" : ["idle","done","screensDone"].includes(journey.phase) ? "SCROLL TO CONTINUE" : "CAMERA JOURNEY" : "GEOMETRY REVIEW"}</span>
        <span className="asset-caption">{(corridorAssets.triangles + theatreAssets.triangles + sofaTriangles).toLocaleString("en-US")} triangles · geometry study</span>
        <div className="journey-track" aria-hidden="true"><div ref={progressElement} /></div>
      </footer>
      {isCorridor&&<DiagonalSection/>}
    </main>
  );
}




