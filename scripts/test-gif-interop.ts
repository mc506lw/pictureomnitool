// LZW/GIF 与 omggif（行业标准实现）互操作验证
import { lzwEncode, lzwDecode, encodeGif, decodeGif, medianCut } from "../src/lib/gif.ts";
import * as omggif from "omggif";
import sharp from "sharp";

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failures++;
  } else {
    console.log("PASS:", msg);
  }
}

const w = 48,
  h = 32;
// 构造丰富测试图：渐变 + 色块 + 少量透明
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = (x * 255) / w;
    data[i + 1] = (y * 255) / h;
    data[i + 2] = ((x + y) * 40) % 256;
    data[i + 3] = (x === 0 || y === 0) && (x + y) % 7 === 0 ? 0 : 255;
  }
}
const { palette, indices } = medianCut(data, 255, true);
const myGif = encodeGif(w, h, indices, palette, true);

// ---- 1. omggif 解码我的编码器输出 ----
try {
  const reader = new omggif.GifReader(myGif);
  const frameInfo = reader.frameInfo(0);
  const decoded = new Uint8ClampedArray(frameInfo.width * frameInfo.height * 4);
  reader.decodeAndBlitFrameRGBA(0, decoded);
  assert(
    frameInfo.width === w && frameInfo.height === h,
    "omggif 能解码我的 GIF（尺寸正确）"
  );

  let diffCount = 0;
  for (let i = 0; i < w * h; i++) {
    const idx = indices[i];
    let er, eg, eb, ea;
    if (idx === 0) {
      er = eg = eb = ea = 0;
    } else {
      const c = palette[idx - 1] || [0, 0, 0];
      er = c[0];
      eg = c[1];
      eb = c[2];
      ea = 255;
    }
    const o = i * 4;
    if (
      Math.abs(decoded[o] - er) > 3 ||
      Math.abs(decoded[o + 1] - eg) > 3 ||
      Math.abs(decoded[o + 2] - eb) > 3 ||
      Math.abs(decoded[o + 3] - ea) > 3
    ) {
      diffCount++;
      if (diffCount > 8) break;
    }
  }
  assert(diffCount === 0, "omggif 解码像素与预期一致");
} catch (e) {
  console.error("omggif 解码失败:", e.message);
  failures++;
}

// ---- 2. sharp 解码我的编码器输出 ----
try {
  const { data: raw, info } = await sharp(myGif).raw().toBuffer({ resolveWithObject: true });
  assert(info.width === w && info.height === h, "sharp 能解码我的 GIF（尺寸正确）");
  let diffCount = 0;
  for (let i = 0; i < w * h; i++) {
    const idx = indices[i];
    let er, eg, eb, ea;
    if (idx === 0) {
      er = eg = eb = ea = 0;
    } else {
      const c = palette[idx - 1] || [0, 0, 0];
      er = c[0];
      eg = c[1];
      eb = c[2];
      ea = 255;
    }
    const o = i * 4;
    if (
      Math.abs(raw[o] - er) > 3 ||
      Math.abs(raw[o + 1] - eg) > 3 ||
      Math.abs(raw[o + 2] - eb) > 3 ||
      Math.abs(raw[o + 3] - ea) > 3
    ) {
      diffCount++;
      if (diffCount > 8) break;
    }
  }
  assert(diffCount === 0, "sharp 解码像素与预期一致");
} catch (e) {
  console.error("sharp 解码失败:", e.message);
  failures++;
}

// ---- 3. 我的解码器解码 omggif 编码器输出 ----
try {
  // 用 omggif GifWriter 编码同一张图（透明保留）
  const padded = [...palette];
  while (padded.length < 256) padded.push([0, 0, 0]);
  const buf = new Uint8Array(w * h * 4 + 4096);
  const gifw = new omggif.GifWriter(buf, w, h, {
    palette: padded.map(([r, g, b]) => (r << 16) | (g << 8) | b),
  });
  gifw.addFrame(0, 0, w, h, indices, { transparent: 0 });
  gifw.end();
  const omggifBytes = buf.slice(0, gifw.getOutputBufferPosition());
  const frame = decodeGif(omggifBytes);
  assert(
    frame.width === w && frame.height === h,
    "我的解码器能解码 omggif 的 GIF（尺寸正确）"
  );
  let idxMatch = frame.indices.length === indices.length;
  for (let i = 0; i < indices.length; i++) {
    if (frame.indices[i] !== indices[i]) {
      idxMatch = false;
      break;
    }
  }
  assert(idxMatch, "我的解码器索引与 omggif 编码一致");
} catch (e) {
  console.error("omggif 编码/我的解码失败:", e.message);
  failures++;
}

console.log(failures === 0 ? "\n=== 全部通过 ===" : `\n=== ${failures} 项失败 ===`);
process.exit(failures === 0 ? 0 : 1);
