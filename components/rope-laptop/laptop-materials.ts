import {ShaderMaterial,Vector2,Vector3,Vector4,type Texture} from "three";
import {FLOW,greenTunnelMaterial,WHITE,WHITE_STORED,type RopeLook} from "../rope-model/rope-materials";
import {corePushGlsl,flightHueGlsl,GREEN,JOIN,joinFadeGlsl,joinHueGlsl} from "../rope-model/rope-flight";
import {BLUE_SIDE,BLUE_FACE,bluePaletteGlsl} from "../rope-model/rope-blue";
import {yellowCoreGlsl,yellowFaceGlsl,yellowLightGlsl,yellowPaletteGlsl,yellowSideGlsl,yellowThroughGlsl,yellowWhiteGlsl} from "../rope-model/rope-yellow";

export const SPREAD_SLOTS=19;
const VALUE_GAIN=1.32; // far fewer threads than the desktop file, so each carries a little more of the glow
const FLOW_GAIN=(1-FLOW.rest)*(FLOW.tail+1)/FLOW.share;
const glslVec3=(c:[number,number,number])=>`vec3(${c.map(v=>v.toFixed(6)).join(",")})`;
function amberGlsl(stops:RopeLook["amber"]){
  const [a,b,c]=stops;
  return `vec3 amberRamp(float x){return x<${b[0].toFixed(6)}?mix(${glslVec3(a[1])},${glslVec3(b[1])},max(x-${a[0].toFixed(6)},0.)/${(b[0]-a[0]).toFixed(6)}):mix(${glslVec3(b[1])},${glslVec3(c[1])},min((x-${b[0].toFixed(6)})/${(c[0]-b[0]).toFixed(6)},1.));}`;
}

type Numbers={grain:Texture;grainGain:number;grainMean:number;encode:string;grid:number;zMiddle:number;radiusScale:number;uvU:[number,number];hot:[number,number];look:RopeLook;flight?:boolean;blue?:Texture;yellow?:Texture};

