type Bounds={x:number;y:number;width:number;height:number};
/** Bounded displacement away from a nearby pointer, including a ring's actual arc. */
export function brandRepulsion(px:number,py:number,rect:Bounds,kind:string,ring=0){
  const cx=rect.x+rect.width*(kind==='ring'?150/430:.5),cy=rect.y+rect.height*(kind==='ring'?280/473:.5);
  const dx=cx-px,dy=cy-py,length=Math.hypot(dx,dy);
  const distance=kind==='ring'?Math.abs(length-ring*rect.width/430):Math.hypot(Math.max(rect.x-px,0,px-rect.x-rect.width),Math.max(rect.y-py,0,py-rect.y-rect.height));
  const reach=kind==='letter'?70:kind==='star'?64:kind==='background'?80:110;
  const amount=kind==='letter'?6:kind==='star'?3:kind==='ring'||kind==='background'?5:kind==='text'?7:8;
  const force=amount*Math.max(0,1-distance/reach)**2;
  if(length<.001)return{x:0,y:-force};
  return{x:dx/length*force,y:dy/length*force};
}
