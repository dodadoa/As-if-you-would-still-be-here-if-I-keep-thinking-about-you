import { AUDIO, MUSIC } from "../config";

/** Active pitch ladder (key + mode from config). */
export function getScaleNotes() {
  return MUSIC.SCALE ?? AUDIO.B_MAJOR;
}

export function getDroneRange() {
  const d = AUDIO.DRONE;
  const lo = d.SCALE_LO ?? 0;
  const hi = d.SCALE_HI ?? 21;
  return {
    lo,
    hi,
    center: d.CENTER_INDEX ?? Math.round((lo + hi) / 2),
  };
}

/** Quantized scale degree from vertical cursor (top = high). */
export function targetScaleIndexFromY(y, height, lo, hi) {
  const t = 1 - Math.max(0, Math.min(1, y / height));
  return Math.max(lo, Math.min(hi, Math.round(lo + t * (hi - lo))));
}

/** Continuous scale index for smooth in-key drone glide (no rounding). */
export function targetScaleIndexFloatFromY(y, height, lo, hi, rangeScale = 1) {
  const t = 1 - Math.max(0, Math.min(1, y / height));
  const span = (hi - lo) * Math.max(0.1, Math.min(1, rangeScale));
  const center = (lo + hi) / 2;
  return Math.max(lo, Math.min(hi, center + (t - 0.5) * span));
}

/**
 * Linear MIDI between two adjacent scale degrees only (glide stays in-key
 * between neighbors; index lerp steps through degrees for large jumps).
 */
export function midiAtScaleIndex(floatIndex, scale, noteToMidi) {
  const clamped = Math.max(0, Math.min(scale.length - 1, floatIndex));
  const i0 = Math.floor(clamped);
  const i1 = Math.min(scale.length - 1, i0 + 1);
  const frac = clamped - i0;
  const m0 = noteToMidi(scale[i0]);
  const m1 = noteToMidi(scale[i1]);
  return m0 + (m1 - m0) * frac;
}

/** Drone chord as note names on the active scale. */
export function getDroneChordIndices(arcMode = 0) {
  const d = AUDIO.DRONE;
  const byArc = d.CHORD_BY_ARC_MODE;
  if (byArc && byArc[arcMode]) return byArc[arcMode];
  if (d.SCALE_CHORD_INDICES) return d.SCALE_CHORD_INDICES;
  const tones = AUDIO.CHORD_TONES;
  const scale = getScaleNotes();
  return (d.CHORD_TONE_INDICES ?? [4, 6, 8, 5]).map((ti) => {
    const note = tones[ti % tones.length];
    const idx = scale.indexOf(note);
    return idx >= 0 ? idx : ti;
  });
}

export function getDroneChordNotes(arcMode = 0) {
  const scale = getScaleNotes();
  return getDroneChordIndices(arcMode).map((i) => scale[Math.max(0, Math.min(scale.length - 1, i))]);
}

function getChordVoicings() {
  const d = AUDIO.DRONE;
  return d.CHORD_VOICINGS ?? d.CHORD_BY_ARC_MODE ?? [d.SCALE_CHORD_INDICES ?? [7, 9, 11, 10]];
}

/** Note names for drone from cursor: X = chord shape, Y = root lift. */
export function getDroneChordNotesFromCursor(x, y, width, height, voicingBlend) {
  const d = AUDIO.DRONE;
  const { lo, hi } = getDroneRange();
  const scale = getScaleNotes();
  const voicings = getChordVoicings();
  const n = voicings.length;
  if (n === 0) return [];

  const blend = Math.max(0, Math.min(n - 1, voicingBlend));
  const i0 = Math.floor(blend);
  const i1 = Math.min(n - 1, i0 + 1);
  const frac = blend - i0;
  const a = voicings[i0];
  const b = voicings[i1];
  const len = Math.max(a.length, b.length);

  const yT = 1 - Math.max(0, Math.min(1, y / Math.max(1, height)));
  const rootShift = Math.round(yT * (d.CHORD_ROOT_SHIFT_MAX ?? 0));

  const indices = [];
  for (let i = 0; i < len; i++) {
    const ai = a[Math.min(i, a.length - 1)] ?? a[0];
    const bi = b[Math.min(i, b.length - 1)] ?? b[0];
    const merged = Math.round(ai + (bi - ai) * frac) + rootShift;
    indices.push(Math.max(lo, Math.min(hi, merged)));
  }

  return [...new Set(indices.map((idx) => scale[idx]))];
}
