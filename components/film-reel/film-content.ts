import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import { CONTENT_SIZE, type FilmProduct } from "./film-data";

type FilmFonts = { sans: string; mono: string };

/** The site's own fonts, ready for drawing on a canvas. */
export async function filmFonts(): Promise<FilmFonts> {
  const style = getComputedStyle(document.documentElement);
  const sans = style.getPropertyValue("--font-geist-sans").trim() || "sans-serif",
    mono = style.getPropertyValue("--font-geist-mono").trim() || "monospace";
  await Promise.all([
    document.fonts.load(`600 80px ${sans}`),
    document.fonts.load(`400 40px ${sans}`),
    document.fonts.load(`400 30px ${mono}`),
  ]).catch(() => undefined);
  return { sans, mono };
}

const spaced = (context: CanvasRenderingContext2D, pixels: number) => {
  if ("letterSpacing" in context) context.letterSpacing = `${pixels}px`;
};

/** Baselines (canvas pixels, top down): the number/brand row, the name, the rule under it, and the product's line. */
const ROWS = { meta: 70, name: 184, rule: 214, line: 274 };

/** The text strip under a picture: frame number, brand name, product name and its one short line. */
export function contentTexture(
  product: FilmProduct,
  index: number,
  total: number,
  fonts: FilmFonts,
  anisotropy: number,
) {
  const { width, height } = CONTENT_SIZE,
    edge = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#0c0c0c";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "alphabetic";
  const number = String(index + 1).padStart(2, "0"),
    count = String(total).padStart(2, "0");

  context.fillStyle = "#8f8d88";
  context.font = `400 26px ${fonts.mono}`;
  spaced(context, 6);
  context.textAlign = "left";
  context.fillText(`${number} / ${count}`, edge, ROWS.meta);
  context.textAlign = "right";
  context.fillText(product.brand.toUpperCase(), width - edge, ROWS.meta);

  // The name is large when it is short, and shrinks to fit when it is long.
  let size = 108;
  spaced(context, -1.5);
  context.textAlign = "left";
  do {
    size -= 4;
    context.font = `600 ${size}px ${fonts.sans}`;
  } while (context.measureText(product.name).width > width - edge * 2 && size > 40);
  context.fillStyle = "#ecebe6";
  context.fillText(product.name, edge - 4, ROWS.name);

  context.fillStyle = "#3a3936";
  context.fillRect(edge, ROWS.rule, width - edge * 2, 2);

  context.fillStyle = "#aeaca6";
  context.font = `400 40px ${fonts.sans}`;
  spaced(context, 0);
  context.fillText(product.line, edge - 2, ROWS.line);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false; // the model's UVs start at the top, as in every web model
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}
