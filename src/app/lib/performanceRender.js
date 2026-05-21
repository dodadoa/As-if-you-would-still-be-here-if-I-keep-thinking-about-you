import { CHAR_W, CIRCLES, PERFORMANCE, SHOCKWAVE, SYMBOLS, TEXT } from "../config";
import { playCharPing, playCircPing, playSymPing } from "./audio";
import { addPulse, drawCross, drawLinePulses, drawShockwaves } from "./radar";
import { drawAgent, updateAgent } from "./agent";
import { processBlocks } from "./text";

function dissolveAlpha(age, lifetime, dissolve) {
  if (age < lifetime) return 255;
  const t = Math.min((age - lifetime) / dissolve, 1);
  return 255 * (1 - t);
}

function shouldRemove(age, lifetime, dissolve) {
  return age >= lifetime + dissolve;
}

export function updatePerformanceCircles(p, ctx, angle, mx, my, features, now) {
  if (!features.circles) return;

  const { circles, linePulses, shockwaves } = ctx;
  const driftMult = features.drift ? PERFORMANCE.DRIFT.CIRCLE_SPEED : 1;
  const A = angle;

  for (let ci = circles.length - 1; ci >= 0; ci--) {
    const c = circles[ci];
    if (c.bornTime == null) c.bornTime = now;

    if (features.drift || !features.autoFade) {
      c.x += c.vx * driftMult;
      c.y += c.vy * driftMult;
      if (c.x - c.r < 0) { c.x = c.r; c.vx *= -1; }
      if (c.x + c.r > p.width) { c.x = p.width - c.r; c.vx *= -1; }
      if (c.y - c.r < 0) { c.y = c.r; c.vy *= -1; }
      if (c.y + c.r > p.height) { c.y = p.height - c.r; c.vy *= -1; }
    }

    if (features.scanner) {
      const dx = c.x - mx;
      const dy = c.y - my;
      const d1 = dx * Math.sin(A) - dy * Math.cos(A);
      const d2 = dx * Math.cos(A) + dy * Math.sin(A);

      if (now - c.lastTrigger > TEXT.TRIGGER_COOLDOWN_MS) {
        const crossed =
          (c.prevD1 !== null && Math.sign(d1) !== Math.sign(c.prevD1)) ||
          (c.prevD2 !== null && Math.sign(d2) !== Math.sign(c.prevD2));
        if (crossed) {
          playCircPing(c.y, p.height);
          c.lastTrigger = now;
          c.hitTime = now;
          addPulse(linePulses, c.x, c.y, mx, my, A);
        }
      }
      c.prevD1 = d1;
      c.prevD2 = d2;
    }

    if (features.shockwave) {
      for (let i = 0; i < shockwaves.length; i++) {
        const wave = shockwaves[i];
        if (c.lastShockId === wave.id) continue;
        const r = ((now - wave.birthTime) / 1000) * SHOCKWAVE.SPEED;
        const centerDist = Math.hypot(c.x - mx, c.y - my);
        if (Math.abs(centerDist - r) <= SHOCKWAVE.WINDOW + c.r) {
          c.lastShockId = wave.id;
          c.hitTime = now;
          playCircPing(c.y, p.height);
          addPulse(linePulses, c.x, c.y, mx, my, A);
        }
      }
    }

    const age = now - c.bornTime;
    if (features.autoFade && shouldRemove(age, PERFORMANCE.FADE.CIRCLE_LIFETIME_MS, PERFORMANCE.FADE.CIRCLE_DISSOLVE_MS)) {
      circles.splice(ci, 1);
      continue;
    }

    const hitElapsed = now - c.hitTime;
    const t = Math.min(hitElapsed / CIRCLES.HIT_ANIM_MS, 1);
    const bloom = Math.sin(t * Math.PI);
    let alpha = 255;
    if (features.autoFade) {
      alpha = dissolveAlpha(age, PERFORMANCE.FADE.CIRCLE_LIFETIME_MS, PERFORMANCE.FADE.CIRCLE_DISSOLVE_MS);
    }

    if (features.ghost && c.ghostX != null) {
      p.push();
      p.translate(c.ghostX, c.ghostY);
      p.noStroke();
      p.fill(0, 28);
      p.circle(0, 0, c.r * 2);
      p.pop();
    }
    if (features.ghost) {
      c.ghostX = c.x;
      c.ghostY = c.y;
    }

    p.push();
    p.translate(c.x, c.y);

    if (bloom > 0.02) {
      const maxSpread = c.r * 7;
      const LAYERS = 24;
      p.noStroke();
      for (let i = LAYERS; i >= 0; i--) {
        const frac = i / LAYERS;
        const rr = c.r + frac * bloom * maxSpread;
        const falloff = Math.exp(-frac * frac * 3.5);
        const col = Math.round(255 * frac);
        p.fill(col, bloom * falloff * 22 * (alpha / 255));
        p.circle(0, 0, rr * 2);
      }
    }

    const isHit = bloom > 0.02;
    if (c.filled) {
      if (isHit) { p.fill(255, alpha); p.stroke(0, alpha); p.strokeWeight(1.5); }
      else { p.fill(0, alpha); p.noStroke(); }
    } else {
      if (isHit) { p.fill(0, alpha); p.noStroke(); }
      else { p.noFill(); p.stroke(0, alpha); p.strokeWeight(1.5); }
    }
    p.circle(0, 0, c.r * 2);
    p.pop();
  }

  while (features.circles && circles.length < CIRCLES.COUNT) {
    const r = p.random(3, 9);
    circles.push({
      x: p.random(r, p.width - r),
      y: p.random(r, p.height - r),
      r,
      vx: p.random(0.04, 0.12) * (p.random() > 0.5 ? 1 : -1),
      vy: p.random(0.04, 0.12) * (p.random() > 0.5 ? 1 : -1),
      filled: p.random() > 0.5,
      prevD1: null,
      prevD2: null,
      lastTrigger: 0,
      hitTime: -Infinity,
      lastShockId: -1,
      bornTime: now,
    });
  }
}

