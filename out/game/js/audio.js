// audio.js — tiny procedural sound kit. No audio files: every sound is
// synthesised with the Web Audio API, so the game stays fully offline.

let ctx = null;
let musicTimer = null;

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  deal()   { tone(520, 0.07, 'triangle', 0.08); tone(660, 0.07, 'triangle', 0.08, 0.05); },
  play()   { tone(392, 0.09, 'triangle', 0.12); tone(587, 0.12, 'triangle', 0.12, 0.06); },
  spell()  { tone(880, 0.18, 'sine', 0.12, 0, 1320); tone(660, 0.2, 'sine', 0.08, 0.05, 990); },
  attack() { tone(220, 0.12, 'sawtooth', 0.1, 0, 110); },
  hit()    { tone(140, 0.15, 'square', 0.12, 0, 70); },
  death()  { tone(330, 0.3, 'sawtooth', 0.09, 0, 55); },
  heal()   { tone(523, 0.12, 'sine', 0.1); tone(659, 0.12, 'sine', 0.1, 0.09); tone(784, 0.16, 'sine', 0.1, 0.18); },
  turn()   { tone(440, 0.08, 'triangle', 0.09); },
  win()    { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.13)); },
  lose()   { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.15)); },
};

// A soft two-chord ambient loop (Am - F) that runs under the duel.
export function startMusic() {
  if (musicTimer) return;
  const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6]];
  let step = 0;
  const playChord = () => {
    const chord = chords[step % chords.length];
    chord.forEach((f) => tone(f, 1.6, 'sine', 0.03));
    step += 1;
  };
  playChord();
  musicTimer = setInterval(playChord, 1700);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
