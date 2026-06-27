import * as Tone from "tone";
import { AUDIO } from "../config";
import { getDroneChordNotes } from "./scale";

let contextUnlocked = false;
let droneActive = false;
let droneStarting = false;
let droneStopping = false;
let droneStopTimer = null;
let lastPingAt = 0;
let droneSynth = null;
let droneDryGain = null;
let droneWetGain = null;
let droneFilter = null;
let dronePanner = null;
let droneLfo = null;
let droneReverb = null;
let droneNotes = [];
let droneChordBlend = 0;
let droneLastGlideAt = 0;
let droneVoicingIndex = 0;
let droneProgressTimer = null;

const DRONE_VOICING_INTERVAL_MS = 12000;

function advanceDroneChord() {
  if (!droneActive || droneStopping) return;
  const voicings = AUDIO.DRONE.CHORD_VOICINGS;
  if (!voicings || voicings.length < 2) return;
  droneVoicingIndex = (droneVoicingIndex + 1) % voicings.length;
  const scale = AUDIO.B_MAJOR;
  const indices = voicings[droneVoicingIndex];
  const notes = [...new Set(indices.map((i) => scale[Math.max(0, Math.min(scale.length - 1, i))]))];
  retuneDroneToNotes(notes);
}

function disposeDroneNodes() {
  if (droneProgressTimer) { clearInterval(droneProgressTimer); droneProgressTimer = null; }
  droneSynth?.dispose();
  droneDryGain?.dispose();
  droneWetGain?.dispose();
  droneFilter?.dispose();
  dronePanner?.dispose();
  droneLfo?.dispose();
  droneReverb?.dispose();
  droneSynth = null;
  droneDryGain = null;
  droneWetGain = null;
  droneFilter = null;
  dronePanner = null;
  droneLfo = null;
  droneReverb = null;
  droneNotes = [];
  droneChordBlend = 0;
  droneLastGlideAt = 0;
  droneVoicingIndex = 0;
  droneActive = false;
  droneStarting = false;
  droneStopping = false;
}

function canPlayPing() {
  const minMs = AUDIO.PING_MIN_INTERVAL_MS ?? 0;
  if (minMs <= 0) return true;
  const now = performance.now();
  if (now - lastPingAt < minMs) return false;
  lastPingAt = now;
  return true;
}

async function ensureContextRunning() {
  await Tone.start();
  const dest = Tone.getDestination();
  if (dest.volume.value < -30) dest.volume.rampTo(0, 0.05);
  return Tone.getContext().state === "running";
}

function retuneDroneToNotes(next) {
  if (!droneSynth || droneStopping || next.length === 0) return;
  const prev = [...droneNotes];
  if (prev.join() === next.join()) return;
  const crossfade = AUDIO.DRONE.CHORD_CROSSFADE_S ?? 0.06;
  try {
    if (prev.length) droneSynth.triggerRelease(prev, Tone.now() + crossfade);
    droneNotes = next;
    droneSynth.triggerAttack(droneNotes, Tone.now() + crossfade);
  } catch (_) {}
}

let reverb = null;
function getReverb() {
  if (!reverb) {
    reverb = new Tone.Reverb(AUDIO.REVERB).toDestination();
  }
  return reverb;
}

let preDelay = null;
function getChain() {
  if (!preDelay) {
    preDelay = new Tone.FeedbackDelay(AUDIO.PRE_DELAY);
    preDelay.connect(getReverb());
  }
  return preDelay;
}

let charSynth = null;
let charDryGain = null;
let charWetGain = null;
let charReverb = null;

function getCharSynth() {
  if (!charSynth) {
    charReverb = new Tone.Reverb({ decay: 8, wet: 1 }).toDestination();
    charDryGain = new Tone.Gain(1).toDestination();
    charWetGain = new Tone.Gain(0.2).connect(charReverb);
    charSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
      volume: -10,
    });
    charSynth.connect(charDryGain);
    charSynth.connect(charWetGain);
  }
  return charSynth;
}

let circSynth = null;
function getCircSynth() {
  if (!circSynth) {
    circSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.2 },
      volume: -8,
    }).connect(getChain());
  }
  return circSynth;
}

