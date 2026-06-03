import * as Tone from "tone";
import { AUDIO } from "../config";

let audioStarted = false;
let droneActive = false;
let droneStarting = false;
let droneStopping = false;
let droneStopTimer = null;
let lastPingAt = 0;
let droneSynth = null;
let dronePitchShift = null;
let droneGain = null;
let droneFilter = null;
let droneLfo = null;
let droneReverb = null;
let droneNotes = [];

function disposeDroneNodes() {
  droneSynth?.dispose();
  dronePitchShift?.dispose();
  droneGain?.dispose();
  droneFilter?.dispose();
  droneLfo?.dispose();
  droneReverb?.dispose();
  droneSynth = null;
  dronePitchShift = null;
  droneGain = null;
  droneFilter = null;
  droneLfo = null;
  droneReverb = null;
  droneNotes = [];
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

function getDroneNotes() {
  const { CHORD_TONE_INDICES } = AUDIO.DRONE;
  const tones = AUDIO.CHORD_TONES;
  return CHORD_TONE_INDICES.map((i) => tones[i % tones.length]);
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

function yToScaleIndex(y, height, lo, hi) {
  const t = 1 - Math.max(0, Math.min(1, y / height));
  return Math.max(lo, Math.min(hi, Math.round(lo + t * (hi - lo))));
}

/** Slowly drift sustained drone pitch/filter with smoothed cursor (B_MAJOR). */
export function updateDroneFromCursor(x, y, width, height) {
  if (!droneActive || !droneSynth || droneStopping) return;

  const d = AUDIO.DRONE;
  const lo = d.SCALE_LO ?? 0;
  const hi = d.SCALE_HI ?? 21;
  const center = d.CENTER_INDEX ?? Math.round((lo + hi) / 2);
  const glide = d.CURSOR_GLIDE_S ?? 2.5;

  const idx = yToScaleIndex(y, height, lo, hi);
  const targetMidi = Tone.Frequency(AUDIO.B_MAJOR[idx]).toMidi();
  const centerMidi = Tone.Frequency(AUDIO.B_MAJOR[center]).toMidi();
  const baseSt = (d.BASE_DETUNE_CENTS ?? 0) / 100;
  const pitchSt = baseSt + (targetMidi - centerMidi);

  try {
    if (dronePitchShift?.pitch != null) {
      const p = dronePitchShift.pitch;
      if (typeof p.rampTo === "function") p.rampTo(pitchSt, glide);
      else dronePitchShift.pitch = pitchSt;
    }
    if (droneFilter) {
      const xT = Math.max(0, Math.min(1, x / Math.max(1, width)));
      const minHz = d.FILTER_MIN_HZ ?? 180;
      const maxHz = d.FILTER_MAX_HZ ?? 900;
      const hz = minHz + xT * (maxHz - minHz);
      droneFilter.frequency.rampTo(hz, glide);
    }
  } catch (_) {}
}

export function playCharPing(y, height, opacity = 1) {
  if (!canPlayPing()) return;
  getCharSynth();
  const o = Math.max(0.06, Math.min(1, opacity));
  charDryGain.gain.value = o;
  charWetGain.gain.value = 0.12 + (1 - o) * 0.88;
  charSynth.volume.value = -10 - (1 - o) * 26;
  try { charSynth.triggerAttackRelease(yToNote(y, height, 14, 21), "32n"); } catch (_) {}
}

export function playCircPing(y, height) {
  if (!canPlayPing()) return;
  try { getCircSynth().triggerAttackRelease(yToNote(y, height, 0, 6), "8n"); } catch (_) {}
}

export function playSymPing(y, height) {
  if (!canPlayPing()) return;
  try { getSymSynth().triggerAttackRelease(yToNote(y, height, 9, 15), "8n"); } catch (_) {}
}

export async function startAmbientDrone() {
  if (droneActive || droneStarting || droneStopping) return;
  if (droneStopTimer) {
    clearTimeout(droneStopTimer);
    droneStopTimer = null;
    disposeDroneNodes();
  }

  droneStarting = true;
  const d = AUDIO.DRONE;

  try {
    droneNotes = getDroneNotes();

    droneReverb = new Tone.Reverb(d.REVERB);
    await droneReverb.generate();
    droneReverb.toDestination();

    droneGain = new Tone.Gain(d.GAIN ?? 1.35);
    droneGain.connect(droneReverb);

    droneFilter = new Tone.Filter(d.FILTER_HZ, "lowpass");
    droneFilter.connect(droneGain);

    dronePitchShift = new Tone.PitchShift({
      pitch: (d.BASE_DETUNE_CENTS ?? 0) / 100,
      windowSize: 0.12,
      delayTime: 0,
    });

    droneSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: AUDIO.DRONE_POLYPHONY ?? 8,
      oscillator: { type: "sine" },
      envelope: {
        attack: d.ATTACK_S,
        decay: 0.1,
        sustain: 1,
        release: d.RELEASE_S,
      },
      volume: d.VOLUME_DB,
    });
    droneSynth.connect(dronePitchShift);
    dronePitchShift.connect(droneFilter);

    droneLfo = new Tone.LFO({
      frequency: d.LFO_HZ,
      min: -40,
      max: 40,
    });
    droneLfo.connect(droneFilter.frequency);
    droneLfo.start();

    droneSynth.triggerAttack(droneNotes);
    droneActive = true;
  } finally {
    droneStarting = false;
  }
}

export function stopAmbientDrone() {
  if (!droneActive || droneStopping) return;
  droneStopping = true;
  droneActive = false;
  audioStarted = false;

  const d = AUDIO.DRONE;
  const fadeS = d.STOP_FADE_S ?? d.RELEASE_S;
  const tailMs = (fadeS + d.REVERB.decay + 2) * 1000;

  try {
    droneLfo?.stop();
    if (droneGain) droneGain.gain.rampTo(0, fadeS);
    if (droneSynth) droneSynth.triggerRelease(droneNotes);
  } catch (_) {}

  if (droneStopTimer) clearTimeout(droneStopTimer);
  droneStopTimer = setTimeout(() => {
    droneStopTimer = null;
    disposeDroneNodes();
  }, tailMs);
}

/** Unlocks audio + fades in the ambient drone (browser requires a user gesture). */
export async function ensureAudioStarted() {
  if (audioStarted) return;
  await Tone.start();
  try {
    await startAmbientDrone();
    audioStarted = true;
  } catch (err) {
    console.error("Failed to start ambient drone:", err);
  }
}

export { Tone };
