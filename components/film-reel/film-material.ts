import { DataTexture, ShaderMaterial, type Texture, Vector2 } from "three";
import { FILM_PRODUCTS, FRAME_PITCH } from "./film-data";
import { WEAR_SPAN } from "./film-wear";

// The film look, made in code. Three small programs: the dark base with its holes and window, the picture and text sheets, and the open holes.
// There is no scene light and no environment map. The film shows two things only: what the room reflects in its gloss, and what the lamp sends through it.
// The section is black and white, so every level is one grey number.

const number = (value: number) => {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.`;
};

// Measured from Frame_1.blend, in frame units (a frame is 2 x 2, centre at 0).
const WINDOW = "vec2(.8915,.7116)"; // half size of the picture window

const VERTEX = `
uniform float uShift;
varying vec2 vUv,vStrip;
varying vec3 vLocal,vWorld,vN,vT,vB;
varying float vFrame,vFront;
void main(){
  vec4 placed=vec4(position,1.);
  #ifdef USE_INSTANCING
    placed=instanceMatrix*placed;
  #endif
  float start=placed.x-position.x+uShift; // where this frame begins along the strip
  vUv=uv;vLocal=position;vStrip=vec2(position.x+start,position.y);vFrame=start/${number(FRAME_PITCH)};
  vec4 world=modelMatrix*placed;vWorld=world.xyz;
  mat3 turn=mat3(modelMatrix);
  vN=turn*normal;vT=turn*vec3(1.,0.,0.);vB=turn*vec3(0.,1.,0.);vFront=normal.z;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;

// The lamp sits behind the gate, one frame wide. It is a little dimmer toward the corners, and a little of it spills past the gate's two ends.
// At the very end the last frame burns up: the lamp runs far past white and its light floods out along the strip.
const LAMP = `
uniform float uLampX,uLamp,uBurn;
varying vec2 vUv,vStrip;
varying vec3 vLocal,vWorld,vN,vT,vB;
varying float vFrame,vFront;
float lampAt(vec2 strip){
  // The light goes with each frame, not with the screen: a frame brightens and dims as a whole as it reaches or leaves the gate,
  // so no edge of light ever slides across a picture. The next frame on the right waits faintly lit.
  float centre=${number(FRAME_PITCH)}*floor(strip.x/${number(FRAME_PITCH)}+.5);
  float d=(centre-uLampX)/${number(FRAME_PITCH)};
  float gate=1.-smoothstep(.06,.94,abs(d)); // an even crossfade: half and half at the midpoint, so the light never dips
  float next=.028*smoothstep(.25,.8,d)*(1.-smoothstep(1.2,1.7,d));
  vec2 q=vec2((strip.x-centre)*.75,strip.y);
  return uLamp*(1.+8.*uBurn*uBurn)*max(gate,next)*(1.-.16*dot(q,q));
}
float floodAt(vec2 strip){return uBurn*uBurn*1.6*exp(-.9*max(0.,abs(strip.x-uLampX)-.9));}`;

const WEAR = `
uniform sampler2D uWear;
// Two copies of the marks at different lengths, one upside down, so the eye finds no repeat. x = scratches, y = dust, z = haze.
vec3 wearAt(vec2 strip){
  vec2 place=vec2(strip.x/${number(WEAR_SPAN)},strip.y*.5+.5);
  vec3 one=texture2D(uWear,place).rgb,two=texture2D(uWear,vec2(strip.x/7.+.37,1.-place.y)).rgb;
  return vec3(max(one.r,two.r*.8),max(one.g,two.g*.7),clamp(one.b+two.b*.6,0.,1.));
}`;

// What the gloss shows. The room is dark and nothing in it has a hard edge: a faint glow up to the left,
// and a wider opening far round to the side that only a strip seen at an angle catches.
const SHINE = `
float glow(vec2 p,vec2 centre,vec2 size){vec2 d=(p-centre)/size;return exp(-dot(d,d));}
float room(vec2 p,float soft){
  return .07*glow(p,vec2(-.55,.4),vec2(.6,.85)+soft)+.45*glow(p,vec2(-1.6,.15),vec2(.45,.7)+soft)+.015;
}
float shineAt(vec3 wear){
  vec2 at=vStrip;
  // Film is never flat: it cups a little across its width and waves gently along its length.
  vec2 tilt=vec2(.011*sin(at.x*1.7+.6)+.006*sin(at.x*4.3+2.1)+.012*at.y*sin(at.x*.9+1.),.038*at.y+.008*sin(at.x*2.6+.4));
  vec3 n=normalize(vN+tilt.x*vT+tilt.y*vB),v=normalize(cameraPosition-vWorld),r=reflect(-v,n);
  vec2 p=r.xy/max(r.z,.25);
  float fresnel=.045+.955*pow(1.-clamp(dot(n,v),0.,1.),5.);
  // A clean surface mirrors the room. A rubbed one blurs it. A scratch or a speck catches a little of whatever light is about.
  return room(p,.15*wear.z)*fresnel*(1.-.3*wear.z)+(room(p,.4)+.05)*(wear.x*.02+wear.y*.012);
}`;

// The old-film look of this section, laid over the finished picture in screen space: a light that wavers, dark corners,
// grain that changes with every film frame, and now and then a thin scratch line running down the picture.
// uFrame counts film frames at 24 a second; uFlicker is the exposure of the current one.
const LOOK = `
uniform vec2 uScreen;
uniform float uFrame,uFlicker,uScratch;
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+1.),f.x),f.y);}
float cornersAt(){
  vec2 d=(gl_FragCoord.xy/uScreen-.5)*vec2(uScreen.x/uScreen.y,1.)*vec2(.8,1.1);
  return 1.-.6*smoothstep(.3,1.08,length(d)); // an oval fall-off, as from an old lens
}
vec3 filmLook(vec3 c){
  c*=uFlicker*cornersAt();
  float seed=mod(floor(uFrame/2.),113.); // grain and dust change twelve times a second; the scratch lines keep the full film rate
  vec2 at=gl_FragCoord.xy;
  // The whole section is the projected film, so even its black is never empty: a little light gets through the densest film,
  // and the grain lives in it. Grain at two sizes, new every frame, strongest in the middle tones.
  float fine=hash12(at+seed*17.31)+hash12(at*1.37+seed*5.13)-1.;
  float clump=hash12(floor(at*.5)+seed*9.71)-.5;
  float tone=dot(c,vec3(.3333));
  c+=.012*uScratch*cornersAt();
  c+=(fine*.6+clump*.45)*(.05+.115*tone*(1.-tone))*mix(.4,1.,uScratch);
  // Uneven density: the emulsion was never quite even, so broad soft patches breathe lighter and darker each frame.
  float mottle=(vnoise(at/230.+vec2(uFrame*.011,uFrame*.007))-.5)+.5*(vnoise(at/90.+vec2(-uFrame*.009,uFrame*.013))-.5);
  c=c*(1.+.045*mottle*uScratch)+.005*mottle*uScratch;
  // Dust on the print: a few specks of different size and shape, somewhere new every frame. Most are dark dirt, some are bright holes in the emulsion.
  vec2 cell=floor(at/41.);
  float speck=hash12(cell+seed*3.71);
  if(speck<.008*uScratch){
    vec2 centre=(cell+.15+.7*vec2(hash12(cell*1.3+seed),hash12(cell.yx+seed*2.1)))*41.;
    float turn=hash12(cell+seed*7.7)*6.283;vec2 d=at-centre;d=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*d;
    float size=.7+3.*hash12(cell+seed*5.9)*hash12(cell+seed*1.9);
    float blot=1.-smoothstep(size*.45,size,length(d*vec2(1.,1.+2.5*hash12(cell+seed*4.4))));
    c+=blot*(speck<.0034*uScratch?.22:-.12);
  }
  // Scratch lines down the whole screen. Three can be about at once; each lasts a fraction of a second, wanders a pixel, and fades in and out along its length.
  // Thin bright lines: emulsion scraped off the film lets the lamp through.
  for(int k=0;k<6;k++){
    float slot=float(k),life=floor(uFrame/(9.+slot*7.)+slot*3.1);
    if(hash12(vec2(life,slot*13.1+1.))>.88*uScratch)continue;
    float x=hash12(vec2(life*.7,slot+4.2))*uScreen.x+(hash12(vec2(uFrame,slot+7.))-.5)*1.4;
    float width=.25+.4*hash12(vec2(life,slot+9.));
    float line=1.-smoothstep(width,width+.7,abs(at.x-x));
    float along=.55+.45*sin(at.y*(.004+.01*hash12(vec2(life,slot+3.)))+life*2.3+sin(at.y*.031+slot));
    c+=line*along*(.11+.16*hash12(vec2(life,slot+5.)))*(.6+.4*hash12(vec2(uFrame,slot+11.)));
  }
  return c;
}`;

const FINISH = `
  #include <colorspace_fragment>
  gl_FragColor.rgb=filmLook(gl_FragColor.rgb);
  gl_FragColor.rgb+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.; // one step of noise, so dark slopes do not band`;

const BASE = `${LAMP}${WEAR}${SHINE}${LOOK}
float box(vec2 p,vec2 size){vec2 d=abs(p)-size;return length(max(d,0.))+min(max(d.x,d.y),0.);}
// Lamp light also creeps a short way into the base round the picture window. The sprocket holes stay dark.
float creepAt(vec2 at){
  float near=max(0.,box(at,${WINDOW}));
  return .05*exp(-near/.012)+.012*exp(-near/.07);
}
void main(){
  float front=step(.5,vFront);
  vec3 wear=wearAt(vStrip)*front;
  float lamp=lampAt(vStrip);
  float level=.0042*(1.+.8*wear.z)+shineAt(wear)*front; // only the face is glossy; the cut edges are seen almost end on and stay dark
  level+=front*lamp*creepAt(vLocal.xy);
  // The cut walls are seen almost end on: only a thin dark edge.
  vec2 at=vLocal.xy;
  level+=(1.-abs(vFront))*step(max(abs(at.x),abs(at.y)),.985)*lamp*.03;
  level+=floodAt(vStrip);
  gl_FragColor=vec4(vec3(level),1.);${FINISH}
}`;

const SHEET = `${LAMP}${WEAR}${SHINE}${LOOK}
uniform sampler2D uMap;
void main(){
  vec3 wear=wearAt(vStrip);
  float lamp=lampAt(vStrip);
  float tone=dot(texture2D(uMap,vUv).rgb,vec3(.2126,.7152,.0722));
  // Unlit, the picture is only a ghost in the room's faint light.
  float level=.0032+.005*tone+shineAt(wear);
  // Lit from behind: dust blocks the light, and a deep scratch through the dark of the picture lets a thin line of it out.
  level+=lamp*(mix(.012,.86,tone)*(1.-.75*wear.y)*(1.-.12*wear.z)+smoothstep(.35,.95,wear.x)*.06*(1.-tone))+floodAt(vStrip);
  gl_FragColor=vec4(vec3(level),1.);${FINISH}
}`;

// The dark the strip hangs in: one screen-filling triangle at the far end of the depth range. It is drawn after the strip and
// depth tested, so it is only shaded where the strip leaves the screen empty (the picture is the same as drawing it first).
// When the last frame burns up, its light blooms out into the dark.
const VOID_VERTEX = `
varying vec2 vScreen;
void main(){vScreen=position.xy;gl_Position=vec4(position.xy,.9999,1.);}`;
const VOID = `${LOOK}
uniform float uBurn,uAspect;
varying vec2 vScreen;
void main(){
  vec2 p=vScreen*vec2(uAspect,1.);
  float glow=uBurn*uBurn*1.6*exp(-dot(p,p)*1.1)+.35*pow(uBurn,4.); // a bloom round the gate first; the room fills only at the very end
  // Stray light from the projector falls on the wall up in one corner: soft and uneven, never a clean circle.
  vec2 corner=p-vec2(-uAspect,1.),squeezed=corner*vec2(.75,1.05);
  float wobble=.85+.15*sin(p.x*2.3+1.1)*sin(p.y*3.1+.4);
  float stray=.03*exp(-dot(squeezed,squeezed)*1.4)*wobble+.009*exp(-dot(corner,corner)*.45);
  gl_FragColor=vec4(vec3(.00152,.00152,.00182)+stray*vec3(1.,1.,1.04)+glow,1.);
  // A brighter, whiter spill low on the right, half as strong again as the one above, and just as uneven.
  vec2 far=p-vec2(uAspect,-1.),pressed=far*vec2(.85,1.15);
  float lumpy=.82+.18*sin(p.x*2.9+.3)*sin(p.y*2.2+1.9);
  gl_FragColor.rgb+=vec3(.045*exp(-dot(pressed,pressed)*1.5)*lumpy+.0135*exp(-dot(far,far)*.5));${FINISH}
}`;

/** Every material of the strip. They share the lamp and the wear map, so one change reaches all of them. */
export function filmLooks(pictures: Texture[]) {
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const lamp = { uLampX: { value: 0 }, uLamp: { value: 0 }, uBurn: { value: 0 } };
  const look = {
    uScreen: { value: new Vector2(1, 1) },
    uFrame: { value: 0 },
    uFlicker: { value: 1 },
    uScratch: { value: 1 },
  };
  const wear: { value: Texture } = { value: blank },
    still = { value: 0 };
  const sheet = (map: Texture, index: number) =>
    new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: SHEET,
      uniforms: {
        ...lamp,
        ...look,
        uWear: wear,
        uMap: { value: map },
        uShift: { value: index * FRAME_PITCH },
      },
    });
  const looks = {
    lamp,
    look,
    wear,
    blank,
    base: new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: BASE,
      uniforms: { ...lamp, ...look, uWear: wear, uShift: still },
    }),
    pictures: pictures.map(sheet),
    contents: FILM_PRODUCTS.map((_, index) => sheet(blank, index)),
    leader: sheet(blank, 0), // the opaque black leader before the first frame and after the last
    void: new ShaderMaterial({
      vertexShader: VOID_VERTEX,
      fragmentShader: VOID,
      uniforms: { ...look, uBurn: lamp.uBurn, uAspect: { value: 1 } },
      depthWrite: false,
    }),
    dispose() {
      for (const look of [looks.base, looks.leader, looks.void, ...looks.pictures, ...looks.contents])
        look.dispose();
      blank.dispose();
    },
  };
  return looks;
}
