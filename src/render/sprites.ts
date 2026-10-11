export type Sprite = HTMLCanvasElement;

export function makeSprite(rows: string[], pal: Record<string, string>, flip = false): Sprite {
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  });
  return c;
}

const KID_PAL = {
  h: '#6b4423', s: '#f2c9a0', e: '#161616', j: '#d62839', l: '#fff3a3', p: '#2d4a8a',
};
const KID_A = [
  '..hhhh..',
  '.hhhhhh.',
  '.hhssse.',
  '..sssss.',
  '..jjjj..',
  '.jjjjjjl',
  '..pppp..',
  '..p..p..',
];
const KID_B = [...KID_A.slice(0, 7), '...pp...'];
const KID_C = [...KID_A.slice(0, 7), '..p.p...'];

const DOG_PAL = { m: '#8c1236', d: '#3d0716', p: '#ff5c8a', t: '#ffffff', y: '#ffd23f' };
const DOG_TOP = ['......p.', '.....ppp', '.mm.ppty', 'mmmmmppp', 'mmmmmmm.', '.mmmmmm.'];
const DOG_A = [...DOG_TOP, '.d.d.d.d', '.d.d.d.d'];
const DOG_B = [...DOG_TOP, 'd.d.d.d.', 'd.d.d.d.'];

const HEART = [
  '.rr.rr.',
  'rrrrrrr',
  'rrrrrrr',
  '.rrrrr.',
  '..rrr..',
  '...r...',
];

export interface SpriteSet {
  kid: Sprite[][]; // [facing: 0 left, 1 right][frame]
  dog: Sprite[][];
  dogHurt: Sprite[][];
  heart: Sprite;
}

export function buildSprites(): SpriteSet {
  const both = (frames: string[][], pal: Record<string, string>) =>
    [false, true].map((right) => frames.map((f) => makeSprite(f, pal, !right)));
  const hurtPal = { ...DOG_PAL, m: '#d94b6f', d: '#7b1030' };
  return {
    kid: both([KID_A, KID_B, KID_C], KID_PAL),
    dog: both([DOG_A, DOG_B], DOG_PAL),
    dogHurt: both([DOG_A, DOG_B], hurtPal),
    heart: makeSprite(HEART, { r: '#ff3b5c' }),
  };
}
