// The order in which the projector's parts form. In the particle node group's order a part fills in at random (its
// landing mask mixes a noise field, 55%, with the distance from the core, 45%) and each surface point shows the moment
// its grain lands. Here every part's surface shows REVEAL_DELAY after its grain landed, so the grains always come
// first, and the large parts (0.3 m and up) sweep across instead: right to left on screen from the front-left view the
// scroll arrives at, over each part's fx_dur, the forming edge kept ragged by the same noise. Small parts keep the
// random fill. The grains (Particles.tsx) and the surface reveal (projectorReveal.ts) use the same mask, so the
// surface appears where its grains landed.

/** part: fx_part index (particles.json); axis: unit direction in PRJ_ROOT space (Blender axes), the particles' data
 *  space; the part fills from `from` to `to` along it. ragged: share of the noise in the mask (0 = a straight edge).
 *  revealDelay: frames (24 fps) between a grain landing and the surface showing there. */
import aligned from "../projector-formation-aligned.json";
type Sweep = {
  part: number;
  axis: [number, number, number];
  from: number;
  to: number;
  ragged: number;
  revealDelay: number;
};

const REVEAL_DELAY = 1; // one frame (0.04 s): the surface shows as its grains finish landing
const RAGGED = 0.25;
/** The camera's right on screen from the front-left view, in PRJ_ROOT space: sweeps run from + to - along it. */
const SCREEN_RIGHT: [number, number, number] = [-0.707107, 0.707107, 0];

/** A sweep right to left on screen across `from`..`to` (the part's grains' span along SCREEN_RIGHT). */
const across = (part: number, from: number, to: number): Sweep => ({
  part,
  axis: SCREEN_RIGHT,
  from,
  to,
  ragged: RAGGED,
  revealDelay: REVEAL_DELAY,
});
/** The centre chassis box: its parts swept as one, across the whole box (-0.63..0.63). */
const box = (part: number) => across(part, 0.63, -0.63);

const SOURCE_SWEEPS: Record<string, Sweep> = {
  // the operator's-left side panel, across its length: right end (+y) to left end (-y)
  SH_Non_operator_side_panel: {
    part: 473,
    axis: [0, 1, 0],
    from: 0.44,
    to: -0.49,
    ragged: RAGGED,
    revealDelay: REVEAL_DELAY,
  },
  CH_Structural_frame_posts_rails_bulkhead: box(6),
  CH_Base_tray_plus_floor_channels: box(0),
  CH_Upper_frame_band: box(7),
  CH_Lower_skirt_band: box(5),
  CH_Integrated_carrying_handle_slots: box(1),
  // the other parts 0.3 m and up, each across its own span
  COOL_Cooler_left_EPP_insulation_frame: across(9, -0.233, -0.529),
  COOL_Cooler_left_heat_exchanger: across(13, -0.036, -0.271),
  COOL_Cooler_right_EPP_insulation_frame: across(14, -0.86, -1.156),
  COOL_Cooler_right_heat_exchanger: across(18, -0.664, -0.899),
  COOL_LP_heat_exchanger_core_tubes_end_tanks: across(27, 1.25, 1.006),
  FILT_Cooler_filter_left_washable: across(49, -0.52, -0.718),
  FILT_Cooler_filter_right_washable: across(50, -0.775, -0.973),
  FILT_Front_filter_washable: across(51, 1.025, 0.798),
  FILT_Light_processor_filter_pleated: across(52, -0.226, -0.333),
  LPIPE_Sealed_channel_housing_plus_optic_saddles: across(144, 0.607, 0.317),
  LPIPE_Sealed_lid_plus_gasket: across(145, 0.606, 0.336),
  LS_Optical_bench_casting_plate_ports_rails_isolators: across(282, -0.209, -0.525),
  PWR_LDM_1_high_power_3000_W_2x_PFC_perforated_cassette_plus_fan_plus_handle: across(446, 0.941, 0.546),
  PWR_LDM_2_low_power_1500_W_1x_PFC_perforated_cassette_plus_fan_plus_handle: across(451, 0.942, 0.546),
  PWR_Switch_mode_power_supply_SMPS: across(454, 1.133, 0.737),
  SH_I_O_bay_surround: across(471, 0.965, 0.753),
  SH_Lens_bay_fascia: across(472, 0.919, 0.615),
  SH_Rear_panel_cooler_intake: across(478, -0.665, -1.195),
  SH_Rear_side_strip_vent: across(479, 0.38, 0.289),
  SH_Service_door_LDM_SMPS: across(480, 0.786, 0.645),
  SH_Top_cover: across(487, 0.611, -0.611),
  SH_Wrap_around_perforated_grille: across(488, 1.375, 1.112),
};

// Keep the approved sweep order, but measure its span on the currently shipped parts.
const SWEEPS: Record<string, Sweep> = Object.fromEntries(
  Object.entries(SOURCE_SWEEPS).map(([name, s]) => {
    const span = (aligned.spans as Record<string, number[]>)[name];
    if (!span || aligned.names[s.part] !== name)
      throw new Error("Projector formation owner/span mismatch: " + name);
    return [name, { ...s, from: span[0], to: span[1] }];
  }),
);
const f = (x: number) => x.toFixed(6);
const sweepMask = (s: Sweep, noise: string, p: string) =>
  `clamp(mix(clamp((dot(${p}, vec3(${s.axis.map(f).join(", ")})) - ${f(s.from)}) / ${f(
    s.to - s.from,
  )}, 0.0, 1.0), ${noise}, ${f(s.ragged)}), 0.0, 1.0)`;

/** GLSL for the particles: the landing mask by part (other parts: the node group's own mix, unchanged). */
export const formationGLSL = /* glsl */ `
float fxFormation(float noise, float g, float w, vec3 p, int part) {
  switch (part) {
${Object.values(SWEEPS)
  .map((s) => `    case ${s.part}: return ${sweepMask(s, "noise", "p")};`)
  .join("\n")}
  }
  return mix(noise, g, w);
}`;

/** Uniform values for a part's surface reveal: vec4(from, to, ragged, on), its axis and reveal delay (frames). */
export function sweepUniforms(partName: string) {
  const s = SWEEPS[partName];
  return {
    sweep: s ? [s.from, s.to, s.ragged, 1] : [0, 1, 0, 0],
    axis: s ? s.axis : [1, 0, 0],
    revealDelay: REVEAL_DELAY,
  } as const;
}
