import {DoubleSide,Mesh,MeshStandardMaterial,Vector3,type Object3D,type Texture} from 'three';

export const FOREGROUND_LIGHT={wallStrength:.012,logoReflection:.05,logoFill:.55} as const;

/** View 2's key light, on the logo alone (the user, 2026-11-16): one side lit, the other falling into shadow, like a
 *  single key with almost no fill. A soft point key fixed in world space, placed relative to the View 2 camera
 *  (`ahead`/`side`/`lift`, world units along its forward/right/up; FullJourney places it), with a soft reach
 *  (exp(-(d/reach)^falloff): flat near the key, a steeper edge further on) so the light falls off across the logo.
 *  The user then asked for the shadow side 30% darker: reach 180→220, falloff 2→4, shadow .12→.11; and then another 30%:
 *  reach 220→235, falloff 4→6, shadow .11→.085 (a sharper edge keeps the right end lit). It is written into the logo's own material: no scene light, pass or texture,
 *  and nothing else in the scene is lit by it. `shadow` is how much of the even self-fill is left where the key does
 *  not reach; `diffuse`/`specular` are the key's broad lift and steel sheen. Tuned at View 2 (1920x940): the key sits
 *  off the far right end of the logo, so the falloff runs along it (right end lit, near left end in shadow) rather
 *  than making a pool on one face. */
export const LOGO_KEY={ahead:280,side:150,lift:80,reach:235,falloff:6,shadow:.085,diffuse:.35,specular:1.5,shininess:10,colour:[1,.97,.93]} as const;
/** Written by FullJourney: the key's world position and how much of View 2 is in the shot. */
export const logoKey={view:0,position:new Vector3()};
const smoother=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*v*(v*(v*6-15)+10);};
/** 0 at View 1, rising through the turn to 1 at View 2, gone early in the pullback: the final eye is unchanged. */
export function logoKeyAmount(stage:string,progress:number){
  if(stage==='turn')return smoother(progress);
  if(stage==='turned')return 1;
  if(stage==='pullback')return 1-smoother(progress/.35);
  return 0;
}
const glslFloat=(value:number)=>Number.isInteger(value)?`${value}.`:`${value}`;

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
  const key={value:0},keyPosition={value:new Vector3()};
  root.traverse(object=>{
    if(!(object instanceof Mesh)||!object.name.startsWith('Swoosh'))return;
    // Same steel base as /eye-study. The restrained self-fill preserves its grey
    // visibility under the dark production lighting without adding scene lights.
    if(!material){
      material=new MeshStandardMaterial({name:'Logo | Reference steel grey',color:'#828d96',metalness:.95,roughness:.32,
        emissive:'#30373d',emissiveIntensity:1,side:DoubleSide,toneMapped:false,envMap:environment,envMapIntensity:0});
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,{uLogoKey:key,uLogoKeyPosition:keyPosition});
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uLogoKey;uniform vec3 uLogoKeyPosition;')
          .replace('#include <opaque_fragment>',/* glsl */`
            if(uLogoKey>0.){
              // View 2's key light (view space): soft reach across the logo, broad lift and steel sheen on the side
              // that faces it; the even self-fill gives way to shadow where it does not reach.
              vec3 keyRay=uLogoKeyPosition+vViewPosition;
              float keyDistance=max(length(keyRay),1e-3);vec3 keyDirection=keyRay/keyDistance;
              float facing=dot(normal,keyDirection);
              float reach=exp(-pow(keyDistance/${glslFloat(LOGO_KEY.reach)},${glslFloat(LOGO_KEY.falloff)}));
              float lit=reach*smoothstep(-.15,.6,facing);
              float sheen=pow(max(dot(normal,normalize(keyDirection+normalize(vViewPosition))),0.),${glslFloat(LOGO_KEY.shininess)})*reach*step(0.,facing);
              outgoingLight*=mix(1.,${glslFloat(LOGO_KEY.shadow)}+${glslFloat(1-LOGO_KEY.shadow)}*lit,uLogoKey);
              outgoingLight+=vec3(${LOGO_KEY.colour.map(glslFloat).join(',')})*(${glslFloat(LOGO_KEY.diffuse)}*lit+${glslFloat(LOGO_KEY.specular)}*sheen)*uLogoKey;
            }
            #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>'logo-steel-view-two-key-v4';
    }
    object.material=material;
    const before=object.onBeforeRender;
    object.onBeforeRender=function(renderer,scene,camera,geometry,current,group){
      before.call(this,renderer,scene,camera,geometry,current,group);
      key.value=phase()==='logoReveal'?logoKey.view:0;
      if(key.value>0)keyPosition.value.copy(logoKey.position).applyMatrix4(camera.matrixWorldInverse);
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
