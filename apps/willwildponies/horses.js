// will wild ponies — five fashion horses, weird noises, trollop animations.
// all sounds are synthesized; no audio assets.

const INK = '#1a4d4d';
const BONE = '#efe6d2';
const BLOOD = '#a83232';

// ---- horse SVG builder -------------------------------------------------
//
// folk-art horse, side profile. naive proportions on purpose.
// 240 wide x 200 tall. body roughly center; legs at bottom; head up-left.

function horseSvg({ id, accent, fashion }) {
  const outfit = renderFashion(fashion);

  return `
<svg id="${id}" viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- ground shadow -->
  <ellipse cx="120" cy="186" rx="78" ry="5" fill="${INK}" opacity="0.15"/>

  <!-- back legs (rear of horse, on viewer's right) -->
  <g class="legs">
    <rect x="168" y="120" width="11" height="62" fill="${INK}"/>
    <rect x="184" y="120" width="11" height="62" fill="${INK}"/>
    <rect x="166" y="178" width="15" height="6" fill="${INK}"/>
    <rect x="182" y="178" width="15" height="6" fill="${INK}"/>

    <!-- front legs -->
    <rect x="46"  y="118" width="11" height="64" fill="${INK}"/>
    <rect x="62"  y="118" width="11" height="64" fill="${INK}"/>
    <rect x="44"  y="178" width="15" height="6" fill="${INK}"/>
    <rect x="60"  y="178" width="15" height="6" fill="${INK}"/>
  </g>

  <!-- body: long barrel, side profile -->
  <path d="
      M 50,128
      Q 40,94 76,86
      L 188,86
      Q 214,86 210,118
      Q 208,138 178,138
      L 80,138
      Q 50,138 50,128 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- belly blaze -->
  <ellipse cx="124" cy="128" rx="44" ry="8" fill="${BONE}"/>

  <!-- rump curve seam (folk art detail) -->
  <path d="M 196,92 Q 208,108 200,128" stroke="${INK}" stroke-width="2" fill="none" opacity="0.35"/>

  <!-- tail -->
  <g class="tail">
    <path d="M 208,104
             q 22,-6 26,18
             q 2,16 -8,28
             q -4,-14 -16,-22
             q -8,-6 -2,-24 z"
      fill="${INK}"/>
  </g>

  <!-- neck (rises from front of body up to head) -->
  <path d="M 56,100 Q 48,72 70,58 L 96,72 Q 84,90 86,108 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- head: long, heavy, slightly wrong -->
  <path d="
      M 28,76
      Q 16,56 32,42
      Q 52,28 78,40
      L 96,72
      Q 96,90 78,90
      L 50,90
      Q 30,90 28,76 Z"
    fill="${accent}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>

  <!-- white face blaze (naive) -->
  <path d="M 38,46 Q 32,68 44,86 L 56,84 Q 50,66 52,46 Z" fill="${BONE}"/>

  <!-- mane: along top of neck and behind ear -->
  <path d="M 70,38
           q 4,-10 22,-6
           q 12,4 14,18
           l -10,8
           q -6,-10 -16,-10
           q -10,0 -14,4 z"
    fill="${INK}"/>
  <path d="M 84,58 q 8,4 14,14 l -6,6 q -8,-8 -12,-12 z" fill="${INK}"/>

  <!-- ear -->
  <path d="M 82,28 l 6,16 l -14,-2 z" fill="${INK}"/>
  <path d="M 84,32 l 3,8 l -7,-1 z" fill="${accent}"/>

  <!-- eye -->
  <g class="eye">
    <ellipse cx="48" cy="58" rx="5" ry="5" fill="${BONE}" stroke="${INK}" stroke-width="2"/>
    <circle cx="49" cy="59" r="2.4" fill="${INK}"/>
  </g>

  <!-- nostril -->
  <ellipse cx="30" cy="64" rx="3" ry="3.5" fill="${INK}"/>
  <!-- mouth line -->
  <path d="M 22,76 q 8,4 18,2" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- fashion -->
  ${outfit}
</svg>`;
}

