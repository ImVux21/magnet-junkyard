// ============================================================================
// Magnet Junkyard - Procedural Audio Engine (0 KB Asset Footprint)
// ============================================================================

interface WebAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class ProceduralAudioService {
  private static instance: ProceduralAudioService | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  // Persistent Magnet Hum Nodes
  private magnetOsc: OscillatorNode | null = null;
  private magnetGain: GainNode | null = null;

  // Generative Ambient Music Engine Nodes
  private musicNodes: {
    oscA?: OscillatorNode;
    oscB?: OscillatorNode;
    filter?: BiquadFilterNode;
    lfo?: OscillatorNode;
    lfoGain?: GainNode;
    windSource?: AudioBufferSourceNode;
    windGain?: GainNode;
  } = {};
  private chimeTimerId: any = null;
  private isMusicPlaying: boolean = false;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.8;

  private muted: boolean = false;
  private volume: number = 0.8;
  private initialized: boolean = false;
  private comboPitchModifier: number = 1.0;

  private constructor() {
    // Lazy initialized on first user gesture or explicit init
  }

  public static getInstance(): ProceduralAudioService {
    if (!ProceduralAudioService.instance) {
      ProceduralAudioService.instance = new ProceduralAudioService();
    }
    return ProceduralAudioService.instance;
  }

