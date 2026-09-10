"use client";

import * as React from "react";
import { Palette, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

const PALETTES = [
  {
    name: "默认",
    colors: [
      [255, 0, 0],
      [0, 255, 255],
      [255, 255, 0],
      [255, 0, 255],
    ],
  },
  {
    name: "冷色",
    colors: [
      [0, 100, 255],
      [0, 255, 200],
      [200, 0, 255],
      [255, 255, 255],
    ],
  },
  {
    name: "暖色",
    colors: [
      [255, 80, 0],
      [255, 220, 0],
      [255, 0, 120],
      [255, 255, 255],
    ],
  },
];

export default function PopArtPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [levels, setLevels] = React.useState(4);
  const [contrast, setContrast] = React.useState(1.4);
  const [paletteIndex, setPaletteIndex] = React.useState(0);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const palette = PALETTES[Math.min(paletteIndex, PALETTES.length - 1)].colors;

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

      const colorCount = palette.length;

      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const val = Math.min(1, Math.max(0, (gray - 0.5) * contrast + 0.5));
        const pos = Math.floor(val * (levels - 1)) / (levels - 1);
        const colorIdx = Math.min(colorCount - 1, Math.floor(pos * colorCount));
        const nextIdx = Math.min(colorCount - 1, colorIdx + 1);
        const t = (pos * (levels - 1)) % 1;
        const c1 = palette[colorIdx];
        const c2 = palette[nextIdx];
        data[idx] = Math.round(c1[0] + (c2[0] - c1[0]) * t);
        data[idx + 1] = Math.round(c1[1] + (c2[1] - c1[1]) * t);
        data[idx + 2] = Math.round(c1[2] + (c2[2] - c1[2]) * t);
        data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#ffffff",
      });
      const name = withExtension(`${getBaseName(item.name)}-popart`, format);
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
            icon={Palette}
            title="波普艺术"
            description="高饱和色块与分层配色，模拟波普艺术海报"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">波普选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  色阶：
                  <span className="text-primary font-medium">{levels}</span>
                </Label>
                <Slider
                  value={[levels]}
                  min={2}
                  max={8}
                  step={1}
                  onValueChange={(v) => setLevels(v[0])}
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
                  min={0.8}
                  max={3}
                  step={0.1}
                  onValueChange={(v) => setContrast(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>配色</Label>
                <div className="flex items-center gap-2 pt-1">
                  {PALETTES.map((p, idx) => (
                    <button
                      key={p.name}
                      onClick={() => setPaletteIndex(idx)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        paletteIndex === idx
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {p.name}
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
                      生成波普（{items.length}）
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
