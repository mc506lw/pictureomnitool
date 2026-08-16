/**
 * ICO / ICNS 编码器
 * - ICO：PNG 压缩条目（现代 Windows / 浏览器均支持），可多尺寸
 * - ICNS：PNG 块格式（macOS）
 */

/** 将画布编码为 PNG Blob */
async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG 编码失败"))),
      "image/png"
    );
  });
}

/** 等比缩放画布到目标尺寸（contain，透明底） */
function scaleCanvasContain(
  source: HTMLCanvasElement,
  size: number,
  background?: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  const scale = Math.min(size / source.width, size / source.height);
  const dw = Math.max(1, Math.round(source.width * scale));
  const dh = Math.max(1, Math.round(source.height * scale));
  const dx = Math.round((size - dw) / 2);
  const dy = Math.round((size - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, dx, dy, dw, dh);
  return canvas;
}

/** 生成多尺寸 ICO 文件（PNG 压缩条目） */
export async function canvasToIco(
  source: HTMLCanvasElement,
  sizes: number[] = [16, 24, 32, 48, 64, 128, 256]
): Promise<Blob> {
  const unique = [...new Set(sizes)].sort((a, b) => a - b);
  const pngs: Blob[] = [];
  for (const size of unique) {
    const scaled = scaleCanvasContain(source, size);
    pngs.push(await canvasToPngBlob(scaled));
  }

  const headerSize = 6;
  const dirSize = 16 * unique.length;
  const chunks: (Blob | Uint8Array<ArrayBuffer>)[] = [];

  // ICONDIR
  const header = new Uint8Array(headerSize);
  const hv = new DataView(header.buffer);
  hv.setUint16(0, 0, true); // reserved
  hv.setUint16(2, 1, true); // type: icon
  hv.setUint16(4, unique.length, true);
  chunks.push(header);

  // ICONDIRENTRY
  let offset = headerSize + dirSize;
  const dirs: Uint8Array<ArrayBuffer>[] = [];
  for (let i = 0; i < unique.length; i++) {
    const size = unique[i];
    const entry = new Uint8Array(16);
    const ev = new DataView(entry.buffer);
    entry[0] = size >= 256 ? 0 : size; // width
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // color count
    entry[3] = 0; // reserved
    ev.setUint16(4, 1, true); // planes
    ev.setUint16(6, 32, true); // bit count
    ev.setUint32(8, pngs[i].size, true); // bytes in resource
    ev.setUint32(12, offset, true); // image offset
    offset += pngs[i].size;
    dirs.push(entry);
  }
  chunks.push(...dirs);
  chunks.push(...pngs);

  const blob = new Blob(chunks, { type: "image/x-icon" });
  return blob;
}

/** ICNS 块类型与对应像素尺寸（含 @2x 视网膜块） */
const ICNS_TYPES: { type: string; size: number }[] = [
  { type: "ic07", size: 128 },
  { type: "ic08", size: 256 },
  { type: "ic09", size: 512 },
  { type: "ic10", size: 1024 },
  { type: "ic11", size: 32 }, // 16pt @2x
  { type: "ic12", size: 64 }, // 32pt @2x
  { type: "ic13", size: 256 }, // 128pt @2x
  { type: "ic14", size: 512 }, // 256pt @2x
];

/** 生成 macOS ICNS 文件 */
export async function canvasToIcns(source: HTMLCanvasElement): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let totalSize = 8;

  for (const { type, size } of ICNS_TYPES) {
    const scaled = scaleCanvasContain(source, size);
    const png = await canvasToPngBlob(scaled);
    const pngBytes = new Uint8Array(await png.arrayBuffer());
    const chunkLen = 8 + pngBytes.length;
    const chunk = new Uint8Array(chunkLen);
    const cv = new DataView(chunk.buffer);
    chunk[0] = type.charCodeAt(0);
    chunk[1] = type.charCodeAt(1);
    chunk[2] = type.charCodeAt(2);
    chunk[3] = type.charCodeAt(3);
    cv.setUint32(4, chunkLen, false); // 大端
    chunk.set(pngBytes, 8);
    chunks.push(chunk);
    totalSize += chunkLen;
  }

  const result = new Uint8Array(totalSize);
  const rv = new DataView(result.buffer);
  result[0] = 0x69; // 'i'
  result[1] = 0x63; // 'c'
  result[2] = 0x6e; // 'n'
  result[3] = 0x73; // 's'
  rv.setUint32(4, totalSize, false);
  let offset = 8;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return new Blob([result], { type: "image/x-icns" });
}

/** 生成单一尺寸 PNG（用于图标集合中的 PNG 文件） */
export async function canvasToPng(
  source: HTMLCanvasElement,
  size: number
): Promise<Blob> {
  const scaled = scaleCanvasContain(source, size);
  return canvasToPngBlob(scaled);
}
