import { bfsStep, OPPOSITE } from './ai';
import {
  BOTTOM_FLOOR,
  CLEAR_TIME,
  CLOSE_TIME,
  COLS,
  DIG_TIME,
  DROP_TIME,
  DYING_TIME,
  FALL_SPEED,
  FLOORS,
  HOLE_LIFE,
  INTRO_TIME,
  PLAYER_STEP,
  SCORE_CRUSH,
  SCORE_KILL,
  START_LIVES,
  TILE,
} from './constants';
import { Level, levelDef, type Hole } from './level';
import { Monster } from './monster';
import { Player } from './player';
import { mulberry32 } from './rng';
import type { Dir, GameEvent, Input, Particle, Phase, Popup } from './types';

const ACTION_BUFFER = 0.15;

export class Game {
  level!: Level;
  player!: Player;
  monsters: Monster[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  score = 0;
  lives = START_LIVES;
  oxygen = 0;
  phase: Phase = 'intro';
  phaseT = 0;
  levelNo: number;
  events: GameEvent[] = [];

  private rng: () => number;
  private actionBuf = 0;
  private nextId = 1;
  private lastAlarmSec = Infinity;

  constructor(seed = 1, startLevel = 1) {
    this.rng = mulberry32(seed);
    this.levelNo = startLevel;
    this.startLevel(startLevel);
  }

  startLevel(n: number): void {
    this.levelNo = n;
    this.level = new Level(levelDef(n));
    this.oxygen = this.level.def.oxygen;
    this.player = new Player();
    this.monsters = [];
    this.particles = [];
    this.popups = [];
    this.lastAlarmSec = Infinity;
    for (let i = 0; i < this.level.def.monsters; i++) {
      this.monsters.push(new Monster(this.nextId++, 0, 0, this.level.def.stepTime));
    }
    this.scatterMonsters();
    this.phase = 'intro';
    this.phaseT = 0;
  }

  /** Drain events accumulated since the last call. */
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  update(rawDt: number, input: Input): void {
    const dt = Math.min(rawDt, 0.05);
    this.updateParticles(dt);
    this.phaseT += dt;

    switch (this.phase) {
      case 'intro':
        if (this.phaseT >= INTRO_TIME) this.setPhase('playing');
        return;
      case 'dying':
        if (this.phaseT >= DYING_TIME) {
          if (this.lives > 0) {
            this.respawn();
            this.setPhase('playing');
          } else {
            this.setPhase('over');
            this.events.push('over');
          }
        }
        return;
      case 'clear':
        if (this.phaseT >= CLEAR_TIME) this.startLevel(this.levelNo + 1);
        return;
      case 'over':
        return;
    }

    this.oxygen -= dt;
    if (this.oxygen <= 0) {
      this.die(true);
      return;
    }
    const sec = Math.ceil(this.oxygen);
    if (this.oxygen < 10 && sec < this.lastAlarmSec) {
      this.lastAlarmSec = sec;
      this.events.push('alarm');
    }

    this.updateHoles(dt);
    this.updatePlayer(dt, input);
    this.updateMonsters(dt);
    if (this.phase !== 'playing') return;
    this.checkCollisions();
    if (this.phase !== 'playing') return;

    if (this.monsters.length === 0) {
      const bonus = Math.floor(this.oxygen) * 10;
      this.score += bonus;
      this.popup(this.player.x, this.player.y - 1, `+${bonus}`);
      this.events.push('clear');
      this.setPhase('clear');
    }
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  // ---------- player ----------

  private updatePlayer(dt: number, input: Input): void {
    const p = this.player;
    p.t = Math.min(1, p.t + dt / PLAYER_STEP);
    this.actionBuf = input.action ? ACTION_BUFFER : Math.max(0, this.actionBuf - dt);

    const horiz = [...input.held].reverse().find((d) => d === 'left' || d === 'right');
    if (horiz) p.facing = horiz === 'left' ? -1 : 1;

    if (p.busy > 0) {
      p.busy -= dt;
      return;
    }
    if (p.t < 1) return;

    if (this.actionBuf > 0 && this.tryAction()) {
      this.actionBuf = 0;
      return;
    }
    for (const d of [...input.held].reverse()) {
      if (this.tryMove(d)) break;
    }
  }

  tryMove(dir: Dir): boolean {
    const p = this.player;
    const mv = this.level.moves(p.c, p.r, true).find((m) => m.dir === dir);
    if (!mv) return false;
    p.pc = p.c;
    p.pr = p.r;
    p.c = mv.c;
    p.r = mv.r;
    p.t = 0;
    p.anim++;
    return true;
  }

  /** Whack a trapped monster in front of the player, or dig a hole there. */
  tryAction(): boolean {
    const p = this.player;
    const tc = p.c + p.facing;
    const fr = p.r + 1;
    const hole = this.level.holeAt(tc, fr);

    if (hole && hole.occupant !== null) {
      const m = this.monsters.find((x) => x.id === hole.occupant);
      if (m) {
        m.state = 'falling';
        m.fy = m.r;
        m.landR = this.level.landingRow(m.c, m.r);
        m.hole = null;
        hole.occupant = null;
        hole.state = 'closing';
        hole.t = CLOSE_TIME - 0.6;
        p.busy = 0.18;
        this.events.push('whack');
        return true;
      }
    }

    const canDig =
      this.level.tile(p.c, fr) === '#' &&
      this.level.tile(tc, fr) === '#' &&
      fr !== BOTTOM_FLOOR &&
      tc >= 1 &&
      tc <= COLS - 2 &&
      !hole;
    if (!canDig) return false;
    this.level.holes.push({ c: tc, r: fr, state: 'digging', t: 0, occupant: null });
    p.busy = DIG_TIME;
    this.events.push('dig');
    return true;
  }

  // ---------- holes ----------

  private updateHoles(dt: number): void {
    for (const h of this.level.holes) {
      if (h.state === 'digging') {
        h.t += dt;
        if (h.t >= DIG_TIME) {
          h.state = 'open';
          h.t = 0;
          this.events.push('open');
          for (const m of this.monsters) {
            if (m.state === 'walk' && m.t >= 1 && m.c === h.c && m.r === h.r - 1) this.trap(m, h);
          }
        }
      } else if (h.occupant === null) {
        h.t += dt;
        if (h.state === 'open' && h.t >= HOLE_LIFE) {
          h.state = 'closing';
          h.t = 0;
        }
      }
    }
    this.level.holes = this.level.holes.filter(
      (h) => !(h.state === 'closing' && h.occupant === null && h.t >= CLOSE_TIME),
    );
  }

  // ---------- monsters ----------

  private updateMonsters(dt: number): void {
    for (const m of [...this.monsters]) {
      m.stunT = Math.max(0, m.stunT - dt);
      if (m.state === 'walk') {
        if (m.t < 1) {
          m.t = Math.min(1, m.t + dt / m.stepTime);
          if (m.t >= 1 && m.arriving) {
            m.arriving = false;
            const h = this.level.holeAt(m.c, m.r + 1);
            if (h && h.state === 'open' && h.occupant === null && this.level.tile(m.c, m.r) !== 'H') {
              this.trap(m, h);
              continue;
            }
          }
        }
        if (m.t >= 1 && m.stunT <= 0) this.stepMonster(m);
      } else if (m.state === 'trapped') {
        m.t = Math.min(1, m.t + dt / DROP_TIME);
        m.trapT -= dt;
        if (m.trapT <= 0) this.escape(m);
      } else {
        m.fy += FALL_SPEED * dt;
        if (m.fy >= m.landR) this.land(m);
        if (this.phase !== 'playing') return;
      }
    }
  }

  private stepMonster(m: Monster): void {
    const { level } = this;
    const moves = level.moves(m.c, m.r, false);
    if (moves.length === 0) return;
    const def = level.def;

    let choice = undefined as (typeof moves)[number] | undefined;
    if (this.rng() < def.aggression) {
      const target = { c: this.player.c, r: this.player.r };
      const avoid = this.rng() < def.foresight;
      const dir = bfsStep(level, m, target, avoid) ?? (avoid ? bfsStep(level, m, target, false) : null);
      choice = moves.find((mv) => mv.dir === dir);
    }
    if (!choice) {
      const forward = moves.filter((mv) => mv.dir !== (m.lastDir && OPPOSITE[m.lastDir]));
      const pool = forward.length ? forward : moves;
      choice = pool[Math.floor(this.rng() * pool.length)];
    }

    if (choice.c !== m.c) m.face = choice.c > m.c ? 1 : -1;
    m.pc = m.c;
    m.pr = m.r;
    m.c = choice.c;
    m.r = choice.r;
    m.t = 0;
    m.anim++;
    m.lastDir = choice.dir;
    m.arriving = true;
  }

  private trap(m: Monster, hole: Hole): void {
    m.state = 'trapped';
    m.pc = m.c;
    m.pr = m.r;
    m.r = hole.r;
    m.t = 0;
    m.trapT = this.level.def.trapTime;
    m.hole = hole;
    m.arriving = false;
    hole.occupant = m.id;
    this.events.push('trap');
  }

  private escape(m: Monster): void {
    const hole = m.hole;
    m.state = 'walk';
    m.pc = m.c;
    m.pr = m.r;
    m.r = (hole?.r ?? m.r + 1) - 1;
    m.t = 0;
    m.stunT = 0.3;
    m.hole = null;
    if (hole) {
      hole.occupant = null;
      hole.state = 'closing';
      hole.t = CLOSE_TIME - 1;
    }
    this.events.push('escape');
  }

  private land(m: Monster): void {
    const p = this.player;
    this.removeMonster(m, SCORE_KILL);
    this.events.push('kill');
    let crushed = false;
    for (const o of [...this.monsters]) {
      if (o.state === 'walk' && o.c === m.c && Math.abs(o.y - m.landR) < 0.8) {
        this.removeMonster(o, SCORE_CRUSH);
        crushed = true;
      }
    }
    if (crushed) this.events.push('crush');
    if (Math.abs(p.x - m.c) < 0.8 && Math.abs(p.y - m.landR) < 0.8) this.die(false);
  }

  private removeMonster(m: Monster, points: number): void {
    this.monsters = this.monsters.filter((x) => x !== m);
    this.score += points;
    const x = m.x * TILE + TILE / 2;
    const y = (m.state === 'falling' ? m.landR : m.y) * TILE + TILE / 2;
    this.burst(x, y, ['#ff4f7b', '#7b1030', '#ffd23f'], 14);
    this.popups.push({ x: m.x * TILE, y: y - 10, text: String(points), life: 1 });
  }

  private checkCollisions(): void {
    const p = this.player;
    for (const m of this.monsters) {
      if (m.state !== 'walk' || m.stunT > 0) continue;
      if (Math.abs(m.x - p.x) < 0.6 && Math.abs(m.y - p.y) < 0.6) {
        this.die(false);
        return;
      }
    }
  }

  // ---------- life cycle ----------

  private die(oxygen: boolean): void {
    this.lives--;
    if (oxygen) this.oxygen = this.level.def.oxygen;
    this.burst(this.player.x * TILE + 4, this.player.y * TILE + 4, ['#f2c9a0', '#2d6cdf', '#ffffff'], 18);
    this.events.push('die');
    this.setPhase('dying');
  }

  private respawn(): void {
    for (const m of this.monsters) {
      if (m.state === 'trapped') m.state = 'walk';
      m.hole = null;
    }
    this.level.holes = [];
    this.player = new Player();
    this.scatterMonsters();
  }

  private scatterMonsters(): void {
    this.monsters.forEach((m, i) => {
      const fi = Math.floor(this.rng() * 4);
      m.c = m.pc = 2 + Math.floor(this.rng() * (COLS - 4));
      m.r = m.pr = FLOORS[fi] - 1;
      m.t = 1;
      m.state = 'walk';
      m.arriving = false;
      m.lastDir = null;
      m.stunT = 1 + i * 0.6;
    });
  }

  // ---------- effects ----------

  private burst(x: number, y: number, colors: string[], n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = 10 + this.rng() * 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 15,
        life: 0.6 + this.rng() * 0.5,
        max: 1.1,
        color: colors[i % colors.length],
        size: this.rng() < 0.3 ? 2 : 1,
      });
    }
  }

  private popup(tx: number, ty: number, text: string): void {
    this.popups.push({ x: tx * TILE, y: ty * TILE, text, life: 1.5 });
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 8 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }
}
