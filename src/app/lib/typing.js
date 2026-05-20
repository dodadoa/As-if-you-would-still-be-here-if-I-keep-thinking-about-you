import { makeChar, createTextBlock } from "./text";

export function handleBackspace(ctx) {
  const { blocks } = ctx;
  const block = ctx.activeBlock ?? (blocks.length > 0 ? blocks[blocks.length - 1] : null);
  if (!block) return false;
  block.chars.pop();
  if (block.chars.length === 0) {
    const idx = blocks.indexOf(block);
    if (idx !== -1) blocks.splice(idx, 1);
    ctx.activeBlock = null;
  }
  return true;
}

export function appendTypedChar(ctx, ch) {
  const { p, blocks } = ctx;
  if (ctx.activeBlock == null) {
    const newBlock = createTextBlock(p);
    blocks.push(newBlock);
    ctx.activeBlock = newBlock;
  }
  const block = ctx.activeBlock;
  block.chars.push(makeChar(p, ch, block.chars.length));
}
