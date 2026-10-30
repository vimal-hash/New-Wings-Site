export type JourneyPhase = "intro" | "glassesExit" | "idle" | "pullback" | "hold" | "approach" | "reveal" | "awaitAssembly" | "returnHold" | "return" | "done" | "screens" | "screensDone" | "corridor" | "panel" | "page" | "pageReturnLoading" | "pageReturning" | "logoReveal" | "logoDone";
type Snapshot = { phase: JourneyPhase; cinemaStage:'wearing'|'removing'|'clear';openingStage:string;openingMoving:boolean;openingPrepared:boolean;panelStage: number; panelReady: boolean; pageAtEnd: boolean; revealStage: import("./exit-stages").ExitStage; reviewCamera:boolean;finalCovered:boolean };
let snapshot: Snapshot = { phase: "intro", cinemaStage:'wearing',openingStage:'screen',openingMoving:false,openingPrepared:false,panelStage: 0, panelReady: false, pageAtEnd: false, revealStage:"slide",reviewCamera:false,finalCovered:false };
const listeners = new Set<() => void>();
export const journeyControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  update: (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next }; listeners.forEach(listener => listener());
  },
};
