import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { Monster } from '../src/game/monster';
import { bfsStep } from '../src/game/ai';
import { FLOORS } from '../src/game/constants';
import type { Input } from '../src/game/types';

const idle: Input = { held: [], action: false };
const act: Input = { held: [], action: true };

function run(g: Game, seconds: number, input: Input = idle): void {
  for (let t = 0; t < seconds; t += 1 / 60) g.update(1 / 60, input);
}

/** A started game with a single frozen monster removed so tests control the scene. */
function started(): Game {
  const g = new Game(7);
  run(g, 3); // through intro
  // A frozen sentinel far away keeps the level from counting as cleared.
  const sentinel = new Monster(1000, 39, 3, 0.2);
  sentinel.stunT = 1e9;
  g.monsters = [sentinel];
  return g;
}

function addMonster(g: Game, c: number, r: number, id = 99): Monster {
  const m = new Monster(id, c, r, 0.2);
  g.monsters.push(m);
  return m;
}

describe('player', () => {
  it('walks right along the floor', () => {
    const g = started();
    const c0 = g.player.c;
    run(g, 0.5, { held: ['right'], action: false });
    expect(g.player.c).toBeGreaterThan(c0);
    expect(g.player.r).toBe(23);
  });

  it('cannot walk off a ledge or into the side wall', () => {
    const g = started();
    run(g, 2, { held: ['left'], action: false });
    expect(g.player.c).toBe(0);
  });

  it('climbs a ladder', () => {
    const g = started();
    const col = g.level.def.ladders[3][0];
    g.player.c = g.player.pc = col;
    run(g, 0.3, { held: ['up'], action: false });
    expect(g.player.r).toBeLessThan(23);
  });

  it('digs a hole in the floor ahead, which later closes', () => {
    const g = started();
    g.player.c = g.player.pc = 7;
    g.player.r = g.player.pr = FLOORS[3] - 1;
    g.player.facing = 1;
    run(g, 0.05, act);
    run(g, 0.5);
    const hole = g.level.holeAt(8, FLOORS[3]);
    expect(hole?.state).toBe('open');
    run(g, 10);
    expect(g.level.holeAt(8, FLOORS[3])).toBeUndefined();
  });

  it('cannot dig on the bottom floor', () => {
    const g = started();
    run(g, 0.05, act);
    run(g, 0.5);
    expect(g.level.holes).toHaveLength(0);
  });

  it('cannot walk into an open hole', () => {
    const g = started();
    const r = FLOORS[3] - 1;
    g.player.c = g.player.pc = 7;
    g.player.r = g.player.pr = r;
    g.level.holes.push({ c: 8, r: FLOORS[3], state: 'open', t: 0, occupant: null });
    run(g, 0.5, { held: ['right'], action: false });
    expect(g.player.c).toBe(7);
  });
});

describe('monsters and holes', () => {
  function trapScene(): { g: Game; m: Monster } {
    const g = started();
    const r = FLOORS[3] - 1;
    g.player.c = g.player.pc = 7;
    g.player.r = g.player.pr = r;
    g.player.facing = 1;
    g.level.holes.push({ c: 8, r: FLOORS[3], state: 'open', t: 0, occupant: null });
    const m = addMonster(g, 9, r);
    m.stunT = 99; // keep it from moving; we move it by hand
    return { g, m };
  }

  it('traps a monster that walks into an open hole', () => {
    const { g, m } = trapScene();
    m.stunT = 0;
    m.c = 8;
    m.pc = 9;
    m.t = 0;
    m.arriving = true;
    run(g, 0.5);
    expect(m.state).toBe('trapped');
    expect(g.level.holeAt(8, FLOORS[3])?.occupant).toBe(99);
  });

  it('a monster standing over a hole when it opens falls in', () => {
    const g = started();
    const r = FLOORS[3] - 1;
    g.player.c = g.player.pc = 7;
    g.player.r = g.player.pr = r;
    const m = addMonster(g, 8, r);
    m.stunT = 99;
    g.player.facing = 1;
    run(g, 0.05, act);
    run(g, 0.5);
    expect(m.state).toBe('trapped');
  });

  it('whacking a trapped monster drops it to the floor below and scores', () => {
    const { g, m } = trapScene();
    g.level.holes[0].occupant = m.id;
    m.state = 'trapped';
    m.hole = g.level.holes[0];
    m.c = 8;
    m.r = FLOORS[3];
    m.trapT = 99;
    const before = g.score;
    run(g, 0.05, act);
    expect(m.state).toBe('falling');
    run(g, 1);
    expect(g.monsters).not.toContain(m);
    expect(g.score).toBeGreaterThan(before);
  });

  it('a falling monster crushes a monster on the floor below', () => {
    const { g, m } = trapScene();
    const below = addMonster(g, 8, FLOORS[4] - 1, 100);
    below.stunT = 99;
    g.level.holes[0].occupant = m.id;
    m.state = 'trapped';
    m.hole = g.level.holes[0];
    m.c = 8;
    m.r = FLOORS[3];
    m.trapT = 99;
    run(g, 0.05, act);
    run(g, 1);
    expect(g.monsters).not.toContain(below);
    expect(g.score).toBeGreaterThanOrEqual(400);
  });

  it('a trapped monster escapes after the trap time', () => {
    const { g, m } = trapScene();
    g.level.holes[0].occupant = m.id;
    m.state = 'trapped';
    m.hole = g.level.holes[0];
    m.c = 8;
    m.r = FLOORS[3];
    m.trapT = 0.2;
    run(g, 0.5);
    expect(m.state).toBe('walk');
    expect(m.r).toBe(FLOORS[3] - 1);
  });

  it('kills the player on contact and ends the game when out of lives', () => {
    const g = started();
    const m = addMonster(g, g.player.c, g.player.r);
    m.stunT = 0;
    g.lives = 1;
    run(g, 0.1);
    expect(g.lives).toBe(0);
    run(g, 2);
    expect(g.phase).toBe('over');
  });
});

describe('level flow', () => {
  it('clearing all monsters awards an oxygen bonus and advances', () => {
    const g = started();
    g.monsters = [];
    run(g, 0.1);
    expect(g.phase).toBe('clear');
    expect(g.score).toBeGreaterThan(0);
    run(g, 4);
    expect(g.levelNo).toBe(2);
    expect(g.level.def.theme).toBe('house');
  });

  it('running out of oxygen costs a life', () => {
    const g = started();
    g.oxygen = 0.1;
    run(g, 0.3);
    expect(g.lives).toBe(2);
    expect(g.phase).toBe('dying');
  });
});

describe('pathfinding', () => {
  it('steers toward the player via a ladder', () => {
    const g = started();
    const top = g.level.def.ladders[0][0];
    // monster on floor 0, player on floor 1 directly below the ladder bottom
    const from = { c: top + 3, r: FLOORS[0] - 1 };
    const to = { c: top, r: FLOORS[1] - 1 };
    expect(bfsStep(g.level, from, to, false)).toBe('left');
    expect(bfsStep(g.level, { c: top, r: FLOORS[0] - 1 }, to, false)).toBe('down');
  });
});
