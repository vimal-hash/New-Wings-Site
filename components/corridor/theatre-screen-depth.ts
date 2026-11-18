import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  NormalBlending,
  NoColorSpace,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import layout from "../../public/3D/elements/positions.json";
import { theatreScreenSurface } from "./theatre-screen-artwork";
import { OPENING_CAMERA_END } from "./theatre-opening-state";

const SCREEN_LAYER_ROOT = "/3D/elements/";
/** Distance from the seated eye, as a multiple of the screen's own distance (1 = on the screen),
 *  and a defocus radius in canvas pixels. Nearer layers are scaled down by the same ratio,
 *  so from the seat every element keeps exactly its 2D size and position. The logo sits just in
 *  front of the first seat row (eye z 2.2, row front z ~11.8, screen z ~25.2); the title follows it,
 *  then the props recede in order to the screen and the backdrop beyond it. */
const DEPTH: Record<string, [number, number]> = {
  "logo.webp": [0.42, 0],
  "text-new-wings.webp": [0.5, 0],
  "text-solutions.webp": [0.5, 0],
  "3d-glasses.webp": [0.58, 0],
  "film-strip.webp": [0.62, 0],
  "clapperboard.webp": [0.66, 0],
  "stage-spotlight.webp": [0.72, 0],
  "theatre-seats.webp": [0.8, 1],
  "silver-screen.webp": [0.86, 1],
  "speaker-tower.webp": [0.9, 2],
  "soundbar.webp": [0.94, 2],
  "projector-4k.webp": [0.97, 2],
  "av-receiver.webp": [1, 3],
  "subwoofer.webp": [1.05, 4],
  "projector-vintage.webp": [1.08, 4],
  "cinema-ticket.webp": [1.12, 5],
  "film-reel-bottom.webp": [1.18, 6],
  "lens-aperture.webp": [1.22, 7],
  "film-reel-top.webp": [1.26, 7],
  "sound-waveform.webp": [1.3, 8],
  "music-note-left.webp": [1.36, 9],
  "music-note-right.webp": [1.36, 9],
  "sparkles-and-dots.webp": [1.5, 5],
  "bg-curtain-valance.webp": [1.75, 10],
  "bg-sound-rings.webp": [2.1, 26],
  "bg-lens-aperture-large.webp": [2.1, 26],
  "bg-film-reel-large.webp": [2.1, 26],
};
const SCREEN_LAYERS = layout.elements.map((element) => ({
  ...element,
  depth: DEPTH[element.file]?.[0] ?? 1,
  blur: DEPTH[element.file]?.[1] ?? 0,
}));
export const SCREEN_LAYER_URLS = SCREEN_LAYERS.map((layer) => SCREEN_LAYER_ROOT + layer.file);
const [CANVAS_W, CANVAS_H] = layout.canvas;

// position is the point on the 2D screen; the layer sits on the ray from the eye through it.
const vertexShader = `uniform vec3 uEye;uniform float uDepth;varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*viewMatrix*vec4(uEye+(position-uEye)*uDepth,1.);}`;
// Raw sRGB texels composited in display space, as the supplied artwork was. The
// house-light gain is applied in linear light, exactly like the 2D screen.
const fragmentShader = `uniform sampler2D uMap;uniform vec2 uSize;uniform float uBlur,uGain;varying vec2 vUv;
  vec4 tap(vec2 uv,float lod){return all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))?textureLod(uMap,uv,lod):vec4(0.);}
  vec3 toLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
  vec3 toDisplay(vec3 c){c=clamp(c,0.,1.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
  void main(){
    vec4 c;
    if(uBlur<.5)c=tap(vUv,0.);
    else{
      // Twelve-tap disc on the matching mip level: a smooth lens defocus without banding.
      float lod=log2(max(1.,uBlur*.5));vec2 r=uBlur/uSize;
      c=tap(vUv,lod)*.16;
      for(int i=0;i<12;i++){float a=float(i)*.5236+.26,k=i<6?.5:1.;c+=tap(vUv+vec2(cos(a),sin(a))*r*k,lod)*.07;}
    }
    if(c.a<.002)discard;
    gl_FragColor=vec4(toDisplay(toLinear(c.rgb)*uGain),c.a);
  }`;

/** Separate artwork layers at real depths, rendered only for the view through the lenses.
 *  The layers are aligned for an eye between the camera and the seat: at rest they match
 *  the 2D image exactly, while the opening pullback still carries part of their parallax. */
