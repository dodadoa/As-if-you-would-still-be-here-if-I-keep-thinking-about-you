"use client";

import { useEffect, useRef } from "react";
import * as Tone from "tone";

const TARGET_SPEED = 0.0012;
const ACCEL = 0.00006;
const DECEL = 0.00006;

const FONT_SIZE = 18;
const CHAR_W = FONT_SIZE * 0.52; // IM Fell English — proportional serif, avg glyph width
const JITTER = 2;
const TRIGGER_COOLDOWN_MS = 120;
const HIT_ANIM_MS = 1200;
const HIT_SCALE = 0.55;

const CIRCLE_COUNT = 8;
const CIRCLE_HIT_ANIM_MS = 1000;
const SHOCKWAVE_SPEED = 340;
const SHOCKWAVE_STROKE = 1.2;
const SHOCKWAVE_WINDOW = 7;

const SYMBOL_INTERVAL_MS = 5000;
const SYMBOL_FONT_SIZE = 20;
const SYMBOL_CHARS = "!@#$%^&*+=?~<>|\\§¶•◆★☆▲△▽▼◇○●□■";
const SYMBOL_HIT_ANIM_MS = 1200;

// ── agent circle ───────────────────────────────────────────────────────────────
const AGENT_RADIUS = 20;
const AGENT_WANDER_SPEED = 1.5;
const AGENT_STEER_LERP = 0.035;
const AGENT_INGEST_DIST = 90;      // px radius around agent within which a line-cross triggers ingestion
const AGENT_MAX_CHARS = 7;         // auto-chord when this many chars ingested
const AGENT_CHORD_INTERVAL_MS = 3200; // periodic chord even with fewer chars
const AGENT_ORBIT_RADIUS = 34;
const AGENT_ORBIT_SPEED = 0.00045; // rad/ms
const AGENT_CHORD_BLOOM_MS = 1400;
const AGENT_EAT_ANIM_MS = 350;

// ── Tone.js effects + synths ───────────────────────────────────────────────────

// shared reverb tail — all synths route through this
let reverb = null;
function getReverb() {
  if (!reverb) {
    reverb = new Tone.Reverb({ decay: 5, wet: 0.55 }).toDestination();
  }
  return reverb;
}

// gentle pre-delay before reverb for depth
let preDelay = null;
function getChain() {
  if (!preDelay) {
    preDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.1, wet: 0.2 });
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

// Bmaj7 chord tones voiced across 4 octaves — always harmonic, never clashing
const CHORD_TONES = [
  "B2", "D#3", "F#3", "A#3",
  "B3", "D#4", "F#4", "A#4",
  "B4", "D#5", "F#5", "A#5",
];

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
  // map character code to a Bmaj7 chord tone — always consonant
  const code = ch.charCodeAt(0);
  return CHORD_TONES[code % CHORD_TONES.length];
}

function playChord(ingestedChars) {
  if (ingestedChars.length === 0) return;
  const notes = [...new Set(ingestedChars.map((ic) => charToNote(ic.ch)))];
  try { getChordSynth().triggerAttackRelease(notes, "2n"); } catch (_) {}
}

// ── B major scale across 4 octaves ────────────────────────────────────────────
// Bmaj7 chord tones (B D# F# A#) sit naturally inside this scale.
const B_MAJOR = [
  "B2","C#3","D#3","E3","F#3","G#3","A#3",   // low  (0-6)
  "B3","C#4","D#4","E4","F#4","G#4","A#4",   // mid  (7-13)
  "B4","C#5","D#5","E5","F#5","G#5","A#5",   // high (14-20)
  "B5",                                       // top  (21)
];

// map a y position to a note within a slice of B_MAJOR
// top of screen → high index, bottom → low index
function yToNote(y, height, lo, hi) {
  const t = 1 - Math.max(0, Math.min(1, y / height)); // 0 (bottom) → 1 (top)
  const idx = Math.round(lo + t * (hi - lo));
  return B_MAJOR[Math.max(lo, Math.min(hi, idx))];
}

