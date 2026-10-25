import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createAmbience } from './audio.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = navigator.connection && navigator.connection.saveData;
const mobileQuery = window.matchMedia('(max-width: 860px)');
const isMobile = () => mobileQuery.matches;

const VARIANTS = [
  { name: 'Polar White', accent: '#e6ecef', ink: '#07080a', img: 'v0', line: 'Bright white resin and a red crown. Easy to find in snow, in fog, at the bottom of a bag.' },
  { name: 'Midnight Gold', accent: '#d9b86a', ink: '#130f07', img: 'v1', line: 'Gold-tone bezel over a black carbon strap. The one on the poster.' },
  { name: 'Field Green', accent: '#9fd8b8', ink: '#08140d', img: 'v2', line: 'Muted sage that disappears into the treeline until you need it.' },
  { name: 'Signal Red', accent: '#ff7a63', ink: '#180906', img: 'v3', line: 'Rescue red, made to be seen from a helicopter.' }
];

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

const use3D = !reduceMotion && !saveData && hasWebGL();
root.classList.add(use3D ? 'wants-3d' : 'no-3d');

function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(' '));
      return;
    }
    const word = document.createElement('span');
    word.className = 'split-word';
    [...part].forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'split-char';
      c.textContent = ch;
      word.appendChild(c);
      chars.push(c);
    });
    el.appendChild(word);
  });
  return chars;
}

function pad(n, l = 2) {
  return String(n).padStart(l, '0');
}

function startClocks() {
  const started = performance.now();
  const timecode = document.querySelector('[data-timecode]');
  const stopwatch = document.querySelector('[data-stopwatch]');
  const local = document.querySelector('[data-local-time]');
  const cities = [...document.querySelectorAll('[data-city-time]')].map((el) => ({
    el,
    label: el.textContent.split(' ')[0],
    fmt: new Intl.DateTimeFormat('en-GB', { timeZone: el.dataset.cityTime, hour: '2-digit', minute: '2-digit' })
  }));
  const localFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  let lastMinute = -1;
  function frame() {
    const ms = performance.now() - started;
    const total = Math.floor(ms / 1000);
    const f = Math.floor((ms % 1000) / (1000 / 24));
    if (timecode) timecode.textContent = `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}:${pad(f)}`;
    if (stopwatch) stopwatch.textContent = `${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}.${Math.floor((ms % 1000) / 100)}`;
    const now = new Date();
    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      cities.forEach((c) => { c.el.textContent = `${c.label} ${c.fmt.format(now)}`; });
      if (local) {
        local.textContent = localFmt.format(now);
        local.setAttribute('datetime', now.toISOString());
      }
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  frame();
  if (reduceMotion) setInterval(frame, 1000);
}

function initHeader() {
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  const links = [...document.querySelectorAll('.nav a')];
  links.forEach((a) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 55%',
      end: 'bottom 45%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive)
    });
  });
}

function initSmoothScroll() {
  if (reduceMotion) return null;
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = id.length > 1 ? document.querySelector(id) : null;
      if (!el && id !== '#top') return;
      e.preventDefault();
      lenis.scrollTo(el || 0, { offset: 0, duration: 1.6 });
      const focusTarget = id === '#main' ? document.querySelector('main') : el;
      if (focusTarget) {
        focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      }
    });
  });
  return lenis;
}

