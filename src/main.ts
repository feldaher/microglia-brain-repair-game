import './style.css';
import type { Vec3 } from './contracts';
import type { Point } from './app/record';
import { COLOURS } from './app/view';
import { invert, transformPoint } from './math/mat4';
import { Scene, type Camera } from './render/scene';
import { Fig1 } from './stations/fig1';
import { Fig3 } from './stations/fig3';
import { Fig4 } from './stations/fig4';
import { $, type Stage, type Station } from './stations/stage';
import { MODEL_KIND, STATIONS } from './teach/stations';
import { Labels } from './ui/labels';
import { initWelcome } from './ui/welcome';

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

  const cam: Camera = { target: [-40, 0, 20], dist: 2100, yaw: 0, pitch: 1.02 };
  const labels = new Labels();
  let started = false;
  const welcome = initWelcome(() => { started = true; });
  const stage: Stage = { scene, cam, labels, ground, held: () => !started || welcome.open };

  // ----- the stations; one is on screen at a time
  const built = new Map<number, Station>([[1, new Fig1(stage)], [3, new Fig3(stage)], [4, new Fig4(stage)]]);
  let station: Station = built.get(4)!;
  const buttons = new Map<number, HTMLButtonElement>();
  function show(next: Station) {
    station.leave();
    station = next;
    labels.close();
    for (const el of document.querySelectorAll<HTMLElement>('[data-fig]')) el.hidden = !el.dataset.fig!.split(' ').includes(String(next.fig));
    for (const [fig, b] of buttons) b.classList.toggle('here', fig === next.fig);
    $('fig-n').textContent = `fig. ${next.fig}`;
    $('tagline').innerHTML = next.tagline.join('<br />');
    $('help').textContent = next.help;
    $('fine').textContent = next.fine;
    next.enter();
    try { history.replaceState(null, '', `#fig${next.fig}`); } catch { /* a sandboxed page: no address to keep */ }
  }
  for (const s of STATIONS) {
    const b = document.createElement('button'), mine = built.get(s.fig);
    b.textContent = `Fig ${s.fig}`;
    b.title = s.title + (mine ? '' : ' (not built yet)');
    if (!mine) b.className = 'soon';
    b.addEventListener('click', () => {
      if (mine && mine !== station) show(mine);
      labels.fill(`Fig ${s.fig} · ${s.title}`, s.numbers, s.finding, s.figure, '#1d1b19');
      $('card-kind').textContent = `${MODEL_KIND[s.model]}.${mine ? '' : ' This station is not built yet: for now, the finding and the figure.'}`;
    });
    $('stations').append(b);
    buttons.set(s.fig, b);
  }
  show(built.get(Number(/^#fig(\d)$/.exec(location.hash)?.[1])) ?? station);

  window.addEventListener('keydown', (e) => {
    if (welcome.open || e.metaKey || e.ctrlKey) return;
    if (e.key === 'l' || e.key === 'L') labels.toggle();
    else if (e.key === 'Escape') labels.close();
    else if (e.key === '?') welcome.showModal();
    else station.key(e);
  });

  // ----- pointing at the tissue plane
  const pointAt = (e: PointerEvent): Point | null => {
    const rect = canvas.getBoundingClientRect();
    const inv = invert(scene.viewProj(cam));
    const nx = (2 * (e.clientX - rect.left)) / rect.width - 1, ny = 1 - (2 * (e.clientY - rect.top)) / rect.height;
    const a = transformPoint(inv, [nx, ny, 0]), b = transformPoint(inv, [nx, ny, 1]);
    const h = station.game().params.radius, t = (h - a[1]) / (b[1] - a[1]);
    return t > 0 ? { x: a[0] + t * (b[0] - a[0]), y: -(a[2] + t * (b[2] - a[2])) } : null;
  };
  let dragging = false;
  const point = (e: PointerEvent) => { const p = pointAt(e); if (p) station.point(p); };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); point(e); });
  // Dragging steers a cell (Fig 4); elsewhere a press picks one thing, so only the press counts.
  canvas.addEventListener('pointermove', (e) => { if (dragging && station.fig === 4) point(e); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  // ----- framing: the tissue sits in the part of the window the text leaves free
  let zoom = 1;
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
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.min(1.5, Math.max(0.3, zoom * Math.exp(e.deltaY * 0.001)));
    fit();
  }, { passive: false });
  window.addEventListener('resize', fit);
  fit();

  statusText.textContent = 'WebGPU · Live';
  let last = performance.now(), frame = 0;
  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    station.frame(dt, now / 1000);
    const vp = scene.viewProj(cam), w = canvas.clientWidth, h = canvas.clientHeight, game = station.game();
    labels.update(game, (x, y) => {
      const c = transformPoint(vp, [x, game.params.radius, -y]);
      return { x: (0.5 + 0.5 * c[0]) * w, y: (0.5 - 0.5 * c[1]) * h };
    });
    if (frame++ % 30 === 0) {
      // Scale bar: 100 model µm at the centre of the tissue.
      const a = transformPoint(vp, [-90, 0, 20]), b = transformPoint(vp, [10, 0, 20]);
      ($('scalebar').firstElementChild as HTMLElement).style.width = `${(Math.abs(b[0] - a[0]) * w) / 2}px`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

main();