function playCharPing(y, height) {
  // characters live in the high octave (B4–B5)
  try { getCharSynth().triggerAttackRelease(yToNote(y, height, 14, 21), "32n"); } catch (_) {}
}
function playCircPing(y, height) {
  // circles live in the low octave (B2–B3) — deep, resonant
  try { getCircSynth().triggerAttackRelease(yToNote(y, height, 0, 6), "8n"); } catch (_) {}
}
function playSymPing(y, height) {
  // symbols sit above the low range for a lighter, less boomy hit
  try { getSymSynth().triggerAttackRelease(yToNote(y, height, 9, 15), "8n"); } catch (_) {}
}

// ── p5 helpers ─────────────────────────────────────────────────────────────────
function distToEdge(p, cx, cy, rot) {
  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const candidates = [];
  if (Math.abs(cosA) > 1e-9)
    candidates.push(cosA > 0 ? (p.width - cx) / cosA : -cx / cosA);
  if (Math.abs(sinA) > 1e-9)
    candidates.push(sinA > 0 ? (p.height - cy) / sinA : -cy / sinA);
  return Math.min(...candidates.filter((v) => v >= 0));
}

function drawCross(p, cx, cy, rot) {
  p.stroke(0);
  p.strokeWeight(1.5);
  [rot, rot + p.PI, rot + p.HALF_PI, rot - p.HALF_PI].forEach((dir) => {
    const d = distToEdge(p, cx, cy, dir);
    p.line(cx, cy, cx + Math.cos(dir) * d, cy + Math.sin(dir) * d);
  });
}

// ── line pulses ────────────────────────────────────────────────────────────────
const PULSE_SPEED = 200;
const PULSE_DURATION = 1100;

// Store the signed parametric distance (t0) along the hit axis rather than
// a fixed world position. Each frame we recompute using the CURRENT angle,
// so the pulse always rides the rotating line.
function addPulse(pulses, objX, objY, mx, my, angle) {
  const dx = objX - mx;
  const dy = objY - my;
  // perpendicular distance to each axis — the smaller one is the one that crossed
  const perpAxis1 = Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
  const perpAxis2 = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle));
  const axisOffset = perpAxis1 < perpAxis2 ? 0 : Math.PI / 2;
  const cosA = Math.cos(angle + axisOffset);
  const sinA = Math.sin(angle + axisOffset);
  // signed distance from origin along the chosen axis
  const t0 = dx * cosA + dy * sinA;
  pulses.push({ t0, axisOffset, birthTime: performance.now() });
}

function drawLinePulses(p, pulses, angle, smoothX, smoothY) {
  const now = performance.now();
  for (let i = pulses.length - 1; i >= 0; i--) {
    const pulse = pulses[i];
    const elapsed = (now - pulse.birthTime) / 1000;
    if (elapsed > PULSE_DURATION / 1000) { pulses.splice(i, 1); continue; }

    const progress = elapsed / (PULSE_DURATION / 1000);
    const alpha = (1 - progress) * 255;
    const dist = elapsed * PULSE_SPEED;
    // recompute direction from CURRENT angle so pulse follows the rotating line
    const currentAngle = angle + pulse.axisOffset;
    const cosA = Math.cos(currentAngle);
    const sinA = Math.sin(currentAngle);

    [1, -1].forEach((dir) => {
      const t = pulse.t0 + dir * dist;
      const px = smoothX + t * cosA;
      const py = smoothY + t * sinA;
      if (px < 0 || px > p.width || py < 0 || py > p.height) return;

      const half = p.lerp(10, 3, progress);
      p.push();
      p.noFill();
      p.stroke(255, alpha);
      p.strokeWeight(3.5);
      p.line(px - cosA * half, py - sinA * half, px + cosA * half, py + sinA * half);
      p.stroke(0, alpha * 0.5);
      p.strokeWeight(0.8);
      p.line(px - cosA * half, py - sinA * half, px + cosA * half, py + sinA * half);
      p.pop();
    });
  }
}

