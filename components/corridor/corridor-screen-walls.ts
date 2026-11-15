import {BoxGeometry,BufferGeometry,DataTexture,Float32BufferAttribute,FloatType,InstancedMesh,Matrix4,Mesh,MeshPhysicalMaterial,MeshStandardMaterial,NearestFilter,Quaternion,RedFormat,RepeatWrapping,Vector3,type Material,type Side,type Texture} from 'three';
import route from './scene-route.json';
import {BIG_SECTION,createArcProjector,createScreenPanels,SCREEN_COUNT,SCREEN_WALL,SMALL_PANEL} from './corridor-screen-state';

export const SCREEN_GLASS_TEXTURES=['/textures/corridor/screen-glass/screen-glass-roughness.png','/textures/corridor/screen-glass/screen-glass-normal.png'];
/** Technical line drawings printed on the lit big sections, desktop only. One texture per wall holds three sheets,
 *  one per colour channel: R projector, G Galalite screen, B circular-polarised 3D glasses (white = no ink; -v2 replaced the
 *  laser glasses so they match the 3D system sheet). Left wall (outer side of the bend, seen nearly face-on) and right wall
 *  (inner side, seen from the side). */
export const SCREEN_INK_TEXTURES=['/textures/corridor/blueprint/sheets-outer-v2.png','/textures/corridor/blueprint/sheets-inner-v2.png',
  // Second texture per wall: R cinema sound sheet, G passive 3D system sheet; B white (free for a later sheet).
  // -v2 names: the textures folder is served immutable, so changed pixels need a new URL.
  '/textures/corridor/blueprint/sheets2-outer-v2.png','/textures/corridor/blueprint/sheets2-inner-v2.png'];
/** Big sections that carry the R/G/B sheets on each wall: the projector on the near section seen while walking back, the screen and
 *  glasses on the two sections before it (so the walk shows glasses, screen, projector). Then the inner wall's horizontal pre-stretch
 *  (cancels the side-on squeeze, measured ~0.55 vs ~0.8 on the outer wall) and per-wall mirroring. */
export const SCREEN_INK={section:[[SCREEN_WALL.smallPanels+5,SCREEN_WALL.smallPanels+4,SCREEN_WALL.smallPanels+3],[SCREEN_WALL.smallPanels+6,SCREEN_WALL.smallPanels+5,SCREEN_WALL.smallPanels+4]],
  /** Sections for the second texture's R/G/B sheets: sound on the section before the glasses on each wall, the 3D system on the
   *  section before the sound (walk: 3D, sound, glasses, screen, projector); -10 = channel unused. */
  section2:[[SCREEN_WALL.smallPanels+2,SCREEN_WALL.smallPanels+1,-10],[SCREEN_WALL.smallPanels+3,SCREEN_WALL.smallPanels+2,-10]],stretch:[1,1.45],flip:[1,0]} as const;
const WALLS=['corridor-wall-red','corridor-wall-connecting'] as const;
const centreline=createArcProjector(route.samples.map(sample=>[sample.position[0],sample.position[2]] as const));

type Part={mesh:Mesh;material:Material};
/** Shared uniforms: one object per value, referenced by every screen program. */
function sharedUniforms(panels:DataTexture,count:number){
  return {uScreenPanels:{value:panels},uScreenCount:{value:count},uScreenSmall:{value:SMALL_PANEL},uScreenBig:{value:BIG_SECTION},uScreenSplit:{value:SCREEN_WALL.split as number},uScreenEnd:{value:SCREEN_WALL.split+1},
    uScreenBottom:{value:SCREEN_WALL.bottom},uScreenTop:{value:SCREEN_WALL.top},uScreenLitTop:{value:SCREEN_WALL.litTop},
    uScreenOff:{value:0},uScreenOn:{value:new Vector3(.95,.98,1)}};
}
type Shared=ReturnType<typeof sharedUniforms>;

