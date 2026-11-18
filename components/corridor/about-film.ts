import { ropeFlightDevice } from "./effect-quality";
import { targetDpr } from "./render-resolution";
/**
 * Section 2's film layer: for a few seconds after arrival, About Us still looks like Section 1 (grain, dust, thin white
 * lines, a wavering lamp, dark lens corners, gate weave), then the print is cleaned in front of the visitor: the lines go
 * first, then the dust, then the grain, while the lamp steadies and the frame stops shaking. What remains is clean black
 * and white with Section 1's two corner lights, mirrored to the other corners. After that one still frame is drawn and
 * nothing runs any more.
 *
 * One canvas lies over the whole section. It knows the plain dark wall and the card underneath it (where the card is
 * and its light), works out what the film would make of them, and adds only the difference: light is
 * added, and darkening is laid on as cover in proportion to what is there. At full strength the film maths is Section 1's
 * (components/film-reel/film-material.ts, LOOK and VOID), so the two sections match.
 */

/** The wall's own colour: Section 1's dark, linear .00152/.00152/.00182, as the screen shows it. */
export const WALL = "#050506";

// Seconds from the moment the white has fully lifted. The film is gone within one second, part by part on overlapping eased
// curves so nothing switches off: the lines thin out first, then the dust, then the coarse clumps, and last the fine grain
// melts while the lamp steadies.
const DONE = 1;
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const fade = (t: number, from: number, to: number) => 1 - smoother((t - from) / (to - from));
const strengthsAt = (t: number) =>
  [fade(t, 0, 0.55), fade(t, 0.05, 0.65), fade(t, 0.15, 1), fade(t, 0.1, 0.9), fade(t, 0.1, 0.8)] as const; // lines, dust, fine grain, wear, clumps
/** One film clock (24 frames a second, Section 1's), shared with the film carried over the flight, so grain and lines run on unbroken. */
const filmFrame = () => Math.floor(performance.now() * 0.024);
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (n: number) => {
  const i = Math.floor(n),
    f = n - i,
    u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
};
// Section 1's lamp and gate weave, per film frame (24 a second). Weave in CSS pixels.
const flickerAt = (n: number) =>
  1 + 0.048 * (noise(n) - 0.5) + 0.018 * Math.sin(n * 0.083) + 0.012 * Math.sin(n * 0.31 + 1.7);
// Kept to about a third of Section 1's (the user found the full shake too much here): at most ~.5 px across, ~1.2 px up/down.
const WEAVE = 0.38;
const weaveAt = (n: number) => [
  WEAVE * (1.3 * (noise(n * 1.73 + 0.4) - 0.5) + 0.5 * Math.sin(n * 0.11 + 0.8)),
  WEAVE * (3.4 * (noise(n * 2.31 + 9.1) - 0.5) + 1.3 * Math.sin(n * 0.17 + 2.3)),
];