// ── circles ────────────────────────────────────────────────────────────────────
function makeCircle(p) {
  const r = p.random(3, 9);
  return {
    x: p.random(r, p.width - r),
    y: p.random(r, p.height - r),
    r,
    vx: (p.random(0.04, 0.12)) * (p.random() > 0.5 ? 1 : -1),
    vy: (p.random(0.04, 0.12)) * (p.random() > 0.5 ? 1 : -1),
    filled: p.random() > 0.5,
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    lastShockId: -1,
  };
}

function updateAndDrawCircles(p, circles, angle, mx, my, pulses, shockwaves) {
  const A = angle;
  const now = performance.now();

  circles.forEach((c) => {
    // move
    c.x += c.vx;
    c.y += c.vy;
    if (c.x - c.r < 0)       { c.x = c.r;          c.vx *= -1; }
    if (c.x + c.r > p.width)  { c.x = p.width - c.r; c.vx *= -1; }
    if (c.y - c.r < 0)       { c.y = c.r;           c.vy *= -1; }
    if (c.y + c.r > p.height) { c.y = p.height - c.r; c.vy *= -1; }

    // axis collision
    const dx = c.x - mx;
    const dy = c.y - my;
    const d1 = dx * Math.sin(A) - dy * Math.cos(A);
    const d2 = dx * Math.cos(A) + dy * Math.sin(A);

    if (now - c.lastTrigger > TRIGGER_COOLDOWN_MS) {
      const crossed =
        (c.prevD1 !== null && Math.sign(d1) !== Math.sign(c.prevD1)) ||
        (c.prevD2 !== null && Math.sign(d2) !== Math.sign(c.prevD2));
      if (crossed) {
        playCircPing(c.y, p.height);
        c.lastTrigger = now;
        c.hitTime = now;
        addPulse(pulses, c.x, c.y, mx, my, A);
      }
    }
    c.prevD1 = d1;
    c.prevD2 = d2;

    // expanding radial sweep from center (Shift) can also trigger circles once per wave
    for (let i = 0; i < shockwaves.length; i++) {
      const wave = shockwaves[i];
      if (c.lastShockId === wave.id) continue;
      const r = ((now - wave.birthTime) / 1000) * SHOCKWAVE_SPEED;
      const centerDist = Math.hypot(c.x - mx, c.y - my);
      if (Math.abs(centerDist - r) <= SHOCKWAVE_WINDOW + c.r) {
        c.lastShockId = wave.id;
        c.hitTime = now;
        playCircPing(c.y, p.height);
        addPulse(pulses, c.x, c.y, mx, my, A);
      }
    }

    // bloom animation: sine-bell so it grows out then eases back
    const elapsed = now - c.hitTime;
    const t = Math.min(elapsed / CIRCLE_HIT_ANIM_MS, 1);
    const bloom = Math.sin(t * Math.PI); // 0 → peak → 0

    p.push();
    p.translate(c.x, c.y);

    // diffuse reactive glow: stacked filled circles accumulate opacity toward the core,
    // like light scattering through a translucent material.
    // Each layer adds a small alpha contribution — inner area receives the most layers → darkest.
    if (bloom > 0.02) {
      const maxSpread = c.r * 7;
      const LAYERS = 32;
      p.noStroke();
      for (let i = LAYERS; i >= 0; i--) {
        const frac = i / LAYERS;                        // 1 = outermost, 0 = circle edge
        const r = c.r + frac * bloom * maxSpread;
        const falloff = Math.exp(-frac * frac * 3.5);  // energy drops off fast outward
        const col = Math.round(255 * frac);             // black at core → white at edge
        const alpha = bloom * falloff * 22;
        p.fill(col, alpha);
        p.circle(0, 0, r * 2);
      }
    }

    // main circle — color inverts on hit
    const isHit = bloom > 0.02;
    if (c.filled) {
      if (isHit) { p.fill(255); p.stroke(0); p.strokeWeight(1.5); }
      else        { p.fill(0);   p.noStroke(); }
    } else {
      if (isHit) { p.fill(0);   p.noStroke(); }
      else        { p.noFill(); p.stroke(0);   p.strokeWeight(1.5); }
    }
    p.circle(0, 0, c.r * 2);

    p.pop();
  });
}

