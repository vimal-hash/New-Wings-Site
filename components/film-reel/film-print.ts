import {CanvasTexture,LinearFilter,LinearMipmapLinearFilter,NoColorSpace} from "three";
import {type FilmFonts,spaced} from "./film-content";

/**
 * Where the edge print sits on a frame, in frame units (a frame is 2 x 2, centre at 0).
 * It lies in the two outer margins, outside the sprocket holes, as on 35 mm stock.
 */
export const PRINT={band:.0625,top:.9624,bottom:-.972};

const WIDE=2048,ROW=64; // drawing size of one band: 1024 pixels per frame unit

/**
 * All the edge print in one sheet: for frame i, row 2i is its top band and row 2i+1 its bottom band.
 * The wording is a stand-in until the real edge text is given.
 */
export function printTexture(count:number,fonts:FilmFonts,small:boolean,anisotropy:number){
  const scale=small?.5:1,rows=count*2;
  const canvas=document.createElement("canvas");canvas.width=WIDE*scale;canvas.height=ROW*rows*scale;
  const context=canvas.getContext("2d")!;
  context.fillStyle="#000";context.fillRect(0,0,canvas.width,canvas.height);
  context.scale(scale,scale);
  context.fillStyle="#fff";context.shadowColor="#fff";context.shadowBlur=3*scale; // print is exposed through a lens, so its edge is a little soft
  context.textBaseline="alphabetic";context.textAlign="left";context.font=`500 52px ${fonts.mono}`;spaced(context,8);
  const capital=context.measureText("N").actualBoundingBoxAscent||37;

  for(let index=0;index<count;index++){
    const number=String(index+1).padStart(2,"0");
    const line=(row:number)=>{
      const middle=row*ROW+ROW/2,base=middle+capital/2;
      // The arrow is drawn by hand, because the font may not carry one.
      const arrow=(x:number)=>{
        const tall=capital*.78,wide=tall*.9;
        context.beginPath();context.moveTo(x,middle-tall/2);context.lineTo(x+wide,middle);context.lineTo(x,middle+tall/2);context.closePath();context.fill();
        return x+wide;
      };
      const text=(words:string,x:number)=>{context.fillText(words,x,base);return x+context.measureText(words).width;};
      return {arrow,text};
    };
    const top=line(index*2);
    top.text(number,top.arrow(top.text("NEW WINGS",96)+30)+24);
    top.text("SAFETY FILM",1150);
    const bottom=line(index*2+1);
    bottom.text(number,bottom.arrow(300)+22);
    bottom.text(`${number}A`,bottom.arrow(1324)+22);
  }

  const texture=new CanvasTexture(canvas);
  texture.colorSpace=NoColorSpace;texture.flipY=false; // a mask, not a colour
  texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.anisotropy=anisotropy;
  return texture;
}
