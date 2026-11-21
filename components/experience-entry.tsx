"use client";

import dynamic from "next/dynamic";
import { supportsTheatreGraphics } from "./corridor/graphics-support";
import OverviewLink from "./overview/overview-link";

const Experience = dynamic(
  async () => {
    if (new URLSearchParams(location.search).get("view") !== "overview" && supportsTheatreGraphics()) {
      try {
        return (await import("./corridor/experience")).default;
      } catch {
        // The scene bundle itself can fail before its React error boundary exists.
      }
    }
    return (await import("./overview/theatre-overview")).default;
  },
  {
    ssr: false,
    loading: () => (
      <div className="site-loader">
        <p role="status">Loading New Wings Solutions…</p>
        <OverviewLink />
      </div>
    ),
  },
);

export default function ExperienceEntry() {
  return <Experience />;
}