function drawShockwaves(p, shockwaves, mx, my) {
  const now = performance.now();
  const maxR = Math.hypot(p.width, p.height);
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const wave = shockwaves[i];
    const elapsed = (now - wave.birthTime) / 1000;
    const r = elapsed * SHOCKWAVE_SPEED;
    if (r > maxR) {
      shockwaves.splice(i, 1);
      continue;
    }
    const alpha = 255 * (1 - r / maxR);
    p.push();
    p.noFill();
    p.stroke(0, alpha);
    p.strokeWeight(SHOCKWAVE_STROKE);
    p.circle(mx, my, r * 2);
    p.pop();
  }
}

// ── text blocks ────────────────────────────────────────────────────────────────
function processBlocks(p, blocks, activeBlock, angle, mx, my, pulses) {
  const A = angle;
  const now = performance.now();

  p.textSize(FONT_SIZE);
  p.textFont('"IM Fell English", serif');
  p.fill(0);
  p.noStroke();

  blocks.forEach((block, bi) => {
    block.chars.forEach((char, i) => {
      const px = block.x + i * CHAR_W + CHAR_W / 2;
      const py = block.y + char.dy - FONT_SIZE / 2;
      const dx = px - mx;
      const dy = py - my;

      const d1 = dx * Math.sin(A) - dy * Math.cos(A);
      const d2 = dx * Math.cos(A) + dy * Math.sin(A);

      char.crossedThisFrame = false;
      if (now - char.lastTrigger > TRIGGER_COOLDOWN_MS) {
        const crossed =
          (char.prevD1 !== null && Math.sign(d1) !== Math.sign(char.prevD1)) ||
          (char.prevD2 !== null && Math.sign(d2) !== Math.sign(char.prevD2));
        if (crossed) {
          char.crossedThisFrame = true;
          playCharPing(py, p.height);
          char.lastTrigger = now;
          char.hitTime = now;
          addPulse(pulses, block.x + i * CHAR_W + CHAR_W / 2, block.y + char.dy, mx, my, A);
        }
      }
      char.prevD1 = d1;
      char.prevD2 = d2;

      const elapsed = now - (char.hitTime ?? -Infinity);
      const t = Math.min(elapsed / HIT_ANIM_MS, 1);
      const scale = 1 + HIT_SCALE * Math.sin(t * Math.PI);

      const drawX = block.x + i * CHAR_W;
      const drawY = block.y + char.dy;

      p.push();
      p.translate(drawX + CHAR_W / 2, drawY);
      p.scale(scale);
      p.textStyle(t < 1 ? p.BOLD : p.NORMAL);
      p.text(char.ch, -CHAR_W / 2, 0);
      p.pop();
    });

    // blinking cursor
    if (bi === activeBlock) {
      const cx = block.x + block.chars.length * CHAR_W;
      const cy = block.y;
      if (Math.floor(performance.now() / 500) % 2 === 0) {
        p.noStroke();
        p.fill(0);
        p.rect(cx, cy - FONT_SIZE, CHAR_W * 1.5, FONT_SIZE + 3);
      }
    }
  });
}

// ── auto symbols ───────────────────────────────────────────────────────────────
function spawnSymbol(p) {
  const margin = 60;
  return {
    ch: SYMBOL_CHARS[Math.floor(p.random(SYMBOL_CHARS.length))],
    x: p.random(margin, p.width - margin),
    y: p.random(margin + SYMBOL_FONT_SIZE, p.height - margin),
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    spawnTime: performance.now(),
  };
}

