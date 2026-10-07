// The WebGPU scene: cells as shaded spheres on a plane, their soft shadows, and thin lines
// for the traction and the wound outline. World units are µm; y is up, the tissue lies on y = 0.

import type { Vec3 } from '../contracts';
import { lookAt, mul, perspective, type M4 } from '../math/mat4';

export interface Camera {
  target: Vec3;
  dist: number;
  yaw: number;
  pitch: number;
}

/** Floats per sphere: centre xyz, radius, colour rgb, glow. */
export const SPHERE_STRIDE = 8;
/** Floats per line vertex: xyz, rgba. */
export const LINE_STRIDE = 7;

const SHADER = /* wgsl */ `
struct Frame { viewProj: mat4x4f, eye: vec4f, light: vec4f, ground: vec4f };
@group(0) @binding(0) var<uniform> frame: Frame;

struct SphereOut { @builtin(position) clip: vec4f, @location(0) normal: vec3f, @location(1) world: vec3f, @location(2) colour: vec4f };

@vertex fn sphereVs(@location(0) p: vec3f, @location(1) centre: vec4f, @location(2) colour: vec4f) -> SphereOut {
  var o: SphereOut;
  o.world = centre.xyz + p * centre.w;
  o.normal = p;
  o.colour = colour;
  o.clip = frame.viewProj * vec4f(o.world, 1.0);
  return o;
}

@fragment fn sphereFs(i: SphereOut) -> @location(0) vec4f {
  let n = normalize(i.normal);
  let v = normalize(frame.eye.xyz - i.world);
  let l = normalize(frame.light.xyz);
  let wrap = 0.5 + 0.5 * dot(n, l);
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  let spec = pow(max(dot(n, normalize(l + v)), 0.0), 48.0);
  // A jelly-like body: light wraps around it, the edge picks up the ground colour, a wet highlight on top.
  var c = i.colour.rgb * (0.42 + 0.58 * wrap * wrap);
  c = mix(c, frame.ground.rgb, 0.28 * rim) + vec3f(0.5 * spec) + i.colour.rgb * i.colour.a * (0.25 + 0.5 * rim);
  if (frame.ground.a > 0.5) {
    // Fluorescence: the body shines by itself, a little brighter face-on, and fades with depth into the dark.
    let depth = clamp((length(frame.eye.xyz - i.world) - frame.light.a) / frame.eye.a, 0.0, 1.0);
    c = i.colour.rgb * (0.55 + 0.45 * wrap) * (1.0 + i.colour.a) * mix(1.0, 0.3, depth);
  }
  return vec4f(c, 1.0);
}

struct ShadowOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f };

@vertex fn shadowVs(@builtin(vertex_index) vi: u32, @location(1) centre: vec4f) -> ShadowOut {
  let corners = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let uv = corners[vi];
  let l = normalize(frame.light.xyz);
  // Where the sphere's shadow falls on the ground.
  let foot = centre.xyz - l * (centre.y / l.y);
  var o: ShadowOut;
  o.uv = uv;
  o.clip = frame.viewProj * vec4f(foot.x + uv.x * centre.w * 1.7, 0.05, foot.z + uv.y * centre.w * 1.7, 1.0);
  return o;
}

@fragment fn shadowFs(i: ShadowOut) -> @location(0) vec4f {
  let d = length(i.uv);
  let a = 0.2 * smoothstep(1.0, 0.25, d);
  return vec4f(frame.ground.rgb * 0.35, a);
}

struct LineOut { @builtin(position) clip: vec4f, @location(0) colour: vec4f };

@vertex fn lineVs(@location(0) p: vec3f, @location(1) colour: vec4f) -> LineOut {
  var o: LineOut;
  o.clip = frame.viewProj * vec4f(p, 1.0);
  o.colour = colour;
  return o;
}

@fragment fn lineFs(i: LineOut) -> @location(0) vec4f { return i.colour; }
`;

