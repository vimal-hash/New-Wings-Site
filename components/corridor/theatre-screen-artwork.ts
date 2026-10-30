import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Texture, Vector3 } from "three";

export const THEATRE_SCREEN_ARTWORK = "/images/theatre-screen-ghosted.png";

/** Fit the complete image by physical width/height, on the existing curved front only. */
export function applyTheatreScreenArtwork(material: MeshBasicMaterial, geometry: BufferGeometry, texture: Texture) {
  const positions = geometry.getAttribute("position");
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
  const front = new Set<number>(), curve = new Map<number, number>();
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize();
    if (normal.z > -.85) continue;
    for (let k = 0; k < 3; k++) {
      const index = i + k, x = positions.getX(index), y = positions.getY(index);
      front.add(index); curve.set(x, positions.getZ(index));
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!front.size) throw new Error("Theatre screen: front surface not found");
  const columns = [...curve].sort((a, b) => a[0] - b[0]);
  const distances = new Map<number, number>();
  let width = 0;
  columns.forEach(([x, z], i) => {
    if (i) width += Math.hypot(x - columns[i - 1][0], z - columns[i - 1][1]);
    distances.set(x, width);
  });
  const height = maxY - minY, image = texture.image as { width: number; height: number };
  const aspect = image.width / image.height;
  const fittedWidth = Math.min(width, height * aspect), fittedHeight = fittedWidth / aspect;
  const coordinates = new Float32Array(positions.count * 3);
  for (const index of front) {
    // The theatre camera faces +Z, so screen-right runs toward -X.
    coordinates[index * 3] = .5 - (distances.get(positions.getX(index))! - width / 2) / fittedWidth;
    coordinates[index * 3 + 1] = .5 + (positions.getY(index) - (minY + maxY) / 2) / fittedHeight;
    coordinates[index * 3 + 2] = 1;
  }
  geometry.setAttribute("screenArtwork", new Float32BufferAttribute(coordinates, 3));
  const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.theatreArtwork = { value: texture };
    shader.vertexShader = "attribute vec3 screenArtwork;\nvarying vec3 vScreenArtwork;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvScreenArtwork = screenArtwork;");
    shader.fragmentShader = "uniform sampler2D theatreArtwork;\nvarying vec3 vScreenArtwork;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec2 artUV = vScreenArtwork.xy;
      float insideImage = step(0., artUV.x) * step(artUV.x, 1.) * step(0., artUV.y) * step(artUV.y, 1.);
      vec3 imageColour = texture2D(theatreArtwork, clamp(artUV, 0., 1.)).rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(1.), imageColour, insideImage), step(.5, vScreenArtwork.z));`);
  };
  material.customProgramCacheKey = () => key + "|theatre-artwork-contain-v1";
  return { width, height, fittedWidth, fittedHeight, aspect };
}
