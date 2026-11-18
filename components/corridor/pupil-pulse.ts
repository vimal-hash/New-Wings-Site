import {
  AdditiveBlending,
  Box3,
  BufferGeometry,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  type Camera,
  type WebGLRenderer,
} from "three";
import { createPupilBorderGeometry } from "./pupil-border";
import { PUPIL_ABSORPTION_GLSL, PUPIL_ABSORPTION_STEPS } from "./pupil-absorption";
import { createPupilFrontGeometry, PUPIL_FILL_NAME } from "./pupil-fill";
import {
  createPupilPulseClock,
  fadePupilState,
  HERO_WAVE_GLSL,
  PUPIL_PULSE,
  pupilLeaveFade,
  pupilPulseUniforms,
  resetPupilPulse,
  samplePupilPreTrace,
} from "./pupil-pulse-state";
import { createPupilEmissionMaterial } from "./pupil-pulse-material";
import { createPupilRayContact } from "./pupil-ray-contact";
import type { EffectQuality } from "./effect-quality";
import { CINEMA_DEFAULTS, type CinemaValues } from "./cinema-controls";

export const PUPIL_BORDER_NAME = "Pupil — steel light border";
export const PUPIL_RAY_NAME = "Pupil — travelling light wave";
const EYE_NAME = "Approved revision 16 — authored steel grains";

const borderVertex = /* glsl */ `
attribute float pulseSide;varying float vPulseSide;varying vec3 vPulseWorld;
void main(){vPulseSide=pulseSide;vPulseWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vPulseWorld,1.);}`;
const borderFragment = /* glsl */ `
uniform vec3 uHeroOrigin,uHeroRight,uHeroUp,uHeroCore,uHeroHalo;uniform float uHeroTrace,uHeroBorder;
varying float vPulseSide;varying vec3 vPulseWorld;
void main(){
  vec3 p=vPulseWorld-uHeroOrigin;
  float angle=mod(atan(dot(p,uHeroUp),dot(p,uHeroRight))+6.283185307,6.283185307)/6.283185307;
  float reveal=mix(1.-smoothstep(uHeroTrace-.012,uHeroTrace+.012,angle),1.,smoothstep(.985,1.,uHeroTrace));
  float core=exp(-vPulseSide*vPulseSide*85.);
  float shoulder=exp(-vPulseSide*vPulseSide*5.)*.23;
  float head=exp(-pow((angle-uHeroTrace)/.025,2.))*(1.-step(.999,uHeroTrace));
  float glint=.88+.12*cos(angle*18.8495559-.6);
  vec3 pulseColour=mix(uHeroHalo,uHeroCore,core/(core+shoulder+.0001))*uHeroBorder*glint*(1.+head*.5);
  vec4 fragmentColour=vec4(pulseColour,(core+shoulder)*reveal);
  if(fragmentColour.a<.001)discard;
  gl_FragColor=fragmentColour;
  #include <colorspace_fragment>
}`;
const rayVertex = /* glsl */ `
varying vec3 vPulseWorld;varying vec4 vPulseClip;
void main(){vPulseWorld=(modelMatrix*vec4(position,1.)).xyz;vPulseClip=projectionMatrix*viewMatrix*vec4(vPulseWorld,1.);gl_Position=vPulseClip;}`;
const rayFragment = /* glsl */ `
${HERO_WAVE_GLSL}
uniform vec3 uHeroCore,uHeroHalo;
${PUPIL_ABSORPTION_GLSL}
uniform float uHeroRayWidth,uHeroRayGain;
varying vec3 vPulseWorld;varying vec4 vPulseClip;
void main(){
  vec3 p=vPulseWorld-uHeroOrigin;
  float angle=atan(p.z,p.x);
  float filament=.81+.10*sin(angle*7.+.6)+.05*sin(angle*19.+1.7)+.04*sin(angle*43.+.2);
  float distanceFromPupil=length(p);
  float width=max(uHeroRayWidth,fwidth(distanceFromPupil)*.75);
  float crest=0.,shoulder=0.,core=0.;
  for(int i=0;i<3;i++){
    if(uHeroWaves[i]<.0001)continue;
    float distanceToFront=distanceFromPupil-uHeroRadii[i];
    float highlight=exp(-pow(distanceToFront/width,2.));
    float received=highlight*uHeroWaves[i];
    if(received>crest){crest=received;core=highlight;}
    shoulder=max(shoulder,exp(-pow(distanceToFront/(width*2.8),2.))*uHeroWaves[i]);
  }
  // Restrict the absorption walk to the narrow visible front, never the full plane.
  if(crest+.045*shoulder<.0002)discard;
  vec2 uv=vPulseClip.xy/vPulseClip.w*.5+.5;
  float emptySpace=rayTransmission(uv);
  vec3 pulseColour=mix(uHeroHalo,uHeroCore,core)*uHeroRayGain;
  vec4 fragmentColour=vec4(pulseColour,filament*(.85*crest+.045*shoulder)*emptySpace);
  if(fragmentColour.a<.0002)discard;
  gl_FragColor=fragmentColour;
  #include <colorspace_fragment>
}`;

