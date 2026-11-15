import {BackSide,BufferAttribute,GLSL3,Group,InstancedBufferAttribute,InstancedBufferGeometry,Mesh,ShaderMaterial,SphereGeometry,Vector2,Vector3} from 'three';
import type {EffectQuality} from '../effect-quality';

export const DEPTH_COUNTS={desktop:{near:240,far:2880},laptop:{near:160,far:1920},mobile:{near:80,far:960}} as const;
export const STAR_RANGE={start:40,end:140} as const;
// The authored translation between the two stops is tiny against this range.
// Make its parallax readable, while retaining full camera rotation and still
// moving much more slowly than the nearby 1.2–5-unit grains. No lag/clock.
export const STAR_PARALLAX_GAIN=4;
/** One faint galactic band, fixed in world space and shared by the dome glow and the distant star layout.
 *  Heading-relative [azimuth, elevation] (radians): its brightest clouds sit in View 1's open upper-right sky,
 *  and the band arcs over the top of that view; View 2 sees its lower reach. */
export const SKY_BAND={core:[.86,.40],through:[1.72,.86],width:.17} as const;
/** Display-space (sRGB) strengths for the close-view sky. The dome never draws in the final eye. */
export const SKY_LOOK={zenith:.55,glow:.14,lanes:.75,dust:.64,cell:.0032} as const;
/** Dome tessellation. Every smooth sky term (horizon glow, zenith, band clouds and lane path) is evaluated
 *  per vertex at this spacing (~5.6° x 2.9°); per pixel the dome adds only the lane profile and star dust.
 *  Measured: 128x56 and 96x40 look the same (horizon within 1/255) but cost more; per-pixel clouds cost ~3x. */
export const SKY_DOME_SEGMENTS=[64,32] as const;
/** Unit vectors of the band: pole (band latitude = dot with pole), core (brightest point) and side. */
export function skyBandFrame(heading:number){
  const direction=(azimuth:number,elevation:number)=>new Vector3(Math.sin(azimuth+heading)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth+heading)*Math.cos(elevation));
  const core=direction(SKY_BAND.core[0],SKY_BAND.core[1]),through=direction(SKY_BAND.through[0],SKY_BAND.through[1]);
  const pole=new Vector3().crossVectors(core,through).normalize();
  return {pole,core,side:new Vector3().crossVectors(pole,core).normalize()};
}
const glslFloat=(value:number)=>Number.isInteger(value)?`${value}.`:`${value}`;
const SKY_HASH=/* glsl */`float skyHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}`;
/** A faint distant horizon, without adding lights or changing room materials. The same single draw also
 *  deepens the zenith and carries the galactic band (soft clouds, broken dark lanes, unresolved star dust). */
