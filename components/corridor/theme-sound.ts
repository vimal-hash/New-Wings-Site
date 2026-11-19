// The New Wings theme (draft 1.4), placed on the story. Four files cut from the one mastered song (public/sound/):
//   opening  0:00-0:06.6  projector start-up, the glass keys, the long E and its echo turning round the head
//   drop     from 0:07.5  the whoomp, the riser and the orchestra's two rounds; its last chord rings out on its own
//   end      from 0:27.2  the projector winds down, the keys play the first notes again, the film runs out, lamp off
//   hum      20 s of the projector running in its booth, played in overlapping copies under the rest of the journey
// Nothing new is made: the picture is matched to these sounds (story-beat.ts has the bar lines).
// Sound is off until the visitor turns it on or clicks, taps or presses a key anywhere (browsers only allow sound
// after one); the files are fetched only then. Story moments (journey-controls.ts):
//   - the opening as the opening camera starts to move, so its echo falls on the room tour (hover-catalogue.tsx);
//   - each forward camera move of the journey plays its own bars of the drop, ending on a bar line as the camera
//     reaches its stop (the first scroll to the exploded projector; the build and the walk to the drawings; the walk on
//     to the liquid sphere, whose last chord lands as the camera stops there and rings out). At the stops the music
//     holds softly on the projector hum;
//   - from the Reel One white (its title line starting to write): the long E and its echo, then the drop from its
//     whoomp, its two rounds looping without a break through the sections and back to the eye;
//   - the end each time the last white page covers the eye.
import { assetURL } from "./asset-url";
import { journeyControls, type JourneyPhase } from "./journey-controls";
import { BEAT, DROP_BARS, OPENING_ECHO } from "./story-beat";

type Cue = "opening" | "drop" | "end" | "hum";
const FILES: Record<Cue, string> = {
  opening: "/sound/theme-opening.mp3",
  drop: "/sound/theme-drop.mp3",
  end: "/sound/theme-end.mp3",
  hum: "/sound/projector-hum.mp3",
};
/** Whole-site level: the song is mastered like a record (drop at -12 LUFS); a page plays it a little softer. */
const MASTER = 0.6;
/** The hum: copies of HUM.length seconds from HUM.offset, overlapping by HUM.overlap. Both are whole turns of the
 *  24 Hz motor, so the overlapping copies hum in step and only the film crackle crossfades. */
const HUM = { offset: 0.5, length: 20, overlap: 2, level: 1 };
/** The journey's forward camera moves and the bars of the drop each plays (seconds into theme-drop.mp3). */
const PARTS = {
  projector: { from: 0, to: DROP_BARS.roundTwo }, // whoomp, riser, round 1
  drawings: { from: DROP_BARS.roundTwo, to: DROP_BARS.lastBar }, // round 2's first three bars
  sphere: { from: DROP_BARS.lastBar, to: Infinity }, // round 2's last bar, then the last chord rings out
} as const;
type Part = keyof typeof PARTS;
/** The sections' loop: the drop's two rounds, bar line to bar line. */
const LOOP = { start: DROP_BARS.roundOne, end: DROP_BARS.lastChord };

