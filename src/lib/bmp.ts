/**
 * 位图（BMP）编码器
 * - 无透明：24 位 BI_RGB
 * - 有透明：32 位 BI_RGB（保留 Alpha 通道）
 */

export function canvasToBmp(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width: w, height: h, data } = img;

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      hasAlpha = true;
      break;
    }
  }

  const bpp = hasAlpha ? 32 : 24;
  const rowSize = Math.ceil((w * bpp) / 32) * 4;
  const pixelDataSize = rowSize * h;
  const fileSize = 14 + 40 + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // BITMAPFILEHEADER
  u8[0] = 0x42; // 'B'
  u8[1] = 0x4d; // 'M'
  v.setUint32(2, fileSize, true);
  v.setUint32(6, 0, true);
  v.setUint32(10, 54, true);

  // BITMAPINFOHEADER
  v.setUint32(14, 40, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true); // 正数 = 自底向上
  v.setUint16(26, 1, true);
  v.setUint16(28, bpp, true);
  v.setUint32(30, 0, true);
  v.setUint32(34, pixelDataSize, true);

  // 像素数据（自底向上，BGR 顺序）
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    let offset = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = srcRow + x * 4;
      u8[offset++] = data[i + 2]; // B
      u8[offset++] = data[i + 1]; // G
      u8[offset++] = data[i]; // R
      if (bpp === 32) u8[offset++] = data[i + 3]; // A
    }
  }

  return new Blob([buf], { type: "image/bmp" });
}
