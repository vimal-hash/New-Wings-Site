import {
  Group,
  Texture,
  WebGLRenderTarget,
  type Camera,
  type LightShadow,
  type Material,
  type Object3D,
  type Scene,
  type ShaderMaterial,
  type WebGLRenderer,
} from "three";
import { traceSpan } from "./loading-trace";
import { yieldDuringLoading } from "./loading-step";

/** Compile both output variants asynchronously before a private resource draw.
 * `object` limits the work to one subtree that is already inside `scene` (its lights still apply). */
export async function compileHiddenGPU(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  object: Object3D = scene,
) {
  // Bind the canvas explicitly: a caller outside the render loop may still have an offscreen
  // (linear) target bound, and then the real sRGB screen variant would link on first draw.
  const compileAt = (target: WebGLRenderTarget | null) => {
    const previous = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      return renderer.compileAsync(object, camera, scene);
    } finally {
      renderer.setRenderTarget(previous);
    }
  };
  await compileAt(null);
  const target = new WebGLRenderTarget(1, 1);
  try {
    await compileAt(target);
  } finally {
    target.dispose();
  }
}

/** Interactive stops link one drawable at a time. Behind the opening loader, independent materials can
 * link together while a frame is presented. Both paths use the real scene's lights and output variants. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
export async function compileHiddenGPUGradually(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  alive: () => boolean = () => true,
  root: Object3D = scene,
  visibleOnly = false,
  frame = nextFrame,
) {
  type Drawable = Object3D & { material: Material | Material[] };
  const objects: Drawable[] = [];
  const collect = (object: Object3D) => {
    const o = object as Object3D & {
      isMesh?: boolean;
      isPoints?: boolean;
      isLine?: boolean;
      isSprite?: boolean;
      material?: unknown;
    };
    if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material) objects.push(object as Drawable);
  };
  if (visibleOnly) root.traverseVisible(collect);
  else root.traverse(collect);
  const target = new WebGLRenderTarget(1, 1);
  const linking: Promise<unknown>[] = [];
  const opening = frame === yieldDuringLoading;
  const batch = new Group();
  const materials = new Set<Material>();
  try {
    let slice = performance.now();
    for (let i = 0; i < objects.length;) {
      const first = objects[i++];
      let root: Object3D = first;
      if (opening && first.children.length === 0) {
        // compileAsync only traverses this list. Keep every mesh attached to its real parent.
        batch.children.length = 0;
        materials.clear();
        batch.children.push(first);
        for (const m of Array.isArray(first.material) ? first.material : [first.material]) materials.add(m);
        const limit = document.hidden ? 8 : 3;
        while (i < objects.length && batch.children.length < limit) {
          const next = objects[i];
          const nextMaterials = Array.isArray(next.material) ? next.material : [next.material];
          // Three tracks the currently linking program per material. Wait before reusing it on another mesh.
          if (next.children.length || nextMaterials.some((m) => materials.has(m))) break;
          for (const m of nextMaterials) materials.add(m);
          batch.children.push(next);
          i++;
        }
        if (batch.children.length > 1) root = batch;
      }
      for (const output of [null, target]) {
        if (!alive()) {
          await Promise.all(linking);
          return;
        }
        const before = renderer.info.programs?.length ?? 0,
          previous = renderer.getRenderTarget();
        let ready: Promise<unknown>;
        try {
          renderer.setRenderTarget(output);
          ready = renderer.compileAsync(root, camera, scene);
        } finally {
          renderer.setRenderTarget(previous);
        }
        linking.push(ready);
        if ((renderer.info.programs?.length ?? 0) !== before || performance.now() - slice > 8) {
          // During startup the loader can paint while the GPU links the program.
          // At an interactive stop keep a separate frame after the link to protect camera movement.
          if (opening) linking.push(frame());
          await Promise.all(linking);
          linking.length = 0;
          if (!opening) await frame();
          slice = performance.now();
        }
      }
    }
    await Promise.all(linking);
  } finally {
    batch.children.length = 0;
    target.dispose();
  }
}

/** Run `draw` once with every renderer.render turned into an off-thread compile of the same scene at the
 * same render target. Post-effect chains (composer passes, full-screen quads) can then be prepared
 * without listing their materials; the real draw afterwards links nothing synchronously. */
export async function compileByDryRun(renderer: WebGLRenderer, draw: () => void) {
  const work: Promise<unknown>[] = [],
    render = renderer.render;
  renderer.render = (scene, camera) => {
    work.push(renderer.compileAsync(scene, camera, scene as Scene));
  };
  try {
    draw();
  } finally {
    renderer.render = render;
  }
  await Promise.all(work);
}

