import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Matrix4,Object3D,PerspectiveCamera,Scene,Vector3} from 'three';
import load from './load-runtime-ts.cjs';
const {PlanarMirror}=load('components/corridor/planar-mirror.ts');

test('cropped mirror keeps projection inverse coherent and restores hidden objects on render failure',()=>{
 const camera=new PerspectiveCamera(50,16/9,.1,100);camera.position.z=5;camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const scene=new Scene(),hidden=new Object3D();scene.add(hidden);
 let current=null,alpha=0,renders=0;
 const renderer={extensions:{has:()=>true},autoClear:true,state:{buffers:{depth:{setMask(){}}}},
  getDrawingBufferSize:size=>size.set(1280,720),getRenderTarget:()=>current,setRenderTarget:target=>{current=target;},getClearAlpha:()=>alpha,setClearAlpha:value=>{alpha=value;},
  render(_scene,reflected){renders++;assert.equal(hidden.visible,false);const identity=new Matrix4().multiplyMatrices(reflected.projectionMatrix,reflected.projectionMatrixInverse);identity.elements.forEach((v,i)=>assert.ok(Math.abs(v-(i%5===0?1:0))<1e-9));if(renders===2)throw Error('submission failed');}};
 const mirror=new PlanarMirror(new Vector3(0,0,1),new Vector3(),1.25),bounds=new Box3(new Vector3(-1,-1,0),new Vector3(1,1,0));
 assert.equal(mirror.render(renderer,scene,camera,[hidden],bounds),true);
 assert.equal(hidden.visible,true);assert.equal(current,null);assert.equal(alpha,0);
 assert.ok(mirror.target.width<1280);assert.ok(mirror.target.viewport.z<=mirror.target.width);assert.ok(mirror.target.viewport.w<=mirror.target.height);
 assert.throws(()=>mirror.render(renderer,scene,camera,[hidden],bounds),/submission failed/);
 assert.equal(hidden.visible,true);assert.equal(current,null);assert.equal(alpha,0);mirror.dispose();
});