/** The desktop thread's look, worked out once per corner instead of once per pixel, with the light pulse and the white still per pixel. No texture reads. */
export function laptopThreadMaterial({grain,grainGain,grainMean,encode,grid,zMiddle,radiusScale,uvU,hot,look,flight=false,blue,yellow}:Numbers){
  flight=flight&&!blue;
  return new ShaderMaterial({
    uniforms:{
      uResolution:{value:new Vector2(1,1)},uThinPx:{value:1},uScale:{value:new Vector3(grid*32767,grid*32767,grid*2*32767)},uZMiddle:{value:zMiddle},uRadiusScale:{value:radiusScale},
      uTileU:{value:new Vector2(...uvU)},uHot:{value:new Vector2(...hot)},uStrengthPeak:{value:look.strength_peak},uLitPeak:{value:look.lit_peak},uGrainMean:{value:grainMean},
      uShine:{value:1},uWhiteShine:{value:1},uWhiteStored:{value:WHITE_STORED.share},uFlowClock:{value:0},uFlowRest:{value:1},uFlowGain:{value:0},uGrain:{value:grain},uGrainGain:{value:grainGain},
      uSpreads:{value:Array.from({length:SPREAD_SLOTS},()=>new Vector4())},uAmounts:{value:new Float32Array(SPREAD_SLOTS)},uAnyWhite:{value:0},
      ...(blue?{uBluePalette:{value:blue},uBluePaletteWidth:{value:(blue.image as {width:number}).width}}:{}),
      ...(yellow?{uYellowPalette:{value:yellow},uYellowPaletteWidth:{value:(yellow.image as {width:number}).width}}:{}),
      ...(flight?{uRed:{value:1},uJoined:{value:1},uDim:{value:1},uWide:{value:1},uPlace:{value:new Vector4(1,0,0,1)},uFadeAt:{value:JOIN.redEnd},uFadeWay:{value:1}}:{}),
    },
    vertexShader:/* glsl */`
      attribute vec4 aP,aT,aG,aL,aM,aE;
      attribute vec2 aF;
      uniform vec2 uResolution,uTileU,uHot;
      uniform vec3 uScale;
      uniform float uThinPx,uZMiddle,uRadiusScale,uStrengthPeak,uLitPeak,uShine,uFlowClock,uAnyWhite;
      uniform vec4 uSpreads[${SPREAD_SLOTS}];
      uniform float uAmounts[${SPREAD_SLOTS}];
      varying vec3 vRampSide,vRampFront,vThrough;
      varying float vHead,vShare,vAcross,vWide,vFront,vWhiteAmount,vValue,vDim,vAmber,vSideOn;
      varying vec2 vTile,vLit,vEnds;
      // Close enough to the exact curves, without a pow on every corner of every thread.
      vec3 linear(vec3 c){return c*(c*(c*.305306+.682171)+.012523);}
      ${blue?bluePaletteGlsl:""}
      ${yellow?yellowPaletteGlsl+yellowLightGlsl+yellowThroughGlsl:""}
      ${amberGlsl(look.amber)}
      ${flight?`uniform float uWide;uniform vec4 uPlace;varying vec3 vLitFlight;varying float vFade;${flightHueGlsl}${joinFadeGlsl}${joinHueGlsl}`:""}
      void main(){
        vec3 world=vec3(aP.xy*uScale.xy,aP.z*uScale.z+uZMiddle);
        ${blue?"world=(modelMatrix*vec4(world,1.)).xyz;":""}
        ${flight?"world=vec3(uPlace.x*world.x-uPlace.y*world.y,uPlace.y*world.x+uPlace.x*world.y,world.z*uPlace.w+uPlace.z);vRed=joinRed(world.z);":""}
        vec3 p=(viewMatrix*vec4(world,1.)).xyz;
        vec3 toCamera=normalize(-p),tangent=aT.xyz;
        ${blue?"tangent=mat3(modelMatrix)*tangent;":""}
        ${flight?"tangent.xy=vec2(uPlace.x*tangent.x-uPlace.y*tangent.y,uPlace.y*tangent.x+uPlace.x*tangent.y)/uPlace.w;":""}
        float along=dot(toCamera,tangent),sideOn=max(1.-along*along,0.); // squared
        vec3 side=cross(tangent,toCamera);
        side/=max(length(side),1e-4);
        float perWorld=projectionMatrix[1][1]*uResolution.y*.5/max(-p.z,.05);
        float radius=aT.w*aT.w*uRadiusScale;
        // Far fewer threads than the desktop file, so a thin one stands in for its missing neighbours by being a little wider. Wide ones keep their real size.
        float widthPx=max(2.*radius*perWorld*aL.a,uThinPx*max(aL.a,.55));
        ${flight?"vFade=joinFade(world.z,aE.a);":""}
        p+=side*aP.w*widthPx*.5/perWorld${flight?"*uWide*sqrt(vFade)":""};
        vAcross=aP.w;
        vWide=clamp((widthPx-1.5)/2.,0.,1.);

        float random=aE.a;
        // The glow's sharp rise is worked out per pixel, with the grain inside it, as on the desktop page: that is what makes the bright glints.
        vValue=aG.a*aG.a*uStrengthPeak*${VALUE_GAIN.toFixed(3)};
        vSideOn=sideOn*(1.2-.2*sideOn); // the side-on share to the power 1.7
        vDim=(random*1.3+.35)*.006;
        vAmber=aE.g;
        vec3 ramp=linear(aG.rgb);
        ${blue?"ramp=blueRamp(ramp);":""}
        ${flight?yellow?"ramp=mix(yellowRamp(ramp),vec3(2.*ramp.g,ramp.r,2.5*ramp.b),vRed);":"ramp=flightHue(ramp,vRed);":""}
        vec3 amberColour=amberRamp(mix(uHot.x,uHot.y,aE.b));
        vRampSide=mix(ramp*${flight?yellow?yellowSideGlsl:"mix(vec3(.22,.72,.32),vec3(.72,.11,.128),vRed)":blue?glslVec3(BLUE_SIDE):"vec3(.72,.11,.128)"},amberColour,vAmber)*uShine;
        vRampFront=mix(mix(ramp,${flight?yellow?yellowFaceGlsl:"mix(vec3(1.,.86,.34),vec3(1.,.43,.136),vRed)":blue?glslVec3(BLUE_FACE):"vec3(1.,.43,.136)"},.18),amberColour,vAmber)*uShine;
        float litLinear=aL.r*(aL.r*(aL.r*.305306+.682171)+.012523);
        vLit=vec2(litLinear,litLinear*aE.r)*uLitPeak;
        vec3 through=vec3(aM.z,aL.gb);
        vThrough=through*through;
        ${blue?"vThrough=vThrough.gbr;":""}
        ${flight?yellow?"vThrough=mix(yellowThrough(vThrough),vThrough.grb,vRed);vLitFlight=flightLight(vec3(vLit,0.),vRed);":"vThrough=mix(vThrough.grb,vThrough,vRed);vLitFlight=flightHue(vec3(vLit,0.),vRed);":""}
        vEnds=aF*4.;

        float tile=mix(uTileU.x,uTileU.y,(aM.x*65280.+aM.y*255.)/65535.);
        vTile=vec2(tile,random);
        vHead=uFlowClock-tile/${FLOW.spacing.toFixed(3)}+fract(random*37.);
        vShare=step(fract(random*113.),${FLOW.share.toFixed(3)});

        gl_Position=projectionMatrix*vec4(p,1.);
        vWhiteAmount=0.;vFront=0.;
        if(uAnyWhite>0.){
          int rope=int(aM.w*255.+.5);
          float amount=uAmounts[rope];
          if(amount>0.){
            vec4 spread=uSpreads[rope];
            vFront=spread.w-length(p-spread.xyz)-(random-.5)*${WHITE.jitter.toFixed(3)};
            vWhiteAmount=amount;
            if(vFront>-1.){
              float depth=-p.z-min(${WHITE.lift.toFixed(3)},-p.z*.5);
              gl_Position.z=(projectionMatrix[3][2]/depth-projectionMatrix[2][2])*gl_Position.w;
            }
          }
        }
      }`,
    fragmentShader:/* glsl */`
      uniform sampler2D uGrain;
      uniform float uFlowRest,uFlowGain,uWhiteShine,uWhiteStored,uGrainGain,uGrainMean;
      varying vec3 vRampSide,vRampFront,vThrough;
      varying float vHead,vShare,vAcross,vWide,vFront,vWhiteAmount,vValue,vDim,vAmber,vSideOn;
      varying vec2 vTile,vLit,vEnds;
      ${flight?"uniform float uDim;varying vec3 vLitFlight;varying float vFade,vRed;":""}
      vec3 glowAt(float view,float grain){
        float value=vValue*grain*(view+.07);
        return mix(vRampSide,vRampFront,view)*max(value*clamp((value-.054)/1.026,0.,1.)+vDim*grain,vAmber*.25);
      }
      void main(){
        float head=fract(vHead),rest=1.-head;
        float pulse=vShare*smoothstep(0.,.03,head)*rest*rest*rest;
        float grain=texture2D(uGrain,vTile).r*uGrainGain;
        // Two places across the round thread, for the price of a little arithmetic. A thin thread averages its whole width; a wide one is read where the pixel really is.
        float across=vAcross*vAcross,round=max(1.-across,0.);
        vec3 glow=(glowAt(mix(.947,round,vWide)*vSideOn,grain)+glowAt(mix(.494,round,vWide)*vSideOn,grain))*.5;
        vec3 through=mix(vThrough,vec3(1.),smoothstep(.15,.4,${flight?"max(glow.r,glow.g)":blue?"glow.b":"glow.r"}));
        vec3 colour=(${flight?"vLitFlight":blue?"vec3(.3*vLit.g,.1*vLit.r+.7*vLit.g,vLit.r)":"vec3(vLit,0.)"}*grain/uGrainMean+glow*(uFlowRest+uFlowGain*pulse))*through;
        // Each piece of thread fades out towards its ends.
        float ends=min(min(vEnds.x,vEnds.y),1.);
        colour*=ends*(2.-ends);
        float white=0.;
        if(vWhiteAmount>0.){
          white=vWhiteAmount*smoothstep(0.,${WHITE.edge.toFixed(3)},vFront);
          float burn=1.+${WHITE.head.toFixed(3)}*smoothstep(${WHITE.band.toFixed(3)},0.,vFront);
          colour=mix(colour,${flight?yellow?yellowWhiteGlsl:`mix(vec3(${WHITE_STORED.green.toFixed(3)},1.,${WHITE_STORED.blue.toFixed(3)}),vec3(1.,${WHITE_STORED.green.toFixed(3)},${WHITE_STORED.blue.toFixed(3)}),vRed)`:blue?`vec3(${WHITE_STORED.blue.toFixed(3)},${WHITE_STORED.green.toFixed(3)},1.)`:`vec3(1.,${WHITE_STORED.green.toFixed(3)},${WHITE_STORED.blue.toFixed(3)})`}*uWhiteStored*(.69*vSideOn+.12)*${WHITE.peak.toFixed(3)}*uWhiteShine*burn*(.8+pulse)*grain/uGrainMean,white);
        }
        ${flight?"colour*=uDim*vFade*(2.-vFade);":""}
        gl_FragColor=vec4(${encode},1.-white);
      }`,
  });
}

