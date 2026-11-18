// Section 1 (Products): one film strip, six frames, one product each.
// Shapes come from Frame_1.blend through scripts/export-film-frame.py. Pictures are stand-ins made by scripts/make-film-placeholders.mjs.
export const FILM_MODEL = "/models/film/film-frame.glb";
export const FRAME_PITCH = 2; // a frame is 2 x 2, and frames join edge to edge
export const FILM_VOID = "#050506"; // the dark the strip hangs in
export const CONTENT_SIZE = { width: 1400, height: 320 }; // pixels; the text strip seen through the window is 1.783 x 0.407

/** `line`: one short sentence under the name, about what the product does for the person in the seat. */
export type FilmProduct = { name: string; brand: string; line: string; picture: string };
// Brand names are dummy text until the real ones are given.
export const FILM_PRODUCTS: FilmProduct[] = [
  {
    name: "Theatre Screen",
    brand: "Brand Name",
    line: "Where the light lands.",
    picture: "/film/placeholder-01.png",
  },
  {
    name: "Projector & Lamp",
    brand: "Brand Name",
    line: "The light starts here, behind your head.",
    picture: "/film/placeholder-02.png",
  },
  {
    name: "Sound System",
    brand: "Brand Name",
    line: "So a whisper reaches the back row.",
    picture: "/film/placeholder-03.png",
  },
  {
    name: "Interior Design and Theatre Chairs",
    brand: "Brand Name",
    line: "Two hours should feel short.",
    picture: "/film/placeholder-04.png",
  },
  {
    name: "3D Glasses",
    brand: "Brand Name",
    line: "Light enough to forget you have them on.",
    picture: "/film/placeholder-05.png",
  },
  {
    name: "3D System",
    brand: "Brand Name",
    line: "The picture steps off the screen.",
    picture: "/film/placeholder-06.png",
  },
];