// ---- fashion accessories (positioned for side-profile horse) ----------

function renderFashion(kind) {
  switch (kind) {
    case 'scarf':
      // long red scarf around neck, dragging behind
      return `
        <g>
          <path d="M 58,98 Q 80,108 96,98 L 100,116 Q 80,124 56,116 Z" fill="${BLOOD}" stroke="${INK}" stroke-width="2"/>
          <rect x="92" y="112" width="10" height="42" fill="${BLOOD}" stroke="${INK}" stroke-width="2"/>
          <rect x="86" y="148" width="22" height="6" fill="${BLOOD}" stroke="${INK}" stroke-width="2"/>
        </g>`;
    case 'hat':
      // ill-fitting top hat, tipped, sitting between ears
      return `
        <g transform="translate(70,30) rotate(-12)">
          <rect x="-2" y="-2" width="46" height="6" fill="${INK}"/>
          <rect x="4" y="-26" width="34" height="26" fill="${INK}"/>
          <rect x="4" y="-22" width="34" height="3" fill="${BLOOD}"/>
        </g>`;
    case 'earring':
      // single big square gold-ish earring
      return `
        <g>
          <rect x="58" y="78" width="6" height="14" fill="${BLOOD}" stroke="${INK}" stroke-width="1.5"/>
          <circle cx="61" cy="76" r="2" fill="${INK}"/>
        </g>`;
    case 'collar':
      // ruffled jester collar around base of neck
      return `
        <g>
          <path d="M 56,100
                   q 6,8 18,10
                   q 16,2 28,-4
                   l -2,14
                   q -16,8 -32,4
                   q -16,-4 -18,-12 z"
            fill="${BLOOD}" stroke="${INK}" stroke-width="2"/>
          <circle cx="62" cy="108" r="3" fill="${BONE}"/>
          <circle cx="76" cy="112" r="3" fill="${BONE}"/>
          <circle cx="90" cy="112" r="3" fill="${BONE}"/>
          <circle cx="100" cy="108" r="3" fill="${BONE}"/>
        </g>`;
    case 'sunglasses':
      // tiny dark sunglasses, way too small
      return `
        <g>
          <rect x="36" y="54" width="11" height="9" fill="${INK}"/>
          <rect x="49" y="54" width="11" height="9" fill="${INK}"/>
          <rect x="46" y="56" width="4" height="3" fill="${INK}"/>
        </g>`;
    default:
      return '';
  }
}

// ---- horse roster ------------------------------------------------------

const HORSES = [
  {
    name: 'mona',
    accent: '#c98a72',     // dusty terracotta
    fashion: 'scarf',
    mood: 'mournful',
    voice: { wave: 'sawtooth', base: 220, glide: -80, dur: 0.55, vib: 4, noise: 0.05 },
    cry: 'hhhrrrr…',
  },
  {
    name: 'beverly',
    accent: '#7a8c6a',     // moss
    fashion: 'hat',
    mood: 'suspicious',
    voice: { wave: 'square', base: 320, glide: 110, dur: 0.32, vib: 9, noise: 0.02 },
    cry: 'wuh?!',
  },
  {
    name: 'doreen',
    accent: '#b8b04a',     // sallow yellow
    fashion: 'earring',
    mood: 'flirty',
    voice: { wave: 'triangle', base: 540, glide: -200, dur: 0.7, vib: 6, noise: 0.0 },
    cry: 'oooooh.',
  },
  {
    name: 'gerald',
    accent: '#6a7da6',     // bruise blue
    fashion: 'collar',
    mood: 'unwell',
    voice: { wave: 'sawtooth', base: 140, glide: 30, dur: 0.9, vib: 3, noise: 0.12 },
    cry: 'bllluuhhh',
  },
  {
    name: 'patrice',
    accent: '#a83232',     // blood
    fashion: 'sunglasses',
    mood: 'cool',
    voice: { wave: 'square', base: 90, glide: 600, dur: 0.18, vib: 0, noise: 0.0 },
    cry: 'neigh!',
  },
];