/** Small panels beside the projector floor, then the big screen's wide sections (one texel each). */
const PANEL_GLSL=/* glsl */`
uniform sampler2D uScreenPanels;uniform float uScreenCount,uScreenSmall,uScreenBig,uScreenSplit,uScreenEnd,uScreenBottom,uScreenTop,uScreenLitTop,uScreenOff;uniform vec3 uScreenOn;
float screenSmallCount(){return floor(uScreenSplit/uScreenSmall+.5);}
float screenIndex(float arc){
  float n=screenSmallCount();
  return arc<uScreenSplit?clamp(floor(arc/uScreenSmall),0.,n-1.):clamp(n+floor((arc-uScreenSplit)/uScreenBig),n,uScreenCount-1.);
}
float screenPanel(float arc,float side){
  return texelFetch(uScreenPanels,ivec2(int(screenIndex(arc)),int(side)),0).r*(1.-uScreenOff);
}
/** Position across the current screen, 0..1. */
float screenAcross(float arc){
  if(arc<uScreenSplit)return fract(arc/uScreenSmall);
  return clamp((arc-uScreenSplit-(screenIndex(arc)-screenSmallCount())*uScreenBig)/uScreenBig,0.,1.);
}
/** Soft dark seam at each small panel edge. Big sections have no mullion: a thin soft seam (arc units)
 *  between sections, and the first one meets the boundary mullion. */
float screenSeam(float arc,float u,float width){
  if(arc<uScreenSplit)return smoothstep(0.,width,u)*smoothstep(1.,1.-width,u);
  float x=u*uScreenBig,w=width*5.;
  return smoothstep(0.,.15,arc-uScreenSplit)*smoothstep(0.,w,x)*smoothstep(uScreenBig,uScreenBig-w,x);
}`;

/** Centre line powers on, opens vertically, then the diffuser settles. p: 0..1. */
const OPENING_GLSL=/* glsl */`
float screenOpening(float p,float d,float height){
  if(p<=0.)return 0.;
  float power=smoothstep(0.,.12,p);
  float flicker=p<.15?.55+.45*step(.4,fract(sin(floor(p*70.)*91.7)*43758.55)):1.;
  float open=clamp((p-.14)/.62,0.,1.);open=1.-pow(1.-open,3.);
  float edge=open*height*.5,aa=fwidth(d)*1.5+.012;
  float body=1.-smoothstep(edge-aa,edge+aa,d);
  float lead=exp(-pow((d-edge)/.055,2.))*(1.-open*open)*.85;
  float line=exp(-pow(d/(.02+aa),2.))*(1.-open)*1.7;
  float settle=1.+.12*smoothstep(.74,.84,p)*(1.-smoothstep(.84,1.,p));
  return (body*settle+lead+line)*power*flicker;
}`;

