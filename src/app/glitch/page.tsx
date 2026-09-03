"use client";

import * as React from "react";
import { Settings2, Play, Square as StopSquare, Activity } from "lucide-react";
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

export default function GlitchPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [offset, setOffset] = React.useState(12);
  const [sliceCount, setSliceCount] = React.useState(8);
  const [sliceHeight, setSliceHeight] = React.useState(16);
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
      const target = document.createElement("canvas");
      target.width = src.width;
      target.height = src.height;
      const ctx = target.getContext("2d")!;
      ctx.drawImage(src, 0, 0);
      const imageData = ctx.getImageData(0, 0, target.width, target.height);
      const data = imageData.data;
      const w = target.width;
      const h = target.height;

      const clone = new Uint8ClampedArray(data);
      for (let s = 0; s < sliceCount; s++) {
        const y = Math.floor(Math.random() * h);
        const height = Math.max(4, Math.floor(Math.random() * sliceHeight));
        const shift = Math.floor((Math.random() - 0.5) * offset * 2);
        for (let row = y; row < Math.min(h, y + height); row++) {
          for (let x = 0; x < w; x++) {
            const srcX = Math.min(w - 1, Math.max(0, x + shift));
            const srcIdx = (row * w + srcX) * 4;
            const dstIdx = (row * w + x) * 4;
            data[dstIdx] = clone[srcIdx];
            data[dstIdx + 1] = clone[srcIdx + 1];
            data[dstIdx + 2] = clone[srcIdx + 2];
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-glitch`, format);
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
            icon={Activity}
            title="故障艺术"
            description="随机错位切片与 RGB 通道偏移，制造赛博故障风格"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">故障选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  偏移强度：<span className="text-primary font-medium">{offset}px</span>
                </Label>
                <Slider
                  value={[offset]}
                  min={2}
                  max={40}
                  step={1}
                  onValueChange={(v) => setOffset(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  切片数量：<span className="text-primary font-medium">{sliceCount}</span>
                </Label>
                <Slider
                  value={[sliceCount]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(v) => setSliceCount(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  切片高度：<span className="text-primary font-medium">{sliceHeight}px</span>
                </Label>
                <Slider
                  value={[sliceHeight]}
                  min={2}
                  max={60}
                  step={2}
                  onValueChange={(v) => setSliceHeight(v[0])}
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
                      应用故障（{items.length}）
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
