/** Screen → blueprint → completed white lines → materials → camera. Seconds of visible playback. */
export const THEATRE_OPENING = { screen: 1, blueEnd: 2.8, whiteEnd: 3.4, materialStart: 4.15, materialEnd: 5.75, moveStart: 6.05, end: 8.55 };
export const OPENING_CAMERA_START: [number, number, number] = [.010995, 3.24, 8.3];
export const OPENING_CAMERA_END: [number, number, number] = [.010995, 4.2, 2.2];
const unit = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t = unit(v); return t*t*t*(t*(t*6-15)+10); };
export function theatreOpeningShot(time: number) {
  const t = THEATRE_OPENING;
  const trace = unit((time-t.screen)/(t.blueEnd-t.screen));
  const white = ease((time-t.blueEnd)/(t.whiteEnd-t.blueEnd));
  const room = ease((time-t.materialStart)/(t.materialEnd-t.materialStart));
  const progress = unit((time-t.moveStart)/(t.end-t.moveStart));
  const stage = time<t.screen?'screen':time<t.blueEnd?'blueprint':time<t.whiteEnd?'turning-white':time<t.materialStart?'white-outline':time<t.materialEnd?'materials':time<t.moveStart?'room':progress<1?'pullback':'complete';
  return { stage, trace, white, room, progress, position: ease(progress), lineOpacity: 1-ease((room-.18)/.65), done: progress===1 };
}
export function createTheatreOpeningClock() {
  let elapsed = 0, geometryWasReady = false, roomWasReady = false;
  return {
    tick(delta: number, geometryReady: boolean, roomReady: boolean, reduced = false) {
      // Never charge a blocking preparation frame to a newly released gate.
      const released = (geometryReady&&!geometryWasReady)||(roomReady&&!roomWasReady);
      geometryWasReady=geometryReady; roomWasReady=roomReady;
      if (reduced && roomReady && geometryReady) elapsed=THEATRE_OPENING.end;
      else if (!released) elapsed+=Math.max(0,delta);
      if (!geometryReady) elapsed=Math.min(elapsed,THEATRE_OPENING.screen);
      if (!roomReady) elapsed=Math.min(elapsed,THEATRE_OPENING.materialStart);
      elapsed=Math.min(elapsed,THEATRE_OPENING.end);
      return { ...theatreOpeningShot(elapsed), elapsed };
    },
  };
}

/** Local, opt-in stationary QA marks; normal URLs never use these. */
export function openingReviewTime(search:string,host:string) {
  if(!/^(localhost|127\.)/.test(host))return undefined;
  const params=new URLSearchParams(search);
  if(!params.has('diagnostics'))return undefined;
  const marks:Record<string,number>={screen:.35,blueprint:2.25,white:3.8,materials:5.05,room:5.95,end:8.55};
  return marks[params.get('opening-stage')??''];
}

/** Mutable uniforms, shared by theatre materials only. No frame-by-frame React updates. */
export const theatreOpening = {
  active: { value: 0 }, room: { value: 1 }, trace: { value: 0 }, white: { value: 0 }, lineOpacity: { value: 0 },
  house: { value: 1 }, glasses: { value: 0 },
  geometryReady: false, stage: 'screen', elapsed: 0,
};
