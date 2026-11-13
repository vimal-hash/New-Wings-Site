import { Matrix4, Quaternion, Vector3 } from "three";

type Slide = { base: number[]; end: number[]; height: number };
const smooth = (t: number) => t*t*t*(t*(t*6-15)+10);
export const LOGO_REVEAL_SECONDS = 5.8;
export const LOGO_SLIDE_SPLIT = 7 / 15;
export const LOGO_FOV = 40;
/** View 1 reserves roughly four fifths of the shot for the upper field. */
export const VIEW_ONE_PITCH=.36;
export const VIEW_ONE_PROGRESS=.985;
const slideAngle=(u:number)=>(6*u**3-8*u**4+3*u**5)*Math.PI/2;

/** Authored slide followed by a C2-continuous pullback; no camera cut at the lip. */
export function createLogoReveal(bounds: number[][], slide: Slide, eyeHeight: number, aspect: number, start: Vector3, initialRotation: Quaternion) {
  const centre = new Vector3((bounds[0][0]+bounds[0][1])/2,(bounds[2][0]+bounds[2][1])/2,-(bounds[1][0]+bounds[1][1])/2);
  const width=bounds[0][1]-bounds[0][0],height=bounds[1][1]-bounds[1][0],depth=bounds[2][1]-bounds[2][0];
  let distance=Math.max(width/Math.max(.1,aspect),height)*.5/Math.tan(LOGO_FOV*Math.PI/360)*1.16+depth*.5;
  // Face the logo plane directly: remove parallax that pinches the three ribbon gaps.
  const viewingOffset=new Vector3(0,1,0).normalize();
  const finalPosition=centre.clone().addScaledVector(viewingOffset,distance);
  const up=new Vector3(0,1,0), finalUp=new Vector3(-Math.sin(Math.PI/18),0,-Math.cos(Math.PI/18));
  const base=new Vector3(slide.base[0],0,-slide.base[1]);
  const forward=new Vector3(slide.end[0]-slide.base[0],0,-slide.end[1]+slide.base[1]).normalize();
  const radius=slide.height-eyeHeight, split=LOGO_SLIDE_SPLIT;
  const viewOneAngle=slideAngle(VIEW_ONE_PROGRESS);
  const exit=base.clone().addScaledVector(forward,radius).addScaledVector(up,slide.height);
  const matrix=new Matrix4();
  const finalRotation=new Quaternion().setFromRotationMatrix(matrix.lookAt(finalPosition,centre,finalUp));
  const screenRight=new Vector3(1,0,0).applyQuaternion(finalRotation),screenUp=new Vector3(0,1,0).applyQuaternion(finalRotation),corner=new Vector3();
  const tangentFov=Math.tan(LOGO_FOV*Math.PI/360);
  for(const x of bounds[0])for(const y of bounds[1])for(const z of bounds[2]) {
    corner.set(x,z,-y).sub(centre);
    distance=Math.max(distance,corner.dot(viewingOffset)+Math.max(Math.abs(corner.dot(screenRight))/(tangentFov*Math.max(.1,aspect)*.88),Math.abs(corner.dot(screenUp))/(tangentFov*.88)));
  }
  // Another twenty-five percent farther than the previous 2.352 framing distance.
  distance *= 2.94;
  finalPosition.copy(centre).addScaledVector(viewingOffset,distance);
  const right=new Vector3(1,0,0).applyQuaternion(initialRotation).normalize();
  const pitch=new Quaternion();
  // Finish the ramp looking toward the logo, rather than into empty sky.
  const endRotation=new Quaternion().setFromRotationMatrix(matrix.lookAt(exit,centre,up));
  const exteriorSeconds=LOGO_REVEAL_SECONDS*(1-split),angularSpeed=Math.PI/2/(LOGO_REVEAL_SECONDS*split);
  const velocity=up.clone().multiplyScalar(radius*angularSpeed*exteriorSeconds);
  const acceleration=forward.clone().multiplyScalar(-radius*angularSpeed*angularSpeed*exteriorSeconds*exteriorSeconds);
  const displacement=finalPosition.clone().sub(exit);
  const trackingRotation=new Quaternion(),turnRotation=new Quaternion();
  return {
    centre, finalPosition, finalRotation, far:Math.max(1200,distance+depth+200),
    viewOneDistance:radius*viewOneAngle,
    /** Convert arc-length pacing back to the authored slide/lens progress. */
    progressToViewOne(share:number){
      if(share<=0)return 0;
      if(share>=1)return VIEW_ONE_PROGRESS;
      let low=0,high=VIEW_ONE_PROGRESS;
      const target=share*viewOneAngle;
      for(let i=0;i<20;i++){
        const middle=(low+high)/2;
        if(slideAngle(middle)<target)low=middle;else high=middle;
      }
      return (low+high)/2;
    },
    sample(progress:number,position:Vector3,rotation:Quaternion) {
      const t=Math.max(0,Math.min(1,progress));
      if(t<=split) {
        const u=t/split,theta=slideAngle(u);
        position.copy(base).addScaledVector(forward,radius*Math.sin(theta)).addScaledVector(up,slide.height-radius*Math.cos(theta));
        rotation.slerpQuaternions(initialRotation,endRotation,smooth(u));
        // A small mid-ramp lift, with zero angular velocity at both joins.
        pitch.setFromAxisAngle(right,.06*Math.sin(Math.PI*u)**2);rotation.premultiply(pitch);
        if(t===0){position.copy(start);rotation.copy(initialRotation);}
      } else {
        const u=(t-split)/(1-split),u2=u*u,u3=u2*u,u4=u3*u,u5=u4*u;
        const velocityWeight=u-6*u3+8*u4-3*u5,accelerationWeight=.5*u2-1.5*u3+1.5*u4-.5*u5;
        // Delay the large exterior distance until clear of the lip; preserve C2 joins.
        const pullback=Math.expm1(2.4*u)/Math.expm1(2.4);
        position.copy(exit).addScaledVector(displacement,smooth(pullback)).addScaledVector(velocity,velocityWeight).addScaledVector(acceleration,accelerationWeight);

        trackingRotation.setFromRotationMatrix(matrix.lookAt(position,centre,finalUp));
        rotation.slerpQuaternions(endRotation,trackingRotation,smooth(Math.min(1,u/.35)));
      }
    },
    sampleSlide(progress:number,position:Vector3,rotation:Quaternion){
      this.sample(progress*split,position,rotation);
      // Hold the corridor heading until the camera reaches the actual slide lip.
      pitch.setFromAxisAngle(right,VIEW_ONE_PITCH*smooth(progress));rotation.copy(pitch).multiply(initialRotation);
    },
    sampleTurn(progress:number,position:Vector3,rotation:Quaternion){
      // Begin moving along the audited exterior path while turning, rather than pivoting in place.
      this.sample(split+(1-split)*.12*smooth(progress),position,turnRotation);
      pitch.setFromAxisAngle(right,VIEW_ONE_PITCH).multiply(initialRotation);
      rotation.slerpQuaternions(pitch,turnRotation,smooth(progress));
    },
    samplePullback(progress:number,position:Vector3,rotation:Quaternion){
      this.sample(split+(1-split)*(.12+.88*smooth(progress)),position,rotation);
    },
  };
}







