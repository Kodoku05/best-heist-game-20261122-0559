// Synthesized WebAudio sounds. One clear job: every sound the game makes,
// built from oscillators — no audio files, no network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let humNodes = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure() || !ctx || ctx.state === 'suspended') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration; never break the game for it.
    }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (muted || !ensure() || !ctx || ctx.state === 'suspended') return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // ignore
    }
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    get muted() {
      return muted;
    },
    step(sneak) {
      if (sneak) tone(140, 0.05, 'sine', 0.05);
      else tone(90 + Math.random() * 30, 0.06, 'triangle', 0.08);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.16, 1320);
    },
    sapphire() {
      tone(660, 0.12, 'sine', 0.18, 990);
      setTimeout(() => tone(990, 0.18, 'sine', 0.18, 1480), 110);
    },
    coin() {
      tone(1500, 0.07, 'square', 0.06, 1100);
    },
    coinLand() {
      tone(1150, 0.08, 'triangle', 0.1, 900);
      tone(900, 0.06, 'triangle', 0.07, 700);
    },
    smoke() {
      noiseBurst(0.5, 0.2, 900);
    },
    emp() {
      tone(1200, 0.35, 'sawtooth', 0.1, 90);
    },
    laserZap() {
      tone(2200, 0.12, 'square', 0.12, 300);
    },
    suspicious() {
      tone(520, 0.12, 'triangle', 0.14, 700);
    },
    alert() {
      tone(392, 0.16, 'sawtooth', 0.16, 392);
      setTimeout(() => tone(523, 0.22, 'sawtooth', 0.16, 523), 150);
    },
    caught() {
      tone(330, 0.25, 'sawtooth', 0.18, 110);
      setTimeout(() => tone(220, 0.4, 'sawtooth', 0.18, 82), 220);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.16), i * 120));
    },
    unlockDoor() {
      tone(440, 0.1, 'square', 0.08, 660);
      setTimeout(() => tone(660, 0.14, 'square', 0.08, 880), 120);
    },
    startHum() {
      if (!ensure() || humNodes || muted) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 55;
        const gain = ctx.createGain();
        gain.gain.value = 0.035;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.4;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.015;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        lfo.start();
        humNodes = { osc, lfo, gain };
      } catch {
        // ignore
      }
    },
  };
}
