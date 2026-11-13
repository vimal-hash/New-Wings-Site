import type { LightShadow,Material } from "three";

/** The assembled phone projector never changes pose, so the spot can reuse its map. */
export const preparedPhoneProjectorShadows=new WeakSet<LightShadow>();

/** One animation clock drives the room, local illumination and optical highlights. */
export const stageLighting = {
  room: { value: 1 }, indirect: { value: 1 }, key: { value: 0 }, flash: { value: 0 },
  frame: 0, active: false, darkened:false, geometryVersion: 0,
};
const smooth = (a:number,b:number,t:number) => {const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
export const ROOM_DARK_LEVEL=.10;
export function lightingAt(frame:number,active:boolean,darkened=false) {
  const reveal=active?smooth(1,24,frame):0;
  return {room:active?1-(1-ROOM_DARK_LEVEL)*reveal:darkened?ROOM_DARK_LEVEL:1,indirect:active?1-.7*reveal:darkened?.3:1,key:active?smooth(1,12,frame):darkened?1:0,flash:0};
}
export function updateStageLighting(frame:number,active:boolean) {
  stageLighting.frame=frame;stageLighting.active=active;if(active)stageLighting.darkened=true;
  const target=lightingAt(frame,active,stageLighting.darkened);
  // Darkness is one-way for this visit, including replay and the HTML-page return.
  stageLighting.room.value=Math.min(stageLighting.room.value,target.room);
  stageLighting.indirect.value=Math.min(stageLighting.indirect.value,target.indirect);
  stageLighting.key.value=Math.max(stageLighting.key.value,target.key);
  stageLighting.flash.value=0;
}

/** Spread the theatre fade across the camera move, with soft ends at both stops. */
export const theatrePullbackDim=(progress:number)=>smooth(.06,1,progress);

/** Forward: the room dims during the pullback (`dim` 0..1), then the
 *  projector key comes up as the camera turns toward it (`key` 0..1). One-way, like the build. */
export function leadStageLighting(dim:number,key:number) {
  if(dim>0)stageLighting.darkened=true;
  stageLighting.room.value=Math.min(stageLighting.room.value,1-(1-ROOM_DARK_LEVEL)*dim);
  stageLighting.indirect.value=Math.min(stageLighting.indirect.value,1-.7*dim);
  stageLighting.key.value=Math.max(stageLighting.key.value,key);
}
/** Scrolling back into the theatre: the room light returns (`amount` 0 dark .. 1 fully lit). */
export function restoreStageLighting(amount:number) {
  const a=Math.max(0,Math.min(1,amount));
  stageLighting.darkened=false;
  stageLighting.room.value=Math.max(stageLighting.room.value,ROOM_DARK_LEVEL+(1-ROOM_DARK_LEVEL)*a);
  stageLighting.indirect.value=Math.max(stageLighting.indirect.value,.3+.7*a);
  stageLighting.key.value=Math.min(stageLighting.key.value,1-a);
}

/** Attenuate baked illumination, never transparency. Bright sources extinguish
 * before the reflected fill, so the room does not read as one fading image. */
export function stageBakedMaterial(material:Material,floor=false,emitter=false) {
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,{stageRoom:stageLighting.room});
    shader.fragmentShader="uniform float stageRoom;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",
      `float dimAmount=clamp((1.-stageRoom)/${1-ROOM_DARK_LEVEL},0.,1.);
float bakedLuma=dot(outgoingLight,vec3(.2126,.7152,.0722));
float directShare=smoothstep(.025,.45,bakedLuma);
float nightFill=${floor?".25":"mix(.145,.055,directShare)"};
${emitter?"nightFill=mix(nightFill,.006,smoothstep(.25,.70,bakedLuma));":""}
float roomFill=mix(1.,nightFill,${emitter?"dimAmount":"smoothstep(.08,1.,dimAmount)"});
outgoingLight*=roomFill;\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+"|stage-baked-v6|"+floor+"|"+emitter;
}

/** Retain the approved walnut bake as the base, with live spotlight/shadows
 * added only after formation begins. No extra floor geometry or texture. */
export function stageProjectorFloor(material:Material,mobile=false) {
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{stageRoom:stageLighting.room,stageKey:stageLighting.key});
    shader.fragmentShader="uniform float stageRoom;uniform float stageKey;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader
      // The display bake is already dark walnut. Amplifying it tenfold bleached
      // the grain into a tan pool under the key. Keep the original colour ratios.
      .replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb=min(diffuseColor.rgb*2.4,vec3(.32))*stageKey;")
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
totalEmissiveRadiance*=mix(.18,1.,clamp((stageRoom-${ROOM_DARK_LEVEL})/${1-ROOM_DARK_LEVEL},0.,1.));`)
      // Before the key, show the bake alone, as in Blender: the scene's lights must not lay a grey sheen over it.
      .replace("#include <opaque_fragment>","outgoingLight-=totalSpecular*(1.-stageKey);\n#include <opaque_fragment>");
    if(mobile)shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`#include <map_fragment>
      // With the projector key off, only the existing floor bake contributes.
      if(stageKey<=0.){
        gl_FragColor=vec4(diffuseColor.rgb*mix(.18,1.,clamp((stageRoom-${ROOM_DARK_LEVEL})/${1-ROOM_DARK_LEVEL},0.,1.)),1.);
        #include <colorspace_fragment>
        #include <dithering_fragment>
        return;
      }`);
  };
  material.customProgramCacheKey=()=>"projector-floor-live-key-v3-"+mobile;
}