/** Upload a subtree's textures one per animation frame, so no single visible frame carries all of them. */
export async function uploadTexturesGradually(
  renderer: WebGLRenderer,
  object: Object3D,
  alive: () => boolean,
) {
  const textures = new Set<Texture>();
  const add = (value: unknown) => {
    if (
      value instanceof Texture &&
      value.image &&
      !(value as Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture
    )
      textures.add(value);
  };
  object.traverse((child) => {
    const material = (child as Object3D & { material?: Material | Material[] }).material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      Object.values(m).forEach(add);
      const uniforms = (m as ShaderMaterial).uniforms;
      if (uniforms) Object.values(uniforms).forEach((u) => add(u?.value));
    }
  });
  for (const texture of textures) {
    if (!alive()) return;
    renderer.initTexture(texture);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Upload the new meshes at a resting stop, using their real lighting and small private draws. */
export async function prepareMobileMeshes(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  meshes: Object3D[],
  alive: () => boolean,
  frame = nextFrame,
  shadow?: LightShadow,
) {
  const target = new WebGLRenderTarget(2, 2);
  const drawable = (object: Object3D) => {
    const item = object as Object3D & {
      isMesh?: boolean;
      isPoints?: boolean;
      isLine?: boolean;
      isSprite?: boolean;
    };
    return item.isMesh || item.isPoints || item.isLine || item.isSprite;
  };
  const objects: Object3D[] = [];
  scene.traverse((object) => {
    if (drawable(object)) objects.push(object);
  });
  try {
    for (const mesh of meshes) {
      if (!alive()) return;
      const visible = new Set<Object3D>();
      for (let parent: Object3D | null = mesh; parent && parent !== scene; parent = parent.parent)
        visible.add(parent);
      const restore = new Map<Object3D, boolean>();
      for (const object of objects) {
        restore.set(object, object.visible);
        object.visible = visible.has(object);
      }
      for (const object of visible) {
        if (!restore.has(object)) restore.set(object, object.visible);
        object.visible = true;
      }
      const culled = mesh.frustumCulled;
      const previous = renderer.getRenderTarget(),
        auto = renderer.shadowMap.autoUpdate,
        needs = renderer.shadowMap.needsUpdate;
      const shadowDraw = mesh.castShadow ? shadow : undefined;
      const end = traceSpan("Prepare mobile drawable", "GPU resource submission", {
        object: mesh.name || mesh.type,
      });
      try {
        mesh.frustumCulled = false;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = !!shadowDraw;
        if (shadowDraw) shadowDraw.needsUpdate = true;
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        restore.forEach((wasVisible, object) => {
          object.visible = wasVisible;
        });
        mesh.frustumCulled = culled;
        renderer.setRenderTarget(previous);
        renderer.shadowMap.autoUpdate = auto;
        renderer.shadowMap.needsUpdate = needs;
        end();
      }
      if (mesh !== meshes.at(-1)) await frame();
    }
  } finally {
    target.dispose();
  }
}

/** Upload/first-draw into a private pixel. Actual scene visibility and renderer state are always restored. */
export function prepareHiddenGPU(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  roots: Object3D[],
  shadow?: LightShadow,
) {
  // 2×2, not 1×1: three sizes its transmission target as viewport × transmissionResolutionScale (.75 / .5 here),
  // so a 1×1 target gave a zero-size transmission pass and every draw in it failed (wasted, and not warmed).
  const target = new WebGLRenderTarget(2, 2),
    previous = renderer.getRenderTarget(),
    auto = renderer.shadowMap.autoUpdate,
    needs = renderer.shadowMap.needsUpdate;
  const saved = new Map<Object3D, { visible: boolean; culled: boolean }>();
  function include(object: Object3D) {
    if (saved.has(object)) return;
    saved.set(object, { visible: object.visible, culled: object.frustumCulled });
    object.visible = true;
    object.frustumCulled = false;
    object.children.forEach(include);
  }
  try {
    roots.forEach(include);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = !!shadow;
    if (shadow) shadow.needsUpdate = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    saved.forEach(({ visible, culled }, object) => {
      object.visible = visible;
      object.frustumCulled = culled;
    });
    renderer.setRenderTarget(previous);
    renderer.shadowMap.autoUpdate = auto;
    renderer.shadowMap.needsUpdate = needs || !!shadow;
    // Rebuild the actual map with the original scene visibility on the next live draw.
    if (shadow) shadow.needsUpdate = true;
    target.dispose();
  }
}
