import {Color,ShaderMaterial,Vector2,Vector3,Vector4,type Texture} from "three";
import type {RopeTuning} from "./rope-tuning";
import {corePushGlsl,flightHueGlsl,GREEN,JOIN,joinFadeGlsl,joinHueGlsl} from "./rope-flight";
import {BLUE_FACE,BLUE_SIDE,bluePaletteGlsl} from "./rope-blue";
import {YELLOW_DESKTOP_GAIN,yellowCoreGlsl,yellowFaceGlsl,yellowLightGlsl,yellowPaletteGlsl,yellowSideGlsl,yellowThroughGlsl,yellowWhiteGlsl} from "./rope-yellow";

export type RopeLook={exposure:number;world:[number,number,number];lit_peak:number;strength_peak:number;light_peak:number;height_mean:number;cavity_mean:number;core_color:[number,number,number];amber:[number,[number,number,number]][];grade:[number,number][][]};
export type RopeMaps={grain:Texture};
export type RopeRanges={uv_u:[number,number];uv_v:[number,number];rope_hot:[number,number];rope_side:[number,number]};

const glslVec3=(c:[number,number,number])=>`vec3(${c.map(v=>v.toFixed(6)).join(",")})`;

/** Light running along the threads. Distances are in the threads' own length coordinate: one unit is about 7 world units, and it grows towards the far end of the tunnel. */
export const FLOW={speed:.35,spacing:1.6,tail:3,rest:.25,share:.8};
// Rest plus the pulse's average over time comes to exactly 1, so over time the glow still averages the look matched to Blender.
const FLOW_GAIN=(1-FLOW.rest)*(FLOW.tail+1)/FLOW.share;
/** The white on a hovered rope. Each thread's front runs a little ahead or behind (jitter), softens over edge, and burns brighter in a band just behind the front (head). */
/** Gloss: tight highlights along the threads, lit from far ahead and to one side, so only some threads catch it, in bands, as real shiny fibres do, and the bands move as the camera flies. Not in the Blender file. How tight, and how bright at 1, were set by eye. */
const GLOSS={tightness:300,red:.4,white:.4,light:[.35,.45,-.82]};
export const WHITE={peak:.62,floor:.12,jitter:.5,edge:.25,band:.8,head:1.2,lift:.15};
/** White threads are stored dimmer and warm, so the glow around them stays in the tunnel's red. The final step turns them back into pure white from their red value. */
export const WHITE_STORED={share:.45,green:.3,blue:.1};

// The file's AMBER_RAMP, with its own stops.
function amberGlsl(stops:RopeLook["amber"]){
  const [a,b,c]=stops;
  return `vec3 amberRamp(float x){return x<${b[0].toFixed(6)}?mix(${glslVec3(a[1])},${glslVec3(b[1])},max(x-${a[0].toFixed(6)},0.)/${(b[0]-a[0]).toFixed(6)}):mix(${glslVec3(b[1])},${glslVec3(c[1])},min((x-${b[0].toFixed(6)})/${(c[0]-b[0]).toFixed(6)},1.));}`;
}

