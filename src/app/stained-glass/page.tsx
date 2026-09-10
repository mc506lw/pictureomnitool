"use client";

import * as React from "react";
import { Box, Play, Square as StopSquare, Settings2 } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { decodeImageFile, encodeCanvas } from "@/lib/image-utils";
import { getBaseName, formatBytes, withExtension, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

const PALETTE = [
  "#e11d48",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

export default function StainedGlassPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [cellSize, setCellSize] = React.useState(24);
  const [strokeWidth, setStrokeWidth] = React.useState(2);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      let src = item.canvas;
      if (!src) {
        if (!item.file) throw new Error("缺少图片文件");
        const decoded = await decodeImageFile(item.file);
        src = decoded.canvas;
      }
      const canvas = document.createElement("canvas");
      canvas.width = src.width;
      canvas.height = src.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(src, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      const sampleSize = Math.max(1, Math.floor(cellSize / 4));
      for (let y = 0; y < h; y += cellSize) {
        for (let x = 0; x < w; x += cellSize) {
          const region: { r: number; g: number; b: number; count: number }[] =
            [];
          for (let sy = 0; sy < cellSize; sy += sampleSize) {
            for (let sx = 0; sx < cellSize; sx += sampleSize) {
              const px = Math.min(w - 1, x + sx);
              const py = Math.min(h - 1, y + sy);
              const idx = (py * w + px) * 4;
              region.push({
                r: data[idx],
                g: data[idx + 1],
                b: data[idx + 2],
                count: 1,
              });
            }
          }
          const sum = region.reduce(
            (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
            { r: 0, g: 0, b: 0 }
          );
          const avg = {
            r: sum.r / region.length,
            g: sum.g / region.length,
            b: sum.b / region.length,
          };
          const target = PALETTE.reduce(
            (best, hex) => {
              const c = hex.replace("#", "");
              const rgb = [
                Number.parseInt(c.substring(0, 2), 16),
                Number.parseInt(c.substring(2, 4), 16),
                Number.parseInt(c.substring(4, 6), 16),
              ];
              const dist =
                Math.abs(avg.r - rgb[0]) +
                Math.abs(avg.g - rgb[1]) +
                Math.abs(avg.b - rgb[2]);
              return dist < best.dist ? { hex, dist } : best;
            },
            { hex: PALETTE[0], dist: Infinity }
          );

          const cw = Math.min(cellSize, w - x);
          const ch = Math.min(cellSize, h - y);
          ctx.fillStyle = target.hex;
          ctx.fillRect(x, y, cw, ch);
          if (strokeWidth > 0) {
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = strokeWidth;
            ctx.strokeRect(x, y, cw, ch);
          }
        }
      }

      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-stained`, format);
      updateItem(item.id, { result: { blob, name, size: blob.size } });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const readyCount = items.filter(
    (i) => i.status === "done" && i.result
  ).length;

  const handleReset = () => {
    clearAll();
    process.reset();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Box}
            title="彩色玻璃"
            description="将图片分割为色块并映射到彩色玻璃配色"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">玻璃选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  色块大小：
                  <span className="text-primary font-medium">{cellSize}px</span>
                </Label>
                <Slider
                  value={[cellSize]}
                  min={12}
                  max={64}
                  step={4}
                  onValueChange={(v) => setCellSize(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  描边宽度：
                  <span className="text-primary font-medium">
                    {strokeWidth}px
                  </span>
                </Label>
                <Slider
                  value={[strokeWidth]}
                  min={0}
                  max={6}
                  step={1}
                  onValueChange={(v) => setStrokeWidth(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>输出格式</Label>
                <div className="flex items-center gap-2 pt-1">
                  {(["png", "jpeg", "webp"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        format === f
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*" />
          ) : (
            <div className="space-y-4">
              <BatchTable
                items={items}
                onRemove={removeItem}
                onClearAll={handleReset}
                allowAdd
                onAdd={addFiles}
                renderResult={(item) =>
                  item.result ? (
                    <span className="text-muted-foreground">
                      {formatBytes(item.result.size)}
                    </span>
                  ) : null
                }
              />

              <div className="bg-card flex items-center gap-3 rounded-lg border p-4">
                {process.running ? (
                  <>
                    <Progress
                      value={(process.done / Math.max(1, process.total)) * 100}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {process.done}/{process.total}
                    </span>
                    <button
                      onClick={process.cancel}
                      className="border-input bg-background hover:bg-destructive hover:text-destructive-foreground inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors"
                    >
                      <StopSquare className="h-4 w-4" />
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={process.start}
                      disabled={items.length === 0 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      生成彩色玻璃（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <span className="text-muted-foreground text-xs">
                        已完成 {readyCount} 个
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
