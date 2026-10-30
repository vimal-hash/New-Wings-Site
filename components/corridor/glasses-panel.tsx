'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {glassesControls,GLASSES_RANGES} from './glasses-controls';
const labels={distance:'Glasses distance (cm)',width:'Glasses width (%)',gap:'Middle gap (%)',blur:'Frame blur (px)',tint:'Lens darkness',bridge:'Bridge visibility'};
export default function GlassesPanel(){
 const values=useSyncExternalStore(glassesControls.subscribe,glassesControls.read,glassesControls.serverRead);
 useEffect(()=>{glassesControls.load(localStorage);},[]);
 useEffect(()=>{const timer=setTimeout(()=>glassesControls.save(localStorage),250);return()=>clearTimeout(timer);},[values]);
 return <details open><summary>Theatre · glasses</summary>
 {Object.entries(GLASSES_RANGES).map(([field,range])=>{const key=field as keyof typeof GLASSES_RANGES;return <div className="cinema-slider" key={key}><label htmlFor={'glasses-'+key}>{labels[key]}</label><input id={'glasses-'+key} aria-label={labels[key]} type="range" min={range[0]} max={range[1]} step={range[2]} value={values[key]} onChange={e=>glassesControls.set(key,e.target.valueAsNumber)}/><input aria-label={labels[key]+' value'} type="number" min={range[0]} max={range[1]} step={range[2]} value={values[key]} onChange={e=>glassesControls.set(key,e.target.valueAsNumber)}/></div>;})}
 <label className="cinema-toggle"><span>Keep current width</span><input type="checkbox" checked={values.lockWidth} onChange={e=>glassesControls.set('lockWidth',e.target.checked)}/></label>
 <p className="cinema-hint">Width moves the intact left/right rims closer or farther apart. Middle gap fine-tunes their spacing. Both stop before the lenses overlap; neither squeezes the mesh. Lower distance = closer. Width lock holds size while changing distance. Only the lenses darken the room; the screen stays bright.</p>
 <button type="button" onClick={()=>glassesControls.reset()}>Reset glasses</button>
 </details>;
}
