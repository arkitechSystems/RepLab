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
 * Initialize audio context on user gesture (required for iOS).
 * Call this on any button click before sounds are needed.
 */
export function initAudio() {
  getCtx();
}
