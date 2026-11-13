import {BackSide,BoxGeometry,Color,ConeGeometry,CylinderGeometry,FrontSide,Group,Matrix4,Mesh,PerspectiveCamera,Scene,ShaderMaterial,Vector2,Vector3,WebGLRenderTarget,type BufferGeometry,type Side,type WebGLRenderer} from 'three';

/** A display's flat window: centre, inward normal and along-wall direction (world space). */
export type DisplayFrame={centre:Vector3;normal:Vector3;along:Vector3;width:number;height:number;bottom:number};

/** Placeholder films: white models with the opening's blue outline, drawn straight onto the lit
 *  wall (no screen, no backdrop). Display 0 (far) holds the rocket, display 1 (near) the car.
 *  Each waits at rest until the glasses are on, then plays its action: on the wall it is flat,
 *  rendered from the stop's eye; through the lenses the same world is seen in depth, and whatever
 *  leaves the wall continues into the corridor. It then reappears at rest and plays again. */
const BLUE=new Color('#268bff'),FLAME=new Color('#bfe3ff');
/** action: seconds of motion; back: reappearing at rest; wait: rest before playing again. */
const FILM={car:{action:3.3,back:1,wait:.9},rocket:{action:5.5,back:1.1,wait:1}} as const;
/** Model scale, so each reads clearly from the stop. */
const SIZE={car:1.8,rocket:1.7} as const;
const OUTLINE=.07;

