// The New Wings theme (draft 1.4), placed on the story. Four files cut from the one mastered song (public/sound/):
//   opening  0:00-0:06.6  projector start-up, the glass keys, the long E and its echo turning round the head
//   drop     from 0:07.5  the whoomp, the riser and the orchestra; its last chord rings out on its own
//   end      from 0:27.2  the projector winds down, the keys play the first notes again, the film runs out, lamp off
//   hum      20 s of the projector running in its booth, played in overlapping copies under the rest of the journey
// Sound is off until the visitor turns it on (browsers only allow sound after a click); the files are fetched only
// then. Story moments (journey-controls.ts): the opening plays when the theatre opens, the drop on the first scroll
// (glasses off, house lights up) or the first jump past the theatre, the hum after the drop, the end when the last
// white page covers the eye. Each cue plays once with sound on, except the end, which plays on each arrival.
import { assetURL } from "./asset-url";
import { journeyControls } from "./journey-controls";

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
/** Into the drop cue, where its last chord is ringing and the hum starts to come in (and how long it takes). */
const HUM_AFTER_DROP = { at: 21, fade: 6 };

type State = { enabled: boolean; loading: boolean };
let state: State = { enabled: false, loading: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

let context: AudioContext | null = null,
  master: GainNode | null = null,
  humBus: GainNode | null = null,
  humNext = 0,
  humOn = false,
  humTimer = 0,
  dropAt = -1,
  unsubscribe: (() => void) | null = null;
const buffers = new Map<Cue, Promise<AudioBuffer | null>>();
const playing = new Map<Cue, { source: AudioBufferSourceNode; level: GainNode }>();
const played = new Set<Cue>(),
  /** Asked for and still loading: not playing yet, but already taken. */
  pending = new Set<Cue>();

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

function stop(cue: Cue, fade = 0.4) {
  const voice = playing.get(cue);
  if (!voice || !context) return;
  playing.delete(cue);
  const now = context.currentTime;
  voice.level.gain.cancelScheduledValues(now);
  voice.level.gain.setValueAtTime(voice.level.gain.value, now);
  voice.level.gain.linearRampToValueAtTime(0, now + fade);
  voice.source.stop(now + fade + 0.05);
}

/** Plays a cue once its file is in, if `still()` says the moment has not passed meanwhile. */
async function play(cue: Exclude<Cue, "hum">, still: () => boolean = () => true) {
  if (playing.has(cue) || pending.has(cue)) return;
  played.add(cue);
  pending.add(cue);
  const buffer = await load(cue);
  pending.delete(cue);
  if (!buffer || !context || !master || !state.enabled || !still() || playing.has(cue)) {
    // Not heard: it can still play at its next chance.
    if (!playing.has(cue)) played.delete(cue);
    return;
  }
  const source = context.createBufferSource(),
    level = context.createGain();
  source.buffer = buffer;
  source.connect(level).connect(master);
  const at = context.currentTime + 0.02;
  source.start(at);
  playing.set(cue, { source, level });
  source.onended = () => {
    if (playing.get(cue)?.source === source) playing.delete(cue);
  };
  if (cue === "drop") dropAt = at;
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

/** What the story asks for now; `was` is the previous moment (null when the sound has just been turned on). */
function follow(j: Snapshot, was: Snapshot | null) {
  if (!state.enabled || !context) return;
  if (atEnd(j)) {
    if (!was || !atEnd(was)) {
      hum(false, 3);
      stop("drop", 3);
      if (!playing.has("end")) void play("end", () => atEnd(journeyControls.read()));
    }
    return;
  }
  if (was && atEnd(was)) {
    // Back from the last page: the projector runs again.
    stop("end", 1.5);
    if (played.has("drop")) hum(true, 3, 0.5);
  }
  if (beforeFirstScroll(j)) {
    if (j.loaderDone && !played.has("opening")) void play("opening", () => beforeFirstScroll(journeyControls.read()));
    return;
  }
  if (!played.has("drop")) {
    stop("opening", 0.5);
    void play("drop").then(() => {
      if (!context || dropAt < 0) return;
      hum(true, HUM_AFTER_DROP.fade, Math.max(0, dropAt + HUM_AFTER_DROP.at - context.currentTime));
    });
  } else if (!humOn && !playing.has("drop") && !pending.has("drop")) hum(true, 2);
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
  },
};
