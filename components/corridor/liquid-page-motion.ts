/** Dimensionless full-viewport cover for the 3:2 liquid sheet. */
export function pageCoverScale(aspect:number,fov:number,distance:number,width:number){
  const height=2*Math.tan(fov*Math.PI/360)*distance;
  return height*Math.max(aspect,1.5)/width*1.004;
}
export function pageEase(t:number){const x=Math.max(0,Math.min(1,t));return x*x*x*(x*(x*6-15)+10);}
