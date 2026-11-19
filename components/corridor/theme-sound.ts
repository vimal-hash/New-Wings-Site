// The opening cue follows the theatre camera. On the first scroll the journey theme plays from
// its beginning, then repeats its middle phrase on whole bars, even when the camera rests.
import { assetURL } from "./asset-url";
import { journeyControls } from "./journey-controls";
import { DROP_BARS, OPENING_ECHO } from "./story-beat";

type Cue = "opening" | "drop" | "hum";
const FILES: Record<Cue, string> = {
  opening: "/sound/theme-opening.mp3",
  drop: "/sound/theme-drop.mp3",
  hum: "/sound/projector-hum.mp3",
};
/** Whole-site level: the song is mastered like a record (drop at -12 LUFS); a page plays it a little softer. */
const MASTER = 0.6;
/** The hum: copies of HUM.length seconds from HUM.offset, overlapping by HUM.overlap. Both are whole turns of the
 *  24 Hz motor, so the overlapping copies hum in step and only the film crackle crossfades. */
const HUM = { offset: 0.5, length: 20, overlap: 2, level: 1 };
/** Four whole bars from the second orchestral round up to the final chord. */
const LOOP = { start: DROP_BARS.roundTwo, end: DROP_BARS.lastChord };

type State = { enabled: boolean; loading: boolean };
let state: State = { enabled: false, loading: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

type Voice = "opening" | "theme";
let context: AudioContext | null = null,
  master: GainNode | null = null,
  humBus: GainNode | null = null,
  humNext = 0,
  humOn = false,
  humTimer = 0,
  themeOffset: number | null = null,
  /** The visitor turned sound off with the Sound tab: no click turns it back on by itself. */
  chosenOff = false,
  armed = false,
  unsubscribe: (() => void) | null = null;
const buffers = new Map<Cue, Promise<AudioBuffer | null>>();
const playing = new Map<Voice, { source: AudioBufferSourceNode; level: GainNode }>();
let openingPlayed = false;

function load(cue: Cue) {
  let promise = buffers.get(cue);
  if (!promise) {
    const audio = context!;
    promise = fetch(assetURL(FILES[cue]))
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(response.status)))
      .then((data) => audio.decodeAudioData(data))
      .catch(() => null);
    buffers.set(cue, promise);
  }
  return promise;
}

function stop(name: Voice, fade = 0.4) {
  const voice = playing.get(name);
  if (!voice || !context) return;
  playing.delete(name);
  const now = context.currentTime;
  voice.level.gain.cancelScheduledValues(now);
  voice.level.gain.setValueAtTime(voice.level.gain.value, now);
  voice.level.gain.linearRampToValueAtTime(0, now + fade);
  voice.source.stop(now + fade + 0.05);
}

/** One-shot opening or one continuous journey source. The audio device handles the loop boundary. */
function voice(name: Voice, buffer: AudioBuffer, offset: number) {
  if (!context || !master || playing.has(name)) return;
  const at = context.currentTime + 0.02;
  const source = context.createBufferSource(),
    level = context.createGain();
  source.buffer = buffer;
  if (name === "theme") {
    source.loop = true;
    source.loopStart = LOOP.start;
    source.loopEnd = LOOP.end;
    if (offset > 0) {
      level.gain.setValueAtTime(0, at);
      level.gain.linearRampToValueAtTime(1, at + 0.4);
    }
  }
  source.connect(level).connect(master);
  source.start(at, offset);
  playing.set(name, { source, level });
  source.onended = () => {
    if (playing.get(name)?.source === source) playing.delete(name);
  };
}

/** The hum: overlapping copies, each faded in and out over the overlap, kept a few seconds ahead. */
function scheduleHum() {
  if (!context || !humBus || !humOn) return;
  void load("hum").then((buffer) => {
    if (!buffer || !context || !humBus || !humOn) return;
    const { offset, length, overlap } = HUM;
    while (humNext < context.currentTime + 4) {
      const at = Math.max(humNext, context.currentTime + 0.05),
        source = context.createBufferSource(),
        level = context.createGain();
      source.buffer = buffer;
      level.gain.setValueAtTime(0, at);
      level.gain.linearRampToValueAtTime(1, at + overlap);
      level.gain.setValueAtTime(1, at + length - overlap);
      level.gain.linearRampToValueAtTime(0, at + length);
      source.connect(level).connect(humBus);
      source.start(at, offset, length);
      humNext = at + length - overlap;
    }
  });
}
function hum(on: boolean, fade: number, delay = 0) {
  if (!context || !humBus) return;
  const now = context.currentTime,
    at = now + delay;
  humBus.gain.cancelScheduledValues(now);
  humBus.gain.setValueAtTime(humBus.gain.value, now);
  humBus.gain.setValueAtTime(humBus.gain.value, at);
  humBus.gain.linearRampToValueAtTime(on ? HUM.level : 0, at + fade);
  if (on && !humOn) {
    humOn = true;
    humNext = at;
    scheduleHum();
    humTimer = window.setInterval(scheduleHum, 1000);
  }
  if (!on && humOn) {
    // Keep the copies already scheduled; they run out under the fade.
    humOn = false;
    window.clearInterval(humTimer);
  }
}

