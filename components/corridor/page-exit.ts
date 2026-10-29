/** The third section is fully in view at the native scroll bottom. No extra gesture or timer. */
export function pageAtBottom(scrollTop:number,scrollHeight:number,clientHeight:number){
  return clientHeight>0&&scrollHeight>clientHeight+2&&scrollHeight-clientHeight-scrollTop<=2;
}
