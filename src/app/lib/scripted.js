import { CHAR_W, PERFORMANCE, SCRIPTED_TEXT, TEXT, getFeatures } from "../config";
import { makeChar, scheduleBlockCharFade } from "./text";

export function tickScriptedText(ctx, now) {
  const arcIndex = ctx.arcMode ?? 1;
  const features = getFeatures(arcIndex);
  const arcT = (now - (ctx.arcModeStart ?? now)) / (PERFORMANCE.TIME_SCALE || 1);

  for (let i = 0; i < SCRIPTED_TEXT.length; i++) {
    if (ctx.scriptedSpawned.has(i)) continue;
    const entry = SCRIPTED_TEXT[i];
    if (entry.arcIndex !== arcIndex) continue;
    if (arcT < entry.atMs) continue;

    ctx.scriptedSpawned.add(i);

    const { p } = ctx;
    const margin = TEXT.MARGIN;
    const x = entry.x ?? p.random(margin, p.width - margin - entry.text.length * CHAR_W);
    const y = entry.y ?? p.random(margin + TEXT.FONT_SIZE * 2, p.height - margin - TEXT.FONT_SIZE);

    const block = {
      x,
      y,
      chars: entry.text.split("").map((ch, i) => makeChar(p, ch, i)),
      isScripted: true,
      bornTime: now,
    };

    if (features.autoFade) {
      scheduleBlockCharFade(block, now);
    }

    ctx.blocks.push(block);
  }
}
