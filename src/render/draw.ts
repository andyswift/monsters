import {
  CLOSE_TIME,
  COLS,
  DIG_TIME,
  FLOORS,
  HEIGHT,
  HUD_TOP,
  ROWS,
  TILE,
  WIDTH,
} from '../game/constants';
import type { Game } from '../game/game';
import type { Hole, Theme } from '../game/level';
import type { Monster } from '../game/monster';
import { drawText, drawTextCentered, glyphBits, textWidth } from './font';
import { buildSprites, type SpriteSet } from './sprites';

interface Palette {
  bg: string;
  wall: string;
  brick: string;
  hi: string;
  lo: string;
  ladder: string;
  glow: string;
  flavor: string;
}

const PALETTES: Record<Theme, Palette> = {
  lab: {
    bg: '#06151a', wall: '#0c2830', brick: '#2f6a75', hi: '#58a6b3', lo: '#17383f',
    ladder: '#a9c4c9', glow: '#9fe3ea', flavor: 'THE GATE HAS OPENED. THEY ARE COMING.',
  },
  house: {
    bg: '#1b0f07', wall: '#2c190c', brick: '#8a5a2b', hi: '#b88150', lo: '#4a2d15',
    ladder: '#e8c880', glow: '#ffcf6b', flavor: 'THE LIGHTS ARE FLICKERING. RUN.',
  },
  upside: {
    bg: '#12030a', wall: '#1d0513', brick: '#7a1a38', hi: '#b02f58', lo: '#3b0a1b',
    ladder: '#6f9bff', glow: '#ff2d55', flavor: 'WELCOME TO THE UPSIDE DOWN.',
  },
};

