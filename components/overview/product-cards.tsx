"use client";

import Image from "next/image";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { FILM_PRODUCTS } from "../film-reel/film-data";
import { openEnquiry } from "../corridor/enquiry";
import type { Step } from "../corridor/scroll-step";
import ReelIntro from "./reel-intro";
import "./product-cards.css";

const last = FILM_PRODUCTS.length - 1;
const projection = "/images/overview/projection";

/** A recording of the reel's screen-space shader. Decode it only while Products is on screen. */
function ProjectedFilm() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => {
      if (!visible || document.hidden || reduced.matches) {
        player.pause();
        return;
      }
      if (!player.hasAttribute("src")) player.src = projection + "/projection.mp4";
      void player.play().catch(() => {}); // The still is already painted if playback is unavailable.
    };
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= 0.01;
      sync();
    }, { threshold: 0.01 });
    observer.observe(player);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      player.pause();
    };
  }, []);
  return (
    <div className="product-projection" aria-hidden="true">
      <video ref={video} poster={projection + "/still.webp"} muted playsInline loop preload="none" />
    </div>
  );
}

export type ProductNavigation = {
  enter(step: Step): void;
  input(step: Step): boolean;
};

export default function ProductCards({ ref }: { ref: Ref<ProductNavigation> }) {
  const section = useRef<HTMLElement>(null);
  const [projecting, setProjecting] = useState(false);
  const finishIntro = useCallback(() => setProjecting(true), []);
  const [frame, setFrame] = useState(0);

  useImperativeHandle(ref, () => ({
    enter(step) {
      setFrame(step > 0 ? 0 : last);
    },
    input(step) {
      if (!projecting && step > 0) return true;
      const next = frame + step;
      if (next < 0 || next > last) return false;
      setFrame(next);
      if (section.current?.contains(document.activeElement)) {
        section.current.querySelectorAll("button")[next]?.focus({ preventScroll: true });
      }
      return true;
    },
  }), [frame, projecting]);

  return (
    <section id="products" ref={section} tabIndex={-1} className="overview-section overview-products" aria-label="Products">
      <ReelIntro reel={0} onFinish={finishIntro} />
      <div className="product-track" style={{ transform: `translateX(calc(var(--card-step) * ${-frame}))` }}>
        {FILM_PRODUCTS.map((product, index) => (
          <article key={product.name} className="product-slide" data-lit={index === frame}>
            <button
              onFocus={() => setFrame(index)}
              onClick={() => openEnquiry(product.name)}
              aria-label={`Enquire about ${product.name}`}
            >
              <Image src={product.picture.replace("/film", projection)} alt="" width={640} height={360} unoptimized />
              <span className="product-slide-caption">
                <strong>{product.name}</strong>
                <span>{product.line}</span>
              </span>
            </button>
          </article>
        ))}
      </div>
      {projecting && <ProjectedFilm />}
      <span className="sr-only" aria-live="polite" aria-atomic="true">{FILM_PRODUCTS[frame].name}</span>
    </section>
  );
}