type Ink={uScreenInk:{value:Texture|null};uScreenInk2:{value:Texture|null};uScreenInkOn:{value:number};uScreenInkSection:{value:Vector3};uScreenInkSection2:{value:Vector3};uScreenInkStretch:{value:number};uScreenInkFlip:{value:number}};
function patchGlass(material:MeshPhysicalMaterial,shared:Shared,side:number,rough:Texture,normal:Texture,clearcoat:boolean,ink:Ink){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,shared,ink,{uScreenSide:{value:side},uScreenRough:{value:rough},uScreenNormal:{value:normal}});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float aScreenArc;varying float vScreenArc;varying vec3 vScreenWorld;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvScreenArc=aScreenArc;vScreenWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\nvarying float vScreenArc;varying vec3 vScreenWorld;uniform float uScreenSide,uScreenInkOn,uScreenInkStretch,uScreenInkFlip;uniform vec3 uScreenInkSection,uScreenInkSection2;uniform sampler2D uScreenRough,uScreenNormal,uScreenInk,uScreenInk2;${PANEL_GLSL}${OPENING_GLSL}`)
      .replace('#include <color_fragment>',/* glsl */`#include <color_fragment>
        float screenY=vScreenWorld.y,screenAA=fwidth(screenY)+.004;
        // Big screen: glass fills the whole wall and lights from the floor to the marked level.
        bool screenBig=vScreenArc>=uScreenSplit;
        float glassBottom=screenBig?-1.:uScreenBottom,glassTop=screenBig?1e4:uScreenTop;
        float screenGlass=smoothstep(glassBottom-screenAA,glassBottom+screenAA,screenY)*(1.-smoothstep(glassTop-screenAA,glassTop+screenAA,screenY));
        float litBottom=screenBig?0.:uScreenBottom,litTop=screenBig?uScreenLitTop:uScreenTop;
        float screenU=screenAcross(vScreenArc),screenH=clamp((screenY-litBottom)/(litTop-litBottom),0.,1.);
        vec2 screenTile=vec2(vScreenArc,screenY);
        // Off: pale display glass. Plinth/upper wall: graphite anodised metal.
        diffuseColor.rgb=mix(vec3(.03,.032,.035),vec3(.34,.355,.375),screenGlass);`)
      .replace('#include <roughnessmap_fragment>',/* glsl */`#include <roughnessmap_fragment>
        float screenSmudge=texture2D(uScreenRough,screenTile/3.4).r;
        roughnessFactor=mix(.58+.08*screenSmudge,.035+.24*screenSmudge,screenGlass);`)
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(.72,0.,screenGlass);')
      .replace('#include <normal_fragment_maps>',/* glsl */`#include <normal_fragment_maps>
        {vec3 micro=texture2D(uScreenNormal,screenTile/.9).xyz*2.-1.;
        vec3 screenUp=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz),screenAcross=normalize(cross(screenUp,normal));
        normal=normalize(normal+(screenAcross*micro.x+screenUp*micro.y)*mix(.09,.03,screenGlass));}`)
      .replace('#include <emissivemap_fragment>',/* glsl */`#include <emissivemap_fragment>
        float screenPower=screenPanel(vScreenArc,uScreenSide);
        float screenHeight=litTop-litBottom;
        // Unclamped distance from the lit centre, so nothing lights above the marked level.
        float screenLit=screenOpening(screenPower,abs(screenY-(litBottom+litTop)*.5),screenHeight);
        float screenGap=screenSeam(vScreenArc,screenU,.035);
        float screenRoll=(screenBig?1.:mix(.84,1.,smoothstep(0.,.18,screenU)*smoothstep(1.,.82,screenU)))*mix(.86,1.,smoothstep(0.,.3,screenH)*smoothstep(1.,.66,screenH));
        float screenVary=.965+.05*fract(sin(screenIndex(vScreenArc)*12.9898+uScreenSide*4.13)*43758.5453);
        totalEmissiveRadiance+=uScreenOn*screenLit*screenGap*screenRoll*screenVary*screenGlass+vec3(.010,.011,.013)*screenGlass;
        diffuseColor.rgb*=1.-.75*min(1.,screenLit)*screenGlass;
        // Graphite ink under the glass: only where the section is lit, so it fades with the light.
        float screenInk=0.;
        // Pick the texture and channel whose section this is (first: R projector, G screen, B glasses; second: R sound).
        float inkIndex=screenIndex(vScreenArc);
        vec3 inkPick=1.-step(.5,abs(vec3(inkIndex)-uScreenInkSection)),inkPick2=1.-step(.5,abs(vec3(inkIndex)-uScreenInkSection2));
        float inkFirst=inkPick.x+inkPick.y+inkPick.z,inkSecond=inkPick2.x+inkPick2.y+inkPick2.z;
        if(uScreenInkOn>.5&&inkFirst+inkSecond>.5){
          float inkU=mix(screenU,1.-screenU,uScreenInkFlip);inkU=(inkU-.5)/uScreenInkStretch+.5;
          vec2 inkUv=vec2(inkU,screenY/uScreenLitTop);
          if(inkUv.x>0.&&inkUv.x<1.&&inkUv.y>0.&&inkUv.y<1.)
            screenInk=pow(1.-(inkFirst>.5?dot(texture2D(uScreenInk,inkUv).rgb,inkPick):dot(texture2D(uScreenInk2,inkUv).rgb,inkPick2)),.7);
        }
        screenInk*=min(1.,screenLit)*screenGlass;
        totalEmissiveRadiance*=1.-.86*screenInk;
        diffuseColor.rgb*=1.-.7*screenInk;`)
      // Ink also tones the reflections, so lines read as graphite rather than mid-grey under bright glass.
      .replace('#include <opaque_fragment>','outgoingLight*=1.-.6*screenInk;\n#include <opaque_fragment>')
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>\n${clearcoat?'material.clearcoat*=screenGlass;material.clearcoatRoughness=mix(.3,.02+.06*screenSmudge,screenGlass);':''}`);
  };
  material.customProgramCacheKey=()=>`corridor-screen-glass-v8|${clearcoat}`;
}

