"use client";

import * as React from "react";
import {
  Play,
  Square as StopSquare,
  Settings2,
  ImageIcon,
  Upload,
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

export default function WatermarkImagePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [scale, setScale] = React.useState(25);
  const [opacity, setOpacity] = React.useState(70);
  const [position, setPosition] = React.useState("bottom-right");
  const [watermarkFile, setWatermarkFile] = React.useState<File | null>(null);
  const [watermarkImage, setWatermarkImage] = React.useState<HTMLImageElement | null>(null);
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
      if (!watermarkImage || !watermarkFile) {
        throw new Error("请先上传水印图片");
      }
      const target = document.createElement("canvas");
      target.width = src.width;
      target.height = src.height;
      const ctx = target.getContext("2d")!;
      ctx.drawImage(src, 0, 0);

      const wmWidth = Math.max(10, src.width * (scale / 100));
      const aspect = watermarkImage.height / watermarkImage.width;
      const wmHeight = wmWidth * aspect;
      let x = 0;
      let y = 0;
      const pad = Math.max(8, Math.round(wmWidth * 0.05));
      if (position.includes("right")) x = target.width - wmWidth - pad;
      else if (position.includes("center")) x = (target.width - wmWidth) / 2;
      else x = pad;
      if (position.includes("bottom")) y = target.height - wmHeight - pad;
      else if (position.includes("center")) y = (target.height - wmHeight) / 2;
      else y = pad;

      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(watermarkImage, x, y, wmWidth, wmHeight);
      ctx.globalAlpha = 1;

      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(
        `${getBaseName(item.name)}-watermarked`,
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

  const onWatermarkChange = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setWatermarkFile(file);
    const img = new window.Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    setWatermarkImage(img);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={ImageIcon}
            title="图片水印"
            description="上传水印图片并批量叠加到主图上"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">水印选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>水印图片</Label>
                <FileDropzone
                  onFiles={onWatermarkChange}
                  accept="image/*"
                  multiple={false}
                />
                {watermarkFile && (
                  <p className="text-muted-foreground text-xs">
                    已选择：{watermarkFile.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  缩放：<span className="text-primary font-medium">{scale}%</span>
                </Label>
                <Slider
                  value={[scale]}
                  min={5}
                  max={80}
                  step={5}
                  onValueChange={(v) => setScale(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  透明度：<span className="text-primary font-medium">{opacity}%</span>
                </Label>
                <Slider
                  value={[opacity]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={(v) => setOpacity(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>位置</Label>
                <div className="flex items-center gap-2 pt-1">
                  {[
                    ["top-left", "左上"],
                    ["top-right", "右上"],
                    ["bottom-left", "左下"],
                    ["bottom-right", "右下"],
                    ["center", "居中"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setPosition(value)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        position === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {label}
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
                      disabled={
                        items.length === 0 || process.running || !watermarkImage
                      }
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      添加水印（{items.length}）
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