export function threadMaterial(radiusScale:number,ranges:RopeRanges,look:RopeLook,maps:RopeMaps,flight=false,blue?:Texture,yellow?:Texture){
  flight=flight&&!blue;
  const grainMean=(look.height_mean*1.6+.2)*look.cavity_mean*look.cavity_mean;
  return new ShaderMaterial({
    uniforms:{
      uResolution:{value:new Vector2(1,1)},uRadiusScale:{value:radiusScale},uMinPx:{value:1},
      uTileU:{value:new Vector2(...ranges.uv_u)},uTileV:{value:new Vector2(...ranges.uv_v)},uHot:{value:new Vector2(...ranges.rope_hot)},uSide:{value:new Vector2(...ranges.rope_side)},
      uTile:{value:maps.grain},uStrengthPeak:{value:look.strength_peak},uLitPeak:{value:look.lit_peak},uGrainMean:{value:grainMean},
      uFlowClock:{value:0},uFlowRest:{value:1},uFlowGain:{value:0},
      uSpread:{value:new Vector4()},uSpreadAmount:{value:0},
      uShine:{value:1},uGloss:{value:0},uWhiteShine:{value:1},uWhiteGloss:{value:0},uWhiteStored:{value:WHITE_STORED.share},
      ...(blue?{uBluePalette:{value:blue},uBluePaletteWidth:{value:(blue.image as {width:number}).width}}:{}),
      ...(yellow?{uYellowPalette:{value:yellow},uYellowPaletteWidth:{value:(yellow.image as {width:number}).width}}:{}),
      ...(flight?{uRed:{value:1},uJoined:{value:1},uDim:{value:1},uWide:{value:1},uFadeAt:{value:JOIN.redEnd},uFadeWay:{value:1}}:{}),
    },
    vertexShader:/* glsl */`
      attribute vec4 aP0,aP1,aP2,aP3,aT1,aT2,aG1,aG2,aL1,aL2,aX1,aX2;
      uniform vec2 uResolution,uTileU,uTileV,uHot,uSide;
      uniform float uRadiusScale,uMinPx,uSpreadAmount;
      uniform vec4 uSpread;
      varying float vAcross,vRandom,vHot,vSide,vStrength;
      varying vec2 vTile,vThrough;
      varying vec3 vView,vTangent,vRamp,vLit;
      vec3 linear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
      ${blue?bluePaletteGlsl:""}
      ${yellow?"varying vec3 vYellowRamp;"+yellowPaletteGlsl:""}
      ${flight?`uniform float uWide;varying float vFade;${joinFadeGlsl}${joinHueGlsl}`:""}
      void main(){
        if(aP1.w>.5){gl_Position=vec4(2.,2.,2.,1.);return;}
        vec3 p1=(modelViewMatrix*vec4(aP1.xyz,1.)).xyz;
        vec3 p2=(modelViewMatrix*vec4(aP2.xyz,1.)).xyz;
        vec3 before=p2-(aP0.w>.5?p1:(modelViewMatrix*vec4(aP0.xyz,1.)).xyz);
        vec3 after=(aP2.w>.5?p2:(modelViewMatrix*vec4(aP3.xyz,1.)).xyz)-p1;
        vec3 tangent=normalize(position.x<.5?before:after);
        vec3 p=mix(p1,p2,position.x);
        vec3 side=normalize(cross(tangent,normalize(-p)));
        vec4 place=mix(aT1,aT2,position.x);
        float radius=place.z*uRadiusScale;
        float perWorld=projectionMatrix[1][1]*uResolution.y*.5/max(-p.z,.05);
        // Thin or see-through threads cover less of each pixel by being truly narrower: the 8 edge samples then give the same soft result, and the graphics card can still skip whatever is hidden.
        vec4 glow=mix(aG1,aG2,position.x),extra=mix(aX1,aX2,position.x);
        ${flight?"float worldZ=(modelMatrix*vec4(mix(aP1.xyz,aP2.xyz,position.x),1.)).z;vFade=joinFade(worldZ,aT1.w);vRed=joinRed(worldZ);":""}
        float halfWidth=max(2.*radius*perWorld,uMinPx*.5)*mix(aL1.a,aL2.a,position.x)*.5/perWorld${flight?"*uWide*sqrt(vFade)":""};
        p+=side*position.y*halfWidth;
        vAcross=position.y;
        vView=p;
        vTangent=tangent;
        // Every baked value comes from the thread's own points, so neighbouring threads never mix.
        vRamp=mix(${blue?"blueRamp(linear(aG1.rgb)),blueRamp(linear(aG2.rgb))":"linear(aG1.rgb),linear(aG2.rgb)"},position.x);
        ${yellow?"vYellowRamp=mix(yellowRamp(linear(aG1.rgb)),yellowRamp(linear(aG2.rgb)),position.x);":""}
        vStrength=glow.a;
        vLit=mix(linear(aL1.rgb),linear(aL2.rgb),position.x);
        ${blue?"vLit=blueLight(vLit);":""}
        vThrough=extra.xy;
        vHot=mix(uHot.x,uHot.y,extra.z);
        vSide=mix(uSide.x,uSide.y,extra.w);
        vRandom=aT1.w;
        vTile=vec2(mix(uTileU.x,uTileU.y,place.x),mix(uTileV.x,uTileV.y,place.y));
        // Threads are round, so neighbours pass each other smoothly instead of swapping at every flat segment: the quad's middle stands up towards the camera.
        gl_Position=projectionMatrix*vec4(p+normalize(-p)*halfWidth*(1.-abs(position.y)),1.);
        // The short fuzz hairs have no rope of their own and stay dark, which would look like scratches on white. White threads are stored a little nearer, so they draw over the hairs. The same spot on screen; only the depth changes.
        if(uSpreadAmount>0.&&length(p-uSpread.xyz)<uSpread.w+1.){
          float depth=-p.z-min(${WHITE.lift.toFixed(3)},-p.z*.5);
          gl_Position.z=(projectionMatrix[3][2]/depth-projectionMatrix[2][2])*gl_Position.w;
        }
      }`,
    fragmentShader:/* glsl */`
      uniform sampler2D uTile;
      uniform float uStrengthPeak,uLitPeak,uGrainMean,uFlowClock,uFlowRest,uFlowGain,uSpreadAmount,uShine,uGloss,uWhiteShine,uWhiteGloss,uWhiteStored;
      uniform vec4 uSpread;
      varying float vAcross,vRandom,vHot,vSide,vStrength;
      varying vec2 vTile,vThrough;
      varying vec3 vView,vTangent,vRamp,vLit;
      ${amberGlsl(look.amber)}
      ${flight?`uniform float uDim;varying float vFade,vRed;${yellow?`varying vec3 vYellowRamp;${yellowLightGlsl}${yellowThroughGlsl}vec3 flightHue(vec3 c,float nearColour){return mix(vYellowRamp,vec3(2.*c.g,c.r,2.5*c.b),nearColour);}`:flightHueGlsl}`:""}
      void main(){
        // The file's two grain pictures, read where its own nodes read them. Sheets are stored top row first.
        float height=texture2D(uTile,vec2(3.*vTile.x,1.-vTile.y)).r;
        float cavity=texture2D(uTile,vec2(vTile.x,1.-(vTile.y+vAcross*.004))).g;
        float relief=height*1.6+.2;

        // The file's glow, line by line. Its view term is |I.N|^1.7 on a round thread: a thread seen end-on is dim, a thread seen side-on is bright.
        // A pixel covers a stretch of the round thread, so the formula is averaged across that stretch, as Blender's many samples do.
        vec3 toCamera=normalize(-vView),along=normalize(vTangent);
        float sideOn=length(toCamera-along*dot(toCamera,along));
        float amber=clamp((vHot-.05)/.35,0.,1.)*clamp(vSide/.35,0.,1.);
        vec3 amberColour=amberRamp(vHot),glow=vec3(0.);
        float seen=0.;
        ${flight?`vec3 ramp=flightHue(vRamp,vRed),tintSide=${yellow?yellowSideGlsl:"mix(vec3(0.22,0.72,0.32),vec3(.72,.11,.128),vRed)"},tintFace=${yellow?yellowFaceGlsl:"mix(vec3(1.,0.86,0.34),vec3(1.,.43,.136),vRed)"};`:""}
        float strengthBase=vStrength*vStrength*uStrengthPeak*relief*cavity,dim=relief*cavity*(vRandom*1.3+.35)*.006,footprint=fwidth(vAcross)*.5;
        // Only the part of the pixel that is on the thread counts. On a thread thinner than a pixel the samples stay on it and cover its whole width.
        float from=clamp(vAcross-footprint,-1.,1.),to=clamp(vAcross+footprint,-1.,1.);
        for(int i=0;i<4;i++){
          float a=mix(from,to,(float(i)+.5)*.25);
          float view=pow(sqrt(max(1.-a*a,0.))*sideOn,1.7);
          seen+=view;
          float value=strengthBase*(view+.07);
          float strength=max(value*clamp((value-.054)/1.026,0.,1.)+dim,amber*.25);
          glow+=mix(mix(${flight?"ramp*tintSide":blue?`vRamp*${glslVec3(BLUE_SIDE)}`:"vRamp*vec3(.72,.11,.128)"},mix(${flight?"ramp,tintFace":blue?`vRamp,${glslVec3(BLUE_FACE)}`:"vRamp,vec3(1.,.43,.136)"},.18),view),amberColour,amber)*strength;
        }
        glow*=.25${yellow?`*mix(${YELLOW_DESKTOP_GAIN.toFixed(6)},1.,vRed)`:""};

        // Lights and shadows are baked. They were baked with the grain at its average, so the fine grain goes back on top.
        vec3 lit=${flight?yellow?"flightLight(vLit,vRed)":"flightHue(vLit,vRed)":"vLit"}*uLitPeak*(relief*cavity*cavity/uGrainMean);
        // In the file, whatever is seen through a thread is tinted by it. Here a thread's gaps show what is behind untinted, so each thread carries the baked tint of the threads in front of it. Stored as square roots; blue follows green.
        vec2 filtered=vThrough*vThrough;
        // Green and blue fall away faster than red. How strong the tint is, and where the bright-thread rule below begins, were fitted against Blender's own pictures with glow.
        float red=max(filtered.r,1e-4);
        vec3 through=pow(min(red,1.),.7)*vec3(1.,pow(min(filtered.g/red,1.),4.5),pow(min((filtered.g+(filtered.r-filtered.g)*.069)/red,1.),3.));
        // A bright thread is a front thread with nothing tinting it.
        ${flight?yellow?"through=mix(yellowThrough(through),through.grb,vRed);":"through=mix(through.grb,through,vRed);":""}
        ${blue?"through=through.gbr;":""}
        through=mix(through,vec3(1.),smoothstep(.15,.4,${flight?"max(glow.r,glow.g)":blue?"glow.b":"glow.r"}));
        // One light per spacing, each thread on its own beat: a sharp head at the far side and a long tail behind it. Only some threads carry light. The picture's glow post processing reads this, so the bloom travels with the light.
        float head=fract(uFlowClock-vTile.x/${FLOW.spacing.toFixed(3)}+vRandom*37.);
        float pulse=step(fract(vRandom*113.),${FLOW.share.toFixed(3)})*smoothstep(0.,.03,head)*pow(1.-head,${FLOW.tail.toFixed(1)});
        vec3 colour=(lit+glow*(uFlowRest+uFlowGain*pulse)*uShine)*through;
        // The strongest highlight is where a thread lies across the line halfway between the camera and the light. Worked out only when gloss is on.
        float streak=0.;
        if(uGloss>0.||(uSpreadAmount>0.&&uWhiteGloss>0.)){
          vec3 halfway=normalize(toCamera+normalize(vec3(${GLOSS.light.map(v=>v.toFixed(3)).join(",")})));
          float lined=dot(along,halfway);
          streak=pow(max(1.-lined*lined,0.),${(GLOSS.tightness/2).toFixed(1)})*relief*cavity*cavity/uGrainMean;
          colour+=${flight?yellow?"mix(vec3(1.,.78,.03),vec3(.43,1.,.03),vRed)":"mix(vec3(.43,1.,.03),vec3(1.,.43,.03),vRed)":blue?"vec3(.03,.43,1.)":"vec3(1.,.43,.03)"}*${GLOSS.red.toFixed(3)}*uGloss*streak*through;
        }
        // The hovered rope. White keeps the thread's own roundness and grain, so it still reads as thread. Alpha tells the final step that this pixel is white and must not go through the red colour grade.
        float white=0.;
        if(uSpreadAmount>0.){
          float front=uSpread.w-length(vView-uSpread.xyz)-(vRandom-.5)*${WHITE.jitter.toFixed(3)};
          white=uSpreadAmount*smoothstep(0.,${WHITE.edge.toFixed(3)},front);
          float burn=1.+${WHITE.head.toFixed(3)}*smoothstep(${WHITE.band.toFixed(3)},0.,front);
          colour=mix(colour,${flight?yellow?yellowWhiteGlsl:`mix(vec3(${WHITE_STORED.green.toFixed(3)},1.,${WHITE_STORED.blue.toFixed(3)}),vec3(1.,${WHITE_STORED.green.toFixed(3)},${WHITE_STORED.blue.toFixed(3)}),vRed)`:blue?`vec3(${WHITE_STORED.blue.toFixed(3)},${WHITE_STORED.green.toFixed(3)},1.)`:`vec3(1.,${WHITE_STORED.green.toFixed(3)},${WHITE_STORED.blue.toFixed(3)})`}*uWhiteStored*((seen*.25+${WHITE.floor.toFixed(3)})*${WHITE.peak.toFixed(3)}*uWhiteShine*(relief*cavity*cavity/uGrainMean)*burn*(.8+pulse)+${GLOSS.white.toFixed(3)}*uWhiteGloss*streak),white);
        }
        gl_FragColor=vec4(colour${flight?"*uDim*vFade*(2.-vFade)":""},1.-white);
      }`,
  });
}

