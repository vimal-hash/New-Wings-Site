"use client";

import { useSyncExternalStore } from "react";
import { themeSound } from "./theme-sound";

/**
 * The sound button: a tab on the right edge, the menu tab's mirror. Off until the visitor turns it on; shown from the
 * loader on, so the theme can meet the theatre opening. Four short bars move while sound is on (still under reduced
 * motion) and lie flat while it is off.
 */
export default function SoundToggle() {
  const sound = useSyncExternalStore(themeSound.subscribe, themeSound.read, themeSound.read);
  return (
    <button
      type="button"
      className="sound-toggle"
      data-on={sound.enabled ? "" : undefined}
      data-cinema-controls
      aria-pressed={sound.enabled}
      aria-label={sound.enabled ? "Turn sound off" : "Turn sound on"}
      onClick={() => themeSound.toggle()}
    >
      <span className="sound-toggle__bars" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="sound-toggle__label">Sound</span>
    </button>
  );
}
