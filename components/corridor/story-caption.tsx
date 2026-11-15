"use client";

import { journeyControls, type JourneyPhase } from "./journey-controls";

type Snapshot = ReturnType<typeof journeyControls.read>;
export type Chapter = { key: string; line: string; hint: string };

/**
 * The story told at each resting stop: one line and one quiet hint.
 * Short on purpose. The scene carries the feeling; the words only name it.
 */
const CHAPTERS: Record<string, Omit<Chapter, "key">> = {
  theatre: { line: "Lights down. The room goes quiet. This is the moment we build for.", hint: "Hover the room · Scroll to step back" },
  parts: { line: "Every picture starts as light. Here is everything that makes it.", hint: "Hover a part · Scroll to put it together" },
  projector: { line: "Put together, it sends one clean beam to the screen.", hint: "Scroll on" },
  closer: { line: "Look closer. Our mark is made of light, like everything on the screen.", hint: "Scroll on" },
  eye: { line: "From the side, the wings become an eye. We build for people who love to watch.", hint: "Scroll on" },
  vision: { line: "Every light we place and every seat we fit serves one thing: the story.", hint: "Scroll to see where we are going" },
};

const LOGO = new Set<JourneyPhase>(["logoReveal", "logoDone"]);

/** Which chapter the visitor is resting in, or null while the camera travels. */
export function chapterFor(j: Snapshot): Chapter | null {
  const pick = (key: string) => ({ key, ...CHAPTERS[key] });
  switch (j.phase) {
    case "idle": return pick("theatre");
    case "awaitAssembly": return pick("parts");
    case "done": return pick("projector");
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
  const hint = typeof matchMedia === "function" && matchMedia("(hover: none)").matches ? chapter.hint.replace(/^Hover/, "Tap") : chapter.hint;
  return (
    <div className="story-caption" key={chapter.key} role="note" aria-label={`${chapter.line} ${hint}`}>
      <p className="story-caption__line" aria-hidden="true">{chapter.line}</p>
      <p className="story-caption__hint" aria-hidden="true">{hint}</p>
    </div>
  );
}
