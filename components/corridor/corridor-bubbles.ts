import {IcosahedronGeometry,InstancedBufferAttribute,InstancedMesh,Matrix4,Quaternion,ShaderMaterial,Vector3,Euler} from 'three';
import {FILM_GLSL,type FilmUniforms} from './corridor-film-kit';

/** One bubble: window k, position across it (u, may run past its edge into the corridor), its depth
 *  multiple along the eye ray (m<1 floats in the corridor, m>1 lies behind the wall), apparent radius,
 *  rise speed, phase, and where an emerging bubble ends up (m drifts from `m` to `out` as it rises). */
type Bubble={k:number;u:number;m:number;out:number;radius:number;speed:number;phase:number;spin:Vector3};

const hash=(i:number,k:number)=>{const v=Math.sin(i*127.1+k*311.7)*43758.5453;return v-Math.floor(v);};
function layout(){
  const bubbles:Bubble[]=[];
  const add=(n:number,make:(h:(k:number)=>number)=>Omit<Bubble,'spin'|'phase'>)=>{for(let i=0;i<n;i++){const id=bubbles.length,h=(k:number)=>hash(id,k);bubbles.push({...make(h),phase:h(9),spin:new Vector3(h(10)-.5,h(11)-.5,h(12)-.5).multiplyScalar(.5)});}};
  // Deep behind both screens, small and slow.
  add(14,h=>{const k=h(1)<.45?0:1,m=1.35+h(2)*1.3;return {k,u:-.95+h(3)*1.9,m,out:m,radius:.35+h(4)*.75,speed:.018+h(5)*.02};});
  // Close behind the screens; a third of them drift out through the screen as they rise.
  add(9,h=>{const k=h(1)<.35?0:1,m=1.04+h(2)*.25;return {k,u:-.9+h(3)*1.8,m,out:h(6)<.45?.42+h(7)*.3:m,radius:.4+h(4)*.75,speed:.022+h(5)*.022};});
  // Already out: floating in the corridor, across the view and past the screen's edge.
  add(12,h=>{const m=.32+h(2)*.42;return {k:1,u:-.6+h(3)*3.2,m,out:m,radius:.45+h(4)*.9,speed:.016+h(5)*.016};});
  return bubbles;
}

/** Dark, liquid chrome-glass bubbles (after the pmndrs "bubbles" study): a slow surface wobble, mirror
 *  reflections of a cinema studio lit in the partners' colours, thin-film iridescence at the rim and a
 *  dim refracted core. They rise; in depth, some are already out in the corridor and others emerge. */
