export type Metrics = {
  loaded: boolean; corridorReady: boolean; waitingForCorridor: boolean; firstFrame: number | null; modelReady: number | null;
  lastFrame: number; fps: number; frameMs: number; p95: number; worstFrame:number;stalls:number;freezes:number;
  calls: number; triangles: number; textures: number; geometries: number;
  width: number; height: number; dpr: number; progress: number;
  desktopTextures:boolean;
  projectorReady:boolean;waitingForProjector:boolean;
};
export function createMetrics(): Metrics {
  return {
    loaded: false, corridorReady: false, waitingForCorridor: false, firstFrame: null, modelReady: null, lastFrame: 0,
    fps: 0, frameMs: 0, p95: 0, worstFrame:0,stalls:0,freezes:0,calls: 0, triangles: 0,
    textures: 0, geometries: 0, width: 0, height: 0, dpr: 1, progress: 0, desktopTextures:false,projectorReady:false,waitingForProjector:false,
  };
}

// An imperative bridge keeps frame sampling outside React's render cycle.
export function createMetricsStore() {
  const value = createMetrics();
  return {
    read: () => value,
    update: (patch: Partial<Metrics>) => { Object.assign(value, patch); },
  };
}
export type MetricsStore = ReturnType<typeof createMetricsStore>;
