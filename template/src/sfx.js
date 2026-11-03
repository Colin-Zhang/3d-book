// 音效：全部用 Web Audio 现场合成，没有版权问题。浏览器规定第一次点页面以后才能出声，引擎会自动 unlock()
// 一次性：sfx.click() / page() / paper() / knock(力度) / thud(力度) / tick() / beep() / ding() / pop() / creak()
// 持续的：sfx.loop("roll" | "whoosh" | "fizz" | "pour" | "sizzle").set(0–1)，每帧按速度、反应快慢设一次
let ac = null, master = null, noise = null, muted = false;
const loops = {};

export function unlock() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.85;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ac.destination);
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }   // 白噪 + 一点粉噪
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.85, ac.currentTime, 0.05); }
export const isMuted = () => muted;

const now = () => ac.currentTime;
function noiseSrc() { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); return s; }
function filt(type, f, q = 0.7) { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
function amp(v = 0) { const g = ac.createGain(); g.gain.value = v; return g; }
function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function burst({ type = "bandpass", f = 2000, q = 1, a = 0.003, peak = 0.3, d = 0.08, sweep = null, at = 0 }) {
  const t = now() + at, s = noiseSrc(), fl = filt(type, f, q), g = amp();
  if (sweep) { fl.frequency.setValueAtTime(sweep[0], t); fl.frequency.exponentialRampToValueAtTime(sweep[1], t + a + d); }
  s.connect(fl); fl.connect(g); g.connect(master); env(g, t, a, peak, d); s.start(t); s.stop(t + a + d + 0.05);
}
function tone({ type = "sine", f = 440, f2 = null, a = 0.002, peak = 0.3, d = 0.15, at = 0 }) {
  const t = now() + at, o = ac.createOscillator(), g = amp();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  o.connect(g); g.connect(master); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}

export const sfx = {
  click() { if (!ac) return; tone({ type: "triangle", f: 1700, f2: 900, peak: 0.12, d: 0.035 }); burst({ type: "highpass", f: 3500, peak: 0.08, d: 0.02 }); },
  page() { if (!ac) return; burst({ f: 900, q: 0.8, a: 0.05, peak: 0.35, d: 0.38, sweep: [700, 3200] }); burst({ f: 2600, q: 1.5, a: 0.02, peak: 0.12, d: 0.12, at: 0.28 }); tone({ f: 130, f2: 70, peak: 0.12, d: 0.12, at: 0.36 }); },
  paper() { if (!ac) return; for (let i = 0; i < 3; i++) burst({ f: 2200 + Math.random() * 1500, q: 1.2, a: 0.004, peak: 0.16, d: 0.05, at: i * 0.045 }); },
  knock(s = 1) { if (!ac) return; tone({ f: 210, f2: 95, peak: 0.45 * s, d: 0.12 }); burst({ type: "lowpass", f: 1600, peak: 0.25 * s, d: 0.03 }); },
  thud(s = 1) { if (!ac) return; tone({ f: 95, f2: 48, peak: 0.55 * s, d: 0.22 }); burst({ type: "lowpass", f: 600, peak: 0.25 * s, d: 0.08 }); },
  tick() { if (!ac) return; burst({ type: "highpass", f: 4200, peak: 0.12, d: 0.015 }); },
  beep() { if (!ac) return; tone({ type: "square", f: 2350, peak: 0.05, a: 0.004, d: 0.07 }); },
  ding() { if (!ac) return; tone({ f: 2093, peak: 0.12, d: 0.7 }); tone({ f: 3136, peak: 0.05, d: 0.45 }); },
  pop() { if (!ac) return; tone({ f: 500 + Math.random() * 500, f2: 1400, peak: 0.07, d: 0.025 }); },
  creak() { if (!ac) return; tone({ type: "sawtooth", f: 140, f2: 115, peak: 0.035, a: 0.03, d: 0.22 }); },
  loop(name) {
    if (!ac) return { set() {} };
    if (loops[name]) return loops[name];
    const s = noiseSrc(), g = amp(0);
    const P = {
      roll: { a: filt("lowpass", 380, 0.9), f: (v) => 220 + v * 520, peak: 0.5 },
      whoosh: { a: filt("bandpass", 600, 0.9), f: (v) => 380 + v * 1300, peak: 0.42 },
      fizz: { a: filt("bandpass", 3200, 2.5), f: (v) => 2600 + v * 1800, peak: 0.28 },
      pour: { a: filt("bandpass", 520, 1.6), f: (v) => 420 + v * 380, peak: 0.4 },
      sizzle: { a: filt("highpass", 3800, 0.7), f: (v) => 3500 + v * 1500, peak: 0.22 },
    }[name] ?? { a: filt("lowpass", 800), f: () => 800, peak: 0.3 };
    s.connect(P.a); P.a.connect(g); g.connect(master); s.start();
    let wob = 0;
    loops[name] = {
      set(v) {
        v = Math.max(0, Math.min(1, v)); const t = now();
        if (name === "fizz") { wob = (wob + 1) % 7; v *= 0.55 + 0.45 * Math.random(); if (v > 0.15 && wob === 0) sfx.pop(); }   // 气泡一阵一阵的
        g.gain.setTargetAtTime(v * P.peak, t, 0.04);
        P.a.frequency.setTargetAtTime(P.f(v), t, 0.06);
      },
    };
    return loops[name];
  },
  silence() { if (!ac) return; for (const k in loops) loops[k].set(0); },
};
