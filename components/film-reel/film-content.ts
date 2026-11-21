import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import { CONTENT_SIZE, type FilmProduct } from "./film-data";

/** The site's reading font, ready for drawing on a canvas. */
export async function filmFont(): Promise<string> {
  const sans = getComputedStyle(document.documentElement).getPropertyValue("--font-read").trim() || "sans-serif";
  await Promise.all([
    document.fonts.load(`600 80px ${sans}`),
    document.fonts.load(`400 40px ${sans}`),
  ]).catch(() => undefined);
  return sans;
}

const spaced = (context: CanvasRenderingContext2D, pixels: number) => {
  if ("letterSpacing" in context) context.letterSpacing = `${pixels}px`;
};

const ROWS = { name: 150, rule: 191, line: 257 };

/** The product name and its one-line description below the photograph. */
export function contentTexture(
  product: FilmProduct,
  font: string,
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

  // The name is large when it is short, and shrinks to fit when it is long.
  let size = 108;
  spaced(context, -1.5);
  context.textAlign = "left";
  do {
    size -= 4;
    context.font = `600 ${size}px ${font}`;
  } while (context.measureText(product.name).width > width - edge * 2 && size > 40);
  context.fillStyle = "#ecebe6";
  context.fillText(product.name, edge - 4, ROWS.name);

  context.fillStyle = "#3a3936";
  context.fillRect(edge, ROWS.rule, width - edge * 2, 2);

  context.fillStyle = "#aeaca6";
  context.font = `400 40px ${font}`;
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
