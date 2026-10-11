export const TILE = 8;
export const COLS = 40;
export const ROWS = 26;
export const WIDTH = 320;
export const HEIGHT = 256;
export const HUD_TOP = 24;

/** Rows of the diggable floors. Actors stand on the row above each. */
export const FLOORS = [4, 9, 14, 19, 24] as const;
export const BOTTOM_FLOOR = 24;

export const PLAYER_STEP = 0.11;
export const DIG_TIME = 0.3;
export const HOLE_LIFE = 6;
export const CLOSE_TIME = 1.5;
export const INTRO_TIME = 2.2;
export const DYING_TIME = 1.4;
export const CLEAR_TIME = 3;
export const FALL_SPEED = 18;
export const DROP_TIME = 0.15;

export const SCORE_KILL = 100;
export const SCORE_CRUSH = 300;
export const START_LIVES = 3;
export const PLAYER_START = { c: 2, r: 23 };
