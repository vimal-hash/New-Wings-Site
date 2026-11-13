import source from "./yellow-look.json";
import {assetURL} from "../corridor/asset-url";
import type {RopeLook} from "./rope-materials";
import {GREEN,greenFromRed} from "./rope-flight";

export const YELLOW_PALETTE=assetURL("/rope-model/yellow/palette-desktop.png");
export const YELLOW_PALETTE_LAPTOP=assetURL("/rope-model/yellow/palette-laptop.png");
export const YELLOW_SIDE=source.side as [number,number,number],YELLOW_FACE=source.face as [number,number,number];
export const YELLOW_CORE=source.core;
export const YELLOW_BACKDROP=[.0035,.0035*.78,.00034*.3];
export const GREEN_BACKDROP=greenFromRed([.0035,.00005,.00034]);
export const YELLOW_TOE=source.toe;
// Matched source Y=12 / roll=-.62: small radiance calibration for the shared
// desktop field. The laptop's existing density compensation is kept separate.
export const YELLOW_DESKTOP_GAIN=1.05;
export const yellowRopeLook=(red:RopeLook):RopeLook=>({...red,exposure:source.exposure,core_color:source.core as [number,number,number],grade:source.grade as [number,number][][]});
export const nearGreenLook=(red:RopeLook):RopeLook=>({...red,core_color:[...GREEN.core],grade:source.green.grade as [number,number][][]});
const vec=(c:readonly number[])=>`vec3(${c.map(v=>v.toFixed(6)).join(",")})`;
export const yellowSideGlsl=`mix(${vec(YELLOW_SIDE)},${vec(GREEN.tintSide)},vRed)`;
export const yellowFaceGlsl=`mix(${vec(YELLOW_FACE)},${vec(GREEN.tintFace)},vRed)`;
export const yellowCoreGlsl=`mix(${vec(YELLOW_CORE)},${vec(GREEN.core)},vRed)`;
export const yellowWhiteGlsl="mix(vec3(1.,.78,.1),vec3(.3,1.,.1),vRed)";
export const yellowLightGlsl=/* glsl */`
  vec3 flightLight(vec3 c,float nearColour){return mix(vec3(c.r,.78*c.r,.3*c.b),vec3(2.*c.g,c.r,2.5*c.b),nearColour);}`;
export const yellowPaletteGlsl=/* glsl */`
  uniform sampler2D uYellowPalette;
  uniform float uYellowPaletteWidth;
  vec3 yellowRamp(vec3 red){float u=(clamp(red.r,0.,1.)*(uYellowPaletteWidth-1.)+.5)/uYellowPaletteWidth;return linear(texture2D(uYellowPalette,vec2(u,.5)).rgb);}`;
const redTransparent=[.43415364623069763,.024853283539414406,.0531473271548748];
const power=source.transparent.slice(1).map((v,i)=>Math.log(v/source.transparent[0])/Math.log(redTransparent[i+1]/redTransparent[0]));
export const yellowThroughGlsl=/* glsl */`
  vec3 yellowThrough(vec3 red){return red.r*vec3(1.,pow(clamp(red.g/max(red.r,1e-5),1e-5,1.),${power[0].toFixed(6)}),pow(clamp(red.b/max(red.r,1e-5),1e-5,1.),${power[1].toFixed(6)}));}`;

/** These joined colours keep their own source display curves. Ambers use the camera's side of the join as a hint. */
export const yellowGreenGradeGlsl=/* glsl */`
  float nearColour=smoothstep(mix(.52,.44,uCameraRed),mix(.68,.58,uCameraRed),c.g/max(c.r+c.g,1e-5));
  vec3 farGrade=vec3(texture2D(uFarGrade,vec2(g.r,.5)).r,texture2D(uFarGrade,vec2(g.g,.5)).g,texture2D(uFarGrade,vec2(g.b,.5)).b);
  vec3 nearGrade=vec3(texture2D(uGrade,vec2(g.r,.5)).r,texture2D(uGrade,vec2(g.g,.5)).g,texture2D(uGrade,vec2(g.b,.5)).b);
  vec3 o=mix(farGrade,nearGrade,nearColour);`;
export const yellowToeGlsl=/* glsl */`
  displayColour*=mix(pow(clamp((displayColour.r+displayColour.g+displayColour.b)/(3.*${YELLOW_TOE[0].toFixed(6)}),0.,1.),${YELLOW_TOE[1].toFixed(6)}),1.,max(nearColour,white));`;
