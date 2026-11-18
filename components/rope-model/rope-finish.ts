import {
  Color,
  CustomBlending,
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  NoBlending,
  NoColorSpace,
  OneFactor,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { WHITE_STORED, type RopeLook } from "./rope-materials";
import { greenFromRed } from "./rope-flight";
import { portalGlowGlsl, bluePortalGlowGlsl, yellowPortalGlowGlsl } from "./rope-portal";
import { BLUE_BACKDROP } from "./rope-blue";
import {
  GREEN_BACKDROP,
  YELLOW_BACKDROP,
  nearGreenLook,
  yellowRopeLook,
  yellowGreenGradeGlsl,
  yellowToeGlsl,
} from "./rope-yellow";

const LUT_SIZE = 2048;
// Behind the threads Blender's picture is not pure black. These are its own values, read before the curves where nothing else reaches (last scroll stop). Alone they stay under the curve's floor; added to the glow they fill the tunnel's hole with haze.
const BACKDROP = [0.0035, 0.00005, 0.00034];
// The file's Glare node: Bloom, threshold .12, smoothness 1, strength .85, size .42. At 1920 wide it works through 8 picture sizes, each half the last.
const GLOW = { threshold: 0.12, knee: 0.12, strength: 0.85, sizesAt1920: 8 };

/** Blender's order for the final picture: film exposure, then the glow, then the file's three red colour ramps, then display sRGB. The ramps are read at the cube root of brightness, which keeps their deep shadow steps exact. */
function gradeTexture(look: RopeLook) {
  const data = new Float32Array(LUT_SIZE * 4);
  look.grade.forEach((stops, channel) => {
    for (let i = 0; i < LUT_SIZE; i++) {
      const x = (i / (LUT_SIZE - 1)) ** 3;
      let k = 0;
      while (k < stops.length - 1 && stops[k + 1][0] < x) k++;
      const [x0, y0] = stops[k],
        [x1, y1] = stops[Math.min(k + 1, stops.length - 1)];
      data[i * 4 + channel] =
        x <= x0 ? y0 : x1 > x0 ? y0 + (y1 - y0) * Math.min((x - x0) / (x1 - x0), 1) : y1;
    }
  });
  for (let i = 0; i < LUT_SIZE; i++) data[i * 4 + 3] = 1;
  const texture = new DataTexture(data, LUT_SIZE, 1, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const fullScreen = /* glsl */ `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const highlights = /* glsl */ `
  vec3 highlights(vec3 c){
    float v=max(c.r,max(c.g,c.b)),h=max(${GLOW.knee.toFixed(3)}-abs(${GLOW.threshold.toFixed(
      3,
    )}-v),0.)/${GLOW.knee.toFixed(3)};
    return c*((max(${GLOW.threshold.toFixed(3)},v)+h*h*${GLOW.knee.toFixed(3)}*.25-${GLOW.threshold.toFixed(
      3,
    )})/max(v,1e-9));
  }`;
const tent = /* glsl */ `
  vec3 tent(sampler2D source,vec2 uv,vec2 t){
    return texture2D(source,uv).rgb*.25
      +(texture2D(source,uv+vec2(-t.x,0.)).rgb+texture2D(source,uv+vec2(t.x,0.)).rgb+texture2D(source,uv+vec2(0.,t.y)).rgb+texture2D(source,uv+vec2(0.,-t.y)).rgb)*.125
      +(texture2D(source,uv+vec2(-t.x,-t.y)).rgb+texture2D(source,uv+vec2(-t.x,t.y)).rgb+texture2D(source,uv+vec2(t.x,-t.y)).rgb+texture2D(source,uv+vec2(t.x,t.y)).rgb)*.0625;
  }`;

export function createFinish(look: RopeLook, flight = false, blue = false, yellow = false) {
  const backdrop = yellow ? GREEN_BACKDROP : blue ? BLUE_BACKDROP : BACKDROP;
  const target = new WebGLRenderTarget(4, 4, {
    type: HalfFloatType,
    format: RGBAFormat,
    colorSpace: NoColorSpace,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    samples: 8,
    // Only the colour is read after the threads are drawn: the depth is never copied out of the samples.
    resolveDepthBuffer: false,
  });
  const grade = gradeTexture(yellow ? nearGreenLook(look) : look),
    farGrade = yellow ? gradeTexture(yellowRopeLook(look)) : null;
  let sizes: WebGLRenderTarget[] = [],
    glowBase = 0,
    glowGain = 1;
  const backdropNow = new Color();

  // First step down: takes the bright parts of the picture, and keeps a single very bright speck from flickering.
  const first = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    uniforms: {
      uSource: { value: target.texture },
      uTexel: { value: new Vector2() },
      uExposure: { value: look.exposure },
    },
    vertexShader: fullScreen,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      uniform float uExposure;
      varying vec2 vUv;
      ${highlights}
      vec3 tap(float x,float y){return highlights(max(texture2D(uSource,vUv+vec2(x,y)*uTexel).rgb,vec3(0.))*uExposure);}
      vec3 even(vec3 a,vec3 b,vec3 c,vec3 d){
        vec4 w=1./(1.+.1*vec4(max(a.r,max(a.g,a.b)),max(b.r,max(b.g,b.b)),max(c.r,max(c.g,c.b)),max(d.r,max(d.g,d.b))));
        return (a*w.x+b*w.y+c*w.z+d*w.w)/(w.x+w.y+w.z+w.w);
      }
      void main(){
        vec3 o=tap(0.,0.),ul=tap(-1.,1.),ur=tap(1.,1.),ll=tap(-1.,-1.),lr=tap(1.,-1.),l=tap(-2.,0.),r=tap(2.,0.),u=tap(0.,2.),d=tap(0.,-2.),a=tap(-2.,2.),b=tap(2.,2.),e=tap(-2.,-2.),f=tap(2.,-2.);
        gl_FragColor=vec4(.5*even(ul,ur,lr,ll)+.125*(even(a,u,o,l)+even(u,b,r,o)+even(o,r,f,d)+even(l,o,d,e)),1.);
      }`,
  });
  const down = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    uniforms: { uSource: { value: null }, uTexel: { value: new Vector2() } },
    vertexShader: fullScreen,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      varying vec2 vUv;
      vec3 tap(float x,float y){return texture2D(uSource,vUv+vec2(x,y)*uTexel).rgb;}
      void main(){
        gl_FragColor=vec4((tap(0.,0.)+tap(-1.,1.)+tap(1.,1.)+tap(-1.,-1.)+tap(1.,-1.))*.125+(tap(-2.,0.)+tap(2.,0.)+tap(0.,2.)+tap(0.,-2.))*.0625+(tap(-2.,2.)+tap(2.,2.)+tap(-2.,-2.)+tap(2.,-2.))*.03125,1.);
      }`,
  });
  // Coming back up, each size is added on top of the one above it, so nothing extra is stored.
  const up = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    uniforms: { uSource: { value: null }, uTexel: { value: new Vector2() } },
    vertexShader: fullScreen,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSource;
      uniform vec2 uTexel;
      varying vec2 vUv;
      ${tent}
      void main(){gl_FragColor=vec4(tent(uSource,vUv,uTexel),1.);}`,
  });
  const final = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
    uniforms: {
      uScene: { value: target.texture },
      uGlow: { value: null },
      uGlowScale: { value: 0 },
      uWhiteStored: { value: WHITE_STORED.share },
      uGrade: { value: grade },
      ...(farGrade ? { uFarGrade: { value: farGrade } } : {}),
      uExposure: { value: look.exposure },
      uSize: { value: LUT_SIZE },
      uViewport: { value: new Vector2(1, 1) },
      uCameraRed: { value: 1 },
      uPortal: { value: new Vector3() },
    },
    vertexShader: fullScreen,
    fragmentShader: /* glsl */ `
      uniform sampler2D uScene,uGlow,uGrade;
      ${yellow ? "uniform sampler2D uFarGrade;" : ""}
      uniform float uExposure,uSize,uGlowScale,uWhiteStored,uCameraRed;
      uniform vec2 uViewport;
      varying vec2 vUv;
      ${highlights}
      ${tent}
      ${yellow ? yellowPortalGlowGlsl : blue ? bluePortalGlowGlsl : portalGlowGlsl}
      void main(){
        // Blender's picture is a little softer than 8 edge samples alone. This small filter was set to match how rough Blender's own picture is at pixel scale.
        vec2 t=.5/uViewport;
        vec4 softer=(texture2D(uScene,vUv+vec2(t.x,t.y))+texture2D(uScene,vUv+vec2(-t.x,t.y))+texture2D(uScene,vUv+vec2(t.x,-t.y))+texture2D(uScene,vUv+vec2(-t.x,-t.y)))*.25;
        vec4 sharp=texture2D(uScene,vUv);
        vec3 scene=max(mix(sharp.rgb,softer.rgb,.4),vec3(0.))*uExposure;
        vec3 glow=(highlights(scene)+tent(uGlow,vUv,1./uViewport))*uGlowScale;
        vec3 c=clamp(scene+glow,0.,1.);
        vec3 g=(pow(c,vec3(1./3.))*(uSize-1.)+.5)/uSize;
        ${
          yellow
            ? yellowGreenGradeGlsl
            : flight && !blue
              ? /* glsl */ `
        // The green file's curves are the red file's with red and green swapped, so one sheet holds both and each pixel takes its own.
        vec4 gradeR=texture2D(uGrade,vec2(g.r,.5)),gradeG=texture2D(uGrade,vec2(g.g,.5));
        float gradeB=texture2D(uGrade,vec2(g.b,.5)).b;
        vec3 o=mix(vec3(gradeR.r,gradeG.g,gradeB),vec3(gradeR.g,gradeG.r,gradeB),smoothstep(mix(.12,.42,uCameraRed),mix(.25,.58,uCameraRed),c.g/max(c.r+c.g,1e-5)));
        `
              : `vec3 o=vec3(texture2D(uGrade,vec2(g.r,.5)).r,texture2D(uGrade,vec2(g.g,.5)).g,texture2D(uGrade,vec2(g.b,.5)).b);`
        }
        // A white thread marks itself in alpha. The grade is built for red and tops out far below white, so white goes around it, rebuilt from its stored red. Everything else is untouched.
        float white=clamp(1.-mix(sharp.a,softer.a,.4),0.,1.);
        o=mix(clamp(o,0.,1.),vec3(min(${
          blue
            ? "scene.b/uWhiteStored+min(glow.b,glow.g)+portalInside(vUv)"
            : flight
              ? "max(scene.r,scene.g)/uWhiteStored+min(glow.r,glow.g)+portalInside(vUv)"
              : "scene.r/uWhiteStored+glow.g"
        },1.))*portalTint(vUv,white),white);
        ${
          yellow
            ? `vec3 displayColour=mix(o*12.92,1.055*pow(o,vec3(1./2.4))-.055,step(.0031308,o));${yellowToeGlsl}gl_FragColor=vec4(portalGlow(displayColour,vUv),1.);`
            : "gl_FragColor=vec4(portalGlow(mix(o*12.92,1.055*pow(o,vec3(1./2.4))-.055,step(.0031308,o)),vUv),1.);"
        }
      }`,
  });
  const quad = new FullScreenQuad(final);
  const pass = (gl: WebGLRenderer, material: ShaderMaterial, into: WebGLRenderTarget | null) => {
    gl.setRenderTarget(into);
    quad.material = material;
    quad.render(gl);
  };

  return {
    target,
    /** For compiling ahead (sections): the passes drawn into pictures, and the one drawn to the screen. */
    passes: { toPictures: [first, down, up], toScreen: [final] },
    backdrop: new Color(
      backdrop[0] / look.exposure,
      backdrop[1] / look.exposure,
      backdrop[2] / look.exposure,
    ),
    /** The colour behind the threads during the flight, and which colour curves doubtful pixels take: 0 green, 1 red. */
    backdropAt(red: number, curves = red) {
      final.uniforms.uCameraRed.value = curves;
      const green = yellow ? YELLOW_BACKDROP : greenFromRed(BACKDROP),
        near = yellow ? GREEN_BACKDROP : BACKDROP;
      return backdropNow.setRGB(
        (green[0] + (near[0] - green[0]) * red) / look.exposure,
        (green[1] + (near[1] - green[1]) * red) / look.exposure,
        (green[2] + (near[2] - green[2]) * red) / look.exposure,
      );
    },
    setPortal(radius: number, strength: number, aspect: number) {
      final.uniforms.uPortal.value.set(radius, strength, aspect);
    },
    setSize(width: number, height: number) {
      target.setSize(width, height);
      final.uniforms.uViewport.value.set(width, height);
      sizes.forEach((size) => size.dispose());
      // The same reach across the picture on any screen: a wider picture needs a step more to spread as far.
      const count = Math.max(4, Math.min(10, GLOW.sizesAt1920 + Math.round(Math.log2(width / 1920))));
      sizes = [];
      for (let i = 1; i < count; i++)
        sizes.push(
          new WebGLRenderTarget(Math.max(1, width >> i), Math.max(1, height >> i), {
            type: HalfFloatType,
            format: RGBAFormat,
            colorSpace: NoColorSpace,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            depthBuffer: false,
          }),
        );
      final.uniforms.uGlow.value = sizes[0].texture;
      glowBase = GLOW.strength / count;
      first.uniforms.uTexel.value.set(1 / width, 1 / height);
    },
    /** Live controls: glow gain multiplies the approved glow; stored must match what the thread shader was given. */
    setTuning(gain: number, stored: number) {
      glowGain = gain;
      final.uniforms.uWhiteStored.value = stored;
    },
    render(gl: WebGLRenderer) {
      if (!sizes.length) return;
      final.uniforms.uGlowScale.value = glowBase * glowGain;
      const autoClear = gl.autoClear;
      gl.autoClear = false;
      pass(gl, first, sizes[0]);
      for (let i = 1; i < sizes.length; i++) {
        down.uniforms.uSource.value = sizes[i - 1].texture;
        down.uniforms.uTexel.value.set(1 / sizes[i - 1].width, 1 / sizes[i - 1].height);
        pass(gl, down, sizes[i]);
      }
      for (let i = sizes.length - 2; i >= 0; i--) {
        up.uniforms.uSource.value = sizes[i + 1].texture;
        up.uniforms.uTexel.value.set(1 / sizes[i].width, 1 / sizes[i].height);
        pass(gl, up, sizes[i]);
      }
      pass(gl, final, null);
      gl.autoClear = autoClear;
    },
    dispose() {
      target.dispose();
      sizes.forEach((size) => size.dispose());
      grade.dispose();
      farGrade?.dispose();
      first.dispose();
      down.dispose();
      up.dispose();
      final.dispose();
      quad.dispose();
    },
  };
}
