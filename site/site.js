import { logo } from '../src/components/logo.js';
import { createStage } from './stage.js';
import { createSynth } from './synth.js';
import { N, clamp, lerp } from './layouts.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ORIGINAL_TITLE = document.title;

/* ───────── logo inline (herda currentColor) ───────── */
$$('[data-logo]').forEach((el) => el.append(logo({ size: Number(el.dataset.logo) || 28 })));

/* ───────── textos em letras / palavras ───────── */
let letterIndex = 0;
function splitLetters(el) {
  const out = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(document.createTextNode(' '));
          const word = document.createElement('span');
          word.className = 'wd';
          [...part].forEach((ch) => {
            const l = document.createElement('span');
            l.className = 'lt';
            l.style.setProperty('--i', String(letterIndex++));
            l.textContent = ch;
            word.append(l);
            out.push(l);
          });
          frag.append(word);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    }
  };
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  walk(el);
  $$('.wd, .lt', el).forEach((n) => n.setAttribute('aria-hidden', 'true'));
  return out;
}
function splitWords(el) {
  let i = 0;
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(document.createTextNode(' '));
          const mask = document.createElement('span');
          mask.className = 'wm';
          mask.setAttribute('aria-hidden', 'true');
          const w = document.createElement('span');
          w.style.setProperty('--i', String(i++));
          w.textContent = part;
          mask.append(w);
          frag.append(mask);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    }
  };
  walk(el);
}
$$('[data-letters]').forEach(splitLetters);
$$('[data-words]').forEach(splitWords);

/* ───────── áudio generativo + estado "tocando" ───────── */
const synth = createSynth();
const playBtn = $('#play');
const playLabel = $('#play-label', playBtn);
let titleTimer = 0;
const FRAMES = ['▁▂▃', '▂▃▅', '▃▅▇', '▅▇▅', '▇▅▃', '▅▃▂'];

async function setPlaying(on) {
  if (on) await synth.start();
  else synth.stop();
  const now = synth.on;
  document.body.classList.toggle('is-playing', now);
  playBtn.setAttribute('aria-pressed', String(now));
  playLabel.textContent = now ? 'Pausar' : 'Dar play';
  clearInterval(titleTimer);
  if (now) {
    let k = 0;
    titleTimer = setInterval(() => (document.title = `${FRAMES[k++ % FRAMES.length]} InSound`), 260);
  } else document.title = ORIGINAL_TITLE;
}
playBtn.addEventListener('click', () => setPlaying(!synth.on));
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (e.target.closest?.('a, button, input, textarea, [contenteditable]')) return;
  e.preventDefault();
  setPlaying(!synth.on);
});

/* ───────── palco principal ───────── */
const stage = createStage({
  root: $('#stage'),
  canvas: $('#stage-canvas'),
  chapters: $$('.chapter'),
  reduced,
  getAudio: () => synth,
});
if (reduced) $('#stage').classList.add('is-static');
stage.start();

/* ───────── intro: a logo "acende" e se dissolve na logo do palco ───────── */
const intro = $('#intro');
function endIntro() {
  intro.classList.add('intro-out');
  document.body.classList.add('ready');
  setTimeout(() => intro.remove(), 1400);
}
if (reduced) {
  intro.remove();
  document.body.classList.add('ready');
} else setTimeout(endIntro, 1700);

