"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Camera,
  Color,
  DataTexture,
  FramebufferTexture,
  LinearFilter,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  NearestFilter,
  RedFormat,
  Object3D,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Material,
  type WebGLRenderer,
} from "three";
import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import { theatreOpening } from "./theatre-opening-state";
import { theatreScreenCatalogue } from "./theatre-screen-catalogue";
import { openEnquiry } from "./enquiry";
import { scheduleSceneIdle } from "./scene-idle";
import { compileByDryRun } from "./hidden-gpu-preparation";
import { OPENING_ECHO } from "./story-beat";
import {
  ASSEMBLED_ENTRY,
  formatNumber,
  HOVER_ID,
  hoverMode,
  projectorGroups,
  THEATRE_CATALOGUE,
  theatreKey,
  type CatalogueEntry,
  type HoverMode,
} from "./hover-catalogue-state";

/** Settle time after the last camera change before hover is offered. */
const STILL_MS = 220;
const THEATRE_STILL_MS = 120;

const idFragment = `flat varying float vId;void main(){float id=floor(vId+.5);gl_FragColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);}`;
/** Outline mask builds (MASK): unselected IDs are moved outside the view, so only the selected object is drawn. */
const maskCull = `
#ifdef MASK
if(textureLod(uSelected,vec2((floor(vId+.5)+.5)/${HOVER_ID.limit}.,.5),0.).r<.5)gl_Position=vec4(2.,2.,2.,1.);
#endif
`;
const maskUniform = `
#ifdef MASK
uniform sampler2D uSelected;
#endif
`;
/** Static (and instanced) surfaces: one ID per mesh, or per sofa instance. */
const staticVertex = `uniform float uId;flat varying float vId;${maskUniform}void main(){vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;vId=uId+float(gl_InstanceID);
#else
vId=uId;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;${maskCull}}`;
/** Projector: the same pose texture as the visible rig, so exploded parts pick and outline where they are drawn. */
const projectorVertex = (poseGLSL: string) => `${poseGLSL}flat varying float vId;varying float vHide;${maskUniform}
void main(){readPart();vec3 p=rotatePart(partRotation,position*partScale)+partPosition;vId=${HOVER_ID.projector}.+floor(aPart+.5);
vHide=1.-step(.5,vPartVisible);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);${maskCull}}`;
const projectorFragment = `flat varying float vId;varying float vHide;void main(){if(vHide>.5)discard;float id=floor(vId+.5);gl_FragColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);}`;
const maskFragment = `void main(){gl_FragColor=vec4(1.);}`;
const projectorMaskFragment = `varying float vHide;void main(){if(vHide>.5)discard;gl_FragColor=vec4(1.);}`;

/**
 * Outline drawn over the finished frame: one thin white line round the selected object's own silhouette, the way a
 * selection outline works (pmndrs "shopping" example), not round the part of it that happens to be in view.
 * The mask holds the selected object alone, drawn whole (nothing else in it, so whatever stands in front of it cannot
 * cut it), with smooth MSAA edges. The share of a small disc that lies inside the mask gives each pixel's distance to
 * the silhouette (a half-covered disc is on it); the line is a fixed width round that, anti-aliased by one pixel.
 * No fill, no glow.
 */
