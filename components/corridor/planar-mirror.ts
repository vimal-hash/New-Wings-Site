import {
  DepthTexture,
  Box3,
  Frustum,
  HalfFloatType,
  LinearFilter,
  UnsignedByteType,
  Matrix4,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";

/** What `camera` sees: three's culling frustum. */
export function viewFrustum(renderer: WebGLRenderer, camera: Camera, frustum = new Frustum()) {
  camera.updateMatrixWorld();
  return frustum.setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    renderer.coordinateSystem,
  );
}

/**
 * A planar mirror rendered from the reflected camera (three's Reflector camera maths, without its
 * geometry): shaders sample `target` at `textureMatrix * worldPosition` (projective). Linear HDR,
 * cropped to the visible mirror region. The oblique near plane clips everything
 * behind the mirror. `target.depthTexture` with `unproject` gives back the world point each texel shows.
 */
export class PlanarMirror {
  readonly target: WebGLRenderTarget;
  readonly textureMatrix = new Matrix4();
  /** NDC (with the oblique near plane) -> world, for the depth texture. */
  readonly unproject = new Matrix4();
  private readonly camera = new PerspectiveCamera();
  private readonly plane = new Plane();
  private readonly size = new Vector2();
  private readonly crop = new Matrix4();
  private readonly corner = new Vector3();
  private readonly projected = new Matrix4();

  /** normal and point in three.js world space; scale = mirror resolution / drawing buffer. */
  constructor(
    readonly normal: Vector3,
    readonly point: Vector3,
    readonly scale = 0.5,
    readonly clipBias = 0.003,
    readonly clipOffset = 0.005, // metres toward the viewer: faces on the mirror plane stay out
    readonly extraLayers: number[] = [], // layers only reflections see (besides the camera's)
    readonly fixedColourTarget = false,
  ) {
    const size = fixedColourTarget ? 512 : 1;
    this.target = new WebGLRenderTarget(size, size, {
      type: HalfFloatType,
      samples: 0,
      depthTexture: fixedColourTarget ? null : new DepthTexture(1, 1),
    });
    this.target.texture.generateMipmaps = false;
    this.target.texture.minFilter = LinearFilter;
    this.target.texture.magFilter = LinearFilter;
  }