export function laptopCoreMaterial(look:RopeLook,grid:number,encode:string,flight=false,placed=false,yellow=false){
  return new ShaderMaterial({
    uniforms:{uColor:{value:new Vector3(...look.core_color)},uLightPeak:{value:look.light_peak},uScale:{value:grid*32767},...(flight?{uRed:{value:1},uJoined:{value:1},uDim:{value:1},uPlace:{value:new Vector4(1,0,0,1)},uPush:{value:1}}:{})},
    vertexShader:/* glsl */`
      attribute vec4 aC;
      uniform float uScale;
      varying vec3 vLight;
      ${flight?`uniform vec4 uPlace;${corePushGlsl}${joinHueGlsl}`:""}
      void main(){
        vLight=aC.rgb*aC.rgb;
        ${flight?"vec3 world=position*uScale;world=corePush(vec3(uPlace.x*world.x-uPlace.y*world.y,uPlace.y*world.x+uPlace.x*world.y,world.z*uPlace.w+uPlace.z));vRed=joinRed(world.z);":""}
        gl_Position=projectionMatrix*viewMatrix*${placed?"modelMatrix*":""}vec4(${flight?"world":"position*uScale"},1.);
      }`,
    fragmentShader:/* glsl */`
      uniform vec3 uColor;
      uniform float uLightPeak;
      varying vec3 vLight;
      ${flight?"uniform float uDim;varying float vRed;":""}
      void main(){vec3 colour=${flight?`${yellow?yellowCoreGlsl:`mix(vec3(${GREEN.core.join(",")}),uColor,vRed)`}*uDim`:"uColor"}*vLight*uLightPeak;gl_FragColor=vec4(${encode},1.);}`,
  });
}

