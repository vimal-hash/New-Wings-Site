"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
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
  // ?end comes in at section 4, as the page does when it is returned to.
  useState(() => {
    if (typeof location !== "undefined" && new URLSearchParams(location.search).has("end"))
      journeyControls.update({ pageAtEnd: true });
  });
  useEffect(() => {
    journeyControls.update({ phase: "page" });
  }, []);
  return <NormalPage />;
}
