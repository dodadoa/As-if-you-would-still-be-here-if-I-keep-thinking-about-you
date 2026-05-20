import { SYMBOLS, TEXT } from "../config";
import { playSymPing } from "./audio";
import { addPulse } from "./radar";

export function spawnSymbol(p) {
  const margin = TEXT.MARGIN;
  return {
    ch: SYMBOLS.CHARS[Math.floor(p.random(SYMBOLS.CHARS.length))],
    x: p.random(margin, p.width - margin),
    y: p.random(margin + SYMBOLS.FONT_SIZE, p.height - margin),
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    spawnTime: performance.now(),
  };
}

export function processSymbols(p, symbols, angle, mx, my, pulses) {
  const A = angle;
  const now = performance.now();

  p.textSize(SYMBOLS.FONT_SIZE);
  p.textFont(TEXT.FONT_FAMILY);
  p.textStyle(p.NORMAL);

  symbols.forEach((sym) => {
    const dx = sym.x - mx;
    const dy = sym.y - my;
    const d1 = dx * Math.sin(A) - dy * Math.cos(A);
    const d2 = dx * Math.cos(A) + dy * Math.sin(A);

    sym.crossedThisFrame = false;
    if (now - sym.lastTrigger > TEXT.TRIGGER_COOLDOWN_MS) {
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
    const t = Math.min(elapsed / SYMBOLS.HIT_ANIM_MS, 1);
    const scale = 1 + 0.7 * Math.sin(t * Math.PI);

    const age = now - sym.spawnTime;
    const opacity = Math.min(age / SYMBOLS.FADE_IN_MS, 1);

    p.push();
    p.translate(sym.x, sym.y);
    p.scale(scale);
    p.noStroke();
    p.fill(0, opacity * 255);
    p.text(sym.ch, 0, 0);
    p.pop();
  });
}
