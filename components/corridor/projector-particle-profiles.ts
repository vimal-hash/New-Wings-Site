/** Thinned, compressed source samples. Retained positions, normals, IDs and timings are unchanged.
 *  v2 drops only the grains of the parts removed in projector-removed-parts.json; every kept grain is unchanged. */
export const particleProfiles = {
  desktop: { count: 29231, ambient: 3400, path: "/models/projector/particles-lean-desktop-v2.bin.gz" },
  // Phones request no flight data; this is the laptop field fitted to the current parts.
  laptop: { count: 12290, ambient: 1300, path: "/models/projector/particles-lean-laptop-v2.bin.gz" },
} as const;
