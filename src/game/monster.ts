import type { Hole } from './level';
import type { Dir } from './types';

export type MonsterState = 'walk' | 'trapped' | 'falling';

export class Monster {
  c: number;
  r: number;
  pc: number;
  pr: number;
  t = 1;
  state: MonsterState = 'walk';
  /** Harmless and frozen while > 0 (spawn grace, just escaped). */
  stunT = 0;
  trapT = 0;
  face: 1 | -1 = 1;
  anim = 0;
  lastDir: Dir | null = null;
  hole: Hole | null = null;
  fy = 0;
  landR = 0;
  /** Set when a step finishes and the arrival checks haven't run yet. */
  arriving = false;

  constructor(
    readonly id: number,
    c: number,
    r: number,
    public stepTime: number,
  ) {
    this.c = this.pc = c;
    this.r = this.pr = r;
  }

  get x(): number {
    return this.pc + (this.c - this.pc) * this.t;
  }
  get y(): number {
    if (this.state === 'falling') return this.fy;
    return this.pr + (this.r - this.pr) * this.t;
  }
}