/* ───────── cursor em forma de equalizador ───────── */
if (finePointer && !reduced) {
  const cur = document.createElement('div');
  cur.className = 'cursor';
  cur.innerHTML = '<i></i><i></i><i></i>';
  document.body.append(cur);
  document.body.classList.add('has-cursor');
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    cur.classList.add('on');
    cur.classList.toggle('is-link', !!e.target.closest('a, button, [data-hover], .card'));
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('on'));
  (function loop() {
    x = lerp(x, tx, 0.22); y = lerp(y, ty, 0.22);
    cur.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

/* ───────── peso da fonte "ondula" com o ponteiro (Inter é variável) ───────── */
(function weightWave() {
  const title = $('.hero-title');
  if (!title) return;
  const letters = $$('.lt', title);
  const chapter = title.closest('.chapter');
  let px = -9999, py = -9999, seen = 0;
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; seen = performance.now(); });
  function tick(t) {
    if (!document.hidden && parseFloat(chapter.style.opacity || '1') > 0.04) {
      const rects = letters.map((l) => l.getBoundingClientRect()); // leituras primeiro…
      const near = performance.now() - seen < 3000;
      const beat = synth.beat();
      letters.forEach((l, i) => { // …depois as escritas
        let w = 300 + 140 * (0.5 + 0.5 * Math.sin(t * 0.0013 - i * 0.55));
        if (near) {
          const r = rects[i];
          const dx = r.left + r.width / 2 - px, dy = r.top + r.height / 2 - py;
          w += 460 * Math.exp(-(dx * dx + dy * dy) / (2 * 120 * 120));
        }
        w += beat * 260 * (0.4 + 0.6 * Math.sin(i));
        l.style.fontWeight = String(Math.round(clamp(w, 100, 900)));
      });
    }
    if (!reduced) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* ───────── revelar ao rolar ───────── */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
  { threshold: 0.18, rootMargin: '0px 0px -6% 0px' },
);
$$('.reveal, [data-words]').forEach((el) => io.observe(el));

/* ───────── faixas de texto que reagem à velocidade do scroll ───────── */
let lastY = scrollY, vel = 0;
const marquees = $$('.marquee').map((m) => {
  const track = m.firstElementChild;
  track.innerHTML += track.innerHTML; // duplica para o laço contínuo
  return { track, dir: Number(m.dataset.dir) || 1, pos: 0 };
});
(function marqueeLoop() {
  vel = lerp(vel, scrollY - lastY, 0.18);
  lastY = scrollY;
  for (const m of marquees) {
    const half = m.track.children[m.track.children.length / 2]?.offsetLeft || 0; // período exato (inclui o gap)
    if (!half) continue;
    m.pos += m.dir * (reduced ? 0 : 0.55 + Math.abs(vel) * 0.35);
    const shift = ((m.pos % half) + half) % half;
    m.track.style.transform = `translate3d(${-shift}px,0,0) skewX(${clamp(-vel * 0.3, -9, 9)}deg)`;
  }
  requestAnimationFrame(marqueeLoop);
})();

/* ───────── celular de demonstração ───────── */
(function phone() {
  const wrap = $('#phone-wrap');
  if (!wrap) return;
  const ph = $('#phone');
  const cv = $('#ph-wave');
  const c = cv.getContext('2d');
  const tCur = $('#ph-cur'), tLeft = $('#ph-left');
  const TOTAL = 239; // 3:59
  const bars = 46;
  const lv = new Float32Array(N);
  let w = 0, h = 0, dpr = 1, inView = false;
  new IntersectionObserver((e) => (inView = e[0].isIntersecting), { threshold: 0.05 }).observe(wrap);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const env = Array.from({ length: bars }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11 + 1)) );
  const resize = () => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height;
    cv.width = w * dpr; cv.height = h * dpr;
  };
  new ResizeObserver(resize).observe(cv);

  let lastSec = -1;
  function draw(t) {
    if (inView && w) {
      const prog = reduced ? 0.42 : ((t % 26000) / 26000);
      const have = synth.levels(lv);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const step = w / bars, bw = Math.max(2, step * 0.56);
      for (let i = 0; i < bars; i++) {
        const near = Math.abs(i / bars - prog) < 0.08;
        const live = have ? lv[Math.floor((i / bars) * N)] * 1.1 : 0.5 + 0.5 * Math.sin(t * 0.004 + i);
        const hh = Math.max(bw, h * 0.86 * env[i] * (0.82 + 0.2 * live * (near ? 1.6 : 0.6)));
        c.globalAlpha = i / bars <= prog ? 1 : 0.24;
        c.fillStyle = '#f4f4f4';
        c.beginPath();
        c.roundRect ? c.roundRect(i * step + (step - bw) / 2, (h - hh) / 2, bw, hh, bw / 2) : c.rect(i * step, (h - hh) / 2, bw, hh);
        c.fill();
      }
      const sec = Math.floor(prog * TOTAL);
      if (sec !== lastSec) { lastSec = sec; tCur.textContent = fmt(sec); tLeft.textContent = '-' + fmt(TOTAL - sec); }
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // inclinação 3D com o ponteiro + giro conforme entra na tela
  let tiltX = 0, tiltY = 0;
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    tiltY = ((e.clientX - r.left) / r.width - 0.5) * 22;
    tiltX = -((e.clientY - r.top) / r.height - 0.5) * 16;
  });
  wrap.addEventListener('pointerleave', () => (tiltX = tiltY = 0));
  let cx = 0, cy = 0, cs = 0;
  (function tilt() {
    const r = wrap.getBoundingClientRect();
    const p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
    const targetS = reduced ? 0 : (0.5 - p) * 60;
    cx = lerp(cx, tiltX, 0.1); cy = lerp(cy, tiltY, 0.1); cs = lerp(cs, targetS, 0.08);
    ph.style.transform = `rotateX(${cx.toFixed(2)}deg) rotateY(${(cy + cs).toFixed(2)}deg)`;
    if (!reduced) requestAnimationFrame(tilt);
  })();

  // lista de recursos controla o que o celular mostra
  const demos = ['wave', 'cover', 'pill', 'glow'];
  const setDemo = (d) => demos.forEach((k) => ph.classList.toggle('demo-' + k, k === d));
  const items = $$('[data-demo]');
  let hovering = false, k = 0;
  items.forEach((li) => {
    const on = () => { hovering = true; setDemo(li.dataset.demo); items.forEach((x) => x.classList.toggle('is-on', x === li)); };
    li.addEventListener('pointerenter', on);
    li.addEventListener('focusin', on);
    li.addEventListener('pointerleave', () => (hovering = false));
  });
  if (!reduced) setInterval(() => {
    if (hovering || !inView) return;
    const d = demos[k++ % demos.length];
    setDemo(d);
    items.forEach((x) => x.classList.toggle('is-on', x.dataset.demo === d));
  }, 3800);
})();

/* ───────── cartões com holofote ───────── */
$$('[data-spot]').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ───────── botões magnéticos ───────── */
if (finePointer && !reduced) {
  const mags = $$('.mag');
  addEventListener('pointermove', (e) => {
    for (const m of mags) {
      const r = m.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < Math.max(r.width, 120);
      m.style.transform = near ? `translate(${dx * 0.22}px, ${dy * 0.3}px)` : '';
    }
  });
}

/* ───────── barra de navegação e linha do roadmap ───────── */
const nav = $('#nav');
const road = $('.road');
function onScroll() {
  nav.classList.toggle('scrolled', scrollY > 40);
  if (road) {
    const r = road.getBoundingClientRect();
    road.style.setProperty('--p', clamp((innerHeight * 0.65 - r.top) / r.height, 0, 1).toFixed(3));
  }
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* clique na marca: a logo "toca" */
$('.brand')?.addEventListener('click', () => stage.kick());

/* rodapé: letras sobem em onda quando entram na tela */
$$('.foot-wm').forEach((el) => splitLetters(el));