const outlineVertex = `varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const outlineFragment = `uniform sampler2D uMask;uniform vec2 uTexel;uniform float uRadius,uWidth,uStrength;uniform vec3 uTint;varying vec2 vUv;
float inside(vec2 uv){return textureLod(uMask,uv,0.).r;}
void main(){vec2 r=uTexel*uRadius;float ring=inside(vUv);
// Most of the screen is far from the silhouette: nine taps that all agree settle it.
for(int i=0;i<8;i++){float a=float(i)*.7854;ring+=inside(vUv+vec2(cos(a),sin(a))*r);}
if(ring<.02||ring>8.98)discard;
float covered=0.;
for(int i=0;i<24;i++){float k=float(i)+.5,a=k*2.39996;covered+=inside(vUv+vec2(cos(a),sin(a))*r*sqrt(k/24.));}
// Straight-edge relation near the silhouette: covered = .5 + 2d/(pi r).
float d=abs(covered/24.-.5)*1.5708*uRadius,line=clamp(uWidth*.5+.5-d,0.,1.);
if(line<=0.)discard;
gl_FragColor=vec4(uTint,line*uStrength);}`;
/**
 * Assembled projector: the hovered unit stays sharp and lifts a little, with a soft cool glow around it,
 * while everything else is blurred and dimmed. One frame copy and one full-screen pass, only while a part is lit.
 */
const focusFragment = `uniform sampler2D uFrame,uIds,uSelected;uniform vec2 uTexel;uniform float uBlur,uStrength;varying vec2 vUv;
float sel(vec2 uv){vec4 c=textureLod(uIds,uv,0.);float id=floor(c.r*255.+.5)+floor(c.g*255.+.5)*256.;return textureLod(uSelected,vec2((id+.5)/${HOVER_ID.limit}.,.5),0.).r;}
void main(){
  vec3 sharp=texture2D(uFrame,vUv).rgb;
  vec3 acc=sharp;
  for(int i=0;i<28;i++){float k=float(i)+.5,a=k*2.39996;acc+=textureLod(uFrame,vUv+vec2(cos(a),sin(a))*sqrt(k/28.)*uBlur*uTexel,0.).rgb;}
  vec3 soft=acc/29.;
  float m=sel(vUv),near=0.,far=0.;
  for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 d=vec2(cos(a),sin(a))*uTexel;m+=sel(vUv+d*2.);near+=sel(vUv+d*9.);far+=sel(vUv+d*22.);}
  m=clamp(m/9.*1.5,0.,1.);
  // A soft blue key light on the chosen part; only a faint halo outside it.
  float glow=(1.-m)*(near*.025+far*.012);
  vec3 rest=soft*.5+vec3(.45,.62,1.)*glow;
  float lum=dot(sharp,vec3(.299,.587,.114));
  vec3 lit=sharp*vec3(.9,1.,1.16)+vec3(.05,.1,.22)*(.25+lum);
  gl_FragColor=vec4(mix(sharp,mix(rest,lit,m),uStrength),1.);
}`;
/** Seconds for the outline to come in or go out. */
const OUTLINE_FADE = 0.18;
/** The room tour's stops, in order: chairs, the interior, the screen, the sound, the floor and step lights. */
const TOUR_STOPS = [["seats"], ["interior", "ceiling", "lights"], ["screen"], ["speakers"], ["floor", "steps"]];
/** Line width and the radius of the disc that finds the silhouette, in CSS pixels. */
const OUTLINE_WIDTH = 1.5,
  OUTLINE_RADIUS = 2;

type Target = { id: number; entry: CatalogueEntry; group: number[] };

/** Theatre and projector inspection: outline + small catalogue plate, only while the camera rests at a stop. */
export default function HoverCatalogue() {
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene),
    camera = useThree((s) => s.camera),
    invalidate = useThree((s) => s.invalidate);
  const tools = useMemo(() => createTools(), []);
  const state = useRef({
    clientX: -1,
    clientY: -1,
    inspecting: false,
    pointer: false,
    lastMove: 0,
    still: new Float32Array(32),
    selected: null as Target | null,
    retry: 0,
    fade: 0,
    ticket: 0,
    /** The room tour: 0 waiting, 1 running, 2 over (it plays once). */
    tour: 0,
    tourAt: 0,
    tourStop: -1,
  });
  const dropSelection = useRef(() => {});
  const repick = useRef(() => {});
  useEffect(() => () => tools.dispose(), [tools]);
  useEffect(() => {
    // Off-thread shader preparation, never on the first hover. The theatre's once the opening scene is
    // prepared (the first hover can come straight after the opening); the projector's at its next resting stop.
    let projectorJob = () => {},
      theatreDone = false;
    const theatre = () => {
      if (theatreDone || !journeyControls.read().openingPrepared) return;
      theatreDone = true;
      void tools.prepare(gl, scene, camera).catch(() => {});
    };
    const cancel = journeyControls.subscribe(theatre);
    theatre();
    const offProjector = projectorControls.subscribe(() => {
      if (!projectorControls.read().ready) return;
      projectorJob();
      projectorJob = scheduleSceneIdle(() => {
        void tools.prepareProjector(gl, scene).catch(() => {});
      }, 5);
    });
    return () => {
      cancel();
      projectorJob();
      offProjector();
    };
  }, [tools, gl, scene, camera]);

  useEffect(() => {
    const plate = createPlate();
    const s = state.current;
    const pick = () => {
      clearTimeout(s.retry);
      s.retry = 0;
      if (!s.pointer) return select(null);
      const mode = currentMode();
      if (!mode) return select(null);
      // The theatre camera glides after the mouse for a second or two; its picks follow the glide instead of waiting for it to end.
      const wait = mode === "theatre" ? 0 : s.lastMove + STILL_MS - performance.now();
      if (wait > 0) {
        s.retry = window.setTimeout(pick, wait + 16);
        return;
      }
      // The pixel is read back asynchronously (no GPU stall); a newer pick or a change of stop discards older answers.
      const ticket = ++s.ticket;
      const rect = gl.domElement.getBoundingClientRect();
      void tools
        .pick(gl, scene, camera, mode, (s.clientX - rect.left) / rect.width, (s.clientY - rect.top) / rect.height)
        .then((id) => {
          if (ticket !== s.ticket || !s.pointer || currentMode() !== mode) return;
          select(tools.target(id, mode));
          invalidate();
        })
        .catch(() => {});
    };
    const select = (target: Target | null) => {
      if (target?.id === s.selected?.id && target?.entry.name === s.selected?.entry.name) return;
      const theatre = currentMode() === "theatre";
      // Leaving keeps the last group lit while its outline fades out (cleared in the frame loop).
      s.selected = target;
      if (target) {
        // The mouse has found something: the tour is over.
        if (s.tour === 1) theatreScreenCatalogue.quick = false;
        s.tour = 2;
        tools.highlight(target.group);
      }
      theatreScreenCatalogue.name = theatre ? target?.entry.name ?? null : null;
      plate.show(theatre ? null : target?.entry ?? null);
      gl.domElement.style.cursor = target ? "pointer" : "";
      invalidate();
    };
    // Page controls and the HTML sections over the canvas are not products.
    const ui = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        "button,a,input,select,textarea,[data-cinema-controls],.normal-page,.diagonal-next-section",
      );
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      s.pointer = !ui(e.target);
      s.clientX = e.clientX;
      s.clientY = e.clientY;
      if (s.pointer && currentMode() === "theatre") repick.current();
      else pick();
    };
    const leave = () => {
      s.pointer = false;
      s.ticket++;
      select(null);
    };
    // Clicking (or tapping) a product opens the enquiry popup for it.
    const click = (e: MouseEvent) => {
      if (!ui(e.target) && s.selected && currentMode()) openEnquiry(s.selected.entry.name);
    };
    const tap = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || ui(e.target)) return;
      const mode = currentMode();
      if (!mode) return;
      const rect = gl.domElement.getBoundingClientRect();
      void tools
        .pick(
          gl,
          scene,
          camera,
          mode,
          (e.clientX - rect.left) / rect.width,
          (e.clientY - rect.top) / rect.height,
        )
        .then((id) => {
          const target = currentMode() === mode ? tools.target(id, mode) : null;
          if (target) openEnquiry(target.entry.name);
        })
        .catch(() => {});
    };
    window.addEventListener("click", click);
    window.addEventListener("pointerup", tap, { passive: true });
    const unsubscribe = [
      journeyControls.subscribe(() => {
        if (!currentMode()) select(null);
      }),
      projectorControls.subscribe(() => {
        if (!currentMode()) select(null);
      }),
    ];
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    dropSelection.current = () => {
      if (s.selected) select(null);
    };
    // At most one pick per THEATRE_STILL_MS while the mouse or camera keeps moving (not restarted by each move).
    repick.current = () => {
      if (s.pointer && currentMode() === "theatre" && !s.retry)
        s.retry = window.setTimeout(pick, THEATRE_STILL_MS + 16);
    };
    // Local review only (?diagnostics=1).
    const hook = window as unknown as Record<string, unknown>;
    if (
      /^(localhost|127\.)/.test(location.hostname) &&
      new URLSearchParams(location.search).has("diagnostics")
    )
      hook.__hover = {
        mode: currentMode,
        journey: () => journeyControls.read(),
        state: s,
        pick: (x: number, y: number) => {
          const mode = currentMode();
          return mode && tools.pick(gl, scene, camera, mode, x, y);
        },
      };
    return () => {
      delete hook.__hover;
      clearTimeout(s.retry);
      unsubscribe.forEach((off) => off());
      theatreScreenCatalogue.name = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", click);
      window.removeEventListener("pointerup", tap);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      gl.domElement.style.cursor = "";
      plate.dispose();
    };
  }, [gl, scene, camera, invalidate, tools]);

  useFrame((_, delta) => {
    // Projector stops: any camera or pose change hides the inspection and restarts the settle timer.
    // Theatre: the camera glides after the mouse, so a lit outline redraws its mask with this frame's camera and moves
    // with the room (the ID buffer waits for the next pick).
    const s = state.current, mode = currentMode();
    const entering = !!mode && !s.inspecting;
    s.inspecting = !!mode;
    // The catalogue only has a picture at its inspection stops. Finish any outgoing fade or tour first.
    if (!mode && !s.selected && s.fade === 0 && s.tour !== 1 && s.tourStop < 0) return;
    const signature = s.still, next = stillSignature(camera, mode === "theatre" ? null : scene);
    // The room tour (user 2026-11-19), once: as the house lights come up, each object lights on one repeat of the
    // opening cue's echo (story-beat.ts), with its name on the screen; then nothing lights until the mouse finds it.
    let tourStop = -1;
    if (s.tour < 2) {
      const movedAt = journeyControls.read().openingMovedAt;
      if (movedAt > 0 && mode === "theatre") {
        const now = performance.now();
        // Picture behind the music (a slow first frame): the tour still plays once, starting now.
        if (s.tour === 0 && !s.tourAt)
          s.tourAt = now - movedAt > (OPENING_ECHO.first + OPENING_ECHO.every) * 1000 ? now + 300 - OPENING_ECHO.first * 1000 : movedAt;
        const step = Math.floor(((now - s.tourAt) / 1000 - OPENING_ECHO.first) / OPENING_ECHO.every);
        if (step >= OPENING_ECHO.count) {
          s.tour = 2;
          theatreScreenCatalogue.quick = false;
        } else {
          if (step >= 0) tourStop = step;
          invalidate();
        }
      } else if (s.tour === 1) {
        s.tour = 2;
        theatreScreenCatalogue.quick = false;
      }
    }
    if (tourStop !== s.tourStop) {
      s.tourStop = tourStop;
      if (tourStop >= 0 && !s.selected) {
        s.tour = 1;
        tools.sync(gl, scene, camera, "theatre");
        const stop = tools.tourStop(tourStop);
        tools.highlight(stop.group);
        theatreScreenCatalogue.quick = true;
        theatreScreenCatalogue.name = stop.name;
      } else if (!s.selected) theatreScreenCatalogue.name = null;
    }
    const touring = tourStop >= 0 && !s.selected;
    let changed = entering;
    for (let i = 0; i < next.length; i++)
      if (Math.abs(next[i] - signature[i]) > 1e-6) {
        changed = true;
        signature[i] = next[i];
      }
    if (changed) {
      s.lastMove = performance.now();
      if (mode === "theatre") {
        if (touring || s.selected || s.fade > 0) tools.followTheatre(camera);
        else tools.stale();
        repick.current();
      } else {
        tools.stale();
        dropSelection.current();
      }
    }
    const goal = s.selected || touring ? 1 : 0;
    if (touring) tools.sync(gl, scene, camera, "theatre");
    if (s.fade !== goal) {
      const step = Math.min(delta, 0.05) / OUTLINE_FADE;
      s.fade = goal > s.fade ? Math.min(goal, s.fade + step) : Math.max(goal, s.fade - step);
      if (s.fade === 0) tools.highlight([]);
      invalidate();
    }
    if (s.fade > 0 && mode) {
      if (mode === "theatre" && s.selected) tools.sync(gl, scene, camera, mode);
      if (mode === "assembled") tools.drawFocus(gl, s.fade);
      tools.drawOutline(gl, s.fade);
    }
  }, 3);
  return null;
}

function currentMode(): HoverMode | null {
  const journey = journeyControls.read();
  return hoverMode(journey.phase, projectorControls.read().phase, theatreOpening.glasses.value);
}

const signatureScratch = new Float32Array(32);
function stillSignature(camera: Camera, scene: Scene | null) {
  signatureScratch.set(camera.matrixWorld.elements, 0);
  signatureScratch.set(camera.projectionMatrix.elements, 16);
  const projector = scene?.getObjectByName("Projector | Opaque original materials");
  const uniforms = projector?.userData.projectorHover?.uniforms;
  if (uniforms)
    signatureScratch[15] +=
      uniforms.uPoseFrame.value * 1e3 +
      uniforms.uFormation.value +
      (uniforms.uAssemblyTime?.value ?? -1) * 1e5;
  return signatureScratch;
}

function createTools() {
  const ids = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: true,
    generateMipmaps: false,
  });
  // The selected object alone, drawn whole: one channel, CSS-pixel size, 4x MSAA for smooth edges at a small cost.
  const mask = new WebGLRenderTarget(1, 1, {
    format: RedFormat,
    samples: 4,
    depthBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    generateMipmaps: false,
  });
  const selected = new DataTexture(
    new Uint8Array(HOVER_ID.limit * 4),
    HOVER_ID.limit,
    1,
    RGBAFormat,
    UnsignedByteType,
  );
  selected.minFilter = selected.magFilter = NearestFilter;
  selected.needsUpdate = true;
  const outline = new ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uMask: { value: mask.texture },
      uTexel: { value: new Vector2() },
      uRadius: { value: 2 },
      uWidth: { value: OUTLINE_WIDTH },
      uStrength: { value: 1 },
      uTint: { value: new Color(1, 1, 1) },
    },
  });
  const quad = new BufferGeometry();
  quad.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const overlay = new Mesh(quad, outline);
  overlay.frustumCulled = false;
  const overlayScene = new Scene();
  overlayScene.add(overlay);
  let frame = new FramebufferTexture(1, 1);
  const focus = new ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: focusFragment,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uFrame: { value: frame },
      uIds: { value: ids.texture },
      uSelected: { value: selected },
      uTexel: { value: new Vector2() },
      uBlur: { value: 12 },
      uStrength: { value: 0 },
    },
  });
  const focusQuad = new Mesh(quad, focus);
  focusQuad.frustumCulled = false;
  const focusScene = new Scene();
  focusScene.add(focusQuad);
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // The same proxies twice: the ID scene (with occluders, for picking) and the mask scene (catalogue items only).
  const idScene = new Scene(),
    maskScene = new Scene(),
    pickCamera = new Camera();
  pickCamera.matrixAutoUpdate = false;
  pickCamera.matrixWorldAutoUpdate = false;
  const idMaterials = new Map<number, Material>(),
    maskMaterials = new Map<number, Material>();
  const material = (id: number, forMask = false) => {
    const cache = forMask ? maskMaterials : idMaterials;
    let m = cache.get(id);
    if (!m) {
      m = new ShaderMaterial({
        vertexShader: staticVertex,
        fragmentShader: forMask ? maskFragment : idFragment,
        side: DoubleSide,
        defines: forMask ? { MASK: "" } : {},
        uniforms: forMask ? { uId: { value: id }, uSelected: { value: selected } } : { uId: { value: id } },
      });
      cache.set(id, m);
    }
    return m;
  };
  const materialName = (mesh: Mesh) =>
    (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? "";
  type ProjectorHover = {
    poseGLSL: string;
    uniforms: Record<string, { value: unknown }>;
    opticalGeometry: BufferGeometry;
    partNames: string[];
  };
  let projectorMaterials: { id: ShaderMaterial; mask: ShaderMaterial } | undefined;
  const projectorShaders = (hover: ProjectorHover) =>
    (projectorMaterials ??= {
      id: new ShaderMaterial({
        vertexShader: projectorVertex(hover.poseGLSL),
        fragmentShader: projectorFragment,
        side: DoubleSide,
        uniforms: hover.uniforms,
      }),
      mask: new ShaderMaterial({
        vertexShader: projectorVertex(hover.poseGLSL),
        fragmentShader: projectorMaskFragment,
        side: DoubleSide,
        defines: { MASK: "" },
        uniforms: { ...hover.uniforms, uSelected: { value: selected } },
      }),
    });
  // Part names arrive with the lazily loaded projector (keeps its formation data out of the opening bundle).
  const partGroup = new Map<number, { parts: number[]; entry: CatalogueEntry }>(),
    allParts: number[] = [];
  const indexParts = (parts: string[]) => {
    if (allParts.length) return;
    [...projectorGroups(parts).values()].forEach((group, i) => {
      const entry = { no: i + 1, ...group.entry };
      group.parts.forEach((part) => partGroup.set(part, { parts: group.parts, entry }));
    });
    parts.forEach((_, i) => allParts.push(HOVER_ID.projector + i));
  };
  // `current`: the proxies match the scene as it is now. `pose` counts camera poses copied into pickCamera; each
  // target remembers the pose (and, for the mask, the selection) it was last drawn with, so it is drawn only when asked
  // for and out of date: the ID buffer by a pick or the projector focus, the mask by a lit outline.
  let collected: HoverMode | null = null,
    current = false,
    pose = 0,
    idsPose = -1,
    maskPose = -1,
    sizeKey = "";
  const drawingSize = new Vector2(),
    clearColour = new Color();
  function setPose(camera: Camera) {
    pickCamera.matrixWorld.copy(camera.matrixWorld);
    pickCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
    pickCamera.projectionMatrix.copy(camera.projectionMatrix);
    pickCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    pose++;
  }
  function draw(gl: WebGLRenderer, target: WebGLRenderTarget, source: Scene) {
    const previous = gl.getRenderTarget(),
      auto = gl.autoClear,
      colour = gl.getClearColor(clearColour),
      alpha = gl.getClearAlpha();
    try {
      gl.setRenderTarget(target);
      gl.setClearColor(0x000000, 1);
      gl.autoClear = true;
      gl.render(source, pickCamera);
    } finally {
      gl.setRenderTarget(previous);
      gl.autoClear = auto;
      gl.setClearColor(colour, alpha);
    }
  }
  const idsAtPose = (gl: WebGLRenderer) => {
    if (idsPose === pose) return;
    draw(gl, ids, idScene);
    idsPose = pose;
  };
  const maskAtPose = (gl: WebGLRenderer) => {
    if (maskPose === pose) return;
    draw(gl, mask, maskScene);
    maskPose = pose;
  };
  const theatreEntries = new Map(
    THEATRE_CATALOGUE.map((item, i) => [
      item.key,
      { id: HOVER_ID.theatre + i, entry: { no: i + 1, ...item.entry } },
    ]),
  );
  const theatreIds = new Map([...theatreEntries.values()].map((value) => [value.id, value]));
  const seatCount = { value: 0 };

  /** Rebuild both proxy scenes from the live scene graph: catalogue items get their IDs (and a mask twin), other
   * visible theatre meshes only occlude in the ID scene, with 0. */
  function collect(scene: Scene, mode: HoverMode) {
    idScene.clear();
    maskScene.clear();
    const proxy = (source: Mesh, mat: Material, geometry = source.geometry) => {
      const copy =
        source instanceof InstancedMesh && geometry === source.geometry
          ? new InstancedMesh(geometry, mat, source.count)
          : new Mesh(geometry, mat);
      if (copy instanceof InstancedMesh && source instanceof InstancedMesh)
        copy.instanceMatrix = source.instanceMatrix;
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(source.matrixWorld);
      copy.frustumCulled = false;
      return copy;
    };
    if (mode === "theatre") {
      const occluders = new Set<Object3D>();
      scene.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        const key = theatreKey(object.name, materialName(object));
        if (key) {
          const id = key === "seats" ? HOVER_ID.seats : theatreEntries.get(key)!.id;
          if (key === "seats") seatCount.value = (object as InstancedMesh).count;
          idScene.add(proxy(object, material(id)));
          maskScene.add(proxy(object, material(id, true)));
          // The theatre's own top-level group (not the whole scene: the sofas sit directly under it).
          let root: Object3D = object;
          while (root.parent && root.parent !== scene) root = root.parent;
          if (root !== object) occluders.add(root);
        }
      });
      // Remaining opaque meshes in the theatre's own groups only hide what is behind them (picking, not the outline).
      occluders.forEach((root) =>
        root.traverseVisible((object) => {
          if (
            !(object instanceof Mesh) ||
            object.userData.projectorHover ||
            theatreKey(object.name, materialName(object))
          )
            return;
          const first = Array.isArray(object.material) ? object.material[0] : object.material;
          if (first && !first.transparent && object.geometry.getAttribute("position"))
            idScene.add(proxy(object, material(0)));
        }),
      );
    } else {
      const projector = scene.getObjectByName("Projector | Opaque original materials") as Mesh | undefined;
      const hover = projector?.userData.projectorHover as ProjectorHover | undefined;
      if (!projector || !hover) return;
      indexParts(hover.partNames);
      const shaders = projectorShaders(hover);
      idScene.add(proxy(projector, shaders.id), proxy(projector, shaders.id, hover.opticalGeometry));
      maskScene.add(proxy(projector, shaders.mask), proxy(projector, shaders.mask, hover.opticalGeometry));
    }
  }

  const tools = {
    /** The scene may have changed: collect the proxies again before the next use. */
    stale() {
      current = false;
    },
    /** Proxies collected for this mode and the targets sized to the drawing buffer. */
    sync(gl: WebGLRenderer, scene: Scene, camera: Camera, mode: HoverMode) {
      const size = gl.getDrawingBufferSize(drawingSize),
        ratio = gl.getPixelRatio(),
        key = `${size.x}x${size.y}@${ratio}`;
      if (key !== sizeKey) {
        sizeKey = key;
        ids.setSize(size.x, size.y);
        const css = Math.max(1, ratio);
        mask.setSize(Math.max(1, Math.round(size.x / css)), Math.max(1, Math.round(size.y / css)));
        outline.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
        outline.uniforms.uRadius.value = OUTLINE_RADIUS * ratio;
        outline.uniforms.uWidth.value = OUTLINE_WIDTH * ratio;
        current = false;
      }
      if (!current || collected !== mode) {
        collect(scene, mode);
        collected = mode;
        current = true;
        setPose(camera);
      }
    },
    /** Draw the ID buffer for the resting pose if it is out of date, then read one pixel back. */
    pick(gl: WebGLRenderer, scene: Scene, camera: Camera, mode: HoverMode, x: number, y: number) {
      tools.sync(gl, scene, camera, mode);
      idsAtPose(gl);
      const px = Math.min(ids.width - 1, Math.max(0, Math.floor(x * ids.width))),
        py = Math.min(ids.height - 1, Math.max(0, Math.floor((1 - y) * ids.height)));
      return gl
        .readRenderTargetPixelsAsync(ids, px, py, 1, 1, new Uint8Array(4))
        .then((pixel) => pixel[0] + pixel[1] * 256);
    },
    /** Compile the theatre ID, mask and outline shaders off-thread, through the real collect/draw path (dry run),
     * so the first hover does not compile them on the spot. */
    prepare(gl: WebGLRenderer, scene: Scene, camera: Camera) {
      return compileByDryRun(gl, () => {
        collect(scene, "theatre");
        collected = "theatre";
        setPose(camera);
        draw(gl, ids, idScene);
        draw(gl, mask, maskScene);
        current = false;
        const target = gl.getRenderTarget();
        try {
          gl.setRenderTarget(null);
          gl.render(overlayScene, ortho);
        } finally {
          gl.setRenderTarget(target);
        }
      });
    },
    /** The projector's ID and mask shaders, once the projector exists (its stops are the only users). */
    prepareProjector(gl: WebGLRenderer, scene: Scene) {
      const projector = scene.getObjectByName("Projector | Opaque original materials") as Mesh | undefined,
        hover = projector?.userData.projectorHover as ProjectorHover | undefined;
      if (!projector || !hover || projectorMaterials) return Promise.resolve();
      projectorShaders(hover);
      return compileByDryRun(gl, () => {
        collect(scene, "exploded");
        collected = "exploded";
        draw(gl, ids, idScene);
        draw(gl, mask, maskScene);
        current = false;
      });
    },
    target(id: number, mode: HoverMode): Target | null {
      if (id <= 0) return null;
      if (mode === "assembled")
        return id >= HOVER_ID.projector
          ? { id, entry: { no: 1, ...ASSEMBLED_ENTRY }, group: allParts }
          : null;
      if (mode === "exploded") {
        const group = partGroup.get(id - HOVER_ID.projector);
        return group
          ? { id, entry: group.entry, group: group.parts.map((part) => HOVER_ID.projector + part) }
          : null;
      }
      if (id >= HOVER_ID.seats && id < HOVER_ID.seats + seatCount.value)
        return { id, entry: theatreEntries.get("seats")!.entry, group: [id] };
      const item = theatreIds.get(id);
      return item ? { id, entry: item.entry, group: [id] } : null;
    },
    highlight(group: number[]) {
      maskPose = -1;
      const data = selected.image.data as Uint8Array;
      data.fill(0);
      for (const id of group) if (id < HOVER_ID.limit) data[id * 4] = 255;
      selected.needsUpdate = true;
    },
    /** Theatre glide: the next outline and pick use this camera (proxies kept; the room does not move). */
    followTheatre(camera: Camera) {
      if (collected === "theatre" && current) setPose(camera);
      else current = false;
    },
    /** One stop of the room tour: its objects' IDs and the name for the screen. */
    tourStop(index: number) {
      const keys = TOUR_STOPS[index];
      return {
        group: keys.flatMap((key) =>
          key === "seats"
            ? Array.from({ length: seatCount.value }, (_, i) => HOVER_ID.seats + i)
            : [theatreEntries.get(key)!.id],
        ),
        name: theatreEntries.get(keys[0])!.entry.name,
      };
    },
    /** Assembled projector only. */
    drawFocus(gl: WebGLRenderer, strength: number) {
      if (!current || collected === "theatre") return;
      idsAtPose(gl);
      const size = gl.getDrawingBufferSize(drawingSize);
      if (frame.image.width !== size.x || frame.image.height !== size.y) {
        frame.dispose();
        frame = new FramebufferTexture(size.x, size.y);
        frame.minFilter = frame.magFilter = LinearFilter;
        focus.uniforms.uFrame.value = frame;
      }
      focus.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
      focus.uniforms.uBlur.value = 12 * gl.getPixelRatio();
      focus.uniforms.uStrength.value = strength * strength * (3 - 2 * strength);
      const target = gl.getRenderTarget(),
        auto = gl.autoClear;
      try {
        gl.setRenderTarget(null);
        gl.copyFramebufferToTexture(frame);
        gl.autoClear = false;
        gl.render(focusScene, ortho);
      } finally {
        gl.setRenderTarget(target);
        gl.autoClear = auto;
      }
    },
    drawOutline(gl: WebGLRenderer, strength: number) {
      if (!current) return;
      maskAtPose(gl);
      const assembled = collected === "assembled",
        line = assembled ? 0.22 : collected === "exploded" ? 0.78 : 0.92;
      outline.uniforms.uStrength.value = line * strength * strength * (3 - 2 * strength);
      outline.uniforms.uTint.value.setRGB(assembled ? 0.84 : 1, assembled ? 0.92 : 1, 1);
      const target = gl.getRenderTarget(),
        auto = gl.autoClear;
      try {
        gl.setRenderTarget(null);
        gl.autoClear = false;
        gl.render(overlayScene, ortho);
      } finally {
        gl.setRenderTarget(target);
        gl.autoClear = auto;
      }
    },
    dispose() {
      ids.dispose();
      mask.dispose();
      selected.dispose();
      outline.dispose();
      focus.dispose();
      frame.dispose();
      quad.dispose();
      for (const cache of [idMaterials, maskMaterials]) {
        cache.forEach((m) => m.dispose());
        cache.clear();
      }
      projectorMaterials?.id.dispose();
      projectorMaterials?.mask.dispose();
      idScene.clear();
      maskScene.clear();
    },
  };
  return tools;
}

/** Lower-third catalogue plate, styled like a film subtitle (see .hover-plate in globals.css). */
function createPlate() {
  const root = document.createElement("div");
  root.className = "hover-plate";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.innerHTML = `<p class="hover-plate__meta"><span data-no></span><span class="hover-plate__rule"></span><span data-category></span></p><p class="hover-plate__title" data-name></p><p class="hover-plate__hint">Enquire for a quote</p>`;
  document.body.appendChild(root);
  const field = (name: string) => root.querySelector(`[data-${name}]`)!;
  return {
    show(entry: CatalogueEntry | null) {
      if (!entry) {
        root.removeAttribute("data-on");
        return;
      }
      field("no").textContent = formatNumber(entry.no);
      field("category").textContent = entry.category;
      field("name").textContent = entry.name;
      root.setAttribute("data-on", "");
    },
    dispose() {
      root.remove();
    },
  };
}
