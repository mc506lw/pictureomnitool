import { describe, it, expect, beforeAll } from "vitest";
import { medianCut, lzwEncode, encodeGif } from "@/lib/gif";
import { resampleImageData } from "@/lib/resample";
import {
  supportsEncode,
  FORMAT_LABELS,
  ENCODABLE_FORMATS,
} from "@/lib/image-utils";

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: string;
  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    height?: number
  ) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height!;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
    this.colorSpace = "srgb" as unknown as PredefinedColorSpace;
  }
}

beforeAll(() => {
  (globalThis as unknown as Record<string, unknown>).ImageData = MockImageData;
});

describe("resampleImageData", () => {
  it("throws for invalid size", () => {
    const src = new MockImageData(4, 4) as unknown as ImageData;
    expect(() => resampleImageData(src, 0, 4, "bilinear")).toThrow();
  });

  it("preserves dimensions when source equals target", () => {
    const src = new MockImageData(4, 4) as unknown as ImageData;
    const out = resampleImageData(src, 4, 4, "bilinear");
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
  });

  it("resizes to smaller dimensions with nearest", () => {
    const src = new MockImageData(4, 4) as unknown as ImageData;
    const out = resampleImageData(src, 2, 2, "nearest");
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect(out.data.length).toBe(2 * 2 * 4);
  });
});

describe("gif medianCut", () => {
  it("returns palette and indices for uniform color", () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
    ]);
    const { palette, indices } = medianCut(data, 4, false);
    expect(palette.length).toBeGreaterThan(0);
    expect(indices.length).toBe(4);
  });

  it("maps transparent pixels to index 0", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 255]);
    const { indices } = medianCut(data, 2, true);
    expect(indices[0]).toBe(0);
  });
});

describe("gif lzwEncode", () => {
  it("produces variable-length codes", () => {
    const out = lzwEncode(2, new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]));
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("gif encodeGif bytes", () => {
  it("starts with GIF89a header", () => {
    const bytes = encodeGif(1, 1, new Uint8Array([0]), [[0, 0, 0]], false);
    const header = String.fromCharCode(...bytes.slice(0, 6));
    expect(header).toBe("GIF89a");
  });
});

describe("image-utils", () => {
  it("labels include core formats", () => {
    expect(FORMAT_LABELS.png).toBe("PNG（无损）");
    expect(FORMAT_LABELS.webp).toBe("WebP");
    expect(FORMAT_LABELS.avif).toBe("AVIF");
  });

  it("encodes native formats when called from non-browser context", () => {
    expect(supportsEncode("png")).toBe(true);
    expect(supportsEncode("webp")).toBe(true);
    expect(supportsEncode("avif")).toBe(true);
    expect(supportsEncode("jpeg")).toBe(true);
    expect(ENCODABLE_FORMATS).toContain("png");
    expect(ENCODABLE_FORMATS).toContain("ico");
  });
});