/** Once per floor material (dev StrictMode builds screens twice; hot reload re-runs this module, so the
 *  guard lives on the material); each screens instance writes its values in apply(). */
function patchFloor(material:Material,shared:Shared){
  const existing=material.userData.corridorScreenFloor as Shared|undefined;if(existing)return existing;
  const uniforms=sharedUniforms(shared.uScreenPanels.value,shared.uScreenCount.value);material.userData.corridorScreenFloor=uniforms;
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 aScreenFloor;varying vec3 vScreenFloor;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvScreenFloor=aScreenFloor;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\nvarying vec3 vScreenFloor;${PANEL_GLSL}`)
      .replace('#include <opaque_fragment>',/* glsl */`
        {float arc=vScreenFloor.x,gap=screenSeam(arc,screenAcross(arc),.07);
        float left=smoothstep(.14,.78,screenPanel(arc,0.)),right=smoothstep(.14,.78,screenPanel(arc,1.));
        vec2 d=max(vScreenFloor.yz,0.);
        // Polished floor: a soft spill and a tighter reflected band at each lit wall.
        vec3 spill=uScreenOn*gap*(left*(.15*exp(-d.x/.75)+.045*exp(-d.x/3.2))+right*(.15*exp(-d.y/.75)+.045*exp(-d.y/3.2)));
        outgoingLight+=spill;}
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>key+'|corridor-screen-floor-v3';
  material.needsUpdate=true;
  return uniforms;
}

type Datum={uScreenSplit:{value:number};uScreenGlass:{value:number}};
/** The thin roof datum crosses the big screen's glass; it is skipped there while the display walls exist. */
function patchDatum(part:Part,start:number){
  const existing=part.material.userData.corridorScreenDatum as Datum|undefined;if(existing)return existing;
  const uniforms:Datum={uScreenSplit:{value:SCREEN_WALL.split},uScreenGlass:{value:0}};part.material.userData.corridorScreenDatum=uniforms;
  const position=part.mesh.geometry.getAttribute('position'),arcs=new Float32Array(position.count);
  for(let i=0;i<position.count;i++)arcs[i]=centreline.project(position.getX(i),position.getZ(i))[0]-start;
  part.mesh.geometry.setAttribute('aScreenArc',new Float32BufferAttribute(arcs,1));
  const compile=part.material.onBeforeCompile,key=part.material.customProgramCacheKey();
  part.material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float aScreenArc;varying float vScreenArc;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvScreenArc=aScreenArc;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vScreenArc;uniform float uScreenSplit,uScreenGlass;')
      .replace('#include <clipping_planes_fragment>','if(vScreenArc>=uScreenSplit&&uScreenGlass>.5)discard;\n#include <clipping_planes_fragment>');
  };
  part.material.customProgramCacheKey=()=>key+'|corridor-screen-datum-v2';
  part.material.needsUpdate=true;
  return uniforms;
}

