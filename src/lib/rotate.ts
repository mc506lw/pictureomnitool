/**
 * 旋转与翻转：任意角度旋转、水平/垂直翻转
 */

export type FlipMode = "none" | "horizontal" | "vertical";

export interface RotateFlipOptions {
  rotateDeg: number;
  flip: FlipMode;
}

export const DEFAULT_ROTATE_OPTIONS: RotateFlipOptions = {
  rotateDeg: 0,
  flip: "none",
};

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function applyRotateFlip(
  source: HTMLCanvasElement,
  opts: RotateFlipOptions
): HTMLCanvasElement {
  const deg = normalizeAngle(opts.rotateDeg);
  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const { width, height } = source;
  const newW = Math.round(width * cos + height * sin);
  const newH = Math.round(width * sin + height * cos);

  const out = document.createElement("canvas");
  out.width = newW;
  out.height = newH;
  const ctx = out.getContext("2d")!;

  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);

  let sx = 1;
  let sy = 1;
  if (opts.flip === "horizontal") sx = -1;
  if (opts.flip === "vertical") sy = -1;

  ctx.scale(sx, sy);
  ctx.drawImage(source, -width / 2, -height / 2);

  return out;
}