function createStarAtmosphere(origin:Vector3,radius:number,heading:number){
  const geometry=new SphereGeometry(radius,SKY_DOME_SEGMENTS[0],SKY_DOME_SEGMENTS[1],0,Math.PI*2,0,Math.PI*.52);
  // The shaders read positions only.
  geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');
  const band=skyBandFrame(heading);
  const material=new ShaderMaterial({glslVersion:GLSL3,side:BackSide,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
    uniforms:{uOpacity:{value:0},uHeading:{value:heading},uBandPole:{value:band.pole},uBandCore:{value:band.core},uBandSide:{value:band.side}},
    vertexShader:/* glsl */`
      precision highp float;
      uniform float uHeading;
      uniform vec3 uBandPole,uBandCore,uBandSide;
      out vec4 vHorizon;   // approved horizon glow: display-space colour, alpha
      out vec4 vGlow;      // band glow before lanes, lane path, lane breakup, dust density before lanes
      out vec3 vBandSky;   // zenith deepening, core tint weight, band-region flag
      out vec2 vBand;      // along the band (0 at its core), band latitude
      ${SKY_HASH}
      float skyNoise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(skyHash(i),skyHash(i+vec2(1.,0.)),f.x),mix(skyHash(i+vec2(0.,1.)),skyHash(i+vec2(1.,1.)),f.x),f.y);
      }
      void main(){
        vec3 direction=normalize(position);
        float elevation=asin(clamp(direction.y,-1.,1.));
        // Two regions of one world-space sky: the turn reveals another colour,
        // rather than switching a screen overlay when the camera changes phase.
        float azimuth=atan(direction.x,direction.z)-uHeading;
        float turned=exp((cos(azimuth-.02)-1.)*3.8);
        float centre=mix(.045,.16,turned),width=mix(.18,.25,turned);
        float band=exp(-pow((elevation-centre)/width,2.))*smoothstep(-.08,.025,elevation);
        float low=exp(-pow((elevation-.035)/.105,2.));
        float variation=.93+.07*sin(azimuth*2.3+.4);
        vec3 upper=mix(vec3(.085,.105,.19),vec3(.16,.105,.27),turned);
        vec3 horizon=mix(vec3(.20,.17,.145)*1.5,vec3(.10,.18,.23),turned);
        vec3 colour=mix(upper,horizon,low*.8);
        float teal=turned*exp((cos(azimuth-.45)-1.)*4.5)*exp(-pow((elevation-.14)/.22,2.));
        colour=mix(colour,vec3(.065,.23,.22)*1.5,teal*.8);
        // Square-root display encoding: the approved colour round-trips exactly where it is the only layer.
        vHorizon=vec4(sqrt(colour),mix(.17,.23,turned)*band*variation);
        // The galactic band. Its seam lies behind both views, below the horizon.
        float latitude=dot(direction,uBandPole);
        vBand=vec2(atan(dot(direction,uBandSide),dot(direction,uBandCore)),latitude);
        float profile=exp(-pow(latitude/${glslFloat(SKY_BAND.width)},2.));
        float core=exp(-pow(vBand.x/.62,2.));
        float clouds=skyNoise(vBand*vec2(2.7,7.4)+vec2(3.1,.7))*.62+skyNoise(vBand*vec2(6.1,12.)+vec2(9.7,4.2))*.38;
        float lanePath=latitude-.035*sin(vBand.x*5.3+1.1)-.02*sin(vBand.x*11.7);
        float breakup=smoothstep(.25,.7,skyNoise(vec2(vBand.x*6.5+5.,latitude*6.+2.)));
        vGlow=vec4(profile*(.42+.58*core)*smoothstep(.15,.85,clouds)*${glslFloat(SKY_LOOK.glow)},lanePath,breakup,
          profile*(.14+.26*core)*(.25+1.2*clouds*clouds));
        vBandSky=vec3(${glslFloat(SKY_LOOK.zenith)}*smoothstep(.28,1.22,elevation),core*.85,abs(latitude)<.41&&elevation>-.07?1.:0.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        // Background depth retains camera clipping and foreground occlusion.
        gl_Position.z=gl_Position.w*.9999998;
      }`,
    fragmentShader:/* glsl */`
      precision highp float;
      uniform float uOpacity;
      in vec4 vHorizon,vGlow;
      in vec3 vBandSky;
      in vec2 vBand;
      out vec4 fragmentColour;
      ${SKY_HASH}
      void main(){
        // Screen footprint for filtering the star dust; taken in uniform control flow.
        float footprint=length(fwidth(vBand));
        // Layers composite over the framebuffer in an approximate display space.
        // 1. The open sky deepens toward the zenith; the slate mid-sky and horizon stay as approved.
        vec3 premultiplied=vec3(.016,.021,.036)*vBandSky.x;float coverage=vBandSky.x;
        // 2. The approved horizon glow.
        premultiplied=vHorizon.rgb*vHorizon.a+premultiplied*(1.-vHorizon.a);coverage=vHorizon.a+coverage*(1.-vHorizon.a);
        // 3. The galactic band: soft clouds cut by broken dark lanes, then unresolved star dust.
        if(vBandSky.z>.5){
          float lane=exp(-pow(vGlow.y/${glslFloat(+(SKY_BAND.width*.3).toFixed(4))},2.))*vGlow.z;
          float glow=vGlow.x*(1.-${glslFloat(SKY_LOOK.lanes)}*lane);
          vec3 tint=mix(vec3(.56,.62,.76),vec3(.72,.68,.63),vBandSky.y);
          premultiplied=tint*glow+premultiplied*(1.-glow);coverage=glow+coverage*(1.-glow);
          // One pixel-filtered point per occupied cell, clumped with the clouds and mostly very faint.
          vec2 cell=vBand/${glslFloat(SKY_LOOK.cell)},id=floor(cell);
          float density=vGlow.w*(1.-.8*lane),presence=skyHash(id);
          if(presence<density){
            vec2 offset=fract(cell)-(.2+.6*vec2(skyHash(id+19.19),skyHash(id+47.47)));
            float sigma=max(.42*footprint/${glslFloat(SKY_LOOK.cell)},.02);
            float dust=exp(-dot(offset,offset)/(2.*sigma*sigma))*(.08+.8*pow(1.-presence/density,5.))*${glslFloat(SKY_LOOK.dust)};
            premultiplied=vec3(.86,.89,.96)*dust+premultiplied*(1.-dust);coverage=dust+coverage*(1.-dust);
          }
        }
        vec3 display=premultiplied/max(coverage,.0001);
        fragmentColour=vec4(display*display,coverage*uOpacity);
        #define gl_FragColor fragmentColour
        #include <colorspace_fragment>
      }`});
  const mesh=new Mesh(geometry,material);mesh.position.copy(origin);mesh.frustumCulled=false;mesh.renderOrder=6;
  mesh.name='Logo eye — distant horizon atmosphere';mesh.userData.excludeFromMirror=true;
  return {mesh,geometry,material};
}
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
/** Follow the existing camera's travelled distance; never change its timing or pose. */
export function depthLayerVisibility(phase:string,stage:string,travelFraction:number){
  if(phase!=='logoReveal'||stage==='done')return 0;
  return stage==='pullback'?1-smooth((travelFraction-.015)/.205):1;
}
export type DepthLayout={count:number;origin:Vector3;heading:number;positions:Float32Array;details:Float32Array;appearance:Float32Array};
// Distant stars cover both views' whole sky, area-uniform in elevation (View 1 looks up to ~.93 rad).
const STAR_SKY={azimuth:[-1.05,2.75],elevation:[-.025,1.02]} as const;
// The fixed distant count gathers inside the two close views' frames (heading-relative, measured for 16:10–21:9
// screens): View 1's top edge dips toward its corners; View 2 carries the camera roll. The sky seen only during
// the turn keeps a sparse field.
const STAR_ELSEWHERE=.1;
const inRange=(value:number,low:number,high:number,soft:number)=>smooth((value-low)/soft+.5)*smooth((high-value)/soft+.5);
const starViewWeight=(azimuth:number,elevation:number)=>Math.max(STAR_ELSEWHERE,
  .78*inRange(azimuth,.2,2.6,.15)*inRange(elevation,-.1,.95-.31*(azimuth-1.39)**2,.08),
  inRange(azimuth,-.75,.75,.15)*inRange(elevation-(.05-.33*azimuth),-.33,.33,.08));

