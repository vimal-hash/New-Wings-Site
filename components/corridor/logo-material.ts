import {DoubleSide,Mesh,MeshStandardMaterial,type Object3D,type Texture} from 'three';

export const FOREGROUND_LIGHT={wallStrength:.012,logoReflection:.05,logoFill:.55} as const;

/** Only the exterior close views; recover the approved material before the final eye. */
export function foregroundLightAmount(phase:string,height:number){
  if(phase!=='logoReveal')return 0;
  const t=Math.max(0,Math.min(1,(height-45)/100));
  return 1-t*t*(3-2*t);
}

/** A restrained grazing contribution over the original world-space wall bake. */
export function applyCorridorRim(mesh:Mesh,phase:()=>string){
  const material=mesh.material;
  if(Array.isArray(material))return;
  mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox;if(!bounds)return;
  const amount={value:0},top={value:bounds.max.y},width={value:Math.max(.4,(bounds.max.y-bounds.min.y)*.09)};
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,{uCorridorRim:amount,uCorridorTop:top,uCorridorRimWidth:width});
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vRimPosition,vRimNormal;')
      .replace('#include <project_vertex>',
        'vRimPosition=(modelMatrix*vec4(transformed,1.)).xyz;vRimNormal=normalize(mat3(modelMatrix)*normal);\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vRimPosition,vRimNormal;uniform float uCorridorRim,uCorridorTop,uCorridorRimWidth;')
      .replace('#include <opaque_fragment>',/* glsl */`
        vec3 rimNormal=normalize(vRimNormal)*(gl_FrontFacing?1.:-1.);
        float grazing=.18+.82*pow(max(0.,dot(rimNormal,normalize(vec3(-.55,.45,.70)))),.8);
        float falloff=exp(-max(0.,uCorridorTop-vRimPosition.y)/uCorridorRimWidth);
        outgoingLight+=vec3(.86,.94,1.)*${FOREGROUND_LIGHT.wallStrength}*grazing*falloff*uCorridorRim;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'|exterior-corridor-rim-v1';
  const before=mesh.onBeforeRender;
  mesh.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    before.call(this,renderer,scene,camera,geometry,material,group);
    amount.value=foregroundLightAmount(phase(),camera.matrixWorld.elements[13]);
  };
}

/** Apply only to the mount-owned corridor clone; cached GLTF materials stay intact. */
export function applyLogoMaterial(root:Object3D,environment:Texture|null=null,phase:()=>string=()=>''):MeshStandardMaterial|null{
  let material:MeshStandardMaterial|null=null;
  root.traverse(object=>{
    if(!(object instanceof Mesh)||!object.name.startsWith('Swoosh'))return;
    // Same steel base as /eye-study. The restrained self-fill preserves its grey
    // visibility under the dark production lighting without adding scene lights.
    material??=new MeshStandardMaterial({name:'Logo | Reference steel grey',color:'#828d96',metalness:.95,roughness:.32,
      emissive:'#30373d',emissiveIntensity:1,side:DoubleSide,toneMapped:false,envMap:environment,envMapIntensity:0});
    object.material=material;
    const before=object.onBeforeRender;
    object.onBeforeRender=function(renderer,scene,camera,geometry,current,group){
      before.call(this,renderer,scene,camera,geometry,current,group);
      const amount=foregroundLightAmount(phase(),camera.matrixWorld.elements[13]);
      // Exchange some uniform self-fill for the existing soft environment's
      // view-dependent reflection. No new light can illuminate the iris.
      const steel=current as MeshStandardMaterial;
      steel.emissiveIntensity=1-(1-FOREGROUND_LIGHT.logoFill)*amount;
      steel.envMapIntensity=FOREGROUND_LIGHT.logoReflection*amount;
    };
  });
  return material;
}
