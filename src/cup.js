// The First Pour: source for js/cup.js. After editing, rebuild from the project folder with:
//   npx esbuild@0.27.0 src/cup.js --bundle --minify --format=esm --target=es2022 --alias:three=./vendor/three.module.js --outfile=js/cup.js --legal-comments=none
/* ---------- The First Pour: a 3D espresso is poured, then settles into its place in the hero ---------- */
import * as THREE from "three";
import { RoomEnvironment } from "../vendor/environments/RoomEnvironment.js";

const body = document.body, hero = document.querySelector(".hero"), spot = document.querySelector(".cup-spot");
const canvas = document.getElementById("cup"), skipBtn = document.querySelector(".skip");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(1, Math.max(0, t));
const ease = t => (t = clamp01(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  body.className = "ready";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 300);

// warm window light from the left, a rim from behind to lift the cup off the dark page
const key = new THREE.DirectionalLight("#FFE4C2", 3.6);
key.position.set(-14, 18, 8);
key.castShadow = true;
key.shadow.mapSize.setScalar(innerWidth < 900 ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
key.shadow.radius = 5; key.shadow.blurSamples = 20; key.shadow.bias = -0.0004;
scene.add(key);
const fill = new THREE.DirectionalLight("#F3E6FF", 0.3); fill.position.set(12, 6, 10); scene.add(fill);
const rim = new THREE.DirectionalLight("#FFC98A", 1.6); rim.position.set(8, 10, -14); scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.55 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

// sand stoneware glaze with iron speckle, and tiger-striped crema (no latte art);
// both were generated procedurally once and saved, so phones don't spend CPU making them
const loader = new THREE.TextureLoader();
const [speckle, crema] = await Promise.all(["assets/tex/speckle.webp", "assets/tex/crema.webp"].map(u => loader.loadAsync(u)));
speckle.colorSpace = crema.colorSpace = THREE.SRGBColorSpace;
speckle.wrapS = speckle.wrapT = THREE.RepeatWrapping; speckle.repeat.set(2, 1); speckle.anisotropy = 8;
const matte = new THREE.MeshPhysicalMaterial({ map: speckle, roughness: 0.82, bumpMap: speckle, bumpScale: 0.25, sheen: 0.3, sheenColor: new THREE.Color("#fff3e2") });
const glaze = new THREE.MeshPhysicalMaterial({ color: "#D9C7AE", roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 });

// small demitasse, ~6 cm across
const P = (x, y) => new THREE.Vector2(x, y);
const outer = [P(0, 0.25), P(1.55, 0.25), P(1.62, 0.05), P(1.78, 0.0), P(1.95, 0.12), P(2.25, 0.55), P(2.62, 1.6), P(2.86, 3.0), P(2.98, 4.4), P(3.04, 5.25), P(3.0, 5.42)];
const inner = [P(2.96, 5.45), P(2.88, 5.38), P(2.80, 4.4), P(2.66, 3.0), P(2.40, 1.75), P(2.0, 0.95), P(1.3, 0.62), P(0, 0.58)];
const rimBand = new THREE.Mesh(new THREE.TorusGeometry(2.99, 0.06, 16, 128), matte);
rimBand.rotation.x = Math.PI / 2; rimBand.position.y = 5.43;
const hc = new THREE.CatmullRomCurve3([
  new THREE.Vector3(2.88, 4.35, 0), new THREE.Vector3(3.75, 4.55, 0), new THREE.Vector3(4.3, 3.8, 0),
  new THREE.Vector3(4.05, 2.55, 0), new THREE.Vector3(3.2, 1.75, 0), new THREE.Vector3(2.6, 1.7, 0)
]);
const handle = new THREE.Mesh(new THREE.TubeGeometry(hc, 64, 0.24, 20, false), matte);
handle.scale.z = 0.75;

const coffeeMat = new THREE.MeshPhysicalMaterial({ map: crema, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 });
const coffee = new THREE.Mesh(new THREE.CircleGeometry(1, 128), coffeeMat);
coffee.rotation.x = -Math.PI / 2;
// inner wall radius at height y, read off the lathe profile so the rising coffee always meets the wall
const wallAt = y => {
  for (let i = inner.length - 1; i > 0; i--) {
    const a = inner[i], b = inner[i - 1];
    if (y >= a.y && y <= b.y) return lerp(a.x, b.x, (y - a.y) / (b.y - a.y));
  }
  return 2.88;
};
const FULL = 4.55;
const setLevel = y => { coffee.position.y = y; const r = wallAt(y) - 0.03; coffee.scale.set(r, r, 1); coffee.visible = y > 0.75; };

const cup = new THREE.Group();
cup.add(new THREE.Mesh(new THREE.LatheGeometry(outer, 128), matte), new THREE.Mesh(new THREE.LatheGeometry(inner, 128), glaze), rimBand, handle, coffee);
cup.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
cup.position.y = 0.44; cup.rotation.y = -0.55;

const sp = [P(0, 0.22), P(2.6, 0.22), P(2.7, 0.05), P(2.95, 0.0), P(3.3, 0.18), P(4.9, 0.42), P(6.2, 0.78), P(6.55, 0.95), P(6.62, 1.02), P(6.5, 1.06), P(6.1, 0.95), P(4.8, 0.62), P(3.6, 0.5), P(3.3, 0.56), P(3.05, 0.48), P(0, 0.44)];
const saucer = new THREE.Mesh(new THREE.LatheGeometry(sp, 128), matte);
saucer.castShadow = saucer.receiveShadow = true;
saucer.scale.set(0.86, 1, 0.86);
scene.add(saucer, cup);

// the pour: a thin espresso stream falling into the centre of the cup
const stream = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.1, 1, 24, 1, true),
  new THREE.MeshPhysicalMaterial({ color: "#3B1F0E", roughness: 0.2, clearcoat: 1, transparent: true })
);
scene.add(stream);
const TAP = 60; // where the stream starts, above the frame

