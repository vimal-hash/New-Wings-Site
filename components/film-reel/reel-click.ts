// The small projector click when a frame lands in the gate. Made with Web Audio, no sound file.
// Browsers only allow sound after the visitor has clicked, tapped or pressed a key somewhere on the site, so before that it stays silent.

let context:AudioContext|null=null,noise:AudioBuffer|null=null;

type Activation={userActivation?:{hasBeenActive:boolean}};
const allowed=()=>typeof window!=="undefined"&&"AudioContext" in window&&((navigator as Navigator&Activation).userActivation?.hasBeenActive??false);

function tick(at:number,band:number,level:number,length:number){
  if(!context||!noise)return;
  const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  source.buffer=noise;filter.type="bandpass";filter.frequency.value=band;filter.Q.value=1.4;
  gain.gain.setValueAtTime(level,at);gain.gain.exponentialRampToValueAtTime(.0001,at+length);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(at,Math.random()*.2,length+.01);
}

/** A claw engaging and the gate closing on the film: two dry ticks a few milliseconds apart, over a soft knock. Never twice the same. */
export function reelClick(){
  if(!allowed())return;
  try{
    if(!context){
      context=new AudioContext();
      noise=context.createBuffer(1,Math.floor(context.sampleRate*.3),context.sampleRate);
      const data=noise.getChannelData(0);for(let index=0;index<data.length;index++)data[index]=Math.random()*2-1;
    }
    if(context.state==="suspended")void context.resume();
    const at=context.currentTime+.005,vary=()=>.85+Math.random()*.3;
    tick(at,2300*vary(),.2*vary(),.022);
    tick(at+.016+Math.random()*.006,3400*vary(),.09*vary(),.016);
    const knock=context.createOscillator(),level=context.createGain();
    knock.type="sine";knock.frequency.setValueAtTime(140*vary(),at);knock.frequency.exponentialRampToValueAtTime(62,at+.05);
    level.gain.setValueAtTime(.1*vary(),at);level.gain.exponentialRampToValueAtTime(.0001,at+.07);
    knock.connect(level).connect(context.destination);knock.start(at);knock.stop(at+.08);
  }catch{/* sound is a nicety; a browser that refuses it loses nothing else */}
}
