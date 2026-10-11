import { COLS, ROWS } from './constants';
import type { Level } from './level';
import type { Dir } from './types';

/** Breadth-first search for the first step toward `to`, or null if unreachable. */
export function bfsStep(
  level: Level,
  from: { c: number; r: number },
  to: { c: number; r: number },
  avoidHoles: boolean,
): Dir | null {
  const key = (c: number, r: number) => r * COLS + c;
  const first = new Map<number, Dir>();
  const seen = new Set<number>([key(from.c, from.r)]);
  const queue: { c: number; r: number }[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const mv of level.moves(cur.c, cur.r, false)) {
      const k = key(mv.c, mv.r);
      if (seen.has(k) || mv.r >= ROWS) continue;
      if (avoidHoles && level.tile(mv.c, mv.r) !== 'H' && level.holeAt(mv.c, mv.r + 1)?.state === 'open') {
        continue;
      }
      seen.add(k);
      const dir = cur === from ? mv.dir : first.get(key(cur.c, cur.r))!;
      first.set(k, dir);
      if (mv.c === to.c && mv.r === to.r) return dir;
      queue.push({ c: mv.c, r: mv.r });
    }
  }
  return null;
}

export const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' };
