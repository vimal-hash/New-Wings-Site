// Section 4's dust: tiny round specks floating through a beam of light in a dark room, seen through a real lens.
//
// - Placement: specks fill the room, but only the ones inside a beam of light are seen. The beam is a real cone in 3D,
//   crossing the room from the upper left, past the cards. Specks drift in and out of it, so they brighten and fade
//   slowly as they cross its soft edge. Outside it they are almost invisible.
// - Material: every speck is a small sphere lit from the beam's side. Most are tiny and dim, a few are bright (a
//   long-tailed spread, as with real dust). Nothing flashes or blinks: every change of brightness is slow and smooth.
// - Lens: each speck has a real distance, projected with the camera's field of view (near ones are bigger and move more
//   with the camera). The lens is focused on the cards (distance 1): specks in front of them open into soft round orbs;
//   specks behind soften only a little. An orb keeps the speck's light, so it gets fainter as it grows.
// - Clean pixels: each sprite is drawn from a copy made near its drawn size (like mipmaps), and no speck is drawn
//   smaller than about a pixel, so small moving specks do not shimmer.
//
// Two canvases: specks behind the cards draw under them, specks in front over them. Additive light, one sprite per lit
// speck. The count follows the device and the screen size, and fades down by itself if frames get slow.

export type DustView={fov:number;camX:number;camY:number;strength:number};
export type Dust={resize(width:number,height:number):void;draw(time:number,dt:number,view:DustView):void;clear():void;warm():void};

const FOCUS=1,TAU=Math.PI*2;
// The beam: like light from a high window, it crosses the room from the upper left to the lower right, just in front
// of the cards and around them (a beam behind the cards would be hidden by them).
const B0=[-1.4,-1,.65],BD=(()=>{const v=[1,.7,.1],l=Math.hypot(v[0],v[1],v[2]);return v.map(n=>n/l);})();
const beamRadius=(t:number)=>.28+.02*t;
// Two directions across the beam, for placing specks inside it.
const BU=(()=>{const v=[BD[1],-BD[0],0],l=Math.hypot(v[0],v[1]);return [v[0]/l,v[1]/l,0];})();
const BV=[BD[1]*BU[2]-BD[2]*BU[1],BD[2]*BU[0]-BD[0]*BU[2],BD[0]*BU[1]-BD[1]*BU[0]];
// Where the light comes from on screen (up and to the left, a little towards the camera): it lights each sphere.
const LIGHT=(()=>{const v=[-.55,-.62,.56],l=Math.hypot(v[0],v[1],v[2]);return v.map(n=>n/l);})();

const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(a:number,b:number,v:number)=>{const t=clamp01((v-a)/(b-a));return t*t*(3-2*t);};

/** One sprite, drawn at several sizes so each speck is drawn from a copy near its own size. */
type Mips={sizes:number[];images:HTMLCanvasElement[]};
function mips(value:(x:number,y:number)=>number):Mips{
  const sizes=[4,8,16,32,64,128],images=sizes.map(size=>{
    const c=document.createElement("canvas");c.width=c.height=size;
    const g=c.getContext("2d")!,img=g.createImageData(size,size),n=size>=32?2:4; // several samples per pixel: smooth edges at every size
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      let sum=0;
      for(let sy=0;sy<n;sy++)for(let sx=0;sx<n;sx++)sum+=value(((x+(sx+.5)/n)/size)*2-1,((y+(sy+.5)/n)/size)*2-1);
      const i=(y*size+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=255;img.data[i+3]=Math.round(clamp01(sum/(n*n))*255);
    }
    g.putImageData(img,0,0);return c;
  });
  return {sizes,images};
}
const pick=(m:Mips,devicePixels:number)=>{for(let k=0;k<m.sizes.length;k++)if(m.sizes[k]>=devicePixels)return m.images[k];return m.images[m.images.length-1];};