/** Bottom-edge polyline of a wall, as [arc, x, z] sorted by arc. */
function wallBase(geometry:BufferGeometry){
  const position=geometry.getAttribute('position'),seen=new Map<string,[number,number,number]>();
  for(let i=0;i<position.count;i++){
    if(Math.abs(position.getY(i))>.05)continue;
    const x=position.getX(i),z=position.getZ(i),key=x.toFixed(3)+','+z.toFixed(3);
    if(!seen.has(key))seen.set(key,[centreline.project(x,z)[0],x,z]);
  }
  return [...seen.values()].sort((a,b)=>a[0]-b[0]);
}
function baseAt(base:[number,number,number][],arc:number):[number,number]{
  let i=0;while(i<base.length-2&&base[i+1][0]<arc)i++;
  const [a0,x0,z0]=base[i],[a1,x1,z1]=base[i+1],t=Math.max(0,Math.min(1,(arc-a0)/((a1-a0)||1e-9)));
  return [x0+(x1-x0)*t,z0+(z1-z0)*t];
}
function distanceToBase(base:[number,number,number][],x:number,z:number){
  let best=Infinity;
  for(let i=0;i<base.length-1;i++){
    const [,ax,az]=base[i],[,bx,bz]=base[i+1],dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz||1e-9,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len2));
    const rx=x-ax-dx*t,rz=z-az-dz*t;
    best=Math.min(best,rx*rx+rz*rz);
  }
  return Math.sqrt(best);
}

/** Thin anodised mullions between small panels and at the big screen's edge. */
function createMullions(bases:[number,number,number][][],start:number,environment:Texture|null){
  const height=SCREEN_WALL.top-SCREEN_WALL.bottom+.04,geometry=new BoxGeometry(.085,height,.075);geometry.translate(0,height/2,.0375);
  const material=new MeshStandardMaterial({color:'#1a1c1f',metalness:.88,roughness:.3,envMap:environment,envMapIntensity:.9,toneMapped:false});
  const mesh=new InstancedMesh(geometry,material,SCREEN_WALL.smallPanels*2),matrix=new Matrix4(),rotation=new Quaternion(),forward=new Vector3(0,0,1),inward=new Vector3();
  let n=0;
  bases.forEach(base=>{for(let k=1;k<=SCREEN_WALL.smallPanels;k++){
    const arc=start+k*SMALL_PANEL,[x,z]=baseAt(base,arc),[cx,cz]=centreline.point(arc);
    inward.set(cx-x,0,cz-z).normalize();rotation.setFromUnitVectors(forward,inward);
    matrix.compose(new Vector3(x,SCREEN_WALL.bottom-.02,z),rotation,new Vector3(1,1,1));mesh.setMatrixAt(n++,matrix);
  }});
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.name='Corridor screen mullions';
  return mesh;
}

