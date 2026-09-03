import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import {
  lzwEncode,
  lzwDecode,
  encodeGif,
  decodeGif,
  medianCut,
} from "@/lib/gif";

describe("sharp + GIF interop", () => {
  let myGif: Uint8Array;
  let palette: [number, number, number][];
  let indices: Uint8Array;

  beforeAll(() => {
    const w = 32;
    const h = 32;
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

    const q = medianCut(data, 255, true);
    palette = q.palette;
    indices = q.indices;
    myGif = encodeGif(w, h, indices, palette, true);
  });

  it("matches sharp decoded RGB to quantized palette", async () => {
    const { data: raw, info } = await sharp(myGif, { animated: false })
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(32);
    expect(info.height).toBe(32);
    expect(info.channels).toBe(4);

    let diffCount = 0;
    for (let i = 0; i < raw.length / 4; i++) {
      const srcIdx = indices[i];
      let er: number, eg: number, eb: number, ea: number;
      if (srcIdx === 0) {
        er = eg = eb = ea = 0;
      } else {
        const c = palette[srcIdx - 1] || [0, 0, 0];
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

    expect(diffCount).toBe(0);
  });
});
