import {AmbientLight,Box3,Color,CustomBlending,DirectionalLight,DoubleSide,FramebufferTexture,FrontSide,Group,LinearFilter,Matrix4,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,NoBlending,OneFactor,OneMinusSrcAlphaFactor,PerspectiveCamera,PlaneGeometry,Scene,ShaderMaterial,Vector2,Vector3,Vector4,WebGLRenderTarget,type Camera,type WebGLRenderer} from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {effectQuality} from './effect-quality';
import {localEnvironment} from './local-environment';
import {glassesControls} from './glasses-controls';

const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const regionalBlur=`uniform vec2 uBlur;uniform vec4 uInnerBounds;
float frameRadius(vec2 uv){
  float x=smoothstep(uInnerBounds.x-.018,uInnerBounds.x,uv.x)*(1.-smoothstep(uInnerBounds.z,uInnerBounds.z+.018,uv.x));
  float y=smoothstep(uInnerBounds.y-.025,uInnerBounds.y,uv.y)*(1.-smoothstep(uInnerBounds.w,uInnerBounds.w+.025,uv.y));
  return mix(uBlur.x,uBlur.y,x*y);
}`;
/** Dense 49-tap Gaussian on computers; phones take every third tap (17) between linear-filtered texels: a third of the reads. */
const blurOf=(step:number)=>`vec4 blur(sampler2D image,vec2 uv,vec2 axis){
  vec4 value=vec4(0.);float total=0.;
  for(int i=-${Math.floor(24/step)};i<=${Math.floor(24/step)};i++){
    float d=float(i)*${step.toFixed(1)};float weight=exp(-.5*d*d/64.);
    value+=texture2D(image,uv+axis*d)*weight;total+=weight;
  }
  return value/total;
}`;

/** One actual front model; only its frame is defocused. The scene itself is never blurred.
 * Lens tint uses the actual projected screen geometry as an exclusion, preserving its complete artwork. */
