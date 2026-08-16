/**
 * 图像缩放算法（可分离卷积实现）
 * 支持：最近邻 / 双线性 / 双三次（Catmull-Rom）/ Lanczos-3
 * 所有平滑类算法在预乘 Alpha 空间计算，避免边缘发黑
 */

export type Interpolation = "nearest" | "bilinear" | "bicubic" | "lanczos";

export const INTERPOLATION_LABELS: Record<Interpolation, string> = {
  nearest: "最近邻",
  bilinear: "双线性",
  bicubic: "双三次",
  lanczos: "Lanczos-3",
};

export const INTERPOLATION_DESCRIPTIONS: Record<Interpolation, string> = {
  nearest: "像素级锐利，适合像素画、图标等需要保持清晰边缘的图像",
  bilinear: "线性插值，速度快、效果均衡，适合大多数照片",
  bicubic: "三次卷积插值，边缘更平滑，放大照片首选",
  lanczos: "高质量重采样，细节保留最好，适合大幅缩小或放大",
};

interface Kernel {
  fn: (t: number) => number;
  radius: number;
}

/** 三角核（双线性） */
function triangle(t: number): number {
  t = Math.abs(t);
  return t < 1 ? 1 - t : 0;
}

/** Catmull-Rom 三次核 */
function catmullRom(t: number): number {
  const a = -0.5;
  const abs = Math.abs(t);
  const t2 = abs * abs;
  const t3 = t2 * abs;
  if (abs <= 1) return (a + 2) * t3 - (a + 3) * t2 + 1;
  if (abs < 2) return a * t3 - 5 * a * t2 + 8 * a * abs - 4 * a;
  return 0;
}

/** Lanczos-3 核 */
function lanczos3(t: number): number {
  if (t === 0) return 1;
  const abs = Math.abs(t);
  if (abs >= 3) return 0;
  const p = Math.PI * t;
  return (3 * Math.sin(p) * Math.sin(p / 3)) / (p * p);
}

const KERNELS: Record<Exclude<Interpolation, "nearest">, Kernel> = {
  bilinear: { fn: triangle, radius: 1 },
  bicubic: { fn: catmullRom, radius: 2 },
  lanczos: { fn: lanczos3, radius: 3 },
};

/** 为每个输出坐标计算源坐标贡献（src index, weight） */
function buildContribs(
  srcSize: number,
  dstSize: number,
  kernel: Kernel
): Int32Array[] {
  const contribs: Int32Array[] = [];
  const scale = dstSize / srcSize;
  const { fn, radius } = kernel;

  for (let x = 0; x < dstSize; x++) {
    // 输出像素中心映射回源坐标
    const center = (x + 0.5) / scale - 0.5;
    const start = Math.max(0, Math.ceil(center - radius));
    const end = Math.min(srcSize - 1, Math.floor(center + radius));
    const count = end - start + 1;

    // 计算权重
    const weights = new Float64Array(count);
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const w = fn(start + i - center);
      weights[i] = w;
      sum += w;
    }
    // 归一化
    const norm = sum || 1;
    const arr = new Int32Array(count * 2);
    for (let i = 0; i < count; i++) {
      arr[i * 2] = start + i;
      // 权重放大到 16 位定点，保证精度
      arr[i * 2 + 1] = Math.round((weights[i] / norm) * 65536);
    }
    contribs.push(arr);
  }
  return contribs;
}

/** 最近邻（点采样，保持像素画锐利边缘） */
function resampleNearest(src: ImageData, dw: number, dh: number): ImageData {
  const { data, width: sw, height: sh } = src;
  const out = new Uint8ClampedArray(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * xRatio));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = data[si];
      out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2];
      out[di + 3] = data[si + 3];
    }
  }
  return new ImageData(out, dw, dh);
}

/**
 * 可分离卷积重采样（预乘 Alpha）
 * 先水平后垂直两次 1D 卷积，O(n·k) 复杂度
 */
