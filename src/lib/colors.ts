/**
 * 颜色提取：主色调、调色板、 Dominant Color
 */

export interface ExtractedColor {
  color: string;
  ratio: number;
  count: number;
}

export interface ColorExtractOptions {
  maxColors: number;
  minBrightness: number;
  maxBrightness: number;
}

export const DEFAULT_COLOR_OPTIONS: ColorExtractOptions = {
  maxColors: 6,
  minBrightness: 0,
  maxBrightness: 255,
};

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function extractColors(
  source: HTMLCanvasElement,
  opts: ColorExtractOptions = DEFAULT_COLOR_OPTIONS
): ExtractedColor[] {
  const ctx = source.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, source.width, source.height);
  const data = imageData.data;

  const colorMap = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();

  const step = 16;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const bri = brightness(r, g, b);
    if (bri < opts.minBrightness || bri > opts.maxBrightness) continue;

    const qr = quantize(r, step);
    const qg = quantize(g, step);
    const qb = quantize(b, step);
    const key = `${qr},${qg},${qb}`;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { count: 1, r: qr, g: qg, b: qb });
    }
  }

  const totalPixels = Array.from(colorMap.values()).reduce(
    (s, c) => s + c.count,
    0
  );

  const colors = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, opts.maxColors)
    .map((c) => ({
      color: rgbToHex(c.r, c.g, c.b),
      ratio: totalPixels > 0 ? c.count / totalPixels : 0,
      count: c.count,
    }));

  return colors;
}