/** Display-glass walls on the two corridor walls (plain meshes, no bake texture), the floor spill and their shared panel state. */
export function createCorridorScreens(parts:Map<string,Part>,textures:[Texture,Texture],environment:Texture|null,quality:string,inkMaps:Texture[]=[]){
  const walls=WALLS.map(item=>parts.get(item));
  if(walls.some(part=>!part))return null;
  const bases=walls.map(part=>wallBase(part!.mesh.geometry));
  let start=Infinity,end=-Infinity;
  const wallArcs=walls.map(part=>{
    const position=part!.mesh.geometry.getAttribute('position'),arcs=new Float64Array(position.count);
    for(let i=0;i<position.count;i++){
      const arc=centreline.project(position.getX(i),position.getZ(i))[0];
      arcs[i]=arc;start=Math.min(start,arc);end=Math.max(end,arc);
    }
    return arcs;
  });
  const count=SCREEN_COUNT,panels=createScreenPanels(count);
  const panelTexture=new DataTexture(panels.values,count,2,RedFormat,FloatType);panelTexture.minFilter=panelTexture.magFilter=NearestFilter;panelTexture.needsUpdate=true;
  const shared=sharedUniforms(panelTexture,count);shared.uScreenEnd.value=end-start;
  const[rough,normal]=textures.map(texture=>{const copy=texture.clone();copy.wrapS=copy.wrapT=RepeatWrapping;copy.needsUpdate=true;return copy;});
  const owned:{dispose():void}[]=[panelTexture,rough,normal];
  const inks=[0,1].map(side=>{
    const [map,map2]=[inkMaps[side],inkMaps[side+2]].map(source=>{
      const copy=source?source.clone():null;
      if(copy){copy.anisotropy=8;copy.needsUpdate=true;owned.push(copy);}
      return copy;
    });
    return {uScreenInk:{value:map},uScreenInk2:{value:map2},uScreenInkOn:{value:map?1:0},uScreenInkSection:{value:new Vector3(...SCREEN_INK.section[side])},
      uScreenInkSection2:{value:map2?new Vector3(...SCREEN_INK.section2[side]):new Vector3(-10,-10,-10)},uScreenInkStretch:{value:SCREEN_INK.stretch[side] as number},uScreenInkFlip:{value:SCREEN_INK.flip[side] as number}};
  });
  const screens=walls.map((part,side)=>{
    const {mesh:plain}=part!,geometry=plain.geometry,arcs=Float32Array.from(wallArcs[side],arc=>arc-start);
    geometry.setAttribute('aScreenArc',new Float32BufferAttribute(arcs,1));
    const material=new MeshPhysicalMaterial({color:'white',roughness:.1,metalness:0,clearcoat:quality==='mobile'?0:1,clearcoatRoughness:.04,ior:1.5,specularIntensity:1,envMap:environment,envMapIntensity:.8,side:(plain.material as Material).side as Side,toneMapped:false});
    patchGlass(material,shared,side,rough,normal,quality!=='mobile',inks[side]);
    const mesh=new Mesh(geometry,material);mesh.name=`${WALLS[side]} | display glass`;
    plain.visible=false;
    owned.push(material);
    return {mesh,plain};
  });
  const floor=parts.get('corridor-floor');let floorUniforms:Shared|null=null;
  if(floor){
    const position=floor.mesh.geometry.getAttribute('position'),data=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);data[i*3]=centreline.project(x,z)[0]-start;data[i*3+1]=distanceToBase(bases[0],x,z);data[i*3+2]=distanceToBase(bases[1],x,z);}
    floor.mesh.geometry.setAttribute('aScreenFloor',new Float32BufferAttribute(data,3));
    floorUniforms=patchFloor(floor.material,shared);
  }
  const datumPart=parts.get('corridor-roof-datums'),datum=datumPart?patchDatum(datumPart,start):null;
  if(datum)datum.uScreenGlass.value=1;
  const mullions=createMullions(bases,start,environment);owned.push(mullions.geometry,mullions.material as Material);
  return {
    start,panels,objects:[...screens.map(screen=>screen.mesh),mullions],
    centreline,
    /** Diagnostics: the inner wall's ink pre-stretch (1 = none), for before/after review. */
    inkStretch(value:number){inks[1].uScreenInkStretch.value=value;},
    /** Apply this frame's panel values and the closing as the camera leaves the corridor. */
    apply(off:number){
      if(panels.dirty){panelTexture.needsUpdate=true;panels.clean();}
      shared.uScreenOff.value=off;
      // Set each frame: a remount (React dev double-mount) runs dispose, which shows the plain meshes again.
      screens.forEach(screen=>{screen.mesh.visible=true;screen.plain.visible=false;});
      if(datum)datum.uScreenGlass.value=1;
      if(floorUniforms){floorUniforms.uScreenPanels.value=panelTexture;floorUniforms.uScreenCount.value=count;floorUniforms.uScreenEnd.value=shared.uScreenEnd.value;floorUniforms.uScreenOff.value=off;}
    },
    dispose(){screens.forEach(screen=>{screen.plain.visible=true;});if(datum)datum.uScreenGlass.value=0;owned.forEach(item=>item.dispose());},
  };
}
export type CorridorScreens=NonNullable<ReturnType<typeof createCorridorScreens>>;
