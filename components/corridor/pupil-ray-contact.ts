import {Color,LinearFilter,Mesh,NoColorSpace,NormalBlending,Scene,ShaderMaterial,UnsignedByteType,Vector2,Vector3,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';
import type {EffectQuality} from './effect-quality';

export const PUPIL_CONTACT_SCALE={desktop:.25,laptop:.1875,mobile:.125} as const;

/** Reuse the actual animated/atlas-covered grains; never change their main material. */
export function createGrainContactMaterial(source:ShaderMaterial){
  const material=source.clone();material.name='Pupil | Actual grain contact coverage';material.uniforms=source.uniforms;
  material.fragmentShader=source.fragmentShader.replace('#include <colorspace_fragment>',
    'fragmentColour=vec4(0.,0.,0.,clamp(fragmentColour.a*10.,0.,1.));');
  material.blending=NormalBlending;material.depthTest=false;material.depthWrite=false;material.toneMapped=false;
  return material;
}

/** A small live density mask hands the visible ray to grains, including their depth/motion. */
export function createPupilRayContact(gl:WebGLRenderer,eye:Mesh,quality:EffectQuality){
  if(!(eye.material instanceof ShaderMaterial))throw new Error('Pupil contact requires the authored grain shader');
  const source=eye.material,material=createGrainContactMaterial(source),mesh=new Mesh(eye.geometry,material),scene=new Scene();
  mesh.name='Pupil — private grain contact coverage';mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;scene.add(mesh);
  const target=new WebGLRenderTarget(1,1,{type:UnsignedByteType,depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter});
  target.texture.name='Pupil — live grain contact mask';target.texture.colorSpace=NoColorSpace;target.texture.generateMipmaps=false;
  const pixels=new Vector2(),projected=new Vector3(),clear=new Color(),scale=PUPIL_CONTACT_SCALE[quality];
  const uniforms={uHeroGrainMask:{value:target.texture},uHeroMaskTexel:{value:new Vector2(1,1)},uHeroScreenOrigin:{value:new Vector2(.5,.5)}};
  function draw(camera:Camera){
    gl.getDrawingBufferSize(pixels);const width=Math.max(1,Math.round(pixels.x*scale)),height=Math.max(1,Math.round(pixels.y*scale));
    if(width!==target.width||height!==target.height){target.setSize(width,height);uniforms.uHeroMaskTexel.value.set(1/width,1/height);}
    eye.updateWorldMatrix(true,false);mesh.geometry=eye.geometry;mesh.matrix.copy(eye.matrixWorld);
    projected.copy(source.uniforms.uHeroOrigin.value).project(camera);
    uniforms.uHeroScreenOrigin.value.set(projected.x*.5+.5,projected.y*.5+.5);
    const previous=gl.getRenderTarget(),auto=gl.autoClear,shadow=gl.shadowMap.autoUpdate,clearAlpha=gl.getClearAlpha();gl.getClearColor(clear);
    const viewportHeight=source.uniforms.uViewportHeight.value,dpr=source.uniforms.uDpr.value;
    try{
      source.uniforms.uViewportHeight.value=height;source.uniforms.uDpr.value=gl.getPixelRatio()*scale;
      gl.autoClear=false;gl.shadowMap.autoUpdate=false;gl.setRenderTarget(target);gl.setClearColor(0,0);gl.clear(true,false,false);gl.render(scene,camera);
    }finally{
      source.uniforms.uViewportHeight.value=viewportHeight;source.uniforms.uDpr.value=dpr;
      gl.setRenderTarget(previous);gl.autoClear=auto;gl.shadowMap.autoUpdate=shadow;gl.setClearColor(clear,clearAlpha);
    }
  }
  return {mesh,uniforms,draw,dispose(){scene.remove(mesh);material.dispose();target.dispose();}};
}
