import { TEXT } from "../config";

export function makePlaceholderScene(id) {
  return {
    id,
    onEnter(ctx) {
      ctx.showInfo = false;
    },
    draw(ctx) {
      const { p } = ctx;
      p.background(255);
      p.fill(0);
      p.textAlign(p.LEFT, p.TOP);
      p.textSize(14);
      p.textFont(TEXT.FONT_FAMILY);
      p.text(`scene ${id}`, 24, 24);
    },
    keyPressed() {
      return true;
    },
    mouseClicked() {},
  };
}
