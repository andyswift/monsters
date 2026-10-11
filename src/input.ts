import type { Dir, Input } from './game/types';

const DIR_KEYS: Record<string, Dir> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};
const ACTION_KEYS = new Set(['Space', 'KeyZ', 'KeyX']);
const PREVENT = new Set([...Object.keys(DIR_KEYS), ...ACTION_KEYS, 'Enter']);

export class InputManager {
  private held: Dir[] = [];
  private action = false;
  private flags = { start: false, mute: false, pause: false };

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      const dir = DIR_KEYS[e.code];
      if (dir) {
        if (!this.held.includes(dir)) this.held.push(dir);
      } else if (ACTION_KEYS.has(e.code)) {
        if (!e.repeat) this.action = true;
      } else if (e.code === 'Enter' && !e.repeat) this.flags.start = true;
      else if (e.code === 'KeyM' && !e.repeat) this.flags.mute = true;
      else if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) this.flags.pause = true;
    });
    target.addEventListener('keyup', (e) => {
      const dir = DIR_KEYS[e.code];
      if (dir) this.held = this.held.filter((d) => d !== dir);
    });
    target.addEventListener('blur', () => {
      this.held = [];
    });
  }

  /** Snapshot for one game update; clears the one-shot action. */
  snapshot(): Input {
    const input = { held: [...this.held], action: this.action };
    this.action = false;
    return input;
  }

  take(flag: 'start' | 'mute' | 'pause'): boolean {
    const v = this.flags[flag];
    this.flags[flag] = false;
    return v;
  }
}