export function createBubbles(uniforms:FilmUniforms,detail:number,owned:{dispose():void}[]){
  const list=layout(),count=list.length;
  const geometry=new IcosahedronGeometry(1,detail);owned.push(geometry);
  const seed=new Float32Array(count);list.forEach((_,i)=>{seed[i]=hash(i,13)*40;});
  geometry.setAttribute('aSeed',new InstancedBufferAttribute(seed,1));
  const local={uBeam:{value:0},uBeamDir:{value:new Vector3(0,0,1)},uScreenDir:{value:new Vector3(0,0,1)},uImage:{value:0}};
  const material=new ShaderMaterial({uniforms:{...uniforms,...local},
    vertexShader:/* glsl */`attribute float aSeed;uniform float uTime;varying vec3 vFilmWorld;varying vec3 vNormalW;varying float vSeed;
      float wobble(vec3 p){float t=uTime*.5+aSeed;return .09*sin(p.x*2.1+t*1.3)*sin(p.y*2.4-t)+.07*sin(p.z*2.8+t*1.7+p.x)+.04*sin((p.x+p.y+p.z)*4.-t*2.2);}
      vec3 surface(vec3 p){vec3 n=normalize(p);return n*(1.+wobble(n));}
      void main(){vSeed=aSeed;vec3 p=surface(position);
        vec3 a=normalize(abs(normal.y)>.9?vec3(1.,0.,0.):cross(vec3(0.,1.,0.),normal)),b=cross(normal,a);
        vec3 n=normalize(cross(surface(position+a*.01)-p,surface(position+b*.01)-p));
        if(dot(n,normal)<0.)n=-n;
        mat3 basis=mat3(modelMatrix*instanceMatrix);
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);vFilmWorld=w.xyz;vNormalW=normalize(basis*n);
        gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:/* glsl */`${FILM_GLSL}uniform float uBeam,uImage;uniform vec3 uBeamDir,uScreenDir;varying vec3 vNormalW;varying float vSeed;
      // A dark cinema studio: one long overhead softbox, Barco red from the side, Galalite blue from below,
      // the lit screen itself as a broad coloured panel, and the projector's beam as a hot point.
      vec3 studio(vec3 r){
        vec3 c=vec3(.01,.012,.018)+vec3(.03,.035,.05)*(r.y*.5+.5);
        c+=vec3(1.)*smoothstep(.55,.9,r.y)*smoothstep(.9,.4,abs(r.x))*2.6;
        c+=vec3(1.,.08,.1)*pow(max(dot(r,normalize(vec3(-.85,.1,.45))),0.),6.)*3.2;
        c+=vec3(.08,.34,1.)*pow(max(dot(r,normalize(vec3(.3,-.9,.3))),0.),3.)*3.4;
        float panel=smoothstep(.55,.85,dot(r,uScreenDir));
        c+=mix(vec3(.12,.3,1.),vec3(1.,.3,.45),.5+.5*sin(r.x*5.+r.y*3.+uTime*.3))*panel*(.4+2.2*uImage);
        c+=vec3(1.,.97,.9)*pow(max(dot(r,uBeamDir),0.),40.)*uBeam*10.;
        return c;
      }
      void main(){if(!filmVisible(vFilmWorld))discard;
        vec3 N=normalize(vNormalW),V=normalize(uEye-vFilmWorld),R=reflect(-V,N);
        float facing=max(dot(N,V),0.),F=.18+.82*pow(1.-facing,3.);
        vec3 film=.55+.45*cos(6.2832*(vec3(0.,.33,.67)+(1.-facing)*1.6+vSeed*.07));
        vec3 c=studio(R)*mix(vec3(.6),film*1.3,.6*pow(1.-facing,1.5))*F;
        c+=studio(refract(-V,N,.7))*.05*facing;
        gl_FragColor=vec4(filmTone(c),1.);}`});
  owned.push(material);
  const mesh=new InstancedMesh(geometry,material,count);mesh.frustumCulled=false;
  const matrix=new Matrix4(),rotation=new Quaternion(),euler=new Euler(),scale=new Vector3(),low=new Vector3(),high=new Vector3(),position=new Vector3();
  return {
    mesh,
    /** point(k,u,v,m,out): the eye-ray point through window k at (u,v), m times the window's distance. */
    update(time:number,beam:number,beamDir:Vector3,screenDir:Vector3,image:number,still:boolean,point:(k:number,u:number,v:number,m:number,out:Vector3)=>Vector3){
      local.uBeam.value=beam;local.uBeamDir.value.copy(beamDir);local.uScreenDir.value.copy(screenDir);local.uImage.value=image;
      list.forEach((bubble,i)=>{
        const life=still?.5+.35*(bubble.phase-.5):(bubble.phase+time*bubble.speed)%1;
        const m=bubble.m+(bubble.out-bubble.m)*life*life*(3-2*life);
        point(bubble.k,bubble.u,-1.15,m,low);point(bubble.k,bubble.u,1.15,m,high);
        position.lerpVectors(low,high,life);position.x+=Math.sin(time*.3+bubble.phase*9)*.25*m;position.z+=Math.cos(time*.27+bubble.phase*7)*.25*m;
        const grow=Math.min(1,life*8,(1-life)*8);
        scale.setScalar(Math.max(.001,bubble.radius*m*grow));
        rotation.setFromEuler(euler.set(bubble.spin.x*time,bubble.spin.y*time+bubble.phase*6,bubble.spin.z*time));
        mesh.setMatrixAt(i,matrix.compose(position,rotation,scale));
      });
      mesh.instanceMatrix.needsUpdate=true;
    },
  };
}
