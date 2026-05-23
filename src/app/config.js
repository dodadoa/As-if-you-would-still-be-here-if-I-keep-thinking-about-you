/** Central tuning knobs for cursor-radar. */

/** Visual-element size multiplier. 0 = invisible, 1 = default, 2 = double. */
export const ELEMENT_SCALE = 1.6;

/** Set to ~0.02 to run each 5-min arc in ~6 seconds while developing. */
export const PERFORMANCE = {
  TIME_SCALE: 1,
  ARC_DURATION_MS: 5 * 60 * 1000,
  ARC_COUNT: 4,
  CAPTION_FADE_MS: 800,
  CAPTION_HOLD_MS: 3500,
  AUTO_SHOCKWAVE_INTERVAL_MS: 22000,
  WRITE_BACK_DELAY_MS: 1400,
  WRITE_BACK_CHAR_MS: 65,
  SCENE_FADE_DELAY_MS: 10000,
  FADE: {
    CIRCLE_LIFETIME_MS: 9000,
    CIRCLE_DISSOLVE_MS: 2500,
    SYMBOL_LIFETIME_MS: 8000,
    SYMBOL_DISSOLVE_MS: 2000,
    TEXT_LIFETIME_MS: 5000,
    TEXT_DISSOLVE_MS: 1200,
  },
  DRIFT: {
    CIRCLE_SPEED: 2.2,
    SYMBOL_SPEED: 0.8,
    TEXT_SPEED: 0.35,
  },
  ARC1_BEATS: [
    { at: 0, caption: "things there", circles: true, scanner: true },
    { at: 0.15, caption: "the circle", circles: true, scanner: true },
    { at: 0.3, caption: "the moving scanner", circles: true, scanner: true, spin: true },
    { at: 0.45, caption: "symbols", circles: true, scanner: true, spin: true, symbols: true },
    { at: 0.6, caption: "words become chords", circles: true, scanner: true, spin: true, symbols: true, agent: true, typing: true },
    { at: 0.8, caption: "shift — the field widens", circles: true, scanner: true, spin: true, symbols: true, agent: true, typing: true, shockwave: true },
  ],
  ARC_TITLES: [
    "things there",
    "fading, or ghosting",
    "we keep drifting",
    "the attempt to understand someone sharing something",
  ],
};

export const RADAR = {
  TARGET_SPEED: 0.0012,
  ACCEL: 0.00006,
  DECEL: 0.00006,
  PULSE_SPEED: 200,
  PULSE_DURATION: 1100,
};

export const TEXT = {
  FONT_SIZE: 18 * ELEMENT_SCALE,
  JITTER: 2,
  TRIGGER_COOLDOWN_MS: 120,
  HIT_ANIM_MS: 1200,
  HIT_SCALE: 0.55,
  MARGIN: 60,
  FONT_FAMILY: '"IM Fell English", serif',
};

export const CHAR_W = TEXT.FONT_SIZE * 0.52;

export const CIRCLES = {
  COUNT: 8,
  HIT_ANIM_MS: 1000,
};

export const SHOCKWAVE = {
  SPEED: 340,
  STROKE: 1.2,
  WINDOW: 7,
};

export const SYMBOLS = {
  INTERVAL_MS: 5000,
  SYMBOL_INTERVAL_PERFORMANCE_MS: 3800,
  FONT_SIZE: 20 * ELEMENT_SCALE,
  CHARS: "!@#$%^&*+=?~<>|\\§¶•◆★☆▲△▽▼◇○●□■",
  HIT_ANIM_MS: 1200,
  FADE_IN_MS: 800,
};

export const AGENT = {
  RADIUS: 20 * ELEMENT_SCALE,
  WANDER_SPEED: 1.5,
  BLOB_SPEED: 0.45,
  STEER_LERP: 0.025,
  INGEST_DIST: 90,
  MAX_CHARS: 7,
  CHORD_INTERVAL_MS: 3200,
  ORBIT_RADIUS: 34 * ELEMENT_SCALE,
  ORBIT_SPEED: 0.00045,
  CHORD_BLOOM_MS: 1400,
  EAT_ANIM_MS: 350,
  TARGET_REACH_DIST: 45,
  EDGE_MARGIN: 20,
};

export const SCENE1 = {
  CHAR_LIFETIME_MS: 14000,
  DISSOLVE_MS: 3500,
  DISSOLVE_SCALE: 0.45,
  DISSOLVE_DRIFT: 22,
  CURSOR_BLINK_MS: 500,
  BLOCK_STAGGER_MS: 18000,
  CHAR_STAGGER_MS: 5000,
};

export const AUDIO = {
  CHORD_TONES: [
    "B2", "D#3", "F#3", "A#3",
    "B3", "D#4", "F#4", "A#4",
    "B4", "D#5", "F#5", "A#5",
  ],
  B_MAJOR: [
    "B2", "C#3", "D#3", "E3", "F#3", "G#3", "A#3",
    "B3", "C#4", "D#4", "E4", "F#4", "G#4", "A#4",
    "B4", "C#5", "D#5", "E5", "F#5", "G#5", "A#5",
    "B5",
  ],
  REVERB: { decay: 5, wet: 0.55 },
  PRE_DELAY: { delayTime: "16n", feedback: 0.1, wet: 0.2 },
};

export const UI = {
  MOUSE_LERP: 0.2,
  INFO_LERP: 0.1,
  INFO_RADIUS: 75,
  CURSOR_DOT_R: 6,
};

/** Feature flags for each mode (0–4). Pressing a key sets ctx.arcMode. */
export const PRESETS = [
  // 0 — intro (same elements as scene 1, no caption)
  { circles: true, scanner: true, spin: true, symbols: true, agent: false, typing: true, shockwave: true, autoFade: false, ghost: false, drift: false, writeBack: false, caption: "" },
  // 1 — things there
  { circles: true, scanner: true, spin: true, symbols: true, agent: false, typing: true, shockwave: true, autoFade: false, ghost: false, drift: false, writeBack: false, caption: "things there" },
  // 2 — fading, or ghosting
  { circles: true, scanner: true, spin: true, symbols: true, agent: true, typing: true, shockwave: true, autoFade: true, ghost: true, drift: false, writeBack: false, caption: "fading, or ghosting" },
  // 3 — we keep drifting
  { circles: true, scanner: true, spin: true, symbols: true, agent: true, typing: true, shockwave: true, autoFade: true, ghost: true, drift: true, writeBack: false, caption: "we keep drifting" },
  // 4 — the attempt to understand someone sharing something
  { circles: true, scanner: true, spin: true, symbols: true, agent: true, typing: true, shockwave: true, autoFade: true, ghost: true, drift: true, writeBack: true, caption: "the attempt to understand someone sharing something" },
];

export function getFeatures(mode) {
  return PRESETS[Math.max(0, Math.min(4, mode ?? 1))];
}

/**
 * Pre-written phrases that appear automatically during the performance.
 * Replace these with your actual script.
 * atMs is milliseconds into that arc (0 = arc start).
 */
export const SCRIPTED_TEXT = [
  // mode 4 — understanding / write-back
  { arcIndex: 4, atMs:   4000, text: "tell me" },
  { arcIndex: 4, atMs:  44000, text: "what you meant" },
  { arcIndex: 4, atMs:  90000, text: "when you said" },
  { arcIndex: 4, atMs: 134000, text: "that thing about" },
  { arcIndex: 4, atMs: 184000, text: "the way time" },
  { arcIndex: 4, atMs: 232000, text: "moves in you" },
  { arcIndex: 4, atMs: 268000, text: "i am still" },
];
