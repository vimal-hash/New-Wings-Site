/** Existing compressed source samples, retaining original positions, normals, IDs and part timings. */
export const particleProfiles={
  desktop:{count:65536,ambient:5000,path:"/models/projector/particles-aligned-desktop-v2.bin.gz"},
  // Phones request no flight data; this is the laptop field fitted to the current parts.
  laptop:{count:32768,ambient:2500,path:"/models/projector/particles-aligned-laptop-v2.bin.gz"},
} as const;
