"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReelHandle } from "../film-reel/film-reel";
import { journeyControls } from "./journey-controls";
import { pageAtBottom, pageReturn, WHITE_SECONDS } from "./page-exit";
import { traceMark } from "./loading-trace";
import { ropeFlightDevice } from "./effect-quality";
import SectionFlight, { type FlightControl } from "./section-flight";
import AboutCard, { type AboutHandle } from "./about-card";
import { WALL } from "./about-film";
import OwnerCard, { OWNER_WALL, type OwnerHandle } from "./owner-card";
import SectionWhite, { type WhiteHandle } from "./section-white";
import { SECTION_LINES, TITLE } from "./title-card";
import FeedbackScene, { FEEDBACK_LAST, FEEDBACK_WALL, whenCalm, type FeedbackHandle } from "./feedback-scene";
import { listenSteps } from "./scroll-step";
import { onVisibleLoadTimeout, switchToOverview } from "./overview-fallback";

// Section 1's reel can prepare while the page is still covered.
const FilmReel = dynamic(() => import("../film-reel/film-reel"), { ssr: false });

const SECTION_COLOURS = ["#ffffff", WALL, OWNER_WALL, FEEDBACK_WALL];
// Section 3's film (old -> clean -> colour) starts once its white has lifted 90% (as seen), not after it has gone, and
// the old film begins to clean .26 s later, as the white finishes (it is gone about .28 s after 90%).
const TEAM_FILM_AT = 0.9,
  TEAM_OLD_HOLD = 0.26;
const SECTION_TITLES = ["Products", "About Us", "Team", "Testimonials"];
// Arriving back from the corridor, Section 4 waits under this white (just short of solid, as a section's held white, so
// the section is already drawn), then the white lifts in WHITE_SECONDS: the way Section 4 was left, played backwards.
const BACK_HOLD = 0.998;
const smoother = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** A departing copy of the fourth section (a still of its HD scene), sampled from the camera's clock: it turns plain
 *  white, then hands over to the white panel in the corridor (end-box.ts) and is gone. */
export function PageReturnCover() {
  const sheet = useRef<HTMLDivElement>(null),
    copy = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = sheet.current,
      text = copy.current;
    if (!node || !text) return;
    let frame = 0;
    const paint = () => {
      const shot = pageReturn.read();
      node.style.transform = `scale(${shot.scale})`;
      node.style.opacity = String(shot.opacity);
      node.style.setProperty("--page-return-white", String(shot.white));
      text.style.opacity = String(shot.copy);
      text.style.visibility = shot.copy > 0 ? "" : "hidden";
      node.hidden = shot.opacity <= 0;
      if (shot.moving && shot.opacity > 0) frame = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="page-return-cover" ref={sheet} aria-hidden="true">
      <div
        className="page-return-surface"
        style={{
          backgroundColor: `color-mix(in srgb, ${FEEDBACK_WALL}, white calc(var(--page-return-white, 0) * 100%))`,
        }}
      >
        <div ref={copy} style={{ position: "absolute", inset: 0 }}>
          <FeedbackScene card={FEEDBACK_LAST} />
        </div>
      </div>
    </div>
  );
}

