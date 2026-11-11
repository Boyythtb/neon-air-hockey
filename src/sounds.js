// Âm thanh êm ái, thanh thoát chuẩn phong cách thể thao Birdie Bash
// Không chói gắt, không âm điện tử khó chịu - Dùng Web Audio API tự nhiên

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Tiếng cọ nảy đĩa với Mallet (Tiếng gõ "póc" giòn tan, êm tai)
  playHitMallet(speed = 20) {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const norm = Math.min(Math.max(speed / 28, 0.6), 1.8);

    // Thành phần 1: Tiếng nổ tách đanh gọn (Transient pop)
    const noiseLen = Math.floor(ctx.sampleRate * 0.02);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const ndata = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      ndata[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1350 * norm;
    noiseFilter.Q.value = 2.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.16 * norm, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    // Thành phần 2: Âm rung thanh thoát (Sine ring nhẹ)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(780 * norm, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    oscGain.gain.setValueAtTime(0.18 * norm, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 2. Tiếng đập thành bàn nảy ra (Bục bục gỗ êm dịu, không ồn)
  playHitWall(speed = 20) {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 3. Tiếng vút gió êm khi smash mạnh (Whoosh thanh tao)
  playWhoosh() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + 0.05);
    filter.frequency.exponentialRampToValueAtTime(360, now + 0.12);
    filter.Q.value = 2.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.12);
  }

  // 4. Chuông nốt nhạc vui mừng bàn thắng (Melodic Goal Chime & Cheer)
  playGoal() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Chuỗi 4 nốt nhạc thăng hoa ngọt ngào: C5, E5, G5, C6 (Do Mi Sol Do)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.16, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });

    // Tiếng vỗ tay / reo hò ấm áp từ khán giả (Gentle Cheer)
    const cheerSize = Math.floor(ctx.sampleRate * 0.8);
    const cheerBuf = ctx.createBuffer(1, cheerSize, ctx.sampleRate);
    const cdata = cheerBuf.getChannelData(0);
    for (let i = 0; i < cheerSize; i++) {
      cdata[i] = Math.random() * 2 - 1;
    }
    const cheerNoise = ctx.createBufferSource();
    cheerNoise.buffer = cheerBuf;

    const cheerFilter = ctx.createBiquadFilter();
    cheerFilter.type = 'bandpass';
    cheerFilter.frequency.value = 680;
    cheerFilter.Q.value = 1.0;

    const cheerGain = ctx.createGain();
    cheerGain.gain.setValueAtTime(0.001, now + 0.1);
    cheerGain.gain.linearRampToValueAtTime(0.09, now + 0.3);
    cheerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    cheerNoise.connect(cheerFilter);
    cheerFilter.connect(cheerGain);
    cheerGain.connect(ctx.destination);
    cheerNoise.start(now + 0.1);
    cheerNoise.stop(now + 0.85);
  }

  // 5. Tiếng click nút UI thanh nhã
  playClick() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }
}

export const sounds = new SoundManager();