  public init(): void {
    if (this.initialized) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as WebAudioWindow).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('[ProceduralAudio] Web Audio API is not supported in this browser.');
        return;
      }

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.generateNoiseBuffer();
      this.setupAutoplayResume();
      this.loadAudioSamples();
      this.initialized = true;
    } catch (e) {
      console.warn('[ProceduralAudio] Failed to initialize AudioContext:', e);
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => {
        console.warn('[ProceduralAudio] AudioContext resume failed:', err);
      });
    }
  }

  private setupAutoplayResume(): void {
    const resumeHandler = () => {
      this.resume();
      if (!this.isMusicPlaying && !this.muted) {
        this.startAmbientMusic();
      }
      window.removeEventListener('pointerdown', resumeHandler);
      window.removeEventListener('keydown', resumeHandler);
      window.removeEventListener('touchstart', resumeHandler);
    };

    window.addEventListener('pointerdown', resumeHandler, { passive: true });
    window.addEventListener('keydown', resumeHandler, { passive: true });
    window.addEventListener('touchstart', resumeHandler, { passive: true });
  }

  private generateNoiseBuffer(): void {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
    if (muted) {
      this.stopAmbientMusic();
    } else if (this.ctx && this.ctx.state === 'running') {
      this.startAmbientMusic();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // --------------------------------------------------------------------------
  // 0KB Procedural Generative Ambient Music Engine
  // --------------------------------------------------------------------------
  public startAmbientMusic(): void {
    if (!this.ctx || this.isMusicPlaying || !this.musicGain || this.muted) return;
    try {
      this.isMusicPlaying = true;
      const now = this.ctx.currentTime;

      // Layer 1: Sub Drone (A1: 55Hz detuned)
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';
      oscA.frequency.setValueAtTime(55.0, now);
      oscB.frequency.setValueAtTime(55.35, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.Q.setValueAtTime(3.0, now);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(50, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.05, now);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(droneGain);
      droneGain.connect(this.musicGain);

      oscA.start(now);
      oscB.start(now);
      lfo.start(now);

      this.musicNodes = { oscA, oscB, filter, lfo, lfoGain };

      // Layer 2: Wasteland Ambient Wind Noise
      if (this.noiseBuffer) {
        const windSource = this.ctx.createBufferSource();
        windSource.buffer = this.noiseBuffer;
        windSource.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(280, now);
        windFilter.Q.setValueAtTime(1.8, now);

        const windGain = this.ctx.createGain();
        windGain.gain.setValueAtTime(0.025, now);

        windSource.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(this.musicGain);

        windSource.start(now);
        this.musicNodes.windSource = windSource;
        this.musicNodes.windGain = windGain;
      }

      // Layer 3: Metallic Pentatonic Scrap Resonances (Chimes)
      this.scheduleNextChime();
    } catch (e) {
      console.warn('[ProceduralAudio] Failed to start ambient music:', e);
    }
  }

  private scheduleNextChime(): void {
    if (!this.isMusicPlaying) return;
    const delayMs = 4000 + Math.random() * 3500;
    this.chimeTimerId = setTimeout(() => {
      this.playChimeNote();
      this.scheduleNextChime();
    }, delayMs);
  }

  private playChimeNote(): void {
    if (!this.ctx || !this.isMusicPlaying || !this.musicGain) return;
    try {
      const notes = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25];
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.setValueAtTime(14, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + 3.0);
    } catch {
      // Safe audio ignore
    }
  }

  public stopAmbientMusic(): void {
    this.isMusicPlaying = false;
    if (this.chimeTimerId) {
      clearTimeout(this.chimeTimerId);
      this.chimeTimerId = null;
    }
    try {
      if (this.musicNodes.oscA) {
        this.musicNodes.oscA.stop();
        this.musicNodes.oscA.disconnect();
      }
      if (this.musicNodes.oscB) {
        this.musicNodes.oscB.stop();
        this.musicNodes.oscB.disconnect();
      }
      if (this.musicNodes.lfo) {
        this.musicNodes.lfo.stop();
        this.musicNodes.lfo.disconnect();
      }
      if (this.musicNodes.windSource) {
        this.musicNodes.windSource.stop();
        this.musicNodes.windSource.disconnect();
      }
    } catch {
      // Safe ignore
    }
    this.musicNodes = {};
  }

  public getIsMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setComboPitchModifier(modifier: number): void {
    this.comboPitchModifier = Math.max(0.5, Math.min(3.0, modifier));
  }

  public getComboPitchModifier(): number {
    return this.comboPitchModifier;
  }

  private async loadAudioSamples(): Promise<void> {
    if (!this.ctx) return;
    const samples = [
      { key: 'compressor_crunch', url: 'assets/audio/sfx/compressor_crunch.ogg' },
      { key: 'scrap_pickup', url: 'assets/audio/sfx/scrap_pickup.ogg' },
      { key: 'coin_clink', url: 'assets/audio/sfx/coin_clink.ogg' },
      { key: 'ui_click', url: 'assets/audio/sfx/ui_click.ogg' },
      { key: 'ui_switch', url: 'assets/audio/sfx/ui_switch.ogg' },
      { key: 'ui_open', url: 'assets/audio/sfx/ui_open.ogg' },
      { key: 'emp_blast', url: 'assets/audio/sfx/emp_blast.ogg' },
      { key: 'steam_hiss', url: 'assets/audio/sfx/steam_hiss.ogg' },
      { key: 'fanfare', url: 'assets/audio/sfx/fanfare.ogg' },
    ];

    for (const s of samples) {
      try {
        const res = await fetch(s.url);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
          this.audioBuffers.set(s.key, audioBuf);
        }
      } catch {
        // Seamless fallback to procedural synthesis
      }
    }
  }

  private playSample(key: string, playbackRate: number = 1.0, volume: number = 1.0): boolean {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.sfxGain) return false;
    const buffer = this.audioBuffers.get(key);
    if (!buffer) return false;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(Math.max(0.3, Math.min(3.0, playbackRate)), this.ctx.currentTime);
      if (volume !== 1.0) {
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        source.connect(gain);
        gain.connect(this.sfxGain);
      } else {
        source.connect(this.sfxGain);
      }
      source.start();
      return true;
    } catch {
      return false;
    }
  }

  public playUIClick(): void {
    this.playSample('ui_click', 1.0, 0.7);
  }

  public playUIOpen(): void {
    this.playSample('ui_open', 1.0, 0.7);
  }

  public playUISwitch(): void {
    this.playSample('ui_switch', 1.0, 0.7);
  }

  // --------------------------------------------------------------------------
  // 1. Bright Metallic Coin Clink
  // --------------------------------------------------------------------------
  public playCoinClink(pitchMod = 1.0): void {
    if (this.playSample('coin_clink', pitchMod)) return;
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200 * pitchMod, now);
      filter.Q.setValueAtTime(9.0, now);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1860 * pitchMod, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2480 * pitchMod, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.15);
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 2. Heavy Hydraulic Compressor Crunch
  // --------------------------------------------------------------------------
  public playCompressorCrunch(): void {
    if (this.playSample('compressor_crunch', 1.0, 1.2)) return;
    if (!this.ctx || !this.noiseBuffer || this.ctx.state !== 'running' || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;

      // Noise component
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(70, now + 0.22);
      filter.Q.setValueAtTime(4.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      // Sub-bass thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'square';
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.25);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);

      noise.start(now);
      subOsc.start(now);
      noise.stop(now + 0.25);
      subOsc.stop(now + 0.25);
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 3. Scrap Pickup Plink (Pitch scales inversely with mass and escalated by combo)
  // --------------------------------------------------------------------------
  public playScrapPickup(massKg: number, pitchMod?: number): void {
    const effPitch = pitchMod ?? this.comboPitchModifier;
    const rate = Math.max(0.6, Math.min(2.2, (1.2 / Math.sqrt(Math.max(0.2, massKg))) * effPitch));
    if (this.playSample('scrap_pickup', rate)) return;
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const effectivePitchMod = pitchMod ?? this.comboPitchModifier;
      const safeMass = Math.max(0.1, massKg);
      const baseFreq = Math.max(380, Math.min(1800, 1100 / Math.sqrt(safeMass)));
      const scaledFreq = Math.max(200, Math.min(3600, baseFreq * effectivePitchMod));

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(scaledFreq, now);
      osc.frequency.exponentialRampToValueAtTime(scaledFreq * 0.7, now + 0.06);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 4. Distinct 4-Note Ascending Fanfare on Fever Mode Entry
  // --------------------------------------------------------------------------
  public playFeverFanfare(): void {
    if (this.playSample('fanfare', 1.0, 1.2)) return;
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // 4 ascending notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const noteDuration = 0.16;
      const stagger = 0.075;

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const noteStart = now + idx * stagger;

        const osc = this.ctx.createOscillator();
        const harm = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        harm.type = 'triangle';
        harm.frequency.setValueAtTime(freq * 2, noteStart);

        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.linearRampToValueAtTime(0.22, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

        osc.connect(gain);
        harm.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteStart);
        harm.start(noteStart);
        osc.stop(noteStart + noteDuration + 0.02);
        harm.stop(noteStart + noteDuration + 0.02);
      });
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 5. Recycler Thermal Cooldown Steam Hiss Synthesis
  // --------------------------------------------------------------------------
  public playSteamHiss(durationSeconds: number = 2.0): void {
    if (this.playSample('steam_hiss', 1.0)) return;
    if (!this.ctx || !this.noiseBuffer || this.ctx.state !== 'running' || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;

      // Bandpass filter centered at 2800Hz for pressurized steam sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.frequency.linearRampToValueAtTime(1600, now + durationSeconds);
      filter.Q.setValueAtTime(1.6, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.08); // Quick pressure burst
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + durationSeconds + 0.05);
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 4. Dynamic Continuous Magnet Hum
  // --------------------------------------------------------------------------
  public setMagnetHum(activeAttractingCount: number): void {
    if (!this.ctx || this.muted || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      if (activeAttractingCount > 0 && this.ctx.state === 'running') {
        if (!this.magnetOsc || !this.magnetGain) {
          this.magnetOsc = this.ctx.createOscillator();
          this.magnetGain = this.ctx.createGain();
          this.magnetOsc.type = 'sawtooth';
          this.magnetOsc.frequency.setValueAtTime(65, now);
          this.magnetGain.gain.setValueAtTime(0.001, now);
          this.magnetOsc.connect(this.magnetGain);
          this.magnetGain.connect(this.masterGain);
          this.magnetOsc.start(now);
        }

        const targetGain = Math.min(0.18, 0.03 + activeAttractingCount * 0.025);
        this.magnetGain.gain.cancelScheduledValues(now);
        this.magnetGain.gain.linearRampToValueAtTime(targetGain, now + 0.1);
        this.magnetOsc.frequency.setValueAtTime(65 + Math.min(60, activeAttractingCount * 8), now);
      } else if (this.magnetGain) {
        this.magnetGain.gain.cancelScheduledValues(now);
        this.magnetGain.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      }
    } catch {
      // Audio error safety
    }
  }

  // --------------------------------------------------------------------------
  // 5. EMP Blast & Hazard Audio
  // --------------------------------------------------------------------------
  public playEMPBlast(): void {
    if (this.playSample('emp_blast', 1.0, 1.2)) return;
    if (!this.ctx || this.muted || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      // Electric surge oscillator
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.45);

      // Noise pop
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(800, now);
        nFilter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.4, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.4);
      }
    } catch {
      // Audio error safety
    }
  }

  public playCritterSqueak(): void {
    if (!this.ctx || this.muted || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.06);
      osc.frequency.linearRampToValueAtTime(750, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Audio error safety
    }
  }

  public playFanfare(): void {
    if (this.playSample('fanfare', 1.0)) return;
    if (!this.ctx || this.muted || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.08;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.18, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(noteStart);
        osc.stop(noteStart + 0.3);
      });
    } catch {
      // Audio error safety
    }
  }

  // Stop all active persistent sounds (e.g. on pause / unmount)
  public stopAll(): void {
    this.stopAmbientMusic();
    if (this.magnetOsc) {
      try {
        this.magnetOsc.stop();
        this.magnetOsc.disconnect();
      } catch {
        // Safe ignore
      }
      this.magnetOsc = null;
      this.magnetGain = null;
    }
  }
}
