import Image from 'next/image';
import {useId,type RefObject,type CSSProperties} from 'react';
import artwork from './brand-artwork-layout.json';
import sparkles from './brand-sparkle-parts.json';
import letterParts from './brand-letter-parts.json';

const titles=artwork.elements.filter(item=>item.file.startsWith('text-'));
const decorations=artwork.elements.filter(item=>item.file!=='logo.webp'&&!item.file.startsWith('text-')&&!['bg-sound-rings.webp','sparkles-and-dots.webp'].includes(item.file));
const rings=artwork.elements.find(item=>item.file==='bg-sound-rings.webp')!;
const stars=artwork.elements.find(item=>item.file==='sparkles-and-dots.webp')!;
const position=(item:{x:number;y:number;width:number;height:number;z:number}):CSSProperties=>({position:'absolute',left:`${item.x/2048*100}%`,top:`${item.y/1152*100}%`,width:`${item.width/2048*100}%`,aspectRatio:`${item.width} / ${item.height}`,zIndex:item.z});
function character(file:string){
  if(file==='bg-curtain-valance.webp')return 'curtain';
  if(file.startsWith('bg-'))return 'still';
  if(file.includes('film-reel')||file.includes('lens-aperture'))return 'reel';
  if(file.includes('music-note'))return 'note';
  if(file==='sound-waveform.webp')return 'waveform';
  if(file==='speaker-tower.webp'||file==='subwoofer.webp')return 'bass';
  if(file==='soundbar.webp'||file==='av-receiver.webp'||file==='projector-4k.webp')return 'signal';
  if(file==='stage-spotlight.webp')return 'spotlight';
  if(file==='3d-glasses.webp'||file==='cinema-ticket.webp')return 'sway';
  if(file==='clapperboard.webp'||file==='projector-vintage.webp')return 'nod';
  if(file==='film-strip.webp')return 'strip';
  return 'still';
}

