import {Color,CustomBlending,DataTexture,HalfFloatType,LinearFilter,NoBlending,NoColorSpace,OneFactor,RGBAFormat,ShaderMaterial,UnsignedByteType,Vector2,Vector3,WebGLRenderTarget,type Camera,type WebGLRenderer} from "three";
import {portalGlowGlsl,bluePortalGlowGlsl,yellowPortalGlowGlsl} from "../rope-model/rope-portal";
import {BLUE_BACKDROP} from "../rope-model/rope-blue";
import {GREEN_BACKDROP,YELLOW_BACKDROP,nearGreenLook,yellowRopeLook,yellowGreenGradeGlsl,yellowToeGlsl} from "../rope-model/rope-yellow";
import {FullScreenQuad} from "three/examples/jsm/postprocessing/Pass.js";
import {WHITE_STORED,type RopeLook} from "../rope-model/rope-materials";
import {greenFromRed} from "../rope-model/rope-flight";

// The desktop finish in the same order (exposure, glow, the file's colour ramps, display), with cheaper steps: fewer reads per pixel, and the same glow reach.
const LUT_SIZE=512;
const BACKDROP=[.0035,.00005,.00034];
const GLOW={threshold:.12,knee:.12,strength:.85,sizesAt1920:8,firstSize:2}; // the first glow picture is a quarter across: the glow is wide, so the same reach for a quarter of the work
// With 2 edge samples a thin thread falls between them and reads as dashes. So each frame looks a little aside, a different way each time, and the last four are averaged equally: 8 samples at the price of 2, with no shimmer because the same four are always in the average. Only when the camera is nearly still, as a moving camera would show every frame.
const ASIDE=[[.375,-.125],[-.375,.125],[.125,.375],[-.125,-.375]]; // pixels
const SETTLE_FRAMES=6;
const STILL_BELOW=.0005,MOVING_FROM=.004; // world units a frame

