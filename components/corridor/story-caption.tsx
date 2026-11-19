"use client";

import { journeyControls, type JourneyPhase } from "./journey-controls";

type Snapshot = ReturnType<typeof journeyControls.read>;
type Chapter = { key: string; line: string; hint?: string };

/**
 * The story told at each resting stop: one line and one quiet hint.
 * Short on purpose. The scene carries the feeling; the words only name it.
 * The corridor walk and the liquid sphere have no stop: their lines show while the camera walks, with no hint.
 */
const CHAPTERS: Record<string, Omit<Chapter, "key">> = {
  // The house lights come up as this stop begins (houseLightLevel, 3.2 s) and stay up when scrolling back to it, so the
  // line speaks to a lit room: seated, before the film. "Lights up" belongs to the end page.
  theatre: {
    line: "Take your seat. Everything in this room is our work.",
    hint: "Hover the room · Scroll to step back",
  },
  parts: {
    line: "Every picture starts as light. Here is everything that makes it.",
    hint: "Hover a part · Scroll to put it together",
  },
  projector: { line: "Now it needs a room.", hint: "Scroll on" },
  // Walking past the drawings on the corridor walls.
  corridor: { line: "Before a seat goes in, we draw the whole room." },
  // The liquid sphere is the lamp; the white it turns into is the screen, where Section 1 (reel one) plays.
  lamp: { line: "The lamp is warm. The screen is waiting." },
  closer: {
    line: "Look closer. Our mark is made of light, like everything on the screen.",
    hint: "Scroll on",
  },
  eye: {
    line: "From the side, the wings become an eye. We build for people who love to watch.",
    hint: "Scroll on",
  },
  vision: {
    line: "We fit the screen, the sound and the seats. The film does the rest.",
    hint: "Scroll on",
  },
};

const LOGO = new Set<JourneyPhase>(["logoReveal", "logoDone"]);

/** Which chapter the visitor is resting in (or walking through), or null while the camera travels. */
function chapterFor(j: Snapshot): Chapter | null {
  const pick = (key: string) => ({ key, ...CHAPTERS[key] });
  switch (j.phase) {
    case "idle":
      return pick("theatre");
    case "awaitAssembly":
      return pick("parts");
    case "done":
      return pick("projector");
    // Forward only: walking back from Section 1 to the projector stays plain.
    case "screens":
      return j.leavingPage ? null : pick("corridor");
    // Resting at the drawings: the same card, now with the hint to go on.
    case "drawings":
      return { ...pick("corridor"), hint: "Scroll on" };
    case "corridor":
      return j.leavingPage ? null : pick(j.liquidInView ? "lamp" : "corridor");
    case "panel":
      return j.leavingPage ? null : pick("lamp");
  }
  if (!LOGO.has(j.phase) || j.cameraMoving || j.pageReturning || j.finalCovered) return null;
  if (j.revealStage === "slide" || j.revealStage === "top") return pick("closer");
  if (j.revealStage === "turned") return pick("eye");
  if (j.revealStage === "done") return pick("vision");
  return null;
}

/** Captions sit beside the contact bar, or above it on narrow screens. */
export default function StoryCaption({ journey }: { journey: Snapshot }) {
  const chapter = chapterFor(journey);
  if (!chapter) return null;
  // Touch screens tap rather than hover.
  const hint =
    chapter.hint && typeof matchMedia === "function" && matchMedia("(hover: none)").matches
      ? chapter.hint.replace(/^Hover/, "Tap")
      : chapter.hint;
  return (
    <div
      className="story-caption"
      key={chapter.key}
      role="note"
      aria-label={hint ? `${chapter.line} ${hint}` : chapter.line}
    >
      <p className="story-caption__line" aria-hidden="true">
        {chapter.line}
      </p>
      {hint ? (
        <p className="story-caption__hint" aria-hidden="true">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
