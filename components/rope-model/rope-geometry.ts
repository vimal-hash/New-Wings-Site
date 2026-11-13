import {BufferAttribute,BufferGeometry,InstancedBufferGeometry,InstancedInterleavedBuffer,InterleavedBufferAttribute} from "three";

/** [first point, point count, x low, x high, y low, y high, z low, z high], one per stretch of a rope along the tunnel. */
export type RopeChunk=[number,number,number,number,number,number,number,number];

// One small quad is drawn per thread segment. Each reads four points in a row from the exported file, so nothing is copied or thinned. A rope's stretches share one set of GPU buffers and only start at different points.
export function threadGeometries(source:BufferGeometry,chunks:RopeChunk[]){
  const position=source.getAttribute("position") as unknown as InterleavedBufferAttribute;
  // Each end has three corners, so the middle of the quad can stand up towards the camera like the round thread it stands for.
  const corners=new BufferAttribute(new Float32Array([0,-1,0,0,0,0,0,1,0,1,-1,0,1,0,0,1,1,0]),3);
  const cornerOrder=new BufferAttribute(new Uint16Array([0,1,3,3,1,4,1,2,4,4,2,5]),1);
  const points=new InstancedInterleavedBuffer(position.data.array,4,1);
  const shared=(attribute:BufferAttribute)=>new InstancedInterleavedBuffer(attribute.array,attribute.itemSize,1);
  const place=shared(source.getAttribute("_rope_t") as BufferAttribute),glow=shared(source.getAttribute("_rope_g") as BufferAttribute),lit=shared(source.getAttribute("_rope_l") as BufferAttribute),extra=shared(source.getAttribute("_rope_x") as BufferAttribute);
  return chunks.map(([first,count])=>{
    const geometry=new InstancedBufferGeometry();
    geometry.setIndex(cornerOrder);
    geometry.setAttribute("position",corners);
    ["aP0","aP1","aP2","aP3"].forEach((name,i)=>geometry.setAttribute(name,new InterleavedBufferAttribute(points,4,(first+i)*4,true)));
    // Both ends of a segment, from the same point data.
    const ends=(names:[string,string],buffer:InstancedInterleavedBuffer)=>{
      names.forEach((name,i)=>geometry.setAttribute(name,new InterleavedBufferAttribute(buffer,buffer.stride,(first+i+1)*buffer.stride,true)));
    };
    ends(["aT1","aT2"],place);
    ends(["aG1","aG2"],glow);
    ends(["aL1","aL2"],lit);
    ends(["aX1","aX2"],extra);
    geometry.instanceCount=Math.min(first+count,position.count-3)-first;
    return geometry;
  });
}
