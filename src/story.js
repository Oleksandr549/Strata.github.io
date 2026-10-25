const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function slotRect(name, { stickyTop = false } = {}) {
  const el = document.querySelector(`[data-slot="${name}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (stickyTop) {
    const sticky = el.closest('.sticky');
    const sr = sticky.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top - sr.top + r.height / 2, s: Math.min(r.width, r.height), top: null };
  }
  return { cx: r.left + r.width / 2, cy: r.top + window.scrollY + r.height / 2, s: Math.min(r.width, r.height), docTop: r.top + window.scrollY };
}

function docTop(el) {
  return el.getBoundingClientRect().top + window.scrollY;
}

export function createStory(scene, { mobile }) {
  let keys = [];
  let anCache = { top: 0, run: 1 };

  function build() {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const sections = Object.fromEntries([...document.querySelectorAll('[data-scene]')].map((s) => [s.dataset.scene, s]));
    const k = [];
    const at = (y, rect, viewY, extra) => k.push({ y, cx: rect.cx, cy: viewY, s: rect.s, ...extra });

    const hero = slotRect('hero');
    at(0, hero, hero.cy, { slot: 'hero', zoom: 1, rx: 0.1, ry: -0.5, rz: 0.02, explode: 0, key: 1, rim: 1, env: 1, lume: 0, rain: 1, fog: 1, dim: 1 });
    at(vh * 0.55, hero, hero.cy - vh * 0.55, { slot: 'hero', zoom: 1.04, rx: 0.16, ry: -0.2, rz: 0, explode: 0, key: 1, rim: 1, env: 1, lume: 0, rain: 0.7, fog: 0.9, dim: 1 });

    const an = sections.anatomy;
    const anTop = docTop(an);
    const anRun = Math.max(an.offsetHeight - vh, 1);
    anCache = { top: anTop, run: anRun };
    const a = slotRect('anatomy', { stickyTop: true });
    const base = { slot: 'anatomy', cx: a.cx, s: a.s, rain: 0.12, fog: 0.5, lume: 0, env: 1, dim: 1 };
    k.push({ y: anTop, ...base, cy: a.cy, zoom: 0.92, rx: 0.32, ry: -0.75, rz: 0.08, explode: 0, key: 1.1, rim: 1.2 });
    const open = mobile ? { zoom: 0.62, rx: 0.95, ry: -0.3, rz: 0.1 } : { zoom: 0.78, rx: 0.42, ry: -0.95, rz: 0.12 };
    const hold = mobile ? { zoom: 0.62, rx: 1.05, ry: -0.55, rz: 0.04 } : { zoom: 0.78, rx: 0.3, ry: -1.2, rz: 0.06 };
    k.push({ y: anTop + anRun * 0.38, ...base, cy: a.cy, ...open, explode: 1, key: 1.2, rim: 1.4 });
    k.push({ y: anTop + anRun * 0.72, ...base, cy: a.cy, ...hold, explode: 1, key: 1.15, rim: 1.4 });
    k.push({ y: anTop + anRun, ...base, cy: a.cy, zoom: 0.92, rx: 0.12, ry: -0.35, rz: 0, explode: 0, key: 1, rim: 1.1 });

    const ni = sections.night;
    const niTop = docTop(ni);
    const night = slotRect('night');
    const niState = mobile
      ? { slot: 'night', cx: night.cx, s: night.s, zoom: 1.4, rx: 0.05, ry: -0.18, rz: 0, explode: 0, key: 0.35, rim: 1.6, env: 0.5, lume: 1, rain: 0.45, fog: 0.7, dim: 0.7 }
      : { cx: vw * 0.74, s: vh * 0.9, zoom: 2.1, rx: 0.06, ry: -0.22, rz: -0.04, explode: 0, key: 0.35, rim: 1.6, env: 0.5, lume: 1, rain: 0.45, fog: 0.7, dim: 0.7 };
    const niA = mobile ? night.docTop - 60 : niTop + (ni.offsetHeight - vh) * 0.1;
    const niB = mobile ? night.docTop + night.s * 0.5 : niTop + (ni.offsetHeight - vh) * 0.9;
    k.push({ y: niA, ...niState, cy: mobile ? night.cy - niA : vh * 0.5 });
    k.push({ y: niB, ...niState, cy: mobile ? night.cy - niB : vh * 0.5, ry: niState.ry + 0.12 });

    const ca = slotRect('cast');
    const caMid = ca.docTop + (ca.cy - ca.docTop) - vh * 0.5;
    const caState = { slot: 'cast', cx: ca.cx, s: ca.s, zoom: 1, rx: 0.1, ry: -0.42, rz: 0.02, explode: 0, key: 1.1, rim: 1.1, env: 1.1, lume: 0, rain: 0.15, fog: 0.6, dim: 1 };
    k.push({ y: caMid - vh * 0.18, ...caState, cy: vh * 0.5 + vh * 0.18 });
    k.push({ y: caMid + vh * 0.18, ...caState, cy: vh * 0.5 - vh * 0.18, ry: -0.3 });

    const cr = slotRect('credits');
    const crMid = cr.cy - vh * 0.5;
    const crState = { slot: 'credits', cx: cr.cx, s: cr.s, zoom: 1, rx: 0.04, explode: 0, key: mobile ? 0.3 : 0.55, rim: 1.3, env: mobile ? 0.4 : 0.7, lume: 0.35, rain: 0, fog: 0.4, dim: mobile ? 0.4 : 0.65 };
    k.push({ y: crMid - vh * 0.35, ...crState, cy: vh * 0.5 + vh * 0.35, ry: 1.05, rz: 0 });
    k.push({ y: crMid + vh * 0.35, ...crState, cy: vh * 0.5 - vh * 0.35, ry: 1.9, rz: 0 });

    const fi = slotRect('fin');
    const maxY = Math.max(document.documentElement.scrollHeight - vh, 0);
    const fiState = { slot: 'fin', cx: fi.cx, s: fi.s, zoom: 1, rx: 0.08, ry: -0.3, rz: 0, explode: 0, key: 1, rim: 1, env: 1, lume: 0, rain: 0.8, fog: 0.9, dim: 0.9 };
    const fiY = Math.max(Math.min(fi.cy - vh * 0.42, maxY), crMid + vh * 0.36);
    k.push({ y: fiY, ...fiState, cy: fi.cy - fiY });
    if (maxY > fiY + 1) k.push({ y: maxY, ...fiState, cy: fi.cy - maxY, ry: -0.18 });
    k.sort((p, q) => p.y - q.y);
    keys = k;
  }

  const slotEls = {};
  function live(name, cache) {
    if (cache[name]) return cache[name];
    const el = slotEls[name] || (slotEls[name] = document.querySelector(`[data-slot="${name}"]`));
    const r = el.getBoundingClientRect();
    return (cache[name] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, s: Math.min(r.width, r.height) });
  }

  function resolve(k, cache) {
    if (!k.slot) return k;
    return { ...k, ...live(k.slot, cache) };
  }

  function sample(y) {
    if (!keys.length) return null;
    const cache = {};
    if (y <= keys[0].y) return resolve(keys[0], cache);
    const lastKey = keys[keys.length - 1];
    if (y >= lastKey.y) return resolve(lastKey, cache);
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].y < y) i++;
    const p = resolve(keys[i], cache), q = resolve(keys[i + 1], cache);
    const t = smooth(clamp((y - p.y) / Math.max(q.y - p.y, 1), 0, 1));
    const out = {};
    for (const key in q) {
      if (key === 'y' || key === 'slot') continue;
      out[key] = p[key] + (q[key] - p[key]) * t;
    }
    return out;
  }

  function update(y = window.scrollY) {
    const s = sample(y);
    if (s) scene.setTarget(s);
    return s;
  }

  function anatomyProgress(y = window.scrollY) {
    return clamp((y - anCache.top) / anCache.run, 0, 1);
  }

  return { build, update, anatomyProgress, get keys() { return keys; } };
}