/** Empty space behind the threads during the flight: dark green through the opening at the join, dark red everywhere else, so green never shows through gaps in the red walls. Drawn last on the far plane, so it only costs the few pixels nothing else covered. */
export function farHoleMaterial(){
  return new ShaderMaterial({
    depthWrite:false,
    uniforms:{uInner:{value:new Color()},uOuter:{value:new Color()},uRadius:{value:1},uAspect:{value:1}},
    vertexShader:/* glsl */`
      uniform float uAspect;
      varying vec2 vPlace;
      void main(){vPlace=position.xy*vec2(uAspect,1.);gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader:/* glsl */`
      uniform vec3 uInner,uOuter;
      uniform float uRadius;
      varying vec2 vPlace;
      void main(){gl_FragColor=vec4(mix(uInner,uOuter,smoothstep(uRadius*.7,uRadius*1.4,length(vPlace))),1.);}`,
  });
}

/** The green tunnel's material: the red one's program and settings, so every control reaches both, with its own colour, blur, join and white. */
export function greenTunnelMaterial(red:ShaderMaterial,own:ShaderMaterial["uniforms"]={}){
  return new ShaderMaterial({vertexShader:red.vertexShader,fragmentShader:red.fragmentShader,uniforms:{...red.uniforms,uRed:{value:0},uDim:{value:1},uWide:{value:1},uFadeAt:{value:JOIN.greenStart},uFadeWay:{value:-1},uPush:{value:0},...own}});
}

export function setThreadView(material:ShaderMaterial,width:number,height:number,dpr:number){
  material.uniforms.uResolution.value.set(width,height);
  material.uniforms.uMinPx.value=dpr;
}

/** A clock from 0 to 1 per spacing shows the light at that moment; null shows the still look matched to Blender. */
export function setThreadFlow(material:ShaderMaterial,clock:number|null){
  material.uniforms.uFlowClock.value=clock??0;
  material.uniforms.uFlowRest.value=clock===null?1:FLOW.rest;
  material.uniforms.uFlowGain.value=clock===null?0:FLOW_GAIN;
}

/** White's stored level sets how much it feeds the glow post processing. Red's glow control scales all of that, so white's is divided by it to stay separate. */
export function whiteStored(tuning:RopeTuning){return WHITE_STORED.share*Math.max(tuning.white.glow,.01)/Math.max(tuning.red.glow,.05);}

export function setThreadTuning(material:ShaderMaterial,tuning:RopeTuning){
  material.uniforms.uShine.value=tuning.red.shine;
  material.uniforms.uGloss.value=tuning.red.gloss;
  material.uniforms.uWhiteShine.value=tuning.white.shine;
  material.uniforms.uWhiteGloss.value=tuning.white.gloss;
  material.uniforms.uWhiteStored.value=whiteStored(tuning);
}

export function coreMaterial(look:RopeLook,flight=false,yellow=false){
  return new ShaderMaterial({
    uniforms:{uColor:{value:new Vector3(...look.core_color)},uLightPeak:{value:look.light_peak},...(flight?{uRed:{value:1},uJoined:{value:1},uDim:{value:1},uPush:{value:1}}:{})},
    vertexShader:/* glsl */`
      attribute vec4 color;
      varying vec3 vLight;
      ${flight?corePushGlsl+joinHueGlsl:""}
      void main(){
        // Blender's sRGB curve undoes how the light was stored.
        vec3 c=color.rgb;
        vLight=mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));
        ${flight?"vec3 world=(modelMatrix*vec4(position,1.)).xyz;vRed=joinRed(world.z);gl_Position=projectionMatrix*viewMatrix*vec4(corePush(world),1.);":"gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);"}
      }`,
    fragmentShader:/* glsl */`
      uniform vec3 uColor;
      uniform float uLightPeak;
      varying vec3 vLight;
      ${flight?"uniform float uDim;varying float vRed;":""}
      void main(){gl_FragColor=vec4(${flight?`${yellow?yellowCoreGlsl:`mix(vec3(${GREEN.core.join(",")}),uColor,vRed)`}*uDim`:"uColor"}*vLight*uLightPeak,1.);}`,
  });
}