/** Nested layers keep entrance, object character and mouse displacement independent. */
export default function BrandArtwork({root}:{root:RefObject<HTMLDivElement|null>}){
  const id=useId().replaceAll(':','');
  return <div ref={root} className="brand-artwork" data-revealed="false" aria-hidden="true"
    style={{position:'absolute',inset:0,zIndex:0,pointerEvents:'none',overflow:'hidden'}}>
    <h1 style={{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)',whiteSpace:'nowrap'}}>New Wings Solutions</h1>
    {decorations.map((item,index)=><div key={item.file} data-lens-depth={item.file.startsWith('bg-')?-.35:.14} data-brand-repel={item.file.startsWith('bg-')?'background':'object'} style={position(item)}>
      <div className="brand-entrance" data-brand-layer={item.file==='silver-screen.webp'?'screen':item.file==='theatre-seats.webp'?'seats':'decoration'}
        data-brand-delay={item.file.startsWith('bg-')?650+index*20:260+(index%7)*75} data-brand-shift={item.y<576?10:-10} style={{opacity:0}}>
        <div className={`brand-idle brand-${character(item.file)}`} style={{animationDuration:`${character(item.file)==='reel'?36+index*2:5+index%5}s`,animationDelay:`${-index*.37}s`}}>
          <Image src={`/images/new-wings-artwork/${item.file}`} alt="" unoptimized width={item.width} height={item.height} draggable={false} loading="eager" style={{display:'block',width:'100%',height:'auto'}}/>
        </div>
      </div>
    </div>)}
    {[120,172,224,276].map((radius,index)=><div key={radius} data-lens-depth="-.12" data-brand-repel="ring" data-brand-ring={radius} style={position(rings)}>
      <div className="brand-entrance" data-brand-layer="ring" data-brand-delay={350+index*160}
        style={{opacity:0,transformOrigin:`${150/430*100}% ${280/473*100}%`}}>
        <svg viewBox="0 0 430 473" aria-hidden="true" style={{display:'block',width:'100%',height:'100%'}}>
          <defs><mask id={`${id}-ring-${index}`} maskUnits="userSpaceOnUse" x="0" y="0" width="430" height="473">
            <circle cx="150" cy="280" r={radius} fill="none" stroke="white" strokeWidth="8"/>
          </mask></defs>
          <image href="/images/new-wings-artwork/bg-sound-rings.webp" width="430" height="473" mask={`url(#${id}-ring-${index})`}/>
        </svg>
      </div>
    </div>)}
    {sparkles.map((part,index)=><div key={index} data-lens-depth={-.2-(index%4)*.06} data-brand-repel="star" style={position({x:stars.x+part.x,y:stars.y+part.y,width:part.width,height:part.height,z:stars.z})}>
      <div className="brand-entrance" data-brand-layer="sparkle" data-brand-delay={700+(index*137%650)} style={{opacity:0}}>
        <div className={`brand-idle ${part.twinkle?'brand-twinkle':''}`} style={{animationDuration:`${3.7+(index*193%530)/100}s`,animationDelay:`${-(index*317%700)/100}s`}}>
          <svg viewBox={`${part.x} ${part.y} ${part.width} ${part.height}`} aria-hidden="true" style={{display:'block',width:'100%',height:'100%'}}>
            <image href="/images/new-wings-artwork/sparkles-and-dots.webp" width="1991" height="1087"/>
          </svg>
        </div>
      </div>
    </div>)}
    <div data-lens-depth="0" style={{position:'absolute',inset:0,zIndex:30}}><div className="brand-wordmark" style={{position:'absolute',left:'50%',top:'50%',width:'calc(var(--brand-logo-width, 29vmin) * 5.171717)',aspectRatio:'2048 / 1152',transform:'translate(-51.806640625%, -49.956597222%)',zIndex:30}}>
      {titles.map((item,index)=><div key={item.file} className={`brand-title-image brand-title-${index}`} style={{...position({...item,z:0}),height:'auto'}}>
        <div className="brand-entrance" data-brand-layer={index?'right':'left'} data-brand-delay={index*70}
          style={{opacity:0,maskImage:`linear-gradient(to ${index?'left':'right'},transparent 45%,#000 50%)`,maskSize:'220% 100%',maskRepeat:'no-repeat',maskPosition:index?'100% 0':'0% 0'}}>
          {letterParts[item.file as keyof typeof letterParts].map((letter,letterIndex)=><div key={letterIndex}
            data-brand-repel="letter" data-brand-letter={letter.letter} data-brand-word={index?'Solutions':'New Wings'}
            style={{position:'absolute',left:`${letter.x/item.width*100}%`,top:0,width:`${letter.width/item.width*100}%`,height:'100%'}}>
            <svg viewBox={`${letter.x} 0 ${letter.width} ${item.height}`} aria-hidden="true" style={{display:'block',width:'100%',height:'100%'}}>
              <image href={`/images/new-wings-artwork/${item.file}`} width={item.width} height={item.height}/>
            </svg>
          </div>)}
        </div>
      </div>)}
    </div></div>
    <style>{`
      .brand-entrance,.brand-idle{width:100%;height:100%}
      .brand-idle{animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-play-state:var(--brand-play-state,paused)}
      .brand-reel{animation-name:brand-turn;animation-timing-function:linear}
      .brand-note{animation-name:brand-note-drift}
      .brand-bass{animation-name:brand-bass-beat}
      .brand-waveform{animation-name:brand-waveform;animation-duration:2.6s!important}
      .brand-signal{animation-name:brand-signal-light}
      .brand-spotlight{animation-name:brand-aim;transform-origin:50% 98%}
      .brand-sway{animation-name:brand-sway}
      .brand-nod{animation-name:brand-nod;transform-origin:50% 95%}
      .brand-strip{animation-name:brand-strip}
      .brand-curtain{animation-name:brand-curtain;transform-origin:50% 0}
      .brand-twinkle{animation-name:brand-star-light}
      @keyframes brand-turn{to{transform:rotate(360deg)}}
      @keyframes brand-note-drift{0%,100%{transform:translateY(2px) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}
      @keyframes brand-bass-beat{0%,62%,100%{transform:scale(1)}68%{transform:scale(1.025)}77%{transform:scale(1)}85%{transform:scale(1.015)}}
      @keyframes brand-waveform{0%,100%{transform:scaleY(.78)}25%{transform:scaleY(1.1)}48%{transform:scaleY(.9)}70%{transform:scaleY(1.04)}}
      @keyframes brand-signal-light{0%,100%{opacity:.84}36%{opacity:1}55%{opacity:.91}68%{opacity:1}}
      @keyframes brand-aim{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
      @keyframes brand-sway{0%,100%{transform:translateY(1px) rotate(-1deg)}50%{transform:translateY(-1px) rotate(1deg)}}
      @keyframes brand-nod{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.8deg)}}
      @keyframes brand-strip{0%,100%{transform:translateY(0) rotate(-.4deg)}50%{transform:translateY(-2px) rotate(.4deg)}}
      @keyframes brand-curtain{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.025)}}
      @keyframes brand-star-light{0%,100%{opacity:.55}12%{opacity:.22}22%{opacity:1}35%{opacity:.38}69%{opacity:.48}78%{opacity:.95}87%{opacity:.28}}
      @media(max-width:699px){
        .brand-wordmark{top:calc(50% + var(--brand-logo-width,29vmin) * .45513 + 24px)!important;width:90%!important;aspect-ratio:auto!important;transform:translateX(-50%)!important}
        .brand-title-image{position:relative!important;left:auto!important;top:auto!important;width:86%!important;display:block;margin:0 auto 6px}
        .brand-title-1{width:76%!important}
      }
      @media(prefers-reduced-motion:reduce){.brand-idle{animation:none!important}}
    `}</style>
  </div>;
}
