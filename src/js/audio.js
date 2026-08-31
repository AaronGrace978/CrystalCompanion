/**
 * Audio soul of the companion.
 * Startup song: born inside the crystal — muffled, detuned, then
 * the low-pass opens as light blooms; crystal pulses to the music.
 * SFX: synthesized chimes via Web Audio (no external packs needed).
 */
(function () {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let filter = null;
  let analyser = null;
  let songSource = null;
  let songBuffer = null;
  let convolver = null;
  let pulseValue = 0;
  let musicEnabled = true;
  let sfxEnabled = true;
  let musicVol = 0.45;
  let sfxVol = 0.55;
  let awakening = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    sfxGain = ctx.createGain();
    sfxGain.gain.value = sfxVol;

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    filter.Q.value = 0.7;

    // shimmer bandpass parallel
    const shimmer = ctx.createBiquadFilter();
    shimmer.type = 'bandpass';
    shimmer.frequency.value = 2400;
    shimmer.Q.value = 0.6;

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.15;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    // soft impulse reverb
    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.8, 2.2);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.28;

    musicGain.connect(filter);
    filter.connect(analyser);
    analyser.connect(master);

    musicGain.connect(shimmer);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(master);

    musicGain.connect(convolver);
    convolver.connect(verbGain);
    verbGain.connect(master);

    sfxGain.connect(master);
    sfxGain.connect(convolver);

    window._crystalShimmer = shimmerGain;
    return ctx;
  }

  function makeImpulse(ac, duration, decay) {
    const rate = ac.sampleRate;
    const len = rate * duration;
    const buf = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  async function loadSong(urlOrBuffer) {
    ensure();
    let arr;
    if (urlOrBuffer instanceof ArrayBuffer) {
      arr = urlOrBuffer;
    } else if (urlOrBuffer && ArrayBuffer.isView(urlOrBuffer)) {
      arr = urlOrBuffer.buffer.slice(
        urlOrBuffer.byteOffset,
        urlOrBuffer.byteOffset + urlOrBuffer.byteLength
      );
    } else if (typeof urlOrBuffer === 'string') {
      const res = await fetch(urlOrBuffer);
      arr = await res.arrayBuffer();
    } else {
      throw new Error('No song data');
    }
    songBuffer = await ctx.decodeAudioData(arr.slice(0));
    return songBuffer;
  }

  function updatePulse() {
    if (!analyser) {
      pulseValue *= 0.9;
      return pulseValue;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // favor mid-high crystal harmonics
    let sum = 0;
    const start = 8;
    const end = Math.min(data.length, 64);
    for (let i = start; i < end; i++) sum += data[i];
    const avg = sum / (end - start) / 255;
    // bass thump
    let bass = 0;
    for (let i = 1; i < 8; i++) bass += data[i];
    bass = bass / 7 / 255;
    pulseValue = Math.min(1.4, avg * 1.6 + bass * 0.9);
    return pulseValue;
  }

  /**
   * Creative awaken sequence:
   * 1. Sub-rumble from silence
   * 2. Song starts heavily filtered (trapped in stone)
   * 3. Filter opens over ~12s as crystal "breathes"
   * 4. Pitch subtly settles from slightly flat to true
   * 5. Volume blooms with exponential curve
   */
  async function awaken(songData, opts = {}) {
    if (awakening) return;
    awakening = true;
    ensure();
    await ctx.resume();

    if (opts.musicEnabled === false) musicEnabled = false;
    if (typeof opts.musicVol === 'number') musicVol = opts.musicVol;
    if (typeof opts.sfxVol === 'number') sfxVol = opts.sfxVol;
    sfxGain.gain.value = sfxEnabled ? sfxVol : 0;

    // birth chime cluster
    playBirthChime();

    if (!musicEnabled) {
      awakening = false;
      return;
    }

    if (!songBuffer) {
      try {
        await loadSong(songData);
      } catch (e) {
        console.error('Song load failed', e);
        awakening = false;
        return;
      }
    }

    // reverse swell pre-echo (first 1.8s reversed, quiet)
    playReverseGhost(songBuffer, 1.8);

    await sleep(600);

    const src = ctx.createBufferSource();
    src.buffer = songBuffer;
    src.loop = true;

    // detune starts slightly flat — crystal finding pitch
    src.playbackRate.value = 0.972;

    const songFilter = filter;
    songFilter.frequency.setValueAtTime(180, ctx.currentTime);
    musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    src.connect(musicGain);
    src.start(0);
    songSource = src;

    const now = ctx.currentTime;
    // volume: exponential bloom ~14s
    musicGain.gain.exponentialRampToValueAtTime(Math.max(0.001, musicVol * 0.35), now + 4);
    musicGain.gain.exponentialRampToValueAtTime(Math.max(0.001, musicVol), now + 14);

    // filter opens — light escaping stone
    songFilter.frequency.exponentialRampToValueAtTime(800, now + 5);
    songFilter.frequency.exponentialRampToValueAtTime(2800, now + 10);
    songFilter.frequency.exponentialRampToValueAtTime(16000, now + 16);

    // pitch settles to true over 10s
    src.playbackRate.exponentialRampToValueAtTime(1.0, now + 10);

    // shimmer rises late
    if (window._crystalShimmer) {
      window._crystalShimmer.gain.setValueAtTime(0.05, now);
      window._crystalShimmer.gain.linearRampToValueAtTime(0.22, now + 12);
    }

    // drive visual energy with music
    const pulseLoop = () => {
      updatePulse();
      if (window.CrystalVisual && pulseValue > 0.08) {
        // gentle continuous energy
        window.CrystalVisual.setEnergy(0.08 + pulseValue * 0.45);
      }
      requestAnimationFrame(pulseLoop);
    };
    requestAnimationFrame(pulseLoop);

    awakening = false;
  }

  function playReverseGhost(buffer, seconds) {
    try {
      const rate = buffer.sampleRate;
      const frames = Math.min(buffer.length, Math.floor(rate * seconds));
      const ghost = ctx.createBuffer(buffer.numberOfChannels, frames, rate);
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const src = buffer.getChannelData(c);
        const dst = ghost.getChannelData(c);
        for (let i = 0; i < frames; i++) {
          dst[i] = src[frames - 1 - i] * Math.pow(i / frames, 1.5);
        }
      }
      const g = ctx.createBufferSource();
      g.buffer = ghost;
      const gg = ctx.createGain();
      gg.gain.value = musicVol * 0.25;
      const gf = ctx.createBiquadFilter();
      gf.type = 'lowpass';
      gf.frequency.value = 900;
      g.connect(gf);
      gf.connect(gg);
      gg.connect(master);
      g.start();
    } catch (_) {}
  }

  function playBirthChime() {
    if (!sfxEnabled) return;
    ensure();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      tone(freq, t, 1.8, 0.12, 'sine');
      tone(freq * 2.01, t + 0.02, 1.2, 0.04, 'sine');
    });
  }

  function tone(freq, when, dur, vol, type = 'sine') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol * (sfxEnabled ? sfxVol : 0) + 0.0001, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function noiseBurst(when, dur, vol, freq) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * sfxVol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  window.CrystalAudio = {
    ensure,
    awaken,
    loadSong,
    getPulse: () => {
      updatePulse();
      return pulseValue;
    },
    setMusicEnabled(v) {
      musicEnabled = !!v;
      if (musicGain && ctx) {
        musicGain.gain.linearRampToValueAtTime(v ? musicVol : 0.0001, ctx.currentTime + 0.4);
      }
      if (!v && songSource) {
        // keep playing silent or leave — mute via gain
      }
    },
    setSfxEnabled(v) {
      sfxEnabled = !!v;
      if (sfxGain) sfxGain.gain.value = v ? sfxVol : 0;
    },
    setMusicVolume(v) {
      musicVol = v;
      if (musicGain && musicEnabled && ctx) {
        musicGain.gain.linearRampToValueAtTime(Math.max(0.0001, v), ctx.currentTime + 0.2);
      }
    },
    setSfxVolume(v) {
      sfxVol = v;
      if (sfxGain && sfxEnabled) sfxGain.gain.value = v;
    },
    send() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      tone(880, t, 0.35, 0.1, 'triangle');
      tone(1320, t + 0.05, 0.4, 0.06, 'sine');
      noiseBurst(t, 0.08, 0.05, 3200);
    },
    receive() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      // descending crystal cascade
      [1046.5, 783.99, 659.25, 523.25].forEach((f, i) => {
        tone(f, t + i * 0.07, 0.9, 0.08 - i * 0.01, 'sine');
      });
    },
    click() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      tone(1400, t, 0.12, 0.04, 'triangle');
      tone(2100, t, 0.08, 0.025, 'sine');
    },
    open() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      tone(392, t, 0.5, 0.06, 'sine');
      tone(584, t + 0.08, 0.55, 0.05, 'sine');
      noiseBurst(t, 0.2, 0.04, 1800);
    },
    error() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      tone(220, t, 0.4, 0.08, 'sawtooth');
      tone(196, t + 0.15, 0.5, 0.06, 'triangle');
    },
    think() {
      if (!sfxEnabled) return;
      ensure();
      const t = ctx.currentTime;
      tone(660, t, 0.8, 0.035, 'sine');
      tone(990, t + 0.2, 0.9, 0.03, 'sine');
    }
  };
})();
