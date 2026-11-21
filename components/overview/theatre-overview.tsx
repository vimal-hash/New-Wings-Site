"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { FILM_PRODUCTS } from "../film-reel/film-data";
import AboutCard from "../corridor/about-card";
import TeamCard from "../corridor/owner-card";
import { testimonials } from "../corridor/testimonials";
import { ContactLinks } from "../corridor/contact-icons";
import DiagonalSection from "../corridor/diagonal-section";
import { openEnquiry } from "../corridor/enquiry";
import EnquiryDialog from "../corridor/enquiry-dialog";
import ReelIntro from "./reel-intro";
import "./overview.css";

export default function TheatreOverview() {
  const [visionOpen, setVisionOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const visionButton = useRef<HTMLButtonElement>(null);

  function showVision(open: boolean) {
    if (open) window.scrollTo(0, document.documentElement.scrollHeight);
    window.dispatchEvent(new CustomEvent("eye-diagonal-preview", { detail: open ? 1 : 0 }));
    if (!open) requestAnimationFrame(() => visionButton.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="overview-page">
      <main className="theatre-overview" inert={visionOpen}>
        <details className="overview-menu" ref={menu}>
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
        <header className="overview-theatre" id="theatre">
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
        <section
          className="overview-section overview-products"
          id="products"
          aria-labelledby="products-title"
        >
          <ReelIntro reel={0} />
          <h2 id="products-title">Products</h2>
          <div className="overview-product-list">
            {FILM_PRODUCTS.map((product) => (
              <article key={product.name}>
                <button
                  onClick={() => openEnquiry(product.name)}
                  aria-label={`Enquire about ${product.name}`}
                >
                  <Image src={product.picture} width={640} height={360} unoptimized alt="" />
                  <span>{product.name}</span>
                </button>
                <p>{product.line}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="overview-section" id="about" aria-label="About us">
          <ReelIntro reel={1} />
          <AboutCard />
        </section>
        <section className="overview-section" id="team" aria-label="Team">
          <ReelIntro reel={2} />
          <TeamCard />
        </section>
        <section
          className="overview-section overview-feedback"
          id="testimonials"
          aria-labelledby="feedback-title"
        >
          <ReelIntro reel={3} />
          <h2 id="feedback-title">Testimonials</h2>
          <div className="overview-quotes">
            {testimonials.map((quote) => (
              <figure key={quote.name} style={{ backgroundColor: quote.colour }}>
                <blockquote>{quote.text}</blockquote>
                <figcaption>
                  {quote.name}
                  <span>{quote.place}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <button className="overview-vision-button" ref={visionButton} onClick={() => showVision(true)}>
            Vision ↓
          </button>
        </section>
      </main>
      <DiagonalSection onOverviewCover={setVisionOpen} />
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
