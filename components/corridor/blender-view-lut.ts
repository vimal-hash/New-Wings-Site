import { useMemo } from "react";
import { ClampToEdgeWrapping, Data3DTexture, HalfFloatType, LinearFilter, RGBAFormat } from "three";
import { useCompressedBuffer } from "./compressed-buffer";

export const blenderDisplayGLSL = `
uniform highp sampler3D blenderView;
vec3 blenderDisplay(vec3 radiance) {
  vec3 shaped=clamp((log2(max(radiance,vec3(exp2(-16.0))))+16.0)/22.0,0.0,1.0);
  return texture(blenderView,shaped*(63.0/64.0)+vec3(0.5/64.0)).rgb;
}
vec3 blenderDisplayLinear(vec3 radiance) {
  vec3 encoded=blenderDisplay(radiance);
  return mix(encoded/12.92,pow((encoded+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),encoded));
}`;

// Shared immutable display lookup, identical to the reference project's AgX look.
const displays=new WeakMap<ArrayBuffer,Data3DTexture>();
function getDisplay(buffer:ArrayBuffer){
  let texture=displays.get(buffer);
  if(!texture){texture=new Data3DTexture(new Uint16Array(buffer),64,64,64);texture.format=RGBAFormat;texture.type=HalfFloatType;texture.minFilter=texture.magFilter=LinearFilter;texture.wrapS=texture.wrapT=texture.wrapR=ClampToEdgeWrapping;texture.unpackAlignment=1;texture.needsUpdate=true;displays.set(buffer,texture);}
  return texture;
}
export function useBlenderViewLUT() {
  const buffer = useCompressedBuffer("/textures/shared/blender-view.bin.gz");
  return useMemo(()=>getDisplay(buffer),[buffer]);
}