let symSynth = null;
function getSymSynth() {
  if (!symSynth) {
    symSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.9, sustain: 0, release: 1.4 },
      volume: -18,
    }).connect(getChain());
  }
  return symSynth;
}

let kSynth = null;
let kReverb = null;
function getKChain() {
  if (!kReverb) {
    kReverb = new Tone.Reverb({ decay: 6, wet: 0.88 }).toDestination();
    kSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 3.0 },
      volume: -12,
    }).connect(kReverb);
  }
  return kSynth;
}

// Spread voicings in B major — each press picks one
const K_VOICINGS = [
  ["B2", "F#3", "D#4", "B4", "F#4"],
  ["B3", "D#4", "F#4", "A#4", "B4"],
  ["F#3", "B3", "D#4", "F#4", "B5"],
  ["D#4", "F#4", "A#4", "B4", "D#5"],
  ["B2", "B3", "F#4", "D#5", "B5"],
];

function randomKConfig() {
  return K_VOICINGS[Math.floor(Math.random() * K_VOICINGS.length)];
}

let chordSynth = null;
function getChordSynth() {
  if (!chordSynth) {
    chordSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: AUDIO.CHORD_POLYPHONY ?? 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.06, decay: 1.2, sustain: 0.15, release: 2.0 },
      volume: -10,
    }).connect(getChain());
  }
  return chordSynth;
}

function charToNote(ch) {
  const code = ch.charCodeAt(0);
  return AUDIO.CHORD_TONES[code % AUDIO.CHORD_TONES.length];
}

export function playChord(ingestedChars) {
  if (ingestedChars.length === 0) return;
  const notes = [...new Set(ingestedChars.map((ic) => charToNote(ic.ch)))];
  try {
    const synth = getChordSynth();
    synth.releaseAll();
    synth.triggerAttackRelease(notes, "4n");
  } catch (_) {}
}

function yToNote(y, height, lo, hi) {
  const t = 1 - Math.max(0, Math.min(1, y / height));
  const idx = Math.round(lo + t * (hi - lo));
  return AUDIO.B_MAJOR[Math.max(lo, Math.min(hi, idx))];
}

/** k key — randomised one-shot chord with tremolo + heavy reverb. */
export async function playKSynth() {
  if (!(await ensureContextRunning())) return;
  const voicing = randomKConfig();
  try {
    getKChain().triggerAttackRelease(voicing, "2n", Tone.now() + 0.01);
  } catch (err) {
    console.error("playKSynth failed:", err);
  }
}

/** Cursor controls stereo pan only (X axis: left ↔ right). */
export function updateDroneFromCursor(x, y, width, height) {
  if (!droneActive || !droneSynth || droneStopping || !dronePanner) return;
  const xT = Math.max(0, Math.min(1, x / Math.max(1, width)));
  dronePanner.pan.value = (xT - 0.5) * 2;
}

export async function playCharPing(y, height, opacity = 1) {
  if (!(await ensureContextRunning()) || !canPlayPing()) return;
  getCharSynth();
  const o = Math.max(0.06, Math.min(1, opacity));
  charDryGain.gain.value = o;
  charWetGain.gain.value = 0.12 + (1 - o) * 0.88;
  charSynth.volume.value = -10 - (1 - o) * 26;
  try { charSynth.triggerAttackRelease(yToNote(y, height, 14, 21), "32n"); } catch (_) {}
}

export async function playCircPing(y, height) {
  if (!(await ensureContextRunning()) || !canPlayPing()) return;
  try { getCircSynth().triggerAttackRelease(yToNote(y, height, 0, 6), "8n"); } catch (_) {}
}

export async function playSymPing(y, height) {
  if (!(await ensureContextRunning()) || !canPlayPing()) return;
  try { getSymSynth().triggerAttackRelease(yToNote(y, height, 9, 15), "8n"); } catch (_) {}
}

/** Scanner spin begins — always fires (not gated by PING_MIN_INTERVAL_MS). */
export async function playSpinStartPing(y, height) {
  if (!(await ensureContextRunning())) return;
  try { getCircSynth().triggerAttackRelease(yToNote(y, height, 9, 16), "32n"); } catch (_) {}
}