// steam: a few soft sprites drifting up, only after the pour
const puff = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,245,230,.55)"); gr.addColorStop(1, "rgba(255,245,230,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const steam = Array.from({ length: 7 }, (_, i) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 }));
  s.userData.phase = i / 7; s.userData.dx = (rand() - .5) * 1.4;
  scene.add(s); return s;
});

// camera: close on the cup for the pour, then pulled back and slid so the cup lands on .cup-spot
const DIR = new THREE.Vector3(0, 47, 62).normalize(), FAR = Math.hypot(47, 62);
let W = 1, H = 1, nearK = 1, farK = 1, from = { x: 0, y: 0 }, to = { x: 0, y: 0 };
function measure() {
  W = hero.clientWidth; H = hero.clientHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const h = hero.getBoundingClientRect(), s = spot.getBoundingClientRect();
  // perspective size follows the canvas height; scale distance so the cup keeps the same size on screen
  nearK = H / Math.min(H, innerHeight) * Math.max(1, 1000 / W); // and keep it small on narrow phones
  farK = (H / 900) * (202 / s.width); // 202 px spot on a 900 px tall hero is the approved size
  from = { x: 0, y: H / 2 - Math.min(H, innerHeight) / 2 };                               // middle of the screen
  to = { x: W / 2 - (s.left - h.left + s.width / 2), y: H / 2 - (s.top - h.top + s.height / 2) }; // the spot
}
const look = new THREE.Vector3();
function frameCamera(k) { // k: 0 = close-up pour, 1 = resting in the hero
  const e = ease(k), dist = FAR * lerp(0.85 * nearK, farK, e);
  look.set(0, lerp(3.4, 1.6, e), 0);
  camera.position.copy(DIR).multiplyScalar(dist).add(look);
  camera.lookAt(look);
  camera.setViewOffset(W, H, lerp(from.x, to.x, e), lerp(from.y, to.y, e), W, H);
}

// timeline, in seconds
const T = { pourStart: 0.5, pourEnd: 2.1, settle: 2.2, settleEnd: 3.3, reveal: 2.7 };
const END = 3.9;
// decided only now that the cup is ready: if the page was already shown (slow load, reduced motion), never replay the pour over it
const instant = body.classList.contains("ready");
if (!instant) body.classList.add("pouring");
let t0 = performance.now(), done = instant, revealed = false;
if (instant) t0 -= END * 1000;

function update(t) {
  // stream: drops in, holds, then the tail falls away
  const head = lerp(TAP, FULL, easeOut((t - T.pourStart) / 0.25));        // lowest point of the stream
  const tail = lerp(TAP, FULL, clamp01((t - T.pourEnd + 0.05) / 0.25) ** 2); // top of the stream after the tap closes
  const level = lerp(0.8, FULL, easeOut((t - T.pourStart - 0.15) / (T.pourEnd - T.pourStart)));
  setLevel(t < T.pourStart + 0.15 ? 0 : level);
  const bottom = Math.max(head, level + 0.44);
  stream.visible = t > T.pourStart && tail > bottom + 0.05;
  stream.scale.y = Math.max(0.01, tail - bottom);
  stream.position.y = (tail + bottom) / 2;
  // crema darkens while it is being poured, then blooms to its settled colour
  coffeeMat.color.setScalar(lerp(0.35, 1, easeOut((t - T.pourEnd + 0.6) / 1.4)));
  coffee.rotation.z = -1.4 * easeOut((t - T.pourStart) / 3.2);
  // steam rises once the cup is full
  const sOn = clamp01((t - T.pourEnd) / 1.2);
  steam.forEach(s => {
    const p = (t / 4.2 + s.userData.phase) % 1;
    s.position.set(s.userData.dx + Math.sin(t * 0.8 + s.userData.phase * 9) * 0.5 * p, 5.6 + p * 7.5, Math.cos(t * 0.6 + s.userData.phase * 7) * 0.3);
    s.scale.setScalar(1.6 + p * 4);
    s.material.opacity = sOn * Math.sin(p * Math.PI) * (reduced ? 0 : 0.22);
  });
  frameCamera(clamp01((t - T.settle) / (T.settleEnd - T.settle)));
  if (!revealed && t >= T.reveal) {
    revealed = true; body.classList.remove("intro"); body.classList.add("ready");
  }
}

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
new ResizeObserver(() => { measure(); if (done) { update(END + (performance.now() - t0) / 1000); renderer.render(scene, camera); } }).observe(hero);

skipBtn.addEventListener("click", () => { t0 = performance.now() - END * 1000; });
if (!instant) scrollTo(0, 0);
measure();
canvas.style.opacity = 1;

const freeze = new URLSearchParams(location.search).get("t"); // ?t=1.5 holds the intro at that second, for reviewing frames
function loop(now) {
  const t = freeze ? +freeze : (now - t0) / 1000;
  if (t > END) done = true;
  // after the intro, keep animating only the steam, and only while the hero is on screen
  if (!done || (visible && !reduced && !document.hidden)) { update(t); renderer.render(scene, camera); }
  if (!(done && reduced)) requestAnimationFrame(loop);
}
update(instant ? END : 0); renderer.render(scene, camera);
requestAnimationFrame(loop);
