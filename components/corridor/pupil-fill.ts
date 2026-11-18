import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
  Vector3,
  type Object3D,
} from "three";

export const PUPIL_FILL_NAME = "Pupil — clean front fill";
export const pupilFillState = { value: 0 };
export const PUPIL_FILL = { start: 0.08, end: 0.82, feather: 0.055, lift: 0.025 } as const;

/** Follow the existing pullback; no extra clock, spin, camera move or light. */
export function pupilFillProgress(stage: string, progress: number) {
  if (stage === "done") return 1;
  if (stage !== "pullback") return 0;
  const t = Math.max(0, Math.min(1, (progress - PUPIL_FILL.start) / (PUPIL_FILL.end - PUPIL_FILL.start)));
  return t * t * (3 - 2 * t);
}

/** Reuse the GLB's actual outer front contour, closing only its internal corridor cut-out. */
export function createPupilFrontGeometry(source: BufferGeometry, height?: number) {
  const positions = source.getAttribute("position"),
    index = source.getIndex();
  const box = new Box3(),
    sample = new Vector3();
  for (let i = 0; i < positions.count; i++) box.expandByPoint(sample.fromBufferAttribute(positions, i));
  const top = box.max.y;
  const points = new Map<string, Vector2>(),
    edges = new Map<string, { a: string; b: string; count: number }>();
  const p = [new Vector3(), new Vector3(), new Vector3()],
    u = new Vector3(),
    v = new Vector3(),
    normal = new Vector3();
  const count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    for (let j = 0; j < 3; j++) p[j].fromBufferAttribute(positions, index ? index.getX(i + j) : i + j);
    if (p.some((value) => value.y < top - 0.005)) continue;
    normal.crossVectors(u.subVectors(p[1], p[0]), v.subVectors(p[2], p[0]));
    if (normal.lengthSq() < 1e-12 || normal.y / normal.length() < 0.98) continue;
    const keys = p.map((value) => {
      const key = `${Math.round(value.x / 0.002)},${Math.round(value.z / 0.002)}`;
      if (!points.has(key)) points.set(key, new Vector2(value.x, value.z));
      return key;
    });
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3];
      if (a === b) continue;
      const key = a < b ? a + "|" + b : b + "|" + a,
        edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { a, b, count: 1 });
    }
  }
  const adjacent = new Map<string, string[]>();
  for (const edge of edges.values())
    if (edge.count === 1) {
      for (const [a, b] of [
        [edge.a, edge.b],
        [edge.b, edge.a],
      ]) {
        const neighbours = adjacent.get(a) ?? [];
        neighbours.push(b);
        adjacent.set(a, neighbours);
      }
    }
  const remaining = new Set(adjacent.keys());
  let outline: Vector2[] = [],
    largest = 0;
  while (remaining.size) {
    const start = remaining.values().next().value as string,
      component: string[] = [],
      queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const key = queue.pop()!;
      component.push(key);
      for (const next of adjacent.get(key) ?? []) if (remaining.delete(next)) queue.push(next);
    }
    if (component.some((key) => adjacent.get(key)?.length !== 2)) continue;
    const loop: Vector2[] = [];
    let current = start,
      previous = "";
    do {
      loop.push(points.get(current)!);
      const next = adjacent.get(current)!.find((key) => key !== previous)!;
      previous = current;
      current = next;
    } while (current !== start && loop.length <= component.length);
    if (current !== start || loop.length !== component.length) continue;
    const area = Math.abs(ShapeUtils.area(loop));
    if (area > largest) {
      outline = loop;
      largest = area;
    }
  }
  if (outline.length < 3) throw new Error("Pupil front: closed GLB front outline not found");
  const triangles = ShapeUtils.triangulateShape(outline, []),
    data: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const point of outline) {
    data.push(point.x, height ?? top, point.y);
    normals.push(0, 1, 0);
  }
  for (const [a, b, c] of triangles) {
    const cross =
      (outline[b].x - outline[a].x) * (outline[c].y - outline[a].y) -
      (outline[b].y - outline[a].y) * (outline[c].x - outline[a].x);
    indices.push(a, ...(cross > 0 ? [c, b] : [b, c]));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

type FillUniforms = {
  uPupilFill: { value: number };
  uPupilBounds: { value: Vector2 };
  uPupilRight: { value: Vector3 };
  uPupilFeather: { value: number };
};
const filledMaterials = new WeakMap<Material, FillUniforms>();
function installFill(material: Material, uniforms: FillUniforms) {
  const compile = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vPupilX;uniform vec3 uPupilRight;")
      .replace(
        "#include <project_vertex>",
        "vPupilX=dot((modelMatrix*vec4(transformed,1.)).xyz,uPupilRight);\n#include <project_vertex>",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vPupilX;uniform float uPupilFill,uPupilFeather;uniform vec2 uPupilBounds;",
      )
      .replace(
        "#include <alphatest_fragment>",
        /* glsl */ `
        #include <alphatest_fragment>
        float pupilX=(vPupilX-uPupilBounds.x)/(uPupilBounds.y-uPupilBounds.x);
        float pupilEdge=mix(-uPupilFeather,1.+uPupilFeather,uPupilFill);
        diffuseColor.a*=1.-smoothstep(pupilEdge-uPupilFeather,pupilEdge+uPupilFeather,pupilX);
        if(diffuseColor.a<.003)discard;`,
      );
  };
  material.customProgramCacheKey = () => key + "|pupil-front-left-right-v1";
}

