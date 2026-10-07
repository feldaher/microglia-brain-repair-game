// The camera: where it stands, what it sees, and where a point of the scene falls on the page.
// Nothing here touches the GPU.

import type { Vec3 } from '../contracts';
import { lookAt, mul, perspective, type M4 } from '../math/mat4';

export interface Camera {
  target: Vec3;
  dist: number;
  yaw: number;
  pitch: number;
}

/** Height of the view, radians. */
export const FOV = (32 * Math.PI) / 180;

export function eye(cam: Camera): Vec3 {
  const c = Math.cos(cam.pitch);
  return [cam.target[0] + cam.dist * c * Math.sin(cam.yaw), cam.target[1] + cam.dist * Math.sin(cam.pitch), cam.target[2] + cam.dist * c * Math.cos(cam.yaw)];
}

/** `aspect` is the width of the view over its height. */
export function viewProj(cam: Camera, aspect: number): M4 {
  const proj = perspective(FOV, aspect, cam.dist * 0.05, cam.dist * 6);
  return mul(proj, lookAt(eye(cam), cam.target, [0, 1, 0]));
}

/** Where a point of the scene is drawn, in CSS pixels from the top left; null if it is behind the camera. */
export function project(vp: M4, p: Vec3, width: number, height: number): { x: number; y: number } | null {
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w <= 0) return null;
  const x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
  return { x: (0.5 + 0.5 * x) * width, y: (0.5 - 0.5 * y) * height };
}
