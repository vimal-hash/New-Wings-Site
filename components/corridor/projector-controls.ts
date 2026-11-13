/** "disassembling" and "dissolving" play the build backwards when the visitor scrolls back. */
export type ProjectorPhase = "hidden" | "assembled" | "particles" | "exploded" | "assembling" | "disassembling" | "dissolving";
type Snapshot = { ready: boolean; failed: boolean; phase: ProjectorPhase; command: number };
let snapshot: Snapshot = { ready: false, failed:false, phase: "hidden", command: 0 };
const listeners = new Set<() => void>();
function publish(next: Snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
const ALLOWED: Record<"particles"|"assembling"|"disassembling"|"dissolving", ProjectorPhase[]|null> = {
  particles: null,
  assembling: ["exploded","assembled"],
  disassembling: ["assembled","assembling"],
  dissolving: ["exploded","disassembling","particles"],
};
export const projectorControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  ready: (ready: boolean) => {if(!snapshot.failed)publish({ ...snapshot, ready });},
  fail: () => publish({...snapshot,ready:false,failed:true}),
  play: (phase: "particles" | "assembling" | "disassembling" | "dissolving") => {
    const from = ALLOWED[phase];
    if (snapshot.ready && (!from || from.includes(snapshot.phase))) publish({ ...snapshot, phase, command: snapshot.command + 1 });
  },
  /** Jumps straight to a finished state (menu navigation): no animation plays. */
  set: (phase: "hidden" | "exploded" | "assembled") => {
    if (snapshot.ready) publish({ ...snapshot, phase, command: snapshot.command + 1 });
  },
  finish: (command: number, phase: "exploded" | "assembled" | "hidden") => {
    if (command === snapshot.command) publish({ ...snapshot, phase });
  },
};