const VERTEX = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT = `precision highp float;
uniform vec2 uScreen;
uniform float uFrame,uFlicker,uAspect,uOpaque,uClump;
uniform vec4 uStrength; // lines, dust, grain, wear (lamp, corners, mottle, lift)
uniform vec4 uRect;     // the card in canvas pixels, from the bottom left
uniform vec2 uShift;    // the card's gate weave, in canvas pixels
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+1.),f.x),f.y);}
float cornersAt(){
  vec2 d=(gl_FragCoord.xy/uScreen-.5)*vec2(uScreen.x/uScreen.y,1.)*vec2(.8,1.1);
  return 1.-.6*smoothstep(.3,1.08,length(d));
}
// Section 1's film look, each part with its own strength so the print can be cleaned in order. keep is 1 on the wall: the
// lamp and the dark lens corners act on the card only, so the wall's two corner lights hold one strength from the first
// frame to the last.
vec3 look(vec3 c,float keep){
  float wear=uStrength.w;
  c*=mix(1.,uFlicker*cornersAt(),wear*(1.-keep));
  float seed=mod(floor(uFrame/2.),113.);
  vec2 at=gl_FragCoord.xy;
  float fine=hash12(at+seed*17.31)+hash12(at*1.37+seed*5.13)-1.;
  float clump=hash12(floor(at*.5)+seed*9.71)-.5;
  float tone=dot(c,vec3(.3333));
  c+=.012*max(wear,keep)*cornersAt();
  c+=(fine*.6*uStrength.z+clump*.45*uClump)*(.05+.115*tone*(1.-tone));
  float mottle=(vnoise(at/230.+vec2(uFrame*.011,uFrame*.007))-.5)+.5*(vnoise(at/90.+vec2(-uFrame*.009,uFrame*.013))-.5);
  c=c*(1.+.045*mottle*wear)+.005*mottle*wear;
  vec2 cell=floor(at/41.);
  float speck=hash12(cell+seed*3.71);
  if(speck<.008*uStrength.y){
    vec2 centre=(cell+.15+.7*vec2(hash12(cell*1.3+seed),hash12(cell.yx+seed*2.1)))*41.;
    float turn=hash12(cell+seed*7.7)*6.283;vec2 d=at-centre;d=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*d;
    float size=.7+3.*hash12(cell+seed*5.9)*hash12(cell+seed*1.9);
    float blot=1.-smoothstep(size*.45,size,length(d*vec2(1.,1.+2.5*hash12(cell+seed*4.4))));
    c+=blot*(speck<.0034*uStrength.y?.22:-.12);
  }
  for(int k=0;k<6;k++){
    float slot=float(k),life=floor(uFrame/(9.+slot*7.)+slot*3.1);
    if(hash12(vec2(life,slot*13.1+1.))>.88*uStrength.x)continue;
    float x=hash12(vec2(life*.7,slot+4.2))*uScreen.x+(hash12(vec2(uFrame,slot+7.))-.5)*1.4;
    float width=.25+.4*hash12(vec2(life,slot+9.));
    float line=1.-smoothstep(width,width+.7,abs(at.x-x));
    float along=.55+.45*sin(at.y*(.004+.01*hash12(vec2(life,slot+3.)))+life*2.3+sin(at.y*.031+slot));
    c+=line*along*(.11+.16*hash12(vec2(life,slot+5.)))*(.6+.4*hash12(vec2(uFrame,slot+11.)));
  }
  return c;
}
vec3 display(vec3 l){return mix(l*12.92,1.055*pow(l,vec3(1./2.4))-.055,step(.0031308,l));}
// Section 1's two corner lights, mirrored: the soft uneven one now top right, the brighter one low on the left.
vec3 wallAt(vec2 p){
  vec2 corner=p-vec2(uAspect,1.),squeezed=corner*vec2(.75,1.05);
  float wobble=.85+.15*sin(-p.x*2.3+1.1)*sin(p.y*3.1+.4);
  float stray=.03*exp(-dot(squeezed,squeezed)*1.4)*wobble+.009*exp(-dot(corner,corner)*.45);
  vec3 c=vec3(.00152,.00152,.00182)+stray*vec3(1.,1.,1.04);
  vec2 far=p-vec2(-uAspect,-1.),pressed=far*vec2(.85,1.15);
  float lumpy=.82+.18*sin(-p.x*2.9+.3)*sin(p.y*2.2+1.9);
  return c+vec3(.045*exp(-dot(pressed,pressed)*1.5)*lumpy+.0135*exp(-dot(far,far)*.5));
}
// The card's light: its CSS radial gradient, 120% by 95% of the card, centred at 50% 42%.
float cardTone(vec2 at){
  vec2 q=vec2((at.x-uRect.x-.5*uRect.z)/(1.2*uRect.z),((uRect.y+uRect.w-at.y)-.42*uRect.w)/(.95*uRect.w));
  float t=length(q);
  return t<.46?mix(.965,.925,t/.46):t<.82?mix(.925,.839,(t-.46)/.36):mix(.839,.788,clamp((t-.82)/.18,0.,1.));
}
void main(){
  vec2 p=(gl_FragCoord.xy/uScreen*2.-1.)*vec2(uAspect,1.);
  vec3 wall=display(wallAt(p));
  if(uOpaque>.5){gl_FragColor=vec4(wall+.012*cornersAt(),1.);return;} // the clean wall, for the flight's copies
  vec2 at=gl_FragCoord.xy-uShift,lo=at-uRect.xy,hi=uRect.xy+uRect.zw-at;
  float a=min(min(lo.x,lo.y),min(hi.x,hi.y))<0.?0.:1.; // the card's edge is sharp
  vec3 card=vec3(cardTone(at)),plain=display(vec3(.00152,.00152,.00182));
  vec3 want=a<=0.?look(wall,1.):look(card,0.);
  want+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255.;
  vec3 under=mix(plain,card,a);
  // The card has black text this layer cannot see. Light laid over the card would land on the letters as white specks,
  // so on the card the film may only darken.
  want=mix(want,min(want,under),a);
  // A true premultiplied veil (colour never above its alpha), so every browser compositing path keeps the lights:
  // k is just enough cover to reach want from under in every channel, and the colour fills in the rest.
  vec3 lift=max(want-under,0.)/max(1.-under,vec3(1e-4)),dim=max(1.-want/max(under,vec3(1e-4)),0.);
  float k=clamp(max(max(max(lift.r,lift.g),lift.b),max(max(dim.r,dim.g),dim.b)),0.,1.);
  gl_FragColor=vec4(clamp(want-under*(1.-k),0.,k),k);
}`;

export type AboutFilm = {
  mode(): "idle" | "wait" | "play" | "clean";
  idle(): void;
  wait(): void;
  play(): void;
  clean(): void;
  dispose(): void;
};