export function updatePerformanceSymbols(p, ctx, angle, mx, my, features, now) {
  if (!features.symbols) return;

  const { symbols, linePulses } = ctx;
  const A = angle;
  const driftMult = features.drift ? PERFORMANCE.DRIFT.SYMBOL_SPEED : 0;

  p.textSize(SYMBOLS.FONT_SIZE);
  p.textFont(TEXT.FONT_FAMILY);

  for (let si = symbols.length - 1; si >= 0; si--) {
    const sym = symbols[si];
    if (sym.bornTime == null) sym.bornTime = now;

    if (features.drift) {
      sym.x += (sym.vx ?? 0) * driftMult;
      sym.y += (sym.vy ?? 0) * driftMult;
      if (sym.x < 40 || sym.x > p.width - 40) sym.vx = -(sym.vx ?? 0.3);
      if (sym.y < 40 || sym.y > p.height - 40) sym.vy = -(sym.vy ?? 0.3);
    }

    if (features.scanner) {
      const dx = sym.x - mx;
      const dy = sym.y - my;
      const d1 = dx * Math.sin(A) - dy * Math.cos(A);
      const d2 = dx * Math.cos(A) + dy * Math.sin(A);

      if (now - sym.lastTrigger > TEXT.TRIGGER_COOLDOWN_MS) {
        const crossed =
          (sym.prevD1 !== null && Math.sign(d1) !== Math.sign(sym.prevD1)) ||
          (sym.prevD2 !== null && Math.sign(d2) !== Math.sign(sym.prevD2));
        if (crossed) {
          playSymPing(sym.y, p.height);
          sym.lastTrigger = now;
          sym.hitTime = now;
          addPulse(linePulses, sym.x, sym.y, mx, my, A);
        }
      }
      sym.prevD1 = d1;
      sym.prevD2 = d2;
    }

    const age = now - sym.bornTime;
    if (features.autoFade && shouldRemove(age, PERFORMANCE.FADE.SYMBOL_LIFETIME_MS, PERFORMANCE.FADE.SYMBOL_DISSOLVE_MS)) {
      symbols.splice(si, 1);
      continue;
    }

    const hitElapsed = now - sym.hitTime;
    const t = Math.min(hitElapsed / SYMBOLS.HIT_ANIM_MS, 1);
    const scale = 1 + 0.7 * Math.sin(t * Math.PI);
    let alpha = Math.min(age / SYMBOLS.FADE_IN_MS, 1) * 255;
    if (features.autoFade) {
      alpha = Math.min(alpha, dissolveAlpha(age, PERFORMANCE.FADE.SYMBOL_LIFETIME_MS, PERFORMANCE.FADE.SYMBOL_DISSOLVE_MS));
    }

    if (features.ghost && sym.ghostX != null) {
      p.push();
      p.translate(sym.ghostX, sym.ghostY);
      p.fill(0, 22);
      p.textSize(SYMBOLS.FONT_SIZE * 0.95);
      p.text(sym.ch, 0, 0);
      p.pop();
    }
    if (features.ghost) {
      sym.ghostX = sym.x;
      sym.ghostY = sym.y;
    }

    p.push();
    p.translate(sym.x, sym.y);
    p.scale(scale);
    p.noStroke();
    p.fill(0, alpha);
    p.text(sym.ch, 0, 0);
    p.pop();
  }
}

export function spawnPerformanceSymbol(p, symbols) {
  const margin = TEXT.MARGIN;
  symbols.push({
    ch: SYMBOLS.CHARS[Math.floor(p.random(SYMBOLS.CHARS.length))],
    x: p.random(margin, p.width - margin),
    y: p.random(margin + SYMBOLS.FONT_SIZE, p.height - margin),
    vx: (p.random() - 0.5) * 0.6,
    vy: (p.random() - 0.5) * 0.6,
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    bornTime: performance.now(),
  });
}

