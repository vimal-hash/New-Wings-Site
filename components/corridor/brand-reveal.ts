/** Earliest safe point for the entrance: the feather's opaque shoulder has
 * passed the entire centred mark, including its upper-left corner. */
export function brandRevealPoint(width:number,height:number,logoWidth:number,feather:number){
  const w=Math.max(1,width),h=Math.max(1,height),slant=Math.min(h*.24,w*.16);
  const normal=Math.hypot(1,slant/w),logoHeight=logoWidth*355/390;
  const nearCorner=(h/2-logoHeight/2+(slant/w)*(w/2-logoWidth/2))/normal;
  const span=(h+slant)/normal,softness=Math.max(0,Math.min(240,feather));
  return Math.max(0,Math.min(1,1-nearCorner/(span+softness)+.012));
}
