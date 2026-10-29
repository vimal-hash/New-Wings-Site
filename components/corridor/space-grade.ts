import {DataTexture,FramebufferTexture,Matrix4,NoBlending,NoColorSpace,RGBAFormat,ShaderMaterial,UnsignedByteType,Vector2,WebGLRenderTarget} from "three";
import type {Camera,Texture,WebGLRenderer} from "three";
import {FullScreenQuad} from "three/addons/postprocessing/Pass.js";
import type {EffectQuality} from "./effect-quality";
import type {CinemaValues} from './cinema-controls';

/** Artistic controls in display space, after the existing LUT and star bloom. */
export const SPACE_GRADE={pools:.20,vignette:.105,contrast:.12,shadowToe:.028,silver:.55,shadowCool:.12} as const;
export const SPACE_GRADE_TIERS={
  desktop:{octaves:3,grainSamples:2,grain:.65/255},
  laptop:{octaves:2,grainSamples:1,grain:.55/255},
  mobile:{octaves:1,grainSamples:1,grain:.45/255},
} as const;

const vertexShader=/* glsl */`
varying vec2 vUv;
varying vec3 vWorldRay;
uniform mat4 uCameraWorld,uProjectionInverse;
void main(){
  vUv=uv;
  vec4 ray=uProjectionInverse*vec4(position.xy,1.,1.);
  vWorldRay=(uCameraWorld*vec4(ray.xyz,0.)).xyz;
  gl_Position=vec4(position.xy,0.,1.);
}`;
const fragmentShader=/* glsl */`
uniform sampler2D uFrame,uOcclusion;
uniform float uStrength,uHasMask,uNebula,uPools,uVignette,uContrast,uToe,uSilver,uShadowCool,uGrain,uNebulaGain;
varying vec2 vUv;
varying vec3 vWorldRay;

float hash31(vec3 p){
  p=fract(p*.1031);p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float poolNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i),hash31(i+vec3(1.,0.,0.)),f.x),
                 mix(hash31(i+vec3(0.,1.,0.)),hash31(i+vec3(1.,1.,0.)),f.x),f.y),
             mix(mix(hash31(i+vec3(0.,0.,1.)),hash31(i+vec3(1.,0.,1.)),f.x),
                 mix(hash31(i+vec3(0.,1.,1.)),hash31(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
}
void main(){
  // The framebuffer copy contains the already-composited, display-LUT image.
  // No sRGB decode/encode, exposure, tone mapping, or second display transform.
  vec3 original=texture2D(uFrame,vUv).rgb;
  if(uStrength==0.){gl_FragColor=vec4(original,1.);return;}
  vec3 colour=original;
  float y=dot(colour,vec3(.2126,.7152,.0722));
  float hi=max(colour.r,max(colour.g,colour.b)),lo=min(colour.r,min(colour.g,colour.b));
  float saturation=(hi-lo)/max(hi,.0001);
  float foreground=uHasMask>.5?texture2D(uOcclusion,vUv).a:1.;
  // Pools modify only existing background light. Multiplication preserves its
  // hue, and cannot create coloured fog over a black foreground or black void.
  float background=(uHasMask>.5?1.-foreground:smoothstep(.08,.25,saturation))*uNebula;
  float nebula=background*(1.-smoothstep(.16,.32,y));
  colour*=1.+nebula*(uNebulaGain-1.);
  if(nebula>.001){
    vec3 direction=normalize(vWorldRay);
    float pool=poolNoise(direction*3.4+vec3(4.1,1.7,8.3));
    #if POOL_OCTAVES > 1
      pool=pool*.72+poolNoise(direction*7.1+vec3(9.3,2.4,5.7))*.28;
    #endif
    #if POOL_OCTAVES > 2
      pool=pool*.88+poolNoise(direction*14.3+vec3(2.6,8.1,3.4))*.12;
    #endif
    colour*=1.+uPools*nebula*(pool-.5)*2.;
  }
  // Gentle monotonic S-curve and a zero-preserving shadow toe. No black lift.
  y=dot(colour,vec3(.2126,.7152,.0722));
  float curved=y+uContrast*y*(1.-y)*(2.*y-1.);
  curved=pow(max(curved,0.),1.+uToe);
  colour*=curved/max(y,.00001);

  // Neutral metal gets a very small platinum bias; coloured nebula and warm
  // stars are excluded. This changes the grain's tone, never its silhouette.
  float neutral=1.-smoothstep(.12,.34,saturation);
  float silver=smoothstep(.015,.45,foreground)*neutral*smoothstep(.24,.62,y)*uSilver;
  colour=mix(colour,vec3(curved*.995,curved,curved*1.012),silver);
  float shadow=neutral*(1.-smoothstep(.035,.15,y))*uShadowCool;
  colour=mix(colour,colour*vec3(.98,1.,1.025),shadow);

  vec2 edge=vUv*2.-1.;
  float vignette=smoothstep(.18,1.6,dot(edge,edge));
  colour*=1.-uVignette*vignette;

  // Native-pixel, monochrome grain/dither. Stable across demand frames: no
  // shimmer, scrolling noise sheet, or animation loop while the camera rests.
  float grain=hash31(vec3(gl_FragCoord.xy,17.13))-.5;
  #if GRAIN_SAMPLES > 1
    grain+=hash31(vec3(gl_FragCoord.yx,91.7))-.5;
  #else
    grain*=1.5;
  #endif
  colour+=grain*uGrain*smoothstep(.001,.018,curved);
  gl_FragColor=vec4(clamp(mix(original,colour,uStrength),0.,1.),1.);
}`;

