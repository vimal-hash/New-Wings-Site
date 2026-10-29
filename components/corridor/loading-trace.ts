/** Opt-in, local-only startup diagnostics. No fetch interception or extra GPU work. */
type Detail = Record<string, string | number | boolean | null>;
type Span = { id: number; name: string; kind: string; start: number; end?: number; detail: Detail };
type Trace = {
  marks: Record<string, number>; spans: Span[]; errors: { at: number; message: string }[];
  longTasks: { start: number; duration: number }[]; visibility: { at: number; state: string }[];
  supported: string[];
  framePauses:{at:number;duration:number;phase:string}[];
};
let trace: Trace | undefined;
const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("diagnostics") === "1";
const now = () => performance.now();
const round = (n: number) => Math.round(n * 10) / 10;
export const diagnosticsEnabled = () => enabled;

function getTrace() {
  if (!enabled) return;
  if (trace) return trace;
  trace = { marks: {}, spans: [], errors: [], longTasks: [], visibility: [], supported: [],framePauses:[] };
  trace.marks["Diagnostics module evaluated"] = now();
  performance.setResourceTimingBufferSize(2000);
  if (typeof PerformanceObserver !== "undefined") {
    trace.supported = [...(PerformanceObserver.supportedEntryTypes ?? [])];
    if (trace.supported.includes("longtask")) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (trace!.longTasks.length < 1000)
          trace!.longTasks.push({ start: round(entry.startTime), duration: round(entry.duration) });
      });
      observer.observe({ type: "longtask", buffered: true });
    }
  }
  const error = (message: string) => { if (trace!.errors.length < 50) trace!.errors.push({ at: round(now()), message: message.slice(0, 500) }); };
  window.addEventListener("error", e => error(e.message || "Resource load error"));
  window.addEventListener("unhandledrejection", e => error(String(e.reason)));
  const visibility = () => trace!.visibility.push({ at: round(now()), state: document.visibilityState });
  visibility(); document.addEventListener("visibilitychange", visibility);
  return trace;
}

export function traceMark(name: string) {
  const value = getTrace();
  if (value && value.marks[name] === undefined) value.marks[name] = now();
}
export function traceHasMark(name: string) { return trace?.marks[name] !== undefined; }
export function traceFramePause(at:number,duration:number,phase:string){
  const value=getTrace();if(value&&duration>50&&value.framePauses.length<1000)value.framePauses.push({at:round(at),duration:round(duration),phase});
}
export function traceSpan(name: string, kind = "cpu", detail: Detail = {}): (extra?: Detail) => void {
  const value = getTrace();
  if (!value || value.spans.length >= 2000) return () => {};
  const span: Span = { id: value.spans.length, name, kind, start: now(), detail };
  value.spans.push(span);
  return (extra: Detail = {}) => { if (span.end === undefined) { span.end = now(); Object.assign(span.detail, extra); } };
}
export function traceSync<T>(name: string, fn: () => T): T {
  const end = traceSpan(name);
  try { return fn(); } finally { end(); }
}

// Structural interface avoids importing another Three.js loader or changing its cache identity.
type LoaderMethods = { load: (...args: unknown[]) => unknown; parse?: (...args: unknown[]) => unknown };
const loaders = new WeakSet<object>();
export function traceLoader(loader: object, kind: "GLB" | "KTX2") {
  if (!enabled || loaders.has(loader)) return;
  loaders.add(loader);
  const target = loader as LoaderMethods;
  const originalLoad = target.load;
  target.load = function (...args: unknown[]) {
    const end = traceSpan(String(args[0]), `${kind} load + processing`);
    const loaded = args[1], failed = args[3];
    args[1] = function (this: unknown, ...values: unknown[]) {
      end(textureDetail(values[0]));
      if (typeof loaded === "function") return Reflect.apply(loaded, this, values);
    };
    args[3] = function (this: unknown, ...values: unknown[]) {
      end({ error: String(values[0]) });
      if (typeof failed === "function") return Reflect.apply(failed, this, values);
    };
    try { return Reflect.apply(originalLoad, this, args); } catch (e) { end({ error: String(e) }); throw e; }
  };
  if (target.parse) {
    const originalParse = target.parse;
    target.parse = function (...args: unknown[]) {
      const end = traceSpan(kind === "KTX2" ? "KTX2 parse/transcode including worker queue/init" : "GLB parse/decode including dependencies", `${kind} processing`, { inputBytes: args[0] instanceof ArrayBuffer ? args[0].byteLength : 0 });
      const successIndex = kind === "KTX2" ? 1 : 2, errorIndex = successIndex + 1;
      const loaded = args[successIndex], failed = args[errorIndex];
      args[successIndex] = function (this: unknown, ...values: unknown[]) {
        end(textureDetail(values[0]));
        if (typeof loaded === "function") return Reflect.apply(loaded, this, values);
      };
      args[errorIndex] = function (this: unknown, ...values: unknown[]) {
        end({ error: String(values[0]) });
        if (typeof failed === "function") return Reflect.apply(failed, this, values);
      };
      try { return Reflect.apply(originalParse, this, args); } catch (e) { end({ error: String(e) }); throw e; }
    };
  }
}
function textureDetail(value: unknown): Detail {
  const t = value as { isTexture?: boolean; format?: number; image?: { width?: number; height?: number } } | undefined;
  return t?.isTexture ? { format: t.format ?? 0, width: t.image?.width ?? 0, height: t.image?.height ?? 0 } : {};
}
export const traceGLTF = (loader: object) => traceLoader(loader, "GLB");

