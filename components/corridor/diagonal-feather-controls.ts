export const DIAGONAL_FEATHER_DEFAULT=64;
const key='eye-diagonal-feather-v1';
const clean=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(240,value)):DIAGONAL_FEATHER_DEFAULT;
export function createDiagonalFeatherControls(){
  let value=DIAGONAL_FEATHER_DEFAULT;const listeners=new Set<()=>void>();
  const set=(next:number)=>{next=clean(next);if(next===value)return;value=next;listeners.forEach(fn=>fn());};
  return {
    read:()=>value,serverRead:()=>DIAGONAL_FEATHER_DEFAULT,set,
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    load(storage:Pick<Storage,'getItem'>){try{const saved=storage.getItem(key);if(saved!==null)set(Number(saved));}catch{/* Keep the placeholder if storage is unavailable. */}},
    save(storage:Pick<Storage,'setItem'>){try{storage.setItem(key,String(value));return true;}catch{return false;}},
  };
}
export const diagonalFeatherControls=createDiagonalFeatherControls();
