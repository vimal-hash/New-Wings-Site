"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import { ContactLinks } from "./contact-icons";
import type { JumpTarget } from "./full-journey";
import StoryCaption from "./story-caption";

/** Menu entries, in story order. Numbers are the page sections. */
const SITE_SECTIONS: { target: JumpTarget; label: string }[] = [
  { target: "theatre", label: "The Theatre" },
  { target: "projector", label: "The Projector" },
  { target: 1, label: "Products" },
  { target: 2, label: "About Us" },
  { target: 3, label: "Team" },
  { target: 4, label: "Testimonials" },
  { target: "final", label: "The Vision" },
];

/** Camera-resting stops. Elsewhere the contact bar steps out of the frame. */
const RESTING = new Set<JourneyPhase>(["idle", "awaitAssembly", "done", "page"]);
const THEATRE = new Set<JourneyPhase>(["idle", "glassesExit"]);
const PROJECTOR = new Set<JourneyPhase>([
  "pullback",
  "hold",
  "approach",
  "reveal",
  "awaitAssembly",
  "returnHold",
  "return",
  "done",
]);

function currentTarget(phase: JourneyPhase, section: number | null, covered: boolean): JumpTarget | null {
  if (THEATRE.has(phase)) return "theatre";
  if (PROJECTOR.has(phase)) return "projector";
  if (phase === "page" && section) return section as JumpTarget;
  if (phase === "logoDone" && covered) return "final";
  return null;
}

export default function SiteChrome() {
  const journey = useSyncExternalStore(journeyControls.subscribe, journeyControls.read, journeyControls.read);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const started = journey.loaderDone && journey.phase !== "intro";
  const resting =
    RESTING.has(journey.phase) ||
    ((journey.phase === "logoReveal" || journey.phase === "logoDone") &&
      !journey.cameraMoving &&
      !journey.pageReturning);
  const active = currentTarget(journey.phase, journey.visiblePageSection, journey.finalCovered);

  useEffect(() => {
    if (journey.phase !== "page") return;
    const page = menu.current?.parentElement?.querySelector(".normal-page");
    if (!page) return;
    const sections = [...page.querySelectorAll(":scope > section")];
    const watch = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.intersectionRatio >= 0.5);
        if (visible) journeyControls.update({ visiblePageSection: sections.indexOf(visible.target) + 1 });
      },
      { root: page, threshold: 0.5 },
    );
    sections.forEach((section) => watch.observe(section));
    return () => watch.disconnect();
  }, [journey.phase, journey.pageJump]);

  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      tab.current?.focus({ preventScroll: true });
    };
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);

  if (!started) return null;
  const go = (target: JumpTarget) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("journey-jump", { detail: target }));
  };
  return (
    <>
      <div ref={menu} className={`site-menu${open ? " is-open" : ""}`} data-cinema-controls>
        <button
          ref={tab}
          type="button"
          className="site-menu__tab"
          aria-expanded={open}
          aria-controls="site-menu-list"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
          <span>Menu</span>
        </button>
        <nav id="site-menu-list" className="site-menu__panel" aria-label="Sections" inert={!open}>
          <p className="site-menu__eyebrow">New Wings Solutions</p>
          <ol>
            {SITE_SECTIONS.map((item, index) => (
              <li key={String(item.target)}>
                <button
                  type="button"
                  aria-current={active === item.target ? "true" : undefined}
                  onClick={() => go(item.target)}
                >
                  <span className="site-menu__index">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <StoryCaption journey={journey} />
      <div
        className="studio-vignette"
        data-on={journey.phase === "awaitAssembly" || journey.phase === "reveal" ? "" : undefined}
        aria-hidden="true"
      />
      <div
        className={`contact-bar${resting ? "" : " is-away"}`}
        data-cinema-controls
        aria-hidden={!resting}
        inert={!resting}
      >
        <ContactLinks className="contact-bar__links" />
      </div>
    </>
  );
}