/** Fixed world-space grains above the roof, shared by both travelling views. */
export function createDepthLayout(quality:EffectQuality,origin:Vector3,heading:number,unit:number):DepthLayout{
  const counts=DEPTH_COUNTS[quality],count=counts.near+counts.far;
  const positions=new Float32Array(count*3),details=new Float32Array(count*4),appearance=new Float32Array(count*3);
  const band=skyBandFrame(heading),lowSky=Math.sin(STAR_SKY.elevation[0]),highSky=Math.sin(STAR_SKY.elevation[1]);
  let offset=0;
  // Transparent instances do not write depth: submit the distant stars first,
  // then the nearby grains, so a background point cannot paint over a grain.
  for(const distant of [true,false]){
    let seed=distant?0x62ae37d1:0x193abf72;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const occupied=new Map<string,[number,number][]>(),spacing=distant?.010:.025;
    const wanted=distant?counts.far:counts.near;
    for(let i=0;i<wanted;){
      const azimuth=distant?STAR_SKY.azimuth[0]+random()*(STAR_SKY.azimuth[1]-STAR_SKY.azimuth[0]):-.98+random()*3.35;
      const elevation=distant?Math.asin(lowSky+random()*(highSky-lowSky)):.025+Math.pow(random(),1.6)*.31;
      // Broad variations in density leave natural open pockets; distant stars also gather along the galactic band.
      const pocket=(a:number,e:number,w:number,h:number)=>Math.exp(-(((azimuth-a)/w)**2+((elevation-e)/h)**2));
      let density=.72+.28*Math.sin(azimuth*4.1+Math.sin(elevation*11))*Math.cos(elevation*4.5-azimuth);
      if(distant){
        const yaw=heading+azimuth,x=Math.sin(yaw)*Math.cos(elevation),y=Math.sin(elevation),z=Math.cos(yaw)*Math.cos(elevation);
        const latitude=x*band.pole.x+y*band.pole.y+z*band.pole.z;
        const along=Math.atan2(x*band.side.x+y*band.side.y+z*band.side.z,x*band.core.x+y*band.core.y+z*band.core.z);
        const galaxy=Math.exp(-((latitude/(SKY_BAND.width*1.2))**2))*(.55+.45*Math.exp(-((along/.9)**2)))*(.72+.28*Math.sin(along*7.3+latitude*19));
        density=(.17+.52*galaxy+.75*pocket(.08,.19,.45,.20)+.38*pocket(1.35,.24,.50,.22)+.18*pocket(-.55,.42,.26,.15))*starViewWeight(azimuth,elevation);
      }
      if(random()>density)continue;
      const gx=Math.floor(azimuth/spacing),gy=Math.floor(elevation/spacing);
      let overlaps=false;
      for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
        for(const p of occupied.get(`${x},${y}`)??[])if(Math.hypot(p[0]-azimuth,p[1]-elevation)<spacing)overlaps=true;
      }
      if(overlaps)continue;
      const key=`${gx},${gy}`,bucket=occupied.get(key)??[];bucket.push([azimuth,elevation]);occupied.set(key,bucket);
      const distance=unit*(distant?STAR_RANGE.start+random()*(STAR_RANGE.end-STAR_RANGE.start):1.2+random()*3.8),yaw=heading+azimuth;
      positions.set([origin.x+Math.sin(yaw)*Math.cos(elevation)*distance,origin.y+Math.sin(elevation)*distance,origin.z+Math.cos(yaw)*Math.cos(elevation)*distance],offset*3);
      const rare=random()>.96,tone=rare?7:3+Math.floor(random()*4);
      const size=random();
      const radius=unit*(distant?.006+.040*Math.pow(size,2.6):.0012+.003*size);
      details.set([radius,tone+8*Math.floor(random()*8),.65+.35*random(),random()*Math.PI*2],offset*4);
      if(distant){
        const magnitude=(Math.fround(radius)/unit-.006)/.040;
        appearance.set([.50+.48*magnitude,1.35+7.6*Math.pow(Math.max(0,magnitude),1.35),1],offset*3);
      }
      else appearance.set([rare?.88:.28+.36*random(),rare?1.9:1.05+.55*random(),0],offset*3);
      i++;offset++;
    }
  }
  return {count,origin:origin.clone(),heading,positions,details,appearance};
}

