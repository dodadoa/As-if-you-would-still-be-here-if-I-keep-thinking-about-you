/**
 * Central tuning for cursor-radar.
 *
 * Keys while the canvas is focused:
 *   0–4  — switch scene preset (see PRESETS)
 *   click — toggle radar spin (when preset has spin)
 *   Shift — shockwave from cursor (when preset has shockwave)
 *   Enter — start / finish typing a text block
 *   i     — spawn an agent blob (modes 2–4 only)
 */

// ─── Global scale ───────────────────────────────────────────────────────────

/** Multiplier for circles, text, symbols, and agent size. 0 = invisible, 1 = default, 2 = double. */
export const ELEMENT_SCALE = 1.25;

// ─── Performance / scene timing ───────────────────────────────────────────────

export const PERFORMANCE = {
  /**
   * Speed multiplier for scripted text timing only (SCRIPTED_TEXT atMs).
   * 0.02 ≈ 5-minute arc plays in ~6 seconds. Does not change wall-clock presets.
   */
  TIME_SCALE: 1,

  /** Planned length of one narrative arc (ms). Not wired to auto-advance yet. */
  ARC_DURATION_MS: 5 * 60 * 1000,

  /** Number of narrative arcs (modes 1–4). Mode 0 is intro. */
  ARC_COUNT: 4,

  /** Bottom caption fade-in / fade-out duration (ms). drawPerformanceCaption exists but is not called yet. */
  CAPTION_FADE_MS: 800,

  /** How long the bottom caption stays fully visible between fades (ms). */
  CAPTION_HOLD_MS: 3500,

  /** Planned interval for automatic shockwaves (ms). lastAutoShock exists in state; not ticked yet. */
  AUTO_SHOCKWAVE_INTERVAL_MS: 22000,

  /** Pause after Enter before the write-back reply starts typing (ms). Mode 4 + writeBack. */
  WRITE_BACK_DELAY_MS: 1400,

  /** Delay between each character of the auto reply (ms). */
  WRITE_BACK_CHAR_MS: 65,

  /**
   * When switching into autoFade (modes 2–4), circles/symbols get random ages up to this
   * offset so they do not all fade in sync (ms).
   */
  SCENE_FADE_DELAY_MS: 10000,

  /** Circle/symbol/text lifetimes and dissolve lengths while autoFade is on (modes 2–4). */
  FADE: {
    /** Visible life of a circle before dissolve starts (ms). */
    CIRCLE_LIFETIME_MS: 9000,
    /** Circle fade-out duration after lifetime (ms). */
    CIRCLE_DISSOLVE_MS: 2500,
    SYMBOL_LIFETIME_MS: 8000,
    SYMBOL_DISSOLVE_MS: 2000,
    /** Reserved for block-level text fade; blocks use SCENE1 + scheduleBlockCharFade instead. */
    TEXT_LIFETIME_MS: 20000,
    TEXT_DISSOLVE_MS: 1200,
  },

  /** Drift speed multipliers when preset drift is true (mode 3–4). */
  DRIFT: {
    /** Circle bounce speed multiplier. */
    CIRCLE_SPEED: 2.2,
    SYMBOL_SPEED: 0.8,
    /** Per-character wander speed for typed/scripted blocks. */
    TEXT_SPEED: 0.15,
  },

  /** Human-readable arc names; mirrors PRESETS captions for modes 1–4. Reference only for now. */
  ARC_TITLES: [
    "things there",
    "fading, or ghosting",
    "we keep drifting",
    "the attempt to understand someone sharing something",
  ],
};

// ─── Radar crosshair & spin ───────────────────────────────────────────────────

export const RADAR = {
  /** Max rotation speed (rad/frame) when spin is on and mouse has toggled spinning. */
  TARGET_SPEED: 0.0012,
  /** Spin-up per frame while spinning. */
  ACCEL: 0.00006,
  /** Spin-down per frame when not spinning. */
  DECEL: 0.00006,
  /** Rad/frame the moment spin turns on (no slow ramp from zero). */
  SPIN_START_SPEED: 0.0012,
  /** Below this rad/frame the wheel is considered stopped (“at start”). */
  SPIN_REST_SPEED: 0.000001,
  /** How fast hit “pulses” travel along scanner axes (px/s). */
  PULSE_SPEED: 200,
  /** How long a pulse line stays visible (ms). */
  PULSE_DURATION: 1100,
};