/**
 * frame is the card, positioned inside the same box as the canvas. Light behind the card stays the wall's; the card
 * itself is the page's own element and is only darkened or lit by the film, never replaced.
 */
export function createAboutFilm(
  canvas: HTMLCanvasElement,
  frame: HTMLElement,
  onDone: () => void,
): AboutFilm | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  const vs = shader(gl.VERTEX_SHADER, VERTEX),
    fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("About Us film:", gl.getShaderInfoLog(fs));
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const uScreen = u("uScreen"),
    uFrame = u("uFrame"),
    uFlicker = u("uFlicker"),
    uAspect = u("uAspect"),
    uOpaque = u("uOpaque"),
    uStrength = u("uStrength"),
    uClump = u("uClump"),
    uRect = u("uRect"),
    uShift = u("uShift");

  let mode: "idle" | "wait" | "play" | "clean" = "wait",
    start = 0,
    raf = 0,
    scale = 1;
  const measure = () => {
    // Same pixel budget as the corridor canvas (render-resolution.ts): a Retina MacBook drew this full-screen film at
    // 2x (≈6.1 MP a frame); now ≈1.7x on a laptop GPU. Phones and 1x desktops are unchanged. The grain is authored in
    // canvas pixels, so it reads a little closer to the 1x desktop look.
    scale = targetDpr(
      ropeFlightDevice(),
      Math.max(1, canvas.clientWidth),
      Math.max(1, canvas.clientHeight),
      window.devicePixelRatio || 1,
    );
    const width = Math.max(1, Math.round(canvas.clientWidth * scale)),
      height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uScreen, width, height);
    gl.uniform1f(uAspect, width / height);
    // The card's untransformed box, relative to the canvas: both sit in the same positioned stage.
    gl.uniform4f(
      uRect,
      frame.offsetLeft * scale,
      height - (frame.offsetTop + frame.offsetHeight) * scale,
      frame.offsetWidth * scale,
      frame.offsetHeight * scale,
    );
  };
  const draw = (t: number) => {
    const [lines, dust, grain, wear, clump] = mode === "clean" ? [0, 0, 0, 0, 0] : strengthsAt(t);
    const n = filmFrame();
    const [x, y] = weaveAt(n);
    gl.uniform4f(uStrength, lines, dust, grain, wear);
    gl.uniform1f(uClump, clump);
    gl.uniform1f(uFrame, n);
    gl.uniform1f(uFlicker, flickerAt(n));
    gl.uniform2f(uShift, x * wear * scale, -y * wear * scale);
    gl.uniform1f(uOpaque, 0);
    frame.style.translate = wear > 1e-3 ? `${(x * wear).toFixed(2)}px ${(y * wear).toFixed(2)}px` : "";
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const tick = (now: number) => {
    if (mode === "idle") {
      draw(0);
      raf = requestAnimationFrame(tick);
      return;
    } // the old film, running, before anyone has arrived
    const t = (now - start) / 1000;
    if (t >= DONE) {
      mode = "clean";
      stop();
      draw(DONE);
      onDone();
      return;
    }
    draw(t);
    raf = requestAnimationFrame(tick);
  };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const resize = new ResizeObserver(() => {
    measure();
    if (!raf) draw(0);
  });
  measure();
  resize.observe(canvas);
  // ?drive: step the clean-up by hand (a hidden browser pane runs no animation frames).
  if (new URLSearchParams(location.search).has("drive"))
    (window as unknown as { __about?: unknown }).__about = {
      at(t: number) {
        stop();
        mode = t >= DONE ? "clean" : "play";
        measure();
        draw(Math.min(t, DONE));
      },
    };

  return {
    mode: () => mode,
    idle() {
      if (mode === "idle" && raf) return;
      stop();
      mode = "idle";
      measure();
      raf = requestAnimationFrame(tick);
    },
    wait() {
      stop();
      mode = "wait";
      measure();
      draw(0);
    },
    play() {
      stop();
      if (reduced()) {
        this.clean();
        return;
      }
      mode = "play";
      measure();
      start = performance.now();
      draw(0);
      raf = requestAnimationFrame(tick); // the same film frame the carried film was showing
    },
    clean() {
      stop();
      mode = "clean";
      measure();
      draw(DONE);
      onDone();
    },
    dispose() {
      stop();
      resize.disconnect();
      frame.style.translate = "";
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

/** A small still of the mirrored corner lights for the flight's copies of this section, which have no film layer. */
export function wallStill(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) return "";
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, width, height);
  gl.uniform2f(gl.getUniformLocation(program, "uScreen"), width, height);
  gl.uniform1f(gl.getUniformLocation(program, "uAspect"), width / height);
  gl.uniform1f(gl.getUniformLocation(program, "uOpaque"), 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const url = canvas.toDataURL("image/png");
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return url;
}
