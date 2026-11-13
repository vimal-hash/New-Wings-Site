import {BoxGeometry,BufferGeometry,DataTexture,DoubleSide,Float32BufferAttribute,FloatType,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,NearestFilter,Quaternion,RedFormat,RepeatWrapping,ShaderMaterial,Vector2,Vector3,type Material,type Side,type Texture} from 'three';
import route from './scene-route.json';
import {createArcProjector,createDisplayPower,createScreenPanels,FEATURE_DISPLAYS,SCREEN_COUNT,SCREEN_WALL,SMALL_PANEL} from './corridor-screen-state';

export const SCREEN_GLASS_TEXTURES=['/textures/corridor/screen-glass/screen-glass-roughness.png','/textures/corridor/screen-glass/screen-glass-normal.png'];
const WALLS=['corridor-wall-red','corridor-wall-connecting'] as const;
const centreline=createArcProjector(route.samples.map(sample=>[sample.position[0],sample.position[2]] as const));

type Part={mesh:Mesh;material:Material};
/** Shared uniforms: one object per value, referenced by every screen program. */
function sharedUniforms(panels:DataTexture,count:number){
  return {uScreenPanels:{value:panels},uScreenCount:{value:count},uScreenSmall:{value:SMALL_PANEL},uScreenSplit:{value:SCREEN_WALL.split as number},uScreenEnd:{value:SCREEN_WALL.split+1},
    uScreenBottom:{value:SCREEN_WALL.bottom},uScreenTop:{value:SCREEN_WALL.top},uScreenLitTop:{value:SCREEN_WALL.litTop},
    uScreenOff:{value:0},uScreenBaked:{value:0},uScreenOn:{value:new Vector3(.95,.98,1)}};
}
type Shared=ReturnType<typeof sharedUniforms>;

/** Small panels beside the projector floor, then one big screen per wall (the last texel). */
const PANEL_GLSL=/* glsl */`
uniform sampler2D uScreenPanels;uniform float uScreenCount,uScreenSmall,uScreenSplit,uScreenEnd,uScreenBottom,uScreenTop,uScreenLitTop,uScreenOff;uniform vec3 uScreenOn;
float screenIndex(float arc){return arc<uScreenSplit?clamp(floor(arc/uScreenSmall),0.,uScreenCount-2.):uScreenCount-1.;}
float screenPanel(float arc,float side){
  return texelFetch(uScreenPanels,ivec2(int(screenIndex(arc)),int(side)),0).r*(1.-uScreenOff);
}
/** Position across the current screen, 0..1. */
float screenAcross(float arc){return arc<uScreenSplit?fract(arc/uScreenSmall):clamp((arc-uScreenSplit)/(uScreenEnd-uScreenSplit),0.,1.);}
/** Soft dark seam at each small panel edge; the big screen only meets the boundary mullion. */
float screenSeam(float arc,float u,float width){return arc<uScreenSplit?smoothstep(0.,width,u)*smoothstep(1.,1.-width,u):smoothstep(0.,.15,arc-uScreenSplit);}`;

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