/** A tiny speck, softened by the lens: a Gaussian whose sigma is a third of the sprite's half width. */
const pointMips=()=>mips((x,y)=>Math.exp(-(x*x+y*y)*4.5));
/** A speck in focus and big enough to see: a sphere lit from the beam's side, with a soft limb and a faint halo. */
const sphereMips=()=>mips((x,y)=>{
  const r=Math.hypot(x,y)/.62;
  const halo=.16*Math.exp(-r*r*1.6);
  if(r>=1.06)return halo;
  const rr=Math.min(1,r),nz=Math.sqrt(1-rr*rr),nx=x/.62,ny=y/.62;
  const lambert=Math.max(0,nx*LIGHT[0]+ny*LIGHT[1]+nz*LIGHT[2]);
  const edge=1-smooth(.9,1.06,r);
  return Math.max(halo,(.32+.68*lambert)*edge);
});
/**
 * A speck far out of focus: a round orb. Evenly filled, very slightly brighter towards its rim (as a real lens draws
 * it), a little brighter on the lit side so it reads as a sphere of light, and a soft, clean edge.
 */
const orbMips=()=>mips((x,y)=>{
  const r=Math.hypot(x,y)/.92;
  if(r>1.1)return 0;
  const fill=.6+.22*smooth(.35,.92,r),lit=1+.1*clamp01(-(x*.7+y*.72));
  return fill*lit*(1-smooth(.86,1.06,r));
});

