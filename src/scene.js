import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const EXPLODE = {
  Band_Carbon_Fiber: -1.05,
  Band_Plastic: -1.05,
  Clasp: -1.05,
  Backplate: -0.75,
  Watch_Face: 0,
  Hands: 0.55,
  Glass_Face: 1.05,
  Bezel_Frame: 1.7,
  Button_Metal: 1.7,
  Button_Plastic: 1.7
};

const NUMERIC = ['cx', 'cy', 's', 'zoom', 'rx', 'ry', 'rz', 'explode', 'key', 'rim', 'env', 'lume', 'rain', 'fog', 'dim'];

export const DEFAULT_STATE = { cx: 0, cy: 0, s: 400, zoom: 1, rx: 0.12, ry: -0.5, rz: 0, explode: 0, key: 1, rim: 1, env: 1, lume: 0, rain: 1, fog: 1, dim: 1 };

function damp(a, b, lambda, dt) {
  return a + (b - a) * (1 - Math.exp(-lambda * dt));
}

function fogTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 30 + rnd() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${0.05 + rnd() * 0.1})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      g.save();
      g.translate(ox, oy);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createRain(count) {
  const pos = new Float32Array(count * 2 * 3);
  const end = new Float32Array(count * 2);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 22;
    const y = Math.random() * 16;
    const z = 2 + Math.random() * 15;
    const s = Math.random();
    for (let k = 0; k < 2; k++) {
      const j = i * 2 + k;
      pos[j * 3] = x;
      pos[j * 3 + 1] = y;
      pos[j * 3 + 2] = z;
      end[j] = k;
      seed[j] = s;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uWind: { value: -0.16 } },
    vertexShader: `
      attribute float aEnd;
      attribute float aSeed;
      uniform float uTime;
      uniform float uWind;
      varying float vEnd;
      varying float vDepth;
      void main() {
        vec3 p = position;
        float speed = 14.0 + aSeed * 10.0;
        float len = 0.35 + aSeed * 0.55;
        p.y = mod(p.y - uTime * speed, 16.0) - 8.0;
        p.x += p.y * uWind;
        p.y += aEnd * len;
        p.x += aEnd * len * uWind;
        vEnd = aEnd;
        vDepth = smoothstep(2.0, 17.0, position.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uIntensity;
      varying float vEnd;
      varying float vDepth;
      void main() {
        float a = mix(0.0, 0.55, vEnd) * (0.25 + 0.75 * vDepth) * uIntensity;
        gl_FragColor = vec4(vec3(0.74, 0.82, 0.92) * a, a);
      }`
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 10;
  return lines;
}

