/** One owner-name policy shared by solid geometry, shadows, hover IDs and formation grains. */
export function keepProjectorPart(name:string){
  if(/^LENS_|^LPIPE_/.test(name))return true;
  if(/^(HARN|HOSE)_|^LP_DMD_flex_ribbon_|^CTRL_Air_filter_sensor_pressure_tube_/.test(name))return false;
  if(/^COOL_Cooler_(left|right)_fan_2$|^COOL_LP_cooling_fan_[2-6]$|^CTRL_Card_cage_fan_2$/.test(name))return false;
  if(/^FILT_(Cooler_filter_right_washable|Light_processor_filter_pleated)$/.test(name))return false;
  // Retain one screw on each cold plate and laser bank assembly. Only omit
  // the repeated internal fasteners, which measure less than 23 mm across.
  if(/^LS_Cold_plate_(BLUE|GREEN|RED)_\d+_clamp_screw_[2-4]$/.test(name))return false;
  if(/^LS_Plate_(BLUE|GREEN|RED)_\d+_bank_(1_screw_2|[23]_screw_[12])$/.test(name))return false;
  return true;
}
export const blackProjectorHousing=(name:string)=>/^(SH|CH)_/.test(name);
export function orangeProjectorMaterial(colour:number[]){
  const [r,g,b]=colour;return r>.15&&r>g*1.4&&r>b*2;
}
