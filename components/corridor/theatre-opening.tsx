"use client";
/* eslint-disable react-hooks/immutability -- These are mount-owned Three.js objects; frame callbacks mutate their render state. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RectAreaLight,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { THEATRE_MODELS } from "./opening-assets";
import manifest from "./baked-surfaces.json";
import sofaAssets from "./sofa-assets.json";
import { extractSurface, type SurfaceId } from "./baked-surface-geometry";
import { applyTheatreScreenArtwork, THEATRE_SCREEN_ARTWORK } from "./theatre-screen-artwork";
import { createTheatreCatalogueTexture, theatreScreenCatalogue } from "./theatre-screen-catalogue";
import { stageBakedMaterial } from "./stage-lighting";
import { SCREEN_COVER, SCREEN_COVER_TOUR, SCREEN_GLOW, theatreOpening } from "./theatre-opening-state";
import type { MetricsStore } from "./metrics";
import { traceGLTF, traceMark } from "./loading-trace";
import { scheduleSceneIdle } from "./scene-idle";
import { journeyControls } from "./journey-controls";
import { applyTheatreOpeningMaterial } from "./theatre-opening-material";

/** Independent critical path: the image can paint before the room's atlas/LUT dependencies. */
export function TheatreOpeningScreen({ metrics }: { metrics: MetricsStore }) {
  const [theatre] = useGLTF(THEATRE_MODELS, "/draco/", false, traceGLTF);
  const [source] = useLoader(TextureLoader, [THEATRE_SCREEN_ARTWORK]);
  const gl = useThree((s) => s.gl),
    invalidate = useThree((s) => s.invalidate);
  const reduced = useRef(false);
  const screen = useMemo(() => {
    let geometry: BufferGeometry | undefined;
    const spec = manifest.items.find((item) => item.item === "screen")!;
    theatre.scene.traverse((o) => {
      if (o instanceof Mesh) geometry = extractSurface(o.geometry, spec.ids as SurfaceId[]);
    });
    if (!geometry) throw new Error("Theatre opening: screen geometry missing");
    const texture = source.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    const material = new MeshBasicMaterial({ color: "#050505", side: DoubleSide, toneMapped: false });
    material.name = "Theatre | Luminous image screen";
    stageBakedMaterial(material);
    applyTheatreOpeningMaterial(material, true);
    const catalogue = createTheatreCatalogueTexture();
    applyTheatreScreenArtwork(material, geometry, texture, catalogue.texture);
    const mesh = new Mesh(geometry, material);
    mesh.name = "Theatre screen | Full aspect artwork";
    const haloGeometry = new PlaneGeometry(16, 8);
    const haloMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      uniforms: {
        uActive: theatreOpening.active,
        uRoom: theatreOpening.room,
        uHouse: theatreOpening.house,
        uPower: theatreOpening.screenPower,
        uCatalogue: theatreScreenCatalogue.cover,
      },
      vertexShader: `varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uActive,uRoom,uHouse,uPower,uCatalogue;varying vec2 vLocal;void main(){
        float edge=max(abs(vLocal.x)-5.65,abs(vLocal.y)-2.1);
        float glow=exp(-max(edge,0.)*2.7)*smoothstep(-.06,.07,edge)*${(0.16 * SCREEN_GLOW).toFixed(
          3,
        )}*max(uActive,1.-uHouse)*(1.-uRoom*.5)*uPower*(1.-uCatalogue);
        if(glow<.0005)discard;gl_FragColor=vec4(.78,.86,1.,glow);
        #include <colorspace_fragment>
      }`,
    });
    const halo = new Mesh(haloGeometry, haloMaterial);
    halo.name = "Screen | Restrained edge diffusion";
    halo.position.set(0.010995, 3.24, 24.72);
    RectAreaLightUniformsLib.init();
    const bounce = new RectAreaLight("#edf3ff", 6.5 * SCREEN_GLOW, 11.4, 4.1);
    bounce.position.set(0.010995, 3.24, 25.05);
    bounce.name = "Cinema screen | Broad soft seating illumination";
    return {
      mesh,
      geometry,
      material,
      texture,
      catalogue,
      halo,
      haloGeometry,
      haloMaterial,
      bounce,
      name: null as string | null,
      cover: 0,
      text: 0,
    };
  }, [theatre, source, gl]);
  useEffect(() => {
    traceMark("Screen-only opening painted");
    metrics.update({ loaded: true, modelReady: metrics.read().modelReady || performance.now() });
    invalidate();
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => {
      reduced.current = query.matches;
      invalidate();
    };
    preference();
    query.addEventListener("change", preference);
    return () => {
      query.removeEventListener("change", preference);
      theatreScreenCatalogue.cover.value = 0;
      theatreScreenCatalogue.text.value = 0;
      screen.geometry.dispose();
      screen.material.dispose();
      screen.texture.dispose();
      screen.catalogue.texture.dispose();
      screen.haloGeometry.dispose();
      screen.haloMaterial.dispose();
    };
  }, [screen, metrics, invalidate]);
  useFrame((_, delta) => {
    const name = journeyControls.read().phase === "idle" ? theatreScreenCatalogue.name : null;
    const dt = reduced.current ? 1 : Math.min(0.05, delta),
      timing = theatreScreenCatalogue.quick ? SCREEN_COVER_TOUR : SCREEN_COVER;
    // Moving to another object: the old words fade out first, then the new ones come in.
    if (name && name !== screen.name) {
      if (screen.name && screen.text > 0) screen.text = Math.max(0, screen.text - dt / timing.swap);
      else {
        screen.catalogue.show(name);
        screen.name = name;
        screen.text = 0;
      }
    }
    const settled = !!name && name === screen.name;
    // Slow, eased in and out: the black screen settles over the image instead of snapping on.
    screen.cover = Math.max(
      0,
      Math.min(1, screen.cover + (name ? dt / timing.in : -dt / timing.out)),
    );
    // The words follow once the screen is mostly dark.
    if (settled && screen.cover > 0.45) screen.text = Math.min(1, screen.text + dt / timing.text);
    // Fully gone: the next hover starts with its words hidden.
    if (!name && screen.cover === 0) screen.text = 0;
    const c = screen.cover;
    theatreScreenCatalogue.cover.value = c * c * c * (c * (c * 6 - 15) + 10);
    theatreScreenCatalogue.text.value = 1 - (1 - screen.text) ** 3;
    if ((name && (screen.cover < 1 || screen.text < 1 || !settled)) || (!name && screen.cover > 0))
      invalidate();
    screen.halo.visible = theatreOpening.active.value > 0.5 || theatreOpening.house.value < 1;
    screen.bounce.intensity =
      6.5 *
      SCREEN_GLOW *
      (1 - theatreOpening.house.value) *
      theatreOpening.screenPower.value *
      (1 - theatreScreenCatalogue.cover.value);
  }, -0.76);
  return (
    <>
      <primitive object={screen.mesh} dispose={null} />
      <primitive object={screen.halo} dispose={null} />
      <primitive object={screen.bounce} />
    </>
  );
}

