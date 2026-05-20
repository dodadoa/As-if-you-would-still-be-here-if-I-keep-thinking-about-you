import * as Tone from "tone";
import { AUDIO } from "../config";

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
function getCharSynth() {
  if (!charSynth) {
    charSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -10,
    }).connect(getChain());
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
  try { getChordSynth().triggerAttackRelease(notes, "2n"); } catch (_) {}
}

function yToNote(y, height, lo, hi) {
  const t = 1 - Math.max(0, Math.min(1, y / height));
  const idx = Math.round(lo + t * (hi - lo));
  return AUDIO.B_MAJOR[Math.max(lo, Math.min(hi, idx))];
}

export function playCharPing(y, height) {
  try { getCharSynth().triggerAttackRelease(yToNote(y, height, 14, 21), "32n"); } catch (_) {}
}

export function playCircPing(y, height) {
  try { getCircSynth().triggerAttackRelease(yToNote(y, height, 0, 6), "8n"); } catch (_) {}
}

export function playSymPing(y, height) {
  try { getSymSynth().triggerAttackRelease(yToNote(y, height, 9, 15), "8n"); } catch (_) {}
}

export { Tone };