export function privatePupilLightMaterial(source: ShaderMaterial) {
  const radiance = source.name.includes("Radial") ? 8 : 6;
  return createPupilEmissionMaterial(source, radiance);
}

/** Owned emitter geometry. All source meshes and particle instance buffers stay untouched. */
export function createPupilPulse(scene: Scene, gl: WebGLRenderer, camera: Camera, quality: EffectQuality) {
  const fill = scene.getObjectByName(PUPIL_FILL_NAME) as Mesh | undefined;
  const eye = scene.getObjectByName(EYE_NAME) as Mesh | undefined;
  if (!fill || !eye || !(eye.material instanceof ShaderMaterial)) return null;
  scene.updateMatrixWorld(true);
  const faces: BufferGeometry[] = [],
    bounds = new Box3();
  scene.traverse((object) => {
    if (!(object instanceof Mesh) || !object.name.startsWith("Swoosh")) return;
    bounds.union(new Box3().setFromObject(object));
    if (object.name.includes("Blue")) return;
    const world = object.geometry.clone().applyMatrix4(object.matrixWorld);
    try {
      faces.push(createPupilFrontGeometry(world));
    } finally {
      world.dispose();
    }
  });
  faces.push(fill.geometry.clone().applyMatrix4(fill.matrixWorld));
  const top = new Box3().setFromObject(fill).max.y + 0.04;
  const origin = new Vector3((bounds.min.x + bounds.max.x) / 2, top, (bounds.min.z + bounds.max.z) / 2);
  const radius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
  const geometry = createPupilBorderGeometry(faces, top, PUPIL_PULSE.borderWidth);
  faces.forEach((face) => face.dispose());
  pupilPulseUniforms.uHeroOrigin.value.copy(origin);
  pupilPulseUniforms.uHeroWidth.value = radius * PUPIL_PULSE.width;
  pupilPulseUniforms.uHeroRayWidth.value = radius * PUPIL_PULSE.rayWidth;
  const contact = createPupilRayContact(gl, eye, quality);
  const material = new ShaderMaterial({
    name: "Pupil | Tracing steel border",
    uniforms: pupilPulseUniforms,
    vertexShader: borderVertex,
    fragmentShader: borderFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: AdditiveBlending,
  });
  const border = new Mesh(geometry, material);
  border.name = PUPIL_BORDER_NAME;
  border.renderOrder = 6;
  border.frustumCulled = false;
  border.visible = false;
  const rayGeometry = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    rayMaterial = new ShaderMaterial({
      name: "Pupil | Radial light front",
      defines: { PUPIL_ABSORPTION_STEPS: PUPIL_ABSORPTION_STEPS[quality] },
      uniforms: { ...pupilPulseUniforms, ...contact.uniforms },
      vertexShader: rayVertex,
      fragmentShader: rayFragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      blending: AdditiveBlending,
    });
  const ray = new Mesh(rayGeometry, rayMaterial);
  ray.name = PUPIL_RAY_NAME;
  ray.renderOrder = 6;
  ray.frustumCulled = false;
  ray.visible = false;
  ray.position.copy(origin);
  for (const mesh of [border, ray]) {
    mesh.userData.pupilPulseEmitter = true;
    mesh.userData.excludeFromMirror = true;
    scene.add(mesh);
  }
  const clock = createPupilPulseClock(),
    point = new Vector3();
  let glow = false,
    preTraced = false,
    // The emission clock ran last frame, and a step back from the final eye is fading its light out.
    lit = false,
    leaving = false;
  function update(
    phase: string,
    now: number,
    hidden: boolean,
    reduce: boolean,
    tuning: Readonly<CinemaValues> = CINEMA_DEFAULTS,
    shot?: { stage: string; progress: number },
  ) {
    // Back from the final eye the light there fades out with the reversed pullback instead of cutting off, on its own
    // clock; turning forward again before it has gone brings it back as it was.
    leaving = phase === "logoReveal" && !reduce && shot?.stage === "pullback" && (lit || leaving);
    const fade = leaving ? pupilLeaveFade(shot!.progress) : 1;
    const early =
      phase === "logoReveal" && !hidden && !reduce && shot && !leaving
        ? samplePupilPreTrace(shot.stage, shot.progress)
        : null;
    const running = clock.tick(
      phase === "logoDone" || (leaving && fade > 0),
      now,
      hidden,
      reduce,
      tuning.logoPeak,
      preTraced ? PUPIL_PULSE.traceLead : 0,
    );
    lit = !!running;
    if (leaving && !running) leaving = false;
    const state = running && fade < 1 ? fadePupilState(running, fade) : (running ?? early);
    if (!state) {
      preTraced = false;
      resetPupilPulse();
      border.visible = ray.visible = false;
      glow = false;
      return false;
    }
    if (early) preTraced = true;
    eye!.updateWorldMatrix(true, false);
    const source = eye!.material as ShaderMaterial,
      min = source.uniforms.uMin.value as Vector3,
      extent = source.uniforms.uExtent.value as Vector3;
    let reach = radius * 1.2;
    for (let i = 0; i < 8; i++)
      reach = Math.max(
        reach,
        point
          .set(min.x + (i & 1 ? extent.x : 0), min.y + (i & 2 ? extent.y : 0), min.z + (i & 4 ? extent.z : 0))
          .applyMatrix4(eye!.matrixWorld)
          .distanceTo(origin),
      );
    pupilPulseUniforms.uHeroRight.value.setFromMatrixColumn(eye!.matrixWorld, 0).normalize();
    pupilPulseUniforms.uHeroUp.value.setFromMatrixColumn(eye!.matrixWorld, 1).normalize();
    pupilPulseUniforms.uHeroTrace.value = state.trace;
    pupilPulseUniforms.uHeroBorder.value = state.border * tuning.logoGlow;
    pupilPulseUniforms.uHeroRayGain.value = tuning.rayStrength;
    pupilPulseUniforms.uHeroRadius.value =
      radius * 0.98 + (reach + radius * 0.45 - radius * 0.98) * state.travel;
    for (let index = 0; index < 3; index++) {
      const front = state.fronts[index];
      pupilPulseUniforms.uHeroRadii.value.setComponent(
        index,
        radius * 0.98 + (reach + radius * 0.45 - radius * 0.98) * (front?.travel ?? 0),
      );
      pupilPulseUniforms.uHeroWaves.value.setComponent(index, front?.strength ?? 0);
    }
    pupilPulseUniforms.uHeroStrength.value = state.wave;
    ray.scale.setScalar(reach + radius);
    border.visible = state.border > 0.0001;
    ray.visible = state.wave > 0.0001;
    glow = (state.moving || !!early) && state.border > 0 && !hidden;
    return state.moving && !hidden;
  }
  return {
    meshes: [border, ray],
    preparationMeshes: [border, ray, contact.mesh],
    prepareContact() {
      contact.draw(camera);
    },
    drawContact() {
      if (pupilPulseUniforms.uHeroStrength.value > 0.0001 && !document.hidden) contact.draw(camera);
    },
    update,
    get glow() {
      return glow;
    },
    pause() {
      clock.pause();
    },
    restart() {
      preTraced = false;
      clock.restart();
      resetPupilPulse();
    },
    dispose() {
      preTraced = false;
      resetPupilPulse();
      scene.remove(border, ray);
      geometry.dispose();
      material.dispose();
      rayGeometry.dispose();
      rayMaterial.dispose();
      contact.dispose();
    },
  };
}
