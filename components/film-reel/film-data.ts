// Section 1 (Products): one film strip, six frames, one product each.
// Shapes come from Frame_1.blend through scripts/export-film-frame.py. Pictures are stand-ins made by scripts/make-film-placeholders.mjs.
export const FILM_MODEL="/models/film/film-frame.glb";
export const FRAME_PITCH=2; // a frame is 2 x 2, and frames join edge to edge
export const FILM_VOID="#050506"; // the dark the strip hangs in
export const CONTENT_SIZE={width:1400,height:320}; // pixels; the text strip seen through the window is 1.783 x 0.407

export type FilmProduct={name:string;brand:string;picture:string};
// Brand names are dummy text until the real ones are given.
export const FILM_PRODUCTS:FilmProduct[]=[
  {name:"Theatre Screen",brand:"Brand Name",picture:"/film/placeholder-01.png"},
  {name:"Projector & Lamp",brand:"Brand Name",picture:"/film/placeholder-02.png"},
  {name:"Sound System",brand:"Brand Name",picture:"/film/placeholder-03.png"},
  {name:"Interior Design and Theatre Chairs",brand:"Brand Name",picture:"/film/placeholder-04.png"},
  {name:"3D Glasses",brand:"Brand Name",picture:"/film/placeholder-05.png"},
  {name:"3D System",brand:"Brand Name",picture:"/film/placeholder-06.png"},
];
