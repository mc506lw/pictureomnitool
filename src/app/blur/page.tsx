"use client";

import * as React from "react";
import { Play, Square, CircleOff } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes, downloadBlob } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BlurPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [blur, setBlur] = React.useState(5);

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const out = applyBlur(item.canvas, blur);
      const blob = await encodeCanvas(out, "png");
      const name = withExtension(item.name, "png");
      updateItem(item.id, { result: { blob, name, size: blob.size } });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const handleProcess = React.useCallback(() => process.start(), [process]);

  const entries = React.useMemo(
    () =>
      items
        .filter((i) => i.result)
        .map((i) => ({
          id: i.id,
          name: i.result!.name,
          blob: i.result!.blob,
          size: i.result!.size,
        })),
    [items]
  );

  const readyCount = items.filter((i) => i.status === "done").length;

  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col">
        <div className="px-4 py-6 md:px-8">
          <PageHeader
            icon={CircleOff}
            title="模糊效果"
            description="为图片添加高斯模糊效果"
          />

          <div className="mt-6 space-y-4">
            <div className="bg-card rounded-lg border p-5">
              <Label className="mb-3 block text-sm font-medium">
                模糊程度：<span className="text-primary">{blur}px</span>
              </Label>
              <Slider
                value={[blur]}
                min={0}
                max={20}
                step={0.5}
                onValueChange={(v) => setBlur(v[0])}
                className="w-full"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                数值越大，模糊效果越明显
              </p>
            </div>

            {items.length === 0 ? (
              <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
            ) : (
              <div className="space-y-4">
                <BatchTable
                  items={items}
                  onRemove={removeItem}
                  onClearAll={() => {
                    clearAll();
                    process.reset();
                  }}
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
                        <Square className="h-4 w-4" />
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleProcess}
                        disabled={items.length === 0 || process.running}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                      >
                        <Play className="h-4 w-4" />
                        开始处理（{items.length}）
                      </button>
                      {readyCount > 0 && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              entries.forEach((entry) => {
                                downloadBlob(entry.blob, entry.name);
                              });
                            }}
                          >
                            下载全部
                          </Button>
                          <span className="text-muted-foreground text-xs">
                            已完成 {readyCount} 个
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

function applyBlur(canvas: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  return out;
}