  /** Renders `scene` as seen in the mirror from `camera`, with `hidden` objects left out.
   *  Returns false (and leaves the last image) when the camera is behind the mirror. */
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    hidden: Object3D[],
    bounds?: Box3,
    reuseShadows = false,
  ) {
    const { normal, point, camera: mirrored } = this;
    const eye = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new Vector3().subVectors(point, eye);
    if (view.dot(normal) > 0) return false;

    // Some WebGL2 phones cannot render into half-float targets. Keep real reflections in LDR there.
    if (this.target.texture.type === HalfFloatType && !renderer.extensions.has("EXT_color_buffer_float"))
      this.target.texture.type = UnsignedByteType;

    // Mirrored eye, look-at target and up vector (Reflector.onBeforeRender).
    view.reflect(normal).negate().add(point);
    const rotation = new Matrix4().extractRotation(camera.matrixWorld);
    const lookAt = new Vector3(0, 0, -1).applyMatrix4(rotation).add(eye);
    const target = new Vector3().subVectors(point, lookAt).reflect(normal).negate().add(point);
    mirrored.position.copy(view);
    mirrored.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    mirrored.lookAt(target);
    mirrored.far = (camera as PerspectiveCamera).far ?? 1000;
    mirrored.layers.mask = camera.layers.mask;
    this.extraLayers.forEach((layer) => mirrored.layers.enable(layer));
    mirrored.updateMatrixWorld();
    mirrored.projectionMatrix.copy(camera.projectionMatrix);
    mirrored.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    // Oblique near plane just in front of the mirror (Lengyel), so nothing behind or on it is drawn.
    const clipPoint = new Vector3().copy(normal).multiplyScalar(this.clipOffset).add(point);
    this.plane.setFromNormalAndCoplanarPoint(normal, clipPoint).applyMatrix4(mirrored.matrixWorldInverse);
    const clip = new Vector4(
      this.plane.normal.x,
      this.plane.normal.y,
      this.plane.normal.z,
      this.plane.constant,
    );
    const p = mirrored.projectionMatrix.elements;
    const q = new Vector4(
      (Math.sign(clip.x) + p[8]) / p[0],
      (Math.sign(clip.y) + p[9]) / p[5],
      -1,
      (1 + p[10]) / p[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1 - this.clipBias;
    p[14] = clip.w;
    renderer.getDrawingBufferSize(this.size);
    let minX = -1,
      maxX = 1,
      minY = -1,
      maxY = 1;
    if (bounds) {
      minX = minY = Infinity;
      maxX = maxY = -Infinity;
      this.projected.multiplyMatrices(mirrored.projectionMatrix, mirrored.matrixWorldInverse);
      for (let i = 0; i < 8; i++) {
        this.corner
          .set(
            i & 1 ? bounds.max.x : bounds.min.x,
            i & 2 ? bounds.max.y : bounds.min.y,
            i & 4 ? bounds.max.z : bounds.min.z,
          )
          .applyMatrix4(this.projected);
        minX = Math.min(minX, this.corner.x);
        maxX = Math.max(maxX, this.corner.x);
        minY = Math.min(minY, this.corner.y);
        maxY = Math.max(maxY, this.corner.y);
      }
      minX = Math.max(-1, minX - 0.015);
      maxX = Math.min(1, maxX + 0.015);
      minY = Math.max(-1, minY - 0.015);
      maxY = Math.min(1, maxY + 0.015);
      if (maxX <= minX || maxY <= minY) return false;
      this.crop.set(
        2 / (maxX - minX),
        0,
        0,
        -(maxX + minX) / (maxX - minX),
        0,
        2 / (maxY - minY),
        0,
        -(maxY + minY) / (maxY - minY),
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
      );
      mirrored.projectionMatrix.premultiply(this.crop);
    }
    mirrored.projectionMatrixInverse.copy(mirrored.projectionMatrix).invert();
    this.unproject.multiplyMatrices(mirrored.projectionMatrix, mirrored.matrixWorldInverse).invert();
    const cap = this.scale <= 1 ? 512 : 1024,
      width = Math.max(16, Math.min(cap, Math.ceil(this.size.x * (maxX - minX) * 0.5 * this.scale))),
      height = Math.max(16, Math.min(cap, Math.ceil(this.size.y * (maxY - minY) * 0.5 * this.scale)));
    // Grow only in buckets. Camera motion never reallocates a render target every frame.
    const bucket = (n: number) => Math.min(cap, 2 ** Math.ceil(Math.log2(n)));
    if (width > this.target.width || height > this.target.height)
      this.target.setSize(
        Math.max(this.target.width, bucket(width)),
        Math.max(this.target.height, bucket(height)),
      );
    this.target.viewport.set(0, 0, width, height);
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(mirrored.projectionMatrix).multiply(mirrored.matrixWorldInverse);
    this.crop.makeScale(width / this.target.width, height / this.target.height, 1);
    this.textureMatrix.premultiply(this.crop);

    // Transmissive optics in a tiny distant reflection do not justify another full-scene transmission pass.
    const excluded: Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData.excludeFromMirror) excluded.push(object);
    });
    hidden = hidden.concat(excluded);
    const visibility = hidden.map((object) => object.visible);
    hidden.forEach((object) => (object.visible = false));
    const previous = renderer.getRenderTarget();
    const clearAlpha = renderer.getClearAlpha();
    const shadowMap = reuseShadows ? renderer.shadowMap : null;
    const auto = shadowMap?.autoUpdate ?? false,
      needs = shadowMap?.needsUpdate ?? false;
    try {
      if (shadowMap) {
        shadowMap.autoUpdate = false;
        shadowMap.needsUpdate = false;
      }
      renderer.setClearAlpha(1);
      renderer.setRenderTarget(this.target);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, mirrored);
    } finally {
      if (shadowMap) {
        shadowMap.autoUpdate = auto;
        shadowMap.needsUpdate = needs;
      }
      renderer.setRenderTarget(previous);
      renderer.setClearAlpha(clearAlpha);
      hidden.forEach((object, i) => (object.visible = visibility[i]));
    }
    return true;
  }

  dispose() {
    this.target.dispose();
  }
}
