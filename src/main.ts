import { Sound } from './audio';
import { Game } from './game/game';
import { HEIGHT, WIDTH } from './game/constants';
import { InputManager } from './input';
import { Renderer } from './render/draw';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const frame = document.getElementById('frame') as HTMLElement;
canvas.width = WIDTH;
canvas.height = HEIGHT;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

function fit(): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)));
  frame.style.width = `${WIDTH * scale}px`;
  frame.style.height = `${HEIGHT * scale}px`;
}
window.addEventListener('resize', fit);
fit();

const HI_KEY = 'monsters.hiscore';
function loadHi(): number {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveHi(n: number): void {
  try {
    localStorage.setItem(HI_KEY, String(n));
  } catch {
    /* storage unavailable */
  }
}

const input = new InputManager(window);
const sound = new Sound();
const renderer = new Renderer(ctx);

let hi = loadHi();
let game: Game | null = null;
let paused = false;
let last = performance.now();
let time = 0;

function startGame(): void {
  game = new Game(Date.now() & 0xffffffff);
  paused = false;
  sound.init();
  sound.startMusic();
}

function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;

  if (input.take('mute')) {
    sound.init();
    sound.toggleMute();
  }
  const start = input.take('start');

  if (!game) {
    if (start) startGame();
    renderer.drawTitle(time, hi);
  } else {
    if (input.take('pause') && game.phase !== 'over') paused = !paused;
    const snap = input.snapshot();
    if (!paused) game.update(dt, snap);

    for (const e of game.drainEvents()) {
      sound.play(e);
      if (e === 'over') sound.stopMusic();
    }
    if (game.score > hi) {
      hi = game.score;
      saveHi(hi);
    }
    renderer.drawGame(game, time, hi, paused);
    if (game.phase === 'over' && start) startGame();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