function processSymbols(p, symbols, angle, mx, my, pulses) {
  const A = angle;
  const now = performance.now();

  p.textSize(SYMBOL_FONT_SIZE);
  p.textFont('"IM Fell English", serif');
  p.textStyle(p.NORMAL);

  symbols.forEach((sym) => {
    const dx = sym.x - mx;
    const dy = sym.y - my;
    const d1 = dx * Math.sin(A) - dy * Math.cos(A);
    const d2 = dx * Math.cos(A) + dy * Math.sin(A);

    sym.crossedThisFrame = false;
    if (now - sym.lastTrigger > TRIGGER_COOLDOWN_MS) {
      const crossed =
        (sym.prevD1 !== null && Math.sign(d1) !== Math.sign(sym.prevD1)) ||
        (sym.prevD2 !== null && Math.sign(d2) !== Math.sign(sym.prevD2));
      if (crossed) {
        sym.crossedThisFrame = true;
        playSymPing(sym.y, p.height);
        sym.lastTrigger = now;
        sym.hitTime = now;
        addPulse(pulses, sym.x, sym.y, mx, my, A);
      }
    }
    sym.prevD1 = d1;
    sym.prevD2 = d2;

    const elapsed = now - sym.hitTime;
    const t = Math.min(elapsed / SYMBOL_HIT_ANIM_MS, 1);
    const scale = 1 + 0.7 * Math.sin(t * Math.PI);

    // fade in over 800ms from spawn
    const age = now - sym.spawnTime;
    const opacity = Math.min(age / 800, 1);

    p.push();
    p.translate(sym.x, sym.y);
    p.scale(scale);
    p.noStroke();
    p.fill(0, opacity * 255);
    p.text(sym.ch, 0, 0);
    p.pop();
  });
}

// ── agent circle ───────────────────────────────────────────────────────────────
function makeAgentCircle(p) {
  const margin = AGENT_RADIUS + 20;
  return {
    x: p.width / 2,
    y: p.height / 2,
    vx: 0,
    vy: 0,
    targetX: p.random(margin, p.width - margin),
    targetY: p.random(margin, p.height - margin),
    ingestedChars: [],    // { ch, orbitAngle, eatTime }
    lastChordTime: -Infinity,
    chordAnimTime: -Infinity,
    eatAnimTime: -Infinity,
  };
}

