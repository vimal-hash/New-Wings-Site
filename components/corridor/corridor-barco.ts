import {type Material,BoxGeometry,CircleGeometry,Color,CylinderGeometry,DoubleSide,Group,InstancedMesh,LatheGeometry,Matrix4,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,PlaneGeometry,PointLight,ShaderMaterial,SphereGeometry,TorusGeometry,Vector2,Vector3,type BufferGeometry,type Texture} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {additive,FILM_GLSL,filmMaterial,type FilmUniforms} from './corridor-film-kit';
import {textTexture} from './corridor-film-text';

const RED=new Color('#c8141b');

/** A cinema laser projector in the spirit of Barco's Series 4: a black body with red feet and accents, side
 *  vents and one large lens, modelled procedurally. Local axes: x width, y up, +z the lens direction. */
export function createBarcoProjector(uniforms:FilmUniforms,environment:Texture|null,owned:{dispose():void}[]){
  const keep=<T extends {dispose():void}>(item:T)=>{owned.push(item);return item;};
  const geo=<T extends BufferGeometry>(g:T)=>keep(g);
  const physical=(key:string,parameters:ConstructorParameters<typeof MeshPhysicalMaterial>[0])=>keep(filmMaterial(new MeshPhysicalMaterial({envMap:environment,...parameters}),uniforms,key));
  // Satin black shell under a studio softbox, gloss-black front, machined lens, Barco-red accents.
  const shell=physical('barco-shell',{color:'#17191d',roughness:.42,metalness:.55,clearcoat:.7,clearcoatRoughness:.28,envMapIntensity:1.5});
  const lid=physical('barco-lid',{color:'#202227',roughness:.6,metalness:.4,envMapIntensity:1.3});
  const gloss=physical('barco-gloss',{color:'#07080a',roughness:.08,metalness:.3,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:2});
  const slot=physical('barco-slot',{color:'#030304',roughness:.85,metalness:0,envMapIntensity:.3});
  const barrel=physical('barco-barrel',{color:'#1a1b1f',roughness:.24,metalness:.85,envMapIntensity:1.8});
  const grip=physical('barco-grip',{color:'#3a3c42',roughness:.4,metalness:.7,envMapIntensity:1.6});
  const red=physical('barco-red',{color:RED,roughness:.25,metalness:.1,clearcoat:1,clearcoatRoughness:.08,emissive:'#5a0306',envMapIntensity:1.4});
  const led=physical('barco-led',{color:'#ff1f2a',emissive:'#ff1622',emissiveIntensity:3,roughness:.3});
  const glass=physical('barco-glass',{color:'#020408',roughness:.02,metalness:.15,clearcoat:1,clearcoatRoughness:.01,iridescence:1,iridescenceIOR:1.9,iridescenceThicknessRange:[260,640],envMapIntensity:3});

  const model=new Group();
  const add=(geometry:BufferGeometry,material:Material,x=0,y=0,z=0)=>{const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);model.add(mesh);return mesh;};
  add(geo(new RoundedBoxGeometry(3,1.3,4.2,5,.12)),shell);
  add(geo(new RoundedBoxGeometry(2.66,.08,3.5,3,.035)),lid,0,.655,-.2);
  add(geo(new RoundedBoxGeometry(2.84,1.12,.06,3,.025)),gloss,0,.02,2.09);
  // Rows of vents on both sides, and a fan grille on the back.
  const vent=new InstancedMesh(geo(new BoxGeometry(.03,.05,.24)),slot,2*7*9),matrix=new Matrix4();let n=0;
  for(const side of [-1,1])for(let row=0;row<7;row++)for(let col=0;col<9;col++)vent.setMatrixAt(n++,matrix.makeTranslation(side*1.5,-.36+row*.115,-1.55+col*.3));
  model.add(vent);
  add(geo(new CircleGeometry(.48,48)),slot,-.7,0,-2.11).rotation.y=Math.PI;
  // Red feet, and a fine red line along the base.
  for(const x of [-1.18,1.18])for(const z of [-1.62,1.62])add(geo(new CylinderGeometry(.17,.2,.18,28)),red,x,-.74,z);
  add(geo(new BoxGeometry(3.02,.045,.045)),red,0,-.6,2.1);
  for(const x of [-1.512,1.512])add(geo(new BoxGeometry(.02,.045,3.9)),red,x,-.58,0);
  // A lit red line across the top of the front panel.
  add(geo(new BoxGeometry(2.5,.025,.02)),led,0,.5,2.13);

  // The lens: red mount ring, stepped barrel, knurled focus ring and a coated front element.
  const lens=new Group();lens.position.set(.62,-.02,2.1);model.add(lens);
  const ring=new Mesh(geo(new CylinderGeometry(.68,.68,.09,64)),red);ring.rotation.x=Math.PI/2;ring.position.z=.04;lens.add(ring);
  const profile=[[.62,0],[.62,.12],[.55,.17],[.55,.56],[.6,.6],[.6,.96],[.55,1],[.55,1.24],[.5,1.27],[.47,1.29]].map(([r,z])=>new Vector2(r,z));
  const body=new Mesh(geo(new LatheGeometry(profile,96)),barrel);body.rotation.x=Math.PI/2;lens.add(body);
  for(let i=0;i<9;i++){const knurl=new Mesh(geo(new TorusGeometry(.6,.014,8,96)),grip);knurl.position.z=.63+i*.038;lens.add(knurl);}
  const cap=Math.asin(.47/.9),element=new Mesh(geo(new SphereGeometry(.9,64,24,0,Math.PI*2,0,cap)),glass);
  element.rotation.x=Math.PI/2;element.position.z=1.29-.9*Math.cos(cap);lens.add(element);
  // Light leaving the lens: a white core inside a slowly turning red/green/blue ring.
  const glowMaterial=keep(additive(new ShaderMaterial({uniforms:{...uniforms,uPower:{value:0}},side:DoubleSide,
    vertexShader:`varying vec2 vUv;varying vec3 vFilmWorld;void main(){vUv=uv*2.-1.;vec4 w=modelMatrix*vec4(position,1.);vFilmWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`${FILM_GLSL}uniform float uPower;varying vec2 vUv;
      void main(){if(!filmVisible(vFilmWorld))discard;
        float r=length(vUv),a=atan(vUv.y,vUv.x)+uTime*.6;
        vec3 rgb=.5+.5*cos(a*1.+vec3(0.,2.094,4.189));
        vec3 c=vec3(1.,.97,.92)*exp(-r*r*40.)*3.+rgb*exp(-pow((r-.36)/.06,2.))*.9+vec3(.6,.75,1.)*exp(-r*5.)*.25;
        gl_FragColor=vec4(filmTone(c*uPower*(1.-smoothstep(.85,1.,r))),0.);}`})));
  const glow=new Mesh(geo(new PlaneGeometry(1.4,1.4)),glowMaterial);glow.position.z=1.42;lens.add(glow);

  // Status lights and the name on the side panels and the front.
  const status=keep(filmMaterial(new MeshBasicMaterial({color:'#ff2a2a'}),uniforms,'barco-status'));
  for(let i=0;i<3;i++)add(geo(new SphereGeometry(.025,12,8)),status,-.75-i*.12,.42,2.12);
  const name=textTexture('BARCO',{weight:700,spacing:.32,colour:'#f4f4f2'});keep(name.texture);
  const label=keep(filmMaterial(new MeshBasicMaterial({map:name.texture,transparent:true,depthWrite:false,color:new Color(1.35,1.35,1.35)}),uniforms,'barco-label'));
  const plate=geo(new PlaneGeometry(1,1/name.aspect));
  for(const side of [-1,1]){const text=new Mesh(plate,label);text.scale.setScalar(1.25);text.position.set(side*1.507,.34,.95);text.rotation.y=side*Math.PI/2;model.add(text);}
  const front=new Mesh(plate,label);front.scale.setScalar(.62);front.position.set(-.78,.2,2.125);model.add(front);

  const light=new PointLight('#fff3e8',0,40,1.6);light.position.set(.62,0,3.6);model.add(light);
  model.traverse(object=>{object.frustumCulled=false;});
  const root=new Group();root.add(model);
  const lensLocal=new Vector3(.62,-.02,3.55),forward=new Vector3();
  return {
    root,
    /** Lens exit point and direction, in world space. */
    lens(out:Vector3,direction:Vector3){root.updateWorldMatrix(true,true);out.copy(lensLocal).applyMatrix4(model.matrixWorld);direction.copy(forward.set(0,0,1)).transformDirection(model.matrixWorld);return out;},
    /** power: 0 standby (red), 1 projecting. idle: seconds of gentle float. */
    update(power:number,idle:number,still:boolean){
      model.position.y=still?0:Math.sin(idle*.6)*.07;
      model.rotation.set(still?0:Math.sin(idle*.37)*.015,still?0:Math.sin(idle*.23)*.03,still?0:Math.sin(idle*.31+1)*.012);
      glowMaterial.uniforms.uPower.value=power;light.intensity=power*55;
      status.color.setRGB(1-.75*power,.16+.8*power,.16+.84*power);
    },
  };
}