export function driftBlocks(ctx, features) {
  if (!features.drift) return;
  ctx.blocks.forEach((block) => {
    if (block.vx == null) {
      block.vx = (Math.random() - 0.5) * PERFORMANCE.DRIFT.TEXT_SPEED;
      block.vy = (Math.random() - 0.5) * PERFORMANCE.DRIFT.TEXT_SPEED;
    }
    block.x += block.vx;
    block.y += block.vy;
    const { p } = ctx;
    const margin = TEXT.MARGIN;
    if (block.x < margin) { block.x = margin; block.vx *= -1; }
    if (block.x > p.width - margin - 80) { block.x = p.width - margin - 80; block.vx *= -1; }
    if (block.y < margin) { block.y = margin; block.vy *= -1; }
    if (block.y > p.height - margin) { block.y = p.height - margin; block.vy *= -1; }
  });
}

export function drawPerformanceCaption(p, ctx, features, now) {
  if (!features.caption) return;

  if (ctx.captionText !== features.caption) {
    ctx.captionText = features.caption;
    ctx.captionShownAt = now;
  }

  const age = now - ctx.captionShownAt;
  let alpha = 255;
  if (age < PERFORMANCE.CAPTION_FADE_MS) alpha = (age / PERFORMANCE.CAPTION_FADE_MS) * 255;
  else if (age > PERFORMANCE.CAPTION_FADE_MS + PERFORMANCE.CAPTION_HOLD_MS) {
    const out = age - PERFORMANCE.CAPTION_FADE_MS - PERFORMANCE.CAPTION_HOLD_MS;
    alpha = Math.max(0, 255 - (out / PERFORMANCE.CAPTION_FADE_MS) * 255);
  }

  p.push();
  p.textAlign(p.CENTER, p.BOTTOM);
  p.textFont(TEXT.FONT_FAMILY);
  p.fill(0, alpha);
  p.textSize(13);
  p.textStyle(p.ITALIC);
  p.text(features.caption, p.width / 2, p.height - 12);
  p.pop();
}

const SCENE_TITLE_FADE_IN_MS = 600;
const SCENE_TITLE_HOLD_MS = 4000;
const SCENE_TITLE_FADE_OUT_MS = 1000;

function drawSceneTitle(p, ctx, now) {
  if (!ctx.sceneTitleText) return;

  const age = ctx.sceneTitleShownAt > 0 ? now - ctx.sceneTitleShownAt : 0;
  let alpha;
  if (age < SCENE_TITLE_FADE_IN_MS) {
    alpha = (age / SCENE_TITLE_FADE_IN_MS) * 255;
  } else if (age < SCENE_TITLE_FADE_IN_MS + SCENE_TITLE_HOLD_MS) {
    alpha = 255;
  } else {
    const outAge = age - SCENE_TITLE_FADE_IN_MS - SCENE_TITLE_HOLD_MS;
    alpha = Math.max(0, 255 - (outAge / SCENE_TITLE_FADE_OUT_MS) * 255);
    if (alpha <= 0) {
      ctx.sceneTitleText = "";
      return;
    }
  }

  p.push();
  p.textFont(TEXT.FONT_FAMILY);
  p.textSize(15);
  p.textAlign(p.CENTER, p.CENTER);

  const tw = Math.max(p.textWidth(ctx.sceneTitleText), 80);
  const padX = 24;
  const padY = 18;
  const ew = tw + padX * 2;
  const eh = 15 + padY * 2;

  p.fill(255, alpha);
  p.stroke(0, alpha);
  p.strokeWeight(1);
  p.rect(ctx.smoothX - ew / 2, ctx.smoothY - eh / 2, ew, eh, 20);

  p.fill(0, alpha);
  p.noStroke();
  p.text(ctx.sceneTitleText, ctx.smoothX, ctx.smoothY);
  p.pop();
}

export function drawPerformanceFrame(ctx, now, features) {
  const { p } = ctx;

  if (features.scanner) {
    drawCross(p, ctx.smoothX, ctx.smoothY, ctx.angle);
    drawShockwaves(p, ctx.shockwaves, ctx.smoothX, ctx.smoothY);
    drawLinePulses(p, ctx.linePulses, ctx.angle, ctx.smoothX, ctx.smoothY);
  }

  const agentActive = features.agent && (ctx.arcMode !== 2 || ctx.agentEnabled);
  if (agentActive && ctx.agentCircle) {
    updateAgent(p, ctx.agentCircle, ctx.blocks, ctx.symbols, now, ctx.activeBlock);
    drawAgent(p, ctx.agentCircle, now);
  }

  p.noStroke();
  p.fill(0);
  p.circle(ctx.smoothX, ctx.smoothY, 6);

  drawSceneTitle(p, ctx, now);
}