function initReveals() {
  if (reduceMotion) return;
  document.querySelectorAll('.chapter-title, .fin-title').forEach((el) => {
    gsap.from(el, {
      yPercent: 30,
      opacity: 0,
      filter: 'blur(10px)',
      duration: 1.4,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });
  document.querySelectorAll('.eyebrow, .chapter-sub, .cast-line, .fin-date, .night-time').forEach((el) => {
    gsap.from(el, { y: 18, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
  gsap.from('.modes li', { y: 14, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.modes', start: 'top 85%', once: true } });
  gsap.from('.cast-list button', { x: -24, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.cast-list', start: 'top 85%', once: true } });
  gsap.utils.toArray('.specs div').forEach((row) => {
    gsap.fromTo(row, { y: 40, opacity: 0 }, {
      y: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 96%', end: 'top 72%', scrub: true }
    });
  });
  gsap.from('.reserve', { y: 24, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.reserve', start: 'top 92%', once: true } });
}

function introTimeline() {
  if (reduceMotion) {
    document.querySelectorAll('.shutter').forEach((el) => { el.style.display = 'none'; });
  }
  const back = document.querySelector('.hero-line-back');
  const front = document.querySelector('.hero-line-front [data-split]');
  if (reduceMotion) return;
  const chars = [...splitChars(back), ...splitChars(front)];
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.shutter-top', { yPercent: -100, duration: 1.8, ease: 'expo.inOut' }, 0)
    .to('.shutter-bottom', { yPercent: 100, duration: 1.8, ease: 'expo.inOut' }, 0)
    .set('.shutter', { display: 'none' })
    .from(chars, { yPercent: 110, opacity: 0, duration: 1.4, stagger: 0.035 }, 0.9)
    .from('.subtitle', { opacity: 0, y: 10, duration: 1.2 }, 1.6)
    .from('.readout > div', { opacity: 0, y: 8, duration: 0.9, stagger: 0.08 }, 1.8)
    .from('.site-header', { opacity: 0, y: -12, duration: 1 }, 1.4);
  return tl;
}

function initCast(getScene) {
  const group = document.querySelector('[data-cast]');
  const buttons = [...group.querySelectorAll('[role="radio"]')];
  const line = document.querySelector('[data-cast-line]');
  const picture = document.querySelector('[data-cast-picture]');
  let current = 1;

  function select(i, focus) {
    if (i === current) return;
    current = i;
    const v = VARIANTS[i];
    buttons.forEach((b, j) => {
      b.setAttribute('aria-checked', String(j === i));
      b.tabIndex = j === i ? 0 : -1;
    });
    if (focus) buttons[i].focus();
    root.style.setProperty('--accent', v.accent);
    root.style.setProperty('--accent-ink', v.ink);
    line.textContent = v.line;
    const src = picture.querySelector('source');
    const img = picture.querySelector('img');
    src.srcset = `img/${v.img}-480.avif 480w, img/${v.img}-860.avif 860w`;
    img.srcset = `img/${v.img}-480.webp 480w, img/${v.img}-860.webp 860w`;
    img.src = `img/${v.img}-860.webp`;
    img.alt = `STRATA S-01 in ${v.name}`;
    const scene = getScene();
    if (scene) {
      if (reduceMotion) {
        scene.setVariant(i);
      } else {
        gsap.killTweensOf(scene.fx);
        const tl = gsap.timeline();
        tl.to(scene.fx, { spin: Math.PI, duration: 0.55, ease: 'power2.in', onComplete: () => scene.setVariant(i) })
          .set(scene.fx, { flash: 1 })
          .to(scene.fx, { spin: Math.PI * 2, duration: 0.9, ease: 'power3.out' })
          .to(scene.fx, { flash: 0, duration: 0.9, ease: 'power2.out' }, '<')
          .set(scene.fx, { spin: 0 });
      }
    }
  }

  buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
  group.addEventListener('keydown', (e) => {
    const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in map) {
      e.preventDefault();
      select((current + map[e.key] + buttons.length) % buttons.length, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(0, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      select(buttons.length - 1, true);
    }
  });
}

function initForm() {
  const form = document.querySelector('[data-reserve]');
  const input = form.querySelector('input');
  const msg = form.querySelector('[data-reserve-msg]');
  const base = msg.textContent;
  const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && valid(input.value.trim())) {
      input.removeAttribute('aria-invalid');
      msg.className = 'reserve-msg';
      msg.textContent = base;
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!valid(v)) {
      input.setAttribute('aria-invalid', 'true');
      msg.className = 'reserve-msg is-error';
      msg.textContent = v ? 'That email looks incomplete. Check the part after the @.' : 'Enter your email to reserve a watch.';
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    msg.className = 'reserve-msg is-ok';
    msg.textContent = `Reserved for ${v}. This is a concept site, so no email was sent.`;
    form.reset();
  });
}

function initSound() {
  const btn = document.querySelector('[data-sound]');
  const amb = createAmbience();
  btn.addEventListener('click', async () => {
    const on = await amb.toggle();
    btn.setAttribute('aria-pressed', String(on));
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? amb.suspend() : amb.resume()));
  return amb;
}

function initAnatomyUI(progress) {
  const layers = [...document.querySelectorAll('[data-layer]')];
  const bar = document.querySelector('[data-anatomy-progress]');
  let lastActive = -2;
  return () => {
    const p = progress();
    bar.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
    let active = -1;
    if (p > 0.1 && p < 0.92) active = Math.min(3, Math.floor((p - 0.1) / 0.18));
    if (active === lastActive) return;
    lastActive = active;
    layers.forEach((l) => {
      const i = Number(l.dataset.layer);
      const mobileOne = window.innerWidth <= 560;
      l.classList.toggle('is-on', mobileOne ? i === Math.max(active, 0) : i <= active);
    });
  };
}

function initLoader() {
  const el = document.querySelector('[data-loader]');
  const count = document.querySelector('[data-loader-count]');
  const bar = document.querySelector('[data-loader-bar]');
  let shown = 0;
  return {
    progress(p) {
      shown = Math.max(shown, p);
      count.textContent = pad(Math.round(shown * 99));
      bar.style.transform = `scaleX(${shown})`;
    },
    done() {
      this.progress(1);
      el.classList.add('is-done');
    }
  };
}

async function boot() {
  startClocks();
  initForm();
  const loader = initLoader();
  const lenis = initSmoothScroll();
  initHeader();

  let scene = null;
  const amb = initSound();
  initCast(() => scene);

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  let fakeP = 0;
  const fake = setInterval(() => {
    fakeP = Math.min(0.7, fakeP + 0.04);
    loader.progress(fakeP * (use3D ? 0.25 : 1));
  }, 80);

  function attach3D(s, delay) {
    scene = s;
    document.querySelectorAll('.fallback img[loading="lazy"]').forEach((img) => {
      if (img.complete) return;
      img.closest('picture').querySelectorAll('source').forEach((src) => src.removeAttribute('srcset'));
      img.removeAttribute('srcset');
      img.removeAttribute('src');
    });
    import('./story.js').then(({ createStory }) => {
      const story = createStory(scene, { mobile: isMobile() });
      story.build();
      story.update();
      scene.snap();
      scene.start();
      root.classList.add('has-3d');
      root.classList.remove('no-3d', 'wants-3d');
      document.querySelector('[data-stage]').classList.add('is-ready');
      gsap.to(scene.fx, { intro: 1, duration: 2.6, delay, ease: 'power3.out' });
      const anatomyUI = initAnatomyUI(story.anatomyProgress);
      const onScroll = () => {
        const st = story.update();
        anatomyUI();
        if (st) amb.setLevel(st.rain);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      ScrollTrigger.addEventListener('refresh', () => {
        story.build();
        onScroll();
      });
      let resizeTimer = 0;
      const rebuild = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          story.build();
          onScroll();
          ScrollTrigger.refresh();
        }, 150);
      };
      window.addEventListener('resize', rebuild);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', rebuild);
      if (window.matchMedia('(pointer: fine)').matches) {
        window.addEventListener('pointermove', (e) => {
          scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
        }, { passive: true });
      }
      onScroll();
      window.__strata = { scene, story };
      root.dispatchEvent(new CustomEvent('strata:3d'));
    });
  }

  function fallback() {
    root.classList.remove('wants-3d', 'has-3d');
    root.classList.add('no-3d');
  }

  let load = null;
  if (use3D) {
    const mobile = isMobile();
    const idle = new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 900 }) : setTimeout(r, 200)));
    load = idle.then(() => import('./scene.js'))
      .then(({ createScene }) => createScene({
        canvas: document.querySelector('[data-stage]'),
        mobile,
        modelUrl: mobile ? 'models/strata-sd.glb' : 'models/strata-hd.glb',
        onProgress: (p) => loader.progress(0.25 + p * 0.75)
      }))
      .catch((err) => {
        console.warn('3D scene unavailable, showing still frames instead.', err);
        return null;
      });
    scene = await Promise.race([load, timeout(2600).then(() => null)]);
  }

  await fontsReady;
  clearInterval(fake);
  loader.done();
  introTimeline();
  initReveals();

  if (scene) {
    attach3D(scene, 0.6);
  } else if (load) {
    fallback();
    load.then((late) => { if (late) attach3D(late, 0); });
  } else {
    fallback();
  }

  ScrollTrigger.refresh();
  root.classList.add('is-booted');
}

boot();
