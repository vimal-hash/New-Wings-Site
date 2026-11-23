/** One scroll rule for the whole site (the user, 2026-11-18: "maintain same scroll speed on whole site").
 *
 *  The theatre, the corridor, the reel, the sections and their flights, the cards, View 2, the final eye and the white
 *  section after it all answer a scroll the same way: one gesture makes one step. A gesture must travel `step` pixels
 *  (one mouse-wheel click is 40-120 px on every common mouse and browser; a trackpad swipe is more), and whatever is
 *  left of it is used up, so its momentum can never make a second step. The next step needs a new gesture: `gap`
 *  milliseconds without scrolling, a scroll the other way, or a new touch. One key press is one step; holding the key
 *  is still one step. Every motion keeps its own authored duration. */
export const SCROLL = { step: 30, gap: 220 } as const;

export type Step = -1 | 0 | 1;

/** A wheel event's travel in CSS pixels, down positive: lines are 16 px, pages one page height. */
export function wheelPixels(event: WheelEvent, page?: number) {
  if (event.deltaMode === 2) return event.deltaY * (page ?? (typeof innerHeight === "number" ? innerHeight : 800));
  return event.deltaY * (event.deltaMode === 1 ? 16 : 1);
}

/** Which way a key steps: down/page down/space forwards, up/page up/shift-space back, anything else 0. */
export function keyDirection(event: KeyboardEvent): Step {
  if (event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey))
    return 1;
  if (event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey)) return -1;
  return 0;
}

/** The gesture rule as plain numbers, so it can be tested on its own. Times are in milliseconds. */
export function createScrollSteps() {
  let last = -Infinity,
    sum = 0,
    spent = false,
    touching = false;
  const restart = () => {
    sum = 0;
    spent = false;
  };
  return {
    /** One movement, down positive. Returns ±1 on the movement that completes the gesture's step, otherwise 0. */
    push(pixels: number, now: number): Step {
      if (!Number.isFinite(pixels)) return 0;
      if (!pixels) {
        // A sideways or empty event still belongs to the gesture it is part of.
        if (now - last < SCROLL.gap) last = now;
        return 0;
      }
      if ((!touching && now - last >= SCROLL.gap) || (sum !== 0 && Math.sign(pixels) !== Math.sign(sum)))
        restart();
      last = now;
      if (spent) return 0;
      sum += pixels;
      if (Math.abs(sum) < SCROLL.step) return 0;
      spent = true;
      return sum > 0 ? 1 : -1;
    },
    /** A finger touches the screen: a new gesture, however soon after the last. */
    touch(now: number) {
      touching = true;
      last = now;
      restart();
    },
    /** The finger lifts; the gesture ends with it. */
    release(now: number) {
      touching = false;
      last = now;
      spent = true;
    },
    /** One key press: a step of its own. Its auto-repeat while held makes no more steps. */
    key(direction: Step, repeat: boolean, now: number): Step {
      if (!direction) return 0;
      last = now;
      if (repeat) return 0;
      sum = direction * SCROLL.step;
      spent = true;
      return direction;
    },
  };
}

// The site's one gesture. Several listeners can see the same event (the white section, the page, a flight's scroller and
// the journey): the first decides, and every other gets the same answer, so one event is never counted twice.
const gesture = createScrollSteps();
const decided = new WeakMap<Event, Step>();
const once = (event: Event, decide: () => Step) => {
  const known = decided.get(event);
  if (known !== undefined) return known;
  const step = decide();
  decided.set(event, step);
  return step;
};

/** The step a wheel or touch-move event makes: ±1 once per gesture, when it has travelled SCROLL.step. */
export const scrollStep = (event: Event, pixels: number) =>
  once(event, () => gesture.push(pixels, performance.now()));
/** The step a key press makes (see keyDirection). */
export const keyStep = (event: KeyboardEvent) =>
  once(event, () => gesture.key(keyDirection(event), event.repeat, performance.now()));
/** Call on touchstart and touchend/touchcancel. */
export const touchBegins = (event: TouchEvent) =>
  once(event, () => {
    gesture.touch(performance.now());
    return 0;
  });
export const touchEnds = (event: TouchEvent) =>
  once(event, () => {
    gesture.release(performance.now());
    return 0;
  });

/** Input that is not a scroll of the site: typing, the tuning panel, the enquiry form. */
export const ownInput = (event: Event) =>
  event.target instanceof Element &&
  !!event.target.closest(
    '[data-cinema-controls],input,textarea,select,[contenteditable="true"],[role="dialog"],dialog',
  );

/** `take(step, pixels, event)` decides what one input means where it is heard: true when it belongs there, which also
 *  stops the browser's own scrolling for it. `step` is ±1 on the input that completes a gesture's step, else 0. */
export type StepTaker = (step: Step, pixels: number, event: Event) => boolean;

/** Hears one element's (or the window's) wheel, touch and arrow/page/space keys as the site's steps. */
export function listenSteps(target: EventTarget, take: StepTaker, { capture = false } = {}) {
  let touchY: number | null = null;
  const wheel = (event: Event) => {
    const e = event as WheelEvent;
    if (e.ctrlKey || e.metaKey || ownInput(e)) return;
    const pixels = wheelPixels(e);
    if (take(scrollStep(e, pixels), pixels, e)) e.preventDefault();
  };
  const start = (event: Event) => {
    const e = event as TouchEvent;
    touchBegins(e);
    touchY = e.touches.length === 1 && !ownInput(e) ? e.touches[0].clientY : null;
  };
  const move = (event: Event) => {
    const e = event as TouchEvent;
    if (touchY === null || e.touches.length !== 1) return;
    const y = e.touches[0].clientY,
      pixels = touchY - y;
    touchY = y;
    if (take(scrollStep(e, pixels), pixels, e) && e.cancelable) e.preventDefault();
  };
  const end = (event: Event) => {
    touchEnds(event as TouchEvent);
    touchY = null;
  };
  const key = (event: Event) => {
    const e = event as KeyboardEvent,
      direction = keyDirection(e);
    if (!direction || e.ctrlKey || e.metaKey || e.altKey || ownInput(e)) return;
    // Space on a button or link presses it.
    if (e.key === " " && e.target instanceof Element && e.target.closest("button,a,summary")) return;
    if (take(keyStep(e), direction * SCROLL.step, e)) e.preventDefault();
  };
  target.addEventListener("wheel", wheel, { capture, passive: false });
  target.addEventListener("touchstart", start, { capture, passive: true });
  target.addEventListener("touchmove", move, { capture, passive: false });
  target.addEventListener("touchend", end, { capture, passive: true });
  target.addEventListener("touchcancel", end, { capture, passive: true });
  target.addEventListener("keydown", key, { capture });
  return () => {
    target.removeEventListener("wheel", wheel, { capture });
    target.removeEventListener("touchstart", start, { capture });
    target.removeEventListener("touchmove", move, { capture });
    target.removeEventListener("touchend", end, { capture });
    target.removeEventListener("touchcancel", end, { capture });
    target.removeEventListener("keydown", key, { capture });
  };
}
