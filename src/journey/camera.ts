// From a shot to a camera, and from one shot to the next.

import type { Vec3 } from '../contracts';
import { FOV, type Camera } from '../render/camera';
import type { Shot, Viewport } from './types';

/** Slow out of one shot and slow into the next. */
export const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * The shot a fraction `t` of the way from `a` to `b`: the centre in a straight line, the width in
 * equal ratios (so a descent across scales reads evenly), the yaw the short way round.
 */
export function between(a: Shot, b: Shot, t: number): Shot {
  const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return {
    centre: [0, 1, 2].map((k) => a.centre[k] + t * (b.centre[k] - a.centre[k])) as Vec3,
    extent: a.extent * Math.pow(b.extent / a.extent, t),
    yaw: t >= 1 ? b.yaw : a.yaw + t * turn,
    pitch: a.pitch + t * (b.pitch - a.pitch),
  };
}

/**
 * The camera that puts a shot in the part of the window the page's text leaves free: the shot's
 * width spans that area, and its centre is drawn in the middle of it.
 */
export function frame(shot: Shot, vp: Viewport): Camera {
  const freeW = vp.width - vp.left - vp.right, freeH = vp.height - vp.top - vp.bottom;
  // µm per pixel at the centre; a specimen is allowed a little more height than width.
  const perPixel = shot.extent / Math.min(freeW, 1.15 * freeH);
  const sy = Math.sin(shot.yaw), cy = Math.cos(shot.yaw), sp = Math.sin(shot.pitch), cp = Math.cos(shot.pitch);
  // The camera's right and up; the camera looks at a point beside the centre so that the centre lands in the free area.
  const right: Vec3 = [cy, 0, -sy], up: Vec3 = [-sp * sy, cp, -sp * cy];
  const across = ((vp.left - vp.right) / 2) * perPixel, down = ((vp.bottom - vp.top) / 2) * perPixel;
  return {
    target: [0, 1, 2].map((k) => shot.centre[k] - across * right[k] - down * up[k]) as Vec3,
    dist: (perPixel * vp.height) / (2 * Math.tan(FOV / 2)),
    yaw: shot.yaw,
    pitch: shot.pitch,
  };
}