const VERTEX=/* glsl */`varying vec3 vWorld;varying vec3 vNormalW;varying vec2 vUv;
void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vNormalW=normalize(mat3(modelMatrix)*normal);vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FRAGMENT=/* glsl */`uniform vec3 uWinC,uWinN,uWinR,uEye,uColour;uniform vec2 uWinHalf;uniform float uWinOpen,uDisplay;
varying vec3 vWorld;varying vec3 vNormalW;varying vec2 vUv;
void main(){
  // Behind the wall the world is only visible through the open window; in front, only once fully open.
  float side=dot(vWorld-uWinC,uWinN);
  if(side<0.){vec3 d=vWorld-uEye;float t=dot(uWinC-uEye,uWinN)/min(dot(d,uWinN),-1e-5);vec3 x=uEye+d*t-uWinC;
    if(abs(dot(x,uWinR))>uWinHalf.x||abs(x.y)>uWinHalf.y*uWinOpen)discard;}
  else if(uWinOpen<.98)discard;
  vec3 c;
  #if defined(FILL)
    float l=.5+.5*dot(normalize(vNormalW),normalize(vec3(.35,.85,.4)));c=mix(vec3(.5,.56,.66),vec3(1.),l);
  #else
    c=uColour;
  #endif
  c=clamp(c,0.,1.);
  if(uDisplay>.5)c=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));
  gl_FragColor=vec4(c,1.);
}`;

type Uniforms={uWinC:{value:Vector3};uWinN:{value:Vector3};uWinR:{value:Vector3};uEye:{value:Vector3};uWinHalf:{value:Vector2};uWinOpen:{value:number};uDisplay:{value:number}};

function createWorld(frame:DisplayFrame,eye:Vector3,shared:{value:number},owned:{dispose():void}[]){
  const right=new Vector3().crossVectors(new Vector3(0,1,0),frame.normal).normalize();
  const uniforms:Uniforms={uWinC:{value:frame.centre},uWinN:{value:frame.normal},uWinR:{value:right},uEye:{value:new Vector3().copy(eye)},
    uWinHalf:{value:new Vector2(frame.width/2,frame.height/2)},uWinOpen:{value:0},uDisplay:shared};
  const material=(kind:string,colour:Color=BLUE,side:Side=FrontSide)=>{
    const m=new ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,defines:kind?{[kind]:''}:{},side,toneMapped:false,
      uniforms:{...uniforms,uColour:{value:colour}}});
    owned.push(m);return m;
  };
  const fill=material('FILL'),hull=material('',BLUE,BackSide);
  /** One white part with a blue inverted-hull outline of constant thickness. */
  const part=(geometry:BufferGeometry,size:[number,number,number])=>{
    owned.push(geometry);
    const group=new Group(),body=new Mesh(geometry,fill),outline=new Mesh(geometry,hull);
    outline.scale.set(...size.map(s=>(s+OUTLINE*2)/s) as [number,number,number]);
    group.add(outline,body);return group;
  };
  // Local frame: x along the window (rendered right), y up, z out of the wall into the corridor.
  const root=new Group();root.matrixAutoUpdate=false;root.matrix.makeBasis(right,new Vector3(0,1,0),frame.normal).setPosition(frame.centre);root.matrixWorldNeedsUpdate=true;
  const local=new Vector3().subVectors(eye,frame.centre),e=new Vector3(local.dot(right),local.y,local.dot(frame.normal));
  // The stop sees each window obliquely, so its world is built along that line of sight: the stage faces the eye.
  const yaw=Math.atan2(e.x,e.z),stage=new Group();stage.rotation.y=yaw;root.add(stage);
  const ray=new Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  return {uniforms,root,stage,ray,part,material,eye:e,floor:-frame.centre.y,screenFloor:-frame.height/2,right};
}

function quadratic(a:Vector3,b:Vector3,c:Vector3,t:number,out:Vector3){
  const u=1-t;return out.set(a.x*u*u+b.x*2*u*t+c.x*t*t,a.y*u*u+b.y*2*u*t+c.y*t*t,a.z*u*u+b.z*2*u*t+c.z*t*t);
}
const smooth=(t:number)=>t*t*(3-2*t);

/** A film's cycle: moving while not resting, for [0,action); then reappearing at rest, then waiting. */
type Cycle={time:number;resting:boolean};
/** Pops back in at rest: a soft overshoot from nothing. */
const appear=(t:number)=>{const x=Math.min(1,Math.max(0,t))-1;return 1+2.2*x*x*x+1.2*x*x;};

function createCar(world:ReturnType<typeof createWorld>){
  const car=new Group(),wheels:Group[]=[];
  const body=world.part(new BoxGeometry(1.9,.55,4.2),[1.9,.55,4.2]);body.position.y=.62;
  const cabin=world.part(new BoxGeometry(1.55,.52,2.1),[1.55,.52,2.1]);cabin.position.set(0,1.15,-.25);
  car.add(body,cabin);
  for(const [x,z] of [[-.95,1.35],[.95,1.35],[-.95,-1.35],[.95,-1.35]]){
    const wheel=world.part(new CylinderGeometry(.38,.38,.3,20),[.76,.3,.76]);wheel.rotation.z=Math.PI/2;
    const axle=new Group();axle.position.set(x,.38,z);axle.add(wheel);car.add(axle);wheels.push(axle);
  }
  world.root.add(car);
  // Parked a little way into the wall, facing the viewer; it pulls away down the line of sight,
  // then leaps out of the wall at the glasses and just past them.
  const {eye,ray}=world,p=new Vector3(),q=new Vector3(),rest=ray.clone().multiplyScalar(4).setY(world.screenFloor),edge=new Vector3(0,world.screenFloor,0);
  const bend=new Vector3(eye.x*.45,world.screenFloor+1.9,eye.z*.45),past=new Vector3(eye.x*1.08,eye.y-1.1,eye.z-2.2);
  const drive=1.8;
  const at=(s:number,out:Vector3)=>{
    if(s<drive){const t=s/drive;return out.lerpVectors(rest,edge,t*t);}
    const u=Math.min(1,(s-drive)/(FILM.car.action-drive)),t=u*u*(1.6-.6*u);
    return quadratic(edge,bend,past,t,out);
  };
  const last=new Vector3();let travelled=0;
  return ({time,resting}:Cycle,idle:number)=>{
    if(resting){
      // At rest: engine idling with a faint bob; after each run it reappears with a small overshoot.
      const grow=time<FILM.car.action?1:appear((time-FILM.car.action)/FILM.car.back);
      at(0,p);at(.02,q);car.position.copy(p).setY(p.y+Math.abs(Math.sin(idle*9))*.025);q.sub(p);
      car.rotation.set(0,Math.atan2(q.x,q.z),0,'YXZ');car.scale.setScalar(Math.max(.001,grow)*SIZE.car);car.visible=grow>.001;
      travelled=0;last.copy(p);wheels.forEach(axle=>{axle.children[0].rotation.x=0;});return;
    }
    car.visible=true;car.scale.setScalar(SIZE.car);
    at(time,p);at(time+.02,q);
    car.position.copy(p);q.sub(p);
    car.rotation.set(-Math.atan2(q.y,Math.hypot(q.x,q.z))*.6,Math.atan2(q.x,q.z),0,'YXZ');
    travelled+=p.distanceTo(last);last.copy(p);
    wheels.forEach(axle=>{axle.children[0].rotation.x=travelled/.38;});
  };
}

function createRocket(world:ReturnType<typeof createWorld>,owned:{dispose():void}[]){
  const rocket=new Group(),spin=new Group();rocket.add(spin);
  const body=world.part(new CylinderGeometry(.45,.45,2.4,24),[.9,2.4,.9]);body.position.y=1.2;
  const nose=world.part(new ConeGeometry(.45,.95,24),[.9,.95,.9]);nose.position.y=2.875;
  spin.add(body,nose);
  for(let i=0;i<3;i++){
    const fin=world.part(new BoxGeometry(.08,.75,.62),[.08,.75,.62]),arm=new Group();
    fin.position.set(0,.36,.62);arm.rotation.y=i*Math.PI*2/3;arm.add(fin);spin.add(arm);
  }
  const flame=new Mesh(new ConeGeometry(.3,.9,16),world.material('',FLAME));owned.push(flame.geometry);flame.rotation.x=Math.PI;flame.position.y=-.45;spin.add(flame);
  world.root.add(rocket);
  const {eye,ray}=world,p=new Vector3(),q=new Vector3(),up=new Vector3(0,1,0),axis=new Vector3(),across=new Vector3(-ray.z,0,ray.x);
  const ignite=.7,climb=2.3,breakout=1.9,low=ray.clone().multiplyScalar(4).setY(world.screenFloor+.6),high=ray.clone().multiplyScalar(3).setY(-world.screenFloor-6);
  const top=high.clone().addScaledVector(across,Math.sin(climb*2.3)*.6),burst=new Vector3(eye.x*.22,-world.screenFloor+3,1.5),middle=new Vector3(eye.x*.45,12+world.floor,eye.z),gone=new Vector3(eye.x*.55,48+world.floor,eye.z+3);
  // Ignition on the pad, a wobbling climb inside the wall, then it breaks out over the corridor and away.
  const at=(s:number,out:Vector3)=>{
    const r=Math.max(0,s-ignite);
    if(r<climb){const t=r/climb;return out.lerpVectors(low,high,t*t).addScaledVector(across,Math.sin(r*2.3)*.6);}
    if(r<climb+breakout)return quadratic(top,burst,middle,smooth((r-climb)/breakout),out);
    const t=Math.min(1,(r-climb-breakout)/(FILM.rocket.action-ignite-climb-breakout));return out.lerpVectors(middle,gone,t*t);
  };
  return ({time,resting}:Cycle,idle:number)=>{
    if(resting){
      // Standing on its pad with a pilot flicker; after each flight it reappears with a small overshoot.
      const grow=time<FILM.rocket.action?1:appear((time-FILM.rocket.action)/FILM.rocket.back);
      rocket.position.copy(low);rocket.quaternion.identity();rocket.scale.setScalar(Math.max(.001,grow)*SIZE.rocket);rocket.visible=grow>.001;
      spin.rotation.set(0,idle*.4,0);flame.scale.set(.35,.18+.08*Math.abs(Math.sin(idle*23)),.35);return;
    }
    rocket.visible=true;rocket.scale.setScalar(SIZE.rocket);
    if(time<ignite){
      // Ignition: the flame swells and the rocket trembles on the pad.
      const k=time/ignite;rocket.position.copy(low).addScaledVector(across,Math.sin(time*60)*.05*k);rocket.quaternion.identity();
      spin.rotation.set(0,idle*.4,0);flame.scale.set(.35+.65*k,.25+.9*k+.3*Math.abs(Math.sin(time*31)),.35+.65*k);return;
    }
    at(time,p);at(time+.02,q);rocket.position.copy(p);
    // Point along the flight, with the malfunctioning tumble growing once it breaks free.
    // Lift-off stays upright; it only follows its own flight once moving.
    const r=time-ignite;axis.subVectors(q,p).normalize().lerp(up,Math.max(0,1-r/1.2)).normalize();rocket.quaternion.setFromUnitVectors(up,axis);
    const shake=.22+.5*smooth(Math.min(1,Math.max(0,(r-2.1)/1.2)));
    spin.rotation.set(Math.sin(r*7.1)*shake,idle*.4+r*(5+6*shake),Math.sin(r*5.3+1)*shake*.8);
    flame.scale.set(1,.75+.5*Math.abs(Math.sin(r*31)),1);
  };
}

/** Owns both films, their 2D display targets and the lens view. */
export function createDisplayContent(frames:DisplayFrame[],eye:Vector3){
  const owned:{dispose():void}[]=[],display={value:0},scene=new Scene();
  const worlds=frames.map(frame=>createWorld(frame,eye,display,owned));
  const animate=[createRocket(worlds[0],owned),createCar(worlds[1])],films=[FILM.rocket,FILM.car];
  worlds.forEach(world=>scene.add(world.root));
  const targets=frames.map(frame=>{const target=new WebGLRenderTarget(1024,Math.round(1024*frame.height/frame.width),{samples:4});owned.push(target);return target;});
  // Each film rests until the glasses are on; a run in progress always completes.
  const cycles:Cycle[]=[{time:0,resting:true},{time:0,resting:true}];let idle=0;
  const flip=frames.map((frame,k)=>frame.along.dot(worlds[k].right)<0);
  const camera=new PerspectiveCamera(),virtual=new PerspectiveCamera(),basis=new Matrix4(),forward=new Vector3(),offset=new Vector3(),clear=new Color(),black=new Color(0,0,0);
  const render=(gl:WebGLRenderer,view:PerspectiveCamera,target:WebGLRenderTarget,alpha:number)=>{
    const previous=gl.getRenderTarget(),auto=gl.autoClear,clearAlpha=gl.getClearAlpha();gl.getClearColor(clear);
    gl.setRenderTarget(target);gl.setClearColor(black,alpha);gl.autoClear=true;gl.render(scene,view);
    gl.setRenderTarget(previous);gl.autoClear=auto;gl.setClearColor(clear,clearAlpha);
  };
  return {
    flip,
    texture:(k:number)=>targets[k].texture,
    /** open: each display's opening 0..1 (its lit window height); active: the glasses are on.
     *  Returns true while anything moves. */
    update(open:readonly number[],seconds:number,reduce:boolean,active:boolean){
      let playing=false;const step=Math.min(.05,Math.max(0,seconds));idle+=reduce?0:step;
      worlds.forEach((world,k)=>{
        world.uniforms.uWinOpen.value=open[k];world.root.visible=open[k]>0;
        const cycle=cycles[k],film=films[k];
        if(open[k]<=0||reduce){cycle.time=0;cycle.resting=true;}
        else if(cycle.resting&&cycle.time===0)cycle.resting=!active;
        else{
          cycle.time+=step;
          if(cycle.time>=film.action)cycle.resting=true;
          if(cycle.time>=film.action+film.back+film.wait){cycle.time=0;cycle.resting=!active;}
        }
        if(open[k]>0){animate[k](cycle,idle);playing||=!reduce;}
      });
      scene.updateMatrixWorld();
      return playing;
    },
    /** Flat film for display k, seen from the stop's eye through its window. */
    renderDisplay(gl:WebGLRenderer,k:number){
      const frame=frames[k],world=worlds[k];if(!world.root.visible)return;
      basis.makeBasis(world.right,new Vector3(0,1,0),frame.normal);camera.position.copy(eye);camera.quaternion.setFromRotationMatrix(basis);camera.updateMatrixWorld(true);
      const d=offset.subVectors(eye,frame.centre).dot(frame.normal),near=.1,cx=-offset.dot(world.right),cy=frame.centre.y-eye.y,k2=near/d;
      camera.projectionMatrix.makePerspective((cx-frame.width/2)*k2,(cx+frame.width/2)*k2,(cy+frame.height/2)*k2,(cy-frame.height/2)*k2,near,300);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      worlds.forEach(w=>{w.uniforms.uEye.value.copy(eye);w.root.visible=w===world&&w.uniforms.uWinOpen.value>0;});
      display.value=0;render(gl,camera,targets[k],0);
      worlds.forEach(w=>{w.root.visible=w.uniforms.uWinOpen.value>0;});
    },
    /** Compile and draw both films once, privately, at an earlier stationary stop. */
    prepare(gl:WebGLRenderer){
      const saved=worlds.map(w=>w.uniforms.uWinOpen.value);
      worlds.forEach((w,k)=>{w.uniforms.uWinOpen.value=1;animate[k](cycles[k],idle);});
      scene.updateMatrixWorld();
      frames.forEach((_,k)=>this.renderDisplay(gl,k));
      worlds.forEach((w,k)=>{w.uniforms.uWinOpen.value=saved[k];w.root.visible=saved[k]>0;});
    },
    /** Depth view through the lenses: the real camera plus a small head offset, with the near window held still. */
    renderLens(gl:WebGLRenderer,view:PerspectiveCamera,target:WebGLRenderTarget,head:Vector2){
      virtual.copy(view);
      const right=new Vector3(1,0,0).applyQuaternion(view.quaternion),up=new Vector3(0,1,0).applyQuaternion(view.quaternion);
      virtual.position.addScaledVector(right,head.x).addScaledVector(up,head.y);virtual.updateMatrixWorld(true);
      view.getWorldDirection(forward);
      const distance=Math.max(1,forward.dot(offset.subVectors(frames[1].centre,view.position)));
      virtual.projectionMatrix.copy(view.projectionMatrix);
      const e=virtual.projectionMatrix.elements;e[8]-=head.x*e[0]/distance;e[9]-=head.y*e[5]/distance;
      virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
      worlds.forEach(w=>w.uniforms.uEye.value.copy(virtual.position));
      display.value=1;render(gl,virtual,target,0);
    },
    dispose(){owned.forEach(item=>item.dispose());scene.clear();},
  };
}
export type DisplayContent=ReturnType<typeof createDisplayContent>;
/** Shared with the glasses, which draw the lens view. */
export const corridorDisplayContent:{current:DisplayContent|null}={current:null};