function firstSection() {
  if (typeof location !== "undefined" && location.pathname === "/sections") {
    const query = new URLSearchParams(location.search);
    if (query.has("end")) return SECTION_TITLES.length;
    const section = Math.trunc(Number(query.get("section"))) || 1;
    return Math.max(1, Math.min(SECTION_TITLES.length, section));
  }
  const jumped = journeyControls.read().pageSection;
  if (jumped) return jumped; // opened from the menu
  if (journeyControls.read().pageAtEnd) return 4;
  return 1;
}
export default function NormalPage({
  returnToCorridor = false,
  active = true,
  visibleSection = 1,
}: {
  returnToCorridor?: boolean;
  active?: boolean;
  visibleSection?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const interactive = useRef(active);
  useLayoutEffect(() => {
    interactive.current = active;
  }, [active]);
  const [device] = useState(ropeFlightDevice),
    [initialSection] = useState(firstSection);
  // Scrolling back from View 2 (the user, 2026-11-18): Section 4 is found on its last card, as it was left, under a white
  // that lifts by itself; no title line and no replay of its eras.
  const [cameBack] = useState(() => journeyControls.read().pageBack && initialSection === 4),
    backWhite = useRef<HTMLDivElement>(null),
    lifting = useRef(cameBack);
  // Gone back to the corridor from Section 1: arriving again, the visit starts over at Section 1 like the first time.
  const wentBack = useRef(false);
  const [flightUnavailable, setFlightUnavailable] = useState(false);
  const flying = device !== "mobile" && !flightUnavailable;
  const control = useRef<FlightControl>({ where: initialSection === 1 && flying ? "flight" : "rest" });
  const [flight, setFlight] = useState({
    index: 0,
    startAtEnd: initialSection > 1,
    autoEnter: false,
    entry: 0,
    entryDistance: 0,
  });
  const film = useRef<ReelHandle>(null),
    flightIndex = useRef(0),
    about = useRef<AboutHandle>(null),
    owner = useRef<OwnerHandle>(null),
    feedback = useRef<FeedbackHandle>(null),
    whites = useRef<(WhiteHandle | null)[]>([]),
    covering = useRef(false),
    cardUntil = useRef(0); // A section's title card is on its arrival white: until its line has gone, a scroll down waits (it never skips the card).
  // Scrolling back up still turns back, and the line goes with the white.
  useEffect(() => {
    if (!returnToCorridor || !active || visibleSection !== 1 || film.current?.ready()) return;
    return onVisibleLoadTimeout(() => {
      if (!film.current?.ready()) switchToOverview();
    });
  }, [returnToCorridor, active, visibleSection]);
  const holdForCard = useCallback(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      cardUntil.current = performance.now() + (TITLE.write + TITLE.hold + TITLE.out) * 1000;
  }, []);
  // The reel has burnt to white: carry the same scroll straight on, so frame 6, the white and the portal are one movement.
  const filmDone = useCallback(() => {
    const node = panel.current;
    if (!node || journeyControls.read().phase !== "page") return;
    if (flying && control.current.where === "flight" && flightIndex.current === 0) {
      const scroller = node.querySelector<HTMLElement>("[data-rope-scroller]");
      if (scroller && scroller.scrollTop <= 1) scroller.scrollTop += 4; // the flight then glides on to its first stop by itself
    } else if (flying && control.current.where === "rest" && node.scrollTop <= 2) {
      control.current.where = "flight";
      node.style.overflow = "hidden";
      setFlight((old) => ({
        index: 0,
        startAtEnd: false,
        autoEnter: true,
        entry: old.entry + 1,
        entryDistance: 4,
      }));
    } else if (!flying && node.scrollTop <= 2) node.scrollTo({ top: node.clientHeight, behavior: "smooth" });
  }, [flying, setFlight]);
  // A step back on Section 1's first frame has brought the house lights up and the page is all white: the site goes back
  // the way it came (the page turns back into the liquid sphere, corridor-page.tsx; the camera walks back to the
  // projector, full-journey.tsx).
  const leave = useCallback(() => {
    const journey = journeyControls.read();
    if (journey.phase !== "page" || journey.leavingPage) return;
    wentBack.current = true;
    traceMark("Section 1 back to the corridor");
    journeyControls.update({ leavingPage: true, pageSection: null, pageAtEnd: false });
  }, []);
  useLayoutEffect(() => {
    flightIndex.current = flight.index;
  }, [flight.index]);
  const arrived = useCallback(
    (side: "start" | "end", inWhite: boolean) => {
      const node = panel.current;
      if (!node) return;
      node.scrollTop = (flight.index + (side === "end" ? 1 : 0)) * node.clientHeight;
      // Arriving in About Us from Section 1's white portal, the white lifts off the old film and the print is cleaned in
      // front of the visitor. Back in Section 1, it waits worn again.
      // Arriving forwards, each section's white first carries its title line; flying back up the whites stay plain.
      if (flight.index === 0) {
        if (side === "end") {
          holdForCard();
          about.current?.reveal();
        } else about.current?.wait();
      }
      // Every section is reached from above through a white portal. In Section 3 the old film already runs under the white;
      // once the white has lifted it is cleaned, then colour soaks in. Back above it, it waits as old film again.
      // Flying back up, the flight lands in the section's white too, and it lifts the same way (the section is not replayed).
      const landed = flight.index + (side === "end" ? 1 : 0);
      if (side === "start" && inWhite && landed === 1) about.current?.uncover();
      if (landed === 2) {
        owner.current?.run(true);
        if (inWhite) {
          if (side === "end") holdForCard();
          whites.current[2]?.reveal(() => owner.current?.open(TEAM_OLD_HOLD), side === "end", TEAM_FILM_AT);
        }
      } else if (landed < 2) owner.current?.close();
      else {
        owner.current?.run(false);
        feedback.current?.run(true);
        if (side === "end") {
          holdForCard();
          whites.current[3]?.reveal(() => feedback.current?.play(), true);
        }
      }
      // Section 4 waits in Section 3's faded colour until it is reached again; its white has already risen over it.
      if (landed < 3) {
        feedback.current?.reset();
        feedback.current?.run(false);
      }
      node.style.overflow = "";
      node.focus({ preventScroll: true });
    },
    [flight.index, holdForCard],
  );
  const flightFailed = useCallback(() => {
    if (returnToCorridor && interactive.current && control.current.where === "flight" &&
        (flight.autoEnter || film.current?.showing() === false)) {
      switchToOverview();
      return;
    }
    const node = panel.current;
    if (control.current.where === "flight" && flight.autoEnter && flight.startAtEnd && flight.index === 0)
      about.current?.uncover();
    control.current.where = "rest";
    covering.current = false;
    if (node) node.style.overflow = "";
    traceMark("Section flight unavailable; native scroll restored");
    setFlightUnavailable(true);
  }, [returnToCorridor, flight.autoEnter, flight.startAtEnd, flight.index]);
  // With native scrolling, About Us is cleaned as it comes into view from above.
  useEffect(() => {
    const handle = about.current,
      card = handle?.root?.closest("section");
    if (flying || !active || !handle || !card) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5 && handle.waiting()) handle.play();
        else if (entry.isIntersecting && handle.waiting())
          handle.idle(); // the old film is already running as it comes into view
        else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) handle.wait();
      },
      { root: panel.current, threshold: [0, 0.5] },
    );
    watch.observe(card);
    return () => watch.disconnect();
  }, [flying, active]);
  // Section 3's old film plays into colour as it scrolls into view from above.
  useEffect(() => {
    const handle = owner.current,
      card = handle?.root?.closest("section");
    if (flying || !active || !handle || !card) return;
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) handle.open();
        else if (!entry.isIntersecting) {
          if (entry.boundingClientRect.top > 0) handle.close();
          else handle.run(false);
        }
      },
      { root: panel.current, threshold: [0, 0.5] },
    );
    watch.observe(card);
    return () => watch.disconnect();
  }, [flying, active]);
  // Section 4's frame loop (its cards, specks and eras) stops while the page is hidden.
  useEffect(() => {
    if (!active) feedback.current?.run(false);
  }, [active]);
  // Section 4 plays its eras as it scrolls into view and waits as old film again once it has left upwards.
  useEffect(() => {
    const handle = feedback.current,
      card = handle?.root?.closest("section"),
      scroll = panel.current;
    if (flying || !active || !handle || !card || !scroll) return;
    // Opened straight onto it, the eras wait (as old film) until the page has finished loading, so they never stutter.
    let calm = false,
      waiting = false,
      timer = 0;
    const playWhenSettled = () => {
      clearTimeout(timer);
      if (calm && waiting)
        timer = window.setTimeout(() => {
          waiting = false;
          handle.play();
        }, 150);
    };
    const cancel = whenCalm(() => {
      calm = true;
      playWhenSettled();
    });
    const watch = new IntersectionObserver(
      ([entry]) => {
        waiting = entry.intersectionRatio >= 0.5;
        if (!entry.isIntersecting) {
          handle.run(false);
          if (entry.boundingClientRect.top > 0) handle.reset();
        }
        playWhenSettled();
      },
      { root: scroll, threshold: [0, 0.5] },
    );
    scroll.addEventListener("scroll", playWhenSettled, { passive: true });
    watch.observe(card);
    return () => {
      cancel();
      clearTimeout(timer);
      scroll.removeEventListener("scroll", playWhenSettled);
      watch.disconnect();
    };
  }, [flying, active]);
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node || !active) return;
    const section = wentBack.current ? 1 : initialSection;
    node.scrollTop = (section - 1) * node.clientHeight;
    if (returnToCorridor) journeyControls.update({ visiblePageSection: section });
  }, [active, initialSection, returnToCorridor]);
  useEffect(() => {
    if (!active || !flying || wentBack.current) return;
    // Opened straight onto a section (or from the menu), its white carries the title line too.
    if (initialSection === 2) holdForCard();
    if (initialSection === 3) {
      owner.current?.run(true);
      holdForCard();
      whites.current[2]?.reveal(() => owner.current?.open(TEAM_OLD_HOLD), true, TEAM_FILM_AT);
    }
    if (initialSection === 4) {
      feedback.current?.run(true);
      if (cameBack) return; // its own white lifts (below), with no title line
      return whenCalm(() => {
        holdForCard();
        whites.current[3]?.reveal(() => feedback.current?.play(), true);
      });
    }
  }, [active, flying, initialSection, holdForCard, cameBack]);
  // Back from the corridor: once the page runs smoothly, the white lifts off Section 4 in WHITE_SECONDS, then the page
  // takes the scroll again.
  useEffect(() => {
    const white = backWhite.current;
    if (!cameBack || !active || !white || !lifting.current) return;
    let frame = 0,
      start = 0;
    const lift = (now: number) => {
      start ||= now;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        t = reduce ? 1 : Math.min(1, (now - start) / (WHITE_SECONDS * 1000));
      white.style.opacity = (BACK_HOLD * (1 - smoother(t))).toFixed(4);
      if (t < 1) {
        frame = requestAnimationFrame(lift);
        return;
      }
      white.hidden = true;
      lifting.current = false;
      traceMark("Section 4 white lifted after the way back");
      journeyControls.update({ pageBack: false });
    };
    const cancel = whenCalm(() => {
      frame = requestAnimationFrame(lift);
    });
    return () => {
      cancel();
      cancelAnimationFrame(frame);
    };
  }, [cameBack, active]);
  useEffect(() => {
    const node = panel.current;
    if (!node || !active) return;
    if (flying && control.current.where === "flight") node.style.overflow = "hidden";
    const scroller = flying ? node.querySelector<HTMLElement>("[data-rope-scroller]") : null;
    (scroller ?? node).focus({ preventScroll: true });
    // True while the visitor is at the very start of Section 1: resting on it, or in the first connection before any of it has been flown.
    const atFilm = () => {
      if (journeyControls.read().phase !== "page") return false;
      if (control.current.where === "rest") return node.scrollTop <= 2;
      const scroller =
        flightIndex.current === 0 ? node.querySelector<HTMLElement>("[data-rope-scroller]") : null;
      return !!scroller && scroller.scrollTop <= 1;
    };
    // The reel takes the scroll first while it is on screen; once it has burnt to white the page carries on to the white portal.
    // Scrolling back up at the start of Section 1 brings the reel back.
    const toFilm = (step: number) => {
      const reel = film.current;
      if (!reel || !atFilm()) return false;
      if (reel.showing()) return reel.input(step);
      return step < 0 && reel.input(step);
    };
    // One step of the site's scroll (one gesture, scroll-step.ts): 1 forward, -1 back. Everything on the page answers it
    // the same way: one frame, one card, one flight leg or one section per step.
    const advance = (step: number) => {
      if (toFilm(step)) return;
      if (control.current.where === "flight") {
        control.current.step?.(step);
        return;
      }
      if (step > 0 && performance.now() < cardUntil.current) return; // the title line is still on its white
      const height = node.clientHeight,
        at = Math.round(node.scrollTop / height),
        onBoundary = Math.abs(node.scrollTop - at * height) <= 2;
      if (!onBoundary) {
        // Phones: a section is still gliding into place. Computers never glide the page, so it was moved some other way
        // (its scrollbar dragged, a search in the page): the step settles it on the section edge it points to, and the
        // next step goes on from there as usual. (The wheel no longer scrolls the page itself, so nothing else would.)
        if (!flying) return;
        const landed = (step > 0 ? Math.ceil : Math.floor)(node.scrollTop / height);
        node.scrollTop = landed * height;
        // Reached without its flight, the section starts as it does on phones, with no white to lift.
        if (landed === 1 && about.current?.waiting()) about.current.play();
        if (landed === 2) {
          owner.current?.run(true);
          owner.current?.open();
        }
        if (landed === 3) {
          owner.current?.run(false);
          feedback.current?.run(true);
          feedback.current?.play();
        }
        return;
      }
      // Section 4's cards take the scroll first, one card per step, like Section 1's reel.
      if (at === 3 && feedback.current?.input(step)) return;
      const next = step > 0 && at < 3 ? at : step < 0 && at > 0 && at <= 3 ? at - 1 : -1;
      if (!flying && next >= 0) {
        // Phones: one step, one section, gliding into place.
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollTo({ top: (at + Math.sign(step)) * height, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      if (next >= 0) {
        if (covering.current) return;
        const fly = () => {
          covering.current = false;
          cardUntil.current = 0;
          // The section left is under the flight now: its specks and films rest.
          if (at === 3) feedback.current?.run(false);
          if (at === 2) owner.current?.run(false);
          control.current.where = "flight";
          node.style.overflow = "hidden";
          setFlight((old) => ({
            index: next,
            startAtEnd: step < 0,
            autoEnter: true,
            entry: old.entry + 1,
            entryDistance: Math.sign(step) * 8,
          }));
        };
        // Leaving a section upwards: the white rises over it first, so the flight back starts from the same white portal.
        const portal = step < 0 ? (next === 0 ? about.current : whites.current[at]) : null;
        if (portal) {
          covering.current = true;
          node.style.overflow = "hidden";
          portal.cover(fly);
        } else fly();
        return;
      }
      if (!returnToCorridor || step < 0 || !pageAtBottom(node.scrollTop, node.scrollHeight, height)) return;
      // Leaving Section 4: the page turns white, the white stays behind as a panel in the corridor (pageEndBox) and the
      // camera goes back away from it (the user, 2026-11-16).
      traceMark("Final page section reached");
      pageReturn.reset();
      journeyControls.update({
        phase: "pageReturnLoading",
        panelStage: 0,
        pageAtEnd: true,
        pageEndBox: true,
      });
    };
    // The page moves only by steps: the browser's own scrolling stays off here, so a long swipe or a flick's momentum
    // can never carry it on. Nothing moves while the page is leaving or the white is still lifting off Section 4.
    return listenSteps(node, (step) => {
      const journey = journeyControls.read();
      if (step && journey.phase === "page" && !journey.leavingPage && !lifting.current) advance(step);
      return true;
    });
  }, [active, flying, returnToCorridor]);
  return (
    <div
      ref={panel}
      className="normal-page"
      data-snap={flying ? undefined : ""}
      tabIndex={-1}
      aria-label="Page sections"
      inert={!active}
      style={active ? undefined : { visibility: "hidden", opacity: 0, pointerEvents: "none" }}
    >
      {/* isolate: a section's own layers (its white portal is z-index 5) stay inside it. Flying back, the page still rests on
        the section being left, and its white used to be drawn over the whole flight, so the tunnel was never seen. */}
      {SECTION_COLOURS.map((colour, index) => (
        <section
          key={index}
          aria-label={SECTION_TITLES[index]}
          style={{ background: colour, isolation: "isolate" }}
        >
          {index === 1 ? (
            <AboutCard
              ref={about}
              live
              line={flying ? SECTION_LINES[1] : undefined}
              start={initialSection <= 1 ? "wait" : initialSection === 2 ? "reveal" : "clean"}
            />
          ) : index === 2 ? (
            <OwnerCard
              ref={owner}
              live
              start={
                initialSection <= 2 || (flying && initialSection === 3)
                  ? "old"
                  : initialSection === 3
                    ? "play"
                    : "done"
              }
            />
          ) : index === 3 ? (
            <FeedbackScene
              ref={feedback}
              live
              start={cameBack ? "done" : initialSection <= 3 || flying ? "old" : "play"}
              card={cameBack ? FEEDBACK_LAST : 0}
            />
          ) : null}
          {flying && index >= 2 ? (
            <SectionWhite
              ref={(white) => {
                whites.current[index] = white;
              }}
              line={SECTION_LINES[index]}
              covered={index >= 2 && index === initialSection - 1 && !cameBack}
            />
          ) : null}
        </section>
      ))}
      {flying ? (
        <SectionFlight
          device={device}
          interactive={interactive}
          blue={flight.index === 1}
          yellow={flight.index === 2}
          first={SECTION_COLOURS[flight.index]}
          second="#ffffff"
          startAtEnd={flight.startAtEnd}
          autoEnter={flight.autoEnter}
          entry={flight.entry}
          entryDistance={flight.entryDistance}
          control={control}
          onArrive={arrived}
          onFailure={flightFailed}
        >
          {flight.index === 1 ? <AboutCard /> : flight.index === 2 ? <OwnerCard /> : null}
        </SectionFlight>
      ) : null}
      <FilmReel
        handle={film}
        running={active}
        ended={initialSection > 1}
        line={SECTION_LINES[0]}
        onExit={filmDone}
        onBack={returnToCorridor ? leave : undefined}
      />
      {cameBack ? (
        <div
          ref={backWhite}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            background: "#fff",
            opacity: BACK_HOLD,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
