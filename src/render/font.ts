/** 3x5 pixel font. Each glyph is 5 rows of 3 bits (bit 2 = left column). */
const GLYPHS: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 7, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [6, 1, 2, 4, 7], '3': [6, 1, 2, 1, 6],
  '4': [5, 5, 7, 1, 1], '5': [7, 4, 6, 1, 6], '6': [3, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2],
  '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 6],
  ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0], '!': [2, 2, 2, 0, 2], '.': [0, 0, 0, 0, 2],
  '?': [6, 1, 2, 0, 2], '/': [1, 1, 2, 4, 4], ',': [0, 0, 0, 2, 4], "'": [2, 2, 0, 0, 0],
  '+': [0, 2, 7, 2, 0], ' ': [0, 0, 0, 0, 0],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

export function textWidth(text: string, scale = 1): number {
  return Math.max(0, text.length * (GLYPH_W + 1) - 1) * scale;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (g[row] & (4 >> col)) ctx.fillRect(cx + col * scale, Math.round(y) + row * scale, scale, scale);
      }
    }
    cx += (GLYPH_W + 1) * scale;
  }
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string,
  scale = 1,
): void {
  drawText(ctx, text, cx - textWidth(text, scale) / 2, y, color, scale);
}

/** Bulb grid for a glyph, for drawing words in Christmas lights. */
export function glyphBits(ch: string): number[] {
  return GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'];
}
