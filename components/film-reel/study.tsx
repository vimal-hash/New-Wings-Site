"use client";
import FilmReel from "./film-reel";

/** Review page for Section 1 on its own: white, house lights down, six frames by scroll, the last flash to white. Reload to see it again. */
export default function FilmStudy(){
  return <div style={{position:"fixed",inset:0,background:"#fff"}}>
    <FilmReel listen/>
    <p style={{position:"fixed",left:20,top:"max(16px, env(safe-area-inset-top))",margin:0,font:"11px var(--font-geist-mono), monospace",letterSpacing:".14em",textTransform:"uppercase",color:"#8a8a86",pointerEvents:"none"}}>Film reel · review</p>
  </div>;
}
