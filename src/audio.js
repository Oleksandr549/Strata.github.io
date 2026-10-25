export function createAmbience() {
  let ctx = null;
  let master = null;
  let rainGain = null;
  let thunderTimer = 0;
  let on = false;
  let level = 1;

  function noiseBuffer(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else {
          d[i] = w;
        }
      }
    }
    return buf;
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(4, false);
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.16;
    src.connect(hp).connect(lp).connect(rainGain).connect(master);
    src.start();

    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(6, true);
    bed.loop = true;
    const bedLp = ctx.createBiquadFilter();
    bedLp.type = 'lowpass';
    bedLp.frequency.value = 400;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.35;
    bed.connect(bedLp).connect(bedGain).connect(master);
    bed.start();
    return true;
  }

  function thunder() {
    if (!on || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(5, true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 3.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * level, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.25 * level, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.4 - 0.7;
    src.connect(lp).connect(g);
    (pan ? g.connect(pan) : g).connect(master);
    src.start(t);
    src.stop(t + 5);
    thunderTimer = window.setTimeout(thunder, 14000 + Math.random() * 16000);
  }

  return {
    get on() { return on; },
    async toggle(force) {
      const next = typeof force === 'boolean' ? force : !on;
      if (next && !ctx && !init()) return false;
      if (!ctx) return false;
      on = next;
      const t = ctx.currentTime;
      if (on) {
        await ctx.resume();
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(0.55, t, 0.6);
        window.clearTimeout(thunderTimer);
        thunderTimer = window.setTimeout(thunder, 3500);
      } else {
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(0, t, 0.25);
        window.clearTimeout(thunderTimer);
      }
      return on;
    },
    setLevel(v) {
      level = Math.max(0.05, Math.min(1, v));
      if (ctx && rainGain) rainGain.gain.setTargetAtTime(0.05 + 0.16 * level, ctx.currentTime, 0.4);
    },
    suspend() { if (ctx && on) ctx.suspend(); },
    resume() { if (ctx && on) ctx.resume(); }
  };
}