// ---- audio engine ------------------------------------------------------

let audioCtx = null;
let muted = false;

function getCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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
  master.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
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
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur);
  }

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = base * 1.4;
  bp.Q.value = 4;

  osc.connect(bp).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur);

  if (noise > 0) {
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * noise;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, t0);
    noiseGain.gain.linearRampToValueAtTime(0.6, t0 + 0.04);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    src.connect(hp).connect(noiseGain).connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }
}

// ---- placement & motion ------------------------------------------------

function rand(min, max) { return Math.random() * (max - min) + min; }

function placeHorses(paddock, horseEls) {
  const rect = paddock.getBoundingClientRect();
  const horseW = horseEls[0]?.offsetWidth || 220;
  const horseH = horseEls[0]?.offsetHeight || 184;

  // ground lines spread across paddock height. lanes are top-of-horse,
  // computed so hooves land on the ground line. last lane stays clear of the
  // bottom border so hooves don't get clipped.
  const groundYs = [
    rect.height * 0.38,
    rect.height * 0.62,
    rect.height * 0.86,
  ];

  // track placed horses per lane to prevent overlap at start
  const placedByLane = new Map();

  horseEls.forEach((el, i) => {
    const laneIdx = i % groundYs.length;
    const groundY = groundYs[laneIdx];
    const top = Math.max(8, groundY - horseH + rand(-6, 6));

    let left;
    const others = placedByLane.get(laneIdx) ?? [];
    for (let attempt = 0; attempt < 12; attempt++) {
      const tryLeft = rand(20, Math.max(40, rect.width - horseW - 20));
      const collides = others.some(
        (otherLeft) => Math.abs(otherLeft - tryLeft) < horseW * 0.9
      );
      if (!collides) { left = tryLeft; break; }
      left = tryLeft;
    }
    others.push(left);
    placedByLane.set(laneIdx, others);

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    const dir = Math.random() < 0.5 ? 1 : -1;
    const maxSwing = Math.max(40, (rect.width - horseW) / 2.5);
    const swing = rand(40, Math.min(160, maxSwing));
    const dur = rand(9, 18);
    el.style.setProperty('--dir', dir);
    el.style.setProperty('--swing', `${swing}px`);
    el.style.setProperty('--dur', `${dur}s`);
    el.classList.add('horse--moving');
  });
}

// ---- bubble ------------------------------------------------------------

function showBubble(host, text) {
  const existing = host.querySelector('.bubble');
  if (existing) existing.remove();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  b.style.left = '50%';
  b.style.top = '0';
  host.appendChild(b);
  requestAnimationFrame(() => b.classList.add('bubble--show'));
  setTimeout(() => {
    b.classList.remove('bubble--show');
    setTimeout(() => b.remove(), 250);
  }, 1100);
}

// ---- boot --------------------------------------------------------------

function boot() {
  const paddock = document.getElementById('paddock');
  if (!paddock) return;

  const horseEls = HORSES.map((h) => {
    const wrap = document.createElement('div');
    wrap.className = 'horse';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', `${h.name}, a ${h.mood} horse wearing a ${h.fashion}. click to make a noise.`);
    wrap.dataset.name = h.name;
    wrap.innerHTML = horseSvg({ id: `horse-${h.name}`, accent: h.accent, fashion: h.fashion });
    paddock.appendChild(wrap);

    const onPoke = () => {
      playCry(h.voice);
      wrap.classList.remove('horse--startled');
      void wrap.offsetWidth;
      wrap.classList.add('horse--startled');
      showBubble(wrap, h.cry);
      setTimeout(() => wrap.classList.remove('horse--startled'), 500);
    };

    wrap.addEventListener('click', onPoke);
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPoke();
      }
    });
    return wrap;
  });

  placeHorses(paddock, horseEls);

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => placeHorses(paddock, horseEls), 200);
  });

  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.textContent = `sound: ${muted ? 'off' : 'on'}`;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
