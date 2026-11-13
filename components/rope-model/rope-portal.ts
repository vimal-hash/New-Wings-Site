import {AddEquation,CustomBlending,OneFactor,OneMinusSrcAlphaFactor,ShaderMaterial,ZeroFactor,type Mesh} from "three";
import {GREEN} from "./rope-flight";

/**
 * What is left of the first section once its information has gone: a white opening at the far end of the green tunnel.
 * It is real depth in the scene, as wide as the tunnel is there, so threads pass in front of it and it stays fixed to the tunnel as the camera backs away. Its light is added afterwards, so the threads around it catch it.
 * A value of 0 alpha is how the picture is told "white, past the colour curves", the same as a hovered thread.
 */
export const PORTAL={
  z:-60.2, // .6 ahead of where the flight starts
  radius:3.05, // the green's threads begin about here at this depth
  edge:.26,
  fadeFrom:-23,fadeTo:-12, // world z of the camera: it has crossed the join (-24) and is in the red
  glow:.85,
};
// Undo green's uniform placement, rather than guessing another aperture size.
// This puts the opening among exactly the same source strands in blue.
const blueDepth=(z:number)=>(z-GREEN.shift)/GREEN.scale;
export const BLUE_PORTAL={...PORTAL,z:blueDepth(PORTAL.z),radius:PORTAL.radius/GREEN.scale,edge:PORTAL.edge/GREEN.scale,fadeFrom:blueDepth(PORTAL.fadeFrom),fadeTo:blueDepth(PORTAL.fadeTo)};

const smooth=(u:number)=>{const v=Math.min(Math.max(u,0),1);return v*v*(3-2*v);};
/** The same perspective-based closing in either tunnel, reversible with the camera. */
export const portalFade=(z:number,blue=false)=>{const portal=blue?BLUE_PORTAL:PORTAL;return 1-smooth((z-portal.fadeFrom)/(portal.fadeTo-portal.fadeFrom));};

export function portalMaterial(blue=false){
  const portal=blue?BLUE_PORTAL:PORTAL;
  return new ShaderMaterial({
    transparent:true,depthTest:true,depthWrite:false,
    blending:CustomBlending,blendEquation:AddEquation,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneMinusSrcAlphaFactor,
    uniforms:{uFade:{value:1},uClose:{value:1},uMelt:{value:0}},
    vertexShader:/* glsl */`
      varying vec2 vPlace;
      void main(){
        vPlace=position.xy*${(portal.radius+portal.edge).toFixed(3)};
        gl_Position=projectionMatrix*viewMatrix*vec4(vPlace,${portal.z.toFixed(3)},1.);
      }`,
    fragmentShader:/* glsl */`
      uniform float uFade,uClose,uMelt;
      varying vec2 vPlace;
      void main(){
        // It goes out by closing, so it stays white the whole way: a white disc that only dims reads as a grey coin.
        float there=smoothstep(${(portal.radius+portal.edge).toFixed(3)},${(portal.radius-portal.edge).toFixed(3)}*(1.-.7*uMelt),length(vPlace)/uClose)*uFade;
        // Only the mark in alpha, no brightness: light sent through the colour curves comes out cyan. The white and its light are made in the last step.
        gl_FragColor=vec4(vec3(0.),there);
      }`,
  });
}

/** GLSL for the last step of the picture, on finished display colour: the opening's light falling on what surrounds it. Nothing is added when its strength is 0. */
function portalGlowShader(blue=false,yellow=false){return /* glsl */`
  uniform vec3 uPortal; // radius on screen as a share of half the height, strength, width over height
  float portalInside(vec2 uv){return uPortal.x<=0.?0.:step(length((uv-.5)*2.*vec2(uPortal.z,1.)),uPortal.x*1.1);}
  // Half-covered white over dark reads as grey, so the soft edge is the tunnel's own green until it is nearly solid.
  vec3 portalTint(vec2 uv,float white){return portalInside(uv)>0.?mix(${yellow?"vec3(1.,.86,.25)":blue?"vec3(.25,.45,1.)":"vec3(.25,1.,.45)"},vec3(1.),smoothstep(.15,.9,white)):vec3(1.);}
  vec3 portalGlow(vec3 shown,vec2 uv){
    if(uPortal.y<=0.)return shown;
    vec2 p=(uv-.5)*2.*vec2(uPortal.z,1.);
    float away=max(length(p)-uPortal.x,0.),near=exp(-away/(.3*uPortal.x+.02)),far=exp(-away/(.8*uPortal.x+.06));
    // Threads catch the light, so they brighten first. Only close to the opening does the air itself turn white. Nothing grey lies over the dark.
    vec3 lit=shown*(1.+uPortal.y*2.1*far);
    lit+=(vec3(1.)-lit)*${yellow?"vec3(1.,.95,.72)":blue?"vec3(.72,.8,1.)":"vec3(.72,1.,.8)"}*uPortal.y*.13*far;
    float air=uPortal.y*(.95*near*near+.16*far*far);${blue?/* glsl */`
    // Blue's dark rope valleys must keep their structure under the white light.
    // Uniform air over these opaque tips made a flat lavender band. Retain the
    // soft halo, with its strongest white on the lit fibres, as in green.
    air*=.7+.3*smoothstep(.05,.8,max(shown.r,max(shown.g,shown.b)));
    `:""}
    lit+=(vec3(1.)-lit)*mix(${yellow?"vec3(1.,.86,.3)":blue?"vec3(.3,.5,1.)":"vec3(.3,1.,.5)"},vec3(1.),smoothstep(.4,.95,air))*air;
    // A long soft fall-off over dark colour would show steps, so the smallest amount of noise goes with it.
    float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
    return clamp(lit,0.,1.)+grain/255.*min(uPortal.y*far*4.,1.);
  }`;}
export const portalGlowGlsl=portalGlowShader();
export const bluePortalGlowGlsl=portalGlowShader(true);
export const yellowPortalGlowGlsl=portalGlowShader(false,true);

/** Once a frame. Keeps the opening and its light where the camera says. */
export function placePortal(material:ShaderMaterial,mesh:Mesh|null,setPortal:(radius:number,strength:number,aspect:number)=>void,z:number,up:number,aspect:number,blue=false){
  const portal=blue?BLUE_PORTAL:PORTAL;
  const fade=portalFade(z,blue),close=.03+.97*fade;
  material.uniforms.uFade.value=smooth(fade/.2);
  material.uniforms.uClose.value=close;
  material.uniforms.uMelt.value=1-fade;
  if(mesh)mesh.visible=fade>0;
  setPortal(fade>0?portal.radius*close/Math.max(z-portal.z,.01)/up:0,fade*fade*portal.glow,aspect);
}
