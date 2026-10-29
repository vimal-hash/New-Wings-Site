import {Color,FramebufferTexture,LinearFilter,Material,Matrix4,Mesh,MeshDepthMaterial,NearestFilter,NoBlending,NoColorSpace,RGBADepthPacking,Scene,ShaderMaterial,Vector2,Vector3,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {createPupilFillMask,isPupilFillMaterial} from './pupil-fill';
import type {CinemaValues} from './cinema-controls';
import type {EffectQuality} from './effect-quality';

const EYE='Approved revision 16 — authored steel grains',STARS='Logo eye — sparse depth grains';
export const CINEMA_FOCUS_TIERS={desktop:{scale:1,taps:40},laptop:{scale:.5,taps:24},mobile:{scale:.375,taps:12}} as const;

/** Focus an actual visible grain near the centre, not the offscreen eye bounds. */
export function pickCinemaFocus(eye:Mesh,camera:Camera,point=new Vector3(),modelView=new Matrix4()){
  if(!(eye.material instanceof ShaderMaterial))return null;
  const positions=eye.geometry.getAttribute('authoredPosition');if(!positions?.count)return null;
  const {uMin,uExtent}=eye.material.uniforms;modelView.multiplyMatrices(camera.matrixWorldInverse,eye.matrixWorld);
  const projection=camera.projectionMatrix.elements;let best=Infinity,depth:number|null=null;
  const stride=Math.max(1,Math.floor(positions.count/1024));
  for(let index=0;index<positions.count;index+=stride){
    point.fromBufferAttribute(positions,index).multiply(uExtent.value).add(uMin.value).applyMatrix4(modelView);
    if(point.z>=-.1)continue;
    const x=point.x*projection[0]/-point.z,y=point.y*projection[5]/-point.z;
    if(Math.abs(x)>.9||Math.abs(y)>.8)continue;
    const score=x*x+(y+.10)*(y+.10);
    if(score<best){best=score;depth=-point.z;}
  }
  return depth;
}

/** Original moving grain vertex/coverage, rendered into private packed depth. */
export function createCinemaGrainDepth(source:ShaderMaterial,stars=false){
  const material=source.clone();material.name='Cinema | authored grain focus depth';material.uniforms=source.uniforms;
  material.fragmentShader='#include <packing>\n'+source.fragmentShader
    .replace('void main(){','void main(){'+(stars?'if(vDistant>.5)discard;':''))
    .replaceAll('#include <colorspace_fragment>','if(fragmentColour.a<.08)discard;fragmentColour=packDepthToRGBA(gl_FragCoord.z);');
  material.blending=NoBlending;material.transparent=false;material.depthTest=true;material.depthWrite=true;material.toneMapped=false;
  return material;
}

const fragment=/* glsl */`
uniform sampler2D uFrame,uDepth;
uniform float uNear,uFar,uFocus,uRange,uBokeh;
uniform vec2 uPixel;
varying vec2 vUv;
#include <packing>
float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(uDepth,uv)),uNear,uFar);}
float circleOfConfusion(float distance){return clamp((abs(distance-uFocus)-uRange*.5)/max(.1,uRange),0.,1.);}
void main(){
  vec3 original=texture2D(uFrame,vUv).rgb;
  float depth=distanceAt(vUv),coc=circleOfConfusion(depth),blur=coc*uBokeh;
  if(blur<.1){gl_FragColor=vec4(original,1.);return;}
  vec3 colour=original;float total=1.;
  for(int i=0;i<FOCUS_TAPS;i++){
    float index=float(i)+.5,angle=index*2.39996323;
    float radial=sqrt(index/float(FOCUS_TAPS));
    vec2 offset=vec2(cos(angle),sin(angle))*radial*blur*uPixel;
    vec2 uv=clamp(vUv+offset,vec2(0.),vec2(1.));
    // Keep in-focus silhouettes sharp while gathering the defocused background.
    float sampledDepth=distanceAt(uv);
    float weight=smoothstep(0.,max(.001,coc*.5),circleOfConfusion(sampledDepth));
    weight*=1.-smoothstep(.80,1.,radial);
    // Distant colour must not wash across a closer surface's silhouette.
    weight*=1.-smoothstep(uRange*.5,uRange*1.5,max(0.,sampledDepth-depth));
    colour+=texture2D(uFrame,uv).rgb*weight;total+=weight;
  }
  gl_FragColor=vec4(colour/total,1.);
}`;

/** Optional lens preview: allocated lazily, zero draws/copies when disabled. */
export function createCinemaFocus(gl:WebGLRenderer,sourceScene:Scene,quality:EffectQuality){
  const tier=CINEMA_FOCUS_TIERS[quality],scene=new Scene(),size=new Vector2(),centre=new Vector3(),clear=new Color();
  const target=new WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:false,minFilter:NearestFilter,magFilter:NearestFilter});
  target.texture.colorSpace=NoColorSpace;target.texture.generateMipmaps=false;target.texture.name='Cinema | optional subject depth';
  let frame=new FramebufferTexture(1,1);frame.colorSpace=NoColorSpace;frame.minFilter=frame.magFilter=LinearFilter;
  const material=new ShaderMaterial({name:'Cinema | optional depth of field',toneMapped:false,depthWrite:false,depthTest:false,blending:NoBlending,
    defines:{FOCUS_TAPS:tier.taps},uniforms:{uFrame:{value:frame},uDepth:{value:target.texture},uNear:{value:.1},uFar:{value:12000},uFocus:{value:600},uRange:{value:120},uBokeh:{value:4},uPixel:{value:new Vector2()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment});
  const quad=new FullScreenQuad(material),proxies=new Map<Mesh,{mesh:Mesh;source:Material|Material[];owned:Material[]}>();
  const modelView=new Matrix4(),lastView=new Matrix4(),lastWorld=new Matrix4(),lastProjection=new Matrix4();let focusedGeometry:Mesh['geometry']|null=null,focusedPositions:unknown=null,autoDistance=600;
  function ordinary(source:Material){
    if(isPupilFillMaterial(source)){
      const mask=createPupilFillMask(source)!;const compile=mask.onBeforeCompile;
      mask.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n#include <packing>').replace('#include <colorspace_fragment>','if(diffuseColor.a<.08)discard;gl_FragColor=packDepthToRGBA(gl_FragCoord.z);');};
      mask.customProgramCacheKey=()=> 'cinema-pupil-fill-depth-v1';mask.transparent=false;mask.blending=NoBlending;return mask;
    }
    const mapped=source as Material&{map?:MeshDepthMaterial['map'];alphaMap?:MeshDepthMaterial['alphaMap']};
    return new MeshDepthMaterial({depthPacking:RGBADepthPacking,side:source.side,map:mapped.map,alphaMap:mapped.alphaMap,alphaTest:source.alphaTest,visible:source.visible&&!source.transparent});
  }
  function draw(camera:Camera,tuning:CinemaValues){
    if(!tuning.post||!tuning.dof||tuning.bokeh<=0||gl.getRenderTarget()!==null)return;
    gl.getDrawingBufferSize(size);
    if(frame.image.width!==size.x||frame.image.height!==size.y){frame.dispose();frame=new FramebufferTexture(size.x,size.y);frame.colorSpace=NoColorSpace;frame.minFilter=frame.magFilter=LinearFilter;material.uniforms.uFrame.value=frame;}
    const width=Math.max(1,Math.round(size.x*tier.scale)),height=Math.max(1,Math.round(size.y*tier.scale));
    if(target.width!==width||target.height!==height)target.setSize(width,height);
    const seen=new Set<Mesh>();
    sourceScene.traverseVisible(object=>{
      if(!(object instanceof Mesh)||object.userData.pupilPulseEmitter||object.name==='Logo eye — distant horizon atmosphere')return;
      const source=object.material,isEye=object.name===EYE,isStars=object.name===STARS;
      const materials=Array.isArray(source)?source:[source];
      if(!isEye&&!isStars&&!materials.some(m=>!m.transparent||isPupilFillMaterial(m)))return;
      seen.add(object);let entry=proxies.get(object);
      if(entry&&entry.source!==source){scene.remove(entry.mesh);entry.owned.forEach(m=>m.dispose());proxies.delete(object);entry=undefined;}
      if(!entry){
        const owned=(isEye||isStars)&&source instanceof ShaderMaterial?[createCinemaGrainDepth(source,isStars)]:materials.map(ordinary);
        const mesh=new Mesh(object.geometry,Array.isArray(source)?owned:owned[0]);mesh.matrixAutoUpdate=false;mesh.frustumCulled=(isEye||isStars)?false:object.frustumCulled;scene.add(mesh);entry={mesh,source,owned};proxies.set(object,entry);
      }
      entry.mesh.geometry=object.geometry;entry.mesh.matrix.copy(object.matrixWorld);entry.mesh.visible=true;
    });
    proxies.forEach((entry,source)=>{if(!seen.has(source)){scene.remove(entry.mesh);entry.owned.forEach(m=>m.dispose());proxies.delete(source);}});
    const u=material.uniforms,clipping=camera as Camera&{near:number;far:number};
    u.uNear.value=clipping.near;u.uFar.value=clipping.far;u.uFocus.value=tuning.focusDistance;
    const eye=sourceScene.getObjectByName(EYE) as Mesh|undefined;
    if(tuning.autofocus&&eye?.material instanceof ShaderMaterial){
      if(focusedGeometry!==eye.geometry||focusedPositions!==eye.geometry.getAttribute('authoredPosition')||!lastView.equals(camera.matrixWorldInverse)||!lastWorld.equals(eye.matrixWorld)||!lastProjection.equals(camera.projectionMatrix)){
        autoDistance=pickCinemaFocus(eye,camera,centre,modelView)??tuning.focusDistance;
        focusedGeometry=eye.geometry;focusedPositions=eye.geometry.getAttribute('authoredPosition');lastView.copy(camera.matrixWorldInverse);lastWorld.copy(eye.matrixWorld);lastProjection.copy(camera.projectionMatrix);
      }
      u.uFocus.value=Math.max(clipping.near,tuning.focusDistance+(autoDistance-tuning.focusDistance)*(tuning.autofocusMix??1));
    }
    u.uRange.value=tuning.focusRange;u.uBokeh.value=tuning.bokeh*gl.getPixelRatio();u.uPixel.value.set(1/size.x,1/size.y);
    const shared=new Set<ShaderMaterial['uniforms']>();proxies.forEach(p=>p.owned.forEach(m=>{if(m instanceof ShaderMaterial&&m.uniforms.uViewportHeight)shared.add(m.uniforms);}));
    const sizes=[...shared].map(uniforms=>({uniforms,height:uniforms.uViewportHeight.value,dpr:uniforms.uDpr.value}));
    const previous=gl.getRenderTarget(),auto=gl.autoClear,shadow=gl.shadowMap.autoUpdate,alpha=gl.getClearAlpha();gl.getClearColor(clear);
    try{
      gl.copyFramebufferToTexture(frame);sizes.forEach(({uniforms})=>{uniforms.uViewportHeight.value=height;uniforms.uDpr.value=gl.getPixelRatio()*tier.scale;});
      gl.autoClear=false;gl.shadowMap.autoUpdate=false;gl.setRenderTarget(target);gl.setClearColor(0xffffff,1);gl.clear(true,true,false);gl.render(scene,camera);
      gl.setRenderTarget(previous);quad.render(gl);
    }finally{
      sizes.forEach(({uniforms,height,dpr})=>{uniforms.uViewportHeight.value=height;uniforms.uDpr.value=dpr;});
      gl.setRenderTarget(previous);gl.autoClear=auto;gl.shadowMap.autoUpdate=shadow;gl.setClearColor(clear,alpha);
    }
  }
  return {draw,dispose(){proxies.forEach(p=>p.owned.forEach(m=>m.dispose()));proxies.clear();scene.clear();quad.dispose();material.dispose();target.dispose();frame.dispose();}};
}
