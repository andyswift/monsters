import type { GameEvent } from './game/types';

/** Tiny WebAudio synth: sound effects plus a looping minor-key arpeggio. */
export class Sound {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;

  /** Must be called from a user gesture. */
  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, at = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  play(e: GameEvent): void {
    switch (e) {
      case 'dig': this.tone(180, 0.12, 'square', 0.12, 90); break;
      case 'open': this.tone(90, 0.18, 'sawtooth', 0.12, 50); break;
      case 'trap': this.tone(500, 0.25, 'square', 0.1, 120); break;
      case 'whack': this.tone(260, 0.1, 'square', 0.18, 700); break;
      case 'escape': this.tone(200, 0.2, 'triangle', 0.1, 400); break;
      case 'kill': this.tone(700, 0.35, 'sawtooth', 0.14, 60); break;
      case 'crush':
        this.tone(120, 0.3, 'square', 0.18, 40);
        this.tone(900, 0.2, 'square', 0.1, 300, 0.05);
        break;
      case 'die': this.tone(440, 0.8, 'sawtooth', 0.18, 40); break;
      case 'alarm': this.tone(1200, 0.06, 'square', 0.06); break;
      case 'clear':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, undefined, i * 0.12));
        break;
      case 'over':
        [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.18, undefined, i * 0.3));
        break;
    }
  }

  startMusic(): void {
    if (!this.ctx || this.timer !== null) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    if (!this.ctx) return;
    const stepDur = 60 / 112 / 2;
    // Am - F - G - Em, eight eighth-notes per chord.
    const roots = [110, 87.31, 98, 82.41];
    const arp = [1, 2, 3, 2.378, 3, 2, 2.378, 2];
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const chord = Math.floor(this.step / 8) % roots.length;
      const root = roots[chord];
      const at = this.nextTime - this.ctx.currentTime;
      this.tone(root * arp[this.step % 8], stepDur * 0.9, 'sawtooth', 0.035, undefined, at);
      if (this.step % 4 === 0) this.tone(root / 2, stepDur * 3, 'triangle', 0.07, undefined, at);
      this.step++;
      this.nextTime += stepDur;
    }
  }
}
