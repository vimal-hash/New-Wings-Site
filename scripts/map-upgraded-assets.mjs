import fs from 'node:fs';
import {Matrix4} from 'three';
const base='D:/CodexOutputs/Corridor_Optimization_20261018/';
const output='D:/CodexOutputs/Theatre_Optimization_20261017/Web_Export_20261019/upgraded-coordinate-map.json';
const p=JSON.parse(fs.readFileSync(base+'placement.json'));
// The first placement report predates the approved corridor recess. Always use
// the actual final parent matrix captured by export-correct-final-frame.py.
const current=JSON.parse(fs.readFileSync(output));
if(!current.actualFinalCorridorMatrix) throw Error('Capture the final Blender parent matrix before mapping.');
const mat=a=>new Matrix4().set(...a.flat());
const B=mat(p.to_site).multiply(mat(current.actualFinalCorridorMatrix).invert());
fs.writeFileSync(output,JSON.stringify({...current,blenderMatrix:B.toArray()},null,2));