/** One native-size GPU copy + one fullscreen pass; never rerender the subject. */
export function createSpaceGrade(gl:WebGLRenderer,quality:EffectQuality,options:{enabled?:boolean;identity?:boolean;grain?:boolean}={}){
  const profile=SPACE_GRADE_TIERS[quality],pixels=new Vector2();
  let frame=new FramebufferTexture(1,1);frame.colorSpace=NoColorSpace;
  const emptyMask=new DataTexture(new Uint8Array([0,0,0,0]),1,1,RGBAFormat,UnsignedByteType);emptyMask.needsUpdate=true;
  const material=new ShaderMaterial({name:"Space grade — display artistic pass",toneMapped:false,depthTest:false,depthWrite:false,blending:NoBlending,
    defines:{POOL_OCTAVES:profile.octaves,GRAIN_SAMPLES:profile.grainSamples},
    uniforms:{uFrame:{value:frame},uOcclusion:{value:emptyMask},uStrength:{value:0},uHasMask:{value:0},uNebula:{value:0},uNebulaGain:{value:1},
      uCameraWorld:{value:new Matrix4()},uProjectionInverse:{value:new Matrix4()},
      uPools:{value:SPACE_GRADE.pools},uVignette:{value:SPACE_GRADE.vignette},uContrast:{value:SPACE_GRADE.contrast},uToe:{value:SPACE_GRADE.shadowToe},
      uSilver:{value:SPACE_GRADE.silver},uShadowCool:{value:SPACE_GRADE.shadowCool},uGrain:{value:options.grain===false?0:profile.grain}},vertexShader,fragmentShader});
  const quad=new FullScreenQuad(material);
  const enabled=options.enabled!==false;
  let ready=false;
  function prepare(){
    if(!enabled)return;
    const target=gl.getRenderTarget(),auto=gl.autoClear,probe=new WebGLRenderTarget(1,1,{depthBuffer:false});
    try{gl.setRenderTarget(probe);gl.autoClear=false;quad.render(gl);ready=true;}finally{gl.setRenderTarget(target);gl.autoClear=auto;probe.dispose();}
  }
  function draw(camera:Camera,occlusion:Texture|null,nebula:boolean,amount:number,tuning?:CinemaValues){
    if(!enabled||!ready||amount<=0||gl.getRenderTarget()!==null)return;
    if(tuning&&(!tuning.post||!tuning.grade))return;
    if(tuning){const u=material.uniforms;u.uNebulaGain.value=tuning.nebulaStrength;u.uPools.value=tuning.pools;u.uVignette.value=tuning.vignette;u.uContrast.value=tuning.contrast;u.uToe.value=tuning.shadowToe;u.uSilver.value=tuning.silver;u.uShadowCool.value=tuning.shadowCool;u.uGrain.value=(options.grain===false?0:profile.grain)*tuning.grain;}
    gl.getDrawingBufferSize(pixels);
    if(frame.image.width!==pixels.x||frame.image.height!==pixels.y){
      frame.dispose();frame=new FramebufferTexture(pixels.x,pixels.y);frame.colorSpace=NoColorSpace;material.uniforms.uFrame.value=frame;
    }
    gl.copyFramebufferToTexture(frame);
    material.uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    material.uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    material.uniforms.uOcclusion.value=occlusion??emptyMask;material.uniforms.uHasMask.value=occlusion?1:0;
    material.uniforms.uNebula.value=nebula?1:0;material.uniforms.uStrength.value=options.identity?0:Math.min(1,amount)*(tuning?.gradeMix??1);
    const auto=gl.autoClear;
    try{gl.autoClear=false;quad.render(gl);}finally{gl.autoClear=auto;}
  }
  return {enabled,prepare,draw,dispose(){frame.dispose();emptyMask.dispose();material.dispose();quad.dispose();}};
}
