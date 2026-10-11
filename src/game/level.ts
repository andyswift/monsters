import { COLS, FLOORS, ROWS } from './constants';
import type { Dir } from './types';

export type Tile = '.' | '#' | 'H';
export type Theme = 'lab' | 'house' | 'upside';

export interface LevelDef {
  number: number;
  theme: Theme;
  name: string;
  /** Ladder columns between floor i and floor i+1. */
  ladders: number[][];
  monsters: number;
  stepTime: number;
  aggression: number;
  foresight: number;
  oxygen: number;
  trapTime: number;
}

export interface Hole {
  c: number;
  /** Floor row the hole is dug into. */
  r: number;
  state: 'digging' | 'open' | 'closing';
  t: number;
  occupant: number | null;
}

export interface Move {
  dir: Dir;
  c: number;
  r: number;
}

const LAYOUTS: number[][][] = [
  [[6, 20, 34], [12, 28], [4, 22, 36], [10, 18, 30]],
  [[3, 16, 35], [9, 24, 31], [14, 27], [6, 20, 33]],
  [[10, 29], [3, 17, 36], [8, 23, 32], [13, 26]],
];
const THEMES: Theme[] = ['lab', 'house', 'upside'];
const NAMES = ['HAWKINS LAB', 'BYERS HOUSE', 'THE UPSIDE DOWN'];

export function levelDef(n: number): LevelDef {
  const i = n - 1;
  return {
    number: n,
    theme: THEMES[i % 3],
    name: NAMES[i % 3],
    ladders: LAYOUTS[(i + Math.floor(i / 3)) % LAYOUTS.length],
    monsters: Math.min(3 + i, 10),
    stepTime: Math.max(0.11, 0.25 - 0.012 * i),
    aggression: Math.min(0.92, 0.55 + 0.05 * i),
    foresight: Math.min(0.6, 0.15 + 0.04 * i),
    oxygen: Math.max(45, 80 - 4 * i),
    trapTime: Math.max(2.2, 4.2 - 0.2 * i),
  };
}

export class Level {
  tiles: Tile[][];
  holes: Hole[] = [];

  constructor(readonly def: LevelDef) {
    this.tiles = Array.from({ length: ROWS }, () => Array<Tile>(COLS).fill('.'));
    for (const f of FLOORS) this.tiles[f].fill('#');
    this.tiles[ROWS - 1].fill('#');
    def.ladders.forEach((cols, i) => {
      for (const c of cols) {
        for (let r = FLOORS[i]; r < FLOORS[i + 1]; r++) this.tiles[r][c] = 'H';
      }
    });
  }

  tile(c: number, r: number): Tile {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return '#';
    return this.tiles[r][c];
  }

  holeAt(c: number, r: number): Hole | undefined {
    return this.holes.find((h) => h.c === c && h.r === r);
  }

  /** A hole that can be fallen into or blocks the player (open or about to close). */
  openHoleAt(c: number, r: number): Hole | undefined {
    const h = this.holeAt(c, r);
    return h && h.state !== 'digging' ? h : undefined;
  }

  canEnter(c: number, r: number, player: boolean): boolean {
    const t = this.tile(c, r);
    if (t === '#') return false;
    const below = this.tile(c, r + 1);
    if (!(t === 'H' || below === '#' || below === 'H')) return false;
    if (player && t !== 'H' && this.openHoleAt(c, r + 1)) return false;
    return true;
  }

  moves(c: number, r: number, player: boolean): Move[] {
    const out: Move[] = [];
    if (this.canEnter(c - 1, r, player)) out.push({ dir: 'left', c: c - 1, r });
    if (this.canEnter(c + 1, r, player)) out.push({ dir: 'right', c: c + 1, r });
    if (this.tile(c, r) === 'H' && this.tile(c, r - 1) !== '#' && this.canEnter(c, r - 1, player)) {
      out.push({ dir: 'up', c, r: r - 1 });
    }
    if (this.tile(c, r + 1) === 'H' && this.canEnter(c, r + 1, player)) {
      out.push({ dir: 'down', c, r: r + 1 });
    }
    return out;
  }

  /** Standing row of the next floor down from a hole in floor row `r`. */
  landingRow(c: number, r: number): number {
    let rr = r + 1;
    while (this.tile(c, rr + 1) !== '#' && rr < ROWS - 2) rr++;
    return rr;
  }
}
