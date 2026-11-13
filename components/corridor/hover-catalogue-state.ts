/** Hover catalogue: which objects can be inspected, when, and what their plate says (pure; no Three.js). */

export type HoverMode = "theatre" | "exploded" | "assembled";
export type CatalogueEntry = { no: number; category: string; name: string };

/** Inspect the stationary scene in either glasses state; the frame is a visual overlay, not a picking blocker. */
export function hoverMode(phase: string, projectorPhase: string, _glasses = 0): HoverMode | null {
  void _glasses;
  if (phase === "idle") return "theatre";
  if (phase === "awaitAssembly" && projectorPhase === "exploded") return "exploded";
  if (phase === "done" && projectorPhase === "assembled") return "assembled";
  return null;
}

/** ID buffer ranges (16-bit, red + green bytes). 0 means background or a non-selectable occluder. */
export const HOVER_ID = { theatre: 1, seats: 100, projector: 1000, limit: 2048 } as const;

/** Theatre catalogue, keyed by baked item name or shared ceiling/wall material name. */
export const THEATRE_CATALOGUE: { key: string; match: string[]; entry: Omit<CatalogueEntry, "no"> }[] = [
  { key: "seats", match: ["Clean source upholstery | 12 sofas"], entry: { category: "Seating", name: "Theatre Chairs" } },
  { key: "screen", match: ["screen", "Theatre screen | Full aspect artwork"], entry: { category: "Screen", name: "Theatre screen" } },
  { key: "floor", match: ["floor-slab", "terraces", "stage"], entry: { category: "Floor", name: "Step lights and Floor design" } },
  { key: "interior", match: ["right-wall", "front-wall", "wall-trim", "acoustic-slats", "Left wall | Baked Blender appearance"], entry: { category: "Interior", name: "Theatre interior design" } },
  { key: "speakers", match: ["speakers"], entry: { category: "Sound", name: "Sound System" } },
  { key: "ceiling", match: ["Ceiling | Approved baked appearance"], entry: { category: "Interior", name: "Theatre interior design" } },
  { key: "lights", match: ["light-fixtures"], entry: { category: "Interior", name: "Theatre interior design" } },
  { key: "steps", match: ["aisle-lights", "step-nosings"], entry: { category: "Floor", name: "Step lights and Floor design" } },
  { key: "moon", match: ["moon-steel-border", "Moon "], entry: { category: "Interior", name: "Interior design" } },
];

/** True when an object's name (or its material's) belongs to a catalogue item. "Moon " is a prefix. */
export function theatreKey(objectName: string, materialName: string) {
  for (const item of THEATRE_CATALOGUE)
    if (item.match.some(m => m.endsWith(" ") ? objectName.startsWith(m) : objectName === m || materialName === m)) return item.key;
  return null;
}

/** Source part name of each render part (projector-formation-aligned.json). */
export const projectorPartNames = (aligned: { names: string[]; owners: number[] }) => aligned.owners.map(owner => aligned.names[owner]);

/** Cables/hoses are excluded by the shared runtime policy in every projector phase. */
const WIRE = /^(HARN|HOSE)_|^LP_DMD_flex_ribbon_/;
export const wireParts = (parts: string[]) => parts.flatMap((name, i) => WIRE.test(name) ? [i] : []);

/** Contiguous index ranges, for a compact shader test. */
export function ranges(indices: number[]) {
  const out: [number, number][] = [];
  for (const i of indices) { const last = out[out.length - 1]; if (last && last[1] === i - 1) last[1] = i; else out.push([i, i]); }
  return out;
}

