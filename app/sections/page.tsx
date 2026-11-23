"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { journeyControls } from "@/components/corridor/journey-controls";
import { prepareQuality } from "@/components/corridor/effect-quality";

// Review link only: opens the real four sections straight away, without the journey before them. Like the journey,
// it waits for the graphics speed test, so the rope flight is chosen the same way.
const NormalPage = dynamic(
  () =>
    Promise.all([import("@/components/corridor/normal-page"), prepareQuality()]).then(([module]) => module),
  { ssr: false },
);
export default function Page() {
  useEffect(() => {
    journeyControls.update({ phase: "page" });
  }, []);
  return <NormalPage />;
}
