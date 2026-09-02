/**
 * 拼图合并：横向/纵向拼接，支持间距和背景色
 */

export type MergeDirection = "horizontal" | "vertical";

export interface MergeOptions {
  direction: MergeDirection;
  spacing: number;
  background: string;
  align: "start" | "center" | "end";
}

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  direction: "horizontal",
  spacing: 0,
  background: "#ffffff",
  align: "center",
};

export function mergeImages(
  sources: HTMLCanvasElement[],
  opts: MergeOptions
): HTMLCanvasElement {
  if (sources.length === 0) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c;
  }

  const { direction, spacing, background, align } = opts;
  const isH = direction === "horizontal";

  let totalMain = 0;
  let maxCross = 0;
  for (const s of sources) {
    const main = isH ? s.width : s.height;
    const cross = isH ? s.height : s.width;
    totalMain += main;
    maxCross = Math.max(maxCross, cross);
  }

  const totalSpacing = spacing * Math.max(0, sources.length - 1);
  const finalMain = totalMain + totalSpacing;
  const finalCross = maxCross;

  const out = document.createElement("canvas");
  out.width = isH ? finalMain : finalCross;
  out.height = isH ? finalCross : finalMain;
  const ctx = out.getContext("2d")!;

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);

  let cursor = 0;
  for (const s of sources) {
    const main = isH ? s.width : s.height;
    const cross = isH ? s.height : s.width;
    const offsetMain = cursor;
    let offsetCross = 0;

    if (align === "center") offsetCross = (finalCross - cross) / 2;
    else if (align === "end") offsetCross = finalCross - cross;

    const dx = isH ? offsetMain : offsetCross;
    const dy = isH ? offsetCross : offsetMain;

    ctx.drawImage(s, dx, dy);
    cursor += main + spacing;
  }

  return out;
}