export function createCinemaOptics(gl:WebGLRenderer,source:Group){
  const front=source.getObjectByName('CinemaGlasses_Slim_Root');
  if(!front)throw new Error('Front-only cinema glasses missing');
  const scene=new Scene(),root=new Group(),model=front.clone(true);root.add(model);scene.add(root);
  const box=new Box3().setFromObject(model),centre=box.getCenter(new Vector3()),modelSize=box.getSize(new Vector3());
  const frame:Mesh[]=[],lenses:Mesh[]=[],materials:(MeshPhysicalMaterial|ShaderMaterial)[]=[];

  const quality=effectQuality(gl),mobile=quality==='mobile',scale=quality==='desktop'?1:quality==='laptop'?.75:.5,blur=blurOf(mobile?3:1);
  const frameTarget=new WebGLRenderTarget(1,1,{depthBuffer:true}),blurTarget=new WebGLRenderTarget(1,1,{depthBuffer:false});
  const screenTarget=new WebGLRenderTarget(1,1,{depthBuffer:false}),viewTarget=new WebGLRenderTarget(1,1,{depthBuffer:true,samples:quality==='desktop'?4:quality==='laptop'?2:0});
  for(const target of [frameTarget,blurTarget,screenTarget,viewTarget]){target.texture.generateMipmaps=false;target.texture.minFilter=target.texture.magFilter=LinearFilter;}
  let capture=new FramebufferTexture(1,1);capture.minFilter=capture.magFilter=LinearFilter;
  const pixels=new Vector2(),offset=new Vector3(),rimCorner=new Vector3();let width=0,height=0;
  const innerBounds={value:new Vector4()};
  const screenScene=new Scene(),screenMaterial=new MeshBasicMaterial({color:'white',side:DoubleSide,toneMapped:false});
  let screenMask:Mesh|null=null,screenSource:Mesh|null=null;
  const lensMaterial=new ShaderMaterial({toneMapped:false,side:FrontSide,depthWrite:false,depthTest:false,blending:NoBlending,
    uniforms:{uBase:{value:capture},uScreen:{value:screenTarget.texture},uView:{value:viewTarget.texture},uViewAmount:{value:0},uViewMask:{value:1},uWarp:{value:0},uPixels:{value:pixels},uAmount:{value:1},uTint:{value:.22}},
    vertexShader:`varying vec3 vNormal;varying vec3 vView;varying vec3 vLens;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vNormal=normalMatrix*normal;
      vLens=vec3((abs(position.x)-.039)/.037,(position.y+.0005)/.0345,position.x/.077);gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform sampler2D uBase,uScreen,uView;uniform vec2 uPixels;uniform float uAmount,uTint,uViewAmount,uViewMask,uWarp;varying vec3 vNormal,vView,vLens;
      void main(){vec2 uv=gl_FragCoord.xy/uPixels;
        // Lens field of view: towards the rim the view is drawn slightly inward, magnifying it as real
        // spectacle lenses do. The centre of each lens keeps the exact scale.
        vec2 outward=vec2(sign(vLens.z)*max(vLens.x,0.),vLens.y);
        vec2 warped=uv-outward*dot(outward,outward)*uWarp*vec2(uPixels.y/uPixels.x,1.);
        vec3 base=texture2D(uBase,warped).rgb;
        float screen=texture2D(uScreen,uv).r;
        // The view through the lenses: stereo depth layers on the theatre screen, or
        // objects that leave a corridor display. Outside the lenses the room stays 2D.
        if(uViewAmount>0.){
          vec4 view=texture2D(uView,warped);
          // Screen-masked layers replace the 2D screen; a free view is premultiplied by its own coverage.
          float cover=uViewMask>.5?texture2D(uScreen,warped).r:view.a;
          base=uViewMask>.5?mix(base,view.rgb,clamp(cover,0.,1.)*uViewAmount):base*(1.-clamp(cover,0.,1.)*uViewAmount)+view.rgb*uViewAmount;
        }
        float facing=abs(dot(normalize(vNormal),normalize(vView)));
        float edge=pow(1.-facing,4.);
        // Transmission in display space is deliberate: the source image already has its display transform.
        vec3 smoked=base*(vec3(1.)-uTint*vec3(1.,.98,.95));
        // Restrained neutral coating reflection, strongest near grazing edges. No haze over the screen.
        float reflection=.0015+edge*.013;
        smoked+=vec3(.83,.9,1.)*reflection;
        // Reads as glass: the smoke deepens towards the rim, and one soft coating sheen crosses both lenses.
        float rim=smoothstep(.5,1.05,length(vLens.xy));
        smoked*=1.-.12*rim*uTint;
        float sheen=exp(-pow((vLens.z*.38+vLens.y*.9-.32)/.2,2.))*(1.-.7*rim);
        smoked+=vec3(.78,.85,.95)*.006*sheen*uTint/.55;
        gl_FragColor=vec4(mix(base,smoked,uAmount*(1.-screen)),1.);
      }`});
  // Fill only the narrow opening between the authored nasal curves (-18 to
  // +22 mm). It shares the lens shader and untouched scene capture, so overlaps
  // cannot double-darken and the theatre screen exclusion remains identical.
  const centreLensGeometry=new PlaneGeometry(.003,.040);
  centreLensGeometry.translate(0,.002,-.00025);
  const centreLens=new Mesh(centreLensGeometry,lensMaterial);
  centreLens.name='Lens_CentreFill';model.add(centreLens);
  model.traverse(object=>{
    if(!(object instanceof Mesh))return;
    object.frustumCulled=false;object.castShadow=false;object.receiveShadow=false;
    if(object.name.startsWith('Lens_')){object.material=lensMaterial;lenses.push(object);}
    else{
      const material=(object.material as MeshPhysicalMaterial).clone();
      material.transparent=false;material.depthWrite=true;material.opacity=1;material.transmission=0;material.toneMapped=false;
      material.color.set('#12171c');material.roughness=.30;material.clearcoat=.24;material.clearcoatRoughness=.24;material.metalness=.05;
      material.envMap=localEnvironment(gl);material.envMapIntensity=.30;
      material.emissive.set('#000000');material.emissiveIntensity=0;
      // The two solid rims remain opaque. Only optical defocus is stronger at
      // their shared inner edge; no centre opacity mask or screen-dependent hiding.
      object.material=material;frame.push(object);materials.push(material);
    }
  });
  materials.push(lensMaterial);
  const ambient=new AmbientLight('#dce4ee',.55),key=new DirectionalLight('#f4f6ff',1.2),fill=new DirectionalLight('#acb9c7',.45);
  key.position.set(-.5,.8,1);fill.position.set(.8,-.25,.6);root.add(ambient,key,key.target,fill,fill.target);
  const blurRadii={value:new Vector2()};
  const horizontal=new ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{uFrame:{value:frameTarget.texture},uAxis:{value:new Vector2()},uBlur:blurRadii,uInnerBounds:innerBounds},vertexShader:vertex,
    fragmentShader:`uniform sampler2D uFrame;uniform vec2 uAxis;varying vec2 vUv;${regionalBlur}${blur}void main(){gl_FragColor=blur(uFrame,vUv,uAxis*frameRadius(vUv));}`});
  const composite=new ShaderMaterial({toneMapped:false,transparent:true,depthTest:false,depthWrite:false,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:OneFactor,blendDstAlpha:OneMinusSrcAlphaFactor,
    uniforms:{uFrame:{value:blurTarget.texture},uAxis:{value:new Vector2()},uAmount:{value:1},uBlur:blurRadii,uInnerBounds:innerBounds},vertexShader:vertex,
    fragmentShader:`uniform sampler2D uFrame;uniform vec2 uAxis;uniform float uAmount;varying vec2 vUv;${regionalBlur}${blur}
      void main(){
        vec4 c=blur(uFrame,vUv,uAxis*frameRadius(vUv));if(c.a<.0001)discard;
        float inner=smoothstep(uInnerBounds.x-.028,uInnerBounds.x-.009,vUv.x)*(1.-smoothstep(uInnerBounds.z+.009,uInnerBounds.z+.028,vUv.x));
        float bridge=smoothstep(uInnerBounds.y-.07,uInnerBounds.y+.10,vUv.y)*(1.-smoothstep(uInnerBounds.w-.10,uInnerBounds.w+.07,vUv.y));
        gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a*uAmount*(1.-.985*inner*bridge));
        #include <colorspace_fragment>
        gl_FragColor.rgb*=gl_FragColor.a;
      }`});
  const horizontalQuad=new FullScreenQuad(horizontal),compositeQuad=new FullScreenQuad(composite),clear=new Color();
  // The frame is attached to the camera. Its appearance in screen space only
  // changes with the projection, fit and blur controls. The lift can sample the
  // same blurred frame at an offset, while the lenses still use the live pose.
  const phoneFrame=mobile?new WebGLRenderTarget(1,1,{depthBuffer:false}):null;
  if(phoneFrame){phoneFrame.texture.generateMipmaps=false;phoneFrame.texture.minFilter=phoneFrame.texture.magFilter=LinearFilter;}
  const phoneVertical=mobile?new FullScreenQuad(new ShaderMaterial({toneMapped:false,depthTest:false,depthWrite:false,blending:NoBlending,
    uniforms:{...horizontal.uniforms,uFrame:{value:blurTarget.texture},uAxis:{value:new Vector2()}},vertexShader:vertex,fragmentShader:horizontal.fragmentShader})):null;
  if(phoneFrame){
    composite.uniforms.uFrame.value=phoneFrame.texture;
    composite.uniforms.uLift={value:0};
    composite.fragmentShader=composite.fragmentShader.replace('varying vec2 vUv;', 'varying vec2 vUv;uniform float uLift;')
      .replace('vec4 c=blur(uFrame,vUv,uAxis*frameRadius(vUv));','vec2 frameUv=vUv-vec2(0.,uLift);if(frameUv.y<0.||frameUv.y>1.)discard;vec4 c=texture2D(uFrame,frameUv);')
      .replaceAll('vUv.x','frameUv.x').replaceAll('vUv.y','frameUv.y');
  }
  let frameKey='';
  const previousCamera=new Matrix4(),previousProjection=new Matrix4(),previousScreen=new Matrix4();
  let maskReady=false,viewKey:number|undefined;
  const setFrame=(visible:boolean)=>{frame.forEach(m=>{m.visible=visible;});lenses.forEach(m=>{m.visible=!visible;});};
  return {
    /** view: optional lens-only render (into the given target), and how strongly it replaces the 2D image. */
    draw(camera:Camera,world:Scene,amount:number,lift=0,view?:{amount:number;mask:boolean;warp:number;key?:number;render(target:WebGLRenderTarget):void}){
      if(amount<=.001||!(camera instanceof PerspectiveCamera))return;
      gl.getDrawingBufferSize(pixels);
      if(pixels.x!==width||pixels.y!==height){
        width=pixels.x;height=pixels.y;capture.dispose();capture=new FramebufferTexture(width,height);capture.minFilter=capture.magFilter=LinearFilter;
        lensMaterial.uniforms.uBase.value=capture;
        frameTarget.setSize(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale)));
        blurTarget.setSize(frameTarget.width,frameTarget.height);
        phoneFrame?.setSize(frameTarget.width,frameTarget.height);frameKey='';maskReady=false;viewKey=undefined;
        screenTarget.setSize(Math.max(1,Math.round(width*.5)),Math.max(1,Math.round(height*.5)));
        viewTarget.setSize(Math.max(1,Math.round(width*Math.max(.75,scale))),Math.max(1,Math.round(height*Math.max(.75,scale))));
      }
      const controls=glassesControls.read(),distance=controls.distance/100;
      const viewHeight=2*distance*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
      // One complete model, one uniform scale. Width never changes lens shape or
      // tears the bridge apart. Fit comes from exported bounds, not old mesh constants.
      const fitHeight=viewHeight*(controls.lockWidth?1:.08/distance);
      const fitted=fitHeight*camera.aspect*1.015/modelSize.x*controls.width/100;
      model.scale.setScalar(fitted);
      model.position.copy(centre).multiplyScalar(-fitted);
      const pose=(rise:number)=>{
        offset.set(0,viewHeight*(controls.height/100+rise),-distance).applyQuaternion(camera.quaternion);
        root.position.copy(camera.position).add(offset);root.quaternion.copy(camera.quaternion);root.updateMatrixWorld(true);
      };
      const key=mobile?[camera.fov,camera.zoom,camera.aspect,controls.distance,controls.width,controls.lockWidth,controls.height,controls.blur,controls.innerBlur].join(','):'';
      const refreshFrame=!mobile||frameKey!==key;
      if(refreshFrame)pose(mobile?0:lift);
      // Follow only the authored straight inner rims, between the two marked
      // junctions. Upper/lower outer curves retain their independent 5 px blur.
      if(refreshFrame){
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(let i=0;i<4;i++){
          rimCorner.set(i&1?.004:-.004,i&2?.022:-.018,0).applyMatrix4(model.matrixWorld).project(camera);
          const x=rimCorner.x*.5+.5,y=rimCorner.y*.5+.5;
          minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        }
        innerBounds.value.set(minX,minY,maxX,maxY);
      }
      if(!screenSource){
        const found=world.getObjectByName('Theatre screen | Full aspect artwork');
        if(found instanceof Mesh){screenSource=found;screenMask=new Mesh(found.geometry,screenMaterial);screenMask.matrixAutoUpdate=false;screenMask.frustumCulled=false;screenScene.add(screenMask);maskReady=false;}
      }
      if(screenSource&&screenMask){
        screenSource.updateWorldMatrix(true,false);screenMask.matrix.copy(screenSource.matrixWorld);
        if(!previousScreen.equals(screenSource.matrixWorld)){previousScreen.copy(screenSource.matrixWorld);maskReady=false;}
      }
      const cameraChanged=!previousCamera.equals(camera.matrixWorld)||!previousProjection.equals(camera.projectionMatrix);
      if(cameraChanged){previousCamera.copy(camera.matrixWorld);previousProjection.copy(camera.projectionMatrix);maskReady=false;viewKey=undefined;}
      const previous=gl.getRenderTarget(),auto=gl.autoClear,alpha=gl.getClearAlpha(),shadow=gl.shadowMap.autoUpdate,reset=gl.info.autoReset;
      gl.getClearColor(clear);gl.info.autoReset=false;
      try{
        // Capture the already-rendered colour, including its original display transform, once.
        gl.copyFramebufferToTexture(capture);
        gl.shadowMap.autoUpdate=false;gl.autoClear=true;gl.setClearColor(0,0);
        if(!mobile||!maskReady){gl.setRenderTarget(screenTarget);gl.render(screenScene,camera);maskReady=true;}
        const viewAmount=view&&view.amount>.001?view.amount:0;
        if(view&&viewAmount&&(!mobile||view.key===undefined||view.key!==viewKey)){
          view.render(viewTarget);gl.autoClear=true;gl.setClearColor(0,0);viewKey=view.key;
        }
        lensMaterial.uniforms.uViewAmount.value=viewAmount;lensMaterial.uniforms.uViewMask.value=view?.mask?1:0;lensMaterial.uniforms.uWarp.value=view?.warp??.0;
        if(refreshFrame){
          setFrame(true);gl.setRenderTarget(frameTarget);gl.render(scene,camera);
          blurRadii.value.set(controls.blur,controls.innerBlur).multiplyScalar(gl.getPixelRatio()/8);
          horizontal.uniforms.uAxis.value.set(1/width,0);
          gl.setRenderTarget(blurTarget);horizontalQuad.render(gl);
          if(phoneFrame&&phoneVertical){
            (phoneVertical.material as ShaderMaterial).uniforms.uAxis.value.set(0,1/height);
            gl.setRenderTarget(phoneFrame);phoneVertical.render(gl);frameKey=key;
          }else composite.uniforms.uAxis.value.set(0,1/height);
        }
        if(mobile){pose(lift);composite.uniforms.uLift.value=lift;}
        gl.setRenderTarget(previous);gl.autoClear=false;
        setFrame(false);lensMaterial.uniforms.uAmount.value=amount;lensMaterial.uniforms.uTint.value=controls.tint;gl.render(scene,camera);
        composite.uniforms.uAmount.value=amount;
        compositeQuad.render(gl);
      }finally{
        setFrame(true);gl.setRenderTarget(previous);gl.autoClear=auto;gl.shadowMap.autoUpdate=shadow;gl.setClearColor(clear,alpha);gl.info.autoReset=reset;
      }
    },
    dispose(){centreLensGeometry.dispose();materials.forEach(m=>m.dispose());screenMaterial.dispose();horizontal.dispose();composite.dispose();horizontalQuad.dispose();compositeQuad.dispose();phoneVertical?.material.dispose();phoneVertical?.dispose();phoneFrame?.dispose();capture.dispose();frameTarget.dispose();blurTarget.dispose();screenTarget.dispose();viewTarget.dispose();scene.clear();screenScene.clear();},
  };
}