export function createScreenDepth(textures: Texture[]) {
  const scene = new Scene(),
    materials: ShaderMaterial[] = [],
    geometries: BufferGeometry[] = [];
  const seat = new Vector3(...OPENING_CAMERA_END),
    eye = new Vector3().copy(seat),
    white = new Color(1, 1, 1),
    previousClear = new Color();
  const gain = { value: 1 };
  let built = false;
  const prepare = (texture: Texture) => {
    texture.colorSpace = NoColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };
  // Defocus is baked once into a padded copy of each soft layer, so every layer is
  // a single texture tap per pixel. Without canvas filters the shader blurs instead.
  const probe = document.createElement("canvas").getContext("2d");
  if (probe) probe.filter = "blur(1px)";
  const canBake = probe?.filter === "blur(1px)",
    baked: Texture[] = [];
  const maps = SCREEN_LAYERS.map((layer, i) => {
    const source = textures[i],
      image = source.image as CanvasImageSource | undefined;
    if (!canBake || layer.blur < 0.5 || !image)
      return { texture: prepare(source), margin: Math.ceil(layer.blur * 1.3), blur: layer.blur };
    const margin = Math.ceil(layer.blur * 1.5),
      scale = layer.blur >= 8 ? 0.5 : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((layer.width + margin * 2) * scale);
    canvas.height = Math.ceil((layer.height + margin * 2) * scale);
    const context = canvas.getContext("2d")!;
    context.filter = `blur(${layer.blur * 0.5 * scale}px)`;
    context.drawImage(image, margin * scale, margin * scale, layer.width * scale, layer.height * scale);
    const texture = prepare(new CanvasTexture(canvas));
    baked.push(texture);
    return { texture, margin, blur: 0 };
  });
  function build(screen: Mesh) {
    const surface = theatreScreenSurface(screen.geometry, CANVAS_W / CANVAS_H);
    screen.updateWorldMatrix(true, false);
    const matrix = new Matrix4().copy(screen.matrixWorld),
      point = new Vector3();
    // Far layers first; within the artwork's own z order otherwise.
    const order = SCREEN_LAYERS.map((layer, i) => ({ layer, i })).sort(
      (a, b) => b.layer.depth - a.layer.depth || a.layer.z - b.layer.z,
    );
    order.forEach(({ layer, i }, rank) => {
      const { texture, margin, blur } = maps[i],
        padded = texture !== textures[i];
      const x0 = layer.x - margin,
        y0 = layer.y - margin,
        w = layer.width + margin * 2,
        h = layer.height + margin * 2;
      const sx = Math.max(2, Math.ceil(w / 96)),
        sy = Math.max(2, Math.ceil(h / 96));
      const positions: number[] = [],
        uvs: number[] = [],
        index: number[] = [];
      for (let j = 0; j <= sy; j++)
        for (let k = 0; k <= sx; k++) {
          const cx = x0 + (w * k) / sx,
            cy = y0 + (h * j) / sy;
          surface.point(cx / CANVAS_W, 1 - cy / CANVAS_H, point).applyMatrix4(matrix);
          positions.push(point.x, point.y, point.z);
          if (padded) uvs.push(k / sx, 1 - j / sy);
          else uvs.push((cx - layer.x) / layer.width, 1 - (cy - layer.y) / layer.height);
        }
      for (let j = 0; j < sy; j++)
        for (let k = 0; k < sx; k++) {
          const a = j * (sx + 1) + k,
            b = a + 1,
            c = a + sx + 1,
            d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      geometry.setIndex(index);
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: NormalBlending,
        toneMapped: false,
        uniforms: {
          uEye: { value: eye },
          uDepth: { value: layer.depth },
          uMap: { value: texture },
          uSize: { value: new Vector2(layer.width, layer.height) },
          uBlur: { value: blur },
          uGain: gain,
        },
      });
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = rank;
      mesh.name = `Screen depth | ${layer.file}`;
      scene.add(mesh);
      materials.push(material);
      geometries.push(geometry);
    });
    built = true;
  }
  return {
    get built() {
      return built;
    },
    build,
    /** Keep the depth artwork registered to the screen as the real camera turns. */
    render(gl: WebGLRenderer, camera: PerspectiveCamera, target: WebGLRenderTarget, brightness: number) {
      if (!built) return;
      gain.value = brightness;
      eye.copy(camera.position).lerp(seat, 0.35);
      const alpha = gl.getClearAlpha(),
        auto = gl.autoClear;
      gl.getClearColor(previousClear);
      gl.setRenderTarget(target);
      gl.setClearColor(white, 1);
      gl.clear(true, true, false);
      gl.autoClear = false;
      gl.render(scene, camera);
      gl.autoClear = auto;
      gl.setClearColor(previousClear, alpha);
    },
    dispose() {
      built = false;
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
      baked.forEach((t) => t.dispose());
      scene.clear();
      materials.length = 0;
      geometries.length = 0;
    },
  };
}
