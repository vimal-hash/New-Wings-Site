import { Float32BufferAttribute, Quaternion, Vector3, type BufferGeometry } from "three";

/** The phone only shows the assembled projector. Apply the same final pose as
 * the animated shader once, retaining the source UVs and catalogue part IDs. */
export function bakeProjectorPose(geometry:BufferGeometry,poses:Float32Array,frameOffset:number){
  const part=geometry.getAttribute("_part"),position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
  const points=new Float32Array(position.count*3),normals=new Float32Array(normal.count*3);
  const hidden=new Uint8Array(position.count),rotation=new Quaternion(),vector=new Vector3(),translation=new Vector3();
  const safe=(scale:number)=>Math.abs(scale)>=.000001?scale:scale<0?-.000001:.000001;
  for(let i=0;i<position.count;i++){
    const offset=frameOffset+Math.round(part.getX(i))*12;
    const x=poses[offset+8],y=poses[offset+9],z=poses[offset+10];
    hidden[i]=poses[offset+3]<.5?1:0;
    rotation.set(poses[offset+4],poses[offset+5],poses[offset+6],poses[offset+7]).normalize();
    vector.set(position.getX(i)*x,position.getY(i)*y,position.getZ(i)*z).applyQuaternion(rotation);
    vector.add(translation.fromArray(poses,offset)).toArray(points,i*3);
    vector.set(normal.getX(i)/safe(x),normal.getY(i)/safe(y),normal.getZ(i)/safe(z)).applyQuaternion(rotation).normalize().toArray(normals,i*3);
  }
  geometry.setAttribute("position",new Float32BufferAttribute(points,3));
  geometry.setAttribute("normal",new Float32BufferAttribute(normals,3));
  return hidden;
}
