"use client";

import * as React from "react";
import { Pencil, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

export default function CharcoalPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [blur, setBlur] = React.useState(3);
  const [contrast, setContrast] = React.useState(12);
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
      const output = new Uint8ClampedArray(data.length);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let dy = -blur; dy <= blur; dy++) {
            for (let dx = -blur; dx <= blur; dx++) {
              const nx = Math.min(w - 1, Math.max(0, x + dx));
              const ny = Math.min(h - 1, Math.max(0, y + dy));
              const idx = (ny * w + nx) * 4;
              const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / (255 * 3);
              sum += lum;
            }
          }
          const area = (2 * blur + 1) ** 2;
          const avg = sum / area;
          const inverted = 1 - avg;
          const dstIdx = (y * w + x) * 4;
          const val = Math.min(255, Math.max(0, Math.round((inverted - 0.5) * contrast + 0.5) * 255));
          output[dstIdx] = val;
          output[dstIdx + 1] = val;
          output[dstIdx + 2] = val;
          output[dstIdx + 3] = data[dstIdx + 3];
        }
      }

      imageData.data.set(output);
      ctx.putImageData(imageData, 0, 0);
      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-charcoal`, format);
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
            icon={Pencil}
            title="炭笔画"
            description="反转明暗并强化对比，模拟铅笔素描质感"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">素描选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  模糊半径：<span className="text-primary font-medium">{blur}px</span>
                </Label>
                <Slider
                  value={[blur]}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(v) => setBlur(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  对比度：<span className="text-primary font-medium">{contrast}</span>
                </Label>
                <Slider
                  value={[contrast]}
                  min={4}
                  max={30}
                  step={1}
                  onValueChange={(v) => setContrast(v[0])}
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
                      生成炭笔（{items.length}）
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
