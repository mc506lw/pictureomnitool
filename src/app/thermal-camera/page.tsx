"use client";

import * as React from "react";
import {
  Thermometer,
  Play,
  Square as StopSquare,
  Settings2,
} from "lucide-react";
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

const THERMAL_PALETTES: Record<string, [number, number, number][]> = {
  iron: [
    [0, 0, 0],
    [59, 76, 192],
    [68, 1, 84],
    [72, 44, 118],
    [62, 73, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [180, 222, 44],
    [253, 231, 37],
  ],
  rainbow: [
    [0, 0, 0],
    [20, 0, 80],
    [60, 0, 180],
    [0, 0, 255],
    [0, 180, 255],
    [0, 255, 0],
    [255, 255, 0],
    [255, 100, 0],
    [255, 0, 0],
    [255, 255, 255],
  ],
};

export default function ThermalCameraPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [blur, setBlur] = React.useState(2);
  const [contrast, setContrast] = React.useState(1.2);
  const [palette, setPalette] = React.useState<"iron" | "rainbow">("iron");
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const thermalColors = THERMAL_PALETTES[palette] || THERMAL_PALETTES.iron;

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

      // Compute luminance and apply contrast
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const gray =
          (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) /
          255;
        lum[i] = Math.min(1, Math.max(0, (gray - 0.5) * contrast + 0.5));
      }

      // Box blur for smoothing
      const blurred = new Float32Array(w * h);
      const radius = Math.max(0, Math.round(blur));
      if (radius > 0) {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            let sum = 0;
            let count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = Math.min(w - 1, Math.max(0, x + dx));
                const ny = Math.min(h - 1, Math.max(0, y + dy));
                sum += lum[ny * w + nx];
                count++;
              }
            }
            blurred[y * w + x] = sum / count;
          }
        }
      } else {
        blurred.set(lum);
      }

      const colors = thermalColors;
      const colorCount = colors.length - 1;

      // Map to thermal palette
      for (let i = 0; i < w * h; i++) {
        const val = blurred[i];
        const pos = val * colorCount;
        const idx = Math.min(colorCount - 1, Math.floor(pos));
        const t = pos - idx;
        const c1 = colors[idx];
        const c2 = colors[idx + 1];
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
        const pi = i * 4;
        data[pi] = r;
        data[pi + 1] = g;
        data[pi + 2] = b;
        data[pi + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-thermal`, format);
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
            icon={Thermometer}
            title="热成像"
            description="模拟红外热成像仪，按亮度映射到热力配色"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">热成像选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  平滑半径：
                  <span className="text-primary font-medium">{blur}px</span>
                </Label>
                <Slider
                  value={[blur]}
                  min={0}
                  max={6}
                  step={1}
                  onValueChange={(v) => setBlur(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  对比度：
                  <span className="text-primary font-medium">
                    {contrast.toFixed(1)}
                  </span>
                </Label>
                <Slider
                  value={[contrast]}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onValueChange={(v) => setContrast(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>热力配色</Label>
                <div className="flex items-center gap-2 pt-1">
                  {(["iron", "rainbow"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPalette(p)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        palette === p
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {p === "iron" ? "铁" : "彩虹"}
                    </button>
                  ))}
                </div>
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
                      生成热成像（{items.length}）
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
