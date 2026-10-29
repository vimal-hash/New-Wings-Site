"use client";

import { useSyncExternalStore } from "react";
import { isMobileDevice } from "./texture-quality";
import { projectorControls } from "./projector-controls";

const noEvents=()=>()=>{};
export default function ProjectorButtons() {
  const mobile=useSyncExternalStore(noEvents,isMobileDevice,()=>false);
  const state = useSyncExternalStore(projectorControls.subscribe, projectorControls.read, projectorControls.read);
  const busy = state.phase === "particles" || state.phase === "assembling";
  return <div className="projector-buttons" role="group" aria-label="Projector animations" aria-busy={busy}>
    <button disabled={!state.ready || busy} onClick={() => projectorControls.play("particles")}>{mobile?"Reveal":"Particles"}</button>
    <button disabled={!state.ready || busy || state.phase==="hidden"} onClick={() => projectorControls.play("assembling")}>Assemble</button>
  </div>;
}
