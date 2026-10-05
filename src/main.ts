import './style.css';
import type { Vec3 } from './contracts';
import { Game, SPEED_UP } from './app/game';
import { COLOURS, View } from './app/view';
import { invert, transformPoint } from './math/mat4';
import { Scene, type Camera } from './render/scene';
import { Labels } from './ui/labels';
import { initWelcome } from './ui/welcome';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('stage');
const status = document.querySelector('.status') as HTMLElement, statusText = $('status-text');
const ground: Vec3 = [1, 3, 5].map((i) => parseInt(COLOURS.ground.slice(i, i + 2), 16) / 255) as Vec3;

function fail(msg: string) {
  $('fallback').hidden = false;
  $('fallback-msg').textContent = msg;
  status.classList.add('error');
  statusText.textContent = 'WebGPU · Unavailable';
  canvas.style.display = 'none';
  document.body.classList.add('no-gpu');
}

async function main() {
  let scene: Scene;
  try {
    scene = await Scene.create(canvas);
  } catch (e) {
    fail(`${(e as Error).message} Try a recent Chrome, Edge or Safari (18+), or Firefox with WebGPU enabled.`);
    return;
  }
  scene.device.lost.then((info) => fail(`The GPU device was lost (${info.message || info.reason}). Reload the page to try again.`));

  let game = new Game(Date.now() & 0xffff);
  let view = new View(game);
  let paused = true, shown = false;
  const labels = new Labels();
  const cam: Camera = { target: [-40, 0, 20], dist: 2100, yaw: 0, pitch: 1.02 };
  /** Distance the visitor has zoomed to, before the fit to the window. */
  let zoom = 1;
  $('speed').textContent = `${Math.round(SPEED_UP)}× life`;
  $('fine-speed').textContent = String(Math.round(SPEED_UP));

  // ----- controls
  const pullBtn = $('pull'), callBtn = $<HTMLButtonElement>('call');
  const setPulling = (on: boolean) => {
    game.pulling = on;
    pullBtn.classList.toggle('on', on);
    pullBtn.setAttribute('aria-pressed', String(on));
  };
  const call = () => { game.call(); };
  const restart = () => {
    game = new Game(Date.now() & 0xffff);
    view = new View(game);
    shown = false;
    paused = false;
    setPulling(false);
    $('pause').textContent = 'Pause';
  };
  const togglePause = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
  pullBtn.addEventListener('click', () => setPulling(!game.pulling));
  callBtn.addEventListener('click', call);
  $('restart').addEventListener('click', restart);
  $('pause').addEventListener('click', togglePause);
  const result = $<HTMLDialogElement>('result');
  $('result-again').addEventListener('click', () => { result.close(); restart(); });
  const welcome = initWelcome(() => { paused = false; });
  window.addEventListener('keydown', (e) => {
    if (welcome.open || result.open || e.metaKey || e.ctrlKey) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setPulling(!game.pulling); }
    else if (e.key === 'c' || e.key === 'C') call();
    else if (e.key === 'r' || e.key === 'R') restart();
    else if (e.key === 'p' || e.key === 'P') togglePause();
    else if (e.key === 'l' || e.key === 'L') labels.toggle();
    else if (e.key === 'Escape') labels.close();
    else if (e.key === '?') welcome.showModal();
  });

  // ----- pointing: a click or drag on the tissue sets where the visitor's cell is heading
  const pointAt = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const inv = invert(scene.viewProj(cam));
    const nx = (2 * (e.clientX - rect.left)) / rect.width - 1, ny = 1 - (2 * (e.clientY - rect.top)) / rect.height;
    const a = transformPoint(inv, [nx, ny, 0]), b = transformPoint(inv, [nx, ny, 1]);
    const h = game.params.radius, t = (h - a[1]) / (b[1] - a[1]);
    if (!(t > 0)) return;
    game.target = { x: a[0] + t * (b[0] - a[0]), y: -(a[2] + t * (b[2] - a[2])) };
  };
  let dragging = false;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); pointAt(e); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) pointAt(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.min(1.5, Math.max(0.3, zoom * Math.exp(e.deltaY * 0.001)));
    fit();
  }, { passive: false });

  // ----- framing: the tissue sits in the part of the window the text leaves free
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight, wide = w > 900;
    // Free area: right of the title column and left of the panel on a wide window; the top 55% on a narrow one.
    const left = wide ? Math.min(470, 0.33 * w) : 0, right = wide ? 290 : 0, bottom = wide ? 0 : 0.45 * h;
    const freeW = w - left - right, freeH = h - bottom;
    // The tissue is about 1000 µm across; the view is 32° tall.
    const perPixel = 1150 / Math.min(freeW, 1.15 * freeH);
    cam.dist = zoom * (perPixel * h) / (2 * Math.tan((16 * Math.PI) / 180));
    const shift = (left - right) / 2, lift = bottom / 2;
    cam.target = [-40 - shift * perPixel * zoom, 0, 20 + lift * perPixel * zoom / Math.sin(cam.pitch)];
  }
  window.addEventListener('resize', fit);
  fit();

  function readouts() {
    const hpi = game.hpi(), n = game.pullingCount(), total = game.microglia().length;
    $('clock').textContent = `${hpi.toFixed(1)} h`;
    $('s-hpi').textContent = hpi.toFixed(1);
    $('clock-bar').style.width = `${(100 * (hpi - 4)) / 20}%`;
    $('s-ri').textContent = String(Math.round(100 * game.repairIndex()));
    $('s-pull').textContent = String(n);
    const idle = total - n - (game.pulling ? 0 : 1);
    callBtn.disabled = idle === 0;
    $('crew').textContent = n === 0 ? `Nobody is pulling. ${idle} microglia are idle.`
      : n === 1 && game.pulling ? `You are pulling alone. ${idle} microglia are idle.`
      : `${n} microglia are pulling${game.pulling ? ', you among them' : ', but not you'}.`;
    // Scale bar: 100 µm at the centre of the tissue.
    const vp = scene.viewProj(cam);
    const a = transformPoint(vp, [-90, 0, 20]), b = transformPoint(vp, [10, 0, 20]);
    ($('scalebar').firstElementChild as HTMLElement).style.width = `${(Math.abs(b[0] - a[0]) * canvas.clientWidth) / 2}px`;
  }

  function finish() {
    shown = true;
    const ri = game.repairIndex(), n = game.pullingCount();
    $('result-title').textContent = ri > 0.5 ? 'Closed.' : ri > 0.2 ? 'Half shut.' : 'Still open.';
    $('result-lead').textContent = `${Math.round(100 * ri)}% of the wound has closed, with ${n === 0 ? 'no microglia' : n === 1 ? 'one microglia' : `${n} microglia`} pulling at the end.`;
    $('result-note').textContent = ri > 0.5
      ? 'This is what the paper found in living fish: microglia gather at the wound within six hours and it is shut within a day. Fish without microglia, or with microglia that cannot grip, are left with an open wound.'
      : 'A wound closes only when enough microglia pull for long enough. Fish that lack microglia are left with an open wound, and in most of them it grows. Start again, and call the others early.';
    result.showModal();
  }

  statusText.textContent = 'WebGPU · Live';
  let last = performance.now(), frame = 0;
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!paused && !welcome.open && !result.open) game.advance(dt);
    view.update(game, now / 1000);
    scene.render(cam, view.spheres, view.sphereCount, view.lines, view.lineVerts, ground);
    const vp = scene.viewProj(cam), w = canvas.clientWidth, h = canvas.clientHeight;
    labels.update(game, (x, y) => {
      const c = transformPoint(vp, [x, game.params.radius, -y]);
      return { x: (0.5 + 0.5 * c[0]) * w, y: (0.5 - 0.5 * c[1]) * h };
    });
    if (frame++ % 6 === 0) readouts();
    if (game.done && !shown) finish();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

main();
