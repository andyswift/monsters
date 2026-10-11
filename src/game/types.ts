export type Dir = 'left' | 'right' | 'up' | 'down';

export interface Input {
  /** Held direction keys, oldest first. */
  held: Dir[];
  /** True on the frame the action key was pressed. */
  action: boolean;
}

export type GameEvent =
  | 'dig'
  | 'open'
  | 'trap'
  | 'whack'
  | 'escape'
  | 'kill'
  | 'crush'
  | 'die'
  | 'clear'
  | 'over'
  | 'alarm';

export type Phase = 'intro' | 'playing' | 'dying' | 'clear' | 'over';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
}
