export type JourneyPhase = "intro" | "glassesExit" | "idle" | "pullback" | "hold" | "approach" | "reveal" | "awaitAssembly" | "returnHold" | "return" | "done" | "screens" | "corridor" | "panel" | "page" | "pageReturnLoading" | "logoReveal" | "logoDone";
type Snapshot = { phase: JourneyPhase; cinemaStage:'wearing'|'removing'|'clear';openingStage:string;openingMoving:boolean;openingPrepared:boolean;loaderDone:boolean;pageSection:number|null;pageJump:number;cameraMoving:boolean;panelStage: number; pageAtEnd: boolean; pageReturning:boolean; revealStage: import("./exit-stages").ExitStage; reviewCamera:boolean;finalCovered:boolean };
let snapshot: Snapshot = { phase: "intro", cinemaStage:'wearing',openingStage:'screen',openingMoving:false,openingPrepared:false,loaderDone:false,pageSection:null,pageJump:0,cameraMoving:false,panelStage: 0, pageAtEnd: false,pageReturning:false,revealStage:"slide",reviewCamera:false,finalCovered:false };
const listeners = new Set<() => void>();
export const journeyControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  update: (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next }; listeners.forEach(listener => listener());
  },
};