function createBlueprint(theatre: Group, seating: Group) {
  const root = new Group();
  root.name = "Theatre | Actual geometry blueprint";
  const positions: number[] = [];
  // Hides edges on the far side of objects. Each blocker gives way only where the real room has
  // already appeared (same reveal as the materials), so no hidden back edge ever shows through.
  const depthMaterial = new ShaderMaterial({
    colorWrite: false,
    side: DoubleSide,
    uniforms: { openingActive: theatreOpening.active, openingRoom: theatreOpening.room },
    vertexShader: `varying float vZ;void main(){vec4 w=modelMatrix*vec4(position,1.);vZ=w.z;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float openingActive,openingRoom;varying float vZ;void main(){
      float openingDepth=clamp((25.5-vZ)/27.,0.,1.);
      float openingAmount=openingActive>.5?smoothstep(openingDepth*.6,openingDepth*.6+.4,openingRoom):1.;
      if(openingAmount>=.001)discard;gl_FragColor=vec4(0.);}`,
  });
  const depths: Mesh[] = [],
    owned: BufferGeometry[] = [];
  const add = (geometry: BufferGeometry, matrix: Matrix4) => {
    const copy = geometry.clone().applyMatrix4(matrix);
    owned.push(copy);
    const depth = new Mesh(copy, depthMaterial);
    depth.renderOrder = -10;
    depths.push(depth);
    root.add(depth);
    const edges = new EdgesGeometry(copy, 28);
    const p = edges.getAttribute("position");
    for (let i = 0; i < p.count; i++) positions.push(p.getX(i), p.getY(i), p.getZ(i));
    edges.dispose();
  };
  theatre.updateWorldMatrix(true, true);
  theatre.traverse((o) => {
    if (o instanceof Mesh) add(o.geometry, o.matrixWorld);
  });
  seating.updateWorldMatrix(true, true);
  seating.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.computeBoundingBox();
    const bounds = g.boundingBox!,
      size = bounds.getSize(new Vector3());
    const matrix = new Matrix4(),
      scale = new Vector3(),
      position = new Vector3();
    for (const instance of sofaAssets.instances) {
      scale.fromArray(instance.maximum).sub(new Vector3().fromArray(instance.minimum)).divide(size);
      position.fromArray(instance.minimum).sub(new Vector3().copy(bounds.min).multiply(scale));
      add(g, matrix.makeScale(scale.x, scale.y, scale.z).setPosition(position));
    }
    g.dispose();
  });
  // One screen-space ribbon per real edge: an anti-aliased core with a soft
  // glow, a bright drawing head on the trace front and a sweep as it turns white.
  // Steel-white from its first pixel; the hot head draws left to right.
  const quad = [0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0];
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(quad, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const segments = new InstancedInterleavedBuffer(new Float32Array(positions), 6, 1);
  geometry.setAttribute("aStart", new InterleavedBufferAttribute(segments, 3, 0));
  geometry.setAttribute("aEnd", new InterleavedBufferAttribute(segments, 3, 3));
  geometry.instanceCount = positions.length / 6;
  const material = new ShaderMaterial({
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTrace: theatreOpening.trace,
      uWhite: theatreOpening.white,
      uOpacity: theatreOpening.lineOpacity,
      uResolution: { value: new Vector2(1, 1) },
      uPixel: { value: 1 },
    },
    vertexShader: `attribute vec3 aStart,aEnd;uniform vec2 uResolution;uniform float uPixel;varying vec3 vWorld;varying float vSide,vHalf,vDistance;
      void main(){
        vec4 a=viewMatrix*modelMatrix*vec4(aStart,1.),b=viewMatrix*modelMatrix*vec4(aEnd,1.);
        // Clip at the near plane so edges passing beside the camera stay stable.
        float near=-.06;
        if(a.z>near&&b.z>near){gl_Position=vec4(2.,2.,2.,1.);return;}
        if(a.z>near)a=mix(b,a,(b.z-near)/(b.z-a.z));else if(b.z>near)b=mix(a,b,(a.z-near)/(a.z-b.z));
        vec4 view=mix(a,b,position.x);
        vWorld=(inverse(viewMatrix)*view).xyz;vDistance=-view.z;
        // Sit just in front of the coincident occluding surfaces.
        a.xyz*=.996;b.xyz*=.996;view.xyz*=.996;
        vec4 ca=projectionMatrix*a,cb=projectionMatrix*b,clip=projectionMatrix*view;
        vec2 sa=ca.xy/ca.w*uResolution,sb=cb.xy/cb.w*uResolution,dir=sb-sa;
        dir=length(dir)<1e-4?vec2(1.,0.):normalize(dir);
        vHalf=5.5*uPixel;vSide=position.y*vHalf;
        clip.xy+=vec2(-dir.y,dir.x)*position.y*vHalf/uResolution*clip.w;
        gl_Position=clip;
      }`,
    fragmentShader: `uniform float uTrace,uWhite,uOpacity,uPixel;varying vec3 vWorld;varying float vSide,vHalf,vDistance;
      void main(){float order=clamp((8.5-vWorld.x)/17.,0.,1.);
      float front=uTrace*1.06-.03;
      float formed=smoothstep(order-.025,order+.025,front);if(formed*uOpacity<.002)discard;
      float d=abs(vSide)/uPixel;
      float core=1.-smoothstep(.35,1.25,d);
      float glow=exp(-d*d/8.)*.34;
      // Hot drawing head while tracing; it rests once the outline is complete.
      float head=exp(-pow((order-front)/.028,2.))*(1.-smoothstep(.92,1.,uTrace));
      // A single pale sweep travels the same order as the lines turn white.
      float sweep=exp(-pow((order-(uWhite*1.25-.12))/.07,2.))*uWhite*(1.-uWhite)*4.;
      float depth=mix(1.,.62,smoothstep(4.,32.,vDistance));
      vec3 colour=vec3(.93,.97,1.);
      colour=mix(colour,vec3(.86,.94,1.),min(1.,head*.85+sweep*.6));
      float energy=(core*.82+glow*(1.+head*2.2+sweep*1.4))*depth*(1.+head*1.3);
      float alpha=formed*uOpacity*.9*energy;if(alpha<.002)discard;
      gl_FragColor=vec4(colour,1.);
      #include <colorspace_fragment>
      gl_FragColor.rgb*=alpha;
      }`,
  });
  const lines = new Mesh(geometry, material);
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  root.add(lines);
  root.visible = false;
  return {
    root,
    depths,
    material,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
      owned.forEach((g) => g.dispose());
    },
  };
}

