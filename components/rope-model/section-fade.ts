/** Finite critically damped follow for a section's white reveal, separate from raw wheel steps. */
export function createSectionFade(initial:number){
  let value=initial,speed=0;
  return {
    get value(){return value;},
    snap(at:number){value=at;speed=0;},
    move(target:number,delta:number){
      const dt=Math.min(delta,.05),pull=2/.18,x=pull*dt,decay=1/(1+x+.48*x*x+.235*x*x*x),gap=value-target,push=(speed+pull*gap)*dt;
      speed=(speed-pull*push)*decay;value=target+(gap+push)*decay;
      if(Math.abs(value-target)<.0001&&Math.abs(speed)<.001){value=target;speed=0;}
      return value!==target||speed!==0;
    },
  };
}