function updateAgent(p, agent, blocks, symbols, now) {
  // ── steer toward wander target ────────────────────────────────────────────
  const tdx = agent.targetX - agent.x;
  const tdy = agent.targetY - agent.y;
  const tdist = Math.hypot(tdx, tdy);

  if (tdist < 45) {
    const margin = AGENT_RADIUS + 20;
    agent.targetX = p.random(margin, p.width - margin);
    agent.targetY = p.random(margin, p.height - margin);
  }

  const desired_vx = (tdx / tdist) * AGENT_WANDER_SPEED;
  const desired_vy = (tdy / tdist) * AGENT_WANDER_SPEED;
  agent.vx = p.lerp(agent.vx, desired_vx, AGENT_STEER_LERP);
  agent.vy = p.lerp(agent.vy, desired_vy, AGENT_STEER_LERP);

  agent.x += agent.vx;
  agent.y += agent.vy;

  // bounce off edges
  if (agent.x - AGENT_RADIUS < 0)       { agent.x = AGENT_RADIUS;           agent.vx = Math.abs(agent.vx); }
  if (agent.x + AGENT_RADIUS > p.width)  { agent.x = p.width - AGENT_RADIUS;  agent.vx = -Math.abs(agent.vx); }
  if (agent.y - AGENT_RADIUS < 0)       { agent.y = AGENT_RADIUS;            agent.vy = Math.abs(agent.vy); }
  if (agent.y + AGENT_RADIUS > p.height) { agent.y = p.height - AGENT_RADIUS; agent.vy = -Math.abs(agent.vy); }

  // ── ingest from text blocks (only when the rotating line just crossed the char) ──
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];
    for (let ci = block.chars.length - 1; ci >= 0; ci--) {
      const char = block.chars[ci];
      if (!char.crossedThisFrame) continue;
      const cx = block.x + ci * CHAR_W + CHAR_W / 2;
      const cy = block.y + char.dy;
      if (Math.hypot(cx - agent.x, cy - agent.y) > AGENT_INGEST_DIST) continue;

      agent.ingestedChars.push({ ch: char.ch, orbitAngle: p.random(p.TWO_PI), eatTime: now });
      block.chars.splice(ci, 1);
      if (block.chars.length === 0) blocks.splice(bi, 1);
      agent.eatAnimTime = now;

      if (agent.ingestedChars.length >= AGENT_MAX_CHARS) {
        playChord(agent.ingestedChars);
        agent.chordAnimTime = now;
        agent.lastChordTime = now;
        agent.ingestedChars = [];
      }
    }
  }

  // ── ingest from auto-symbols (same: only on line-cross) ──────────────────
  for (let si = symbols.length - 1; si >= 0; si--) {
    const sym = symbols[si];
    if (!sym.crossedThisFrame) continue;
    if (Math.hypot(sym.x - agent.x, sym.y - agent.y) > AGENT_INGEST_DIST) continue;

    agent.ingestedChars.push({ ch: sym.ch, orbitAngle: p.random(p.TWO_PI), eatTime: now });
    symbols.splice(si, 1);
    agent.eatAnimTime = now;

    if (agent.ingestedChars.length >= AGENT_MAX_CHARS) {
      playChord(agent.ingestedChars);
      agent.chordAnimTime = now;
      agent.lastChordTime = now;
      agent.ingestedChars = [];
    }
  }

  // ── periodic chord even if not full ──────────────────────────────────────
  if (
    agent.ingestedChars.length > 0 &&
    now - agent.lastChordTime > AGENT_CHORD_INTERVAL_MS
  ) {
    playChord(agent.ingestedChars);
    agent.chordAnimTime = now;
    agent.lastChordTime = now;
    agent.ingestedChars = [];
  }
}

