"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AboutCard from "../corridor/about-card";
import TeamCard from "../corridor/owner-card";
import FeedbackScene, { type FeedbackHandle } from "../corridor/feedback-scene";
import { ContactLinks } from "../corridor/contact-icons";
import DiagonalSection from "../corridor/diagonal-section";
import EnquiryDialog from "../corridor/enquiry-dialog";
import { listenSteps } from "../corridor/scroll-step";
import ReelIntro from "./reel-intro";
import ProductCards, { type ProductNavigation } from "./product-cards";
import "./overview.css";

export default function TheatreOverview() {
  const [visionOpen, setVisionOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const main = useRef<HTMLElement>(null);
  const products = useRef<ProductNavigation>(null);
  const visionButton = useRef<HTMLButtonElement>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const [reelFinished, setReelFinished] = useState(false);
  const finishReel = useCallback(() => setReelFinished(true), []);
  const stepTestimonials = useCallback((step: number) => {
    return feedback.current?.input(step) ?? (step > 0);
  }, []);

  useEffect(() => {
    const page = main.current;
    if (!page) return;
    const sections = Array.from(page.querySelectorAll<HTMLElement>(":scope > [id]"));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    return listenSteps(window, (step) => {
      if (page.inert || menu.current?.open) return false;
      if (!step) return true; // Consume momentum after the first step, including at a section boundary.

      const bottom = document.documentElement.scrollHeight - innerHeight;
      const offsets = sections.map(section => Math.min(section.getBoundingClientRect().top, bottom - scrollY));
      const index = offsets.findIndex(offset => Math.abs(offset) <= 2);
      if (sections[index]?.id === "products" && products.current?.input(step)) return true;

      // Menu links, the scrollbar and a reversed smooth scroll can leave us between stops.
      // Land on the first section edge ahead of us in the requested direction.
      const next = step > 0
        ? offsets.findIndex(offset => offset > 2)
        : offsets.filter(offset => offset < -2).length - 1;
      const destination = sections[next];
      if (destination) {
        if (destination.id === "products") products.current?.enter(step);
        if (sections[index]?.contains(document.activeElement)) destination.focus({ preventScroll: true });
        destination.scrollIntoView({ block: "start", behavior: reduced.matches ? "instant" : "smooth" });
      }
      return true;
    });
  }, []);

  useEffect(() => {
    const scene = feedback.current;
    if (!reelFinished || !scene?.root || visionOpen) return;
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden) scene.play();
      else scene.run(false);
    };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (observer) observer.observe(scene.root);
    else sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      scene.run(false);
    };
  }, [reelFinished, visionOpen]);

  function showVision(open: boolean) {
    if (open) window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new CustomEvent("eye-diagonal-preview", { detail: open ? 1 : 0 }));
    if (!open) requestAnimationFrame(() => visionButton.current?.focus({ preventScroll: true }));
  }

  // The destination of a 3D handoff may not exist when the browser first reads its hash.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id === "vision") showVision(true);
    else if (id) document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
  }, []);

  return (
    <div className="overview-page">
      <main ref={main} className="theatre-overview" inert={visionOpen}>
        <details className="overview-menu" data-cinema-controls ref={menu}>
          <summary>Menu</summary>
          <nav
            aria-label="Sections"
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            <a href="#theatre">Theatre</a>
            <a href="#products">Products</a>
            <a href="#about">About Us</a>
            <a href="#team">Team</a>
            <a href="#testimonials">Testimonials</a>
            <button onClick={() => showVision(true)}>Vision</button>
          </nav>
        </details>
        <header className="overview-theatre" id="theatre" tabIndex={-1}>
          <h1 className="sr-only">New Wings Solutions</h1>
          {/* Each file is compressed from the same native 4K capture of the opening camera. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/overview/theatre-1920.webp"
            srcSet="/images/overview/theatre-960.webp 960w, /images/overview/theatre-1920.webp 1920w, /images/overview/theatre-3840.webp 3840w"
            sizes="(max-aspect-ratio: 1/1) 140vh, 100vw"
            fetchPriority="high"
            width="3840"
            height="2160"
            alt="The New Wings cinema screen seen through a pair of 3D glasses from the theatre seats."
          />
          <a href="#products">Scroll to products ↓</a>
        </header>
        <ProductCards ref={products} />
        <section className="overview-section" id="about" tabIndex={-1} aria-label="About us">
          <ReelIntro reel={1} />
          <AboutCard />
        </section>
        <section className="overview-section" id="team" tabIndex={-1} aria-label="Team">
          <ReelIntro reel={2} />
          <TeamCard />
        </section>
        <section
          className="overview-section overview-feedback"
          id="testimonials"
          tabIndex={-1}
          aria-label="Testimonials"
        >
          <ReelIntro reel={3} onFinish={finishReel} />
          <FeedbackScene ref={reelFinished ? feedback : null} live={reelFinished} start="old" />
          <button className="overview-vision-button" ref={visionButton} onClick={() => showVision(true)}>
            Vision ↓
          </button>
        </section>
      </main>
      <DiagonalSection onOverviewCover={setVisionOpen} onOverviewStep={stepTestimonials} />
      {visionOpen && (
        <button className="overview-back" onClick={() => showVision(false)}>
          ↑ Testimonials
        </button>
      )}
      <div className="contact-bar" data-cinema-controls>
        <ContactLinks className="contact-bar__links" />
      </div>
      <EnquiryDialog />
    </div>
  );
}
