import {CustomBlending,OneFactor,OneMinusSrcAlphaFactor,Vector2,Vector3,ZeroFactor,type Material,type ShaderMaterial} from 'three';

/** Uniforms shared by every corridor film material: the two screen windows, the eye that looks
 *  through them, which windows this render uses, and whether the output is display-encoded. */
export type FilmUniforms={
  uEye:{value:Vector3};uWinC:{value:Vector3[]};uWinN:{value:Vector3[]};uWinR:{value:Vector3[]};
  uWinHalf:{value:Vector2[]};uWinOpen:{value:number[]};uWinUse:{value:Vector2};uFront:{value:number};uDisplay:{value:number};uTime:{value:number};
};

export function createFilmUniforms():FilmUniforms{
  return {uEye:{value:new Vector3()},uWinC:{value:[new Vector3(),new Vector3()]},uWinN:{value:[new Vector3(),new Vector3()]},uWinR:{value:[new Vector3(),new Vector3()]},
    uWinHalf:{value:[new Vector2(),new Vector2()]},uWinOpen:{value:[0,0]},uWinUse:{value:new Vector2(1,1)},uFront:{value:1},uDisplay:{value:0},uTime:{value:0}};
}

/** The world behind the wall is seen only through an open window; anything in front of both screens
 *  (out in the corridor) is seen whenever `uFront` allows. Output: a filmic curve, then display encoding. */
export const FILM_GLSL=/* glsl */`
varying vec3 vFilmWorld;
uniform vec3 uEye;uniform vec3 uWinC[2];uniform vec3 uWinN[2];uniform vec3 uWinR[2];uniform vec2 uWinHalf[2];uniform float uWinOpen[2];
uniform vec2 uWinUse;uniform float uFront,uDisplay,uTime;
bool filmVisible(vec3 p){
  // Judge each point by the open window its eye ray passes through: before that window it is out in
  // the corridor, beyond it it is seen through the screen. (The wall curves, so one window's plane
  // says nothing about points seen through the other.)
  vec3 d=p-uEye;
  for(int k=0;k<2;k++){
    float use=k==0?uWinUse.x:uWinUse.y;
    if(use<.5)continue;
    float den=dot(d,uWinN[k]);
    if(den>-1e-5)continue;
    float t=dot(uWinC[k]-uEye,uWinN[k])/den;
    vec3 x=uEye+d*t-uWinC[k];
    if(abs(dot(x,uWinR[k]))<uWinHalf[k].x&&abs(x.y)<uWinHalf[k].y*uWinOpen[k])return t>1.||uFront>.5;
  }
  // Seen past both screens: only what is clearly out in the corridor.
  return dot(p-uWinC[0],uWinN[0])>=0.&&dot(p-uWinC[1],uWinN[1])>=0.&&uFront>.5;
}
vec3 filmTone(vec3 c){
  c=max(c,0.);c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14);c=clamp(c,0.,1.);
  return uDisplay>.5?mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c)):c;
}`;

/** Patch a built-in lit material (incl. instanced meshes) with the window clip and the film output. */
export function filmMaterial<T extends Material>(material:T,uniforms:FilmUniforms,key:string):T{
  material.toneMapped=false;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFilmWorld;')
      .replace('#include <project_vertex>',`#include <project_vertex>
        vec4 filmWorld=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          filmWorld=instanceMatrix*filmWorld;
        #endif
        vFilmWorld=(modelMatrix*filmWorld).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${FILM_GLSL}`)
      .replace('void main() {','void main() {\n  if(!filmVisible(vFilmWorld))discard;')
      .replace('#include <dithering_fragment>','#include <dithering_fragment>\n  gl_FragColor.rgb=filmTone(gl_FragColor.rgb);');
  };
  material.customProgramCacheKey=()=>`corridor-film-${key}`;
  return material;
}

/** Light that adds colour but never coverage: on the composite it brightens what lies behind it. */
export function additive(material:ShaderMaterial){
  Object.assign(material,{transparent:true,depthWrite:false,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor});
  return material;
}
/** Premultiplied colour with coverage: stays visible against the white corridor. */
export function premultiplied(material:ShaderMaterial){
  Object.assign(material,{transparent:true,depthWrite:false,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneMinusSrcAlphaFactor});
  return material;
}

export const smoothstep=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
