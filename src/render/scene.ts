// The WebGPU scene: cells as shaded spheres on a plane, their soft shadows, thin lines for the
// traction and the wound outline, and flat pictures. World units are µm; y is up, the tissue lies on y = 0.
// The frame is drawn to a texture and passed through one last pass, which can soften what is out
// of focus and let bright bodies glow; with neither asked for, that pass is a plain copy.

import type { Vec3 } from '../contracts';
import type { M4 } from '../math/mat4';
import { eye, viewProj, type Camera } from './camera';

export type { Camera };

/** A flat picture in the scene: its centre, its two half-edges, and the part of the image shown (left, top, right, bottom). */
export interface Picture {
  src: string;
  centre: Vec3;
  u: Vec3;
  v: Vec3;
  crop: [number, number, number, number];
}

/** What a frame may have beyond spheres and lines. */
export interface Extras {
  pictures?: Picture[];
  /** Depth of field (pixels of blur per unit of depth, relative to the distance of the camera's target) and glow, 0 to 1. */
  effects?: { blur: number; glow: number };
}

/** Floats per sphere: centre xyz, radius, colour rgb, glow. */
export const SPHERE_STRIDE = 8;
/** Floats per line vertex: xyz, rgba. */
export const LINE_STRIDE = 7;

const SHADER = /* wgsl */ `
struct Frame { viewProj: mat4x4f, eye: vec4f, light: vec4f, ground: vec4f, view: vec4f };
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

// Every opaque thing also writes how far it is from the eye, over the distance to the camera's target.
struct Drawn { @location(0) colour: vec4f, @location(1) depth: vec4f };
fn drawn(colour: vec3f, world: vec3f) -> Drawn {
  var o: Drawn;
  o.colour = vec4f(colour, 1.0);
  o.depth = vec4f(length(frame.eye.xyz - world) / frame.view.x, 0.0, 0.0, 1.0);
  return o;
}

@fragment fn sphereFs(i: SphereOut) -> Drawn {
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
  return drawn(c, i.world);
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

@group(1) @binding(0) var pictureTex: texture_2d<f32>;
@group(1) @binding(1) var pictureSampler: sampler;
struct PictureOut { @builtin(position) clip: vec4f, @location(0) uv: vec2f, @location(1) world: vec3f };

@vertex fn pictureVs(@location(0) p: vec3f, @location(1) uv: vec2f) -> PictureOut {
  var o: PictureOut;
  o.world = p;
  o.uv = uv;
  o.clip = frame.viewProj * vec4f(p, 1.0);
  return o;
}

@fragment fn pictureFs(i: PictureOut) -> Drawn {
  return drawn(textureSample(pictureTex, pictureSampler, i.uv).rgb, i.world);
}
`;

