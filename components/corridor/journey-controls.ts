export type JourneyPhase = "intro" | "idle" | "pullback" | "hold" | "approach" | "reveal" | "awaitAssembly" | "returnHold" | "return" | "done" | "screens" | "screensDone" | "corridor" | "panel" | "page" | "pageReturnLoading" | "pageReturning" | "logoReveal" | "logoDone";
type Snapshot = { phase: JourneyPhase; openingMoving:boolean;openingPrepared:boolean;panelStage: number; panelReady: boolean; pageAtEnd: boolean; revealStage: import("./exit-stages").ExitStage; reviewCamera:boolean };
let snapshot: Snapshot = { phase: "intro", openingMoving:false,openingPrepared:false,panelStage: 0, panelReady: false, pageAtEnd: false, revealStage:"slide",reviewCamera:false };
const listeners = new Set<() => void>();
export const journeyControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  update: (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next }; listeners.forEach(listener => listener());
  },
};