// ─── Typed & scripted text ────────────────────────────────────────────────────

export const TEXT = {
  FONT_SIZE: 18 * ELEMENT_SCALE,
  /** Random vertical offset per character within a block (px). */
  JITTER: 2,
  /** Min ms between scanner/symbol re-triggers on the same object. */
  TRIGGER_COOLDOWN_MS: 120,
  /** Duration of the “bloom” scale when the crosshair hits a character (ms). */
  HIT_ANIM_MS: 1200,
  /** Peak extra scale during hit bloom (0.55 = 55% larger at peak). */
  HIT_SCALE: 0.55,
  /** Keep text blocks away from canvas edges (px). */
  MARGIN: 60,
  FONT_FAMILY: '"IM Fell English", serif',
};

/** Approximate character width for layout (derived from font size). */
export const CHAR_W = TEXT.FONT_SIZE * 0.52;

// ─── Radar circles ────────────────────────────────────────────────────────────

export const CIRCLES = {
  /** Number of circles on screen in performance mode. */
  COUNT: 10,
  /** Hit bloom animation length (ms). */
  HIT_ANIM_MS: 1000,
};

// ─── Shift-key shockwave ring ─────────────────────────────────────────────────

export const SHOCKWAVE = {
  /** Ring expansion speed (px/s). */
  SPEED: 340,
  STROKE: 1.2,
  /** Hit tolerance: circle/symbol triggers when ring is within WINDOW + radius (px). */
  WINDOW: 7,
};

// ─── Floating punctuation symbols ─────────────────────────────────────────────

export const SYMBOLS = {
  /** Reserved for non-performance scenes; performance uses SYMBOL_INTERVAL_PERFORMANCE_MS. */
  INTERVAL_MS: 5000,
  /** Target symbol count on screen (replenished like circles). */
  COUNT: 7,
  /** How often an extra symbol spawns during performance (ms). */
  SYMBOL_INTERVAL_PERFORMANCE_MS: 2800,
  FONT_SIZE: 20 * ELEMENT_SCALE,
  CHARS: "!@#$%^&*+=?~<>|\\§¶•◆★☆▲△▽▼◇○●□■",
  HIT_ANIM_MS: 1200,
  FADE_IN_MS: 1500,
};

// ─── Agent blob (press i in modes 2–4) ───────────────────────────────────────

export const AGENT = {
  RADIUS: 20 * ELEMENT_SCALE,
  /** Reserved; movement uses BLOB_SPEED + STEER_LERP today. */
  WANDER_SPEED: 1.5,
  /** Approach speed toward target block or wander point. */
  BLOB_SPEED: 0.45,
  /** Smoothing when steering toward target (0–1, higher = snappier). */
  STEER_LERP: 0.025,
  /** Distance to eat a character or symbol (px). */
  INGEST_DIST: 90,
  /** Characters eaten before a chord plays and orbit clears. */
  MAX_CHARS: 7,
  /** Reserved; chords fire on MAX_CHARS ingest, not on a timer. */
  CHORD_INTERVAL_MS: 3200,
  /** Radius of characters orbiting the agent (px). */
  ORBIT_RADIUS: 34 * ELEMENT_SCALE,
  ORBIT_SPEED: 0.00045,
  /** Visual bloom when a chord fires (ms). */
  CHORD_BLOOM_MS: 1400,
  EAT_ANIM_MS: 350,
  /** Distance to wander target before picking a new one (px). */
  TARGET_REACH_DIST: 45,
  EDGE_MARGIN: 20,
};

// ─── Text block fade (modes 2–4 with autoFade) ────────────────────────────────

export const SCENE1 = {
  /** Time a character stays solid before dissolve (ms). */
  CHAR_LIFETIME_MS: 14000,
  DISSOLVE_MS: 3500,
  DISSOLVE_SCALE: 0.45,
  DISSOLVE_DRIFT: 22,
  CURSOR_BLINK_MS: 500,
  /**
   * Random spread when scheduling block auto-fade after entering autoFade mode (ms).
   * Used with PERFORMANCE.SCENE_FADE_DELAY_MS.
   */
  BLOCK_STAGGER_MS: 18000,
  /** Stagger start of per-character fade within a block (ms). */
  CHAR_FADE_STAGGER_MS: 320,
};