/** Build real mesh edges once, during the stationary screen shot. */
export function TheatreBlueprint() {
  const [theatre] = useGLTF(THEATRE_MODELS, "/draco/", false, traceGLTF);
  const seating = useGLTF(sofaAssets.model, "/draco/", false, traceGLTF);
  const invalidate = useThree((s) => s.invalidate),
    gl = useThree((s) => s.gl);
  const [rig, setRig] = useState<ReturnType<typeof createBlueprint> | null>(null);
  useEffect(() => {
    let owned: ReturnType<typeof createBlueprint> | undefined;
    const cancel = scheduleSceneIdle(() => {
      owned = createBlueprint(theatre.scene, seating.scene);
      theatreOpening.geometryReady = true;
      traceMark("Theatre outline geometry prepared");
      setRig(owned);
      invalidate();
    }, -105);
    return () => {
      cancel();
      owned?.dispose();
      theatreOpening.geometryReady = false;
    };
  }, [theatre, seating, invalidate]);
  useFrame(() => {
    if (rig) {
      gl.getDrawingBufferSize(rig.material.uniforms.uResolution.value);
      rig.material.uniforms.uResolution.value.multiplyScalar(0.5);
      rig.material.uniforms.uPixel.value = gl.getPixelRatio();
      rig.root.visible =
        theatreOpening.active.value > 0.5 &&
        theatreOpening.trace.value > 0 &&
        theatreOpening.lineOpacity.value > 0.001;
      rig.depths.forEach((mesh) => {
        mesh.visible = theatreOpening.room.value < 1;
      });
    }
  }, -0.75);
  return rig ? <primitive object={rig.root} dispose={null} /> : null;
}

