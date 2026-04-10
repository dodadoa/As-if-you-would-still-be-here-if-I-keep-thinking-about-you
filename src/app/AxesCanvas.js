"use client";

import { useEffect, useRef } from "react";
import * as Tone from "tone";

const TARGET_SPEED = 0.0012;
const ACCEL = 0.00006;
const DECEL = 0.00006;

const FONT_SIZE = 14;
const CHAR_W = FONT_SIZE * 0.75;
const JITTER = 2;
const TRIGGER_COOLDOWN_MS = 120;
const HIT_ANIM_MS = 1200;
const HIT_SCALE = 0.55;

const CIRCLE_COUNT = 8;
const CIRCLE_HIT_ANIM_MS = 1000;

const SYMBOL_INTERVAL_MS = 5000;
const SYMBOL_FONT_SIZE = 20;
const SYMBOL_CHARS = "!@#$%^&*+=?~<>|\\§¶•◆★☆▲△▽▼◇○●□■";
const SYMBOL_HIT_ANIM_MS = 1200;

// ── Tone.js synths ─────────────────────────────────────────────────────────────
let charSynth = null;
function getCharSynth() {
  if (!charSynth) {
    charSynth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.01 },
      volume: -12,
    }).toDestination();
  }
  return charSynth;
}

let circSynth = null;
function getCircSynth() {
  if (!circSynth) {
    circSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -10,
    }).toDestination();
  }
  return circSynth;
}

let symSynth = null;
function getSymSynth() {
  if (!symSynth) {
    symSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.2 },
      volume: -16,
    }).toDestination();
  }
  return symSynth;
}

function playCharPing(freq) {
  try { getCharSynth().triggerAttackRelease(freq, "32n"); } catch (_) {}
}
function playCircPing(freq) {
  try { getCircSynth().triggerAttackRelease(freq, "8n"); } catch (_) {}
}
function playSymPing(freq) {
  try { getSymSynth().triggerAttackRelease(freq, "16n"); } catch (_) {}
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

// ── circles ────────────────────────────────────────────────────────────────────
function makeCircle(p) {
  const r = p.random(6, 18);
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
  };
}

function updateAndDrawCircles(p, circles, angle) {
  const mx = p.mouseX;
  const my = p.mouseY;
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
        // pitch mapped to y: lower circles = lower notes, range 110–440 Hz
        const freq = 440 * Math.pow(0.25, c.y / p.height);
        playCircPing(freq);
        c.lastTrigger = now;
        c.hitTime = now;
      }
    }
    c.prevD1 = d1;
    c.prevD2 = d2;

    // sine-bell scale feedback + color inversion while animating
    const elapsed = now - c.hitTime;
    const t = Math.min(elapsed / CIRCLE_HIT_ANIM_MS, 1);
    const scale = 1 + 0.6 * Math.sin(t * Math.PI);
    const isHit = t < 1;
    const drawFilled = isHit ? !c.filled : c.filled;

    p.push();
    p.translate(c.x, c.y);
    p.scale(scale);
    if (drawFilled) {
      p.fill(0);
      p.noStroke();
    } else {
      p.noFill();
      p.stroke(0);
      p.strokeWeight(1.5 / scale); // keep stroke visually consistent while scaled
    }
    p.circle(0, 0, c.r * 2);
    p.pop();
  });
}

// ── text blocks ────────────────────────────────────────────────────────────────
function processBlocks(p, blocks, activeBlock, angle) {
  const mx = p.mouseX;
  const my = p.mouseY;
  const A = angle;
  const now = performance.now();

  p.textSize(FONT_SIZE);
  p.textFont('"Press Start 2P", monospace');
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

      if (now - char.lastTrigger > TRIGGER_COOLDOWN_MS) {
        const crossed =
          (char.prevD1 !== null && Math.sign(d1) !== Math.sign(char.prevD1)) ||
          (char.prevD2 !== null && Math.sign(d2) !== Math.sign(char.prevD2));
        if (crossed) {
          const freq = 880 * Math.pow(0.25, py / p.height);
          playCharPing(freq);
          char.lastTrigger = now;
          char.hitTime = now;
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

function processSymbols(p, symbols, angle) {
  const mx = p.mouseX;
  const my = p.mouseY;
  const A = angle;
  const now = performance.now();

  p.textSize(SYMBOL_FONT_SIZE);
  p.textFont('"Press Start 2P", monospace');
  p.textStyle(p.NORMAL);

  symbols.forEach((sym) => {
    const dx = sym.x - mx;
    const dy = sym.y - my;
    const d1 = dx * Math.sin(A) - dy * Math.cos(A);
    const d2 = dx * Math.cos(A) + dy * Math.sin(A);

    if (now - sym.lastTrigger > TRIGGER_COOLDOWN_MS) {
      const crossed =
        (sym.prevD1 !== null && Math.sign(d1) !== Math.sign(sym.prevD1)) ||
        (sym.prevD2 !== null && Math.sign(d2) !== Math.sign(sym.prevD2));
      if (crossed) {
        const freq = 330 * Math.pow(2, (sym.y / p.height - 0.5) * -1.5);
        playSymPing(freq);
        sym.lastTrigger = now;
        sym.hitTime = now;
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

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight);
          p.pixelDensity(window.devicePixelRatio || 1);
          p.noCursor();
          circles = Array.from({ length: CIRCLE_COUNT }, () => makeCircle(p));
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

          p.background(255);

          updateAndDrawCircles(p, circles, angle);
          processSymbols(p, symbols, angle);
          processBlocks(p, blocks, activeBlock, angle);
          drawCross(p, p.mouseX, p.mouseY, angle);

          // centre dot
          p.noStroke();
          p.fill(0);
          p.circle(p.mouseX, p.mouseY, 6);
        };

        p.mouseClicked = () => {
          Tone.start();
          spinning = !spinning;
        };

        p.keyPressed = () => {
          Tone.start();

          if (p.key === "Enter") {
            activeBlock = -1;
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

          if (p.key.length !== 1) return;

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
