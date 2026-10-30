"use client";
import {useState,useSyncExternalStore} from 'react';
import {lensControls,LENS_LABELS,LENS_RANGES,type LensTarget,type LensNumber} from './lens-controls';

const labels:Record<LensNumber,string>={fov:'FOV (degrees)',squeeze:'Lens squeeze',parallax:'Mouse parallax',sway:'Idle sway',response:'Smoothing (sec)',roll:'Movement roll',depth:'Layer depth'};
export default function LensPanel({covered}:{covered:boolean}){
  const state=useSyncExternalStore(lensControls.subscribe,lensControls.read,lensControls.serverRead);
  const [editing,setEditing]=useState<'auto'|LensTarget>('auto');
  const target=editing==='auto'?(covered?'brand':'view1'):editing,values=state.presets[target];
  const number=(key:LensNumber)=>{const[min,max,step]=LENS_RANGES[key];return <div className="cinema-slider" key={key}>
    <label htmlFor={'lens-'+key}>{labels[key]}</label>
    <input id={'lens-'+key} aria-label={labels[key]} type="range" min={min} max={max} step={step} value={values[key]} onChange={e=>lensControls.set(target,key,Number(e.target.value))}/>
    <input aria-label={labels[key]+' value'} type="number" min={min} max={max} step={step} value={values[key]} onChange={e=>{if(e.target.value!=='')lensControls.set(target,key,e.target.valueAsNumber);}}/>
  </div>;};
  return <details open><summary>Camera &amp; lens · {LENS_LABELS[target]}</summary>
    <label className="cinema-select">Camera editing <select aria-label="Camera editing" value={editing} onChange={e=>setEditing(e.target.value as 'auto'|LensTarget)}><option value="auto">Follow section</option><option value="view1">View 1</option><option value="brand">White brand section</option></select></label>
    <label className="cinema-toggle"><span>Camera effects</span><input type="checkbox" checked={values.enabled} onChange={e=>lensControls.set(target,'enabled',e.target.checked)}/></label>
    <fieldset disabled={!values.enabled}>{number('fov')}{number('squeeze')}
      <label className="cinema-toggle"><span>Living camera</span><input type="checkbox" checked={values.living} onChange={e=>lensControls.set(target,'living',e.target.checked)}/></label>
      <fieldset disabled={!values.living}>{number('parallax')}{number('sway')}{number('response')}{number('roll')}</fieldset>
      {target==='brand'&&number('depth')}
    </fieldset>
    <p className="cinema-hint">{target==='brand'?'Default: 40° / 1×. Perspective is applied to the existing flat artwork.':'Default: 65° / 1.05×. Blends in during the approach and out before View 2.'} Above 1 compresses width. Mouse motion and sway pause on touch devices and with reduced motion.</p>
    <button type="button" onClick={()=>{window.dispatchEvent(new CustomEvent('eye-camera-view',{detail:target==='view1'?'slide':'final'}));if(target==='brand')window.dispatchEvent(new CustomEvent('eye-diagonal-preview',{detail:1}));}}>Go to {LENS_LABELS[target]}</button>{' '}
    <button type="button" onClick={()=>lensControls.reset(target)}>Reset camera</button>
  </details>;
}
