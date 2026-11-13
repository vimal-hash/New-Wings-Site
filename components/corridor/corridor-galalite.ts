import {BoxGeometry,Color,DoubleSide,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh,PlaneGeometry,Quaternion,ShaderMaterial,Vector2,Vector3} from 'three';
import {FILM_GLSL,premultiplied,type FilmUniforms} from './corridor-film-kit';

/** The sheet's motion (local x/y in units). */
const WAVE_GLSL=/* glsl */`
uniform vec2 uSize;uniform float uWave;
float sheet(vec2 p,float t){
  float hold=.35+.65*smoothstep(-uSize.y*.5,uSize.y*.5,p.y);
  float w=.5*sin(p.x*.5-t*1.25+sin(p.y*.38+t*.5))+.3*sin(p.x*1.25+p.y*.75-t*2.05)+.2*sin(p.y*1.6-t*1.6+p.x*.3);
  return uWave*w*hold-p.x*p.x*.012;
}`;

/** New Wings colours: red, blue and amber, used for the projected picture and the light rods. */
const PALETTE=['#ff2d3b','#1f6bff','#ffb21f','#ff4fa3','#21d4ff','#7a3dff','#3dff9e'].map(c=>new Color(c));

/** A Galalite-style cinema screen: a perforated silver-white sheet that ripples, lit deep blue from below.
 *  When the projector's light lands, a colour picture floods out from the hit point; then PRISM-style
 *  light rods leave the picture and fly out past the viewer. */