type Renderer = { render: (...args: unknown[]) => unknown; compileAsync: (...args: unknown[]) => Promise<unknown>;getRenderTarget?:()=>unknown;info?:{programs?:unknown[]} };
export function traceRenderer(renderer: object) {
  if (!enabled) return;
  const gl = renderer as Renderer, render = gl.render, compile = gl.compileAsync;
  let earlyFrames = 0, openingFrames = 0;
  gl.render = function (...args) {
    const ready = traceHasMark("Opening scene committed");
    if (ready ? openingFrames++ >= 3 : earlyFrames++ >= 3) {
      const start=now(),programs=gl.info?.programs?.length??0,target=!!gl.getRenderTarget?.();
      try{return Reflect.apply(render,this,args);}finally{
        const end=now(),value=getTrace();
        if(end-start>25&&value&&value.spans.length<2000){
          const camera=args[1] as {position?:{x:number;y:number;z:number}};
          value.spans.push({id:value.spans.length,name:"Slow render submission",kind:"render submission",start,end,detail:{offscreen:target,programsBefore:programs,programsAfter:gl.info?.programs?.length??0,x:camera.position?.x??0,y:camera.position?.y??0,z:camera.position?.z??0}});
        }
      }
    }
    const end = traceSpan(ready ? "Opening render submission" : "Render before opening committed", "render submission");
    try { return Reflect.apply(render, this, args); } finally {
      end();
      if (ready && openingFrames === 1) {
        traceMark("Opening render submitted");
        requestAnimationFrame(() => traceMark("Opening paint opportunity"));
      }
    }
  };
  gl.compileAsync = function (...args) {
    const end = traceSpan("Shader compileAsync", "shader preparation");
    try {
      const promise = Reflect.apply(compile, this, args) as Promise<unknown>;
      promise.then(() => end(), e => end({ error: String(e) }));
      return promise;
    } catch (e) { end({ error: String(e) }); throw e; }
  };
}

function resourceCategory(path: string) {
  if (path.includes("/basis/") || path.includes("/draco/")) return "decoder";
  if (/\.glb$/.test(path)) return "model";
  if (/\.ktx2$/.test(path)) return "texture";
  if (path.includes("/textures/")) return "UV/texture sidecar";
  if (/motion|\.bin(?:\.gz)?$/.test(path)) return "motion/data";
  if (/\.woff2?$/.test(path)) return "font";
  if (/\.js$/.test(path)) return "JavaScript";
  return "other";
}
export function loadingReport() {
  const value = getTrace();
  if (!value) return null;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).slice(0, 2000).map(e => {
    const url = new URL(e.name, location.href);
    return { path: url.origin === location.origin ? url.pathname : `[external]${url.pathname}`, category: resourceCategory(url.pathname), start: round(e.startTime), requestStart: round(e.requestStart), responseStart: round(e.responseStart), end: round(e.responseEnd), duration: round(e.duration), transferBytes: e.transferSize, encodedBytes: e.encodedBodySize, decodedBytes: e.decodedBodySize, protocol: e.nextHopProtocol, deliveryType: (e as PerformanceResourceTiming & { deliveryType?: string }).deliveryType ?? "", status: (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus ?? null };
  });
  const navigatorInfo = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } };
  const openingEnd = value.marks["Opening paint opportunity"];
  const openingResources = resources.filter(e => e.category !== "other" && (openingEnd === undefined || e.end <= openingEnd));
  return {
    version: 2, capturedAt: new Date().toISOString(), elapsed: round(now()), route: location.pathname,
    environment: { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemoryGB: navigatorInfo.deviceMemory ?? null, viewport: [innerWidth, innerHeight], devicePixelRatio, connection: navigatorInfo.connection ? { effectiveType: navigatorInfo.connection.effectiveType, downlinkMbpsEstimate: navigatorInfo.connection.downlink, rttMsEstimate: navigatorInfo.connection.rtt, saveData: navigatorInfo.connection.saveData } : null },
    navigation: nav ? { type: nav.type, responseStart: round(nav.responseStart), responseEnd: round(nav.responseEnd), domContentLoaded: round(nav.domContentLoadedEventEnd), loadEventEnd: round(nav.loadEventEnd), transferBytes: nav.transferSize, encodedBytes: nav.encodedBodySize } : null,
    marks: Object.fromEntries(Object.entries(value.marks).map(([k, v]) => [k, round(v)])),
    summary: { latestOpeningResourceEnd: openingResources.length ? Math.max(...openingResources.map(e => e.end)) : null, openingObservedTransferBytes: openingResources.reduce((sum, e) => sum + e.transferBytes, 0), openingObservedBodyBytes: openingResources.reduce((sum, e) => sum + e.encodedBytes, 0), resourcesObserved: resources.length },
    spans: value.spans.map(s => ({ ...s, start: round(s.start), end: s.end === undefined ? null : round(s.end), duration: s.end === undefined ? null : round(s.end - s.start) })),
    resources, longTasks: value.longTasks, framePauses:value.framePauses,visibility: value.visibility, errors: value.errors, supportedEntryTypes: value.supported,
    notes: ["Milliseconds from navigation; parallel spans overlap and must not be added together.", "Resource durations include queue/connection/server/transfer. Zero transfer bytes may mean cache or unavailable timing, not zero asset size.", "GLB parse/decode includes internal dependencies; KTX processing includes worker queue/init. These are not pure decoder CPU measurements.", "Render spans measure CPU/driver submission, not isolated GPU execution. Next animation frame is a paint opportunity, not proof of screen presentation.", "Long-task support varies. Hidden/background time is recorded. Diagnostics do not clear caches, change quality or add waits. Normal application shader/GPU preparation is recorded in spans."]
  };
}
getTrace();
