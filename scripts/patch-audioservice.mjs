import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/services/audio/ProceduralAudioService.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add audioBuffers map
if (!content.includes('audioBuffers: Map<string, AudioBuffer>')) {
  content = content.replace(
    'private noiseBuffer: AudioBuffer | null = null;',
    'private noiseBuffer: AudioBuffer | null = null;\n  private audioBuffers: Map<string, AudioBuffer> = new Map();'
  );
}

// 2. Trigger loadAudioSamples in init()
if (!content.includes('this.loadAudioSamples();')) {
  content = content.replace(
    'this.setupAutoplayResume();',
    'this.setupAutoplayResume();\n      this.loadAudioSamples();'
  );
}

// 3. Add sample loader & playSample helper methods
const methods = `
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
`;

if (!content.includes('loadAudioSamples()')) {
  content = content.replace(
    '// 1. Bright Metallic Coin Clink',
    `${methods}\n  // 1. Bright Metallic Coin Clink`
  );
}

// 4. Hook into playCoinClink
content = content.replace(
  'public playCoinClink(pitchMod = 1.0): void {',
  'public playCoinClink(pitchMod = 1.0): void {\n    if (this.playSample(\'coin_clink\', pitchMod)) return;'
);

// 5. Hook into playCompressorCrunch
content = content.replace(
  'public playCompressorCrunch(): void {',
  'public playCompressorCrunch(): void {\n    if (this.playSample(\'compressor_crunch\', 1.0, 1.2)) return;'
);

// 6. Hook into playScrapPickup
content = content.replace(
  'public playScrapPickup(massKg: number, pitchMod?: number): void {',
  `public playScrapPickup(massKg: number, pitchMod?: number): void {
    const effPitch = pitchMod ?? this.comboPitchModifier;
    const rate = Math.max(0.6, Math.min(2.2, (1.2 / Math.sqrt(Math.max(0.2, massKg))) * effPitch));
    if (this.playSample('scrap_pickup', rate)) return;`
);

// 7. Hook into playFeverFanfare
content = content.replace(
  'public playFeverFanfare(): void {',
  'public playFeverFanfare(): void {\n    if (this.playSample(\'fanfare\', 1.0, 1.2)) return;'
);

// 8. Hook into playSteamHiss
content = content.replace(
  'public playSteamHiss(durationSeconds: number = 2.0): void {',
  'public playSteamHiss(durationSeconds: number = 2.0): void {\n    if (this.playSample(\'steam_hiss\', 1.0)) return;'
);

// 9. Hook into playEMPBlast
content = content.replace(
  'public playEMPBlast(): void {',
  'public playEMPBlast(): void {\n    if (this.playSample(\'emp_blast\', 1.0, 1.2)) return;'
);

// 10. Hook into playFanfare
content = content.replace(
  'public playFanfare(): void {',
  'public playFanfare(): void {\n    if (this.playSample(\'fanfare\', 1.0)) return;'
);

fs.writeFileSync(file, content, 'utf-8');
console.log('ProceduralAudioService.ts patched successfully!');
