"use client";

import * as React from "react";
import { Brush, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

export default function WatercolorPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [spread, setSpread] = React.useState(6);
  const [alpha, setAlpha] = React.useState(0.35);
  const [paper, setPaper] = React.useState(true);
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

      // Paper texture
      const paperCanvas = document.createElement("canvas");
      paperCanvas.width = w;
      paperCanvas.height = h;
      const pctx = paperCanvas.getContext("2d")!;
      const paperData = pctx.createImageData(w, h);
      const pbuf = new Uint32Array(paperData.data.buffer);
      for (let i = 0; i < pbuf.length; i++) {
        const v = Math.random() * 30;
        pbuf[i] = (255 << 24) | (v << 16) | (v << 8) | v;
      }
      pctx.putImageData(paperData, 0, 0);

      // Build RGB layers with diffusion
      const layers = [
        { offset: [0, 0], color: [data[0], data[1], data[2]] },
        { offset: [-spread, 0], color: [0, 0, 0] },
        { offset: [spread, 0], color: [0, 0, 0] },
        { offset: [0, -spread], color: [0, 0, 0] },
        { offset: [0, spread], color: [0, 0, 0] },
      ];

      const output = new Uint8ClampedArray(data.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0,
            g = 0,
            b = 0,
            aSum = 0;
          for (const layer of layers) {
            const nx = Math.min(w - 1, Math.max(0, x + layer.offset[0]));
            const ny = Math.min(h - 1, Math.max(0, y + layer.offset[1]));
            const idx = (ny * w + nx) * 4;
            const lr = data[idx];
            const lg = data[idx + 1];
            const lb = data[idx + 2];
            const la =
              alpha *
              (layer.offset[0] === 0 && layer.offset[1] === 0 ? 1 : 0.6);
            r += lr * la;
            g += lg * la;
            b += lb * la;
            aSum += la;
          }
          const dstIdx = (y * w + x) * 4;
          output[dstIdx] = Math.round(r / aSum);
          output[dstIdx + 1] = Math.round(g / aSum);
          output[dstIdx + 2] = Math.round(b / aSum);
          output[dstIdx + 3] = 255;
        }
      }

      imageData.data.set(output);
      ctx.putImageData(imageData, 0, 0);

      if (paper) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.25;
        ctx.drawImage(paperCanvas, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#ffffff",
      });
      const name = withExtension(
        `${getBaseName(item.name)}-watercolor`,
        format
      );
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
            icon={Brush}
            title="水彩效果"
            description="多层透明扩散叠加，模拟水彩画笔触与纸张纹理"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">水彩选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  扩散半径：
                  <span className="text-primary font-medium">{spread}px</span>
                </Label>
                <Slider
                  value={[spread]}
                  min={1}
                  max={12}
                  step={1}
                  onValueChange={(v) => setSpread(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  透明度：
                  <span className="text-primary font-medium">
                    {alpha.toFixed(2)}
                  </span>
                </Label>
                <Slider
                  value={[alpha]}
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  onValueChange={(v) => setAlpha(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>纸张纹理</Label>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setPaper(!paper)}
                    className={cn(
                      "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                      paper
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    {paper ? "开启" : "关闭"}
                  </button>
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
                      生成水彩（{items.length}）
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
