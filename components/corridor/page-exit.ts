/** Four native viewport sections; fractional mobile scroll positions count as the bottom. */
export function pageAtBottom(scrollTop: number, scrollHeight: number, clientHeight: number) {
  return clientHeight > 0 && scrollHeight > clientHeight + 2 && scrollHeight - clientHeight - scrollTop <= 2;
}

const unit = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const t = unit(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const COVER_LEAD = 0.4;
/** The return to View 1 used to be a sub-second dash; this floor keeps it a slow glide. */
const RETURN_TRAVEL_MIN = 3.4;
/** Leaving Section 4 (the user, 2026-11-16): the section turns plain white over .3 s on screen. Just before the camera
 *  starts back (HANDOVER), the screen white hands over to a plain white panel fixed in the corridor at the liquid
 *  sphere's spot, which fills the view exactly at that moment (end-box.ts). The panel stays there; the camera moves away
 *  from it. Nothing on screen follows the camera. */
export const WHITE_SECONDS = 0.3,
  HANDOVER = COVER_LEAD;
/** One clock for the retreating section and the overlapping camera move. */
export function createPageReturn() {
  let elapsed = 0;
  const initial = { scale: 1, opacity: 1, copy: 1, white: 0, travel: 0, moving: true };
  let shot = initial;
  return {
    prepared: false,
    warming: false,
    reset() {
      elapsed = 0;
      shot = initial;
      this.prepared = false;
      this.warming = false;
    },
    read() {
      return shot;
    },
    tick(delta: number, authored: number, reduced = false) {
      const travelSeconds = Math.max(RETURN_TRAVEL_MIN, authored),
        total = COVER_LEAD + travelSeconds;
      elapsed = reduced ? total : Math.min(total, elapsed + Math.min(0.05, Math.max(0, delta)));
      const white = ease(elapsed / WHITE_SECONDS);
      const travel = elapsed === total ? 1 : unit((elapsed - COVER_LEAD) / travelSeconds);
      shot = {
        scale: 1,
        opacity: elapsed < HANDOVER ? 1 : 0,
        copy: 1 - white,
        white,
        travel,
        moving: travel < 1,
      };
      return shot;
    },
  };
}
export const pageReturn = createPageReturn();

/** Scrolling back from View 2 (the user, 2026-11-18): the return in reverse. After the turn back to the top of the slide
 *  the camera goes back down to the white panel with the climb's own duration and curve played backwards (travel 1 -> 0),
 *  so the panel fills the view again as it lands; then the screen white takes over and lifts off Section 4 in
 *  WHITE_SECONDS. */
export function createPageDescent() {
  let elapsed = 0;
  return {
    reset() {
      elapsed = 0;
    },
    tick(delta: number, authored: number, reduced = false) {
      const travelSeconds = Math.max(RETURN_TRAVEL_MIN, authored);
      elapsed = reduced ? travelSeconds : Math.min(travelSeconds, elapsed + Math.min(0.05, Math.max(0, delta)));
      const travel = elapsed >= travelSeconds ? 0 : 1 - elapsed / travelSeconds;
      return { travel, moving: travel > 0 };
    },
  };
}
