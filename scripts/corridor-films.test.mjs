import test from 'node:test';
import assert from 'node:assert/strict';
import {Color,PerspectiveCamera,Vector2,Vector3,WebGLRenderTarget} from 'three';
import {createDisplayContent} from '../components/corridor/corridor-display-content.ts';

const frames=[-9,9].map(x=>({centre:new Vector3(x,6,0),normal:new Vector3(0,0,1),along:new Vector3(1,0,0),width:16,height:11,bottom:.5}));
function harness(){
 const film=createDisplayContent(frames,new Vector3(0,6,30)),calls=[];
 const originalTarget={},gl={target:originalTarget,autoClear:false,alpha:.7,colour:new Color('#123456'),
  getRenderTarget(){return this.target;},setRenderTarget(t){this.target=t;},getClearAlpha(){return this.alpha;},
  getClearColor(out){return out.copy(this.colour);},setClearColor(c,a){this.colour.copy(c);this.alpha=a;},
  render(scene,camera){calls.push({scene,camera:camera.clone(),visible:scene.children.filter(o=>o.visible)});}};
 return {film,gl,calls,originalTarget};
}

test('wall films isolate each original model and restore the renderer state',()=>{
 const {film,gl,calls,originalTarget}=harness();
 film.update([1,1],.016,false,false);
 film.renderDisplay(gl,0);film.renderDisplay(gl,1);
 assert.equal(calls[0].visible.length,1);assert.equal(calls[1].visible.length,1);
 assert.notEqual(calls[0].visible[0],calls[1].visible[0],'rocket and car keep separate film windows');
 assert.ok(calls[0].visible[0].children[1].children[0].children.length>=6,'rocket includes body, nose, fins and flame');
 assert.equal(calls[1].visible[0].children[1].children.length,6,'car includes body, cabin and four wheels');
 assert.equal(gl.target,originalTarget);assert.equal(gl.autoClear,false);assert.equal(gl.alpha,.7);
 assert.equal(gl.colour.getHexString(),'123456');film.dispose();
});

test('glasses activate model motion and render both worlds from the live camera',()=>{
 const {film,gl,calls}=harness(),target=new WebGLRenderTarget(4,4),camera=new PerspectiveCamera(40,2,.1,300);
 camera.position.set(0,6,30);camera.updateMatrixWorld(true);
 film.update([1,1],.016,false,false);film.renderDisplay(gl,1);
 const car=calls[0].visible[0].children[1],parked=car.position.clone();
 for(let i=0;i<24;i++)film.update([1,1],.05,false,true);
 assert.ok(car.position.distanceTo(parked)>.2,'car pulls away after wearing the glasses');
 film.renderLens(gl,camera,target,new Vector2(.1,0));
 const lens=calls.at(-1);assert.equal(lens.visible.length,2);
 assert.ok(Math.abs(lens.camera.position.x-camera.position.x-.1)<1e-9,'live lens view uses its head offset');
 film.update([0,0],.05,false,true);film.renderLens(gl,camera,target,new Vector2());
 assert.equal(calls.at(-1).visible.length,0,'closing displays hides both films');
 film.dispose();target.dispose();
});
