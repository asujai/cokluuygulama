import { Audio } from 'expo-av';
import { SoundTrackDefinition, SoundTrackId } from './types';

export const SOUND_TRACKS: SoundTrackDefinition[] = [
  {
    id: 'rain',
    name: 'Yağmur',
    subtitle: 'Sakinleştirici doğal yağmur damlaları',
    icon: 'rainy-outline',
    color: '#0284C7',
    category: 'nature',
  },
  {
    id: 'fireplace',
    name: 'Şömine & Ateş',
    subtitle: 'Çıtırdayan sıcak odun alevi',
    icon: 'flame-outline',
    color: '#EA580C',
    category: 'nature',
  },
  {
    id: 'waves',
    name: 'Okyanus Dalgası',
    subtitle: 'Kıyıya vuran ritmik deniz dalgaları',
    icon: 'water-outline',
    color: '#0D9488',
    category: 'nature',
  },
  {
    id: 'forest',
    name: 'Orman & Kuşlar',
    subtitle: 'Hafif yaprak hışırtısı ve kuş sesleri',
    icon: 'leaf-outline',
    color: '#16A34A',
    category: 'nature',
  },
  {
    id: 'wind',
    name: 'Rüzgar',
    subtitle: 'Uğultulu serin dağ esintisi',
    icon: 'cloud-outline',
    color: '#6366F1',
    category: 'nature',
  },
  {
    id: 'thunder',
    name: 'Gök Gürültüsü',
    subtitle: 'Derin yankılanan uzaktaki şimşekler',
    icon: 'thunderstorm-outline',
    color: '#7C3AED',
    category: 'nature',
  },
  {
    id: 'stream',
    name: 'Akarsu & Dere',
    subtitle: 'Taşların arasından akan berrak su',
    icon: 'color-wand-outline',
    color: '#06B6D4',
    category: 'nature',
  },
  {
    id: 'crickets',
    name: 'Cırcır Böcekleri',
    subtitle: 'Huzurlu yaz gecesi cırcır böcekleri',
    icon: 'moon-outline',
    color: '#8B5CF6',
    category: 'nature',
  },
  {
    id: 'white_noise',
    name: 'Beyaz Gürültü',
    subtitle: 'Tüm frekanslarda eşit odaklanma sesi',
    icon: 'radio-outline',
    color: '#64748B',
    category: 'noise',
  },
  {
    id: 'pink_noise',
    name: 'Pembe Gürültü',
    subtitle: 'Daha derin ve yumuşak uyku frekansı',
    icon: 'disc-outline',
    color: '#EC4899',
    category: 'noise',
  },
  {
    id: 'brown_noise',
    name: 'Kahverengi Gürültü',
    subtitle: 'Yoğun, derin ve rahatlatıcı uğultu',
    icon: 'planet-outline',
    color: '#B45309',
    category: 'noise',
  },
  {
    id: 'cafe',
    name: 'Kafe Ambiyansı',
    subtitle: 'Arka planda hafif kahve dükkanı canlılığı',
    icon: 'cafe-outline',
    color: '#D97706',
    category: 'urban',
  },
];

class SoundSynthesizerEngine {
  private ctx: any = null;
  private masterGain: any = null;
  private trackGains: Partial<Record<SoundTrackId, any>> = {};
  private activeNodes: any[] = [];
  private isInitialized: boolean = false;
  private currentTrackVolumes: Record<SoundTrackId, number> = {
    rain: 0,
    fireplace: 0,
    waves: 0,
    forest: 0,
    wind: 0,
    thunder: 0,
    cafe: 0,
    white_noise: 0,
    pink_noise: 0,
    brown_noise: 0,
    crickets: 0,
    stream: 0,
  };
  private isEnginePlaying: boolean = false;