export function createDust(back:HTMLCanvasElement,front:HTMLCanvasElement,count:number,maxDpr:number):Dust{
  const point=pointMips(),sphere=sphereMips(),orb=orbMips();
  const bc=back.getContext("2d")!,fc=front.getContext("2d")!;
  const x=new Float32Array(count),y=new Float32Array(count),d=new Float32Array(count),r=new Float32Array(count);
  const glow=new Float32Array(count),phase=new Float32Array(count),age=new Float32Array(count),shown=new Float32Array(count).fill(1);
  let width=1,height=1,dpr=1,blank=true,active=count,slow=0,frames=0;
  const gauss=()=>{let s=0;for(let k=0;k<4;k++)s+=Math.random();return (s-2)*1.73;};
  // Light at a point: 1 inside the beam, falling softly to nothing across its edge; the room is almost dark.
  const lightAt=(px:number,py:number,pd:number)=>{
    const rx=px-B0[0],ry=py-B0[1],rz=pd-B0[2],t=rx*BD[0]+ry*BD[1]+rz*BD[2];
    if(t<0)return 0;
    const q=Math.hypot(rx-t*BD[0],ry-t*BD[1],rz-t*BD[2]),rad=beamRadius(t),edge=clamp01((q-.5*rad)/(.6*rad));
    return .02+.98*(1-edge*edge*(3-2*edge));
  };
  const spawn=(i:number)=>{
    if(Math.random()<.88){
      // Somewhere along the part of the beam that crosses the view.
      const t=.6+Math.random()*2.6;
      const rad=beamRadius(t)*1.2*Math.sqrt(Math.random()),a=Math.random()*TAU,cu=Math.cos(a)*rad,cv=Math.sin(a)*rad;
      x[i]=B0[0]+t*BD[0]+cu*BU[0]+cv*BV[0];y[i]=B0[1]+t*BD[1]+cu*BU[1]+cv*BV[1];d[i]=B0[2]+t*BD[2]+cu*BU[2]+cv*BV[2];
    }else{const dist=.4+Math.random()*6;d[i]=dist;x[i]=(Math.random()*2-1)*dist*.9;y[i]=(Math.random()*2-1)*dist*.55;}
    if(d[i]<.36)d[i]=.36+Math.random()*.4;
    // Mostly tiny and dim, a few large or bright.
    r[i]=Math.min(.0032,.00045*Math.exp(gauss()*.5));
    glow[i]=Math.min(1.6,.4*Math.exp(gauss()*.6));
    phase[i]=Math.random()*TAU;age[i]=0;
  };
  for(let i=0;i<count;i++){spawn(i);age[i]=9;}
  return {
    resize(w,h){
      width=Math.max(1,w);height=Math.max(1,h);dpr=Math.min(maxDpr,window.devicePixelRatio||1);
      for(const c of [back,front]){c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);}
      blank=true;
    },
    // Draws every sprite once, far too faint to see, so the browser has prepared them before the dust first appears.
    warm(){
      for(const ctx of [bc,fc]){
        ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation="lighter";ctx.globalAlpha=.002;
        for(const m of [point,sphere,orb])m.images.forEach((image,k)=>ctx.drawImage(image,k*4,0,2,2));
        ctx.globalAlpha=1;
      }
      blank=false;
    },
    clear(){if(blank)return;bc.setTransform(1,0,0,1,0,0);fc.setTransform(1,0,0,1,0,0);bc.clearRect(0,0,back.width,back.height);fc.clearRect(0,0,front.width,front.height);blank=true;},
    draw(time,dt,{fov,camX,camY,strength}){
      // A slow device shows fewer specks (never fewer than a third). Specks leave by fading out over a second or two,
      // so nothing vanishes at once.
      if(dt>0){frames++;if(dt>.026)slow++;if(frames>=90){if(slow>30)active=Math.max(Math.floor(count/3),Math.floor(active*.8));frames=slow=0;}}
      const fadeStep=Math.min(1,dt*.8);
      // Air: each speck settles slowly and is carried by a gentle, smoothly varying current.
      for(let i=0;i<count;i++){
        shown[i]+=((i<active?1:0)-shown[i])*fadeStep;
        if(i>=active&&shown[i]<.002)continue;
        const p=phase[i];
        x[i]+=(.004*Math.sin(y[i]*2.1+time*.13+p)+.003*Math.sin(d[i]*1.7-time*.08))*dt;
        y[i]+=(.0022+.003*Math.cos(x[i]*1.9-time*.11+p*1.3))*dt;
        d[i]+=.004*Math.sin(time*.07+p*2.1)*dt;
        age[i]+=dt;
        // A speck is only replaced where it cannot be seen: off screen, or outside the light.
        if(d[i]<.3||d[i]>7.5||Math.abs(y[i])>d[i]*.9||Math.abs(x[i])>d[i]*1.4||(lightAt(x[i],y[i],d[i])<.03&&Math.random()<dt*.5))spawn(i);
      }
      if(strength<=.001){this.clear();return;}
      blank=false;
      bc.setTransform(dpr,0,0,dpr,0,0);fc.setTransform(dpr,0,0,dpr,0,0);
      bc.clearRect(0,0,width,height);fc.clearRect(0,0,width,height);
      bc.globalCompositeOperation=fc.globalCompositeOperation="lighter";
      const f=height/2/Math.tan(fov*Math.PI/360),scale=Math.min(width,height*1.6)/1280;
      const nearBlur=10*scale,farBlur=1.6*scale,floor=.6/Math.min(dpr,1.25); // never under about a device pixel
      for(let i=0;i<count;i++){
        if(shown[i]<.002)continue;
        const dist=d[i],lit=lightAt(x[i],y[i],dist);
        if(lit<.04)continue;
        const sx=width/2+(x[i]-camX)/dist*f,sy=height/2+(y[i]-camY)/dist*f;
        const size=r[i]/dist*f;
        const coc=dist<FOCUS?nearBlur*(FOCUS/dist-1):farBlur*(1-FOCUS/dist);
        const radius=Math.sqrt(size*size+coc*coc+floor*floor);
        if(sx+radius*3<0||sx-radius*3>width||sy+radius*3<0||sy-radius*3>height)continue;
        const air=Math.min(1,Math.exp(-(dist-1.2)*.18));
        const spread=Math.min(1,(size*2+.6)/radius); // the same light over a bigger orb
        const born=smooth(0,2.5,age[i]),close=smooth(.3,.46,dist);
        let alpha=strength*glow[i]*lit*air*spread*spread*born*close*shown[i]*Math.min(1,size/.5+.25);
        if(alpha<.004)continue;
        alpha=Math.min(1,alpha);
        const ctx=dist<FOCUS*.94?fc:bc,soft=smooth(.45,.8,coc/radius);
        if(soft<.99){
          ctx.globalAlpha=alpha*(1-soft);
          if(size>1.5&&coc<size){
            // Big and sharp enough to see its shape: a lit sphere.
            const s=size*2/.62;ctx.drawImage(pick(sphere,s*dpr),sx-s/2,sy-s/2,s,s);
          }else{const s=radius*6;ctx.drawImage(pick(point,s*dpr),sx-s/2,sy-s/2,s,s);}
        }
        if(soft>.01){ctx.globalAlpha=alpha*soft*.8;const s=radius*2/.92;ctx.drawImage(pick(orb,s*dpr),sx-s/2,sy-s/2,s,s);}
      }
      bc.globalAlpha=fc.globalAlpha=1;
    },
  };
}
