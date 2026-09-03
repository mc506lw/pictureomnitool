"use client";

import * as React from "react";
import {
  Circle,
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
import { encodeCanvas } from "@/lib/image-utils";
import { getBaseName, withExtension, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const FORMATS = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
] as const;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default function RoundCornersPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [radius, setRadius] = React.useState(24);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const src = item.canvas;
      const target = document.createElement("canvas");
      target.width = src.width;
      target.height = src.height;
      const ctx = target.getContext("2d")!;
      const maxRadius = Math.min(src.width, src.height) / 2;
      const r = Math.min(radius, maxRadius);
      roundRect(ctx, 0, 0, src.width, src.height, r);
      ctx.clip();
      ctx.drawImage(src, 0, 0, src.width, src.height);
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: "#ffffff",
      });
      const base = getBaseName(item.name);
      const name = withExtension(`${base}-rounded`, format);
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

  const handleProcess = () => {
    process.start();
  };

  const handleReset = () => {
    clearAll();
    process.reset();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Circle}
            title="圆角图片"
            description="为图片添加圆角效果，适合头像、卡片和社交媒体素材"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">圆角选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  圆角半径：<span className="text-primary font-medium">{radius}px</span>
                </Label>
                <Slider
                  value={[radius]}
                  min={0}
                  max={128}
                  step={4}
                  onValueChange={(v) => setRadius(v[0])}
                />
                <p className="text-muted-foreground text-[11px]">
                  数值越大，圆角越明显；0 表示直角
                </p>
              </div>

              <div className="space-y-2">
                <Label>输出格式</Label>
                <div className="flex items-center gap-2 pt-1">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        format === f.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      {f.label}
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
                      onClick={handleProcess}
                      disabled={items.length === 0 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      开始处理（{items.length}）
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