type State = { enabled: boolean; loading: boolean };
let state: State = { enabled: false, loading: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

type Voice = "opening" | "part" | "echo" | "sections" | "end";
let context: AudioContext | null = null,
  master: GainNode | null = null,
  humBus: GainNode | null = null,
  humNext = 0,
  humOn = false,
  humTimer = 0,
  part: { name: Part; at: number } | null = null,
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

/** Plays `buffer` from `offset` at context time `at`, for `duration` seconds (to its end when Infinity), as `name`. */
function voice(
  name: Voice,
  buffer: AudioBuffer,
  at: number,
  offset: number,
  options: { duration?: number; fadeIn?: number; fadeOut?: number; loop?: boolean } = {},
) {
  if (!context || !master) return;
  stop(name, 0.25);
  const { duration = Infinity, fadeIn = 0, fadeOut = 0, loop = false } = options;
  const source = context.createBufferSource(),
    level = context.createGain();
  source.buffer = buffer;
  if (loop) {
    source.loop = true;
    source.loopStart = LOOP.start;
    source.loopEnd = LOOP.end;
  }
  level.gain.setValueAtTime(fadeIn ? 0.0001 : 1, at);
  if (fadeIn) level.gain.exponentialRampToValueAtTime(1, at + fadeIn);
  const length = Math.min(duration, buffer.duration - offset);
  if (!loop && fadeOut && Number.isFinite(duration)) {
    // The part dies away over its last beat, like a phrase let go, and ends on its bar line.
    level.gain.setValueAtTime(1, at + length - fadeOut);
    level.gain.exponentialRampToValueAtTime(0.0001, at + length);
  }
  source.connect(level).connect(master);
  if (loop) source.start(at, offset);
  else source.start(at, offset, length);
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
const beforeFirstScroll = (j: Snapshot) => j.phase === "intro" || (j.phase === "idle" && j.cinemaStage === "wearing");
const atEnd = (j: Snapshot) => j.phase === "logoDone" && j.finalCovered;
/** The forward order of the journey's phases: a step to an earlier one is a move back. */
const ORDER: JourneyPhase[] = [
  "intro",
  "idle",
  "glassesExit",
  "pullback",
  "hold",
  "approach",
  "reveal",
  "awaitAssembly",
  "returnHold",
  "return",
  "done",
  "screens",
  "drawings",
  "corridor",
  "panel",
  "page",
  "pageReturnLoading",
  "logoReveal",
  "logoDone",
];
const SECTIONS: JourneyPhase[] = ["page", "pageReturnLoading", "logoReveal", "logoDone"];
const inJourney = (phase: JourneyPhase) => ORDER.indexOf(phase) <= ORDER.indexOf("corridor");

/** Which forward camera move has just begun, if any. */
function partFor(from: JourneyPhase, to: JourneyPhase): Part | null {
  if (from === "idle" && (to === "glassesExit" || to === "pullback")) return "projector";
  if (from === "awaitAssembly" && to === "returnHold") return "drawings";
  // Phones rest at the projector with no build; computers already play this part from the build.
  if (from === "done" && to === "screens" && !(part?.name === "drawings" && performance.now() - part.at < 9000))
    return "drawings";
  if (from === "drawings" && to === "corridor") return "sphere";
  return null;
}

async function playPart(name: Part) {
  part = { name, at: performance.now() };
  const buffer = await load("drop");
  if (!buffer || !context || !state.enabled || part?.name !== name) return;
  const { from, to } = PARTS[name],
    at = context.currentTime + 0.02,
    offset = Math.max(0, from - 0.02);
  voice("part", buffer, at, offset, {
    duration: to - offset,
    fadeIn: from > 0 ? 0.02 : 0,
    fadeOut: Number.isFinite(to) ? BEAT : 0,
  });
  // The first part's end: from here on the projector hums under the journey, so each stop holds softly.
  if (name === "projector" && !humOn) hum(true, 3, Math.max(0, to - offset - 1));
}

async function playOpening(movedAt: number) {
  openingPlayed = true;
  const buffer = await load("opening");
  if (!buffer || !context || !state.enabled || !beforeFirstScroll(journeyControls.read())) {
    if (!playing.has("opening")) openingPlayed = false;
    return;
  }
  // In step with the opening camera (and so the room tour): as far in as the camera is, plus the speakers' own delay.
  const latency = context.outputLatency || context.baseLatency || 0;
  let offset = (performance.now() - movedAt) / 1000 + 0.02 + latency;
  // Too late to meet the tour on its echo (sound turned on afterwards): the cue plays from its start.
  if (offset > OPENING_ECHO.first - 0.3) offset = 0;
  voice("opening", buffer, context.currentTime + 0.02, offset);
}

async function playSections(withEcho: boolean) {
  if (playing.has("sections") || !context) return;
  stop("part", 1.5);
  const [drop, opening] = await Promise.all([load("drop"), withEcho ? load("opening") : null]);
  if (!drop || !context || !state.enabled || playing.has("sections")) return;
  const now = context.currentTime + 0.02;
  if (withEcho && opening) {
    // The long E and its echo while the title writes in, then the drop from its whoomp: its first downbeat lands as
    // the white lifts.
    const from = OPENING_ECHO.longE - 0.01;
    voice("echo", opening, now, from, { duration: OPENING_ECHO.end - from });
    voice("sections", drop, now + OPENING_ECHO.end - from, 0, { loop: true });
  } else voice("sections", drop, now, LOOP.start, { loop: true, fadeIn: 2 });
}

async function playEnd() {
  const buffer = await load("end");
  if (!buffer || !context || !state.enabled || !atEnd(journeyControls.read()) || playing.has("end")) return;
  voice("end", buffer, context.currentTime + 0.02, 0);
}

/** What the story asks for now; `was` is the previous moment (null when the sound has just been turned on). */
function follow(j: Snapshot, was: Snapshot | null) {
  if (!state.enabled || !context) return;
  if (atEnd(j)) {
    if (!was || !atEnd(was)) {
      hum(false, 3);
      stop("part", 3);
      stop("echo", 3);
      stop("sections", 3);
      void playEnd();
    }
    return;
  }
  if (was && atEnd(was)) {
    // Back from the last page: the projector runs again and the sections' music comes back.
    stop("end", 1.5);
    hum(true, 3, 0.5);
    void playSections(false);
    return;
  }
  if (beforeFirstScroll(j)) {
    if (j.openingMoving && !openingPlayed) void playOpening(j.openingMovedAt);
    return;
  }
  if (!was || beforeFirstScroll(was)) stop("opening", 0.5);
  const move = was ? partFor(was.phase, j.phase) : null;
  if (move) void playPart(move);
  else if (was && ORDER.indexOf(j.phase) < ORDER.indexOf(was.phase) && playing.has("part")) {
    // Walking back: the part gives way to the hum.
    part = null;
    stop("part", 0.8);
  }
  // Back from the sections into the corridor (or a jump there): their music goes.
  if (inJourney(j.phase) && (playing.has("sections") || playing.has("echo"))) {
    stop("sections", 1.5);
    stop("echo", 1.5);
  }
  if (!was) {
    // Turned on past the theatre: the projector hums, and in the sections their music plays.
    hum(true, 2);
    if (SECTIONS.includes(j.phase) && !j.leavingPage) void playSections(false);
  } else if (!humOn && !move && !part) hum(true, 2); // (a part asked for is still loading: it brings the hum itself)
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

/** The Reel One white (and any section's title card) has started to write its line. */
function titleStarted() {
  if (!state.enabled || !context || atEnd(journeyControls.read())) return;
  void playSections(true);
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
    const title = () => titleStarted();
    window.addEventListener("nw:title", title);
    return () => {
      armed = false;
      types.forEach((type) => window.removeEventListener(type, wake, { capture: true }));
      window.removeEventListener("nw:title", title);
    };
  },
};