const vertexShader=/* glsl */`
precision highp float;
uniform float uOpacity,uTime,uMotion,uUnit,uPadding,uViewportHeight,uDpr,uStarParallax,uPhoneStar;
uniform vec3 uOrigin;
in vec2 corner;
in vec3 grainPosition,appearance;
in vec4 detail;
out vec2 vUV;
out float vCoverage;
out vec3 vLighting;
out vec2 vStarUV;
out float vDistant;
void main(){
  vec3 centre=grainPosition;
  float seed=fract(sin(dot(grainPosition,vec3(.1271,.3117,.0747)))*43758.5453);
  float nearAmount=(1.-appearance.z)*uMotion;
  centre.x+=sin(uTime*.16+seed*6.283185)*uUnit*.006*nearAmount;
  centre.y+=sin(uTime*.11+seed*9.3)*uUnit*.003*nearAmount;
  vec4 view=modelViewMatrix*vec4(centre,1.);
  float px=detail.x*projectionMatrix[1][1]*.5*uViewportHeight/max(.01,-view.z);
  float starMinimum=mix(.40,.68,uPhoneStar),starMaximum=mix(.90,1.12,uPhoneStar);
  float displayPx=clamp(px,mix(.55,starMinimum,appearance.z)*uDpr,mix(1.65,starMaximum,appearance.z)*uDpr);
  float footprint=displayPx/max(px,.001);
  mat2 rotation=mat2(cos(detail.w),sin(detail.w),-sin(detail.w),cos(detail.w));
  // Only the brightest stars get a wider quad, for a soft glow; every other sprite keeps its footprint.
  float reach=mix(3.5,6.,smoothstep(6.4,8.9,appearance.y)*appearance.z);
  if(appearance.z>.5)view.xy+=corner*detail.x*reach*footprint;
  else view.xy+=rotation*(corner*vec2(detail.x,detail.x*detail.z)*uPadding*footprint);
  gl_Position=projectionMatrix*view;
  if(appearance.z>.5){
    // Shift only the projected centre. Preserve the original sprite footprint,
    // coverage, size/brightness hierarchy and intrinsic star coordinates.
    vec4 centreView=modelViewMatrix*vec4(centre,1.);
    vec3 originWorld=(modelMatrix*vec4(uOrigin,1.)).xyz;
    vec3 translation=mat3(viewMatrix)*(originWorld-cameraPosition)*(uStarParallax-1.);
    vec4 shiftedView=centreView+vec4(translation,0.);
    if(centreView.z<-.1&&shiftedView.z<-.1){
      vec4 originalClip=projectionMatrix*centreView;
      vec4 shiftedClip=projectionMatrix*shiftedView;
      gl_Position.xy+=(shiftedClip.xy/shiftedClip.w-originalClip.xy/originalClip.w)*gl_Position.w;
      gl_Position.z=gl_Position.w*.999999;
    }else gl_Position=vec4(2.,2.,2.,1.);
  }
  if(view.z>=-.1)gl_Position=vec4(2.,2.,2.,1.);
  vUV=(vec2(mod(detail.y,8.),floor(detail.y/8.))+vec2(corner.x*.5+.5,.5-corner.y*.5))/8.;
  float coverageScale=max(1.,footprint);
  vCoverage=uOpacity*appearance.x/(coverageScale*coverageScale);
  vLighting=vec3(appearance.y);
  vStarUV=corner*reach;vDistant=appearance.z;
  if(appearance.z>.5){
    float hue=mod(detail.y,8.)/7.;
    vec3 spectral=hue<.78?mix(vec3(.60,.74,1.),vec3(.96,.98,1.),hue/.78):mix(vec3(.96,.98,1.),vec3(1.,.80,.60),(hue-.78)/.22);
    vLighting=spectral*appearance.y;
    float minimum=mix(.55,.85,uPhoneStar);
    vCoverage=uOpacity*appearance.x*mix(minimum,1.,clamp(px/(.7*uDpr),0.,1.));
    // A quieter lower sky separates remote points from the close grain fringe.
    // Use the fixed world horizon, so the transition follows both camera views.
    vec3 direction=normalize(grainPosition-uOrigin);
    float elevation=asin(clamp(direction.y,-1.,1.));
    vCoverage*=mix(.25,1.,smoothstep(.025,.18,elevation));
  }
}`;

