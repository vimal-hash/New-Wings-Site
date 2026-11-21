"use client";

import { useEffect, useRef } from "react";
import TitleLine, {
  CARD_WAIT,
  SECTION_LINES,
  TITLE,
  cardStrength,
  showTitle,
  writeTitle,
} from "../corridor/title-card";

export default function ReelIntro({ reel }: { reel: number }) {
  const paper = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.hidden = true;
      return;
    }
    let frame = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        function tick(now: number) {
          const t = (now - start) / 1000;
          writeTitle(line.current, reduce ? Infinity : t);
          showTitle(line.current, reduce ? 1 : cardStrength(t));
          const fade = reduce ? Number(t >= 1) : Math.min(1, Math.max(0, (t - CARD_WAIT) / TITLE.lift));
          el!.style.opacity = String(1 - fade);
          if (fade < 1) frame = requestAnimationFrame(tick);
          else el!.hidden = true;
        }
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.45 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="overview-intro" ref={paper} aria-hidden="true">
      <TitleLine ref={line} text={SECTION_LINES[reel]} />
    </div>
  );
}
