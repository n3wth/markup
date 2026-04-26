// creepy horses — gallery wall javascript.
// four oil-painting portraits, each horse painted in its sunday best.
// click a painting: the horse lurches, makes a synth sound, shows a speech bubble.
// horses sway gently at all times — they are not entirely still.

'use strict';

// ---- palette (matches style.css tokens) -----------------------------------

const INK   = '#2a1a10';
const BONE  = '#efe6d2';
const BLOOD = '#8a2a2a';

// ---- horse portrait data --------------------------------------------------
//
// each entry defines one oil painting. accent = body fill color.
// fashion = accessory drawn over the horse. voice = synth parameters.

const HORSES = [
  {
    name: 'Millicent',
    title: 'no. 1 — Millicent',
    subtitle: 'oil on canvas, late period',
    accent: '#b87858',   // burnt sienna
    fashion: 'bonnet',
    mood: 'imperious',
    cry: 'hmmmph.',
    voice: { wave: 'sawtooth', base: 180, glide: -60, dur: 0.7, vib: 3.5, noise: 0.06 },
  },
  {
    name: 'Reginald',
    title: 'no. 2 — Reginald',
    subtitle: 'unsigned, provenance unclear',
    accent: '#5a7848',   // forest green
    fashion: 'monocle',
    mood: 'suspicious',
    cry: 'hrrm?',
    voice: { wave: 'square', base: 280, glide: 120, dur: 0.28, vib: 8, noise: 0.01 },
  },
  {
    name: 'Dorothea',
    title: 'no. 3 — Dorothea',
    subtitle: 'do not turn your back',
    accent: '#8870a8',   // dusty mauve
    fashion: 'collar',
    mood: 'theatrical',
    cry: 'ohhh…',
    voice: { wave: 'triangle', base: 480, glide: -220, dur: 0.85, vib: 5, noise: 0.0 },
  },
  {
    name: 'Beauregard',
    title: 'no. 4 — Beauregard',
    subtitle: 'gift shop: closed',
    accent: '#6888a8',   // slate blue
    fashion: 'cravat',
    mood: 'unwell',
    cry: 'bllhh.',
    voice: { wave: 'sawtooth', base: 110, glide: 40, dur: 1.1, vib: 2, noise: 0.18 },
  },
];

// ---- SVG horse portrait ---------------------------------------------------
//
// side-profile folk-art horse. viewBox 240x200. naive proportions intentional.
// each horse gets a unique accessory drawn on top.

function horseSvg({ id, accent, fashion }) {
  const outfit = renderFashion(fashion, accent);

  return `<svg id="${id}" viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- sky background in canvas -->
  <rect width="240" height="200" fill="#c9d6c4"/>
  <!-- grass strip -->
  <rect x="0" y="158" width="240" height="42" fill="#6f8a4a"/>
  <!-- grass edge detail -->
  <rect x="0" y="158" width="240" height="4" fill="#4f6a32"/>

  <!-- back legs -->
  <rect x="155" y="114" width="12" height="52" fill="${INK}"/>
  <rect x="172" y="114" width="12" height="52" fill="${INK}"/>
  <rect x="153" y="162" width="16" height="5" fill="${INK}"/>
  <rect x="170" y="162" width="16" height="5" fill="${INK}"/>

  <!-- front legs -->
  <rect x="54"  y="114" width="12" height="52" fill="${INK}"/>
  <rect x="71"  y="114" width="12" height="52" fill="${INK}"/>
  <rect x="52"  y="162" width="16" height="5" fill="${INK}"/>
  <rect x="69"  y="162" width="16" height="5" fill="${INK}"/>

  <!-- body barrel -->
  <path d="M 58,122
    Q 46,88 82,80
    L 190,80
    Q 218,80 214,114
    Q 212,134 180,134
    L 82,134
    Q 54,134 58,122 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- belly blaze -->
  <ellipse cx="126" cy="124" rx="44" ry="8" fill="${BONE}"/>

  <!-- rump seam (folk art) -->
  <path d="M 198,86 Q 212,104 204,126" stroke="${INK}" stroke-width="2" fill="none" opacity="0.4"/>

  <!-- tail -->
  <path d="M 210,98
    q 24,-6 28,18
    q 2,16 -8,28
    q -4,-14 -16,-22
    q -8,-6 -2,-24 z"
    fill="${INK}"/>

  <!-- neck -->
  <path d="M 62,96 Q 52,66 76,52 L 102,68 Q 90,86 90,106 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- head -->
  <path d="
    M 34,72
    Q 20,50 38,36
    Q 58,22 86,36
    L 102,68
    Q 102,88 82,88
    L 54,88
    Q 32,88 34,72 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- face blaze -->
  <path d="M 42,42 Q 36,64 48,84 L 60,82 Q 54,62 56,42 Z" fill="${BONE}"/>

  <!-- mane -->
  <path d="M 76,32 q 4,-10 24,-6 q 12,4 14,20 l -12,8 q -6,-10 -16,-10 q -10,0 -14,4 z" fill="${INK}"/>
  <path d="M 90,56 q 8,4 14,14 l -6,6 q -8,-8 -12,-12 z" fill="${INK}"/>

  <!-- ear -->
  <path d="M 86,24 l 6,16 l -14,-2 z" fill="${INK}"/>
  <path d="M 88,28 l 3,8 l -7,-1 z" fill="${accent}"/>

  <!-- eye whites + pupil (class for blink/track animations) -->
  <g class="eye-lids">
    <ellipse cx="52" cy="56" rx="5.5" ry="5.5" fill="${BONE}" stroke="${INK}" stroke-width="2"/>
  </g>
  <g class="eye-pupils">
    <circle cx="53" cy="57" r="2.6" fill="${INK}"/>
  </g>

  <!-- nostril -->
  <ellipse cx="30" cy="62" rx="3.2" ry="3.8" fill="${INK}"/>

  <!-- mouth line -->
  <path d="M 22,74 q 8,4 20,2" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- fashion accessory -->
  ${outfit}
</svg>`;
}