/** A finite intro owner. Later shots get exactly their original background and material response. */
export function TheatreOpeningOwner() {
  const scene = useThree((s) => s.scene),
    invalidate = useThree((s) => s.invalidate);
  const original = useRef(scene.background ?? new Color("#11151a"));
  const dark = useMemo(() => new Color("#000000"), []);
  useLayoutEffect(() => {
    const background = original.current;
    theatreOpening.active.value = journeyControls.read().phase === "intro" ? 1 : 0;
    theatreOpening.room.value = theatreOpening.active.value ? 0 : 1;
    theatreOpening.house.value = theatreOpening.active.value ? 0 : 1;
    theatreOpening.glasses.value = theatreOpening.active.value ? 1 : 0;
    if (theatreOpening.active.value) scene.background = dark;
    invalidate();
    return () => {
      theatreOpening.active.value = 0;
      theatreOpening.room.value = 1;
      theatreOpening.house.value = 1;
      theatreOpening.glasses.value = 0;
      scene.background = background;
    };
  }, [scene, invalidate, dark]);
  useFrame(() => {
    const intro = journeyControls.read().phase === "intro";
    if (intro || theatreOpening.house.value < 1) scene.background = dark;
    else if (scene.background === dark) scene.background = original.current;
  }, -0.9);
  return null;
}
