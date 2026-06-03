import { CHAR_W, CIRCLES, PERFORMANCE, RADAR, SCENE1, SYMBOLS, TEXT, UI, getFeatures } from "../config";
import { makeAgentCircle } from "../lib/agent";
import { makeCircle } from "../lib/radar";
import {
  drawPerformanceFrame,
  driftBlocks,
  spawnPerformanceSymbol,
  updatePerformanceCircles,
  updatePerformanceSymbols,
} from "../lib/performanceRender";
import { makeChar, updateBlockCollisions, processDissolvingBlocks, processBlocks, scheduleBlockCharFade } from "../lib/text";
import { appendTypedChar, handleBackspace } from "../lib/typing";
import { queueWriteBack, tickWriteBack } from "../lib/writeback";
import { tickScriptedText } from "../lib/scripted";
import { updateDroneFromCursor } from "../lib/audio";

const INTRO_PHRASE = "As if you would still be here, if I keep thinking about you";

function spawnIntroText(ctx) {
  const { p } = ctx;
  const words = INTRO_PHRASE.split(" ");
  const n = words.length;
  const margin = TEXT.MARGIN;
  const slotW = (p.width - margin * 2) / n;

  words.forEach((word, i) => {
    const wordW = word.length * CHAR_W;
    const slotCenter = margin + i * slotW + slotW / 2;
    const x = Math.max(margin, Math.min(p.width - margin - wordW, slotCenter - wordW / 2));
    const y = margin + TEXT.FONT_SIZE + Math.random() * (p.height - margin * 2 - TEXT.FONT_SIZE * 2);
    ctx.blocks.push({
      x,
      y,
      chars: word.split("").map((ch, i) => makeChar(p, ch, i)),
    });
  });
}

export function setupPerformance(ctx) {
  if (!ctx.circles?.length) {
    ctx.circles = Array.from({ length: CIRCLES.COUNT }, () => makeCircle(ctx.p));
  }
  ctx.agents = ctx.agents ?? [];
  ctx.writeBackQueue = ctx.writeBackQueue ?? [];
  if ((ctx.arcMode ?? 0) === 0 && ctx.blocks.length === 0) spawnIntroText(ctx);
  const title = getFeatures(ctx.arcMode ?? 0).caption;
  if (title && !ctx.sceneTitleText) {
    ctx.sceneTitleText = title;
    ctx.sceneTitleShownAt = performance.now();
  }
}

