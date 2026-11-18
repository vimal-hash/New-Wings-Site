"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Box3,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { AuthoredEyeField, type EyeStats } from "./index";
import type { EffectQuality } from "../effect-quality";
import { assetURL } from "../asset-url";
import { createLogoReveal } from "../logo-reveal";
import bounds from "../logo-reveal.json";
import layout from "../blender-layout.json";

function StudyCamera() {
  const camera = useThree((s) => s.camera),
    size = useThree((s) => s.size),
    invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    camera.position.set(0, 0, 19.7209459118 * Math.max(1, 16 / 9 / (size.width / size.height)));
    camera.lookAt(0, 0, 0);
    (camera as PerspectiveCamera).updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}
function ReferenceLogo() {
  const gltf = useLoader(GLTFLoader, assetURL("/models/corridor-ribbons-balanced.glb"), (loader) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    loader.setDRACOLoader(draco);
  });
  const group = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const source: Mesh[] = [];
    gltf.scene.traverse((o) => {
      if (o instanceof Mesh && o.name.includes("Swoosh")) source.push(o);
    });
    const root = new Group(),
      box = new Box3();
    source.forEach((o) => box.union(new Box3().setFromObject(o)));
    const centre = box.getCenter(new Vector3()),
      diameter = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const reveal = createLogoReveal(
      bounds.blenderBounds,
      layout.slides[1],
      5,
      16 / 9,
      new Vector3(),
      new Quaternion(),
    );
    const inverse = reveal.finalRotation.clone().invert();
    const material = new MeshStandardMaterial({ color: "#828d96", metalness: 0.95, roughness: 0.32 });
    source.forEach((o) => {
      const geometry = (o.geometry as BufferGeometry).clone();
      const transform = new Matrix4()
        .makeScale(3.5 / diameter, 3.5 / diameter, 3.5 / diameter)
        .multiply(new Matrix4().makeRotationFromQuaternion(inverse))
        .multiply(new Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z))
        .multiply(o.matrixWorld);
      geometry.applyMatrix4(transform);
      root.add(new Mesh(geometry, material));
    });
    return root;
  }, [gltf]);
  useEffect(
    () => () => {
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    },
    [group],
  );
  return <primitive object={group} dispose={null} />;
}
function StudyMetrics({ moving }: { moving: boolean }) {
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene);
  const frames = useRef(0);
  /* eslint-disable react-hooks/immutability -- diagnostic DOM attributes, outside React rendering. */
  useFrame(() => {
    const canvas = gl.domElement;
    canvas.dataset.frames = String(++frames.current);
    canvas.dataset.drawCalls = String(gl.info.render.calls);
    canvas.dataset.triangles = String(gl.info.render.triangles);
    canvas.dataset.eyeCount = String(
      (scene.getObjectByName("Approved revision 16 — authored steel grains") as Mesh | undefined)
        ?.geometry instanceof Object
        ? (
            (scene.getObjectByName("Approved revision 16 — authored steel grains") as Mesh)
              .geometry as BufferGeometry & { instanceCount: number }
          ).instanceCount
        : 0,
    );
    canvas.dataset.moving = String(moving);
  });
  /* eslint-enable react-hooks/immutability */
  return null;
}
export default function EyeStudy() {
  const [quality, setQuality] = useState<EffectQuality | "auto">("auto"),
    [moving, setMoving] = useState(false),
    [stats, setStats] = useState<EyeStats | null>(null);
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#e7e7e7",
        fontFamily: "Arial,sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Canvas
          frameloop="demand"
          dpr={1}
          camera={{ position: [0, 0, 19.7209459118], fov: 40, near: 0.01, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#000"]} />
          <StudyCamera />
          <ambientLight intensity={0.65} />
          <directionalLight position={[-6, 5, 8]} intensity={4} />
          <directionalLight position={[5, -5, 5]} intensity={2} />
          <Suspense fallback={null}>
            <ReferenceLogo />
          </Suspense>
          <AuthoredEyeField
            key={quality}
            active
            review
            qualityOverride={quality === "auto" ? undefined : quality}
            moving={moving}
            onReady={setStats}
          />
          <StudyMetrics moving={moving} />
        </Canvas>
      </div>
      <header style={{ position: "absolute", left: 24, top: 20, pointerEvents: "none" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#aaa" }}>EYE STUDY / 16</div>
        <p style={{ fontSize: 18, marginTop: 9 }}>Authored steel particles</p>
      </header>
      <nav
        aria-label="Eye study controls"
        className="absolute right-6 top-6 flex items-center gap-3.5 max-sm:left-6 max-sm:right-auto max-sm:top-24"
        style={{ fontSize: 12 }}
      >
        <select
          aria-label="Particle quality"
          value={quality}
          onChange={(event) => {
            const next = event.target.value as EffectQuality | "auto";
            if (next !== quality) {
              setStats(null);
              setQuality(next);
            }
          }}
          style={{ background: "#14181c", color: "white", padding: 6, border: "1px solid #3c434a" }}
        >
          <option value="auto">Automatic</option>
          <option value="desktop">Desktop</option>
          <option value="laptop">Laptop</option>
          <option value="mobile">Mobile</option>
        </select>
        <button
          onClick={() => setMoving((v) => !v)}
          style={{ background: "none", border: 0, color: "white", cursor: "pointer" }}
        >
          {moving ? "Pause" : "Play current"}
        </button>
        <Link href="/" prefetch={false} style={{ color: "white" }}>
          Full experience ↗
        </Link>
      </nav>
      <footer
        aria-live="polite"
        style={{ position: "absolute", bottom: 20, left: 24, fontSize: 11, color: "#a7afb6" }}
      >
        {stats
          ? `${stats.count.toLocaleString()} particles · ${(stats.downloadBytes / 1e6).toFixed(
              2,
            )} MB eye assets · ${moving ? "Subtle current" : "Still reference"}`
          : "Preparing the authored eye…"}
      </footer>
    </main>
  );
}