export async function createScene({ canvas, mobile, modelUrl, onProgress }) {
  const dprCap = mobile ? 1.5 : 1.75;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const D = 22;
  camera.position.set(0, 0, D);

  const warm = new THREE.SpotLight(0xffd9a0, 600, 0, 0.42, 0.6, 2);
  warm.position.set(-6, 7, 6);
  const rim = new THREE.SpotLight(0x8fb8ff, 900, 0, 0.5, 0.5, 2);
  rim.position.set(7, 3, -6);
  const rim2 = new THREE.SpotLight(0xbcd4ff, 140, 0, 0.5, 0.6, 2);
  rim2.position.set(-7, -2, -5);
  const pivot = new THREE.Group();
  scene.add(warm, warm.target, rim, rim.target, rim2, rim2.target, pivot);

  const fogTex = fogTexture();
  const fogs = [0, 1].map((i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 28),
      new THREE.MeshBasicMaterial({ map: fogTex.clone(), color: i ? 0x6f8aa8 : 0x4a5d73, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.material.map.needsUpdate = true;
    m.material.map.repeat.set(1.4 + i * 0.6, 1.1 + i * 0.4);
    m.position.set(0, 0, -8 + i * 3);
    m.renderOrder = -1;
    scene.add(m);
    return m;
  });

  const rain = createRain(mobile ? 650 : 1500);
  scene.add(rain);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl, (e) => {
    if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
  });
  const root = gltf.scene;

  const face = root.getObjectByName('Watch_Face');
  root.updateMatrixWorld(true);
  const faceBox = new THREE.Box3().setFromObject(face);
  const center = faceBox.getCenter(new THREE.Vector3());
  root.position.sub(center);
  pivot.add(root);
  root.updateMatrixWorld(true);
  const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
  const R = sphere.radius * 0.78;

  const glass = root.getObjectByName('Glass_Face');
  if (glass) {
    glass.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4, depthWrite: false });
    glass.renderOrder = 2;
  }

  const parts = Object.entries(EXPLODE).map(([name, w]) => {
    const o = root.getObjectByName(name);
    return o ? { o, w, base: o.position.clone() } : null;
  }).filter(Boolean);

  const hands = {
    h: root.getObjectByName('Hand_Hours'),
    m: root.getObjectByName('Hand_Minutes'),
    s: root.getObjectByName('Hand_Seconds')
  };

  const variantDefs = gltf.parser.json.extensions?.KHR_materials_variants?.variants || [];
  const variantMeshes = [];
  const jobs = [];
  root.traverse((o) => {
    const ext = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants;
    if (!ext) return;
    const entry = { mesh: o, mats: [] };
    ext.mappings.forEach((map) => {
      jobs.push(gltf.parser.getDependency('material', map.material).then((mat) => {
        map.variants.forEach((v) => { entry.mats[v] = mat; });
      }));
    });
    variantMeshes.push(entry);
  });
  await Promise.all(jobs);
  variantMeshes.forEach((e) => {
    e.mats.forEach((m) => {
      if (!m) return;
      if (/Hand Color/i.test(m.name)) {
        m.emissive = new THREE.Color(m.color);
        m.emissiveIntensity = 0;
        m.userData.lume = true;
      }
    });
  });

  let variant = 1;
  function applyVariant(i) {
    variant = i;
    variantMeshes.forEach((e) => {
      const m = e.mats[i];
      if (m) e.mesh.material = m;
    });
  }
  applyVariant(1);

  for (let i = 0; i < variantDefs.length; i++) {
    applyVariant(i);
    await renderer.compileAsync(scene, camera);
  }
  applyVariant(1);

  const target = { ...DEFAULT_STATE };
  const cur = { ...DEFAULT_STATE };
  const fx = { intro: 0, spin: 0, flash: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let width = 1, height = 1;
  let first = true;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();

  const halfH = () => D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  let frames = 0, slowFrames = 0, degraded = 0;
  let last = performance.now();
  let running = false;
  let time = 0;

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;

    if (first) {
      NUMERIC.forEach((k) => { cur[k] = target[k]; });
      first = false;
    } else {
      NUMERIC.forEach((k) => { cur[k] = damp(cur[k], target[k], k === 'explode' ? 4.5 : 5, dt); });
    }
    pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 3, dt);

    const hh = halfH();
    const hw = hh * camera.aspect;
    const ndcX = (cur.cx / width) * 2 - 1;
    const ndcY = -((cur.cy / height) * 2 - 1);
    const worldR = (cur.s / height) * hh;
    const scale = (worldR / R) * cur.zoom;
    const rise = (1 - fx.intro) * 2.2;
    pivot.position.set(ndcX * hw, ndcY * hh - rise, 0);
    pivot.scale.setScalar(scale * (0.92 + 0.08 * fx.intro));
    pivot.rotation.set(
      cur.rx + pointer.sy * 0.12 + Math.sin(time * 0.35) * 0.02,
      cur.ry + pointer.sx * 0.18 + fx.spin + Math.sin(time * 0.22) * 0.04,
      cur.rz
    );

    const e = cur.explode;
    const span = 1.9;
    for (const p of parts) {
      p.o.position.copy(p.base);
      p.o.position.z += p.w * e * span;
    }

    const date = new Date();
    const s = date.getSeconds() + date.getMilliseconds() / 1000;
    const m = date.getMinutes() + s / 60;
    const h = (date.getHours() % 12) + m / 60;
    if (hands.h) hands.h.rotation.y = h * (Math.PI / 6);
    if (hands.m) hands.m.rotation.y = m * (Math.PI / 30);
    if (hands.s) hands.s.rotation.y = Math.floor(s) * (Math.PI / 30);

    const intro = fx.intro;
    warm.intensity = 600 * cur.key * intro * cur.dim * (1 + fx.flash * 0.8);
    rim.intensity = 900 * cur.rim * (0.4 + 0.6 * intro) * (1 + fx.flash * 1.5);
    rim2.intensity = 140 * cur.rim * intro;
    scene.environmentIntensity = 0.12 * cur.env * cur.dim * (0.3 + 0.7 * intro);
    const lume = cur.lume;
    variantMeshes.forEach((v) => {
      const mm = v.mesh.material;
      if (mm && mm.userData.lume) mm.emissiveIntensity = lume * 2.2;
    });

    rain.material.uniforms.uTime.value = time;
    rain.material.uniforms.uIntensity.value = cur.rain;
    rain.visible = cur.rain > 0.01;
    fogs.forEach((f, i) => {
      f.material.opacity = cur.fog * (i ? 0.32 : 0.5);
      f.material.map.offset.x = time * (0.006 + i * 0.004);
      f.material.map.offset.y = Math.sin(time * 0.05 + i) * 0.04;
    });

    renderer.render(scene, camera);

    frames++;
    if (dt > 0.034) slowFrames++;
    if (frames === 120) {
      if (slowFrames > 70 && degraded < 2) {
        degraded++;
        if (degraded === 1) renderer.setPixelRatio(1);
        if (degraded === 2) rain.geometry.setDrawRange(0, rain.geometry.attributes.position.count / 2);
        resize();
      }
      frames = 0;
      slowFrames = 0;
    }
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(tick);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', resize, { passive: true });

  return {
    fx,
    variants: variantDefs.map((v) => v.name),
    setTarget(state) { Object.assign(target, state); },
    snap() { first = true; },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setVariant(i, done) {
      if (i === variant) return;
      applyVariant(i);
      if (done) done();
    },
    get variant() { return variant; },
    get state() { return cur; },
    start,
    stop,
    resize,
    renderOnce() { tick(); }
  };
}
