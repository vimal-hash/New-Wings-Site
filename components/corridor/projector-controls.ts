export type ProjectorPhase = "hidden" | "assembled" | "particles" | "exploded" | "assembling";
type Snapshot = { ready: boolean; phase: ProjectorPhase; command: number };
let snapshot: Snapshot = { ready: false, phase: "hidden", command: 0 };
const listeners = new Set<() => void>();
function publish(next: Snapshot) { snapshot = next; listeners.forEach(listener => listener()); }
export const projectorControls = {
  read: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  ready: (ready: boolean) => publish({ ...snapshot, ready }),
  play: (phase: "particles" | "assembling") => {
    if (snapshot.ready && (phase!=="assembling"||snapshot.phase==="exploded"||snapshot.phase==="assembled")) publish({ ready: true, phase, command: snapshot.command + 1 });
  },
  finish: (command: number, phase: "exploded" | "assembled") => {
    if (command === snapshot.command) publish({ ...snapshot, phase });
  },
};
