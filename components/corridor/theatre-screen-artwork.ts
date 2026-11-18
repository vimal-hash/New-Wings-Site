import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Texture, Vector3 } from "three";
import { theatreScreenCatalogue } from "./theatre-screen-catalogue";

// The artwork's file lives with the opening's other files, which the page starts downloading early.
export { THEATRE_SCREEN_ARTWORK } from "./opening-files";

/** The curved front, measured once: artwork UV ↔ local position for a contain-fitted image of this aspect. */
export function theatreScreenSurface(geometry: BufferGeometry, aspect: number) {
  const positions = geometry.getAttribute("position");
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    ab = new Vector3(),
    ac = new Vector3();
  const front = new Set<number>(),
    curve = new Map<number, number>();
  let minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    const normal = ab.subVectors(b, a).cross(ac.subVectors(c, a)).normalize();
    if (normal.z > -0.85) continue;
    for (let k = 0; k < 3; k++) {
      const index = i + k,
        x = positions.getX(index),
        y = positions.getY(index);
      front.add(index);
      curve.set(x, positions.getZ(index));
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!front.size) throw new Error("Theatre screen: front surface not found");
  const columns = [...curve].sort((a, b) => a[0] - b[0]);
  const distances = new Map<number, number>(),
    along: number[] = [];
  let width = 0;
  columns.forEach(([x, z], i) => {
    if (i) width += Math.hypot(x - columns[i - 1][0], z - columns[i - 1][1]);
    distances.set(x, width);
    along.push(width);
  });
  const height = maxY - minY;
  const fittedWidth = Math.min(width, height * aspect),
    fittedHeight = fittedWidth / aspect;
  return {
    front,
    width,
    height,
    fittedWidth,
    fittedHeight,
    aspect,
    // The theatre camera faces +Z, so screen-right runs toward -X.
    uv: (index: number) =>
      [
        0.5 - (distances.get(positions.getX(index))! - width / 2) / fittedWidth,
        0.5 + (positions.getY(index) - (minY + maxY) / 2) / fittedHeight,
      ] as const,
    /** Local point on the curved front for an artwork UV (extends linearly beyond its ends). */
    point(u: number, v: number, out: Vector3) {
      const distance = width / 2 + (0.5 - u) * fittedWidth;
      let i = 1;
      while (i < along.length - 1 && along[i] < distance) i++;
      const t = (distance - along[i - 1]) / (along[i] - along[i - 1] || 1e-9);
      return out.set(
        columns[i - 1][0] + (columns[i][0] - columns[i - 1][0]) * t,
        (minY + maxY) / 2 + (v - 0.5) * fittedHeight,
        columns[i - 1][1] + (columns[i][1] - columns[i - 1][1]) * t,
      );
    },
  };
}

/** Fit the complete image by physical width/height, on the existing curved front only. */
export function applyTheatreScreenArtwork(
  material: MeshBasicMaterial,
  geometry: BufferGeometry,
  texture: Texture,
  catalogue?: Texture,
) {
  const image = texture.image as { width: number; height: number };
  const surface = theatreScreenSurface(geometry, image.width / image.height);
  const positions = geometry.getAttribute("position");
  const coordinates = new Float32Array(positions.count * 3);
  for (const index of surface.front) {
    const [u, v] = surface.uv(index);
    coordinates[index * 3] = u;
    coordinates[index * 3 + 1] = v;
    coordinates[index * 3 + 2] = 1;
  }
  geometry.setAttribute("screenArtwork", new Float32BufferAttribute(coordinates, 3));
  const compile = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.theatreArtwork = { value: texture };
    if (catalogue) {
      shader.uniforms.theatreCatalogue = { value: catalogue };
      shader.uniforms.theatreCatalogueCover = theatreScreenCatalogue.cover;
      shader.uniforms.theatreCatalogueText = theatreScreenCatalogue.text;
    }
    shader.vertexShader =
      "attribute vec3 screenArtwork;\nvarying vec3 vScreenArtwork;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvScreenArtwork = screenArtwork;",
    );
    shader.fragmentShader =
      "uniform sampler2D theatreArtwork;\nvarying vec3 vScreenArtwork;\n" +
      (catalogue
        ? "uniform sampler2D theatreCatalogue;uniform float theatreCatalogueCover,theatreCatalogueText;\n"
        : "") +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      vec2 artUV = vScreenArtwork.xy;
      float insideImage = step(0., artUV.x) * step(artUV.x, 1.) * step(0., artUV.y) * step(artUV.y, 1.);
      vec3 imageColour = texture2D(theatreArtwork, clamp(artUV, 0., 1.)).rgb;
      vec3 screenColour=mix(vec3(1.),imageColour,insideImage);
      ${
        catalogue
          ? `
      if(theatreCatalogueCover>0.){
        vec2 catalogueUV=artUV+vec2(0.,.065*(1.-theatreCatalogueText));
        vec3 card=texture2D(theatreCatalogue,clamp(catalogueUV,0.,1.)).rgb;
        screenColour=mix(screenColour,card*theatreCatalogueText*insideImage,theatreCatalogueCover);
      }`
          : ""
      }
      diffuseColor.rgb=mix(diffuseColor.rgb,screenColour,step(.5,vScreenArtwork.z));`,
    );
  };
  material.customProgramCacheKey = () =>
    key + (catalogue ? "|theatre-artwork-catalogue-v1" : "|theatre-artwork-contain-v1");
  return {
    width: surface.width,
    height: surface.height,
    fittedWidth: surface.fittedWidth,
    fittedHeight: surface.fittedHeight,
    aspect: surface.aspect,
  };
}