// ---- fashion accessories --------------------------------------------------

function renderFashion(kind, accent) {
  switch (kind) {
    case 'bonnet':
      // frilly bonnet, tied under chin with a bow
      return `
        <g>
          <!-- bonnet dome -->
          <path d="M 60,24 Q 58,8 82,4 Q 108,0 112,24 Q 106,18 82,18 Q 62,18 60,24 Z"
            fill="${BONE}" stroke="${INK}" stroke-width="2"/>
          <!-- bonnet brim -->
          <path d="M 56,28 Q 50,18 82,14 Q 114,14 116,28 Q 100,22 82,22 Q 64,22 56,28 Z"
            fill="${BONE}" stroke="${INK}" stroke-width="2"/>
          <!-- ribbon ties down cheek -->
          <path d="M 58,30 Q 48,42 46,58 Q 44,64 50,66" stroke="${BLOOD}" stroke-width="3" fill="none"/>
          <!-- bow knot under chin -->
          <path d="M 44,64 Q 36,68 34,76 M 44,64 Q 50,70 46,78" stroke="${BLOOD}" stroke-width="2" fill="none"/>
        </g>`;

    case 'monocle':
      // brass monocle jammed in one eye socket, chain dangling
      return `
        <g>
          <!-- monocle frame -->
          <circle cx="52" cy="56" r="9" fill="none" stroke="${INK}" stroke-width="3"/>
          <circle cx="52" cy="56" r="9" fill="none" stroke="#b8960a" stroke-width="1.5" stroke-dasharray="2 2"/>
          <!-- chain -->
          <path d="M 60,56 Q 70,62 72,80 Q 74,92 84,96"
            stroke="#b8960a" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>
          <circle cx="84" cy="98" r="2.5" fill="#b8960a"/>
        </g>`;

    case 'collar':
      // ruffled jester collar at base of neck, white with dots
      return `
        <g>
          <path d="M 62,98
            q 6,10 20,12 q 18,2 30,-4 l -2,16 q -16,8 -34,4 q -18,-4 -20,-14 z"
            fill="${BONE}" stroke="${INK}" stroke-width="2"/>
          <!-- ruffle folds -->
          <path d="M 64,102 Q 60,110 66,114" stroke="${INK}" stroke-width="1.2" fill="none" opacity="0.5"/>
          <path d="M 76,106 Q 74,114 80,116" stroke="${INK}" stroke-width="1.2" fill="none" opacity="0.5"/>
          <path d="M 90,108 Q 90,116 96,116" stroke="${INK}" stroke-width="1.2" fill="none" opacity="0.5"/>
          <!-- dot buttons -->
          <circle cx="68" cy="106" r="2.5" fill="${INK}"/>
          <circle cx="82" cy="110" r="2.5" fill="${INK}"/>
          <circle cx="96" cy="110" r="2.5" fill="${INK}"/>
          <circle cx="108" cy="106" r="2.5" fill="${INK}"/>
        </g>`;

    case 'cravat':
      // large floppy cravat at throat, slightly askew
      return `
        <g transform="rotate(-5, 80, 80)">
          <!-- cravat body -->
          <path d="M 58,88 Q 66,84 80,86 Q 96,88 100,92
            L 94,116 Q 84,122 72,118 Z"
            fill="${BLOOD}" stroke="${INK}" stroke-width="2"/>
          <!-- fold detail -->
          <path d="M 70,92 Q 80,96 88,92" stroke="${INK}" stroke-width="1.5" fill="none" opacity="0.6"/>
          <!-- tie knot -->
          <ellipse cx="80" cy="91" rx="8" ry="5" fill="${BLOOD}" stroke="${INK}" stroke-width="1.5"/>
        </g>`;

    default:
      return '';
  }
}

