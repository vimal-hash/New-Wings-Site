// v2 is a newly authored continuous frame. Old half-spacing/opacity drafts are
// intentionally retained under their old storage key, rather than deform this model.
export const GLASSES_DEFAULTS = {
  distance: 8,
  width: 100,
  gap: 8,
  blur: 5,
  innerBlur: 8,
  tint: 0.22,
  bridge: 1,
  size: 100,
  height: 0,
  lockWidth: true,
};
type GlassesValues = typeof GLASSES_DEFAULTS;
export const GLASSES_RANGES = {
  distance: [8, 80, 1],
  width: [40, 140, 1],
  gap: [2, 100, 1],
  blur: [0, 40, 1],
  innerBlur: [0, 40, 1],
  tint: [0, 0.8, 0.01],
  bridge: [0.05, 1, 0.01],
  size: [80, 180, 1],
  height: [-30, 30, 1],
} as const;
const blurProfile = "split-5-8";
let values = { ...GLASSES_DEFAULTS };
const listeners = new Set<() => void>();
const key = "cinema-glasses-slim-v2";
export const glassesControls = {
  read: () => values,
  serverRead: () => GLASSES_DEFAULTS,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set(field: keyof GlassesValues, value: number | boolean) {
    if (field === "lockWidth") {
      if (typeof value !== "boolean") return;
      values = { ...values, lockWidth: value };
    } else {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      const [min, max] = GLASSES_RANGES[field];
      values = { ...values, [field]: Math.max(min, Math.min(max, value)) };
    }
    listeners.forEach((fn) => fn());
  },
  reset() {
    values = { ...GLASSES_DEFAULTS };
    listeners.forEach((fn) => fn());
  },
  load(storage: Pick<Storage, "getItem">) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        for (const field of Object.keys(GLASSES_DEFAULTS) as (keyof GlassesValues)[]) {
          // Adopt the approved 5/8 profile once without discarding lens tint or fit drafts.
          if ((field === "blur" || field === "innerBlur") && saved.blurProfile !== blurProfile)
            this.set(field, GLASSES_DEFAULTS[field]);
          else if (field in saved) this.set(field, saved[field]);
        }
      }
    } catch {
      /* Defaults remain usable. */
    }
  },
  save(storage: Pick<Storage, "setItem">) {
    try {
      storage.setItem(key, JSON.stringify({ ...values, blurProfile }));
      return true;
    } catch {
      return false;
    }
  },
};
