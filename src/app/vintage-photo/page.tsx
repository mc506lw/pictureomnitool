"use client";

import * as React from "react";
import { Camera, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

export default function VintagePhotoPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [sepia, setSepia] = React.useState(60);
  const [grain, setGrain] = React.useState(25);
  const [vignette, setVignette] = React.useState(40);
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
      const sepiaAmount = sepia / 100;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const tr = r * (1 - 0.607 * sepiaAmount) + g * (0.769 * sepiaAmount) + b * (0.189 * sepiaAmount);
        const tg = r * (0.349 * sepiaAmount) + g * (1 - 0.314 * sepiaAmount) + b * (0.168 * sepiaAmount);
        const tb = r * (0.272 * sepiaAmount) + g * (0.534 * sepiaAmount) + b * (1 - 0.869 * sepiaAmount);
        data[i] = Math.min(255, Math.max(0, tr));
        data[i + 1] = Math.min(255, Math.max(0, tg));
        data[i + 2] = Math.min(255, Math.max(0, tb));

        if (grain > 0) {
          const noise = (Math.random() - 0.5) * grain;
          data[i] = Math.min(255, Math.max(0, data[i] + noise));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
      }
      ctx.putImageData(imageData, 0, 0);

      if (vignette > 0) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        const gradient = ctx.createRadialGradient(cx, cy, maxDist * 0.2, cx, cy, maxDist);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, `rgba(0,0,0,${vignette / 100})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-vintage`, format);
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
            icon={Camera}
            title="复古照片"
            description="添加复古棕褐色、颗粒与暗角效果"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">复古选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  复古程度：<span className="text-primary font-medium">{sepia}%</span>
                </Label>
                <Slider
                  value={[sepia]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setSepia(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  颗粒：<span className="text-primary font-medium">{grain}</span>
                </Label>
                <Slider
                  value={[grain]}
                  min={0}
                  max={80}
                  step={5}
                  onValueChange={(v) => setGrain(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  暗角：<span className="text-primary font-medium">{vignette}%</span>
                </Label>
                <Slider
                  value={[vignette]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setVignette(v[0])}
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
                      应用复古效果（{items.length}）
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
