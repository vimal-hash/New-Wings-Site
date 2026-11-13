"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferGeometry, Camera, Color, DataTexture, FramebufferTexture, LinearFilter, DoubleSide, Float32BufferAttribute, InstancedMesh, Mesh, NearestFilter, Object3D, OrthographicCamera, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, Vector2, WebGLRenderTarget, type Material, type WebGLRenderer } from "three";
import { journeyControls } from "./journey-controls";
import { projectorControls } from "./projector-controls";
import { theatreOpening } from "./theatre-opening-state";
import {theatreScreenCatalogue} from "./theatre-screen-catalogue";
import {openEnquiry} from "./enquiry";
import { scheduleSceneIdle } from "./scene-idle";
import { compileByDryRun } from "./hidden-gpu-preparation";
import { ASSEMBLED_ENTRY, formatNumber, HOVER_ID, hoverMode, projectorGroups, THEATRE_CATALOGUE, theatreKey, type CatalogueEntry, type HoverMode } from "./hover-catalogue-state";

/** Settle time after the last camera change before hover is offered. */
const STILL_MS = 220;
const THEATRE_STILL_MS=120;

const idFragment = `flat varying float vId;void main(){float id=floor(vId+.5);gl_FragColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);}`;
/** Static (and instanced) surfaces: one ID per mesh, or per sofa instance. */
const staticVertex = `uniform float uId;flat varying float vId;void main(){vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;vId=uId+float(gl_InstanceID);
#else
vId=uId;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`;
/** Projector: the same pose texture as the visible rig, so exploded parts pick and outline where they are drawn. */
const projectorVertex = (poseGLSL: string) => `${poseGLSL}flat varying float vId;varying float vHide;
void main(){readPart();vec3 p=rotatePart(partRotation,position*partScale)+partPosition;vId=${HOVER_ID.projector}.+floor(aPart+.5);
vHide=1.-step(.5,vPartVisible);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const projectorFragment = `flat varying float vId;varying float vHide;void main(){if(vHide>.5)discard;float id=floor(vId+.5);gl_FragColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);}`;

/**
 * Outline drawn over the finished frame: a thin anti-aliased white line on the selected IDs' edge, plus a faint fill.
 * The ID buffer is one hard sample per pixel, so the edge is found from the share of a small disc that is selected:
 * a half-covered disc is exactly on the edge. That turns the pixel steps into a smooth line.
 */
const outlineVertex = `varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`;
const outlineFragment = `uniform sampler2D uIds,uSelected;uniform vec2 uTexel;uniform float uRadius,uStrength,uLine,uGlow,uFill;uniform vec3 uTint;varying vec2 vUv;
float sel(vec2 uv){vec4 c=textureLod(uIds,uv,0.);float id=floor(c.r*255.+.5)+floor(c.g*255.+.5)*256.;return textureLod(uSelected,vec2((id+.5)/${HOVER_ID.limit}.,.5),0.).r;}
void main(){vec2 r=uTexel*uRadius;float ring=0.,centre=sel(vUv);
// Most of the screen is far from the selection: eight taps settle it.
for(int i=0;i<8;i++){float a=float(i)*.7854;ring+=sel(vUv+vec2(cos(a),sin(a))*r);}
if(ring+centre<.5){
  if(uGlow<=0.)discard;
  float halo=0.;
  for(int i=0;i<8;i++){float a=float(i)*.7854;vec2 d=vec2(cos(a),sin(a))*r;halo+=sel(vUv+d*2.)*.65+sel(vUv+d*3.5)*.35;}
  if(halo==0.)discard;
  gl_FragColor=vec4(uTint,halo*.125*uGlow*uStrength);return;
}
if(ring+centre>8.5){gl_FragColor=vec4(uTint,uFill*uStrength);return;}
float covered=0.;
for(int i=0;i<24;i++){float k=float(i)+.5,a=k*2.39996;covered+=sel(vUv+vec2(cos(a),sin(a))*r*sqrt(k/24.));}
covered/=24.;
float line=smoothstep(0.,1.,1.-abs(covered*2.-1.)),fill=smoothstep(.5,1.,covered);
gl_FragColor=vec4(uTint,(line*uLine+fill*uFill)*uStrength);}`;
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
const OUTLINE_FADE = .18;

type Target = { id: number; entry: CatalogueEntry; group: number[] };

/** Theatre and projector inspection: outline + small catalogue plate, only while the camera rests at a stop. */
export default function HoverCatalogue() {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene), camera = useThree(s => s.camera), invalidate = useThree(s => s.invalidate);
  const tools = useMemo(() => createTools(), []);
  const state = useRef({ x: -1, y: -1, pointer: false, lastMove: 0, still: new Float32Array(32), selected: null as Target | null, retry: 0, fade: 0, ticket: 0 });
  const dropSelection = useRef(() => {});
  const repick = useRef(() => {});
  useEffect(() => () => tools.dispose(), [tools]);
  useEffect(() => {
    // Off-thread shader preparation, never on the first hover. The theatre's once the opening scene is
    // prepared (the first hover can come straight after the opening); the projector's at its next resting stop.
    let projectorJob = () => {}, theatreDone = false;
    const theatre = () => {
      if (theatreDone || !journeyControls.read().openingPrepared) return;
      theatreDone = true; void tools.prepare(gl, scene, camera).catch(() => {});
    };
    const cancel = journeyControls.subscribe(theatre); theatre();
    const offProjector = projectorControls.subscribe(() => {
      if (!projectorControls.read().ready) return;
      projectorJob(); projectorJob = scheduleSceneIdle(() => { void tools.prepareProjector(gl, scene).catch(() => {}); }, 5);
    });
    return () => { cancel(); projectorJob(); offProjector(); };
  }, [tools, gl, scene, camera]);

  useEffect(() => {
    const plate = createPlate();
    const s = state.current;
    const pick = () => {
      clearTimeout(s.retry);s.retry=0;
      if (!s.pointer) return select(null);
      const mode = currentMode();
      if (!mode) return select(null);
      // The theatre camera glides after the mouse for a second or two; its picks follow the glide instead of waiting for it to end.
      const wait=mode==="theatre"?0:s.lastMove+STILL_MS-performance.now();
      if(wait>0){s.retry=window.setTimeout(pick,wait+16);return;}
      // The pixel is read back asynchronously (no GPU stall); a newer pick or a change of stop discards older answers.
      const ticket=++s.ticket;
      void tools.pick(gl, scene, camera, mode, s.x, s.y).then(id=>{
        if(ticket!==s.ticket||!s.pointer||currentMode()!==mode)return;
        select(tools.target(id,mode));
        invalidate();
      }).catch(()=>{});
    };
    const select = (target: Target | null) => {
      if (target?.id===s.selected?.id&&target?.entry.name===s.selected?.entry.name)return;
      const theatre=currentMode()==="theatre";
      // Leaving keeps the last group lit while its outline fades out (cleared in the frame loop).
      s.selected=target;if(target)tools.highlight(target.group);
      theatreScreenCatalogue.name=theatre?target?.entry.name??null:null;
      plate.show(theatre?null:target?.entry??null);
      gl.domElement.style.cursor=target?"pointer":"";
      invalidate();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const ui=e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,[data-cinema-controls],.normal-page,.diagonal-next-section');
      s.pointer=!ui;
      const rect = gl.domElement.getBoundingClientRect();
      s.x = (e.clientX - rect.left) / rect.width; s.y = (e.clientY - rect.top) / rect.height;
      if(s.pointer&&currentMode()==="theatre")repick.current();
      else pick();
    };
    const leave = () => { s.pointer = false; s.ticket++; select(null); };
    // Clicking (or tapping) a product opens the enquiry popup for it.
    const ui=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('button,a,input,select,textarea,[data-cinema-controls],.normal-page,.diagonal-next-section');
    const click=(e:MouseEvent)=>{if(!ui(e.target)&&s.selected&&currentMode())openEnquiry(s.selected.entry.name);};
    const tap=(e:PointerEvent)=>{
      if(e.pointerType!=="touch"||ui(e.target))return;
      const mode=currentMode();if(!mode)return;
      const rect=gl.domElement.getBoundingClientRect();
      void tools.pick(gl,scene,camera,mode,(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height).then(id=>{const target=currentMode()===mode?tools.target(id,mode):null;if(target)openEnquiry(target.entry.name);}).catch(()=>{});
    };
    window.addEventListener("click", click);window.addEventListener("pointerup", tap, { passive: true });
    const unsubscribe = [journeyControls.subscribe(() => { if (!currentMode()) select(null); }), projectorControls.subscribe(() => { if (!currentMode()) select(null); })];
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    dropSelection.current = () => { if (s.selected) select(null); };
    // At most one pick per THEATRE_STILL_MS while the mouse or camera keeps moving (not restarted by each move).
    repick.current=()=>{if(s.pointer&&currentMode()==="theatre"&&!s.retry)s.retry=window.setTimeout(pick,THEATRE_STILL_MS+16);};
    // Local review only (?diagnostics=1).
    const hook = window as unknown as Record<string, unknown>;
    if (/^(localhost|127\.)/.test(location.hostname) && new URLSearchParams(location.search).has("diagnostics"))
      hook.__hover = { mode: currentMode, journey: () => journeyControls.read(), state: s, pick: (x: number, y: number) => { const mode = currentMode(); return mode && tools.pick(gl, scene, camera, mode, x, y); } };
    return () => {
      delete hook.__hover;
      clearTimeout(s.retry); unsubscribe.forEach(off => off());
      theatreScreenCatalogue.name=null;
      window.removeEventListener("pointermove", move); window.removeEventListener("click", click); window.removeEventListener("pointerup", tap); document.removeEventListener("pointerleave", leave); window.removeEventListener("blur", leave);
      gl.domElement.style.cursor = ""; plate.dispose();
    };
  }, [gl, scene, camera, invalidate, tools]);

  useFrame((_, delta) => {
    // Projector stops: any camera or pose change hides the inspection and restarts the settle timer.
    // Theatre: the camera glides after the mouse, so a lit outline redraws its IDs with this frame's camera and moves with the room.
    const s = state.current, signature = s.still, next = stillSignature(camera, scene),mode=currentMode();
    const seatCue=mode==="theatre"&&theatreOpening.house.value>=1&&!s.selected;
    let changed = false;
    for (let i = 0; i < next.length; i++) if (Math.abs(next[i] - signature[i]) > 1e-6) { changed = true; signature[i] = next[i]; }
    if (changed) {
      s.lastMove=performance.now();
      if(mode==="theatre"){
        if(seatCue||s.selected||s.fade>0)tools.followTheatre(gl,camera);
        else tools.stale();
        repick.current();
      }
      else{tools.stale();dropSelection.current();}
    }
    const goal=s.selected?1:seatCue ? .65 : 0;
    if(seatCue)tools.showSeatCue(gl,scene,camera);
    if(s.fade!==goal){
      const step=Math.min(delta,.05)/OUTLINE_FADE;
      s.fade=goal>s.fade?Math.min(goal,s.fade+step):Math.max(goal,s.fade-step);
      if(s.fade===0)tools.highlight([]);
      invalidate();
    }
    if (s.fade>0&&mode) {
      if(mode==="theatre"&&s.selected)tools.ensureIds(gl,scene,camera,mode);
      if(mode==="assembled")tools.drawFocus(gl,s.fade);
      tools.drawOutline(gl,s.fade,seatCue);
    }
  }, 3);
  return null;
}

function currentMode(): HoverMode | null {
  const journey = journeyControls.read();
  return hoverMode(journey.phase, projectorControls.read().phase, theatreOpening.glasses.value);
}

const signatureScratch = new Float32Array(32);
function stillSignature(camera: Camera, scene: Scene) {
  signatureScratch.set(camera.matrixWorld.elements, 0); signatureScratch.set(camera.projectionMatrix.elements, 16);
  const projector = scene.getObjectByName("Projector | Opaque original materials");
  const uniforms = projector?.userData.projectorHover?.uniforms;
  if (uniforms) signatureScratch[15] += uniforms.uPoseFrame.value * 1e3 + uniforms.uFormation.value + (uniforms.uAssemblyTime?.value ?? -1) * 1e5;
  return signatureScratch;
}

function createTools() {
  const ids = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true, generateMipmaps: false });
  const selected = new DataTexture(new Uint8Array(HOVER_ID.limit * 4), HOVER_ID.limit, 1, RGBAFormat, UnsignedByteType);
  selected.minFilter = selected.magFilter = NearestFilter; selected.needsUpdate = true;
  const outline = new ShaderMaterial({ vertexShader: outlineVertex, fragmentShader: outlineFragment, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uIds: { value: ids.texture }, uSelected: { value: selected }, uTexel: { value: new Vector2() }, uRadius: { value: 1.6 }, uStrength: { value: 1 }, uLine: { value: .92 }, uGlow:{value:0},uFill:{value:.045},uTint: { value: new Color(1, 1, 1) } } });
  const quad = new BufferGeometry(); quad.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const overlay = new Mesh(quad, outline); overlay.frustumCulled = false;
  const overlayScene = new Scene(); overlayScene.add(overlay);
  let frame = new FramebufferTexture(1, 1);
  const focus = new ShaderMaterial({ vertexShader: outlineVertex, fragmentShader: focusFragment, depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uFrame: { value: frame }, uIds: { value: ids.texture }, uSelected: { value: selected }, uTexel: { value: new Vector2() }, uBlur: { value: 12 }, uStrength: { value: 0 } } });
  const focusQuad = new Mesh(quad, focus); focusQuad.frustumCulled = false;
  const focusScene = new Scene(); focusScene.add(focusQuad);
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const idScene = new Scene(), pickCamera = new Camera();
  pickCamera.matrixAutoUpdate = false; pickCamera.matrixWorldAutoUpdate = false;
  const materials = new Map<number, Material>();
  const material = (id: number) => { let m = materials.get(id); if (!m) { m = new ShaderMaterial({ vertexShader: staticVertex, fragmentShader: idFragment, side: DoubleSide, uniforms: { uId: { value: id } } }); materials.set(id, m); } return m; };
  const materialName = (mesh: Mesh) => (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? "";
  let projectorMaterial: ShaderMaterial | undefined;
  // Part names arrive with the lazily loaded projector (keeps its formation data out of the opening bundle).
  const partGroup = new Map<number, { parts: number[]; entry: CatalogueEntry }>(), allParts: number[] = [];
  const indexParts = (parts: string[]) => {
    if (allParts.length) return;
    [...projectorGroups(parts).values()].forEach((group, i) => { const entry = { no: i + 1, ...group.entry }; group.parts.forEach(part => partGroup.set(part, { parts: group.parts, entry })); });
    parts.forEach((_, i) => allParts.push(HOVER_ID.projector + i));
  };
  let fresh = false, collected: HoverMode | null = null, cueCount=-1;
  const drawingSize = new Vector2(), clearColour = new Color();
  function renderIds(gl: WebGLRenderer, camera: Camera) {
    pickCamera.matrixWorld.copy(camera.matrixWorld); pickCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
    pickCamera.projectionMatrix.copy(camera.projectionMatrix); pickCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    const target = gl.getRenderTarget(), auto = gl.autoClear, colour = gl.getClearColor(clearColour), alpha = gl.getClearAlpha();
    try { gl.setRenderTarget(ids); gl.setClearColor(0x000000, 1); gl.autoClear = true; gl.render(idScene, pickCamera); }
    finally { gl.setRenderTarget(target); gl.autoClear = auto; gl.setClearColor(colour, alpha); }
    fresh = true;
  }
  const theatreEntries = new Map(THEATRE_CATALOGUE.map((item, i) => [item.key, { id: HOVER_ID.theatre + i, entry: { no: i + 1, ...item.entry } }]));
  const theatreIds = new Map([...theatreEntries.values()].map(value => [value.id, value]));
  const seatCount = { value: 0 };

  /** Rebuild the ID scene from the live scene graph: catalogue items get their IDs, other visible theatre meshes occlude with 0. */
  function collect(scene: Scene, mode: HoverMode) {
    idScene.clear();
    const add = (source: Mesh, mat: Material) => {
      const proxy = source instanceof InstancedMesh ? new InstancedMesh(source.geometry, mat, source.count) : new Mesh(source.geometry, mat);
      if (proxy instanceof InstancedMesh && source instanceof InstancedMesh) proxy.instanceMatrix = source.instanceMatrix;
      proxy.matrixAutoUpdate = false; proxy.matrix.copy(source.matrixWorld); proxy.frustumCulled = false; idScene.add(proxy);
    };
    if (mode === "theatre") {
      const occluders = new Set<Object3D>();
      scene.traverseVisible(object => {
        if (!(object instanceof Mesh)) return;
        const key = theatreKey(object.name, materialName(object));
        if (key) {
          const item = theatreEntries.get(key)!;
          if (key === "seats") { seatCount.value = (object as InstancedMesh).count; add(object, material(HOVER_ID.seats)); }
          else add(object, material(item.id));
          // The theatre's own top-level group (not the whole scene: the sofas sit directly under it).
          let root: Object3D = object; while (root.parent && root.parent !== scene) root = root.parent;
          if (root !== object) occluders.add(root);
        }
      });
      // Remaining opaque meshes in the theatre's own groups only hide what is behind them.
      occluders.forEach(root => root.traverseVisible(object => {
        if (!(object instanceof Mesh) || object.userData.projectorHover || theatreKey(object.name, materialName(object))) return;
        const first = Array.isArray(object.material) ? object.material[0] : object.material;
        if (first && !first.transparent && object.geometry.getAttribute("position")) add(object, material(0));
      }));
    } else {
      const projector = scene.getObjectByName("Projector | Opaque original materials") as Mesh | undefined;
      const hover = projector?.userData.projectorHover;
      if (!projector || !hover) return;
      indexParts(hover.partNames);
      projectorMaterial ??= new ShaderMaterial({ vertexShader: projectorVertex(hover.poseGLSL), fragmentShader: projectorFragment, side: DoubleSide, uniforms: hover.uniforms });
      add(projector, projectorMaterial);
      const optical = new Mesh(hover.opticalGeometry, projectorMaterial); optical.matrixAutoUpdate = false; optical.matrix.copy(projector.matrixWorld); optical.frustumCulled = false; idScene.add(optical);
    }
  }

  const tools = {
    stale() { fresh = false; },
    ensureIds(gl: WebGLRenderer, scene: Scene, camera: Camera, mode: HoverMode) {
      const size = gl.getDrawingBufferSize(drawingSize);
      if (!fresh || collected!==mode || ids.width !== size.x || ids.height !== size.y) {
        ids.setSize(size.x, size.y); collect(scene, mode); collected = mode;
        renderIds(gl, camera);
        outline.uniforms.uTexel.value.set(1 / size.x, 1 / size.y); outline.uniforms.uRadius.value = 2 * gl.getPixelRatio();
      }
    },
    /** Render the ID buffer once per resting pose, then read one pixel. */
    pick(gl: WebGLRenderer, scene: Scene, camera: Camera, mode: HoverMode, x: number, y: number) {
      tools.ensureIds(gl,scene,camera,mode);
      const px = Math.min(ids.width - 1, Math.max(0, Math.floor(x * ids.width))), py = Math.min(ids.height - 1, Math.max(0, Math.floor((1 - y) * ids.height)));
      return gl.readRenderTargetPixelsAsync(ids, px, py, 1, 1, new Uint8Array(4)).then(pixel => pixel[0] + pixel[1] * 256);
    },
    /** Compile the theatre ID and outline shaders off-thread, through the real collect/draw path (dry run),
     * so the first hover does not compile them on the spot. */
    prepare(gl: WebGLRenderer, scene: Scene, camera: Camera) {
      return compileByDryRun(gl, () => {
        collect(scene, "theatre"); collected = "theatre"; renderIds(gl, camera); fresh = false;
        const target = gl.getRenderTarget();
        try { gl.setRenderTarget(null); gl.render(overlayScene, ortho); } finally { gl.setRenderTarget(target); }
      });
    },
    /** The projector's ID shader, once the projector exists (its stops are the only users). */
    prepareProjector(gl: WebGLRenderer, scene: Scene) {
      const projector = scene.getObjectByName("Projector | Opaque original materials") as Mesh | undefined, hover = projector?.userData.projectorHover;
      if (!projector || !hover || projectorMaterial) return Promise.resolve();
      projectorMaterial = new ShaderMaterial({ vertexShader: projectorVertex(hover.poseGLSL), fragmentShader: projectorFragment, side: DoubleSide, uniforms: hover.uniforms });
      return compileByDryRun(gl, () => { collect(scene, "exploded"); collected = "exploded"; renderIds(gl, pickCamera); fresh = false; });
    },
    target(id: number, mode: HoverMode): Target | null {
      if (id <= 0) return null;
      if (mode === "assembled") return id >= HOVER_ID.projector ? { id, entry: { no: 1, ...ASSEMBLED_ENTRY }, group: allParts } : null;
      if (mode === "exploded") { const group = partGroup.get(id - HOVER_ID.projector); return group ? { id, entry: group.entry, group: group.parts.map(part => HOVER_ID.projector + part) } : null; }
      if (id >= HOVER_ID.seats && id < HOVER_ID.seats + seatCount.value) return { id, entry: theatreEntries.get("seats")!.entry, group: [id] };
      const item = theatreIds.get(id);
      return item ? { id, entry: item.entry, group: [id] } : null;
    },
    highlight(group: number[]) {
      cueCount=-1;
      const data = selected.image.data as Uint8Array; data.fill(0);
      for (const id of group) if (id < HOVER_ID.limit) data[id * 4] = 255;
      selected.needsUpdate = true;
    },
    followTheatre(gl:WebGLRenderer,camera:Camera) {
      const size=gl.getDrawingBufferSize(drawingSize);
      if(collected==="theatre"&&fresh&&ids.width===size.x&&ids.height===size.y)renderIds(gl,camera);
      else fresh=false;
    },
    showSeatCue(gl:WebGLRenderer,scene:Scene,camera:Camera) {
      tools.ensureIds(gl,scene,camera,"theatre");
      if(cueCount===seatCount.value)return;
      tools.highlight(Array.from({length:seatCount.value},(_,i)=>HOVER_ID.seats+i));
      cueCount=seatCount.value;
    },
    /** Assembled projector only. */
    drawFocus(gl: WebGLRenderer, strength: number) {
      if (!fresh || collected === "theatre") return;
      const size = gl.getDrawingBufferSize(drawingSize);
      if (frame.image.width !== size.x || frame.image.height !== size.y) {
        frame.dispose(); frame = new FramebufferTexture(size.x, size.y); frame.minFilter = frame.magFilter = LinearFilter; focus.uniforms.uFrame.value = frame;
      }
      focus.uniforms.uTexel.value.set(1 / size.x, 1 / size.y); focus.uniforms.uBlur.value = 12 * gl.getPixelRatio();
      focus.uniforms.uStrength.value = strength * strength * (3 - 2 * strength);
      const target = gl.getRenderTarget(), auto = gl.autoClear;
      try { gl.setRenderTarget(null); gl.copyFramebufferToTexture(frame); gl.autoClear = false; gl.render(focusScene, ortho); }
      finally { gl.setRenderTarget(target); gl.autoClear = auto; }
    },
    drawOutline(gl: WebGLRenderer, strength: number, seatCue:boolean) {
      if (!fresh) return;
      outline.uniforms.uStrength.value = strength * strength * (3 - 2 * strength);
      const assembled=collected==="assembled",exploded=collected==="exploded";
      outline.uniforms.uLine.value = assembled ? .22 : exploded ? .78 : .92;
      outline.uniforms.uTint.value.setRGB(assembled ? .84 : 1, assembled ? .92 : 1, 1);
      outline.uniforms.uGlow.value=exploded ? .30 : 0;
      outline.uniforms.uFill.value=seatCue ? 0 : exploded ? .065 : .045;
      const target = gl.getRenderTarget(), auto = gl.autoClear;
      try { gl.setRenderTarget(null); gl.autoClear = false; gl.render(overlayScene, ortho); }
      finally { gl.setRenderTarget(target); gl.autoClear = auto; }
    },
    dispose() { ids.dispose(); selected.dispose(); outline.dispose(); focus.dispose(); frame.dispose(); quad.dispose(); materials.forEach(m => m.dispose()); materials.clear(); projectorMaterial?.dispose(); idScene.clear(); },
  };
  return tools;
}

/** Lower-third catalogue plate, styled like a film subtitle (see .hover-plate in globals.css). */
function createPlate() {
  const root = document.createElement("div"); root.className = "hover-plate"; root.setAttribute("role", "status"); root.setAttribute("aria-live", "polite");
  root.innerHTML = `<p class="hover-plate__meta"><span data-no></span><span class="hover-plate__rule"></span><span data-category></span></p><p class="hover-plate__title" data-name></p><p class="hover-plate__hint">Enquire for a quote</p>`;
  document.body.appendChild(root);
  const field = (name: string) => root.querySelector(`[data-${name}]`)!;
  return {
    show(entry: CatalogueEntry | null) {
      if (!entry) { root.removeAttribute("data-on"); return; }
      field("no").textContent = formatNumber(entry.no); field("category").textContent = entry.category;
      field("name").textContent = entry.name;
      root.setAttribute("data-on", "");
    },
    dispose() { root.remove(); },
  };
}