export function createGalaliteScreen(uniforms:FilmUniforms,size:Vector2,owned:{dispose():void}[]){
  const keep=<T extends {dispose():void}>(item:T)=>{owned.push(item);return item;};
  const local={uSize:{value:size},uWave:{value:.32},uImage:{value:0},uHit:{value:new Vector2(.5,.5)},uBlue:{value:1},uUnder:{value:new Vector3()},uKey:{value:new Vector3()}};
  const material=keep(new ShaderMaterial({side:DoubleSide,uniforms:{...uniforms,...local},
    vertexShader:/* glsl */`${WAVE_GLSL}uniform float uTime;varying vec2 vUv;varying vec3 vFilmWorld;varying vec3 vNormalW;
      void main(){vUv=uv;vec2 p=position.xy;float e=.05;
        float z=sheet(p,uTime),zx=sheet(p+vec2(e,0.),uTime),zy=sheet(p+vec2(0.,e),uTime);
        vec3 n=normalize(vec3(-(zx-z)/e,-(zy-z)/e,1.));
        vec4 w=modelMatrix*vec4(p,z,1.);vFilmWorld=w.xyz;vNormalW=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:/* glsl */`${FILM_GLSL}uniform vec2 uSize,uHit;uniform float uImage,uBlue;uniform vec3 uUnder,uKey;varying vec2 vUv;varying vec3 vNormalW;
      // The projected picture: a slow cinematic aurora in New Wings' colours, deep navy to blue,
      // magenta, red and a warm amber core, under a soft vignette.
      vec3 picture(vec2 uv,float t){
        vec2 q=(uv-.5)*vec2(uSize.x/uSize.y,1.);
        float n=sin(q.x*1.35+t*.32+sin(q.y*2.1-t*.21)*1.3)*.6+sin(q.y*2.4-q.x*.8-t*.27)*.4+.35*sin(length(q-vec2(.6,.1))*4.-t*.6);
        float k=clamp(n*.55+.5,0.,1.);
        vec3 c=mix(vec3(.01,.03,.16),vec3(.06,.32,1.),smoothstep(0.,.35,k));
        c=mix(c,vec3(.85,.08,.42),smoothstep(.35,.62,k));
        c=mix(c,vec3(1.,.16,.1),smoothstep(.55,.78,k));
        c=mix(c,vec3(1.,.66,.18),smoothstep(.76,1.,k));
        return c*(.35+.9*smoothstep(.85,.05,length(q*vec2(.7,1.2))));
      }
      void main(){if(!filmVisible(vFilmWorld))discard;
        vec3 N=normalize(vNormalW);if(!gl_FrontFacing)N=-N;
        vec3 V=normalize(uEye-vFilmWorld);
        // Perforation: a fine staggered grid of holes, averaged out where it would shimmer.
        vec2 g=vUv*uSize*3.2;g.x+=mod(floor(g.y),2.)*.5;vec2 f=fract(g)-.5;float r=length(f),aa=fwidth(r)*1.3;
        float hole=1.-smoothstep(.2-aa,.2+aa,r);hole=mix(hole,.126,smoothstep(.12,.45,fwidth(g.x)));
        float under=max(dot(N,uUnder),0.)*exp(-vUv.y*2.3);
        vec3 c=vec3(.025,.03,.04)+vec3(.12,.42,1.)*under*1.9*uBlue+vec3(.05,.12,.4)*uBlue*.12;
        float key=max(dot(N,uKey),0.);c+=vec3(.5,.52,.56)*key*.12;
        c+=vec3(.75,.8,.9)*pow(max(dot(reflect(-V,N),uKey),0.),28.)*.45;
        float flood=smoothstep(0.,.18,uImage*1.45-length((vUv-uHit)*vec2(uSize.x/uSize.y,1.))*.55);
        c+=picture(vUv,uTime)*flood*1.25*(.6+.4*max(dot(N,V),0.));
        c*=1.-hole*.82;
        float edge=min(min(vUv.x,1.-vUv.x)*uSize.x,min(vUv.y,1.-vUv.y)*uSize.y);
        c*=smoothstep(0.,.12,edge);
        gl_FragColor=vec4(filmTone(c),1.);}`}));
  const geometry=keep(new PlaneGeometry(size.x,size.y,220,96));
  const screen=new Mesh(geometry,material);screen.frustumCulled=false;
  const root=new Group();root.add(screen);

  const m=new Matrix4(),q=new Quaternion(),s=new Vector3(),p=new Vector3();

  // Light streaks: leave the picture and fly towards (and just past) the viewer.
  const streakCount=46,streakGeometry=keep(new BoxGeometry(1,1,1).translate(0,0,-.5));
  const streakHue=new Float32Array(streakCount*3);for(let i=0;i<streakCount;i++)PALETTE[i%PALETTE.length].toArray(streakHue,i*3);
  streakGeometry.setAttribute('aHue',new InstancedBufferAttribute(streakHue,3));
  const streakMaterial=keep(premultiplied(new ShaderMaterial({uniforms:{...uniforms},
    vertexShader:/* glsl */`attribute vec3 aHue;varying vec3 vHue;varying float vAlong;varying vec3 vFilmWorld;varying vec2 vSide;
      void main(){vHue=aHue;vAlong=-position.z;vSide=position.xy*2.;vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vFilmWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:/* glsl */`${FILM_GLSL}varying vec3 vHue;varying float vAlong;varying vec2 vSide;
      void main(){if(!filmVisible(vFilmWorld))discard;
        float a=pow(1.-vAlong,2.2);
        vec3 c=mix(vHue*1.6,vec3(2.2),pow(1.-vAlong,12.));
        gl_FragColor=vec4(filmTone(c)*a,a);}`})));
  const streaks=new InstancedMesh(streakGeometry,streakMaterial,streakCount);streaks.frustumCulled=false;
  const seeds=Array.from({length:streakCount},(_,i)=>{const h=(k:number)=>{const v=Math.sin(i*127.1+k*311.7)*43758.5453;return v-Math.floor(v);};return {u:h(1),v:h(2),side:h(3),lift:h(4),offset:h(5),speed:.75+.5*h(6)};});
  const from=new Vector3(),to=new Vector3(),dir=new Vector3(),forward=new Vector3(0,0,1),right=new Vector3(),up=new Vector3();

  return {
    root,streaks,
    /** World light directions for the under-light and the key (call after placing the screen). */
    light(under:Vector3,key:Vector3){local.uUnder.value.copy(under);local.uKey.value.copy(key);},
    /** image: picture flood 0..1; streak: light-rod density 0..1; t: show seconds. */
    update(time:number,image:number,streak:number,t:number,eye:Vector3,still:boolean){
      local.uImage.value=image;local.uWave.value=still?0:.32;
      streaks.visible=streak>.001&&!still;
      if(streaks.visible){
        root.updateWorldMatrix(true,false);
        right.set(1,0,0).transformDirection(root.matrixWorld);up.set(0,1,0);
        for(let i=0;i<streakCount;i++){
          const seed=seeds[i],life=(t*seed.speed*.34+seed.offset)%1,active=i/streakCount<streak;
          from.set((seed.u-.5)*size.x*.9,(seed.v-.5)*size.y*.85,.2).applyMatrix4(root.matrixWorld);
          const angle=seed.side*Math.PI*2,reach=2.2+seed.lift*5;
          to.copy(eye).addScaledVector(right,Math.cos(angle)*reach).addScaledVector(up,Math.sin(angle)*reach*.6-.4);
          const k=Math.pow(life,2.4),length=(.3+9*k)*(active?1:0),thick=.012+.03*k;
          p.lerpVectors(from,to,Math.min(1.04,k*1.06));
          dir.subVectors(to,from).normalize();q.setFromUnitVectors(forward,dir);
          s.set(thick,thick,Math.max(.001,length*Math.min(1,life*6)*(1-Math.max(0,(life-.94)/.06))));
          streaks.setMatrixAt(i,m.compose(p,q,s));
        }
        streaks.instanceMatrix.needsUpdate=true;
      }
    },
  };
}
