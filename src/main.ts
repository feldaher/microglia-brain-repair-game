import './style.css';
import type { Vec3 } from './contracts';
import type { Point } from './app/record';
import { COLOURS } from './app/view';
import { frame as frameShot } from './journey/camera';
import type { Viewport } from './journey/types';
import { invert, transformPoint } from './math/mat4';
import { Scene, type Camera } from './render/scene';
import { Fig1 } from './stations/fig1';
import { Fig3 } from './stations/fig3';
import { Fig4 } from './stations/fig4';
import { Journey } from './stations/journey';
import { Tissue3d } from './stations/tissue3d';
import { TissueView } from './stations/tissueview';
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
  /** The window, and the part of it the page's text leaves free for the station on screen. */
  const viewport = (): Viewport => {
    const w = canvas.clientWidth, h = canvas.clientHeight, wide = w > 900;
    // Free area: right of the title column and left of the panel on a wide window; the top 55% on a narrow one.
    const usual = { left: wide ? Math.min(470, 0.33 * w) : 0, right: wide ? 290 : 0, top: 0, bottom: wide ? 0 : 0.45 * h };
    return { width: w, height: h, ...(station.margins?.(w, h) ?? usual) };
  };
  const stage: Stage = { scene, cam, labels, ground, held: () => !started || welcome.open, zoom: 1, viewport };

  // ----- the stations; one is on screen at a time
  // -1 is the journey through the paper on the 3D tissue; 0 the sandbox of that tissue.
  const tissue = new TissueView();
  const journey = new Journey(stage, tissue);
  const built = new Map<number, Station>([[-1, journey], [0, new Tissue3d(stage, tissue)], [1, new Fig1(stage)], [3, new Fig3(stage)], [4, new Fig4(stage)]]);
  let station: Station = journey;
  const buttons = new Map<number, HTMLButtonElement>();
  function show(next: Station) {
    station.leave();
    station = next;
    labels.close();
    for (const el of document.querySelectorAll<HTMLElement>('[data-fig]')) el.hidden = !el.dataset.fig!.split(' ').includes(String(next.fig));
    for (const [fig, b] of buttons) b.classList.toggle('here', fig === next.fig);
    $('fig-n').textContent = next.id ?? (next.fig ? `fig. ${next.fig}` : 'preview');
    $('tagline').innerHTML = next.tagline.join('<br />');
    $('help').textContent = next.help;
    $('fine').textContent = next.fine;
    $('scale-label').textContent = next.scale.label;
    $('scale-note').textContent = next.scale.note;
    cam.yaw = 0; cam.pitch = next.orbit ? 0.9 : 1.02;
    stage.zoom = 1;
    next.enter();
    fit();
    try { history.replaceState(null, '', `#${next.id ?? (next.fig ? `fig${next.fig}` : 'tissue')}`); } catch { /* a sandboxed page: no address to keep */ }
  }
  // The journey comes first in the strip; the figures and the sandbox follow.
  const story = document.createElement('button');
  story.textContent = 'The story';
  story.title = 'The paper told in chapters, on the 3D tissue';
  story.addEventListener('click', () => { if (station !== journey) show(journey); });
  $('stations').append(story);
  buttons.set(-1, story);
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
  // The preview of the 3D tissue has its own button, at the end of the strip.
  const preview = document.createElement('button');
  preview.textContent = '3D tissue';
  preview.title = 'A preview of the tissue the figures will move onto';
  preview.addEventListener('click', () => show(built.get(0)!));
  $('stations').append(preview);
  buttons.set(0, preview);

  /** The station an address names; the journey where it names none. */
  const named = (): Station => (location.hash === '#tissue' ? built.get(0)! : built.get(Number(/^#fig(\d)$/.exec(location.hash)?.[1])) ?? journey);
  show(named());
  // A link in a card can name another station.
  window.addEventListener('hashchange', () => { const next = named(); if (next !== station) show(next); });

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
    const h = station.game()?.params.radius ?? 0, t = (h - a[1]) / (b[1] - a[1]);
    return t > 0 ? { x: a[0] + t * (b[0] - a[0]), y: -(a[2] + t * (b[2] - a[2])) } : null;
  };
  let dragging = false;
  const point = (e: PointerEvent) => { const p = pointAt(e); if (p) station.point(p); };
  let lastX = 0, lastY = 0;
  /** Fingers on the tissue, and how far apart two of them were: a pinch zooms. */
  const fingers = new Map<number, { x: number; y: number }>();
  let spread = 0;
  const apart = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const lift = (e: PointerEvent) => { dragging = false; fingers.delete(e.pointerId); };
  const zoomBy = (factor: number) => {
    station.grab?.();
    stage.zoom = Math.min(1.5, Math.max(0.3, stage.zoom * factor));
    fit();
  };
  canvas.addEventListener('pointerdown', (e) => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) { spread = apart(); return; }
    dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId);
    if (station.orbit) station.grab?.(); else point(e);
  });
  // Dragging turns the 3D tissue, steers a cell in Fig 4; elsewhere a press picks one thing, so only the press counts.
  canvas.addEventListener('pointermove', (e) => {
    if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 2) {
      const now = apart();
      if (spread > 0 && now > 0) zoomBy(spread / now);
      spread = now;
      return;
    }
    if (!dragging) return;
    if (station.orbit) {
      cam.yaw -= (e.clientX - lastX) * 0.006;
      cam.pitch = Math.min(1.5, Math.max(0.05, cam.pitch + (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
    } else if (station.fig === 4) point(e);
  });
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  // ----- framing: the tissue sits in the part of the window the text leaves free
  function fit() {
    Object.assign(cam, frameShot({ centre: station.centre, extent: station.extent * stage.zoom, yaw: cam.yaw, pitch: cam.pitch }, viewport()));
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(Math.exp(e.deltaY * 0.001));
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
    if (game) labels.update(game, (x, y) => {
      const c = transformPoint(vp, [x, game.params.radius, -y]);
      return { x: (0.5 + 0.5 * c[0]) * w, y: (0.5 - 0.5 * c[1]) * h };
    });
    $('labels').hidden = !game;
    if (frame++ % 30 === 0) {
      // Scale bar: its length, measured at the centre of the specimen, across the view.
      const c0 = station.centre, half = station.scale.length / 2, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
      const a = transformPoint(vp, [c0[0] - half * cy, c0[1], c0[2] + half * sy]), b = transformPoint(vp, [c0[0] + half * cy, c0[1], c0[2] - half * sy]);
      ($('scalebar').firstElementChild as HTMLElement).style.width = `${(Math.abs(b[0] - a[0]) * w) / 2}px`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

main();