// ---- audio engine ---------------------------------------------------------

let audioCtx = null;
let muted = false;

function getCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playCry(voice) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const { wave, base, glide, dur, vib, noise } = voice;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.28, t0 + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(base, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, base + glide), t0 + dur);

  if (vib > 0) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = vib;
    lfoGain.gain.value = base * 0.04;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur);
  }

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = base * 1.4;
  bp.Q.value = 3;

  osc.connect(bp);
  bp.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur);

  if (noise > 0) {
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * noise;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0, t0);
    nGain.gain.linearRampToValueAtTime(0.55, t0 + 0.04);
    nGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    src.connect(hp);
    hp.connect(nGain);
    nGain.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }
}

// ---- speech bubble --------------------------------------------------------

function showBubble(host, text) {
  const existing = host.querySelector('.bubble');
  if (existing) existing.remove();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  host.appendChild(b);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => b.classList.add('bubble--show'));
  });
  setTimeout(() => {
    b.classList.remove('bubble--show');
    setTimeout(() => b.remove(), 250);
  }, 1200);
}

// ---- build gallery wall ---------------------------------------------------

function buildWall(wall) {
  HORSES.forEach((h, i) => {
    const painting = document.createElement('div');
    painting.className = 'painting';
    painting.setAttribute('role', 'button');
    painting.setAttribute('tabindex', '0');
    painting.setAttribute('aria-label',
      `${h.title}. a ${h.mood} horse wearing a ${h.fashion}. click to disturb the painting.`);

    // random slight tilt — each painting hangs a little crooked
    const tilt = (Math.random() - 0.5) * 3.2;
    painting.style.setProperty('--tilt', `${tilt}deg`);

    // horse art inside frame
    const frame = document.createElement('div');
    frame.className = 'frame';

    const art = document.createElement('div');
    art.className = 'horse-art';
    // stagger sway animation so paintings don't move in unison
    const swayDur  = 12 + i * 2.7 + Math.random() * 4;
    const swayDelay = -(i * 3.1 + Math.random() * 5);
    art.style.setProperty('--sway-dur',   `${swayDur}s`);
    art.style.setProperty('--sway-delay', `${swayDelay}s`);

    // eye animation delays
    const eyeDelay   = i * 1.9 + Math.random() * 2;
    const blinkDelay = i * 1.3;
    art.style.setProperty('--eye-delay',   `${eyeDelay}s`);
    art.style.setProperty('--blink-delay', `${blinkDelay}s`);

    art.innerHTML = horseSvg({ id: `horse-${h.name}`, accent: h.accent, fashion: h.fashion });
    frame.appendChild(art);

    // nail + wire above frame
    const nail = document.createElement('div');
    nail.className = 'nail';
    nail.setAttribute('aria-hidden', 'true');
    const wire = document.createElement('div');
    wire.className = 'wire';
    wire.setAttribute('aria-hidden', 'true');

    // label below frame
    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML = `<strong>${h.title}</strong><br>${h.subtitle}`;

    // bubble container lives inside painting (for positioning above frame)
    const bubble = document.createElement('div');
    bubble.className = 'bubble-anchor';

    painting.appendChild(nail);
    painting.appendChild(wire);
    painting.appendChild(frame);
    painting.appendChild(label);
    painting.appendChild(bubble);
    wall.appendChild(painting);

    // click / keyboard interaction
    const startle = () => {
      playCry(h.voice);
      painting.classList.remove('painting--startled');
      void painting.offsetWidth; // reflow to restart animation
      painting.classList.add('painting--startled');
      showBubble(painting, h.cry);
      setTimeout(() => painting.classList.remove('painting--startled'), 700);
    };

    painting.addEventListener('click', startle);
    painting.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startle(); }
    });
  });
}

// ---- mute toggle ----------------------------------------------------------

function wireMute() {
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    muted = !muted;
    btn.setAttribute('aria-pressed', String(muted));
    btn.textContent = `sound: ${muted ? 'off' : 'on'}`;
  });
}

// ---- boot -----------------------------------------------------------------

function boot() {
  const wall = document.getElementById('wall');
  if (!wall) return;
  buildWall(wall);
  wireMute();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