// ─── Key / mode (shared by drone, pings, chords) ─────────────────────────────

export const MUSIC = {
  KEY: "B",
  MODE: "major",
  /** Pitch ladder for cursor mapping and quantization (ionian on B). */
  SCALE: null, // filled below after AUDIO.B_MAJOR exists
};

// ─── Tone.js audio ────────────────────────────────────────────────────────────

export const AUDIO = {
  /** Notes mapped from typed characters (playCharPing / playChord). */
  CHORD_TONES: [
    "B2", "D#3", "F#3", "A#3",
    "B3", "D#4", "F#4", "A#4",
    "B4", "D#5", "F#5", "A#5",
  ],
  /** Full scale for vertical pitch (y position on canvas). */
  B_MAJOR: [
    "B2", "C#3", "D#3", "E3", "F#3", "G#3", "A#3",
    "B3", "C#4", "D#4", "E4", "F#4", "G#4", "A#4",
    "B4", "C#5", "D#5", "E5", "F#5", "G#5", "A#5",
    "B5",
  ],
  REVERB: { decay: 5, wet: 0.55 },
  PRE_DELAY: { delayTime: "16n", feedback: 0.1, wet: 0.2 },
  /** PolySynth voice pool for agent chords (one chord ≈ up to 7 notes). */
  CHORD_POLYPHONY: 10,
  /** Sustained drone voices (match CHORD_TONE_INDICES length + headroom). */
  DRONE_POLYPHONY: 8,
  /** Min ms between scanner hit sounds (circles/symbols/chars share one gate). */
  PING_MIN_INTERVAL_MS: 50,
  /** k key — one-shot poly chord (separate from the wheel drone). */
  K_SYNTH: {
    VOLUME_DB: -6,
    POLYPHONY: 8,
    DURATION: "2n",
    OSC: "triangle",
    ATTACK_S: 0.005,
    DECAY_S: 0.5,
    SUSTAIN: 0.15,
    RELEASE_S: 1.4,
  },

  /**
   * Sustained ambient bed (starts when scanner wheel spins; stops when it rests).
   * Notes are indices into CHORD_TONES (B-major harmony used elsewhere).
   */
  DRONE: {
    /** Legacy indices into CHORD_TONES; prefer SCALE_CHORD_INDICES. */
    CHORD_TONE_INDICES: [4, 6, 8, 5],
    /** B2 D#3 F#3 E3 — low register default. */
    SCALE_CHORD_INDICES: [0, 2, 4, 3],
    /**
     * Drone voicing per arc mode (0–4), each list is scale indices in MUSIC.SCALE.
     * Stays in B major; later modes lean on upper partials.
     */
    CHORD_BY_ARC_MODE: [
      [0, 2, 4, 3],
      [0, 2, 4, 3],
      [2, 4, 6, 5],
      [3, 5, 7, 6],
      [5, 7, 9, 8],
    ],
    /**
     * Chord shapes swept by cursor X (scale indices). Y shifts root upward.
     * Left = open/low (B2 area), right = mid register (B3–B4).
     */
    CHORD_VOICINGS: [
      [0, 2, 4, 3],
      [0, 2, 5, 4],
      [2, 4, 6, 5],
      [3, 5, 7, 6],
      [4, 6, 9, 7],
      [5, 7, 10, 9],
      [7, 9, 11, 10],
    ],
    /** Max scale steps to raise chord root from bottom→top of screen. */
    CHORD_ROOT_SHIFT_MAX: 4,
    /** How fast cursor X blends between voicing slots (seconds). */
    CHORD_GLIDE_S: 0.1,
    /** Crossfade when chord shape changes (seconds). */
    CHORD_CROSSFADE_S: 0.06,
    BASE_DETUNE_CENTS: 0,
    VOLUME_DB: -10,
    DRY_GAIN: 0.28,
    WET_GAIN: 0.1,
    ATTACK_S: 0.12,
    RELEASE_S: 4,
    /** Output fade when stopping (s); nodes dispose after this + reverb tail. */
    STOP_FADE_S: 3,
    REVERB: { decay: 8, wet: 1 },
    FILTER_HZ: 900,
    LFO_HZ: 0,
    LFO_DEPTH_HZ: 0,
    /**
     * Pitch follow time constant (s). ~0.055 ≈ UI.MOUSE_LERP at 60fps — feels immediate.
     * @deprecated use PITCH_GLIDE_S
     */
    CURSOR_GLIDE_S: 0.055,
    /** Vertical pitch follow (seconds). Lower = snappier. */
    PITCH_GLIDE_S: 0.055,
    /** Filter brightness follow (seconds). */
    FILTER_GLIDE_S: 0.055,
    /** Short ramp on detune param to avoid clicks (seconds). */
    DETUNE_RAMP_S: 0.012,
    /** Legacy pitch sweep (0 = harmony from CHORD_VOICINGS only). */
    PITCH_RANGE: 0,
    /** Fraction of filter sweep (0–1); 1 = full min→max range. */
    FILTER_RANGE: 1,
    /** Filter resonance: dull (bottom) → ringing (top). */
    FILTER_Q_MIN: 0.5,
    FILTER_Q_MAX: 7,
    /** B_MAJOR indices for vertical pitch mapping (top = hi, bottom = lo). */
    SCALE_LO: 0,
    SCALE_HI: 21,
    /** Canvas-center pitch; detune is relative to this note. */
    CENTER_INDEX: 14,
    /** Filter at left of screen (dark/muffled). */
    FILTER_MIN_HZ: 180,
    /** Filter at right of screen (bright/open). */
    FILTER_MAX_HZ: 2800,
  },
};

