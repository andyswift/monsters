import { PLAYER_START } from './constants';

export class Player {
  c = PLAYER_START.c;
  r = PLAYER_START.r;
  pc = PLAYER_START.c;
  pr = PLAYER_START.r;
  /** Progress of the current step, 0..1. */
  t = 1;
  facing: 1 | -1 = 1;
  busy = 0;
  anim = 0;

  get x(): number {
    return this.pc + (this.c - this.pc) * this.t;
  }
  get y(): number {
    return this.pr + (this.r - this.pr) * this.t;
  }
}