function drawAgent(p, agent, now) {
  const chordElapsed = now - agent.chordAnimTime;
  const chordT = Math.min(chordElapsed / AGENT_CHORD_BLOOM_MS, 1);
  const chordBloom = Math.sin(chordT * Math.PI); // 0 → 1 → 0

  const eatElapsed = now - agent.eatAnimTime;
  const eatT = Math.min(eatElapsed / AGENT_EAT_ANIM_MS, 1);
  const eatPulse = Math.sin(eatT * Math.PI);

  const orbitOffset = now * AGENT_ORBIT_SPEED;

  p.push();
  p.translate(agent.x, agent.y);

  // chord bloom: expanding diffuse glow (same layered technique as circles)
  if (chordBloom > 0.01) {
    const maxSpread = AGENT_RADIUS * 9;
    const LAYERS = 28;
    p.noStroke();
    for (let i = LAYERS; i >= 0; i--) {
      const frac = i / LAYERS;
      const r = AGENT_RADIUS + frac * chordBloom * maxSpread;
      const alpha = chordBloom * Math.exp(-frac * frac * 2.8) * 28;
      p.fill(0, alpha);
      p.circle(0, 0, r * 2);
    }
  }

  // eat flash: brief bright ring
  if (eatPulse > 0.01) {
    p.noFill();
    p.stroke(0, eatPulse * 180);
    p.strokeWeight(2.5 * eatPulse);
    p.circle(0, 0, (AGENT_RADIUS + 14) * 2);
  }

  // outer ring — grows slightly on eat
  const displayR = AGENT_RADIUS * (1 + eatPulse * 0.18);
  p.noFill();
  p.stroke(0);
  p.strokeWeight(2);
  p.circle(0, 0, displayR * 2);

  // second inner ring — dashed feel via shorter arc if we had it; use solid thin ring
  p.strokeWeight(0.8);
  p.circle(0, 0, (displayR - 5) * 2);

  // centre dot
  p.noStroke();
  p.fill(0);
  p.circle(0, 0, 7);

  // ingested char count label (inside dot area)
  if (agent.ingestedChars.length > 0) {
    p.textSize(7);
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont('"IM Fell English", serif');
    p.fill(255);
    p.text(agent.ingestedChars.length, 0, 0.5);
  }

  // orbiting ingested characters
  agent.ingestedChars.forEach((ic, idx) => {
    // spread evenly + slow drift
    const baseAngle = (idx / Math.max(agent.ingestedChars.length, 1)) * Math.PI * 2;
    const angle = baseAngle + orbitOffset + ic.orbitAngle * 0.05;
    const ox = Math.cos(angle) * AGENT_ORBIT_RADIUS;
    const oy = Math.sin(angle) * AGENT_ORBIT_RADIUS;

    // fade in from eatTime
    const ageT = Math.min((now - ic.eatTime) / 280, 1);
    const chordFade = chordBloom > 0.01 ? 0.4 + chordBloom * 0.6 : 1;

    p.push();
    p.translate(ox, oy);
    p.textSize(12);
    p.textFont('"IM Fell English", serif');
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();
    p.fill(0, ageT * chordFade * 210);
    p.text(ic.ch, 0, 0);
    p.pop();
  });

  p.pop();
}

