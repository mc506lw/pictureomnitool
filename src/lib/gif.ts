/**
 * GIF89a 编码器
 * - 中位切分（Median Cut）量化到 256 色
 * - LZW 压缩（GIF 变体，含 early-change 规则）
 * - 支持全透明像素（GCE 透明索引）
 */

export interface GifOptions {
  /** 最大颜色数（2~256） */
  maxColors?: number;
}

/** 从 ImageData 生成 GIF Blob */
export function canvasToGif(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imgData;

  const maxColors = 256;
  const hasTransparency = detectTransparency(data);
  const paletteSize = hasTransparency ? maxColors - 1 : maxColors;

  // 中位切分量化
  const { palette, indices } = medianCut(data, paletteSize, hasTransparency);

  const bytes = encodeGif(width, height, indices, palette, hasTransparency);
  return new Blob([bytes], { type: "image/gif" });
}

function detectTransparency(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 128) return true;
  }
  return false;
}

/** 中位切分量化，返回调色板与像素索引 */
export function medianCut(
  data: Uint8ClampedArray,
  maxColors: number,
  hasTransparency: boolean
): { palette: [number, number, number][]; indices: Uint8Array } {
  const pixelCount = data.length / 4;
  // 收集不透明像素
  interface ColorBox {
    r: number;
    g: number;
    b: number;
    pixels: number[]; // 像素下标（按 data 坐标）
  }

  const allPixels: number[] = [];
  for (let i = 0; i < pixelCount; i++) {
    if (!hasTransparency || data[i * 4 + 3] >= 128) allPixels.push(i);
  }

  const boxes: ColorBox[] = [];
  if (allPixels.length > 0) {
    boxes.push({
      r: 0,
      g: 0,
      b: 0,
      pixels: allPixels,
    });
  }

  // 分割直到达到颜色上限或不可再分
  while (boxes.length < maxColors) {
    // 找可分割且像素最多的盒子
    let bestIdx = -1;
    let bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.pixels.length < 2) continue;
      const range = colorRange(box, data);
      if (range > bestRange) {
        bestRange = range;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    const box = boxes[bestIdx];
    // 按最大通道排序，取中位数分割
    const channel = maxChannel(box, data);
    const sorted = [...box.pixels].sort(
      (a, b) => data[a * 4 + channel] - data[b * 4 + channel]
    );
    const mid = Math.floor(sorted.length / 2);
    boxes.splice(bestIdx, 1);
    boxes.push({ r: 0, g: 0, b: 0, pixels: sorted.slice(0, mid) });
    boxes.push({ r: 0, g: 0, b: 0, pixels: sorted.slice(mid) });
  }

  // 每个盒子取平均色作为调色板项
  const palette: [number, number, number][] = [];
  const boxOfPixel = new Int32Array(pixelCount).fill(-1);
  boxes.forEach((box, idx) => {
    let r = 0,
      g = 0,
      b = 0;
    for (const p of box.pixels) {
      r += data[p * 4];
      g += data[p * 4 + 1];
      b += data[p * 4 + 2];
      boxOfPixel[p] = idx;
    }
    const n = box.pixels.length || 1;
    palette.push([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
  });

  // 透明像素占索引 0
  const transparentIndex = hasTransparency ? 0 : -1;
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    if (hasTransparency && data[i * 4 + 3] < 128) {
      indices[i] = transparentIndex;
    } else {
      indices[i] =
        boxOfPixel[i] >= 0 ? boxOfPixel[i] + (hasTransparency ? 1 : 0) : 0;
    }
  }

  return { palette, indices };
}

function colorRange(
  box: { pixels: number[] },
  data: Uint8ClampedArray
): number {
  let minR = 255,
    maxR = 0,
    minG = 255,
    maxG = 0,
    minB = 255,
    maxB = 0;
  for (const p of box.pixels) {
    const i = p * 4;
    minR = Math.min(minR, data[i]);
    maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]);
    maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]);
    maxB = Math.max(maxB, data[i + 2]);
  }
  return Math.max(maxR - minR, maxG - minG, maxB - minB);
}

