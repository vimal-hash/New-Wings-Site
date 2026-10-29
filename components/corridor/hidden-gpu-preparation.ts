import { WebGLRenderTarget,type Camera,type Object3D,type Scene,type WebGLRenderer } from "three";

/** Compile both output variants asynchronously before a private resource draw. */
export async function compileHiddenGPU(renderer:WebGLRenderer,scene:Scene,camera:Camera){
 await renderer.compileAsync(scene,camera,scene);
 const target=new WebGLRenderTarget(1,1),previous=renderer.getRenderTarget();
 try{
  let completion:Promise<unknown>;
  try{renderer.setRenderTarget(target);completion=renderer.compileAsync(scene,camera,scene);}
  finally{renderer.setRenderTarget(previous);}
  await completion;
 }finally{target.dispose();}
}

/** Upload/first-draw into a private pixel. Actual scene visibility and renderer state are always restored. */
export function prepareHiddenGPU(renderer:WebGLRenderer,scene:Scene,camera:Camera,roots:Object3D[]){
 const target=new WebGLRenderTarget(1,1),previous=renderer.getRenderTarget(),auto=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate;
 const saved:{object:Object3D;visible:boolean;culled:boolean}[]=[];
 roots.forEach(root=>root.traverse(object=>{saved.push({object,visible:object.visible,culled:object.frustumCulled});object.visible=true;object.frustumCulled=false;}));
 try{renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.render(scene,camera);}
 finally{saved.forEach(({object,visible,culled})=>{object.visible=visible;object.frustumCulled=culled;});renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=needs;target.dispose();}
}