// ── React component ────────────────────────────────────────────────────────────
export default function AxesCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    let sketch;

    import("p5").then(({ default: P5 }) => {
      sketch = new P5((p) => {
        let angle = 0;
        let spinning = false;
        let spinSpeed = 0;
        let blocks = [];
        let activeBlock = -1;
        let circles = [];
        let symbols = [];
        let lastSymbolTime = -Infinity;
        let smoothX = 0;
        let smoothY = 0;
        let linePulses = [];
        let shockwaves = [];
        let nextShockwaveId = 1;
        let showInfo = false;
        let infoT = 0;
        let mode = 'default'; // 'default' | 'typing'
        let agentCircle = null;

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight);
          p.pixelDensity(window.devicePixelRatio || 1);
          p.noCursor();
          circles = Array.from({ length: CIRCLE_COUNT }, () => makeCircle(p));
          agentCircle = makeAgentCircle(p);
          smoothX = p.windowWidth / 2;
          smoothY = p.windowHeight / 2;
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
        };

        p.draw = () => {
          if (spinning) spinSpeed = Math.min(spinSpeed + ACCEL, TARGET_SPEED);
          else spinSpeed = Math.max(spinSpeed - DECEL, 0);
          angle += spinSpeed;

          // spawn a symbol every SYMBOL_INTERVAL_MS
          const now = performance.now();
          if (now - lastSymbolTime > SYMBOL_INTERVAL_MS) {
            symbols.push(spawnSymbol(p));
            lastSymbolTime = now;
          }

          // gaussian-style lag: lerp smoothed position toward actual mouse
          smoothX = p.lerp(smoothX, p.mouseX, 0.2);
          smoothY = p.lerp(smoothY, p.mouseY, 0.2);

          p.background(255);

          updateAndDrawCircles(p, circles, angle, smoothX, smoothY, linePulses, shockwaves);
          processSymbols(p, symbols, angle, smoothX, smoothY, linePulses);
          processBlocks(p, blocks, activeBlock, angle, smoothX, smoothY, linePulses);
          updateAgent(p, agentCircle, blocks, symbols, now);
          drawCross(p, smoothX, smoothY, angle);
          drawShockwaves(p, shockwaves, smoothX, smoothY);
          drawLinePulses(p, linePulses, angle, smoothX, smoothY);
          drawAgent(p, agentCircle, now);

          // info overlay — animates in/out on spacebar (default mode only)
          infoT = p.lerp(infoT, showInfo ? 1 : 0, 0.1);

          if (infoT > 0.01) {
            const R = infoT * 75; // 2.5x the 30px reference
            p.push();
            p.fill(255, infoT * 255);
            p.stroke(0, infoT * 220);
            p.strokeWeight(1.5);
            p.circle(smoothX, smoothY, R * 2);

            if (infoT > 0.6) {
              const tA = ((infoT - 0.6) / 0.4) * 255;
              const rotMode = spinning || spinSpeed > 0 ? 'spinning' : 'still';
              const speedPct = Math.round((spinSpeed / TARGET_SPEED) * 100);

              p.fill(0, tA);
              p.noStroke();
              p.textAlign(p.CENTER, p.CENTER);
              p.textFont('"IM Fell English", serif');
              p.textStyle(p.ITALIC);

              p.textSize(10);
              p.text(`rotation: ${rotMode}`, smoothX, smoothY - 18);

              p.textSize(10);
              p.text(`speed: ${speedPct}%`, smoothX, smoothY - 4);

              p.textStyle(p.NORMAL);
              p.textSize(8);
              p.text(`mode: default`, smoothX, smoothY + 12);

              p.textSize(7);
              p.fill(0, tA * 0.55);
              p.text('enter → type  ·  space → close', smoothX, smoothY + 26);
            }
            p.pop();
          } else {
            // centre dot — ring indicator when in typing mode
            p.noStroke();
            p.fill(0);
            p.circle(smoothX, smoothY, 6);

          }
        };

        p.mouseClicked = () => {
          Tone.start();
          spinning = !spinning;
        };

        p.keyPressed = () => {
          Tone.start();

          if (p.keyCode === 16) {
            shockwaves.push({ id: nextShockwaveId++, birthTime: performance.now() });
            return false;
          }

          // ── default mode ───────────────────────────────────────────────────
          if (mode === 'default') {
            if (p.key === " ") {
              showInfo = !showInfo;
              return false;
            }
            if (p.key === "Enter") {
              // enter typing mode
              showInfo = false;
              mode = 'typing';
              activeBlock = -1;
              return false;
            }
            if (p.key === "Backspace") {
              // still allow deleting the last released word in default mode
              const idx = blocks.length - 1;
              const block = blocks[idx];
              if (!block) return false;
              block.chars.pop();
              if (block.chars.length === 0) blocks.splice(idx, 1);
              return false;
            }
            return false; // swallow all other keys in default mode
          }

          // ── typing mode ────────────────────────────────────────────────────
          if (mode === 'typing') {
            if (p.key === "Enter") {
              // release current word in place, return to default mode
              activeBlock = -1;
              mode = 'default';
              return false;
            }
            if (p.key === "Backspace") {
              const idx = activeBlock !== -1 ? activeBlock : blocks.length - 1;
              const block = blocks[idx];
              if (!block) return false;
              block.chars.pop();
              if (block.chars.length === 0) {
                blocks.splice(idx, 1);
                activeBlock = -1;
              }
              return false;
            }
            // all printable chars (including space) go into the word
            if (p.key.length !== 1) return false;
            if (activeBlock === -1) {
              const margin = 60;
              blocks.push({
                x: p.random(margin, p.width - margin),
                y: p.random(margin + FONT_SIZE, p.height - margin),
                chars: [],
              });
              activeBlock = blocks.length - 1;
            }
            blocks[activeBlock].chars.push({
              ch: p.key,
              dy: p.random(-JITTER, JITTER),
              prevD1: null,
              prevD2: null,
              lastTrigger: 0,
              hitTime: -Infinity,
            });
            return false;
          }
        };
      }, containerRef.current);
    });

    return () => {
      if (sketch) sketch.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
}