function maxChannel(
  box: { pixels: number[] },
  data: Uint8ClampedArray
): number {
  let minR = 255,
    maxR = 0,
    minG = 255,
    maxG = 0,
    minB = 255,
    maxB = 0;
  for (const p of box.pixels) {
    const i = p * 4;
    minR = Math.min(minR, data[i]);
    maxR = Math.max(maxR, data[i]);
    minG = Math.min(minG, data[i + 1]);
    maxG = Math.max(maxG, data[i + 1]);
    minB = Math.min(minB, data[i + 2]);
    maxB = Math.max(maxB, data[i + 2]);
  }
  const rangeR = maxR - minR;
  const rangeG = maxG - minG;
  const rangeB = maxB - minB;
  if (rangeR >= rangeG && rangeR >= rangeB) return 0;
  if (rangeG >= rangeB) return 1;
  return 2;
}

/** GIF LZW 编码（含 early-change：添加条目后 nextCode === 1<<codeSize 时增加码长） */
export function lzwEncode(
  minCodeSize: number,
  pixels: Uint8Array
): Uint8Array<ArrayBuffer> {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const dict = new Map<string, number>();
  let nextCode = eoiCode + 1;
  let bitBuf = 0;
  let bitCnt = 0;
  const out: number[] = [];
  const MAX_ENTRIES = 4096;

  const emit = (code: number) => {
    bitBuf |= code << bitCnt;
    bitCnt += codeSize;
    while (bitCnt >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCnt -= 8;
    }
  };

  const resetDict = () => {
    dict.clear();
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
    for (let i = 0; i < 1 << minCodeSize; i++) {
      dict.set(String.fromCharCode(i), i);
    }
  };

  emit(clearCode);
  resetDict();

  let w = "";
  for (let i = 0; i < pixels.length; i++) {
    const k = String.fromCharCode(pixels[i]);
    const wk = w + k;
    if (w !== "" && dict.has(wk)) {
      w = wk;
    } else {
      if (w !== "") {
        emit(dict.get(w)!);
        if (nextCode < MAX_ENTRIES) {
          // omggif/规范规则：分配新条目前，若编号达到当前码长上限则提前加宽
          if (nextCode >= 1 << codeSize && codeSize < 12) codeSize++;
          dict.set(wk, nextCode++);
        } else {
          emit(clearCode);
          resetDict();
        }
      }
      w = k;
    }
  }
  if (w !== "") emit(dict.get(w)!);
  emit(eoiCode);
  if (bitCnt > 0) out.push(bitBuf & 0xff);
  return new Uint8Array(out);
}