export function drawPerformance(ctx, now) {
  const { p } = ctx;
  const features = getFeatures(ctx.arcMode ?? 1);

  if (features.spin) {
    if (ctx.spinning) ctx.spinSpeed = Math.min(ctx.spinSpeed + RADAR.ACCEL, RADAR.TARGET_SPEED);
    else ctx.spinSpeed = Math.max(ctx.spinSpeed - RADAR.DECEL, 0);
    ctx.angle += ctx.spinSpeed;
  }

  if (features.symbols && now - ctx.lastSymbolTime > SYMBOLS.SYMBOL_INTERVAL_PERFORMANCE_MS) {
    spawnPerformanceSymbol(p, ctx.symbols);
    ctx.lastSymbolTime = now;
  }

ctx.smoothX = p.lerp(ctx.smoothX, p.mouseX, UI.MOUSE_LERP);
  ctx.smoothY = p.lerp(ctx.smoothY, p.mouseY, UI.MOUSE_LERP);
  updateDroneFromCursor(ctx.smoothX, ctx.smoothY, p.width, p.height);

  if (ctx.pendingArcMode != null) {
    const prevArcMode = ctx.arcMode;
    const prevFeatures = getFeatures(ctx.arcMode);
    ctx.arcMode = ctx.pendingArcMode;
    ctx.arcModeStart = performance.now();
    ctx.scriptedSpawned = new Set();
    ctx.writeBackQueue = [];
    ctx.captionText = "";
    ctx.captionShownAt = 0;
    ctx.pendingArcMode = null;

    ctx.agents = [];

    const newTitle = getFeatures(ctx.arcMode).caption;
    if (newTitle) {
      ctx.sceneTitleText = newTitle;
      ctx.sceneTitleShownAt = performance.now();
    } else {
      ctx.sceneTitleText = "";
    }

    if (ctx.arcMode === 0) spawnIntroText(ctx);

    const newFeatures = getFeatures(ctx.arcMode);
    if (!prevFeatures.autoFade && newFeatures.autoFade) {
      const t = performance.now();
      const delay = PERFORMANCE.SCENE_FADE_DELAY_MS;
      ctx.circles.forEach((c) => {
        c.bornTime = t - Math.random() * Math.max(0, PERFORMANCE.FADE.CIRCLE_LIFETIME_MS - delay);
      });
      ctx.symbols.forEach((s) => {
        s.bornTime = t - Math.random() * Math.max(0, PERFORMANCE.FADE.SYMBOL_LIFETIME_MS - delay);
      });
      ctx.blocks.forEach((b) => {
        if (b.autoFadeAt == null) {
          b.autoFadeAt = t + delay + Math.random() * SCENE1.BLOCK_STAGGER_MS;
        }
      });
    }

    if (prevArcMode === 0 && ctx.arcMode === 1) {
      const t = performance.now();
      ctx.blocks.forEach((b) => { b.autoFadeAt = t + 5000; });
      ctx.dissolveBlocks = ctx.blocks;
      ctx.blocks = [];
    }
  }

  p.background(255);

  updatePerformanceCircles(p, ctx, ctx.angle, ctx.smoothX, ctx.smoothY, features, now);
  updatePerformanceSymbols(p, ctx, ctx.angle, ctx.smoothX, ctx.smoothY, features, now);
  driftBlocks(ctx, features);

  tickScriptedText(ctx, now);
  tickWriteBack(ctx, now, features);

  if (ctx.dissolveBlocks?.length) {
    if (features.scanner) {
      updateBlockCollisions(p, ctx.dissolveBlocks, ctx.angle, ctx.smoothX, ctx.smoothY, ctx.linePulses);
    }
    processDissolvingBlocks(p, ctx.dissolveBlocks, null, now);
  }

  if (features.autoFade) {
    if (features.scanner && ctx.blocks.length > 0) {
      updateBlockCollisions(p, ctx.blocks, ctx.angle, ctx.smoothX, ctx.smoothY, ctx.linePulses);
    }
    processDissolvingBlocks(p, ctx.blocks, ctx.activeBlock, now);
  } else if (features.typing && ctx.blocks.length > 0) {
    processBlocks(p, ctx.blocks, ctx.activeBlock, ctx.angle, ctx.smoothX, ctx.smoothY, ctx.linePulses);
  }

  drawPerformanceFrame(ctx, now, features);
}

export function keyPressedPerformance(ctx, p) {
  const now = performance.now();
  const features = getFeatures(ctx.arcMode ?? 1);

  if (p.keyCode === 16 && features.shockwave) {
    ctx.shockwaves.push({ id: ctx.nextShockwaveId++, birthTime: now });
    return true;
  }

  if ((p.key === "k" || p.key === "K") && ctx.mode !== "typing") {
    spawnIntroText(ctx);
    return true;
  }

  if (!features.typing) return true;

  if (p.key === "i" && ctx.arcMode >= 2 && ctx.mode !== "typing") {
    ctx.agents.push(makeAgentCircle(ctx.p));
    return true;
  }

  if (p.key === "Enter") {
    if (ctx.mode === "typing") {
      const block = ctx.activeBlock;
      if (block) {
        scheduleBlockCharFade(block, performance.now());
        if (features.writeBack && !block.isReply) {
          queueWriteBack(ctx, block);
        }
      }
      ctx.activeBlock = null;
      ctx.mode = "default";
    } else {
      ctx.mode = "typing";
      ctx.activeBlock = null;
    }
    return true;
  }

  if (p.key === "Backspace") {
    handleBackspace(ctx);
    return true;
  }

  if (ctx.mode !== "typing" || p.key.length !== 1) return true;

  appendTypedChar(ctx, p.key);

  if (features.autoFade && ctx.activeBlock != null) {
    const block = ctx.activeBlock;
    if (block.autoFadeAt == null) {
      block.autoFadeAt = performance.now() + 5000 + Math.random() * 5000;
    }
  }

  return true;
}

export function mouseClickedPerformance(ctx) {
  ctx.spinning = !ctx.spinning;
}
