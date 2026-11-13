import type { WebGLRenderer } from "three";
import { isMobileDevice } from "./texture-quality";

export type EffectQuality="desktop"|"laptop"|"mobile";
const selections=new WeakMap<WebGLRenderer,EffectQuality>();
/** Conservative automatic selection: unknown and integrated GPUs get the compatible path. */
export function effectQuality(gl:WebGLRenderer):EffectQuality {
  const existing=selections.get(gl);if(existing)return existing;
  // Explicit local diagnostics only: exercise compatible programs on the development workstation.
  if(typeof location!=="undefined"&&/^(localhost|127\.)/.test(location.hostname)){
    const params=new URLSearchParams(location.search),test=params.get("fx-test");
    if(params.has("diagnostics")&&(test==="laptop"||test==="mobile"||test==="desktop")){selections.set(gl,test);return test;}
  }
  const choice=chooseQuality(gl.getContext());
  selections.set(gl,choice);return choice;
}
function chooseQuality(context:WebGLRenderingContext|WebGL2RenderingContext):EffectQuality {
  const extension=context.getExtension("WEBGL_debug_renderer_info");
  const renderer=extension?String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)):"";
  const desktopGPU=/(?:GeForce RTX (?:30[6-9]0|40[6-9]0|50[6-9]0)|Radeon RX [67][6789]\d\d)/i.test(renderer)&&!/(?:laptop|mobile|notebook|\d{4}M\b)/i.test(renderer);
  return isMobileDevice()?"mobile":desktopGPU?"desktop":"laptop";
}
let ropeDevice:EffectQuality|undefined;
/** The same choice for the rope flight, which has its own canvas. Phones, and anything without WebGL 2, have no flight yet. */
export function ropeFlightDevice():EffectQuality {
  if(ropeDevice)return ropeDevice;
  if(typeof location!=="undefined"&&/^(localhost|127\.)/.test(location.hostname)){
    const params=new URLSearchParams(location.search),test=params.get("fx-test");
    if(params.has("diagnostics")&&(test==="laptop"||test==="mobile"||test==="desktop"))return ropeDevice=test;
  }
  if(isMobileDevice())return ropeDevice="mobile";
  const context=document.createElement("canvas").getContext("webgl2");
  if(!context)return ropeDevice="mobile";
  ropeDevice=chooseQuality(context);
  context.getExtension("WEBGL_lose_context")?.loseContext();
  return ropeDevice;
}
