import type {LensValues} from './lens-controls';
export const lensZoom=(fov:number)=>Math.tan(40*Math.PI/360)/Math.tan(fov*Math.PI/360);
/** Ease in with the actual climb; .985 is the existing View 1 review stop.
 * Flat first/second derivatives at both ends prevent a lens snap at either join. */
export function viewOneLensWeight(stage:string,progress:number){
  if(stage==='slide'){const t=Math.max(0,Math.min(1,progress/.985));return t*t*t*(t*(t*6-15)+10);}
  if(stage==='top')return 1;
  if(stage!=='turn')return 0;
  const t=Math.max(0,Math.min(1,progress));return 1-t*t*t*(t*(t*6-15)+10);
}
/** Time-based camera input, independent of rendering frequency. */
export function createLensMotion(){
  let px=0,py=0,x=0,y=0,time=0;
  const result={x:0,y:0,roll:0,moving:false};
  return {
    pointer(nx:number,ny:number){px=Math.max(-1,Math.min(1,nx));py=Math.max(-1,Math.min(1,ny));},
    reset(){px=py=x=y=time=0;result.x=result.y=result.roll=0;result.moving=false;},
    tick(seconds:number,values:Readonly<LensValues>,reduce=false){
      if(!values.enabled||!values.living||reduce){x=y=0;result.x=result.y=result.roll=0;result.moving=false;return result;}
      const dt=Math.max(0,seconds);time+=dt;
      const mix=1-Math.exp(-dt/values.response);
      x+=(px-x)*mix;y+=(py-y)*mix;
      if(Math.abs(px-x)<.0001)x=px;if(Math.abs(py-y)<.0001)y=py;
      result.x=x*values.parallax+Math.sin(time*.37)*values.sway;
      result.y=y*values.parallax+Math.sin(time*.29+.7)*values.sway*.6;
      result.roll=(px-x)*values.roll;
      result.moving=values.sway>0||Math.abs(px-x)+Math.abs(py-y)>.0001;
      return result;
    },
  };
}
/** Perspective projection of a flat artwork plane, matched to its authored 40° pose.
 * Depth affects parallax, while the neutral lens preserves every asset's position/size. */
export function projectBrandPlane(cx:number,cy:number,width:number,height:number,depth:number,values:Readonly<LensValues>,motion:{x:number;y:number;roll:number},weight:number){
  if(!values.enabled||weight<=0)return {x:0,y:0,sx:1,sy:1,roll:0};
  const zoom=1+(lensZoom(values.fov)-1)*weight,squeeze=1+(values.squeeze-1)*weight;
  const sx=zoom/squeeze,sy=zoom;
  const separation=1-1/(1-depth*values.depth);
  const roll=motion.roll*weight,angle=roll*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),bx=cx-width/2,by=cy-height/2;
  return {x:bx*sx*cos-by*sy*sin-bx+motion.x*height*.035*separation*weight,y:bx*sx*sin+by*sy*cos-by+motion.y*height*.035*separation*weight,sx,sy,roll};
}