function patchGlass(material:MeshPhysicalMaterial,shared:Shared,side:number,baked:{value:Texture|null},rough:Texture,normal:Texture,clearcoat:boolean){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,shared,{uScreenSide:{value:side},uScreenBakedMap:baked,uScreenRough:{value:rough},uScreenNormal:{value:normal}});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float aScreenArc;varying float vScreenArc;varying vec3 vScreenWorld;varying vec2 vScreenBakedUv;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvScreenArc=aScreenArc;vScreenWorld=(modelMatrix*vec4(transformed,1.)).xyz;vScreenBakedUv=uv;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>\nvarying float vScreenArc;varying vec3 vScreenWorld;varying vec2 vScreenBakedUv;uniform float uScreenSide,uScreenBaked;uniform sampler2D uScreenBakedMap,uScreenRough,uScreenNormal;${PANEL_GLSL}${OPENING_GLSL}`)
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
        diffuseColor.rgb*=1.-.75*min(1.,screenLit)*screenGlass;`)
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>\n${clearcoat?'material.clearcoat*=screenGlass;material.clearcoatRoughness=mix(.3,.02+.06*screenSmudge,screenGlass);':''}`)
      .replace('#include <opaque_fragment>','outgoingLight=mix(outgoingLight,texture2D(uScreenBakedMap,vScreenBakedUv).rgb,uScreenBaked);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>`corridor-screen-glass-v2|${clearcoat}`;
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
  material.customProgramCacheKey=()=>key+'|corridor-screen-floor-v2';
  material.needsUpdate=true;
  return uniforms;
}

type Datum={uScreenSplit:{value:number};uScreenBaked:{value:number}};
/** The thin roof datum crosses the big screen's glass; it is skipped there until the baked walls return. */
function patchDatum(part:Part,start:number){
  const existing=part.material.userData.corridorScreenDatum as Datum|undefined;if(existing)return existing;
  const uniforms:Datum={uScreenSplit:{value:SCREEN_WALL.split},uScreenBaked:{value:1}};part.material.userData.corridorScreenDatum=uniforms;
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
      .replace('#include <common>','#include <common>\nvarying float vScreenArc;uniform float uScreenSplit,uScreenBaked;')
      .replace('#include <clipping_planes_fragment>','if(vScreenArc>=uScreenSplit&&uScreenBaked<.5)discard;\n#include <clipping_planes_fragment>');
  };
  part.material.customProgramCacheKey=()=>key+'|corridor-screen-datum-v1';
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

/** Thin anodised mullions between small panels and at the big screen's edge; they sink into the wall as the baked wall returns. */
function createMullions(bases:[number,number,number][][],start:number,sink:{value:number},environment:Texture|null){
  const height=SCREEN_WALL.top-SCREEN_WALL.bottom+.04,geometry=new BoxGeometry(.085,height,.075);geometry.translate(0,height/2,.0375);
  const material=new MeshStandardMaterial({color:'#1a1c1f',metalness:.88,roughness:.3,envMap:environment,envMapIntensity:.9,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uScreenSink=sink;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uScreenSink;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z*=1.-uScreenSink;');
  };
  material.customProgramCacheKey=()=>'corridor-screen-mullion-v1';
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

/** Feature display: a black screen on the lit wall, floor to lit top, showing its film (opaque, rendered from
 *  the stop's eye) and revealed with the same centre-line opening as the panels. Its backdrop twin is drawn
 *  first in the lens view, so through the glasses the 3D film fully replaces the 2D one. */
const DISPLAY_VERTEX=/* glsl */`attribute vec2 aLocal;varying vec2 vLocal;void main(){vLocal=aLocal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const DISPLAY_FRAGMENT=/* glsl */`uniform float uPower,uOff,uBezel,uHasContent,uFlipX;uniform vec2 uSize;uniform sampler2D uContent;varying vec2 vLocal;
${OPENING_GLSL}
void main(){
  vec2 q=abs(vLocal);
  if(uHasContent<.5||q.x>uSize.x*.5||q.y>uSize.y*.5)discard;
  vec2 uv=vLocal/uSize+.5;uv.x=mix(uv.x,1.-uv.x,uFlipX);
  // The film arrives premultiplied over an opaque black clear.
  vec4 film=texture2D(uContent,uv)*min(1.,screenOpening(uPower*(1.-uOff),q.y,uSize.y));
  if(film.a<.004)discard;
  gl_FragColor=vec4(film.rgb/film.a,film.a);
  #include <colorspace_fragment>
  gl_FragColor.rgb*=gl_FragColor.a;
}`;
const BACKDROP_FRAGMENT=/* glsl */`uniform float uPower,uOff;uniform vec2 uSize;varying vec2 vLocal;
${OPENING_GLSL}
void main(){
  vec2 q=abs(vLocal);
  if(q.x>uSize.x*.5||q.y>uSize.y*.5)discard;
  float a=min(1.,screenOpening(uPower*(1.-uOff),q.y,uSize.y));
  if(a<.004)discard;
  gl_FragColor=vec4(0.,0.,0.,a);
}`;

function createDisplays(base:[number,number,number][]){
  const owned:{dispose():void}[]=[];
  const displays=FEATURE_DISPLAYS.map((display,k)=>{
    const height=display.top-display.bottom,outer=display.width/2+display.bezel,columns=Math.ceil(outer*2/.5);
    const positions:number[]=[],locals:number[]=[],index:number[]=[];
    for(let i=0;i<=columns;i++){
      const along=-outer+outer*2*i/columns,arc=display.arc+along,[x,z]=baseAt(base,arc),[cx,cz]=centreline.point(arc);
      const inward=Math.hypot(cx-x,cz-z)||1,ox=x+(cx-x)/inward*.04,oz=z+(cz-z)/inward*.04;
      for(const y of [display.bottom-display.bezel,display.top+display.bezel]){positions.push(ox,y,oz);locals.push(along,y-(display.bottom+display.top)/2);}
    }
    for(let i=0;i<columns;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('aLocal',new Float32BufferAttribute(locals,2));geometry.setIndex(index);geometry.computeBoundingSphere();
    const material=new ShaderMaterial({vertexShader:DISPLAY_VERTEX,fragmentShader:DISPLAY_FRAGMENT,side:DoubleSide,toneMapped:false,transparent:true,depthWrite:false,premultipliedAlpha:true,
      uniforms:{uPower:{value:0},uOff:{value:0},uBezel:{value:display.bezel},uSize:{value:new Vector2(display.width,height)},uContent:{value:null as Texture|null},uHasContent:{value:0},uFlipX:{value:0}}});
    const mesh=new Mesh(geometry,material);mesh.name=`Corridor feature display ${k}`;
    const backdropMaterial=new ShaderMaterial({vertexShader:DISPLAY_VERTEX,fragmentShader:BACKDROP_FRAGMENT,side:DoubleSide,toneMapped:false,transparent:true,depthTest:false,depthWrite:false,premultipliedAlpha:true,
      uniforms:{uPower:material.uniforms.uPower,uOff:material.uniforms.uOff,uSize:material.uniforms.uSize}});
    const backdrop=new Mesh(geometry,backdropMaterial);backdrop.name=`Corridor feature display ${k} | lens backdrop`;backdrop.renderOrder=-10;backdrop.frustumCulled=false;
    owned.push(geometry,material,backdropMaterial);
    // The flat window through which its content is seen: centre, inward normal and the along-wall direction.
    const [x,z]=baseAt(base,display.arc),[cx,cz]=centreline.point(display.arc),[x0,z0]=baseAt(base,display.arc-.5),[x1,z1]=baseAt(base,display.arc+.5);
    const normal=new Vector3(cx-x,0,cz-z).normalize(),centre=new Vector3(x,(display.bottom+display.top)/2,z).addScaledVector(normal,.04);
    const frame={centre,normal,along:new Vector3(x1-x0,0,z1-z0).normalize(),width:display.width,height,bottom:display.bottom};
    return {mesh,material,frame,backdrop};
  });
  return {
    meshes:displays.map(display=>display.mesh),
    frames:displays.map(display=>display.frame),
    /** Black twins of the screens, for the lens view only (never added to the main scene). */
    backdrops:displays.map(display=>display.backdrop),
    /** Content texture for display k; `flip` when its rendered right runs against the wall's arc. */
    setContent(k:number,texture:Texture|null,flip:boolean){const uniforms=displays[k].material.uniforms;uniforms.uContent.value=texture;uniforms.uHasContent.value=texture?1:0;uniforms.uFlipX.value=flip?1:0;},
    apply(power:readonly number[],off:number){displays.forEach((display,k)=>{display.material.uniforms.uPower.value=power[k];display.material.uniforms.uOff.value=off;});},
    dispose(){owned.forEach(item=>item.dispose());},
  };
}

/** Display-glass walls over the two corridor wall bakes, the floor spill and their shared panel state. */
export function createCorridorScreens(parts:Map<string,Part>,textures:[Texture,Texture],environment:Texture|null,quality:string){
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
  const screens=walls.map((part,side)=>{
    const {mesh:baked}=part!,geometry=baked.geometry,arcs=Float32Array.from(wallArcs[side],arc=>arc-start);
    geometry.setAttribute('aScreenArc',new Float32BufferAttribute(arcs,1));
    const bakedMap={value:(baked.material as MeshBasicMaterial).map};
    const material=new MeshPhysicalMaterial({color:'white',roughness:.1,metalness:0,clearcoat:quality==='mobile'?0:1,clearcoatRoughness:.04,ior:1.5,specularIntensity:1,envMap:environment,envMapIntensity:.8,side:(baked.material as Material).side as Side,toneMapped:false});
    patchGlass(material,shared,side,bakedMap,rough,normal,quality!=='mobile');
    const mesh=new Mesh(geometry,material);mesh.name=`${WALLS[side]} | display glass`;
    owned.push(material);
    return {mesh,baked,bakedMap,material:baked.material as MeshBasicMaterial};
  });
  const floor=parts.get('corridor-floor');let floorUniforms:Shared|null=null;
  if(floor){
    const position=floor.mesh.geometry.getAttribute('position'),data=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);data[i*3]=centreline.project(x,z)[0]-start;data[i*3+1]=distanceToBase(bases[0],x,z);data[i*3+2]=distanceToBase(bases[1],x,z);}
    floor.mesh.geometry.setAttribute('aScreenFloor',new Float32BufferAttribute(data,3));
    floorUniforms=patchFloor(floor.material,shared);
  }
  const datumPart=parts.get('corridor-roof-datums'),datum=datumPart?patchDatum(datumPart,start):null;
  const sink={value:0},mullions=createMullions(bases,start,sink,environment);owned.push(mullions.geometry,mullions.material as Material);
  const displays=createDisplays(bases[0]),power=createDisplayPower();owned.push(displays);
  return {
    start,panels,objects:[...screens.map(screen=>screen.mesh),mullions,...displays.meshes],
    centreline,displays,power,
    /** Apply this frame's panel values and leave/return transition. */
    apply(off:number,baked:number){
      displays.apply(power.values,off);
      displays.meshes.forEach(mesh=>{mesh.visible=baked<1;});
      if(panels.dirty){panelTexture.needsUpdate=true;panels.clean();}
      shared.uScreenOff.value=off;shared.uScreenBaked.value=baked;sink.value=baked;
      if(floorUniforms){floorUniforms.uScreenPanels.value=panelTexture;floorUniforms.uScreenCount.value=count;floorUniforms.uScreenEnd.value=shared.uScreenEnd.value;floorUniforms.uScreenOff.value=off;}
      if(datum)datum.uScreenBaked.value=baked;
      const showBaked=baked>=1;
      screens.forEach(screen=>{screen.bakedMap.value=screen.material.map;screen.mesh.visible=!showBaked;screen.baked.visible=showBaked;});
      mullions.visible=!showBaked;
    },
    dispose(){screens.forEach(screen=>{screen.baked.visible=true;});if(datum)datum.uScreenBaked.value=1;owned.forEach(item=>item.dispose());},
  };
}
export type CorridorScreens=NonNullable<ReturnType<typeof createCorridorScreens>>;