export async function startAmbientDrone() {
  if (droneActive || droneStarting) return;

  if (droneStopTimer) {
    clearTimeout(droneStopTimer);
    droneStopTimer = null;
  }
  if (droneStopping || droneSynth) {
    disposeDroneNodes();
  }

  droneStarting = true;
  const d = AUDIO.DRONE;

  try {
    await ensureContextRunning();

    droneVoicingIndex = 0;
    droneChordBlend = 0;
    droneLastGlideAt = performance.now();
    droneNotes = getDroneChordNotes(0);
    if (!droneNotes.length) {
      console.warn("Drone: no chord notes");
      return;
    }

    droneDryGain = new Tone.Gain(d.DRY_GAIN ?? 0.28);
    droneDryGain.toDestination();

    droneWetGain = new Tone.Gain(d.WET_GAIN ?? 0.1);
    droneReverb = new Tone.Reverb(d.REVERB);
    await droneReverb.generate();
    droneWetGain.connect(droneReverb);
    droneReverb.toDestination();

    droneFilter = new Tone.Filter(d.FILTER_HZ ?? 900, "lowpass");
    droneFilter.frequency.value = d.FILTER_HZ ?? 900;

    dronePanner = new Tone.Panner(0);

    droneSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: AUDIO.DRONE_POLYPHONY ?? 8,
      oscillator: { type: "sine" },
      envelope: {
        attack: d.ATTACK_S,
        decay: 0.05,
        sustain: 1,
        release: d.RELEASE_S,
      },
      volume: d.VOLUME_DB,
    });
    if (droneSynth.detune) {
      droneSynth.detune.value = d.BASE_DETUNE_CENTS ?? 0;
    }

    // chain: synth → filter → panner → dry/wet split
    droneSynth.connect(droneFilter);
    droneFilter.connect(dronePanner);
    dronePanner.connect(droneDryGain);
    dronePanner.connect(droneWetGain);

    const lfoHz = d.LFO_HZ ?? 0;
    if (lfoHz > 0) {
      const depth = d.LFO_DEPTH_HZ ?? 40;
      droneLfo = new Tone.LFO({ frequency: lfoHz, min: -depth, max: depth });
      droneLfo.connect(droneWetGain.gain);
      droneLfo.start();
    }

    const t = Tone.now() + 0.02;
    droneSynth.triggerAttack(droneNotes, t);
    droneActive = true;
    droneStopping = false;

    droneProgressTimer = setInterval(advanceDroneChord, DRONE_VOICING_INTERVAL_MS);
  } catch (err) {
    console.error("startAmbientDrone failed:", err);
    disposeDroneNodes();
  } finally {
    droneStarting = false;
  }
}

export function stopAmbientDrone() {
  if (!droneActive || droneStopping) return;
  droneStopping = true;
  droneActive = false;

  const d = AUDIO.DRONE;
  const fadeS = d.STOP_FADE_S ?? d.RELEASE_S;
  const tailMs = (fadeS + d.REVERB.decay + 2) * 1000;

  if (droneProgressTimer) { clearInterval(droneProgressTimer); droneProgressTimer = null; }
  try {
    droneLfo?.stop();
    if (droneDryGain) droneDryGain.gain.rampTo(0, fadeS);
    if (droneWetGain) droneWetGain.gain.rampTo(0, fadeS);
    if (droneSynth) droneSynth.triggerRelease(droneNotes);
  } catch (_) {}

  if (droneStopTimer) clearTimeout(droneStopTimer);
  droneStopTimer = setTimeout(() => {
    droneStopTimer = null;
    disposeDroneNodes();
  }, tailMs);
}

/** Unlocks the audio context only (browser requires a user gesture). Does not start drone. */
export async function ensureAudioContext() {
  await ensureContextRunning();
  getKChain();
  contextUnlocked = true;
}

/** @deprecated Use ensureAudioContext — kept for ping/key handlers. */
export async function ensureAudioStarted() {
  await ensureAudioContext();
}

/** Start sustained drone when the scanner wheel begins moving. */
export async function startDroneForWheel() {
  await ensureAudioContext();
  if (droneActive || droneStarting) return;
  try {
    await startAmbientDrone();
  } catch (err) {
    console.error("Failed to start ambient drone:", err);
  }
}

/** Fade out drone when the wheel stops. */
export function stopDroneForWheel() {
  stopAmbientDrone();
}

export { Tone };