function resampleConvolution(
  src: ImageData,
  dw: number,
  dh: number,
  kernel: Kernel
): ImageData {
  const { data, width: sw, height: sh } = src;

  // 水平方向卷积：sw×sh -> dw×sh
  const tmp = new Uint8ClampedArray(dw * sh * 4);
  const xContribs = buildContribs(sw, dw, kernel);

  for (let y = 0; y < sh; y++) {
    const srcRowBase = y * sw * 4;
    const tmpRowBase = y * dw * 4;
    for (let x = 0; x < dw; x++) {
      const contrib = xContribs[x];
      const count = contrib.length / 2;
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let i = 0; i < count; i++) {
        const srcIdx = contrib[i * 2] * 4 + srcRowBase;
        const w = contrib[i * 2 + 1] / 65536;
        const ca = data[srcIdx + 3];
        r += w * data[srcIdx] * ca;
        g += w * data[srcIdx + 1] * ca;
        b += w * data[srcIdx + 2] * ca;
        a += w * ca;
      }
      const outIdx = tmpRowBase + x * 4;
      if (a > 0) {
        tmp[outIdx] = r / a;
        tmp[outIdx + 1] = g / a;
        tmp[outIdx + 2] = b / a;
      }
      tmp[outIdx + 3] = a;
    }
  }

  // 垂直方向卷积：dw×sh -> dw×dh
  const out = new Uint8ClampedArray(dw * dh * 4);
  const yContribs = buildContribs(sh, dh, kernel);

  for (let y = 0; y < dh; y++) {
    const contrib = yContribs[y];
    const count = contrib.length / 2;
    const outRowBase = y * dw * 4;
    for (let x = 0; x < dw; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let i = 0; i < count; i++) {
        const tmpIdx = (contrib[i * 2] * dw + x) * 4;
        const w = contrib[i * 2 + 1] / 65536;
        const ca = tmp[tmpIdx + 3];
        r += w * tmp[tmpIdx] * ca;
        g += w * tmp[tmpIdx + 1] * ca;
        b += w * tmp[tmpIdx + 2] * ca;
        a += w * ca;
      }
      const outIdx = outRowBase + x * 4;
      if (a > 0) {
        out[outIdx] = r / a;
        out[outIdx + 1] = g / a;
        out[outIdx + 2] = b / a;
      }
      out[outIdx + 3] = a;
    }
  }

  return new ImageData(out, dw, dh);
}

/**
 * 重采样 ImageData 到目标尺寸
 */
export function resampleImageData(
  src: ImageData,
  dw: number,
  dh: number,
  interpolation: Interpolation
): ImageData {
  if (dw <= 0 || dh <= 0) throw new Error("目标尺寸必须大于 0");
  if (dw === src.width && dh === src.height) return src;
  if (interpolation === "nearest") {
    return resampleNearest(src, dw, dh);
  }
  return resampleConvolution(src, dw, dh, KERNELS[interpolation]);
}

/**
 * 将 HTMLCanvasElement 缩放到目标尺寸
 * 大幅缩小时先用浏览器高质量画布逐步减半，再应用所选算法，兼顾速度与质量
 */
export function resizeCanvas(
  source: HTMLCanvasElement,
  dw: number,
  dh: number,
  interpolation: Interpolation
): HTMLCanvasElement {
  if (dw <= 0 || dh <= 0) throw new Error("目标尺寸必须大于 0");
  if (dw === source.width && dh === source.height) return source;

  let base = source;

  // 平滑算法大幅缩小时先逐步减半（最近邻保持像素锐利，不做减半）
  if (interpolation !== "nearest") {
    const scaleX = dw / source.width;
    const scaleY = dh / source.height;
    if (scaleX < 1 / 3 || scaleY < 1 / 3) {
      let cw = source.width;
      let ch = source.height;
      while (cw / dw > 3 || ch / dh > 3) {
        cw = Math.max(dw, Math.floor(cw / 2));
        ch = Math.max(dh, Math.floor(ch / 2));
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(base, 0, 0, cw, ch);
        base = c;
      }
    }
  }

  const ctx = base.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, base.width, base.height);
  const resampled = resampleImageData(imgData, dw, dh, interpolation);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  canvas.getContext("2d")!.putImageData(resampled, 0, 0);
  return canvas;
}
