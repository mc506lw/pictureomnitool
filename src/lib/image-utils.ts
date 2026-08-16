/**
 * 图片统一处理工具：解码 / 编码 / 格式能力检测
 * 全部在浏览器本地完成，不上传任何数据
 */
import { canvasToBmp } from "./bmp";
import { canvasToGif } from "./gif";
import { canvasToIco } from "./icons";

/** 可解码的图片格式（浏览器原生 + SVG 栅格化） */
export const DECODABLE_FORMATS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
  "avif",
  "ico",
] as const;

/** 可编码输出的格式 */
export const ENCODABLE_FORMATS = [
  "png",
  "jpeg",
  "webp",
  "avif",
  "bmp",
  "gif",
  "ico",
] as const;

export type EncodeFormat = (typeof ENCODABLE_FORMATS)[number];

export const FORMAT_LABELS: Record<string, string> = {
  png: "PNG（无损）",
  jpeg: "JPEG（有损）",
  jpg: "JPEG",
  webp: "WebP",
  avif: "AVIF",
  bmp: "BMP",
  gif: "GIF",
  ico: "ICO 图标",
  svg: "SVG 矢量",
};

/** 解码后的图片 */
export interface DecodedImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  file: File;
  name: string;
  /** 原始扩展名（小写） */
  ext: string;
}

/** 最大处理尺寸（超出则按比例缩小，避免超出浏览器画布限制） */
export const MAX_DIMENSION = 8192;

/** 检测浏览器是否支持某种编码格式 */
export function supportsEncode(format: string): boolean {
  if (typeof document === "undefined") return true; // SSR 阶段不做检测
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
  };
  const mime = mimeMap[format];
  if (!mime) return true; // 自实现编码器
  const dataUrl = canvas.toDataURL(mime, 0.5);
  return dataUrl.startsWith(`data:${mime}`);
}

/** 浏览器原生可编码格式（实时检测） */
export function getSupportedEncodeFormats(): EncodeFormat[] {
  return ENCODABLE_FORMATS.filter((f) => supportsEncode(f));
}

/** 判断是否为图片文件 */
export function isImageFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    (DECODABLE_FORMATS as readonly string[]).includes(ext) ||
    file.type.startsWith("image/")
  );
}

/** 将 Blob/File 解码为画布（支持 SVG 栅格化，纠正 EXIF 方向） */
export async function decodeImageFile(file: File): Promise<DecodedImage> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let source: CanvasImageSource;
  let width: number;
  let height: number;

  // 优先使用 createImageBitmap（快、支持 EXIF 方向）
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
      colorSpaceConversion: "default",
    });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    // 回退到 <img> 加载（兼容 SVG 等）
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(url);
      width = img.naturalWidth || 1024;
      height = img.naturalHeight || 1024;
      source = img;
    } finally {
      // 延迟释放 URL，等绘制完成后由调用方负责
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }

  // 超大图限制
  const maxDim = MAX_DIMENSION;
  let scale = 1;
  if (width > maxDim || height > maxDim) {
    scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (scale < 1) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(source, 0, 0, width, height);

  if (
    "close" in source &&
    typeof (source as ImageBitmap).close === "function"
  ) {
    (source as ImageBitmap).close();
  }

  return { canvas, width, height, file, name: file.name, ext };
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = url;
  });
}

/** 画布转 Blob（含 Promise 封装） */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`编码 ${mime} 失败`))),
      mime,
      quality
    );
  });
}

export interface EncodeOptions {
  /** 有损格式质量 0~1 */
  quality?: number;
  /** JPEG 等不支持透明时填充的背景色（"#ffffff" 或 "transparent"） */
  backgroundColor?: string;
  /** ICO 尺寸集合 */
  icoSizes?: number[];
}

/**
 * 将画布编码为指定格式
 * JPEG 无透明通道：透明度区域填充背景色
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: EncodeFormat,
  options: EncodeOptions = {}
): Promise<Blob> {
  const { quality = 0.92, backgroundColor, icoSizes } = options;

  if (format === "bmp") return canvasToBmp(canvas);
  if (format === "gif") return canvasToGif(canvas);
  if (format === "ico") {
    return canvasToIco(canvas, icoSizes ?? [16, 24, 32, 48, 64, 128, 256]);
  }

  const needsBg =
    format === "jpeg" && backgroundColor && backgroundColor !== "transparent";

  let target = canvas;
  if (needsBg) {
    target = document.createElement("canvas");
    target.width = canvas.width;
    target.height = canvas.height;
    const ctx = target.getContext("2d")!;
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(canvas, 0, 0);
  }

  const mimeMap: Partial<Record<EncodeFormat, string>> = {
    png: "image/png",
    jpeg: "image/jpeg",
    webp: "image/webp",
    avif: "image/avif",
  };
  const mime = mimeMap[format];
  if (!mime) throw new Error(`不支持的格式: ${format}`);
  return canvasToBlob(target, mime, quality);
}

/** 生成预览缩略图 URL */
export function makeThumbnail(canvas: HTMLCanvasElement, maxSize = 96): string {
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(canvas.width * scale));
  t.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL("image/png");
}

/** 生成包含透明背景的棋盘格图案（用于预览透明图） */
export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell = 8
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#e5e5e5";
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if ((x / cell + y / cell) % 2 === 0) continue;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}
