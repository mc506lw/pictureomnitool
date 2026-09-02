/**
 * 基础调色：亮度、对比度、饱和度、色相、模糊、灰度、反色
 */

export interface AdjustOptions {
  brightness: number; // 0~2, default 1
  contrast: number; // 0~2, default 1
  saturation: number; // 0~2, default 1
  hueRotate: number; // 0~360, default 0
  blur: number; // 0~20, default 0
  grayscale: number; // 0~1, default 0
  invert: number; // 0~1, default 0
}

export const DEFAULT_ADJUST_OPTIONS: AdjustOptions = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hueRotate: 0,
  blur: 0,
  grayscale: 0,
  invert: 0,
};

export function applyAdjust(
  source: HTMLCanvasElement,
  opts: AdjustOptions
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d")!;

  const filter = [
    `brightness(${opts.brightness})`,
    `contrast(${opts.contrast})`,
    `saturate(${opts.saturation})`,
    `hue-rotate(${opts.hueRotate}deg)`,
    `blur(${opts.blur}px)`,
    `grayscale(${opts.grayscale})`,
    `invert(${opts.invert})`,
  ].join(" ");

  ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";

  return out;
}