/** 组装 GIF 文件字节 */
export function encodeGif(
  width: number,
  height: number,
  indices: Uint8Array,
  palette: [number, number, number][],
  hasTransparency: boolean
): Uint8Array<ArrayBuffer> {
  const colorCount = hasTransparency ? palette.length + 1 : palette.length;
  // 调色板大小：2 的幂
  let tableBits = 1;
  while (1 << tableBits < colorCount) tableBits++;
  if (tableBits < 1) tableBits = 1;
  const tableSize = 1 << tableBits;

  const minCodeSize = Math.max(2, tableBits);
  const lzwData = lzwEncode(minCodeSize, indices);

  // 组装字节
  const chunks: Uint8Array[] = [];

  // Header
  chunks.push(ascii("GIF89a"));

  // Logical Screen Descriptor
  const lsd = new Uint8Array(7);
  lsd[0] = width & 0xff;
  lsd[1] = (width >> 8) & 0xff;
  lsd[2] = height & 0xff;
  lsd[3] = (height >> 8) & 0xff;
  lsd[4] = 0x80 | ((tableBits - 1) << 4) | (tableBits - 1); // GCT flag + size
  lsd[5] = 0; // background
  lsd[6] = 0; // aspect
  chunks.push(lsd);

  // Global Color Table（补齐到 2 的幂）
  // 透明模式下索引 0 为透明占位，调色板从索引 1 开始写
  const gct = new Uint8Array(tableSize * 3);
  const gctOffset = hasTransparency ? 1 : 0;
  for (let i = 0; i < palette.length; i++) {
    const idx = (i + gctOffset) * 3;
    gct[idx] = palette[i][0];
    gct[idx + 1] = palette[i][1];
    gct[idx + 2] = palette[i][2];
  }
  chunks.push(gct);

  // Graphic Control Extension（透明度）
  if (hasTransparency) {
    const gce = new Uint8Array(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 4;
    gce[3] = 0x01; // transparent color flag
    gce[4] = 0x00;
    gce[5] = 0x00; // delay
    gce[6] = 0; // transparent index
    gce[7] = 0x00;
    chunks.push(gce);
  }

  // Image Descriptor
  const id = new Uint8Array(10);
  id[0] = 0x2c;
  id[1] = 0;
  id[2] = 0;
  id[3] = 0;
  id[4] = 0;
  id[5] = width & 0xff;
  id[6] = (width >> 8) & 0xff;
  id[7] = height & 0xff;
  id[8] = (height >> 8) & 0xff;
  id[9] = 0; // no local color table
  chunks.push(id);

  // Image Data（最小码长 + 子块）
  const minCode = new Uint8Array([minCodeSize]);
  chunks.push(minCode);

  // 子块
  const maxBlock = 255;
  for (let i = 0; i < lzwData.length; i += maxBlock) {
    const len = Math.min(maxBlock, lzwData.length - i);
    const block = new Uint8Array(len + 1);
    block[0] = len;
    block.set(lzwData.subarray(i, i + len), 1);
    chunks.push(block);
  }
  chunks.push(new Uint8Array([0x00])); // block terminator

  // Trailer
  chunks.push(ascii(";"));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

function ascii(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

// ---------------------------------------------------------------------------
// GIF 解码器（用于自校验 / 测试，保证编码器与标准解码规则一致）
// ---------------------------------------------------------------------------

export interface DecodedGifFrame {
  width: number;
  height: number;
  indices: Uint8Array;
  palette: [number, number, number][];
  transparentIndex: number;
}

export function decodeGif(bytes: Uint8Array): DecodedGifFrame {
  if (
    asciiStr(bytes.subarray(0, 6)) !== "GIF89a" &&
    asciiStr(bytes.subarray(0, 6)) !== "GIF87a"
  ) {
    throw new Error("不是有效的 GIF 文件");
  }
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  const gctFlag = packed & 0x80;
  const tableBits = (packed & 0x07) + 1;
  let offset = 13;
  const globalPalette: [number, number, number][] = [];
  if (gctFlag) {
    const size = 1 << tableBits;
    for (let i = 0; i < size; i++) {
      globalPalette.push([
        bytes[offset + i * 3],
        bytes[offset + i * 3 + 1],
        bytes[offset + i * 3 + 2],
      ]);
    }
    offset += size * 3;
  }

  let transparentIndex = -1;
  let indices = new Uint8Array(width * height);
  let palette = globalPalette;

  // 遍历块
  while (offset < bytes.length) {
    const blockId = bytes[offset];
    if (blockId === 0x21) {
      // 扩展块
      const label = bytes[offset + 1];
      let pos = offset + 2;
      if (label === 0xf9) {
        const size = bytes[pos];
        const flags = bytes[pos + 1];
        if (flags & 0x01) transparentIndex = bytes[pos + 4];
        pos += size + 1;
        // terminator
        pos += 1;
      } else {
        // 跳过子块
        while (bytes[pos] !== 0) pos += bytes[pos] + 1;
        pos += 1;
      }
      offset = pos;
    } else if (blockId === 0x2c) {
      // 图像描述符
      let pos = offset + 1;
      const imgLeft = bytes[pos] | (bytes[pos + 1] << 8);
      const imgTop = bytes[pos + 2] | (bytes[pos + 3] << 8);
      const imgW = bytes[pos + 4] | (bytes[pos + 5] << 8);
      const imgH = bytes[pos + 6] | (bytes[pos + 7] << 8);
      const imgPacked = bytes[pos + 8];
      pos += 9;
      const lct: [number, number, number][] = [];
      if (imgPacked & 0x80) {
        const bits = (imgPacked & 0x07) + 1;
        const size = 1 << bits;
        for (let i = 0; i < size; i++) {
          lct.push([
            bytes[pos + i * 3],
            bytes[pos + i * 3 + 1],
            bytes[pos + i * 3 + 2],
          ]);
        }
        pos += size * 3;
      }
      palette = imgPacked & 0x80 ? lct : globalPalette;
      const minCodeSize = bytes[pos];
      pos += 1;
      // 收集子块
      const blocks: number[] = [];
      while (bytes[pos] !== 0) {
        const len = bytes[pos];
        for (let i = 0; i < len; i++) blocks.push(bytes[pos + 1 + i]);
        pos += len + 1;
      }
      pos += 1;
      const lzw = new Uint8Array(blocks);
      const decoded = lzwDecode(minCodeSize, lzw);
      // 组合到画布（暂只处理全尺寸图像）
      if (imgLeft === 0 && imgTop === 0 && imgW === width && imgH === height) {
        indices = decoded;
      }
      offset = pos;
    } else if (blockId === 0x3b) {
      break;
    } else {
      break;
    }
  }

  return { width, height, indices, palette, transparentIndex };
}

/** GIF LZW 解码（标准规则：添加条目后 dict 数量 === 1<<codeSize 时码长+1） */
export function lzwDecode(
  minCodeSize: number,
  data: Uint8Array
): Uint8Array<ArrayBuffer> {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  let nextCode = eoiCode + 1;

  // GIF 字典：单码占 0..(2^minCodeSize-1)，新条目从 eoiCode+1 开始编号（clear/eoi 不占条目）
  const resetDict = () => {
    dict = new Array(1 << minCodeSize);
    for (let i = 0; i < 1 << minCodeSize; i++) dict[i] = [i];
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
  };
  resetDict();

  let bitBuf = 0;
  let bitCnt = 0;
  let pos = 0;
  const readCode = (): number => {
    while (bitCnt < codeSize) {
      if (pos >= data.length) return -1;
      bitBuf |= data[pos++] << bitCnt;
      bitCnt += 8;
    }
    const code = bitBuf & ((1 << codeSize) - 1);
    bitBuf >>>= codeSize;
    bitCnt -= codeSize;
    return code;
  };

  const out: number[] = [];
  let oldCode = -1;
  while (true) {
    const code = readCode();
    if (code < 0 || code === eoiCode) break;
    if (code === clearCode) {
      resetDict();
      oldCode = -1;
      continue;
    }
    let entry: number[];
    if (code < nextCode && dict[code]) {
      entry = dict[code];
    } else if (code === nextCode && oldCode !== -1) {
      // KwKwK 情形：码指向即将添加的条目
      entry = [...dict[oldCode], dict[oldCode][0]];
    } else {
      break;
    }
    out.push(...entry);
    if (oldCode !== -1 && nextCode < 4096) {
      dict[nextCode] = [...dict[oldCode], entry[0]];
      nextCode++;
      // omggif/规范规则：分配新条目后，若编号达到当前码长上限则加宽
      if (nextCode >= 1 << codeSize && codeSize < 12) codeSize++;
    }
    oldCode = code;
  }
  return new Uint8Array(out);
}

function asciiStr(arr: Uint8Array): string {
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}

/** 将解码的 GIF 帧渲染为 ImageData（含透明） */
export function gifFrameToImageData(frame: DecodedGifFrame): ImageData {
  const { width, height, indices, palette, transparentIndex } = frame;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx === transparentIndex) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const color = palette[idx] || [0, 0, 0];
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}
