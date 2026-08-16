// GIF 编码器自校验：LZW 往返 + 全流程往返 + sharp（真实解码器）交叉验证
import { lzwEncode, lzwDecode, encodeGif, decodeGif, medianCut } from "../src/lib/gif.ts";
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

// ---- LZW 往返测试 ----
function testLzw(name, minCodeSize, pixels) {
  const encoded = lzwEncode(minCodeSize, pixels);
  const decoded = lzwDecode(minCodeSize, encoded);
  let ok = decoded.length === pixels.length;
  if (ok) {
    for (let i = 0; i < pixels.length; i++) {
      if (decoded[i] !== pixels[i]) {
        ok = false;
        break;
      }
    }
  }
  assert(ok, `LZW round-trip: ${name} (${pixels.length} px, minCode=${minCodeSize})`);
}

function makePattern(len, maxVal) {
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = (i * 7 + 3) % maxVal;
  return arr;
}

testLzw("4色渐变", 2, makePattern(1000, 4));
testLzw("8色随机", 3, Uint8Array.from({ length: 5000 }, () => Math.floor(Math.random() * 8)));
testLzw("256色", 8, makePattern(20000, 256));
testLzw("常数序列", 2, new Uint8Array(3000).fill(1));
testLzw("全字典增长", 8, makePattern(100000, 256));

// ---- 全流程往返 ----
const w = 32,
  h = 32;
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = (x * 8) % 256;
    data[i + 1] = (y * 8) % 256;
    data[i + 2] = ((x + y) * 4) % 256;
    data[i + 3] = x === 0 && y === 0 ? 0 : 255;
  }
}

const { palette, indices } = medianCut(data, 255, true);
const gif = encodeGif(w, h, indices, palette, true);
const frame = decodeGif(gif);

assert(frame.width === w && frame.height === h, "GIF 尺寸正确");
assert(frame.transparentIndex === 0, "透明索引为 0");
assert(frame.palette.length >= 1, "调色板非空");

// 索引逐像素对比（GIF 存储的就是量化索引）
let idxMatch = frame.indices.length === indices.length;
for (let i = 0; i < indices.length; i++) {
  if (frame.indices[i] !== indices[i]) {
    idxMatch = false;
    break;
  }
}
assert(idxMatch, "GIF 索引逐像素往返一致");

// GIF 魔数
const magic = String.fromCharCode(gif[0], gif[1], gif[2], gif[3], gif[4], gif[5]);
assert(magic === "GIF89a", `GIF 文件头正确 (${magic})`);

// ---- sharp 真实解码器交叉验证 ----
try {
  const { data: raw, info } = await sharp(gif, { animated: false })
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert(info.width === w && info.height === h, "sharp 解码尺寸正确");
  assert(info.channels === 4, "sharp 解码为 RGBA");

  let diffCount = 0;
  for (let i = 0; i < w * h; i++) {
    const srcIdx = indices[i];
    let er, eg, eb, ea;
    if (srcIdx === 0 && frame.transparentIndex === 0) {
      er = eg = eb = ea = 0;
    } else {
      const palIdx = frame.transparentIndex === 0 ? srcIdx - 1 : srcIdx;
      const c = palette[palIdx] || [0, 0, 0];
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
  assert(diffCount === 0, `sharp 解码像素与预期一致（误差≤3）`);
} catch (e) {
  console.error("sharp 验证失败:", e.message);
  failures++;
}

console.log(failures === 0 ? "\n=== 全部通过 ===" : `\n=== ${failures} 项失败 ===`);
process.exit(failures === 0 ? 0 : 1);
