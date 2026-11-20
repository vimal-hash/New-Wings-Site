"use client";

import { useEffect, useSyncExternalStore } from "react";
import { themeSound } from "./theme-sound";

export default function SoundToggle() {
  const sound = useSyncExternalStore(themeSound.subscribe, themeSound.read, themeSound.read);
  // Any click, tap or key press on the page turns the music on (theme-sound.ts), unless this tab turned it off.
  useEffect(() => themeSound.arm(), []);
  return (
    <button
      type="button"
      className="sound-toggle"
      data-cinema-controls
      data-sound-toggle
      aria-pressed={sound.enabled}
      aria-label={sound.enabled ? "Turn sound off" : "Turn sound on"}
      onClick={() => themeSound.toggle()}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h4l5-4v14l-5-4H3z" />
        <path d={sound.enabled ? "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" : "M16 9l6 6m0-6-6 6"} />
      </svg>
      <span className="sound-toggle__label">Sound</span>
    </button>
  );
}
