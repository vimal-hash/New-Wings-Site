import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,PerspectiveCamera,Scene,Texture} from 'three';
import {applyLogoMaterial,foregroundLightAmount} from '../components/corridor/logo-material.ts';

test('close-view lighting stays out of earlier stages and fades completely before the final eye',()=>{
 for(const phase of ['intro','corridor','panel','page','logoDone'])assert.equal(foregroundLightAmount(phase,30),0);
 assert.equal(foregroundLightAmount('logoReveal',27.74),1);
 assert.equal(foregroundLightAmount('logoReveal',34.10),1);
 let previous=1;
 for(let height=45;height<=146;height+=.1){const value=foregroundLightAmount('logoReveal',height);assert.ok(value<=previous&&value>=0);assert.ok(previous-value<.002);previous=value;}
 assert.equal(foregroundLightAmount('logoReveal',145),0);
});

test('logo reflection uses a private shared material and recovers the approved final response',()=>{
 const sourceMaterial=new MeshStandardMaterial(),geometry=new BoxGeometry(),source=new Group();
 const logo=new Mesh(geometry,sourceMaterial);logo.name='Swoosh_A';source.add(logo);
 const wall=new Mesh(geometry,sourceMaterial);wall.name='Corridor wall';source.add(wall);
 const copy=source.clone(true),environment=new Texture();let phase='logoReveal';
 const steel=applyLogoMaterial(copy,environment,()=>phase),owned=copy.getObjectByName('Swoosh_A');
 assert.notEqual(steel,sourceMaterial);assert.equal(copy.getObjectByName('Corridor wall').material,sourceMaterial);
 assert.equal(logo.material,sourceMaterial);assert.equal(owned.geometry,geometry);
 const camera=new PerspectiveCamera(),scene=new Scene();camera.position.y=34;camera.updateMatrixWorld();
 owned.onBeforeRender(null,scene,camera,geometry,steel,null);
 assert.ok(steel.envMapIntensity>0&&steel.emissiveIntensity<1);
 camera.position.y=150;camera.updateMatrixWorld();owned.onBeforeRender(null,scene,camera,geometry,steel,null);
 assert.equal(steel.envMapIntensity,0);assert.equal(steel.emissiveIntensity,1);
 phase='logoDone';camera.position.y=34;camera.updateMatrixWorld();owned.onBeforeRender(null,scene,camera,geometry,steel,null);
 assert.equal(steel.envMapIntensity,0);assert.equal(steel.emissiveIntensity,1);
 assert.equal(steel.color.getHexString(),'828d96');assert.equal(steel.emissive.getHexString(),'30373d');
 steel.dispose();sourceMaterial.dispose();geometry.dispose();environment.dispose();
});

test('View 2 key light: rises through the turn, gone early in the pullback and never in the final eye',async()=>{
 const {logoKeyAmount,logoKey}=await import('../components/corridor/logo-material.ts');
 for(const [stage,progress] of [['slide',0],['slide',1],['top',1],['turn',0],['pullback',.35],['pullback',1],['done',1]])assert.equal(logoKeyAmount(stage,progress),0);
 assert.equal(logoKeyAmount('turned',1),1);assert.equal(logoKeyAmount('turn',1),1);assert.equal(logoKeyAmount('pullback',0),1);
 let previous=0;for(let i=0;i<=100;i++){const value=logoKeyAmount('turn',i/100);assert.ok(value>=previous);previous=value;}
 const sourceMaterial=new MeshStandardMaterial(),geometry=new BoxGeometry(),source=new Group();
 const logo=new Mesh(geometry,sourceMaterial);logo.name='Swoosh_A';source.add(logo);
 let phase='logoReveal';const steel=applyLogoMaterial(source,null,()=>phase),owned=source.getObjectByName('Swoosh_A');
 const shader={uniforms:{},fragmentShader:'#include <common>\nvoid main(){\n#include <opaque_fragment>\n}',vertexShader:''};steel.onBeforeCompile(shader,null);
 assert.match(shader.fragmentShader,/uLogoKey/);
 const camera=new PerspectiveCamera(),scene=new Scene();camera.position.y=34;camera.updateMatrixWorld();
 logoKey.view=1;owned.onBeforeRender(null,scene,camera,geometry,steel,null);assert.equal(shader.uniforms.uLogoKey.value,1);
 phase='logoDone';owned.onBeforeRender(null,scene,camera,geometry,steel,null);assert.equal(shader.uniforms.uLogoKey.value,0,'the final eye is unchanged');
 logoKey.view=0;steel.dispose();sourceMaterial.dispose();geometry.dispose();
});
