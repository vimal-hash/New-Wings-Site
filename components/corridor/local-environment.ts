import { Color,Mesh,MeshLambertMaterial,MeshStandardMaterial,PMREMGenerator,PointLight,type Texture,type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const environments=new WeakMap<WebGLRenderer,Texture>();
/** Shared, small warm cinema environment. Built once, without a network HDRI. */
export function localEnvironment(gl:WebGLRenderer){
  let texture=environments.get(gl);if(texture)return texture;
  const room=new RoomEnvironment();room.background=new Color("#101317");
  room.traverse(object=>{
    if(object instanceof PointLight){object.color.set("#ffe4c4");object.intensity*=.35;}
    if(object instanceof Mesh){const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials){
      if(material instanceof MeshStandardMaterial){material.color.set("#34302c");material.roughness=.8;}
      if(material instanceof MeshLambertMaterial){material.color.multiply(new Color("#ffe9cd"));material.color.multiplyScalar(.38);}
    }}
  });
  const generator=new PMREMGenerator(gl);texture=generator.fromScene(room,.035).texture;
  room.dispose();generator.dispose();environments.set(gl,texture);return texture;
}

const studios=new WeakMap<WebGLRenderer,Texture>();
/** Bright neutral product-shot studio, for the corridor's brand film only (black products need softbox reflections). */
export function studioEnvironment(gl:WebGLRenderer){
  let texture=studios.get(gl);if(texture)return texture;
  const room=new RoomEnvironment(),generator=new PMREMGenerator(gl);texture=generator.fromScene(room,.04).texture;
  room.dispose();generator.dispose();studios.set(gl,texture);return texture;
}
