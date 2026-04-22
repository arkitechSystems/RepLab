/**
 * Sound effects using Web Audio API — no files needed.
 * Falls back silently if AudioContext is unavailable.
 */
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if suspended (iOS requires user gesture)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(frequency, duration = 0.15, type = 'sine', volume = 0.3) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Short beep for countdown (3, 2, 1) */
export function beepCountdown() {
  playTone(880, 0.1, 'sine', 0.25);
}

/** Higher beep for phase start (GO!) */
export function beepStart() {
  playTone(1200, 0.2, 'sine', 0.35);
}

/** Ding for phase change (work → rest or rest → work) */
export function beepPhaseChange() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 1200;
  gain.gain.value = 0.4;
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 2400;
  gain2.gain.value = 0.12;
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + 0.5);
}

/**
 * Rest-over cue: two short beeps (880 Hz → 1320 Hz) with a brief gap.
 * Modest volume (~0.15), short ramp in/out to avoid clicks. Designed to
 * notify without startling. Safe no-op if AudioContext is unavailable or
 * suspended (iOS requires a prior user gesture via initAudio()).
 */
export function beepRestEnd() {
  const ctx = getCtx();
  if (!ctx) return;
  const vol = 0.15;
  const fade = 0.008; // 8ms fade in/out

  function schedule(freq, startOffset, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    const t1 = t0 + duration;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + fade);
    gain.gain.setValueAtTime(vol, t1 - fade);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  // Beep 1: 880 Hz, 120ms
  schedule(880, 0, 0.12);
  // 50ms gap, then Beep 2: 1320 Hz, 150ms
  schedule(1320, 0.12 + 0.05, 0.15);
}

/** Alarm sound for completion — repeating urgent tone */
export function beepComplete() {
  const ctx = getCtx();
  if (!ctx) return;
  // 3 rapid alarm bursts
  for (let i = 0; i < 3; i++) {
    const offset = i * 0.35;
    // High tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1000;
    gain.gain.value = 0.2;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.15);
    // Low tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 800;
    gain2.gain.value = 0.2;
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + offset + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + offset + 0.15);
    osc2.stop(ctx.currentTime + offset + 0.3);
  }
}

/**
 * Initialize audio context on user gesture (required for iOS Safari).
 * Must be called directly from a tap/click handler — plays a silent buffer
 * to fully unlock the context so future programmatic plays (setInterval, etc.) work.
 */
export function initAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  // Playing a silent buffer inside the user gesture unlocks audio on iOS Safari.
  // Just calling resume() is not always sufficient — Safari needs an actual sound scheduled.
  const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}
