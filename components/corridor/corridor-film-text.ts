import {CanvasTexture,LinearMipmapLinearFilter,SRGBColorSpace} from 'three';

/** One line of type drawn once into a texture, in the site's own sans (Geist). `outline` draws only the
 *  letters' stroke; `glow` adds a soft halo in the same colour. Returns the texture and its width/height. */
export function textTexture(text:string,{size=180,weight=500,spacing=.12,colour='#ffffff',outline=0,glow=0,mono=false}:{size?:number;weight?:number;spacing?:number;colour?:string;outline?:number;glow?:number;mono?:boolean}={}){
  const style=typeof document!=='undefined'?getComputedStyle(document.body):null;
  const family=(style?.getPropertyValue(mono?'--font-geist-mono':'--font-geist-sans')||'').trim()||(mono?'monospace':'Arial, sans-serif');
  const font=`${weight} ${size}px ${family}`,pad=Math.ceil(size*.35+glow*2+outline);
  const measure=document.createElement('canvas').getContext('2d')!;measure.font=font;
  const advance=[...text].map(letter=>measure.measureText(letter).width),gap=size*spacing;
  const width=Math.ceil(advance.reduce((a,b)=>a+b,0)+gap*Math.max(0,text.length-1)+pad*2),height=Math.ceil(size*1.25+pad*2);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d')!;context.font=font;context.textBaseline='middle';
  const draw=()=>{let x=pad;[...text].forEach((letter,i)=>{if(outline)context.strokeText(letter,x,height/2);else context.fillText(letter,x,height/2);x+=advance[i]+gap;});};
  context.fillStyle=context.strokeStyle=colour;context.lineWidth=outline;context.lineJoin='round';
  if(glow){context.shadowColor=colour;context.shadowBlur=glow;draw();context.shadowBlur=0;}
  draw();
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=8;texture.minFilter=LinearMipmapLinearFilter;
  return {texture,aspect:width/height};
}
