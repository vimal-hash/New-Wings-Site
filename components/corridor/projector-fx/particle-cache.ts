import { BufferGeometry, DataTexture, Float32BufferAttribute, FloatType, GLSL3, Mesh, NearestFilter, NoBlending, OrthographicCamera, RGBAFormat, Scene, ShaderMaterial, WebGLRenderTarget, type InstancedBufferAttribute, type WebGLRenderer } from "three";
import { particlesLib } from "./particlesLib.glsl";
import { formationGLSL } from "./formation";
import { particleField } from "./particle-field";


/** The evaluation program depends on nothing but this source, so it can be compiled before the particle data exists
 * (the grain count is a uniform, not baked into the text). Same maths and output as before. */
function particleCacheMaterial(){
  return new ShaderMaterial({glslVersion:GLSL3,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
  uniforms:{uFrame:{value:0},uFps:{value:24},uIsViewport:{value:false},uCount:{value:0},uActiveMain:{value:0},uActiveAmbient:{value:0},uPosition:{value:null},uNormal:{value:null},uMisc:{value:null},uOutput:{value:0}},
  vertexShader:`void main(){gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:/* glsl */`
precision highp float;
precision highp int;
uniform float uFrame,uFps;
uniform bool uIsViewport;
uniform int uCount,uActiveMain,uActiveAmbient,uOutput;
uniform sampler2D uPosition,uNormal,uMisc;
layout(location=0) out vec4 cacheOut;
vec4 headRadius,tailCoverage,colourEmission;
void evaluate();
void main(){evaluate();cacheOut=uOutput==0?headRadius:uOutput==1?tailCoverage:colourEmission;}
${particlesLib}
${formationGLSL}
${particleField}
void evaluate(){
 ivec2 texel=ivec2(gl_FragCoord.xy);int index=texel.y*${CACHE_WIDTH}+texel.x;
 headRadius=tailCoverage=colourEmission=vec4(0.);
 if((index>=uActiveMain&&index<uCount)||index>=uCount+uActiveAmbient)return;
 bool del,drop,trail,show;vec3 P,PP,v,n=vec3(0.);vec4 col;float em,rad,cov,em2,g=0.,t0=0.,dur=0.;int part=0,id=index-uCount;
 if(index<uCount){
  vec4 p=texelFetch(uPosition,texel,0),normal=texelFetch(uNormal,texel,0),misc=texelFetch(uMisc,texel,0);
  n=normal.xyz;g=normal.w;t0=misc.x;dur=misc.y;part=int(misc.z);id=int(p.w);
  particleData(p.xyz,n,g,t0,dur,part,id,del,P,PP,col,em,rad,v);
 }else{del=id>=particleAmbientCount();particleAmbient(id,P,PP,col,em,rad,v);}
 particleJoined(P,rad,col,em,v,n,g,t0,dur,part,id,drop,cov,em2,trail,show);
 if(del||drop||!show)return;
 vec3 offset=vec3(0.);if(trail)particleTrail(P,rad,col,em,v,cov,1.,n,g,t0,dur,part,id,offset);
 headRadius=vec4(P,trail?-rad:rad);tailCoverage=vec4(P+offset,cov);colourEmission=vec4(col.rgb,em2);
}`});
}
const CACHE_WIDTH=256;

/** Same Blender field, one fragment per grain rather than four expensive vertices.
 * Positions remain full 32-bit floats: no quantization, resampling or fewer grains. */
export function createParticleCache(gl:WebGLRenderer,count:number,ambient:number,attributes:Record<string,InstancedBufferAttribute>){
 const context=gl.getContext() as WebGL2RenderingContext;
 if(!gl.extensions.has("EXT_color_buffer_float")||context.getParameter(context.MAX_DRAW_BUFFERS)<3)return null;
 const width=CACHE_WIDTH,height=Math.ceil((count+ambient)/width),length=width*height;
 const position=new Float32Array(length*4),normal=new Float32Array(length*4),misc=new Float32Array(length*4);
 for(let i=0;i<count;i++){
  for(let k=0;k<3;k++){position[i*4+k]=attributes.aPosition.array[i*3+k];normal[i*4+k]=attributes.aNormal.array[i*3+k];}
  position[i*4+3]=attributes.aId.array[i];normal[i*4+3]=attributes.aMisc.array[i*4];
  misc[i*4]=attributes.aMisc.array[i*4+1];misc[i*4+1]=attributes.aMisc.array[i*4+2];misc[i*4+2]=attributes.aMisc.array[i*4+3];
 }
 const inputs=[position,normal,misc].map(array=>{const texture=new DataTexture(array,width,height,RGBAFormat,FloatType);texture.needsUpdate=true;return texture;});
 // Three single-output targets, not one MRT target: on Windows (ANGLE/D3D11) the async
 // compile only ever builds the one-output shader, so an MRT draw recompiled this large
 // program synchronously on the GPU thread (a 3-4 s freeze on a cold first visit).
 const targets=[0,1,2].map(()=>new WebGLRenderTarget(width,height,{type:FloatType,format:RGBAFormat,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false}));
 const material=particleCacheMaterial();
 material.uniforms.uCount.value=count;material.uniforms.uActiveMain.value=count;material.uniforms.uActiveAmbient.value=ambient;
 inputs.forEach((texture,i)=>{material.uniforms[["uPosition","uNormal","uMisc"][i]].value=texture;});
 const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const scene=new Scene(),camera=new OrthographicCamera();const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
 let previousFrame=NaN,previousMain=0,previousAmbient=0;
 return {textures:targets.map(target=>target.texture),scene,camera,uniforms:material.uniforms,
  compile(){const previous=gl.getRenderTarget();try{gl.setRenderTarget(targets[0]);return gl.compileAsync(scene,camera);}finally{gl.setRenderTarget(previous);}},
  update(frame:number,activeMain=count,activeAmbient=ambient){
   if(frame===previousFrame&&activeMain===previousMain&&activeAmbient===previousAmbient)return;
   material.uniforms.uFrame.value=frame;material.uniforms.uActiveMain.value=activeMain;material.uniforms.uActiveAmbient.value=activeAmbient;
   const previous=gl.getRenderTarget(),shadows=gl.shadowMap.autoUpdate,needs=gl.shadowMap.needsUpdate;
   try{gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=false;targets.forEach((target,i)=>{material.uniforms.uOutput.value=i;gl.setRenderTarget(target);gl.render(scene,camera);});previousFrame=frame;previousMain=activeMain;previousAmbient=activeAmbient;}
   finally{gl.setRenderTarget(previous);gl.shadowMap.autoUpdate=shadows;gl.shadowMap.needsUpdate=needs;}
  },
  dispose(){inputs.forEach(texture=>texture.dispose());targets.forEach(target=>target.dispose());material.dispose();geometry.dispose();}
 };
}

/** Windows (ANGLE/D3D11) needs ~3.5 s of GPU-process time to compile this program and presents nothing meanwhile. It
 * used to compile at the first seated theatre stop (a visible 3.5 s freeze). Start it at canvas creation instead, while
 * the opening assets download. The material stays alive so three keeps the linked program for the real cache. */
let warmed:ShaderMaterial|undefined;
export function warmParticleCacheProgram(gl:WebGLRenderer){
 if(warmed||!gl.extensions.has("EXT_color_buffer_float"))return;
 warmed=particleCacheMaterial();
 const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const scene=new Scene(),mesh=new Mesh(geometry,warmed);mesh.frustumCulled=false;scene.add(mesh);
 const target=new WebGLRenderTarget(1,1,{type:FloatType,format:RGBAFormat,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false}),previous=gl.getRenderTarget();
 let ready:Promise<unknown>;
 try{gl.setRenderTarget(target);ready=gl.compileAsync(scene,new OrthographicCamera());}finally{gl.setRenderTarget(previous);}
 return ready.finally(()=>{target.dispose();geometry.dispose();});
}