const BOARD_NAMES: [RegExp, string][] = [
  [/^CTRL_Cinema_controller_board/, "Cinema controller board (CCB)"],
  [/^CTRL_Laser_Controller_Board/, "Laser controller board (LCB)"],
  [/^CTRL_Fan_Motor_Controller_Board/, "Fan and motor controller board"],
  [/^CTRL_Air_filter_sensor_board/, "Air filter sensor board"],
  [/^LP_(RED|GREEN_reference|BLUE)_DMD_board/, "DMD driver board"],
  [/^LP_Satellite_formatter_board_(RED|GREEN|BLUE)/, "Satellite formatter board"],
  [/^LP_Formatter_interconnection_board/, "Formatter interconnect board"],
  [/^LS_Light_Source_Board/, "Light source driver board"],
  [/^PWR_LDM_1_high_power/, "PFC power board, 3000 W"],
  [/^PWR_LDM_2_low_power/, "PFC power board, 1500 W"],
  [/^PWR_Netinput_board/, "Mains input board"],
  [/^LPIPE_Light_sensor_pick_off/, "Photodiode sensor board"],
];
const channel = (name: string) => /RED/.test(name) ? ", red" : /GREEN/.test(name) ? ", green" : /BLUE/.test(name) ? ", blue" : "";

/** Every other part lights up with the rest of its subsystem. */
const SUBSYSTEMS: [RegExp, string, string][] = [
  [/^LS_/, "RGB laser light source", "Light source"],
  [/^LP_/, "Three-chip light processor", "Optics"],
  [/^LPIPE_/, "Light pipe and fold mirrors", "Optics"],
  [/^LH_/, "Lens holder and shift motors", "Optics"],
  [/^(COOL|FILT)_/, "Liquid cooling system", "Cooling"],
  [/^PWR_/, "Power supply", "Electronics"],
  [/^CTRL_/, "Control electronics", "Electronics"],
  [/^CH_/, "Chassis and base tray", "Structure"],
  [/^SH_/, "Outer shell and panels", "Housing"],
];

/** Exploded view groups: lenses, boards, the DMD chips, then whole subsystems. Hovering any part lights its whole group. */
export function projectorGroups(parts: string[]) {
  const groups = new Map<string, { parts: number[]; entry: Omit<CatalogueEntry, "no"> }>();
  const add = (key: string, part: number, entry: Omit<CatalogueEntry, "no">) => { const group = groups.get(key) ?? { parts: [], entry }; group.parts.push(part); groups.set(key, group); };
  parts.forEach((name, i) => {
    if (/^LENS_/.test(name)) add("lens", i, { category: "Optics", name: "Projection lens, motorised zoom" });
    else if (/^LPIPE_(Relay_lens|Lens_doublet)/.test(name)) add("relay", i, { category: "Optics", name: "Relay lens pipe" });
    else if (/^LS_(Telescope_.*_lens|Condenser_lens)/.test(name)) add("telescope", i, { category: "Optics", name: "Laser telescope and condenser lenses" });
    else if (/_DMD_0_98in_DC4K_CLGA_package$/.test(name)) add("processor", i, { category: "Processor", name: "Three-chip DMD, 0.98″ DC4K" });
    else {
      const board = BOARD_NAMES.find(([pattern]) => pattern.test(name));
      if (board) { const label = board[1] + (/formatter_board|DMD_board/.test(name) ? channel(name) : /PFC_board_(\d)/.test(name) ? ` (${name.match(/PFC_board_(\d)/)![1]})` : ""); add(name, i, { category: "Electronics", name: label }); }
      else if (!WIRE.test(name)) { const system = SUBSYSTEMS.find(([pattern]) => pattern.test(name)); if (system) add(system[1], i, { category: system[2], name: system[1] }); }
    }
  });
  return groups;
}

export const ASSEMBLED_ENTRY: Omit<CatalogueEntry, "no"> = { category: "Projector", name: "RGB laser cinema projector, 4K" };

/** Every product a visitor can enquire about, in catalogue order (the enquiry form's list). */
export const ENQUIRY_PRODUCTS: string[] = [...new Set([
  ...THEATRE_CATALOGUE.map(item => item.entry.name),
  ASSEMBLED_ENTRY.name,
  "Projection lens, motorised zoom", "Relay lens pipe", "Laser telescope and condenser lenses", "Three-chip DMD, 0.98″ DC4K",
  ...SUBSYSTEMS.map(([, name]) => name),
  ...BOARD_NAMES.map(([, name]) => name),
])];

export const formatNumber = (no: number) => "No. " + String(no).padStart(2, "0");
