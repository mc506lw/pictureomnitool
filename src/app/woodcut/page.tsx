"use client";

import * as React from "react";
import { Stamp, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

export default function WoodcutPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [threshold, setThreshold] = React.useState(128);
  const [invert, setInvert] = React.useState(false);
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

      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const val = gray >= threshold !== invert ? 255 : 0;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      const blob = await encodeCanvas(canvas, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(`${getBaseName(item.name)}-woodcut`, format);
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
            icon={Stamp}
            title="木刻/版画"
            description="黑白二值化并模拟木刻版画/印章效果"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">版画选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  阈值：<span className="text-primary font-medium">{threshold}</span>
                </Label>
                <Slider
                  value={[threshold]}
                  min={0}
                  max={255}
                  step={1}
                  onValueChange={(v) => setThreshold(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>反色</Label>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setInvert(!invert)}
                    className={cn(
                      "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                      invert
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    {invert ? "开启" : "关闭"}
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
                      生成版画（{items.length}）
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
