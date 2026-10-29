import fs from 'node:fs';
const p='components/corridor/scene.tsx';let s=fs.readFileSync(p,'utf8');s=s.replace('MathUtils, Matrix4, Mesh, Object3D, Plane, PerspectiveCamera','MathUtils, Matrix4, PerspectiveCamera');const a=s.indexOf('const CORRIDOR_START =');const b=s.indexOf('function Theatre',a);s=s.slice(0,a)+s.slice(b);
s=s.replace('position={connected && i === 0 ? [0, 1.6, 0] : [0, 0, 0]} ','');
const start=s.indexOf('  const connected = useMemo',s.indexOf('function Corridor('));const end=s.indexOf('  const invalidate =',start);s=s.slice(0,start)+'  const connected = useMemo(() => scene.clone(true), [scene]);\n'+s.slice(end);
s=s.replace(', localClippingEnabled: true','');fs.writeFileSync(p,s);
