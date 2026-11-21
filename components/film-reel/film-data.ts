// Section 1 (Products): one film strip, six frames, one product each.
// Shapes come from Frame_1.blend through scripts/export-film-frame.py.
export const FILM_MODEL = "/models/film/film-frame.glb";
export const FRAME_PITCH = 2; // a frame is 2 x 2, and frames join edge to edge
export const FILM_VOID = "#050506"; // the dark the strip hangs in
export const CONTENT_SIZE = { width: 1400, height: 320 }; // pixels; the text strip seen through the window is 1.783 x 0.407

/** `line`: one short sentence under the name, about what the product does for the person in the seat. */
export type FilmProduct = { name: string; line: string; picture: string };
export const FILM_PRODUCTS: FilmProduct[] = [
  {
    name: "Theatre Screen",
    line: "Where the light lands.",
    picture: "/film/screen.webp",
  },
  {
    name: "Projector & Lamp",
    line: "The light starts here, behind your head.",
    picture: "/film/projector.webp",
  },
  {
    name: "Sound System",
    line: "So a whisper reaches the back row.",
    picture: "/film/sound-system.webp",
  },
  {
    name: "Interior Design and Theatre Chairs",
    line: "Two hours should feel short.",
    picture: "/film/interior.webp",
  },
  {
    name: "3D Glasses",
    line: "Light enough to forget you have them on.",
    picture: "/film/3d-glasses.webp",
  },
  {
    name: "3D System",
    line: "The picture steps off the screen.",
    picture: "/film/3d-system.webp",
  },
];