const BULBS = ['#ff3b3b', '#3bd16f', '#3b8bff', '#ffd23b', '#ff7ae0'];
const RED = '#ff2d4d';

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export class Renderer {
  private sprites: SpriteSet = buildSprites();
  private layer: { key: number; canvas: HTMLCanvasElement } | null = null;

  constructor(private ctx: CanvasRenderingContext2D) {}

  // ---------- static layer ----------

  private staticLayer(g: Game): HTMLCanvasElement {
    if (this.layer?.key === g.levelNo) return this.layer.canvas;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = ROWS * TILE;
    const c = canvas.getContext('2d')!;
    const pal = PALETTES[g.level.def.theme];
    c.fillStyle = pal.bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    this.paintWall(c, g.level.def.theme, pal);

    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const t = g.level.tiles[r][col];
        const x = col * TILE;
        const y = r * TILE;
        if (t === '#') {
          const deep = r === ROWS - 1;
          c.fillStyle = deep ? pal.lo : pal.brick;
          c.fillRect(x, y, TILE, TILE);
          if (!deep) {
            c.fillStyle = pal.hi;
            c.fillRect(x, y, TILE, 1);
            c.fillStyle = pal.lo;
            c.fillRect(x, y + TILE - 1, TILE, 1);
            c.fillRect(x + (col % 2 ? 7 : 3), y + 1, 1, 6);
          }
        } else if (t === 'H') {
          c.fillStyle = pal.ladder;
          c.fillRect(x + 1, y, 1, TILE);
          c.fillRect(x + 6, y, 1, TILE);
          c.fillRect(x + 2, y + 1, 4, 1);
          c.fillRect(x + 2, y + 5, 4, 1);
        }
      }
    }
    this.layer = { key: g.levelNo, canvas };
    return canvas;
  }

  private paintWall(c: CanvasRenderingContext2D, theme: Theme, pal: Palette): void {
    c.fillStyle = pal.wall;
    if (theme === 'lab') {
      for (let x = 0; x < WIDTH; x += 16) c.fillRect(x, 0, 1, ROWS * TILE);
      for (const f of FLOORS) c.fillRect(0, (f + 2) * TILE, WIDTH, 2);
    } else if (theme === 'house') {
      for (let x = 0; x < WIDTH; x += 8) c.fillRect(x, 0, 4, ROWS * TILE);
    } else {
      const rnd = seeded(42);
      c.fillStyle = '#2a0612';
      for (const f of FLOORS.slice(0, 4)) {
        for (let i = 0; i < 22; i++) {
          const x = Math.floor(rnd() * WIDTH);
          const len = 6 + Math.floor(rnd() * 22);
          c.fillRect(x, (f + 1) * TILE, 1, len);
          if (rnd() < 0.5) c.fillRect(x + 1, (f + 1) * TILE + len - 3, 1, 3);
        }
      }
    }
  }

  // ---------- gameplay ----------

  drawGame(g: Game, time: number, hiScore: number, paused: boolean): void {
    const ctx = this.ctx;
    const pal = PALETTES[g.level.def.theme];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(0, HUD_TOP);
    ctx.drawImage(this.staticLayer(g), 0, 0);
    this.drawAmbient(g.level.def.theme, time, pal);

    for (const h of g.level.holes) this.drawHole(h, time, pal);
    for (const m of g.monsters) if (m.state === 'trapped') this.drawMonster(m, time);
    for (const m of g.monsters) if (m.state === 'walk') this.drawMonster(m, time);
    for (const m of g.monsters) if (m.state === 'falling') this.drawMonster(m, time);
    this.drawPlayer(g, time);

    for (const p of g.particles) {
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const p of g.popups) drawText(ctx, p.text, p.x, p.y, '#ffe66d');
    ctx.restore();

    this.drawHud(g, hiScore, time);
    this.drawOverlay(g, time);
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      drawTextCentered(ctx, 'PAUSED', WIDTH / 2, 110, '#ffffff', 4);
      drawTextCentered(ctx, 'PRESS P TO RESUME', WIDTH / 2, 140, '#9aa', 1);
    }
  }

  private drawAmbient(theme: Theme, time: number, pal: Palette): void {
    const ctx = this.ctx;
    if (theme === 'lab') {
      for (const f of FLOORS.slice(0, 4)) {
        for (let col = 5; col < COLS; col += 10) {
          const flicker = Math.sin(time * 9 + col * 3 + f) > 0.92 ? 0.25 : 1;
          const x = col * TILE - 3;
          const y = (f + 1) * TILE;
          ctx.globalAlpha = 0.15 * flicker;
          ctx.fillStyle = pal.glow;
          ctx.fillRect(x - 4, y, 14, 6);
          ctx.globalAlpha = flicker;
          ctx.fillRect(x, y, 6, 1);
        }
      }
      ctx.globalAlpha = 1;
    } else if (theme === 'house') {
      for (const f of FLOORS.slice(0, 4)) {
        const base = (f + 1) * TILE + 2;
        ctx.fillStyle = '#3a2a1a';
        for (let x = 0; x < WIDTH; x += 2) ctx.fillRect(x, base + Math.round(1.5 * Math.sin(x / 26)), 1, 1);
        for (let i = 0; i < 27; i++) {
          const x = 6 + i * 12;
          const y = base + Math.round(1.5 * Math.sin(x / 26)) + 1;
          const color = BULBS[(i + Math.floor(time * 2.5) + f) % BULBS.length];
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = color;
          ctx.fillRect(x - 2, y - 1, 5, 5);
          ctx.globalAlpha = 1;
          ctx.fillRect(x - 1, y, 3, 3);
        }
      }
      this.drawLightWord('RUN', 160, (FLOORS[1] + 1) * TILE + 6, time);
    } else {
      for (let i = 0; i < 45; i++) {
        const x = (i * 83 + time * (3 + (i % 5))) % WIDTH;
        const y = (((i * 47 - time * (5 + (i % 7))) % 200) + 200) % 200;
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 2 + i);
        ctx.fillStyle = i % 4 === 0 ? '#ffd9a0' : '#ff9ab0';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      ctx.globalAlpha = 1;
      if (Math.sin(time * 1.1) * Math.sin(time * 0.37 + 1) > 0.9) {
        ctx.fillStyle = 'rgba(255,40,70,0.1)';
        ctx.fillRect(0, 0, WIDTH, ROWS * TILE);
      }
    }
  }

  private drawLightWord(word: string, cx: number, y: number, time: number): void {
    const ctx = this.ctx;
    const step = 5;
    const letterW = 2 * step + 3;
    const gap = 7;
    const total = word.length * letterW + (word.length - 1) * gap;
    let x0 = cx - total / 2;
    const lit = Math.floor(time * 1.4) % (word.length + 1);
    [...word].forEach((ch, li) => {
      const bits = glyphBits(ch);
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (!(bits[row] & (4 >> col))) continue;
          const bx = x0 + col * step;
          const by = y + row * step;
          ctx.fillStyle = BULBS[(li * 2 + col) % BULBS.length];
          ctx.globalAlpha = lit === li ? 1 : 0.28;
          ctx.fillRect(bx, by, 3, 3);
        }
      }
      x0 += letterW + gap;
    });
    ctx.globalAlpha = 1;
  }

  private drawHole(h: Hole, time: number, pal: Palette): void {
    const ctx = this.ctx;
    const x = h.c * TILE;
    const y = h.r * TILE;
    let w = 0;
    if (h.state === 'digging') w = Math.round(TILE * Math.min(1, h.t / DIG_TIME));
    else if (h.state === 'open') w = TILE;
    else if (h.occupant !== null) w = TILE;
    else {
      const left = 1 - h.t / CLOSE_TIME;
      w = Math.max(0, Math.round(TILE * left));
      if (Math.floor(time * 10) % 2 === 0 && left > 0.3) w = TILE;
    }
    if (w <= 0) return;
    const ox = x + Math.floor((TILE - w) / 2);
    ctx.fillStyle = '#020104';
    ctx.fillRect(ox, y, w, TILE);
    ctx.fillStyle = pal.lo;
    ctx.fillRect(ox, y, w, 1);
  }

  private drawMonster(m: Monster, time: number): void {
    const ctx = this.ctx;
    if (m.state === 'walk' && m.stunT > 0 && Math.floor(time * 14) % 2 === 0) return;
    const face = m.face === 1 ? 1 : 0;
    let set = this.sprites.dog;
    let jx = 0;
    if (m.state === 'trapped') {
      const danger = m.trapT < 1.2 && Math.floor(time * 10) % 2 === 0;
      set = danger ? this.sprites.dog : this.sprites.dogHurt;
      jx = Math.floor(time * 20) % 2 === 0 ? -1 : 0;
    }
    const frame = m.state === 'walk' && m.t < 1 ? m.anim % 2 : Math.floor(time * 4) % 2;
    ctx.drawImage(set[face][frame], Math.round(m.x * TILE) + jx, Math.round(m.y * TILE));
    if (m.state === 'falling') {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(set[face][frame], Math.round(m.x * TILE), Math.round(m.y * TILE) - 6);
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(g: Game, time: number): void {
    const ctx = this.ctx;
    const p = g.player;
    const px = Math.round(p.x * TILE);
    const py = Math.round(p.y * TILE);

    if (g.phase === 'dying') {
      if (g.phaseT > 0.4) return;
      if (Math.floor(time * 20) % 2 === 0) return;
    }

    // flashlight glow
    const glow = ctx.createRadialGradient(px + 4, py + 4, 2, px + 4, py + 4, 46);
    const strength = g.level.def.theme === 'lab' ? 0.1 : 0.22;
    glow.addColorStop(0, `rgba(255,236,170,${strength})`);
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(px - 42, py - 42, 92, 92);
    ctx.restore();

    const moving = p.t < 1;
    const frame = moving ? 1 + (p.anim % 2) : 0;
    ctx.drawImage(this.sprites.kid[p.facing === 1 ? 1 : 0][frame], px, py);
    if (p.busy > 0) {
      ctx.fillStyle = '#ffe66d';
      const dx = px + (p.facing === 1 ? 9 : -2);
      ctx.fillRect(dx, py + 6 + (Math.floor(time * 30) % 2), 1, 1);
    }
  }

  // ---------- HUD & overlays ----------

  private drawHud(g: Game, hi: number, time: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HUD_TOP);
    ctx.fillRect(0, HUD_TOP + ROWS * TILE, WIDTH, HEIGHT - HUD_TOP - ROWS * TILE);

    const pad = (n: number) => String(n).padStart(6, '0');
    drawText(ctx, `SCORE ${pad(g.score)}`, 6, 3, '#ffffff', 2);
    drawTextCentered(ctx, `HI ${pad(hi)}`, WIDTH / 2 + 10, 3, '#ff7a90', 2);
    const lvl = `LEVEL ${g.levelNo}`;
    drawText(ctx, lvl, WIDTH - 6 - textWidth(lvl, 2), 3, '#ffe66d', 2);

    drawText(ctx, 'AIR', 6, 15, '#9ad7ff', 2);
    const frac = Math.max(0, g.oxygen / g.level.def.oxygen);
    const barX = 32;
    const barW = 180;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, 14, barW, 7);
    const low = g.oxygen < 10;
    ctx.fillStyle = low ? (Math.floor(time * 6) % 2 ? '#ff3b3b' : '#7a1a1a') : frac < 0.4 ? '#ffd23b' : '#3bd16f';
    ctx.fillRect(barX, 14, Math.round(barW * frac), 7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(barX - 1, 13, barW + 2, 1);
    ctx.fillRect(barX - 1, 21, barW + 2, 1);

    for (let i = 0; i < g.lives; i++) ctx.drawImage(this.sprites.heart, WIDTH - 12 - i * 9, 14);

    const footY = HUD_TOP + ROWS * TILE + 3;
    drawTextCentered(ctx, g.level.def.name, WIDTH / 2, footY, PALETTES[g.level.def.theme].glow, 2);
    drawTextCentered(ctx, 'ARROWS OR WASD MOVE  SPACE DIG OR WHACK  M MUTE  P PAUSE', WIDTH / 2, footY + 13, '#667', 1);
  }

  private drawOverlay(g: Game, time: number): void {
    const ctx = this.ctx;
    const cx = WIDTH / 2;
    const pal = PALETTES[g.level.def.theme];
    if (g.phase === 'intro') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 70, WIDTH, 100);
      this.glowText(`LEVEL ${g.levelNo}`, cx, 80, pal.glow, 4, time);
      drawTextCentered(ctx, g.level.def.name, cx, 108, '#ffffff', 2);
      drawTextCentered(ctx, pal.flavor, cx, 126, '#9aa', 1);
      if (g.levelNo === 1) {
        drawTextCentered(ctx, 'DIG HOLES. TRAP THE DEMODOGS. WHACK THEM THROUGH.', cx, 142, '#ffe66d', 1);
        drawTextCentered(ctx, 'STAND NEXT TO A TRAPPED ONE AND PRESS SPACE.', cx, 152, '#ffe66d', 1);
      }
    } else if (g.phase === 'clear') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 80, WIDTH, 80);
      this.glowText('ALL CLEAR!', cx, 90, '#7cffb2', 4, time);
      drawTextCentered(ctx, 'THE HOLES ARE CLOSING...', cx, 124, '#ffffff', 1);
    } else if (g.phase === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 70, WIDTH, 110);
      this.glowText('GAME OVER', cx, 82, RED, 5, time);
      drawTextCentered(ctx, `FINAL SCORE ${g.score}`, cx, 122, '#ffffff', 2);
      if (Math.floor(time * 2) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER', cx, 150, '#ffe66d', 2);
    }
  }

  private glowText(text: string, cx: number, y: number, color: string, scale: number, time: number): void {
    const ctx = this.ctx;
    const flicker = Math.sin(time * 23) * Math.sin(time * 7) > 0.85 ? 0.6 : 1;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    drawTextCentered(ctx, text, cx, y, color, scale);
    ctx.shadowBlur = 0;
    drawTextCentered(ctx, text, cx, y, color, scale);
    ctx.restore();
  }

  // ---------- title ----------

  drawTitle(time: number, hi: number): void {
    const ctx = this.ctx;
    const cx = WIDTH / 2;
    ctx.fillStyle = '#07020a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // drifting spores
    for (let i = 0; i < 60; i++) {
      const x = (i * 59 + time * (4 + (i % 6))) % WIDTH;
      const y = (((i * 37 - time * (6 + (i % 5))) % HEIGHT) + HEIGHT) % HEIGHT;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 2 + i);
      ctx.fillStyle = i % 3 === 0 ? '#ffd9a0' : '#ff5c8a';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;

    // string of lights
    for (let i = 0; i < 27; i++) {
      const x = 6 + i * 12;
      const y = 8 + Math.round(3 * Math.sin(i * 0.9));
      ctx.fillStyle = BULBS[(i + Math.floor(time * 2.5)) % BULBS.length];
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x - 2, y - 1, 6, 6);
      ctx.globalAlpha = 1;
      ctx.fillRect(x - 1, y, 3, 3);
    }

    this.glowText('STRANGER', cx, 44, RED, 6, time);
    this.glowText('MONSTERS', cx, 84, RED, 7, time + 3);
    drawTextCentered(ctx, 'A HOMAGE TO THE 1983 BBC MICRO CLASSIC', cx, 132, '#9aa', 1);

    // chase parade
    const span = WIDTH + 80;
    const dogX = (time * 40) % span - 40;
    const frame = Math.floor(time * 6) % 2;
    ctx.drawImage(this.sprites.dog[1][frame], Math.round(dogX), 160);
    ctx.drawImage(this.sprites.kid[1][1 + (Math.floor(time * 6) % 2)], Math.round(dogX - 22), 160);
    ctx.fillStyle = '#7a1a38';
    ctx.fillRect(0, 168, WIDTH, 8);
    ctx.fillStyle = '#b02f58';
    ctx.fillRect(0, 168, WIDTH, 1);

    if (Math.floor(time * 2) % 2 === 0) drawTextCentered(ctx, 'PRESS ENTER TO START', cx, 190, '#ffe66d', 2);
    drawTextCentered(ctx, 'ARROWS OR WASD MOVE   SPACE DIG OR WHACK', cx, 214, '#667', 1);
    drawTextCentered(ctx, `HI SCORE ${String(hi).padStart(6, '0')}`, cx, 232, '#ff7a90', 1);
  }
}
