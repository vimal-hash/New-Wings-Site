import { ClampToEdgeWrapping, LinearFilter, NoColorSpace, type Texture } from "three";
import source from "./blue-look.json";
import { assetURL } from "../corridor/asset-url";
import type { RopeLook } from "./rope-materials";

export const BLUE_PALETTE = assetURL("/rope-model/blue/palette-desktop.png");
export const BLUE_PALETTE_LAPTOP = assetURL("/rope-model/blue/palette-laptop.png");
// The same dark haze as the approved red, transformed by the source colour-family rule.
export const BLUE_BACKDROP = [0.000015, 0.000555, 0.0035];
export const BLUE_SIDE = source.side as [number, number, number];
export const BLUE_FACE = source.face as [number, number, number];
export function blueRopeLook(red: RopeLook): RopeLook {
  return {
    ...red,
    exposure: source.exposure,
    core_color: source.core as [number, number, number],
    grade: source.grade as [number, number][][],
  };
}
/** Shared loader-owned lookup, sampled as data and decoded exactly once in the shader. */
export function prepareBluePalette(texture: Texture | undefined) {
  if (!texture) return undefined;
  texture.colorSpace = NoColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
export const bluePaletteGlsl = /* glsl */ `
  uniform sampler2D uBluePalette;
  uniform float uBluePaletteWidth;
  vec3 blueRamp(vec3 red){
    float u=(clamp(red.r,0.,1.)*(uBluePaletteWidth-1.)+.5)/uBluePaletteWidth;
    return linear(texture2D(uBluePalette,vec2(u,.5)).rgb);
  }
  // Baked diffuse is a small contribution. This is the source green-to-blue
  // colour-family matrix, expressed against the stored red channels.
  vec3 blueLight(vec3 red){return vec3(.3*red.g,.1*red.r+.7*red.g+.5*red.b,red.r);}
`;