export function isPupilFillMaterial(material: Material) {
  return filledMaterials.has(material);
}
/** A matching alpha mask prevents star halos leaking over the material being filled. */
export function createPupilFillMask(material: Material) {
  const uniforms = filledMaterials.get(material);
  if (!uniforms) return null;
  const mask = new MeshBasicMaterial({
    color: 0,
    side: material.side,
    transparent: true,
    depthWrite: true,
    toneMapped: false,
  });
  installFill(mask, uniforms);
  return mask;
}

export function createPupilFrontFill(root: Object3D, steel: MeshStandardMaterial | null) {
  if (!steel) return null;
  let blue: Mesh | undefined,
    frontHeight = -Infinity;
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object.name.startsWith("Swoosh") && object.name.includes("Blue")) blue = object;
    if (object.name.includes("Capped Red corridor wall"))
      frontHeight = Math.max(frontHeight, new Box3().setFromObject(object).max.y);
  });
  if (!blue) throw new Error("Pupil front: blue source ribbon missing");
  const source = blue as Mesh,
    world = source.geometry.clone().applyMatrix4(source.matrixWorld);
  world.computeBoundingBox();
  const sourceTop = world.boundingBox!.max.y;
  const geometry = createPupilFrontGeometry(world, Math.max(sourceTop, frontHeight) + PUPIL_FILL.lift);
  world.dispose();
  const right = new Vector3(Math.cos(Math.PI / 18), 0, -Math.sin(Math.PI / 18)),
    position = geometry.getAttribute("position"),
    point = new Vector3();
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = point.fromBufferAttribute(position, i).dot(right);
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  geometry.applyMatrix4(new Matrix4().copy(root.matrixWorld).invert());
  const material = steel.clone();
  material.name = "Pupil | Clean steel front";
  material.transparent = true;
  material.depthWrite = true;
  const uniforms = {
    uPupilFill: pupilFillState,
    uPupilBounds: { value: new Vector2(min, max) },
    uPupilRight: { value: right },
    uPupilFeather: { value: PUPIL_FILL.feather },
  };
  installFill(material, uniforms);
  filledMaterials.set(material, uniforms);
  const mesh = new Mesh(geometry, material);
  mesh.name = PUPIL_FILL_NAME;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.excludeFromMirror = true;
  mesh.onBeforeRender = source.onBeforeRender;
  root.add(mesh);
  return {
    mesh,
    geometry,
    material,
    update() {
      mesh.visible = pupilFillState.value > 0;
    },
    dispose() {
      root.remove(mesh);
      filledMaterials.delete(material);
      geometry.dispose();
      material.dispose();
    },
  };
}