/** A unit sphere as a twice-subdivided icosahedron. */
function icosphere(): { positions: Float32Array; indices: Uint16Array } {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts: number[][] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const unit = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  verts = verts.map(unit);
  for (let s = 0; s < 2; s++) {
    const mid = new Map<string, number>();
    const between = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let m = mid.get(key);
      if (m === undefined) {
        m = verts.length;
        verts.push(unit([verts[a][0] + verts[b][0], verts[a][1] + verts[b][1], verts[a][2] + verts[b][2]]));
        mid.set(key, m);
      }
      return m;
    };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = between(a, b), bc = between(b, c), ca = between(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  return { positions: new Float32Array(verts.flat()), indices: new Uint16Array(faces.flat()) };
}

const SAMPLES = 4;

export class Scene {
  private depth!: GPUTexture;
  private colour!: GPUTexture;
  private frame: GPUBuffer;
  private bind: GPUBindGroup;
  private spheres: GPURenderPipeline;
  private shadows: GPURenderPipeline;
  private lines: GPURenderPipeline;
  private mesh: GPUBuffer;
  private index: GPUBuffer;
  private indexCount: number;
  private instances: GPUBuffer | null = null;
  private lineBuf: GPUBuffer | null = null;

  static async create(canvas: HTMLCanvasElement): Promise<Scene> {
    if (!navigator.gpu) throw new Error('This browser has no WebGPU.');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter was found.');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('The canvas could not get a WebGPU context.');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });
    return new Scene(canvas, device, context, format);
  }

  private constructor(readonly canvas: HTMLCanvasElement, readonly device: GPUDevice, private context: GPUCanvasContext, private format: GPUTextureFormat) {
    const module = device.createShaderModule({ code: SHADER });
    this.frame = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }] });
    this.bind = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.frame } }] });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    const instance: GPUVertexBufferLayout = {
      arrayStride: 4 * SPHERE_STRIDE, stepMode: 'instance',
      attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }, { shaderLocation: 2, offset: 16, format: 'float32x4' }],
    };
    const blend: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    };
    const multisample = { count: SAMPLES };
    this.spheres = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'sphereVs', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }, instance] },
      fragment: { module, entryPoint: 'sphereFs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample,
    });
    this.shadows = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'shadowVs', buffers: [{ arrayStride: 4 * SPHERE_STRIDE, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] }] },
      fragment: { module, entryPoint: 'shadowFs', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
      multisample,
    });
    this.lines = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'lineVs', buffers: [{ arrayStride: 4 * LINE_STRIDE, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }] },
      fragment: { module, entryPoint: 'lineFs', targets: [{ format, blend }] },
      primitive: { topology: 'line-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
      multisample,
    });
    const ico = icosphere();
    this.mesh = device.createBuffer({ size: ico.positions.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.mesh, 0, ico.positions);
    this.index = device.createBuffer({ size: ico.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.index, 0, ico.indices);
    this.indexCount = ico.indices.length;
    this.resize();
  }

  /** Matches the drawing buffer to the canvas' size on screen. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.depth && this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w; this.canvas.height = h;
    this.depth?.destroy(); this.colour?.destroy();
    this.depth = this.device.createTexture({ size: [w, h], format: 'depth24plus', sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.colour = this.device.createTexture({ size: [w, h], format: this.format, sampleCount: SAMPLES, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  }

  eye(cam: Camera): Vec3 {
    const c = Math.cos(cam.pitch);
    return [cam.target[0] + cam.dist * c * Math.sin(cam.yaw), cam.target[1] + cam.dist * Math.sin(cam.pitch), cam.target[2] + cam.dist * c * Math.cos(cam.yaw)];
  }

  viewProj(cam: Camera): M4 {
    const proj = perspective((32 * Math.PI) / 180, this.canvas.width / this.canvas.height, cam.dist * 0.05, cam.dist * 6);
    return mul(proj, lookAt(this.eye(cam), cam.target, [0, 1, 0]));
  }

  private fit(buf: GPUBuffer | null, bytes: number): GPUBuffer {
    if (buf && buf.size >= bytes) return buf;
    buf?.destroy();
    return this.device.createBuffer({ size: Math.max(bytes, 1024), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  }

  /**
   * Draws one frame. `ground` is the page colour, rgb in 0–1. With `fluorescence`, bodies glow on a
   * dark field and cast no shadow: `depth` is the thickness of the specimen, over which they fade.
   */
  render(cam: Camera, spheres: Float32Array, sphereCount: number, lines: Float32Array, lineVerts: number, ground: Vec3, fluorescence?: { depth: number }): void {
    this.resize();
    const uniform = new Float32Array(28);
    uniform.set(this.viewProj(cam), 0);
    uniform.set(this.eye(cam), 16);
    uniform.set([0.35, 0.85, 0.4, 0], 20);
    uniform.set(ground, 24);
    if (fluorescence) {
      uniform[19] = fluorescence.depth;                    // eye.a: distance over which bodies fade
      uniform[23] = cam.dist - fluorescence.depth / 2;     // light.a: where the fade starts
      uniform[27] = 1;                                     // ground.a: fluorescence on
    }
    this.device.queue.writeBuffer(this.frame, 0, uniform);
    this.instances = this.fit(this.instances, sphereCount * 4 * SPHERE_STRIDE);
    this.device.queue.writeBuffer(this.instances, 0, spheres, 0, sphereCount * SPHERE_STRIDE);
    this.lineBuf = this.fit(this.lineBuf, lineVerts * 4 * LINE_STRIDE);
    if (lineVerts) this.device.queue.writeBuffer(this.lineBuf, 0, lines, 0, lineVerts * LINE_STRIDE);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.colour.createView(), resolveTarget: this.context.getCurrentTexture().createView(),
        clearValue: { r: ground[0], g: ground[1], b: ground[2], a: 1 }, loadOp: 'clear', storeOp: 'discard',
      }],
      depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setBindGroup(0, this.bind);
    if (!fluorescence) {
      pass.setPipeline(this.shadows);
      pass.setVertexBuffer(0, this.instances);
      pass.draw(6, sphereCount);
    }
    pass.setPipeline(this.spheres);
    pass.setVertexBuffer(0, this.mesh);
    pass.setVertexBuffer(1, this.instances);
    pass.setIndexBuffer(this.index, 'uint16');
    pass.drawIndexed(this.indexCount, sphereCount);
    if (lineVerts) {
      pass.setPipeline(this.lines);
      pass.setVertexBuffer(0, this.lineBuf);
      pass.draw(lineVerts);
    }
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
