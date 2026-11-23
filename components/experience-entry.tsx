"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, type ReactNode } from "react";
import { supportsTheatreGraphics } from "./corridor/graphics-support";
import { journeyControls } from "./corridor/journey-controls";
import { projectorControls } from "./corridor/projector-controls";
import { onVisibleLoadTimeout, switchToOverview } from "./corridor/overview-fallback";

function Opening() {
  return (
    <div className="site-loader">
      <p role="status">Loading New Wings Solutions…</p>
    </div>
  );
}

const Theatre = dynamic(() => {
  // Only a supported 3D visit requests the opening. Let its files and the speed
  // test start while the larger theatre bundle is still in flight.
  void import("./corridor/opening-files").then((m) => m.startOpeningDownloads()).catch(() => {});
  void import("./corridor/effect-quality").then((m) => m.prepareQuality()).catch(() => {});
  return import("./corridor/experience");
}, { ssr: false, loading: Opening });

class TheatreBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    switchToOverview();
  }
  render() {
    return this.state.failed ? <Opening /> : this.props.children;
  }
}

function TheatreVisit() {
  useEffect(() => {
    const ready = () => journeyControls.read().openingPrepared && projectorControls.read().ready;
    const stopWaiting = onVisibleLoadTimeout(() => {
      if (!ready()) switchToOverview();
    });
    function check() {
      if (projectorControls.read().failed) switchToOverview();
      if (ready()) {
        offJourney();
        stopWaiting();
      }
    }
    const offJourney = journeyControls.subscribe(check);
    const offProjector = projectorControls.subscribe(check);
    check();
    function lost(event: Event) {
      if (event.target instanceof HTMLCanvasElement && event.target.closest(".corridor-study"))
        switchToOverview();
    }
    document.addEventListener("webglcontextlost", lost, true);
    return () => {
      stopWaiting();
      offProjector();
      offJourney();
      document.removeEventListener("webglcontextlost", lost, true);
    };
  }, []);
  return (
    <TheatreBoundary>
      <Theatre />
    </TheatreBoundary>
  );
}

const Experience = dynamic(
  async () => {
    if (new URLSearchParams(location.search).get("view") !== "overview" && supportsTheatreGraphics())
      return TheatreVisit;
    return (await import("./overview/theatre-overview")).default;
  },
  { ssr: false, loading: Opening },
);

export default function ExperienceEntry() {
  return <Experience />;
}