const display=(v:number)=>{const c=Math.min(Math.max(v,0),1);return (c<.0031308?c*12.92:1.055*c**(1/2.4)-.055)*255;};
// The colour ramps with the display curve already in them: 8 bits are all the screen shows, and the picture no longer needs a pow per pixel for it.
function gradeTexture(look:RopeLook){
  const data=new Uint8Array(LUT_SIZE*4);
  look.grade.forEach((stops,channel)=>{
    for(let i=0;i<LUT_SIZE;i++){
      const x=(i/(LUT_SIZE-1))**3;
      let k=0;
      while(k<stops.length-1&&stops[k+1][0]<x)k++;
      const [x0,y0]=stops[k],[x1,y1]=stops[Math.min(k+1,stops.length-1)];
      data[i*4+channel]=Math.round(display(x<=x0?y0:x1>x0?y0+(y1-y0)*Math.min((x-x0)/(x1-x0),1):y1));
    }
  });
  for(let i=0;i<LUT_SIZE;i++)data[i*4+3]=255;
  const texture=new DataTexture(data,LUT_SIZE,1,RGBAFormat,UnsignedByteType);
  texture.minFilter=texture.magFilter=LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

const fullScreen=/* glsl */`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const highlights=/* glsl */`
  vec3 highlights(vec3 c){
    float v=max(c.r,max(c.g,c.b)),h=max(${GLOW.knee.toFixed(3)}-abs(${GLOW.threshold.toFixed(3)}-v),0.)/${GLOW.knee.toFixed(3)};
    return c*((max(${GLOW.threshold.toFixed(3)},v)+h*h*${GLOW.knee.toFixed(3)}*.25-${GLOW.threshold.toFixed(3)})/max(v,1e-9));
  }`;

/** The picture is stored in 8 bits per channel as the square root of light divided by this: half the memory of the desktop's 16 bits, and edge samples cost far less. */
export const STORED_RANGE=8;
export function createLaptopFinish(look:RopeLook,samples:number,flight=false,blue=false,yellow=false){
  const backdrop=yellow?GREEN_BACKDROP:blue?BLUE_BACKDROP:BACKDROP;
  const target=new WebGLRenderTarget(4,4,{type:UnsignedByteType,format:RGBAFormat,colorSpace:NoColorSpace,minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:true,samples});
  const grade=gradeTexture(yellow?nearGreenLook(look):look),farGrade=yellow?gradeTexture(yellowRopeLook(look)):null;
  let sizes:WebGLRenderTarget[]=[],glowBase=0,glowGain=1;
  const backdropNow=new Color();

  const first=new ShaderMaterial({
    depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uSource:{value:target.texture},uTexel:{value:new Vector2()},uExposure:{value:look.exposure}},
    vertexShader:fullScreen,
    fragmentShader:/* glsl */`
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      uniform float uExposure;
      varying vec2 vUv;
      ${highlights}
      vec3 tap(float x,float y){vec3 s=texture2D(uSource,vUv+vec2(x,y)*uTexel).rgb;return highlights(s*s*${STORED_RANGE.toFixed(1)}*uExposure);}
      void main(){
        // Four reads between pixels cover a 4x4 area. A very bright speck counts for less, so it does not flicker.
        vec3 a=tap(-1.,-1.),b=tap(1.,-1.),c=tap(-1.,1.),d=tap(1.,1.);
        vec4 w=1./(1.+.1*vec4(max(a.r,max(a.g,a.b)),max(b.r,max(b.g,b.b)),max(c.r,max(c.g,c.b)),max(d.r,max(d.g,d.b))));
        gl_FragColor=vec4((a*w.x+b*w.y+c*w.z+d*w.w)/(w.x+w.y+w.z+w.w),1.);
      }`,
  });
  const down=new ShaderMaterial({
    depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uSource:{value:null},uTexel:{value:new Vector2()}},
    vertexShader:fullScreen,
    fragmentShader:/* glsl */`
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      varying vec2 vUv;
      vec3 tap(float x,float y){return texture2D(uSource,vUv+vec2(x,y)*uTexel).rgb;}
      void main(){gl_FragColor=vec4((tap(-1.,-1.)+tap(1.,-1.)+tap(-1.,1.)+tap(1.,1.))*.25,1.);}`,
  });
  const up=new ShaderMaterial({
    depthTest:false,depthWrite:false,transparent:true,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneFactor,
    uniforms:{uSource:{value:null},uTexel:{value:new Vector2()}},
    vertexShader:fullScreen,
    fragmentShader:/* glsl */`
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      varying vec2 vUv;
      vec3 tap(float x,float y){return texture2D(uSource,vUv+vec2(x,y)*uTexel).rgb;}
      void main(){gl_FragColor=vec4((tap(-.5,-.5)+tap(.5,-.5)+tap(-.5,.5)+tap(.5,.5))*.25,1.);}`,
  });
  // At full size the picture gets the desktop's small softening. Stretched up from fewer pixels it is soft already, so it is sharpened instead, without going past its neighbours, which would ring.
  const makeFinal=(stretched:boolean)=>new ShaderMaterial({
    depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uScene:{value:target.texture},uGlow:{value:null},uGlowScale:{value:0},uWhiteStored:{value:WHITE_STORED.share},uGrade:{value:grade},...(farGrade?{uFarGrade:{value:farGrade}}:{}),uExposure:{value:look.exposure},uSize:{value:LUT_SIZE},uViewport:{value:new Vector2(1,1)},uPortal:{value:new Vector3()},uSharpen:{value:0},uCameraRed:{value:1}},
    vertexShader:fullScreen,
    fragmentShader:/* glsl */`
      uniform sampler2D uScene,uGlow,uGrade;
      ${yellow?"uniform sampler2D uFarGrade;":""}
      uniform float uExposure,uSize,uGlowScale,uWhiteStored,uSharpen,uCameraRed;
      uniform vec2 uViewport;
      varying vec2 vUv;
      ${highlights}
      ${yellow?yellowPortalGlowGlsl:blue?bluePortalGlowGlsl:portalGlowGlsl}
      void main(){
        vec2 t=1./uViewport;
        vec4 mixed=texture2D(uScene,vUv);
        ${stretched?/* glsl */`
        vec3 w=texture2D(uScene,vUv-vec2(t.x,0.)).rgb,e=texture2D(uScene,vUv+vec2(t.x,0.)).rgb,n=texture2D(uScene,vUv+vec2(0.,t.y)).rgb,s=texture2D(uScene,vUv-vec2(0.,t.y)).rgb;
        vec3 least=min(mixed.rgb,min(min(w,e),min(n,s))),most=max(mixed.rgb,max(max(w,e),max(n,s)));
        mixed.rgb=clamp(mixed.rgb+(mixed.rgb-(w+e+n+s)*.25)*uSharpen,least,most);
        `:/* glsl */`
        // One read between four pixels gives the desktop's softening for the price of one.
        mixed=mix(mixed,texture2D(uScene,vUv+t*.5),.4);
        `}
        vec3 scene=mixed.rgb*mixed.rgb*${STORED_RANGE.toFixed(1)}*uExposure;
        vec3 glow=(highlights(scene)+texture2D(uGlow,vUv).rgb)*uGlowScale;
        vec3 c=clamp(scene+glow,0.,1.);
        vec3 g=(pow(c,vec3(1./3.))*(uSize-1.)+.5)/uSize;
        ${yellow?yellowGreenGradeGlsl:flight&&!blue?/* glsl */`
        // The green file's curves are the red file's with red and green swapped, so one sheet holds both and each pixel takes its own.
        vec4 gradeR=texture2D(uGrade,vec2(g.r,.5)),gradeG=texture2D(uGrade,vec2(g.g,.5));
        float gradeB=texture2D(uGrade,vec2(g.b,.5)).b;
        vec3 o=mix(vec3(gradeR.r,gradeG.g,gradeB),vec3(gradeR.g,gradeG.r,gradeB),smoothstep(mix(.12,.42,uCameraRed),mix(.25,.58,uCameraRed),c.g/max(c.r+c.g,1e-5)));
        `:`vec3 o=vec3(texture2D(uGrade,vec2(g.r,.5)).r,texture2D(uGrade,vec2(g.g,.5)).g,texture2D(uGrade,vec2(g.b,.5)).b);`}
        float white=clamp(1.-mixed.a,0.,1.);
        if(white>0.){
          float v=min(${blue?"scene.b/uWhiteStored+min(glow.b,glow.g)+portalInside(vUv)":flight?"max(scene.r,scene.g)/uWhiteStored+min(glow.r,glow.g)+portalInside(vUv)":"scene.r/uWhiteStored+glow.g"},1.);
          o=mix(o,vec3(v<.0031308?v*12.92:1.055*pow(v,1./2.4)-.055)*portalTint(vUv,white),white);
        }
        ${yellow?`vec3 displayColour=o;${yellowToeGlsl}gl_FragColor=vec4(portalGlow(displayColour,vUv),1.);`:"gl_FragColor=vec4(portalGlow(o,vUv),1.);"}
      }`,
  });
  const fullSize=makeFinal(false),stretchedUp=makeFinal(true);
  const blend=new ShaderMaterial({
    depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uNow:{value:target.texture},uA:{value:null},uB:{value:null},uC:{value:null},uShare:{value:0}},
    vertexShader:fullScreen,
    fragmentShader:/* glsl */`
      uniform sampler2D uNow,uA,uB,uC;
      uniform float uShare;
      varying vec2 vUv;
      void main(){
        vec4 now=texture2D(uNow,vUv),a=texture2D(uA,vUv),b=texture2D(uB,vUv),c=texture2D(uC,vUv);
        // The picture holds square roots. Averaging those darkens thin threads and averaging them as light brightens them against the desktop, so halfway between.
        vec4 roots=mix(now,(a+b+c)/3.,uShare);
        vec3 light=sqrt(mix(now.rgb*now.rgb,(a.rgb*a.rgb+b.rgb*b.rgb+c.rgb*c.rgb)/3.,uShare));
        gl_FragColor=vec4((roots.rgb+light)*.5,roots.a);
      }`,
  });
  // Made by the graphics chip only when first used, so a laptop with 4 edge samples never pays for them.
  const picture=()=>new WebGLRenderTarget(4,4,{type:UnsignedByteType,format:RGBAFormat,colorSpace:NoColorSpace,minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:false});
  const earlier=flight?[picture(),picture(),picture()]:[],averaged=flight?picture():null;
  let oldest=0,framesKept=0,aside=0,stillFor=0,stillness=0;
  const blends=()=>flight&&target.samples<4;
  let final=fullSize;
  const quad=new FullScreenQuad(final);
  const pass=(gl:WebGLRenderer,material:ShaderMaterial,into:WebGLRenderTarget|null)=>{
    gl.setRenderTarget(into);
    quad.material=material;
    quad.render(gl);
  };

  return {
    target,
    /** For compiling ahead (sections): the passes drawn into pictures, and the ones drawn to the screen. */
    passes:{toPictures:[first,down,up,blend],toScreen:[fullSize,stretchedUp]},
    backdrop:new Color(Math.sqrt(backdrop[0]/look.exposure/STORED_RANGE),Math.sqrt(backdrop[1]/look.exposure/STORED_RANGE),Math.sqrt(backdrop[2]/look.exposure/STORED_RANGE)),
    /** The colour behind the threads during the flight, and which colour curves doubtful pixels take: 0 green, 1 red. */
    backdropAt(red:number,curves=red){
      for(const material of [fullSize,stretchedUp])material.uniforms.uCameraRed.value=curves;
      const green=yellow?YELLOW_BACKDROP:greenFromRed(BACKDROP),near=yellow?GREEN_BACKDROP:BACKDROP,at=(i:number)=>Math.sqrt((green[i]+(near[i]-green[i])*red)/look.exposure/STORED_RANGE);
      return backdropNow.setRGB(at(0),at(1),at(2));
    },
    /** Just before and after the threads are drawn. */
    lookAside(camera:Camera,moved:number){
      if(!blends())return 0;
      const t=Math.min(Math.max((moved-STILL_BELOW)/(MOVING_FROM-STILL_BELOW),0),1);
      stillness=1-t*t*(3-2*t);
      stillFor=stillness===1?stillFor+1:0;
      aside=(aside+1)%ASIDE.length;
      const e=camera.projectionMatrix.elements;
      e[8]=-ASIDE[aside][0]*stillness*2/target.width;e[9]=-ASIDE[aside][1]*stillness*2/target.height;
      return stillness;
    },
    lookBack(camera:Camera){
      if(!blends())return;
      const e=camera.projectionMatrix.elements;
      e[8]=e[9]=0;
    },
    /** A picture that is not moving still needs its second frame to be whole. */
    get settling(){return blends()&&stillFor<SETTLE_FRAMES;},
    setSamples(value:number){
      if(target.samples===value)return;
      framesKept=stillFor=0;
      target.samples=value;
      target.dispose(); // made again at the new sample count on next use
    },
    /** Scale is the picture's size against the canvas: below 1 it is stretched up, and sharpened more the further it is stretched. */
    setPortal(radius:number,strength:number,aspect:number){fullSize.uniforms.uPortal.value.set(radius,strength,aspect);stretchedUp.uniforms.uPortal.value.set(radius,strength,aspect);},
    setSize(width:number,height:number,scale:number){
      target.setSize(width,height);
      earlier.forEach(frame=>frame.setSize(width,height));
      averaged?.setSize(width,height);
      framesKept=stillFor=0;
      final=scale<1?stretchedUp:fullSize;
      for(const material of [fullSize,stretchedUp])material.uniforms.uViewport.value.set(width,height);
      stretchedUp.uniforms.uSharpen.value=Math.min(Math.max((1-scale)*1.6,.25),.9);
      sizes.forEach(size=>size.dispose());
      // The same reach across the picture on any screen.
      const count=Math.max(4,Math.min(10,GLOW.sizesAt1920+Math.round(Math.log2(width/1920))));
      sizes=[];
      for(let i=GLOW.firstSize;i<count;i++)sizes.push(new WebGLRenderTarget(Math.max(1,width>>i),Math.max(1,height>>i),{type:HalfFloatType,format:RGBAFormat,colorSpace:NoColorSpace,minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:false}));
      glowBase=GLOW.strength/(count-GLOW.firstSize+1); // the levels left share the whole glow
      first.uniforms.uTexel.value.set(1/width,1/height);
      for(const material of [fullSize,stretchedUp])material.uniforms.uGlow.value=sizes[0].texture;
    },
    setTuning(gain:number,stored:number){
      glowGain=gain;
      for(const material of [fullSize,stretchedUp])material.uniforms.uWhiteStored.value=stored;
    },
    render(gl:WebGLRenderer){
      if(!sizes.length)return;
      final.uniforms.uGlowScale.value=glowBase*glowGain;
      const autoClear=gl.autoClear;
      gl.autoClear=false;
      let scene=target.texture;
      if(!blends()||stillness===0)framesKept=0; // while the camera moves none of this is paid for
      else{
        blend.uniforms.uA.value=earlier[0].texture;
        blend.uniforms.uB.value=earlier[1].texture;
        blend.uniforms.uC.value=earlier[2].texture;
        blend.uniforms.uShare.value=framesKept>=earlier.length?stillness*.75:0;
        pass(gl,blend,averaged);
        gl.initRenderTarget(earlier[oldest]);
        gl.copyTextureToTexture(target.texture,earlier[oldest].texture);
        oldest=(oldest+1)%earlier.length;
        framesKept=Math.min(framesKept+1,earlier.length);
        scene=averaged!.texture;
      }
      first.uniforms.uSource.value=scene;
      final.uniforms.uScene.value=scene;
      pass(gl,first,sizes[0]);
      for(let i=1;i<sizes.length;i++){
        down.uniforms.uSource.value=sizes[i-1].texture;
        down.uniforms.uTexel.value.set(1/sizes[i-1].width,1/sizes[i-1].height);
        pass(gl,down,sizes[i]);
      }
      for(let i=sizes.length-2;i>=0;i--){
        up.uniforms.uSource.value=sizes[i+1].texture;
        up.uniforms.uTexel.value.set(1/sizes[i+1].width,1/sizes[i+1].height);
        pass(gl,up,sizes[i]);
      }
      pass(gl,final,null);
      gl.autoClear=autoClear;
    },
    dispose(){target.dispose();earlier.forEach(frame=>frame.dispose());averaged?.dispose();blend.dispose();sizes.forEach(size=>size.dispose());grade.dispose();farGrade?.dispose();first.dispose();down.dispose();up.dispose();fullSize.dispose();stretchedUp.dispose();quad.dispose();},
  };
}
