import reference from "./reference-camera.json";

// The previous build's two runtime screens, translated with the theatre.
// No floor patches, lights, textures or additional imported models.
export default function CorridorScreens() {
  const offset=reference.stop[2]+14.2;
  return <>{[-1,1].map(side=><group key={side} name={side<0?"Left blank white screen":"Right blank white screen"}
    position={[reference.stop[0]+side*8.32,3.25+reference.stop[1]-3.22,-37.3+offset]} rotation={[0,-side*Math.PI/2,0]}>
    <mesh position={[0,0,-.07]}><boxGeometry args={[8.12,6.62,.12]}/><meshBasicMaterial color="#080808"/></mesh>
    <mesh><planeGeometry args={[8,6.5]}/><meshBasicMaterial color="white" toneMapped={false}/></mesh>
  </group>)}</>;
}
