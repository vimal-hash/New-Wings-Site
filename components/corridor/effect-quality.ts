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
  const context=gl.getContext(),extension=context.getExtension("WEBGL_debug_renderer_info");
  const renderer=extension?String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)):"";
  const desktopGPU=/(?:GeForce RTX (?:30[6-9]0|40[6-9]0|50[6-9]0)|Radeon RX [67][6789]\d\d)/i.test(renderer)&&!/(?:laptop|mobile|notebook|\d{4}M\b)/i.test(renderer);
  const choice=isMobileDevice()?"mobile":desktopGPU?"desktop":"laptop";
  selections.set(gl,choice);return choice;
}
