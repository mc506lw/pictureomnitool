/**
 * 专业级调色引擎：曲线、色轮、分区调整、晕影、锐化
 */

export interface CurvePoint {
  x: number; // 0~255
  y: number; // 0~255
}

export interface ColorGradeOptions {
  // 基础调整
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  blur: number;
  grayscale: number;
  invert: number;

  // 曲线
  masterCurve: CurvePoint[];
  redCurve: CurvePoint[];
  greenCurve: CurvePoint[];
  blueCurve: CurvePoint[];

  // 色温/色调
  temperature: number; // -100 ~ 100
  tint: number; // -100 ~ 100

  // 分区调整
  shadowHue: number; // -180 ~ 180
  shadowSat: number; // -100 ~ 100
  midtoneHue: number;
  midtoneSat: number;
  highlightHue: number;
  highlightSat: number;

  // 晕影
  vignette: number; // 0 ~ 1
  vignetteSoftness: number; // 0 ~ 1

  // 锐化
  sharpen: number; // 0 ~ 2
}

export const DEFAULT_GRADE_OPTIONS: ColorGradeOptions = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hueRotate: 0,
  blur: 0,
  grayscale: 0,
  invert: 0,
  masterCurve: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  redCurve: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  greenCurve: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  blueCurve: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  temperature: 0,
  tint: 0,
  shadowHue: 0,
  shadowSat: 0,
  midtoneHue: 0,
  midtoneSat: 0,
  highlightHue: 0,
  highlightSat: 0,
  vignette: 0,
  vignetteSoftness: 0.5,
  sharpen: 0,
};

// 贝塞尔曲线插值
function interpolateCurve(points: CurvePoint[], x: number): number {
  if (points.length === 0) return x;
  if (points.length === 1) return points[0].y;

  // 找到 x 所在的区间
  let lower = points[0];
  let upper = points[points.length - 1];

  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i].x && x <= points[i + 1].x) {
      lower = points[i];
      upper = points[i + 1];
      break;
    }
  }

  if (x <= lower.x) return lower.y;
  if (x >= upper.x) return upper.y;

  const t = (x - lower.x) / (upper.x - lower.x);
  // 使用 smoothstep 插值
  const smooth = t * t * (3 - 2 * t);
  return Math.round(lower.y + (upper.y - lower.y) * smooth);
}

function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, interpolateCurve(points, i)));
  }
  return lut;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return { h, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;

  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r, g, b] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r, g, b] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r, g, b] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function applyColorWheel(
  r: number,
  g: number,
  b: number,
  hueShift: number,
  satShift: number
): { r: number; g: number; b: number } {
  const hsl = rgbToHsl(r, g, b);
  let newH = hsl.h + hueShift;
  if (newH < 0) newH += 360;
  if (newH >= 360) newH -= 360;
  let newS = hsl.s + satShift;
  newS = Math.max(0, Math.min(1, newS));
  return hslToRgb(newH, newS, hsl.l);
}

function applyTemperatureTint(
  r: number,
  g: number,
  b: number,
  temp: number,
  tint: number
): { r: number; g: number; b: number } {
  // 色温：正值为暖色（增红减蓝），负值为冷色（减红增蓝）
  const tempFactor = temp / 100;
  const nr = r + tempFactor * 30;
  const nb = b - tempFactor * 30;
  // 色调：正值为绿，负值为品红
  const tintFactor = tint / 100;
  const ng = g + tintFactor * 20;
  return {
    r: Math.max(0, Math.min(255, Math.round(nr))),
    g: Math.max(0, Math.min(255, Math.round(ng))),
    b: Math.max(0, Math.min(255, Math.round(nb))),
  };
}

function applyVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number,
  softness: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const radius = maxDist * (1 - softness);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vignette = Math.max(
        0,
        1 - Math.pow(Math.max(0, dist - radius) / (maxDist - radius), 2)
      );
      const factor = 1 - intensity * (1 - vignette);
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(data[idx] * factor);
      data[idx + 1] = Math.round(data[idx + 1] * factor);
      data[idx + 2] = Math.round(data[idx + 2] * factor);
    }
  }
}

function applySharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) return;

  const original = new Uint8ClampedArray(data);
  const kernel = [
    0,
    -amount,
    0,
    -amount,
    1 + 4 * amount,
    -amount,
    0,
    -amount,
    0,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += original[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        data[idx] = Math.max(0, Math.min(255, sum));
      }
    }
  }
}

export function applyColorGrade(
  source: HTMLCanvasElement,
  opts: ColorGradeOptions
): HTMLCanvasElement {
  const width = source.width;
  const height = source.height;

  // 第一步：应用基础滤镜
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext("2d")!;

  const filterParts = [
    `brightness(${opts.brightness})`,
    `contrast(${opts.contrast})`,
    `saturate(${opts.saturation})`,
    `hue-rotate(${opts.hueRotate}deg)`,
    `blur(${opts.blur}px)`,
    `grayscale(${opts.grayscale})`,
    `invert(${opts.invert})`,
  ];
  baseCtx.filter = filterParts.join(" ");
  baseCtx.drawImage(source, 0, 0);
  baseCtx.filter = "none";

  // 如果没有高级调整，直接返回
  if (
    opts.masterCurve.length <= 2 &&
    opts.redCurve.length <= 2 &&
    opts.greenCurve.length <= 2 &&
    opts.blueCurve.length <= 2 &&
    opts.temperature === 0 &&
    opts.tint === 0 &&
    opts.shadowHue === 0 &&
    opts.shadowSat === 0 &&
    opts.midtoneHue === 0 &&
    opts.midtoneSat === 0 &&
    opts.highlightHue === 0 &&
    opts.highlightSat === 0 &&
    opts.vignette === 0 &&
    opts.sharpen === 0
  ) {
    return baseCanvas;
  }

  // 第二步：逐像素处理高级调整
  const ctx = baseCanvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 构建曲线 LUT
  const masterLUT = buildCurveLUT(opts.masterCurve);
  const redLUT = buildCurveLUT(opts.redCurve);
  const greenLUT = buildCurveLUT(opts.greenCurve);
  const blueLUT = buildCurveLUT(opts.blueCurve);

  // 预计算色温/色调偏移
  const tempR = (opts.temperature / 100) * 30;
  const tempB = -(opts.temperature / 100) * 30;
  const tintG = (opts.tint / 100) * 20;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 曲线调整
    r = masterLUT[r];
    g = masterLUT[g];
    b = masterLUT[b];

    r = redLUT[r];
    g = greenLUT[g];
    b = blueLUT[b];

    // 色温/色调
    if (opts.temperature !== 0 || opts.tint !== 0) {
      r = Math.max(0, Math.min(255, r + tempR));
      g = Math.max(0, Math.min(255, g + tintG));
      b = Math.max(0, Math.min(255, b + tempB));
    }

    // 分区色轮调整
    const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    let hueShift = 0;
    let satShift = 0;

    if (luminance < 0.33 && opts.shadowHue !== 0) {
      hueShift = opts.shadowHue;
      satShift = opts.shadowSat / 100;
    } else if (luminance < 0.66 && opts.midtoneHue !== 0) {
      hueShift = opts.midtoneHue;
      satShift = opts.midtoneSat / 100;
    } else if (opts.highlightHue !== 0) {
      hueShift = opts.highlightHue;
      satShift = opts.highlightSat / 100;
    }

    if (hueShift !== 0 || satShift !== 0) {
      const adjusted = applyColorWheel(r, g, b, hueShift, satShift);
      r = adjusted.r;
      g = adjusted.g;
      b = adjusted.b;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  // 晕影
  if (opts.vignette > 0) {
    applyVignette(data, width, height, opts.vignette, opts.vignetteSoftness);
  }

  // 锐化
  if (opts.sharpen > 0) {
    applySharpen(data, width, height, opts.sharpen);
  }

  ctx.putImageData(imageData, 0, 0);

  return baseCanvas;
}