MUSIC.SCALE = AUDIO.B_MAJOR;

// ─── Cursor smoothing ─────────────────────────────────────────────────────────

export const UI = {
  /** Lerp factor for crosshair following the mouse (0–1). */
  MOUSE_LERP: 0.2,
  /** Reserved for info overlay follow speed. */
  INFO_LERP: 0.1,
  /** Reserved for info overlay activation radius. */
  INFO_RADIUS: 75,
  /** Reserved; performance draws a fixed 6px dot at the smooth cursor. */
  CURSOR_DOT_R: 6,
};

/**
 * Feature flags per mode (0–4). Press 0–4 to switch ctx.arcMode.
 *
 *   circles   — drifting dots on the field
 *   scanner   — crosshair axes + hit pulses + shockwave drawing
 *   spin      — axes rotate (click toggles); uses RADAR accel/decel
 *   symbols   — auto-spawn SYMBOLS.CHARS
 *   agent     — update/draw agents if any exist (spawn with i)
 *   typing    — keyboard text (Enter to type, Backspace to delete)
 *   shockwave — Shift emits expanding ring from cursor
 *   autoFade  — circles, symbols, and blocks fade out over time
 *   ghost     — faint trail at previous circle/symbol position
 *   drift     — slow random motion for circles, symbols, and text
 *   writeBack — after Enter, queue an automatic reply block (mode 4)
 *   caption   — scene title in the center label (and planned bottom caption)
 */
export const PRESETS = [
  // 0 — intro (opening phrase, no title caption)
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

/** Returns the preset for arcMode, clamped to 0–4. */
export function getFeatures(mode) {
  return PRESETS[Math.max(0, Math.min(4, mode ?? 1))];
}

/**
 * Lines that appear automatically during a mode (no typing required).
 *
 *   arcIndex — must match preset index (0–4); mode 4 is the write-back arc
 *   atMs     — ms after entering that mode (divided by PERFORMANCE.TIME_SCALE)
 *   text     — phrase spawned as one block
 *   x, y     — optional fixed position; otherwise random in TEXT.MARGIN bounds
 */
export const SCRIPTED_TEXT = [
  // mode 4 — understanding / write-back
  { arcIndex: 4, atMs:   4000, text: "tell me" },
  { arcIndex: 4, atMs:  44000, text: "what you meant" },
  { arcIndex: 4, atMs:  90000, text: "when you said" },
  { arcIndex: 4, atMs: 134000, text: "that thing about" },
  { arcIndex: 4, atMs: 184000, text: "the way time" },
  { arcIndex: 4, atMs: 268000, text: "i am still" },
];