type Snapshot = ReturnType<typeof journeyControls.read>;
// Removing the glasses publishes one last idle snapshot before the camera enters glassesExit.
const beforeFirstScroll = (j: Snapshot) => j.phase === "intro" || (j.phase === "idle" && j.cinemaStage !== "clear");
const atEnd = (j: Snapshot) => j.phase === "logoDone" && j.finalCovered;

async function playOpening(movedAt: number) {
  openingPlayed = true;
  const buffer = await load("opening");
  if (!buffer || !context || !state.enabled || themeOffset !== null || !beforeFirstScroll(journeyControls.read())) {
    if (!playing.has("opening")) openingPlayed = false;
    return;
  }
  // In step with the opening camera (and so the room tour): as far in as the camera is, plus the speakers' own delay.
  const latency = context.outputLatency || context.baseLatency || 0;
  let offset = (performance.now() - movedAt) / 1000 + 0.02 + latency;
  // Too late to meet the tour on its echo (sound turned on afterwards): the cue plays from its start.
  if (offset > OPENING_ECHO.first - 0.3) offset = 0;
  voice("opening", buffer, offset);
}

async function playTheme(offset: number) {
  const buffer = await load("drop");
  if (buffer && state.enabled) voice("theme", buffer, offset);
}

function follow(j: Snapshot, was: Snapshot | null) {
  if (!state.enabled || !context) return;
  if (themeOffset === null && beforeFirstScroll(j)) {
    if (j.openingMoving && !openingPlayed) void playOpening(j.openingMovedAt);
    return;
  }

  // Start once. Returning to the theatre, jumping by menu or reaching the end
  // leaves this same source playing. Unmuting resumes its suspended audio clock.
  if (themeOffset === null || !was) {
    const firstScroll = was?.phase === "idle" && (j.phase === "glassesExit" || j.phase === "pullback");
    themeOffset ??= firstScroll ? 0 : LOOP.start;
    stop("opening", 0.5);
    if (!playing.has("theme")) void playTheme(themeOffset);
    if (!humOn && !atEnd(j)) hum(true, 3, firstScroll ? LOOP.start - 1 : 0);
  }
  // Fade only the projector ambience at the end page.
  if (atEnd(j) && humOn) hum(false, 3);
  else if (was && atEnd(was) && !atEnd(j)) hum(true, 3, 0.5);
}

function start() {
  if (!context) {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return false;
    context = new Audio();
    master = context.createGain();
    master.connect(context.destination);
    humBus = context.createGain();
    humBus.gain.value = 0;
    humBus.connect(master);
    set({ loading: true });
    void Promise.all((Object.keys(FILES) as Cue[]).map(load)).then(() => set({ loading: false }));
    document.addEventListener("visibilitychange", () => {
      if (!context) return;
      if (document.hidden) void context.suspend();
      else if (state.enabled) void context.resume();
    });
  }
  void context.resume();
  const now = context.currentTime;
  master!.gain.cancelScheduledValues(now);
  master!.gain.setValueAtTime(0, now);
  master!.gain.linearRampToValueAtTime(MASTER, now + 0.4);
  return true;
}

function turnOn() {
  if (!start()) return;
  set({ enabled: true });
  let was = journeyControls.read();
  follow(was, null);
  unsubscribe ??= journeyControls.subscribe(() => {
    const now = journeyControls.read();
    if (now === was) return;
    follow(now, was);
    was = now;
  });
}

export const themeSound = {
  read: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Call from the click itself: browsers only start sound inside a visitor's gesture. */
  toggle() {
    if (state.enabled) {
      chosenOff = true;
      set({ enabled: false });
      if (context && master) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.3);
        const audio = context;
        window.setTimeout(() => {
          if (!state.enabled) void audio.suspend();
        }, 350);
      }
      return;
    }
    chosenOff = false;
    turnOn();
  },
  /**
   * The music comes on with the visitor's first click, tap or key press anywhere (user 2026-11-19: "if user clicks any
   * button music on"), unless they turned it off with the Sound tab. A wheel scroll or a swipe is no such gesture, so
   * nothing happens on those. Returns the clean-up.
   */
  arm() {
    if (armed) return () => {};
    armed = true;
    const types = ["pointerdown", "pointerup", "keydown", "touchend"] as const;
    const wake = (event: Event) => {
      if (state.enabled || chosenOff) return;
      if (event.target instanceof Element && event.target.closest("[data-sound-toggle]")) return;
      if (event instanceof PointerEvent && (event.type === "pointerdown") !== (event.pointerType === "mouse")) return;
      if (event instanceof KeyboardEvent && (event.repeat || event.key === "Escape")) return;
      // Only a gesture the browser counts lets the sound start; anything else would leave the button on and silent.
      const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (activation && !activation.isActive) return;
      turnOn();
    };
    types.forEach((type) => window.addEventListener(type, wake, { capture: true, passive: true }));
    return () => {
      armed = false;
      types.forEach((type) => window.removeEventListener(type, wake, { capture: true }));
    };
  },
};
