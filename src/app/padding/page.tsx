"use client";

import * as React from "react";
import { Square, Play, Square as StopSquare, Settings2 } from "lucide-react";
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

const COLOR_PRESETS = [
  { value: "#ffffff", label: "白色" },
  { value: "#000000", label: "黑色" },
  { value: "#f5f5f5", label: "浅灰" },
  { value: "#ffd700", label: "金色" },
  { value: "#4caf50", label: "绿色" },
  { value: "#2196f3", label: "蓝色" },
  { value: "transparent", label: "透明" },
];

export default function PaddingPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [padding, setPadding] = React.useState(64);
  const [color, setColor] = React.useState("#ffffff");
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const src = item.canvas;
      const p = Math.max(0, padding);
      const target = document.createElement("canvas");
      target.width = src.width + p * 2;
      target.height = src.height + p * 2;
      const ctx = target.getContext("2d")!;
      if (color === "transparent") {
        ctx.clearRect(0, 0, target.width, target.height);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, target.width, target.height);
      }
      ctx.drawImage(src, p, p, src.width, src.height);
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: color,
      });
      const base = getBaseName(item.name);
      const name = withExtension(`${base}-padded`, format);
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
            icon={Square}
            title="图片加边框"
            description="为图片添加自定义内边距和背景色，适配社交平台或打印需求"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">边框选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  内边距：
                  <span className="text-primary font-medium">{padding}px</span>
                </Label>
                <Slider
                  value={[padding]}
                  min={0}
                  max={256}
                  step={8}
                  onValueChange={(v) => setPadding(v[0])}
                />
                <p className="text-muted-foreground text-[11px]">
                  图片四周增加的空白区域大小
                </p>
              </div>

              <div className="space-y-2">
                <Label>背景色</Label>
                <div className="flex items-center gap-2 pt-1">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-7 w-7 rounded-full border transition-transform",
                        color === c.value &&
                          "ring-primary scale-110 ring-2 ring-offset-2"
                      )}
                      style={{
                        background:
                          c.value === "transparent"
                            ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px"
                            : c.value,
                      }}
                    />
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
