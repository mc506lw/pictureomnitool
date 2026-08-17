"use client";

import * as React from "react";
import { Crop, Play, Square, Scissors } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes, downloadBlob } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type CropAspect =
  "free" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16" | "2:3" | "circle";

const ASPECTS: { value: CropAspect; label: string }[] = [
  { value: "free", label: "自由" },
  { value: "1:1", label: "1:1 方形" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "2:3", label: "2:3 证件照" },
  { value: "circle", label: "圆形" },
];

function getAspectRatio(aspect: CropAspect): number | null {
  switch (aspect) {
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "3:2":
      return 3 / 2;
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "2:3":
      return 2 / 3;
    default:
      return null;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_DISPLAY_W = 660;
const MAX_DISPLAY_H = 460;

/** 交互式裁剪编辑器 */
function CropEditor({
  canvas,
  aspect,
  onChange,
}: {
  canvas: HTMLCanvasElement;
  aspect: CropAspect;
  onChange: (rect: Rect) => void;
}) {
  const displayRef = React.useRef<HTMLCanvasElement>(null);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [display, setDisplay] = React.useState({ w: 0, h: 0 });
  const [active, setActive] = React.useState(false);
  const dragState = React.useRef<{
    startX: number;
    startY: number;
    rectStartX: number;
    rectStartY: number;
    mode: "move" | "draw";
  } | null>(null);

  const srcW = canvas.width;
  const srcH = canvas.height;

  // 坐标锚点（左上角）
  const anchorRect = (w: number, h: number): Rect => {
    const x = Math.max(0, (srcW - w) / 2);
    const y = Math.max(0, (srcH - h) / 2);
    return { x, y, w: Math.min(w, srcW), h: Math.min(h, srcH) };
  };

  /** 生成指定比例下的默认选区（居中），free 为整张图 */
  const defaultRectForAspect = (asp: CropAspect): Rect => {
    const ratio = getAspectRatio(asp);
    if (!ratio || asp === "circle") {
      // free / circle 默认 80% 居中
      const w = srcW * 0.8;
      const h = srcH * 0.8;
      return { x: srcW * 0.1, y: srcH * 0.1, w, h };
    }
    let w = srcW * 0.8;
    let h = w / ratio;
    if (h > srcH * 0.8) {
      h = srcH * 0.8;
      w = h * ratio;
    }
    return anchorRect(w, h);
  };

  // 初始化显示区域
  React.useEffect(() => {
    const scale = Math.min(MAX_DISPLAY_W / srcW, MAX_DISPLAY_H / srcH, 1);
    const dw = Math.round(srcW * scale);
    const dh = Math.round(srcH * scale);
    setDisplay({ w: dw, h: dh });
    const d = displayRef.current;
    if (d) {
      d.width = dw;
      d.height = dh;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, srcW, srcH]);

  // aspect 变化 → 即时更换为对应比例的裁剪框（居中）
  React.useEffect(() => {
    const r = defaultRectForAspect(aspect);
    setRect(r);
    onChange(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, aspect, srcW, srcH]);

  // 绘制选区遮罩
  React.useEffect(() => {
    const d = displayRef.current;
    if (!d || !rect) return;
    const ctx = d.getContext("2d")!;
    const sx = display.w / srcW;
    const sy = display.h / srcH;
    // 重绘底图
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, display.w, display.h);
    ctx.fillStyle = "#e8e8e8";
    for (let y = 0; y < display.h; y += 8) {
      for (let x = 0; x < display.w; x += 8) {
        if ((x / 8 + y / 8) % 2 === 1) ctx.fillRect(x, y, 8, 8);
      }
    }
    ctx.drawImage(canvas, 0, 0, display.w, display.h);

    const rx = rect.x * sx;
    const ry = rect.y * sy;
    const rw = rect.w * sx;
    const rh = rect.h * sy;

    // 遮罩
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, display.w, ry);
    ctx.fillRect(0, ry + rh, display.w, display.h - ry - rh);
    ctx.fillRect(0, ry, rx, rh);
    ctx.fillRect(rx + rw, ry, display.w - rx - rw, rh);

    // 边框与手柄
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.fillStyle = "#3b82f6";
    const hs = 5;
    const corners = [
      [rx, ry],
      [rx + rw, ry],
      [rx, ry + rh],
      [rx + rw, ry + rh],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  }, [rect, display, canvas, srcW, srcH]);

  const toSource = (e: React.PointerEvent): { x: number; y: number } => {
    const d = displayRef.current!;
    const b = d.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * srcW;
    const py = ((e.clientY - b.top) / b.height) * srcH;
    return {
      x: Math.max(0, Math.min(srcW, px)),
      y: Math.max(0, Math.min(srcH, py)),
    };
  };

  const buildRect = (
    start: { x: number; y: number },
    cur: { x: number; y: number }
  ): Rect => {
    const ratio = getAspectRatio(aspect);
    let w = cur.x - start.x;
    let h = cur.y - start.y;
    if (ratio && Math.abs(w) > 1 && Math.abs(h) > 1) {
      if (Math.abs(w) / ratio > Math.abs(h)) h = w / ratio;
      else w = h * ratio;
    }
    // 边界约束
    if (start.x + w > srcW) {
      w = srcW - start.x;
      if (ratio) h = w / ratio;
    }
    if (start.y + h > srcH) {
      h = srcH - start.y;
      if (ratio) w = h * ratio;
    }
    if (start.x + w < 0) w = -start.x;
    if (start.y + h < 0) h = -start.y;
    const x = w >= 0 ? start.x : start.x + w;
    const y = h >= 0 ? start.y : start.y + h;
    return { x, y, w: Math.abs(w), h: Math.abs(h) };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!rect) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = toSource(e);
    const inside =
      p.x >= rect.x &&
      p.x <= rect.x + rect.w &&
      p.y >= rect.y &&
      p.y <= rect.y + rect.h;

    if (e.shiftKey || !inside) {
      // shift 或点击框外 → 重新框选
      dragState.current = {
        startX: p.x,
        startY: p.y,
        rectStartX: 0,
        rectStartY: 0,
        mode: "draw",
      };
    } else {
      // 默认左键在框内 → 拖动整个裁剪框
      dragState.current = {
        startX: p.x,
        startY: p.y,
        rectStartX: rect.x,
        rectStartY: rect.y,
        mode: "move",
      };
    }
    setActive(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const cur = toSource(e);
    if (ds.mode === "draw") {
      const r = buildRect({ x: ds.startX, y: ds.startY }, cur);
      setRect(r);
      onChange(r);
    } else {
      // 移动：约束在画布内
      const dx = cur.x - ds.startX;
      const dy = cur.y - ds.startY;
      const nx = Math.max(0, Math.min(srcW - rect!.w, ds.rectStartX + dx));
      const ny = Math.max(0, Math.min(srcH - rect!.h, ds.rectStartY + dy));
      const r = { ...rect!, x: nx, y: ny };
      setRect(r);
      onChange(r);
    }
  };

  const handlePointerUp = () => {
    dragState.current = null;
    setActive(false);
  };

  return (
    <div className="flex justify-center">
      <div className="relative inline-block">
        <canvas
          ref={displayRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={cn(
            "max-w-full rounded-lg border shadow-sm",
            active ? "cursor-crosshair" : "cursor-move"
          )}
          style={{ touchAction: "none", maxHeight: MAX_DISPLAY_H }}
        />
        {rect && (
          <div className="bg-background/90 absolute top-2 left-2 rounded px-2 py-1 text-[11px] font-medium shadow">
            {Math.round(rect.w)} × {Math.round(rect.h)} px
          </div>
        )}
      </div>
    </div>
  );
}

/** 将源图按选区裁出 */
function applyCrop(
  source: HTMLCanvasElement,
  rect: Rect,
  aspect: CropAspect
): HTMLCanvasElement {
  const r = Math.round(rect.x);
  const t = Math.round(rect.y);
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  if (aspect === "circle") {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(source, r, t, w, h, 0, 0, w, h);
  return out;
}

/** 默认中心裁剪（未手动调整时使用） */
function centerCrop(source: HTMLCanvasElement, aspect: CropAspect): Rect {
  const ratio = getAspectRatio(aspect);
  if (!ratio) {
    return { x: 0, y: 0, w: source.width, h: source.height };
  }
  let w = source.width;
  let h = source.height;
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  return { x: (source.width - w) / 2, y: (source.height - h) / 2, w, h };
}

export default function CropPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [aspect, setAspect] = React.useState<CropAspect>("1:1");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [rects, setRects] = React.useState<Record<string, Rect>>({});
  const [outputFormat, setOutputFormat] = React.useState<"png" | "jpeg">("png");
  const [preview, setPreview] = React.useState<string | null>(null);

  const readyItems = items.filter((i) => i.canvas);
  const selected = readyItems.find((i) => i.id === selectedId) ?? readyItems[0];

  // 默认选中第一个
  React.useEffect(() => {
    if (!selectedId && readyItems.length > 0) {
      setSelectedId(readyItems[0].id);
    }
  }, [readyItems, selectedId]);

  const handleRectChange = (rect: Rect) => {
    if (!selected) return;
    setRects((prev) => ({ ...prev, [selected.id]: rect }));
  };

  // 预览
  React.useEffect(() => {
    if (!selected?.canvas) return;
    const rect = rects[selected.id] ?? centerCrop(selected.canvas, aspect);
    const out = applyCrop(selected.canvas, rect, aspect);
    setPreview(out.toDataURL("image/png"));
  }, [selected, rects, aspect]);

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const rect = rects[item.id] ?? centerCrop(item.canvas, aspect);
      const cropped = applyCrop(item.canvas, rect, aspect);
      const blob = await encodeCanvas(cropped, outputFormat, { quality: 0.92 });
      const name = withExtension(item.name, outputFormat);
      updateItem(item.id, { result: { blob, name, size: blob.size } });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-8">
          <PageHeader
            icon={Crop}
            title="图片裁剪"
            description="自由裁剪、比例裁剪、圆形裁剪；调整选区后导出，或批量应用到所有图片"
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            {/* 左：编辑器 */}
            <div className="space-y-4">
              {items.length === 0 ? (
                <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
              ) : (
                <>
                  {/* 比例选择 */}
                  <div className="bg-card space-y-3 rounded-lg border p-4">
                    <div className="text-muted-foreground text-xs font-medium">
                      裁剪比例
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ASPECTS.map((a) => (
                        <button
                          key={a.value}
                          onClick={() => setAspect(a.value)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                            aspect === a.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className="text-muted-foreground text-xs">
                        输出格式
                      </span>
                      {(["png", "jpeg"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setOutputFormat(f)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            outputFormat === f
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selected?.canvas && (
                    <div className="bg-card space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground text-xs font-medium">
                          正在编辑：
                          <span className="text-foreground">
                            {selected.name}
                          </span>
                        </div>
                        {readyItems.length > 1 && (
                          <select
                            value={selected.id}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="border-input bg-background text-muted-foreground h-7 rounded-md border px-2 text-xs"
                          >
                            {readyItems.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <CropEditor
                        canvas={selected.canvas}
                        aspect={aspect}
                        onChange={handleRectChange}
                      />
                      <p className="text-muted-foreground text-center text-[11px]">
                        拖动框内 = 移动裁剪框 · Shift+拖拽 = 重新框选 ·
                        点击尺寸即时切换
                      </p>
                    </div>
                  )}

                  {/* 批量操作 */}
                  {readyItems.length > 1 && (
                    <button
                      onClick={() => {
                        if (!selected?.canvas) return;
                        const rect =
                          rects[selected.id] ??
                          centerCrop(selected.canvas, aspect);
                        const next: Record<string, Rect> = {};
                        for (const item of readyItems) next[item.id] = rect;
                        setRects(next);
                      }}
                      className="border-input bg-background hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors"
                    >
                      <Scissors className="h-4 w-4" />
                      将当前选区应用到全部 {readyItems.length} 张图片
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 右：预览 */}
            <div className="space-y-4">
              <div className="bg-card rounded-lg border p-4">
                <div className="text-muted-foreground mb-3 text-xs font-medium">
                  裁剪预览
                </div>
                {preview ? (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="裁剪预览"
                      className="max-h-72 w-full rounded border object-contain"
                    />
                    <div className="text-muted-foreground text-xs">
                      输出尺寸：
                      {selected
                        ? `${Math.round((rects[selected.id] ?? centerCrop(selected.canvas!, aspect)).w)} × ${Math.round((rects[selected.id] ?? centerCrop(selected.canvas!, aspect)).h)}`
                        : "-"}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-xs">
                    选择图片后显示预览
                  </p>
                )}
              </div>

              <div className="bg-card space-y-3 rounded-lg border p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  导出
                </div>
                {process.running ? (
                  <>
                    <Progress
                      value={(process.done / Math.max(1, process.total)) * 100}
                    />
                    <div className="text-muted-foreground flex items-center justify-between text-xs">
                      <span>
                        {process.done}/{process.total}
                      </span>
                      <button
                        onClick={process.cancel}
                        className="hover:text-destructive inline-flex items-center gap-1"
                      >
                        <Square className="h-3 w-3" />
                        取消
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={process.start}
                      disabled={items.length === 0}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      裁剪全部（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="cropped-images.zip"
                          className="w-full"
                        />
                        <button
                          onClick={() => {
                            const last = entries[entries.length - 1];
                            if (last) downloadBlob(last.blob, last.name);
                          }}
                          className="border-input bg-background hover:bg-accent inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors"
                        >
                          下载最新一张
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <BatchTable
              items={items}
              onRemove={removeItem}
              onClearAll={clearAll}
              showDimensions
              renderResult={(item) =>
                item.result ? (
                  <span className="text-muted-foreground">
                    {formatBytes(item.result.size)}
                  </span>
                ) : null
              }
            />
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
