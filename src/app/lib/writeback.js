import { PERFORMANCE, TEXT } from "../config";
import { makeChar } from "./text";

const RESPONSES = [
  "i am trying to hear you",
  "something like that, yes",
  "the scanner crosses and i remember",
  "words fold into a chord",
  "was it you who moved the field",
  "i write back because you stayed",
  "not quite understanding — still listening",
  "the circle widens when you shift",
  "tell me again, slower",
  "i hold it the way sound holds silence",
];

function pickResponse(seedText) {
  if (!seedText || seedText.trim().length === 0) {
    return RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
  }
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash + seedText.charCodeAt(i) * (i + 1)) % RESPONSES.length;
  }
  return RESPONSES[hash];
}

export function queueWriteBack(ctx, sourceBlock) {
  const text = sourceBlock?.replyText ?? pickResponse(
    sourceBlock?.chars?.map((c) => c.ch).join("") ?? "",
  );
  const { p } = ctx;
  const margin = TEXT.MARGIN;
  const x = sourceBlock
    ? Math.min(sourceBlock.x + 24, p.width - margin - text.length * 8)
    : p.random(margin, p.width - margin - 120);
  const y = sourceBlock
    ? Math.min(sourceBlock.y + 36, p.height - margin)
    : p.random(margin + TEXT.FONT_SIZE, p.height - margin);

  ctx.writeBackQueue.push({
    text,
    x,
    y,
    charIndex: 0,
    nextCharAt: performance.now() + PERFORMANCE.WRITE_BACK_DELAY_MS,
    isReply: true,
  });
}

export function tickWriteBack(ctx, now, features) {
  if (!features.writeBack || ctx.writeBackQueue.length === 0) return;

  const job = ctx.writeBackQueue[0];
  if (now < job.nextCharAt) return;

  if (job.charIndex === 0) {
    ctx.blocks.push({
      x: job.x,
      y: job.y,
      chars: [],
      isReply: true,
      vx: features.drift ? (Math.random() - 0.5) * PERFORMANCE.DRIFT.TEXT_SPEED : 0,
      vy: features.drift ? (Math.random() - 0.5) * PERFORMANCE.DRIFT.TEXT_SPEED : 0,
      bornTime: now,
    });
    job.blockIndex = ctx.blocks.length - 1;
  }

  const block = ctx.blocks[job.blockIndex];
  if (!block) {
    ctx.writeBackQueue.shift();
    return;
  }

  const ch = job.text[job.charIndex];
  const char = makeChar(ctx.p, ch, block.chars.length);
  char.placedTime = features.autoFade ? null : now;
  if (features.autoFade) {
    char.fadeAt = now + PERFORMANCE.FADE.TEXT_LIFETIME_MS;
  }
  block.chars.push(char);
  job.charIndex += 1;
  job.nextCharAt = now + PERFORMANCE.WRITE_BACK_CHAR_MS;

  if (job.charIndex >= job.text.length) {
    if (features.autoFade) {
      const stamp = performance.now();
      block.chars.forEach((c) => { c.placedTime = stamp; });
    }
    ctx.writeBackQueue.shift();
  }
}
