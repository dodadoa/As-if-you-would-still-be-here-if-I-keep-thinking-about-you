import { CHAR_W, SCENE1, TEXT } from "../config";
import { playCharPing } from "./audio";
import { addPulse } from "./radar";

export function makeChar(p, ch, col = 0) {
  return {
    ch,
    col,
    dy: p.random(-TEXT.JITTER, TEXT.JITTER),
    prevD1: null,
    prevD2: null,
    lastTrigger: 0,
    hitTime: -Infinity,
    placedTime: null,
  };
}

export function stampScene1Placement(blocks, now, skipBlockIndex = -1) {
  blocks.forEach((block, bi) => {
    if (bi === skipBlockIndex) return;
    block.chars.forEach((char) => {
      if (char.placedTime == null) char.placedTime = now;
    });
  });
}

export function processDissolvingBlocks(p, blocks, activeBlock, now) {
  p.textSize(TEXT.FONT_SIZE);
  p.textFont(TEXT.FONT_FAMILY);
  p.noStroke();

  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const block = blocks[bi];

    // auto-stamp chars when the per-block fade timer fires (arc 2 typed words)
    if (block.autoFadeAt != null && now >= block.autoFadeAt) {
      block.chars.forEach((c) => {
        if (c.placedTime == null) {
          const delay = Math.random() * SCENE1.CHAR_STAGGER_MS;
          c.placedTime = now - SCENE1.CHAR_LIFETIME_MS + delay;
        }
      });
      block.autoFadeAt = null;
    }

    for (let i = block.chars.length - 1; i >= 0; i--) {
      const char = block.chars[i];
      const drawX = block.x + char.col * CHAR_W;

      if (char.placedTime == null) {
        const drawY = block.y + char.dy;
        p.push();
        p.translate(drawX + CHAR_W / 2, drawY);
        p.fill(0);
        p.textStyle(p.NORMAL);
        p.text(char.ch, -CHAR_W / 2, 0);
        p.pop();
        continue;
      }

      const age = now - char.placedTime;
      if (age >= SCENE1.CHAR_LIFETIME_MS + SCENE1.DISSOLVE_MS) {
        block.chars.splice(i, 1);
        continue;
      }

      let alpha = 255;
      let scale = 1;
      let driftY = 0;
      if (age > SCENE1.CHAR_LIFETIME_MS) {
        const t = (age - SCENE1.CHAR_LIFETIME_MS) / SCENE1.DISSOLVE_MS;
        alpha = 255 * (1 - t);
        scale = 1 + t * SCENE1.DISSOLVE_SCALE;
        driftY = -t * SCENE1.DISSOLVE_DRIFT;
      }

      const drawY = block.y + char.dy + driftY;

      p.push();
      p.translate(drawX + CHAR_W / 2, drawY);
      p.scale(scale);
      p.fill(0, alpha);
      p.textStyle(p.NORMAL);
      p.text(char.ch, -CHAR_W / 2, 0);
      p.pop();
    }

    if (block.chars.length === 0) blocks.splice(bi, 1);
  }

  if (activeBlock != null) {
    const block = activeBlock;
    const cx = block.x + block.chars.length * CHAR_W;
    const cy = block.y;
    if (Math.floor(now / SCENE1.CURSOR_BLINK_MS) % 2 === 0) {
      p.noStroke();
      p.fill(0);
      p.rect(cx, cy - TEXT.FONT_SIZE, CHAR_W * 1.5, TEXT.FONT_SIZE + 3);
    }
  }
}

export function updateBlockCollisions(p, blocks, angle, mx, my, pulses) {
  const A = angle;
  const now = performance.now();

  blocks.forEach((block) => {
    block.chars.forEach((char) => {
      const px = block.x + char.col * CHAR_W + CHAR_W / 2;
      const py = block.y + char.dy - TEXT.FONT_SIZE / 2;
      const dx = px - mx;
      const dy = py - my;

      const d1 = dx * Math.sin(A) - dy * Math.cos(A);
      const d2 = dx * Math.cos(A) + dy * Math.sin(A);

      char.crossedThisFrame = false;
      if (now - char.lastTrigger > TEXT.TRIGGER_COOLDOWN_MS) {
        const crossed =
          (char.prevD1 !== null && Math.sign(d1) !== Math.sign(char.prevD1)) ||
          (char.prevD2 !== null && Math.sign(d2) !== Math.sign(char.prevD2));
        if (crossed) {
          char.crossedThisFrame = true;
          playCharPing(py, p.height);
          char.lastTrigger = now;
          char.hitTime = now;
          addPulse(pulses, block.x + char.col * CHAR_W + CHAR_W / 2, block.y + char.dy, mx, my, A);
        }
      }
      char.prevD1 = d1;
      char.prevD2 = d2;
    });
  });
}

export function processBlocks(p, blocks, activeBlock, angle, mx, my, pulses) {
  updateBlockCollisions(p, blocks, angle, mx, my, pulses);
  const now = performance.now();

  p.textSize(TEXT.FONT_SIZE);
  p.textFont(TEXT.FONT_FAMILY);
  p.fill(0);
  p.noStroke();

  blocks.forEach((block, bi) => {
    block.chars.forEach((char) => {
      const elapsed = now - (char.hitTime ?? -Infinity);
      const t = Math.min(elapsed / TEXT.HIT_ANIM_MS, 1);
      const scale = 1 + TEXT.HIT_SCALE * Math.sin(t * Math.PI);

      const drawX = block.x + char.col * CHAR_W;
      const drawY = block.y + char.dy;

      p.push();
      p.translate(drawX + CHAR_W / 2, drawY);
      p.scale(scale);
      p.textStyle(t < 1 ? p.BOLD : p.NORMAL);
      p.text(char.ch, -CHAR_W / 2, 0);
      p.pop();
    });

    if (block === activeBlock) {
      const cx = block.x + block.chars.length * CHAR_W;
      const cy = block.y;
      if (Math.floor(performance.now() / SCENE1.CURSOR_BLINK_MS) % 2 === 0) {
        p.noStroke();
        p.fill(0);
        p.rect(cx, cy - TEXT.FONT_SIZE, CHAR_W * 1.5, TEXT.FONT_SIZE + 3);
      }
    }
  });
}

export function createTextBlock(p) {
  const margin = TEXT.MARGIN;
  return {
    x: p.random(margin, p.width - margin),
    y: p.random(margin + TEXT.FONT_SIZE, p.height - margin),
    chars: [],
  };
}