export function createDepthField(data:DepthLayout,unit:number,padding:number,fragmentShader:string,mobile=false){
  const starFragment=fragmentShader.replace('in float vHeroWave;','const float vHeroWave=0.;')
    .replace('in float vHeroSpark;','const float vHeroSpark=0.;')
    .replace('in float vHeroWake;','const float vHeroWake=0.;')
    .replace('in vec2 vHeroLocal;','const vec2 vHeroLocal=vec2(0.);')
    .replace('in vec3 vHeroDirection;','const vec3 vHeroDirection=vec3(0.,1.,.5);')
    .replace('in vec2 vUV;','in vec2 vUV;\nin vec2 vStarUV;\nin float vDistant;')
    .replace('void main(){',/* glsl */`
    void main(){
      if(vDistant>.5){
        float r2=dot(vStarUV,vStarUV);
        vec2 pixel=fwidth(vStarUV);
        // Pixel-filtered luminous centres; only the stronger stars get a halo.
        // Keep the steel highlight shoulder exclusive to the nearby grains.
        float variance=.16+dot(pixel,pixel)/24.;
        float core=exp(-r2/(2.*variance))*.16/variance;
        float strength=max(vLighting.r,max(vLighting.g,vLighting.b));
        float halo=exp(-r2*.9)*.025*smoothstep(3.,8.,strength);
        // The few brightest stars also carry a wide soft glow (static; no twinkle animation).
        float glow=exp(-r2*.11)*.014*smoothstep(6.4,8.9,strength);
        float alpha=(1.-exp(-(core+halo+glow)*strength))*vCoverage;
        if(alpha<.006)discard;
        fragmentColour=vec4(vLighting/strength,alpha);
        #define gl_FragColor fragmentColour
        #include <colorspace_fragment>
        #undef gl_FragColor
        return;
      }`);
  const geometry=new InstancedBufferGeometry();
  geometry.setAttribute('corner',new BufferAttribute(new Float32Array([-1,-1,1,-1,1,1,-1,1]),2));geometry.setIndex([0,1,2,0,2,3]);
  geometry.setAttribute('grainPosition',new InstancedBufferAttribute(data.positions,3));
  geometry.setAttribute('detail',new InstancedBufferAttribute(data.details,4));
  geometry.setAttribute('appearance',new InstancedBufferAttribute(data.appearance,3));geometry.instanceCount=data.count;
  const material=new ShaderMaterial({glslVersion:GLSL3,vertexShader,fragmentShader:starFragment,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
    uniforms:{uAtlas:{value:null},uOpacity:{value:0},uTime:{value:0},uMotion:{value:0},uUnit:{value:unit},uPadding:{value:padding},uViewportHeight:{value:720},uDpr:{value:1},uOrigin:{value:data.origin.clone()},uStarParallax:{value:STAR_PARALLAX_GAIN},uPhoneStar:{value:mobile?1:0}}});
  const mesh=new Mesh(geometry,material),pixels=new Vector2();
  mesh.name='Logo eye — sparse depth grains';mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=7;mesh.userData.excludeFromMirror=true;
  mesh.onBeforeRender=renderer=>{material.uniforms.uViewportHeight.value=renderer.getDrawingBufferSize(pixels).y;material.uniforms.uDpr.value=renderer.getPixelRatio();};
  const haze=createStarAtmosphere(data.origin,unit*STAR_RANGE.start,data.heading),root=new Group();root.add(haze.mesh,mesh);
  return {root,mesh,geometry,material,haze};
}
