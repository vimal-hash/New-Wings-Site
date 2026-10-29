/** Keep visible travel spread across the shot; avoid a long, almost-stationary ease-out tail. */
export function openingElapsed(elapsed:number,delta:number,hold:number,prepared:boolean,wasPrepared:boolean){
  // Time spent in a blocking first GPU submission must never become camera travel.
  return prepared?(wasPrepared?elapsed+delta:Math.min(elapsed,hold)):Math.min(elapsed+delta,hold);
}
export function openingMotion(elapsed:number,hold:number,duration:number,reduce=false,prepared=true){
  const progress=!prepared?0:reduce?1:Math.max(0,Math.min(1,(elapsed-hold)/duration));
  return {progress,position:progress*progress*(3-2*progress),done:progress===1};
}