  private getAudioContext(): any {
    if (typeof window !== 'undefined') {
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.ctx) {
          this.ctx = new AudioContextClass();
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      }
    }
    return null;
  }

  public async initBackgroundAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
    } catch {
      // Audio mode set notice
    }
  }

  public startEngine(initialVolumes: Record<SoundTrackId, number>, masterVol: number = 0.8): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stopEngine(); // Clean previous if any
    this.currentTrackVolumes = { ...initialVolumes };

    // Master Gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(masterVol, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    // Build all 12 procedural sound generators
    SOUND_TRACKS.forEach((track) => {
      const trackGain = ctx.createGain();
      const vol = this.currentTrackVolumes[track.id] || 0;
      trackGain.gain.setValueAtTime(vol, ctx.currentTime);
      trackGain.connect(this.masterGain);
      this.trackGains[track.id] = trackGain;

      this.createProceduralSoundSource(track.id, trackGain);
    });

    this.isInitialized = true;
    this.isEnginePlaying = true;
  }

  public setTrackVolume(trackId: SoundTrackId, volume: number): void {
    this.currentTrackVolumes[trackId] = volume;
    const gainNode = this.trackGains[trackId];
    if (gainNode && this.ctx) {
      try {
        gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.05);
      } catch {}
    }
  }

  public setMasterVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.05);
      } catch {}
    }
  }

  public fadeOutAndStop(durationSec: number, onComplete?: () => void): void {
    if (this.masterGain && this.ctx) {
      try {
        const currTime = this.ctx.currentTime;
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, currTime);
        this.masterGain.gain.linearRampToValueAtTime(0.001, currTime + durationSec);

        setTimeout(() => {
          this.stopEngine();
          if (onComplete) onComplete();
        }, durationSec * 1000);
      } catch {
        this.stopEngine();
        if (onComplete) onComplete();
      }
    } else {
      this.stopEngine();
      if (onComplete) onComplete();
    }
  }

  public stopEngine(): void {
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
    this.trackGains = {};
    this.isEnginePlaying = false;
    this.isInitialized = false;
  }

  public isPlaying(): boolean {
    return this.isEnginePlaying;
  }

  /**
   * Procedural Audio Synthesizers for each of the 12 ambient sounds.
   */
  private createProceduralSoundSource(id: SoundTrackId, targetGain: any): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = sampleRate * 4; // 4 second looped buffer

    switch (id) {
      case 'white_noise': {
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.4;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(targetGain);
        source.start();
        this.activeNodes.push(source);
        break;
      }

      case 'pink_noise': {
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
          b6 = white * 0.115926;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(targetGain);
        source.start();
        this.activeNodes.push(source);
        break;
      }

      case 'brown_noise': {
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 1.5;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(targetGain);
        source.start();
        this.activeNodes.push(source);
        break;
      }

      case 'rain': {
        // Filtered pink noise + rain droplet modulation
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.04 * white) / 1.04;
          data[i] = lastOut * 0.8;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }

      case 'fireplace': {
        // Brown noise + crackle pulses
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.015 * white) / 1.015;
          // Random crackle pop
          const isPop = Math.random() < 0.0004;
          data[i] = lastOut * 0.6 + (isPop ? (Math.random() * 2 - 1) * 0.9 : 0);
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(targetGain);
        source.start();
        this.activeNodes.push(source);
        break;
      }

      case 'waves': {
        // Ocean waves: Brown noise with LFO ebb and flow
        const buffer = ctx.createBuffer(1, bufferSize * 2, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < buffer.length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 0.9;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, ctx.currentTime);

        const waveGain = ctx.createGain();
        waveGain.gain.setValueAtTime(0.5, ctx.currentTime);

        // LFO for wave pulse
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 8 second wave cycle

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.4, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(waveGain.gain);

        source.connect(filter);
        filter.connect(waveGain);
        waveGain.connect(targetGain);

        source.start();
        lfo.start();
        this.activeNodes.push(source, filter, waveGain, lfo, lfoGain);
        break;
      }

      case 'wind': {
        // Resonant sweeping bandpass noise
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.Q.setValueAtTime(3.5, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }

      case 'thunder': {
        // Deep thunder rumble generator
        const buffer = ctx.createBuffer(1, bufferSize * 2, sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < buffer.length; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.008 * w) / 1.008;
          data[i] = last * 1.8;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }

      case 'stream': {
        // Flowing mountain brook
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.45;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1100, ctx.currentTime);
        filter.Q.setValueAtTime(1.8, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }

      case 'crickets': {
        // High frequency modulated chirp pulses
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(4600, ctx.currentTime);

        const chirpGain = ctx.createGain();
        chirpGain.gain.setValueAtTime(0.3, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.type = 'triangle';
        lfo.frequency.setValueAtTime(14, ctx.currentTime); // Chirp rhythm

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.3, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(chirpGain.gain);

        osc.connect(chirpGain);
        chirpGain.connect(targetGain);

        osc.start();
        lfo.start();
        this.activeNodes.push(osc, chirpGain, lfo, lfoGain);
        break;
      }

      case 'forest': {
        // Leaves rustling + soft bird tones
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.03 * w) / 1.03;
          data[i] = last * 0.4;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }

      case 'cafe': {
        // Muffled cafe ambiance
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.98 * b0 + white * 0.04;
          b1 = 0.92 * b1 + white * 0.08;
          data[i] = (b0 + b1) * 0.4;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, ctx.currentTime);

        source.connect(filter);
        filter.connect(targetGain);
        source.start();
        this.activeNodes.push(source, filter);
        break;
      }
    }
  }
}

export const soundSynthesizer = new SoundSynthesizerEngine();
