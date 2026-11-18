import { CanvasTexture, SRGBColorSpace } from "three";

// Shared by the screen material, its lens render, and the existing hover picker.
export const theatreScreenCatalogue = {
  name: null as string | null,
  cover: { value: 0 },
  text: { value: 0 },
};

const WIDTH = 1536,
  HEIGHT = 564;
const CONTACT_RECT = { left: 0.404, right: 0.596, bottom: 0.25, top: 0.38 };

/** A single texture paints into the curved screen's existing artwork UVs. */
export function createTheatreCatalogueTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  let shown: string | null = null;
  const clear = () => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, WIDTH, HEIGHT);
  };
  clear();
  return {
    texture,
    show(name: string) {
      if (shown === name) return;
      shown = name;
      clear();
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "500 76px Arial, sans-serif";
      context.fillText(name, WIDTH / 2, HEIGHT * 0.42, WIDTH * 0.83);
      // The screen itself cannot be clicked: the hint points at the product under the mouse.
      const rect = CONTACT_RECT,
        y = (1 - rect.top) * HEIGHT,
        h = (rect.top - rect.bottom) * HEIGHT;
      context.font = "500 28px Arial, sans-serif";
      context.globalAlpha = 0.78;
      context.fillText("CLICK  TO  ENQUIRE", WIDTH / 2, y + h / 2);
      context.fillRect(WIDTH / 2 - 26, y + h / 2 + 30, 52, 2);
      context.globalAlpha = 1;
      texture.needsUpdate = true;
    },
  };
}