// Turn and size together in the first two numbers, where the green goes along the line in the third, its size in the fourth.
const greenPlace=()=>new Vector4(Math.cos(GREEN.turn)*GREEN.scale,Math.sin(GREEN.turn)*GREEN.scale,GREEN.shift,GREEN.scale);

/** The same material for the green tunnel: its place, colour and blur are its own, and so is its white, as one list per rope. */
export function laptopGreenThreads(red:ShaderMaterial){
  return greenTunnelMaterial(red,{uPlace:{value:greenPlace()},uRadiusScale:{value:red.uniforms.uRadiusScale.value*GREEN.scale},uSpreads:{value:Array.from({length:SPREAD_SLOTS},()=>new Vector4())},uAmounts:{value:new Float32Array(SPREAD_SLOTS)},uAnyWhite:{value:0}});
}
export function laptopGreenCore(red:ShaderMaterial){
  return greenTunnelMaterial(red,{uPlace:{value:greenPlace()}});
}

/** A clock from 0 to 1 per spacing shows the light at that moment; null shows the still look. */
export function setLaptopFlow(material:ShaderMaterial,clock:number|null){
  material.uniforms.uFlowClock.value=clock??0;
  material.uniforms.uFlowRest.value=clock===null?1:FLOW.rest;
  material.uniforms.uFlowGain.value=clock===null?0:FLOW_GAIN;
}
