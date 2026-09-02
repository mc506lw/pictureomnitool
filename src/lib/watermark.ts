/**
 * 水印工具：文字水印、图片水印、平铺/单点模式
 */
export interface WatermarkOptions {
  mode: "text" | "image";
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
    | "tile";
  rotate: number;
  padding: number;
}

export const DEFAULT_WATERMARK_OPTIONS: WatermarkOptions = {
  mode: "text",
  text: "PictureOmniTool",
  fontSize: 36,
  color: "#ffffff",
  opacity: 0.7,
  position: "bottom-right",
  rotate: -30,
  padding: 24,
};

type Position = WatermarkOptions["position"];

function getAnchor(
  position: Position,
  w: number,
  h: number,
  padding: number
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: padding, y: padding };
    case "top-center":
      return { x: w / 2, y: padding };
    case "top-right":
      return { x: w - padding, y: padding };
    case "center":
      return { x: w / 2, y: h / 2 };
    case "bottom-left":
      return { x: padding, y: h - padding };
    case "bottom-center":
      return { x: w / 2, y: h - padding };
    case "bottom-right":
      return { x: w - padding, y: h - padding };
    default:
      return { x: padding, y: padding };
  }
}

function drawTextWatermark(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  opts: WatermarkOptions
) {
  const { text, fontSize, color, opacity, position, rotate, padding } = opts;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (position === "tile") {
    const angle = (rotate * Math.PI) / 180;
    const metrics = ctx.measureText(text);
    const stepX = metrics.width + 120;
    const stepY = fontSize + 80;
    const cx = source.width / 2;
    const cy = source.height / 2;
    for (let y = -source.height; y < source.height * 2; y += stepY) {
      for (let x = -source.width; x < source.width * 2; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    }
  } else {
    const { x, y } = getAnchor(position, source.width, source.height, padding);
    ctx.translate(x, y);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}

async function loadImageWatermark(
  file: File
): Promise<HTMLImageElement | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("水印图片加载失败"));
      img.src = url;
    });
    return img;
  } catch {
    return null;
  }
}

export async function applyWatermark(
  source: HTMLCanvasElement,
  opts: WatermarkOptions,
  watermarkFile?: File
): Promise<HTMLCanvasElement> {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  if (opts.mode === "text") {
    drawTextWatermark(ctx, source, opts);
  } else if (opts.mode === "image" && watermarkFile) {
    const img = await loadImageWatermark(watermarkFile);
    if (!img) return out;

    const ratio = Math.min(0.4, Math.min(200 / img.width, 200 / img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const { x, y } = getAnchor(
      opts.position,
      source.width,
      source.height,
      opts.padding
    );
    ctx.save();
    ctx.globalAlpha = opts.opacity;
    ctx.translate(x, y);
    ctx.rotate((opts.rotate * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  return out;
}
