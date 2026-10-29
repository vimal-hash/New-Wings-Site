import { Color, ShaderMaterial, Vector3 } from "three";

/** One closed mesh, three shapes; no texture, framebuffer capture or fluid simulation. */
const vertexShader = /* glsl */ `
uniform float uMorph;
uniform float uFlat;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorldNormal;

vec3 surface(vec3 c) {
  vec3 n=normalize(c);
  // One curved current echoes the theatre's crescents; its small wakes travel
  // with the flow instead of making the whole object pulse like a soft toy.
  float seam=n.y+.30*n.x+.20*cos(n.z*2.5-uTime*.35);
  float current=exp(-seam*seam/ .0361)*(.4+.6*smoothstep(-.6,.6,n.z));
  float swell=sin(n.y*3.1+n.x*1.7+uTime*.52+sin(n.z*2.-uTime*.19));
  float wake=sin(seam*13.-uTime*1.15+n.z*2.)*.0035
    +sin(n.x*5.+n.z*4.-uTime*.83)*.0015;
  float radius=.89+.019*swell-.055*current+wake;
  vec3 pearl=n*radius*vec3(.985,1.025,1.);
  float twist=.15*sin(n.y*2.6+uTime*.29);
  pearl.xz=mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*pearl.xz;
  // The wave travels diagonally through the silhouette as its corners unfurl.
  float delay=.10*(n.x-n.y);
  float m=smoothstep(0.,1.,clamp(uMorph*1.4-.2-delay,0.,1.));
  vec3 q=c*vec3(1.,.6666667,.108);
  vec3 core=clamp(q,-vec3(.91,.5766667,.018),vec3(.91,.5766667,.018));
  vec3 rounded=core+normalize(q-core)*.09;
  vec3 sheet=vec3(c.x,c.y/1.5,c.z*.0005);
  vec3 page=mix(rounded,sheet,uFlat);
  vec3 p=mix(pearl,page,m);
  float ripple=sin((c.x+c.y)*7.5-uMorph*10.)*.045*sin(uMorph*3.14159265);
  p.z+=ripple*(1.-uFlat);
  return p;
}
void main(){
  vec3 p=surface(position);
  vec3 axis=abs(normal.y)>.9?vec3(0.,0.,1.):vec3(0.,1.,0.);
  vec3 tangent=normalize(cross(axis,normal));
  vec3 bitangent=cross(normal,tangent);
  vec3 a=surface(position+tangent*.002)-p;
  vec3 b=surface(position+bitangent*.002)-p;
  vec3 localNormal=normalize(cross(a,b));
  vNormal=normalize(normalMatrix*localNormal);
  vWorldNormal=normalize(mat3(modelMatrix)*localNormal);
  vec4 view=modelViewMatrix*vec4(p,1.);
  vView=-view.xyz;
  gl_Position=projectionMatrix*view;
}`;

const fragmentShader = /* glsl */ `
uniform float uFlat;
uniform float uOpacity;
uniform vec3 uPage;
uniform vec3 uLightDirection;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorldNormal;

void main(){
  vec3 N=normalize(vNormal),V=normalize(vView);
  vec3 W=normalize(vWorldNormal);
  float facing=max(dot(N,V),0.);
  // Broad, diffuse illumination stays anchored in the corridor as the body
  // rotates: warm slots to one side, a charcoal ceiling and a dark slate floor.
  // No chrome ribbons, bright clearcoat or view-locked studio reflections.
  float light=smoothstep(-.65,.95,dot(W,normalize(uLightDirection)));
  float ceiling=smoothstep(-.2,1.,W.y);
  float floor=smoothstep(.05,.95,-W.y);
  vec3 shadow=vec3(.065,.073,.078);
  vec3 ivory=vec3(.53,.515,.477);
  vec3 colour=mix(shadow,ivory,light);
  colour+=vec3(.026,.032,.036)*ceiling;
  colour*=1.-floor*.18;
  // A soft grazing lift keeps the silhouette legible without a glossy rim.
  colour+=vec3(.030,.031,.030)*pow(1.-facing,2.)*(.3+.7*light);
  // Finish as the exact HTML background, so the final handoff has no white flash.
  colour=mix(colour,uPage,smoothstep(.05,.96,uFlat));
  gl_FragColor=vec4(colour,uOpacity);
  #include <colorspace_fragment>
}`;

export function createLiquidPageMaterial(pageColour="white") {
  return new ShaderMaterial({
    name:"Liquid pearl → page",
    uniforms:{uMorph:{value:0},uFlat:{value:0},uTime:{value:0},uOpacity:{value:0},uPage:{value:new Color(pageColour)},uLightDirection:{value:new Vector3(-.6,.8,.3).normalize()}},
    vertexShader,fragmentShader,transparent:true,depthWrite:true,toneMapped:false,
  });
}
