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

export function charPos(block, char) {
  return {
    x: block.x + char.col * CHAR_W + (char.driftX ?? 0),
    y: block.y + char.dy + (char.driftY ?? 0),
  };
}

export function driftBlockChars(p, blocks, skipBlock, speed) {
  const margin = TEXT.MARGIN;
  for (const block of blocks) {
    if (block === skipBlock) continue;
    for (const char of block.chars) {
      if (char.vx == null) {
        char.vx = (Math.random() - 0.5) * speed;
        char.vy = (Math.random() - 0.5) * speed;
      }
      char.driftX = (char.driftX ?? 0) + char.vx;
      char.driftY = (char.driftY ?? 0) + char.vy;

      const px = block.x + char.col * CHAR_W + char.driftX;
      const py = block.y + char.dy + char.driftY;
      if (px < margin) {
        char.driftX += margin - px;
        char.vx = Math.abs(char.vx);
      } else if (px > p.width - margin) {
        char.driftX -= px - (p.width - margin);
        char.vx = -Math.abs(char.vx);
      }
      if (py < margin) {
        char.driftY += margin - py;
        char.vy = Math.abs(char.vy);
      } else if (py > p.height - margin) {
        char.driftY -= py - (p.height - margin);
        char.vy = -Math.abs(char.vy);
      }
    }
  }
}

export function scheduleBlockCharFade(block, startTime) {
  block.chars.forEach((char, i) => {
    if (char.placedTime == null) {
      char.placedTime = startTime + i * SCENE1.CHAR_FADE_STAGGER_MS;
    }
  });
}

export function getCharFadeState(char, now) {
  if (char.placedTime == null) {
    return { alpha: 255, opacity: 1, scale: 1, driftY: 0, remove: false };
  }

  const age = now - char.placedTime;
  if (age < 0) {
    return { alpha: 255, opacity: 1, scale: 1, driftY: 0, remove: false };
  }
  if (age >= SCENE1.CHAR_LIFETIME_MS + SCENE1.DISSOLVE_MS) {
    return { alpha: 0, opacity: 0, scale: 1, driftY: 0, remove: true };
  }
  if (age > SCENE1.CHAR_LIFETIME_MS) {
    const t = (age - SCENE1.CHAR_LIFETIME_MS) / SCENE1.DISSOLVE_MS;
    const opacity = 1 - t;
    return {
      alpha: 255 * opacity,
      opacity,
      scale: 1 + t * SCENE1.DISSOLVE_SCALE,
      driftY: -t * SCENE1.DISSOLVE_DRIFT,
      remove: false,
    };
  }
  return { alpha: 255, opacity: 1, scale: 1, driftY: 0, remove: false };
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

    // auto-stamp chars when the per-block fade timer fires (arc 2+ typed words)
    if (block.autoFadeAt != null && now >= block.autoFadeAt) {
      scheduleBlockCharFade(block, now);
      block.autoFadeAt = null;
    }

    for (let i = block.chars.length - 1; i >= 0; i--) {
      const char = block.chars[i];
      const pos = charPos(block, char);
      const drawX = pos.x;
      const fade = getCharFadeState(char, now);

      if (char.placedTime == null) {
        const hitElapsed = now - (char.hitTime ?? -Infinity);
        const hitT = Math.min(hitElapsed / TEXT.HIT_ANIM_MS, 1);
        const hitScale = 1 + TEXT.HIT_SCALE * Math.sin(hitT * Math.PI);
        p.push();
        p.translate(drawX + CHAR_W / 2, pos.y);
        p.scale(hitScale);
        p.fill(0);
        p.textStyle(hitT < 1 ? p.BOLD : p.NORMAL);
        p.text(char.ch, -CHAR_W / 2, 0);
        p.pop();
        continue;
      }

      if (fade.remove) {
        block.chars.splice(i, 1);
        continue;
      }

      const hitElapsed = now - (char.hitTime ?? -Infinity);
      const hitT = Math.min(hitElapsed / TEXT.HIT_ANIM_MS, 1);
      const scale = fade.scale * (1 + TEXT.HIT_SCALE * Math.sin(hitT * Math.PI));
      const drawY = pos.y + fade.driftY;

      p.push();
      p.translate(drawX + CHAR_W / 2, drawY);
      p.scale(scale);
      p.fill(0, fade.alpha);
      p.textStyle(hitT < 1 ? p.BOLD : p.NORMAL);
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
      const pos = charPos(block, char);
      const px = pos.x + CHAR_W / 2;
      const py = pos.y - TEXT.FONT_SIZE / 2;
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
          const opacity = getCharFadeState(char, now).opacity;
          playCharPing(py, p.height, opacity);
          char.lastTrigger = now;
          char.hitTime = now;
          addPulse(pulses, pos.x + CHAR_W / 2, pos.y, mx, my, A);
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
      const pos = charPos(block, char);
      const elapsed = now - (char.hitTime ?? -Infinity);
      const t = Math.min(elapsed / TEXT.HIT_ANIM_MS, 1);
      const scale = 1 + TEXT.HIT_SCALE * Math.sin(t * Math.PI);

      p.push();
      p.translate(pos.x + CHAR_W / 2, pos.y);
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
