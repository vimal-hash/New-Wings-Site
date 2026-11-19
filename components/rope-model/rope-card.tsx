"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createCardCount } from "./rope-card-state";

type CardView = { open: boolean; number: number; off: boolean };

/** Joins the frame loop and the mouse to the card on the page. Made once per page, and does nothing until a page calls it. */
export function createRopeCard() {
  const count = createCardCount(),
    listeners = new Set<() => void>();
  let view: CardView = { open: false, number: 1, off: false },
    over = false,
    element: HTMLElement | null = null;
  const publish = () => {
    if (count.open === view.open && count.number === view.number && count.off === view.off) return;
    view = { open: count.open, number: count.number, off: count.off };
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: () => view,
    attach(found: HTMLElement | null) {
      element = found;
    },
    /** Whether the mouse is on the open card. If so the ropes behind it do not react. */
    holdsPointer(x: number, y: number) {
      if (!view.open || !element) {
        over = false;
        return false;
      }
      const box = element.getBoundingClientRect();
      over = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      return over;
    },
    /** The mouse moved over the ropes. */
    moved() {
      count.moved();
    },
    release() {
      over = false;
    },
    dismiss() {
      over = false;
      count.dismiss(performance.now());
      publish();
    },
    enable() {
      count.enable();
      publish();
    },
    /** Once a frame. Returns true while a timer is running and more frames are needed. */
    update(now: number, rope: number, atStop: boolean) {
      const running = count.update(now, rope, atStop, over);
      if (!count.open) over = false;
      publish();
      return running;
    },
  };
}
export type RopeCardControl = ReturnType<typeof createRopeCard>;

const STYLE = `
.rope-card{position:absolute;left:50%;top:50%;width:min(32vw,calc(52dvh*1.45));aspect-ratio:1.45;border-radius:clamp(18px,1.9vw,32px);overflow:hidden;pointer-events:none;opacity:0;visibility:hidden;
  transform:translate(-50%,-50%) perspective(1800px) rotateX(2.5deg) rotateY(-5deg) scale(.96);
  transition:opacity .3s ease,transform .3s ease,visibility 0s linear .3s;
  background:radial-gradient(90% 90% at 28% 20%,rgba(var(--rope-card-tint),.3),transparent 62%),rgba(10,3,5,.62);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);
  box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 64px rgba(var(--rope-card-tint),.26)}
.rope-card[data-open="true"]{opacity:1;visibility:visible;transform:translate(-50%,-50%) perspective(1800px) rotateX(2.5deg) rotateY(-5deg) scale(1);
  transition:opacity .45s ease,transform .7s cubic-bezier(.16,.8,.24,1),visibility 0s}
.rope-card__image{position:absolute;inset:0;display:grid;place-items:center}
.rope-card__number{font:200 clamp(64px,10vw,170px)/1 var(--font-read),system-ui,sans-serif;color:#fff;text-shadow:0 0 6px rgba(255,255,255,.55),0 0 44px rgba(var(--rope-card-tint),.95)}
.rope-card__close{position:absolute;top:clamp(8px,.8vw,14px);right:clamp(8px,.8vw,14px);width:32px;height:32px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(0,0,0,.42);color:#fff;cursor:pointer;pointer-events:auto;transition:background .2s ease}
.rope-card__close:hover{background:rgba(var(--rope-card-tint),.7)}
.rope-card__close:focus-visible,.rope-card-on:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rope-card-on{position:absolute;right:24px;bottom:24px;height:36px;padding:0 16px;border:0;border-radius:18px;background:rgba(10,3,5,.72);color:#fff;font:500 13px/1 var(--font-read),system-ui,sans-serif;cursor:pointer;opacity:0;visibility:hidden;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 0 28px rgba(var(--rope-card-tint),.32);transition:opacity .3s ease,background .2s ease,visibility 0s linear .3s}
.rope-card-on[data-shown="true"]{opacity:1;visibility:visible;transition:opacity .3s ease .25s,background .2s ease,visibility 0s}
.rope-card-on:hover{background:rgba(var(--rope-card-tint),.7)}
@media (prefers-reduced-motion:reduce){
  .rope-card,.rope-card[data-open="true"]{transform:translate(-50%,-50%) perspective(1800px) rotateX(2.5deg) rotateY(-5deg)}
}`;

/** The card in the middle of the tunnel, and the small button that brings cards back after one was closed. The glow takes the tunnel's colour, given as "r,g,b". For now the image is only its number. */
export function RopeCard({ card, tint }: { card: RopeCardControl; tint: string }) {
  const { open, number, off } = useSyncExternalStore(card.subscribe, card.read, card.read);
  const attach = useCallback((element: HTMLDivElement | null) => card.attach(element), [card]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") card.dismiss();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, card]);
  const colour = { "--rope-card-tint": tint } as React.CSSProperties;
  return (
    <>
      <style>{STYLE}</style>
      <div
        ref={attach}
        className="rope-card"
        data-rope-card
        data-open={open}
        data-number={number}
        aria-hidden={!open}
        style={colour}
      >
        <div className="rope-card__image">
          <span className="rope-card__number">{number}</span>
        </div>
        <button
          type="button"
          className="rope-card__close"
          data-rope-card-close
          aria-label="Close card"
          onClick={() => card.dismiss()}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        className="rope-card-on"
        data-rope-card-on
        data-shown={off}
        aria-hidden={!off}
        style={colour}
        onClick={() => card.enable()}
      >
        Show cards
      </button>
    </>
  );
}