const POST = /* wgsl */ `
struct Post { texel: vec2f, blur: f32, glow: f32, reach: f32 };
@group(0) @binding(0) var<uniform> post: Post;
@group(0) @binding(1) var colourTex: texture_2d<f32>;
@group(0) @binding(2) var depthTex: texture_2d<f32>;
@group(0) @binding(3) var colourSampler: sampler;

@vertex fn postVs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let corners = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(corners[vi], 0.0, 1.0);
}

@fragment fn postFs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let uv = at.xy * post.texel;
  let sharp = textureSampleLevel(colourTex, colourSampler, uv, 0.0).rgb;
  if (post.blur <= 0.0 && post.glow <= 0.0) { return vec4f(sharp, 1.0); }
  // Depth of field: a disc of samples as wide as the point is far from the plane of the camera's target.
  let depth = textureLoad(depthTex, vec2i(at.xy), 0).r;
  let coc = min(abs(depth - 1.0) * post.blur, post.reach);
  var sum = sharp;
  var glow = vec3f(0.0);
  for (var k = 0; k < 16; k++) {
    let angle = f32(k) * 2.39996;
    let dir = vec2f(cos(angle), sin(angle)) * sqrt((f32(k) + 0.5) / 16.0) * post.texel;
    sum += textureSampleLevel(colourTex, colourSampler, uv + dir * coc, 0.0).rgb;
    glow += max(textureSampleLevel(colourTex, colourSampler, uv + dir * post.reach, 0.0).rgb - vec3f(0.55), vec3f(0.0));
  }
  return vec4f(sum / 17.0 + post.glow * glow / 16.0, 1.0);
}
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
/** Distance from the eye, for the last pass: a format that can be multisampled and resolved. */
const DEPTH_FORMAT: GPUTextureFormat = 'r16float';
/** Floats per picture vertex: xyz, uv. */
const PICTURE_STRIDE = 5;
const MAX_PICTURES = 4;
/** How far, in CSS pixels, a bright body's glow reaches and the most a point is blurred. */
const GLOW_REACH = 9;

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
  /** The frame before the last pass, and the depth of what is in it; each drawn multisampled, then resolved. */
  private drawnColour!: GPUTexture;
  private depthMs!: GPUTexture;
  private drawnDepth!: GPUTexture;
  private pictures: GPURenderPipeline;
  private pictureLayout: GPUBindGroupLayout;
  private pictureBuf: GPUBuffer;
  private sampler: GPUSampler;
  /** Pictures by their address: null while one is being fetched or could not be. */
  private loaded = new Map<string, GPUBindGroup | null>();
  private post: GPURenderPipeline;
  private postParams: GPUBuffer;
  private postBind!: GPUBindGroup;

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
    this.frame = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} }] });
    this.bind = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.frame } }] });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    // Second target: the depth the last pass reads. Blended things leave it alone.
    const depthTarget: GPUColorTargetState = { format: DEPTH_FORMAT }, noDepth: GPUColorTargetState = { format: DEPTH_FORMAT, writeMask: 0 };
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
      fragment: { module, entryPoint: 'sphereFs', targets: [{ format }, depthTarget] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample,
    });
    this.shadows = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'shadowVs', buffers: [{ arrayStride: 4 * SPHERE_STRIDE, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] }] },
      fragment: { module, entryPoint: 'shadowFs', targets: [{ format, blend }, noDepth] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
      multisample,
    });
    this.lines = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'lineVs', buffers: [{ arrayStride: 4 * LINE_STRIDE, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }] },
      fragment: { module, entryPoint: 'lineFs', targets: [{ format, blend }, noDepth] },
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

    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    this.pictureLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ] });
    this.pictures = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout, this.pictureLayout] }),
      vertex: { module, entryPoint: 'pictureVs', buffers: [{ arrayStride: 4 * PICTURE_STRIDE, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x2' }] }] },
      fragment: { module, entryPoint: 'pictureFs', targets: [{ format }, depthTarget] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample,
    });
    this.pictureBuf = device.createBuffer({ size: 4 * PICTURE_STRIDE * 6 * MAX_PICTURES, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    this.postParams = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.post = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: device.createShaderModule({ code: POST }), entryPoint: 'postVs' },
      fragment: { module: device.createShaderModule({ code: POST }), entryPoint: 'postFs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.resize();
  }

  /** Matches the drawing buffer to the canvas' size on screen. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.depth && this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w; this.canvas.height = h;
    for (const t of [this.depth, this.colour, this.drawnColour, this.depthMs, this.drawnDepth]) t?.destroy();
    const size = [w, h], attachment = GPUTextureUsage.RENDER_ATTACHMENT, read = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    this.depth = this.device.createTexture({ size, format: 'depth24plus', sampleCount: SAMPLES, usage: attachment });
    this.colour = this.device.createTexture({ size, format: this.format, sampleCount: SAMPLES, usage: attachment });
    this.depthMs = this.device.createTexture({ size, format: DEPTH_FORMAT, sampleCount: SAMPLES, usage: attachment });
    this.drawnColour = this.device.createTexture({ size, format: this.format, usage: read });
    this.drawnDepth = this.device.createTexture({ size, format: DEPTH_FORMAT, usage: read });
    this.postBind = this.device.createBindGroup({ layout: this.post.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.postParams } },
      { binding: 1, resource: this.drawnColour.createView() },
      { binding: 2, resource: this.drawnDepth.createView() },
      { binding: 3, resource: this.sampler },
    ] });
  }

  eye(cam: Camera): Vec3 { return eye(cam); }

  viewProj(cam: Camera): M4 { return viewProj(cam, this.canvas.width / this.canvas.height); }

  /** The picture at an address, once it has been fetched; asking for it starts the fetch. */
  private picture(src: string): GPUBindGroup | null {
    const have = this.loaded.get(src);
    if (have !== undefined) return have;
    this.loaded.set(src, null);
    fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${src}: ${r.status}`)))).then((b) => createImageBitmap(b)).then((image) => {
      const texture = this.device.createTexture({ size: [image.width, image.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      this.device.queue.copyExternalImageToTexture({ source: image }, { texture }, [image.width, image.height]);
      this.loaded.set(src, this.device.createBindGroup({ layout: this.pictureLayout, entries: [{ binding: 0, resource: texture.createView() }, { binding: 1, resource: this.sampler }] }));
    }).catch((e) => console.warn('A picture of the scene could not be loaded.', e));
    return null;
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
  render(cam: Camera, spheres: Float32Array, sphereCount: number, lines: Float32Array, lineVerts: number, ground: Vec3, fluorescence?: { depth: number }, extras: Extras = {}): void {
    this.resize();
    const uniform = new Float32Array(32);
    uniform.set(this.viewProj(cam), 0);
    uniform.set(this.eye(cam), 16);
    uniform.set([0.35, 0.85, 0.4, 0], 20);
    uniform.set(ground, 24);
    uniform[28] = cam.dist;                                // view.x: the distance at which things are in focus
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

    // Pictures that have arrived: two triangles each, and the corners of the image they show.
    const shown = (extras.pictures ?? []).slice(0, MAX_PICTURES).map((p) => ({ p, bind: this.picture(p.src) })).filter((x) => x.bind);
    if (shown.length) {
      const verts = new Float32Array(shown.length * 6 * PICTURE_STRIDE);
      shown.forEach(({ p }, k) => {
        const [l, t, r, b] = p.crop;
        // Corner by corner: along u, along v, and the image's coordinates there.
        const corners = [[-1, -1, l, t], [1, -1, r, t], [1, 1, r, b], [-1, -1, l, t], [1, 1, r, b], [-1, 1, l, b]];
        corners.forEach(([a, c, s, v], i) => {
          verts.set([p.centre[0] + a * p.u[0] + c * p.v[0], p.centre[1] + a * p.u[1] + c * p.v[1], p.centre[2] + a * p.u[2] + c * p.v[2], s, v], (k * 6 + i) * PICTURE_STRIDE);
        });
      });
      this.device.queue.writeBuffer(this.pictureBuf, 0, verts);
    }
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth), fx = extras.effects;
    this.device.queue.writeBuffer(this.postParams, 0, new Float32Array([1 / this.canvas.width, 1 / this.canvas.height, (fx?.blur ?? 0) * dpr, fx?.glow ?? 0, GLOW_REACH * dpr, 0, 0, 0]));

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.colour.createView(), resolveTarget: this.drawnColour.createView(),
        clearValue: { r: ground[0], g: ground[1], b: ground[2], a: 1 }, loadOp: 'clear', storeOp: 'discard',
      }, {
        // Where nothing is drawn, the depth is that of the camera's target: in focus.
        view: this.depthMs.createView(), resolveTarget: this.drawnDepth.createView(),
        clearValue: { r: 1, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'discard',
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
    if (shown.length) {
      pass.setPipeline(this.pictures);
      pass.setVertexBuffer(0, this.pictureBuf);
      shown.forEach(({ bind }, k) => { pass.setBindGroup(1, bind!); pass.draw(6, 1, 6 * k); });
    }
    if (lineVerts) {
      pass.setPipeline(this.lines);
      pass.setVertexBuffer(0, this.lineBuf);
      pass.draw(lineVerts);
    }
    pass.end();

    const last = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }] });
    last.setPipeline(this.post);
    last.setBindGroup(0, this.postBind);
    last.draw(3);
    last.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
