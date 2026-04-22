/**
 * SoundManager handles dynamic ambient underwater sounds and effects using Web Audio API.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private normalAmbient: { bubbles: OscillatorNode; noise: AudioWorkletNode | BiquadFilterNode; gain: GainNode } | null = null;
  private deepAmbient: { hum: OscillatorNode; noise: BiquadFilterNode; gain: GainNode } | null = null;
  private masterGain: GainNode | null = null;
  private currentMode: 'normal' | 'deep-sea' = 'normal';
  private isStarted: boolean = false;

  constructor() {}

  public start() {
    if (this.isStarted) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.setupNormalAmbient();
    this.setupDeepAmbient();
    
    this.isStarted = true;
    this.setMode('normal');
  }

  private setupNormalAmbient() {
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Bubbles (Random high-pitched blips)
    const bubbles = this.ctx.createOscillator();
    bubbles.type = 'sine';
    bubbles.frequency.setValueAtTime(400, this.ctx.currentTime);
    
    const bubbleGain = this.ctx.createGain();
    bubbleGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    bubbles.connect(bubbleGain);
    bubbleGain.connect(gain);
    bubbles.start();

    // Surface noise (Filtered white noise)
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    noiseSource.start();

    this.normalAmbient = { bubbles, noise: filter, gain };
  }

  private setupDeepAmbient() {
    if (!this.ctx || !this.masterGain) return;

    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Deep Hum
    const hum = this.ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(60, this.ctx.currentTime);
    
    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    hum.connect(humGain);
    humGain.connect(gain);
    hum.start();

    // Deep pressure noise
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);
    
    noiseSource.connect(filter);
    filter.connect(gain);
    noiseSource.start();

    this.deepAmbient = { hum, noise: filter, gain };
  }

  public setMode(mode: 'normal' | 'deep-sea') {
    if (!this.ctx || !this.normalAmbient || !this.deepAmbient) return;
    
    this.currentMode = mode;
    const now = this.ctx.currentTime;
    const fadeTime = 2.0;

    if (mode === 'normal') {
      this.normalAmbient.gain.gain.linearRampToValueAtTime(0.8, now + fadeTime);
      this.deepAmbient.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
    } else {
      this.normalAmbient.gain.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.deepAmbient.gain.gain.linearRampToValueAtTime(1.0, now + fadeTime);
    }
  }

  public updateActivity(fishCount: number, avgSpeed: number) {
    if (!this.ctx || !this.normalAmbient || !this.deepAmbient) return;

    const now = this.ctx.currentTime;
    
    // Modulate bubbles in normal mode
    if (this.currentMode === 'normal') {
      const bubbleFreq = 400 + (avgSpeed * 50);
      this.normalAmbient.bubbles.frequency.setTargetAtTime(bubbleFreq, now, 0.5);
    } else {
      // Modulate hum in deep-sea mode
      const humFreq = 60 + (fishCount * 0.5);
      this.deepAmbient.hum.frequency.setTargetAtTime(humFreq, now, 0.5);
    }
  }

  public playPinchEffect() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
    
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(g);
    g.connect(this.masterGain);
    
    osc.start();
    osc.stop(now + 0.1);
  }

  public playFishInteraction() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(g);
    g.connect(this.masterGain);
    
    osc.start();
    osc.stop(now + 0.2);
  }
}

export const soundManager = new SoundManager();
