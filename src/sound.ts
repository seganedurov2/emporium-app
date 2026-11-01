type SoundType = 'click' | 'success' | 'error' | 'upgrade' | 'purchase' | 'alert';

interface SoundOptions {
  volume?: number;
}

/** Лёгкая звуковая система на Web Audio API. Нет внешних зависимостей и ассетов — тоны генерируются синтезом. */
export class SoundSystem {
  private audioCtx: AudioContext | null = null;
  private enabled = false;
  private masterGain: GainNode | null = null;

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.audioCtx = new Ctx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.audioCtx.destination);
    } catch {
      this.enabled = false;
    }
  }

  disable() {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.masterGain = null;
    this.enabled = false;
  }

  setVolume(volume: number) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  private ensureCtx() {
    if (!this.enabled || !this.audioCtx) this.enable();
  }

  play(type: SoundType, opts: SoundOptions = {}) {
    this.ensureCtx();
    if (!this.enabled || !this.audioCtx || !this.masterGain) return;
    const vol = opts.volume ?? 1;
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    gain.gain.value = 0;
    gain.connect(this.masterGain);

    const t = now;
    const fade = 0.05;

    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.05);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.2, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case 'success':
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(900, t + 0.1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.3, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.3, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      case 'upgrade':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.linearRampToValueAtTime(880, t + 0.15);
        osc.frequency.linearRampToValueAtTime(1100, t + 0.3);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.25, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      case 'purchase':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, t);
        osc.frequency.linearRampToValueAtTime(659, t + 0.1);
        osc.frequency.linearRampToValueAtTime(784, t + 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.25, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      case 'alert':
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(400, t + 0.1);
        osc.frequency.linearRampToValueAtTime(300, t + 0.2);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol * 0.3, t + fade);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
    }

    osc.connect(gain);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const sound = new SoundSystem();
