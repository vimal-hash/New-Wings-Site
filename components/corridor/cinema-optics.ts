import {AmbientLight,Box3,CapsuleGeometry,Color,CustomBlending,DirectionalLight,DoubleSide,FramebufferTexture,FrontSide,Group,LinearFilter,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,NoBlending,OneFactor,OneMinusSrcAlphaFactor,PerspectiveCamera,Scene,ShaderMaterial,Vector2,Vector3,Vector4,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {effectQuality} from './effect-quality';
import {localEnvironment} from './local-environment';
import {glassesControls} from './glasses-controls';

export const CINEMA_OPTICS={frameBlurCss:3.5,transmittance:[.76,.78,.80],width:.94,height:.76} as const;
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
// Perceptual near-frame fade, scoped to the narrow centre over the actual screen.
// This clears the dangling nasal tips without a rectangular cut or changing the model.
const centreFade=`uniform vec4 uScreenBounds;
float centreFade(vec2 uv){
  if(uScreenBounds.w<=uScreenBounds.y)return 0.;
  float middle=1.-smoothstep(.012,.035,abs(uv.x-.5));
  float bottom=smoothstep(.015,.055,uv.y);
  float top=1.-smoothstep(.965,.995,uv.y);
  return middle*bottom*top;
}`;
const blur=`vec4 blur(sampler2D image,vec2 uv,vec2 axis){
  vec4 value=vec4(0.);float total=0.;
  for(int i=-24;i<=24;i++){
    float weight=exp(-.5*float(i*i)/64.);
    value+=texture2D(image,uv+axis*float(i))*weight;total+=weight;
  }
  return value/total;
}`;

/** One actual front model; only its frame is defocused. The scene itself is never blurred.
 * Lens tint uses the actual projected screen geometry as an exclusion, preserving its complete artwork. */
export function createCinemaOptics(gl:WebGLRenderer,source:Group){
  const front=source.getObjectByName('FrontGlasses_Rigid_Root');
  if(!front)throw new Error('Front-only cinema glasses missing');
  const scene=new Scene(),root=new Group(),model=front.clone(true);root.add(model);scene.add(root);
  const box=new Box3().setFromObject(model),centre=box.getCenter(new Vector3());
  const frame:Mesh[]=[],lenses:Mesh[]=[],materials:(MeshPhysicalMaterial|ShaderMaterial)[]=[];
  const near={value:1};
  const left=model.getObjectByName('Glasses_Left'),right=model.getObjectByName('Glasses_Right'),bridgeMesh=model.getObjectByName('Bridge_Reduced');
  // A small rounded black join replaces the rectangular tab. Original GLB is untouched.
  const joinGeometry=new CapsuleGeometry(.0011,.006,4,8);
  if(bridgeMesh instanceof Mesh){bridgeMesh.geometry=joinGeometry;bridgeMesh.position.set(0,.0115,.0011);}

  const quality=effectQuality(gl),scale=quality==='desktop'?1:quality==='laptop'?.75:.5;
  const frameTarget=new WebGLRenderTarget(1,1,{depthBuffer:true}),blurTarget=new WebGLRenderTarget(1,1,{depthBuffer:false});
  const screenTarget=new WebGLRenderTarget(1,1,{depthBuffer:false});
  for(const target of [frameTarget,blurTarget,screenTarget]){target.texture.generateMipmaps=false;target.texture.minFilter=target.texture.magFilter=LinearFilter;}
  let capture=new FramebufferTexture(1,1);capture.minFilter=capture.magFilter=LinearFilter;
  const pixels=new Vector2(),offset=new Vector3(),screenCorner=new Vector3();let width=0,height=0;
  const screenBounds={value:new Vector4(0,1,1,0)};
  const screenScene=new Scene(),screenMaterial=new MeshBasicMaterial({color:'white',side:DoubleSide,toneMapped:false});
  let screenMask:Mesh|null=null,screenSource:Mesh|null=null;
  const lensMaterial=new ShaderMaterial({toneMapped:false,side:FrontSide,depthWrite:false,depthTest:false,blending:NoBlending,
    uniforms:{uScreenBounds:screenBounds,uBase:{value:capture},uScreen:{value:screenTarget.texture},uPixels:{value:pixels},uAmount:{value:1},uTint:{value:.42}},
    vertexShader:`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`${centreFade} uniform sampler2D uBase,uScreen;uniform vec2 uPixels;uniform float uAmount,uTint;varying vec3 vNormal,vView;
      void main(){vec2 uv=gl_FragCoord.xy/uPixels;vec3 base=texture2D(uBase,uv).rgb;
        float screen=texture2D(uScreen,uv).r;
        float facing=abs(dot(normalize(vNormal),normalize(vView)));
        float edge=pow(1.-facing,4.);
        // Transmission in display space is deliberate: the source image already has its display transform.
        vec3 smoked=base*(vec3(1.)-uTint*vec3(1.,.98,.95));
        // Restrained neutral coating reflection, strongest near grazing edges. No haze over the screen.
        float reflection=.0015+edge*.013;
        smoked+=vec3(.83,.9,1.)*reflection;
        gl_FragColor=vec4(mix(base,smoked,uAmount*(1.-screen)*(1.-centreFade(uv))),1.);
      }`});
  model.traverse(object=>{
    if(!(object instanceof Mesh))return;
    object.frustumCulled=false;object.castShadow=false;object.receiveShadow=false;
    if(object.name.startsWith('Lens_')){object.material=lensMaterial;lenses.push(object);}
    else{
      const material=(object.material as MeshPhysicalMaterial).clone();
      material.transparent=false;material.opacity=1;material.transmission=0;material.toneMapped=false;
      material.roughness=.19;material.clearcoat=.7;material.clearcoatRoughness=.12;material.metalness=.1;
      material.envMap=localEnvironment(gl);material.envMapIntensity=object===bridgeMesh?.035:.28;
      if(object===bridgeMesh){material.color.set('#050607');material.roughness=.5;material.clearcoat=.1;}
      material.emissive.set('#080b10');material.emissiveIntensity=.08;
      object.material=material;frame.push(object);materials.push(material);
    }
  });
  materials.push(lensMaterial);
  const ambient=new AmbientLight('#dce4ee',.3),key=new DirectionalLight('#f4f6ff',3),fill=new DirectionalLight('#acb9c7',.5);
  key.position.set(-.5,.8,1);fill.position.set(.8,-.25,.6);root.add(ambient,key,key.target,fill,fill.target);
  const horizontal=new ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uFrame:{value:frameTarget.texture},uAxis:{value:new Vector2()}},vertexShader:vertex,
    fragmentShader:`uniform sampler2D uFrame;uniform vec2 uAxis;varying vec2 vUv;${blur}void main(){gl_FragColor=blur(uFrame,vUv,uAxis);}`});
  const composite=new ShaderMaterial({toneMapped:false,transparent:true,depthTest:false,depthWrite:false,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneMinusSrcAlphaFactor,
    uniforms:{uScreenBounds:screenBounds,uFrame:{value:blurTarget.texture},uAxis:{value:new Vector2()},uAmount:{value:1},uNear:near,uBridge:{value:.3}},vertexShader:vertex,
    fragmentShader:`${centreFade} uniform sampler2D uFrame;uniform vec2 uAxis;uniform float uAmount,uNear,uBridge;varying vec2 vUv;${blur}
      void main(){float centre=1.-smoothstep(.045,.14,abs(vUv.x-.5));
        vec4 c=blur(uFrame,vUv,uAxis*(1.+centre*uNear));if(c.a<.0001)discard;
        gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a*uAmount*mix(1.,uBridge,centre*uNear)*(1.-centreFade(vUv)));
        #include <colorspace_fragment>
        gl_FragColor.rgb*=gl_FragColor.a;
      }`});
  const horizontalQuad=new FullScreenQuad(horizontal),compositeQuad=new FullScreenQuad(composite),clear=new Color();
  const setFrame=(visible:boolean)=>{frame.forEach(m=>{m.visible=visible;});lenses.forEach(m=>{m.visible=!visible;});};
  return {
    draw(camera:Camera,world:Scene,amount:number,lift=0){
      if(amount<=.001||!(camera instanceof PerspectiveCamera))return;
      gl.getDrawingBufferSize(pixels);
      if(pixels.x!==width||pixels.y!==height){
        width=pixels.x;height=pixels.y;capture.dispose();capture=new FramebufferTexture(width,height);capture.minFilter=capture.magFilter=LinearFilter;
        lensMaterial.uniforms.uBase.value=capture;
        frameTarget.setSize(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));
        blurTarget.setSize(frameTarget.width,frameTarget.height);
        screenTarget.setSize(Math.max(1,Math.round(width*.5)),Math.max(1,Math.round(height*.5)));
      }
      const controls=glassesControls.read(),distance=controls.distance/100;
      near.value=Math.max(0,Math.min(1,(.45-distance)/.33));
      // Rigid translations only. Lens and rim vertices/normals stay untouched.
      const shift=Math.max(-.025,Math.min(.0127,.012+(80-controls.width)*.1576/200+(.08-controls.gap/100)*.0131923));
      if(left)left.position.x=shift;
      if(right)right.position.x=-shift;
      if(bridgeMesh)bridgeMesh.scale.x=1;
      const viewHeight=2*distance*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
      // Side-first fit: align the side plastic with the viewport, then let the
      // original vertical proportions fall naturally. No nonuniform scaling.
      const fitHeight=viewHeight*(controls.lockWidth?1:.08/distance);
      const sideRimSpan=.132-2*shift;
      const fitted=fitHeight*camera.aspect*.99/sideRimSpan;
      model.scale.setScalar(fitted);
      model.position.copy(centre).multiplyScalar(-fitted);
      offset.set(0,viewHeight*(-.02+lift),-distance).applyQuaternion(camera.quaternion);
      root.position.copy(camera.position).add(offset);root.quaternion.copy(camera.quaternion);root.updateMatrixWorld(true);
      if(!screenSource){
        const found=world.getObjectByName('Theatre screen | Full aspect artwork');
        if(found instanceof Mesh){screenSource=found;screenMask=new Mesh(found.geometry,screenMaterial);screenMask.matrixAutoUpdate=false;screenMask.frustumCulled=false;screenScene.add(screenMask);}
      }
      if(screenSource&&screenMask){
        screenSource.updateWorldMatrix(true,false);screenMask.matrix.copy(screenSource.matrixWorld);
        if(!screenSource.geometry.boundingBox)screenSource.geometry.computeBoundingBox();
        const bounds=screenSource.geometry.boundingBox;
        if(bounds){
          let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
          for(let i=0;i<8;i++){
            screenCorner.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(screenSource.matrixWorld).project(camera);
            const x=screenCorner.x*.5+.5,y=screenCorner.y*.5+.5;
            minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
          }
          screenBounds.value.set(minX,minY,maxX,maxY);
        }
      }
      const previous=gl.getRenderTarget(),auto=gl.autoClear,alpha=gl.getClearAlpha(),shadow=gl.shadowMap.autoUpdate,reset=gl.info.autoReset;
      gl.getClearColor(clear);gl.info.autoReset=false;
      try{
        // Capture the already-rendered colour, including its original display transform, once.
        gl.copyFramebufferToTexture(capture);
        gl.shadowMap.autoUpdate=false;gl.autoClear=true;gl.setClearColor(0,0);
        gl.setRenderTarget(screenTarget);gl.render(screenScene,camera);
        setFrame(true);gl.setRenderTarget(frameTarget);gl.render(scene,camera);
        const radius=controls.blur*(.3+.7*near.value)*gl.getPixelRatio()/24;
        horizontal.uniforms.uAxis.value.set(radius/width,0);
        composite.uniforms.uAxis.value.set(0,radius/height);
        gl.setRenderTarget(blurTarget);horizontalQuad.render(gl);
        gl.setRenderTarget(previous);gl.autoClear=false;
        setFrame(false);lensMaterial.uniforms.uAmount.value=amount;lensMaterial.uniforms.uTint.value=controls.tint;gl.render(scene,camera);
        composite.uniforms.uBridge.value=controls.bridge;
        composite.uniforms.uAmount.value=amount;compositeQuad.render(gl);
      }finally{
        setFrame(true);gl.setRenderTarget(previous);gl.autoClear=auto;gl.shadowMap.autoUpdate=shadow;gl.setClearColor(clear,alpha);gl.info.autoReset=reset;
      }
    },
    dispose(){joinGeometry.dispose();materials.forEach(m=>m.dispose());screenMaterial.dispose();horizontal.dispose();composite.dispose();horizontalQuad.dispose();compositeQuad.dispose();capture.dispose();frameTarget.dispose();blurTarget.dispose();screenTarget.dispose();scene.clear();screenScene.clear();},
  };
}
