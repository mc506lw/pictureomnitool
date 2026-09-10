"use client";

import * as React from "react";
import {
  Smartphone,
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
import { encodeCanvas, decodeImageFile } from "@/lib/image-utils";
import { getBaseName, formatBytes, withExtension } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FramePreset = "none" | "phone" | "laptop";

function drawFrame(
  target: HTMLCanvasElement,
  src: HTMLCanvasElement,
  preset: FramePreset,
  padding: number,
  bg: string
) {
  const ctx = target.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, target.width, target.height);
  const frame = preset === "none" ? 0 : preset === "phone" ? 48 : 56;
  const contentX = frame + padding;
  const contentY = frame + padding;
  const contentW = target.width - contentX * 2;
  const contentH = target.height - contentY * 2;
  if (contentW <= 0 || contentH <= 0) return;
  ctx.drawImage(src, contentX, contentY, contentW, contentH);
}

export default function ScreenshotFramePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [preset, setPreset] = React.useState<FramePreset>("phone");
  const [padding, setPadding] = React.useState(24);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");
  const [bg, setBg] = React.useState("#111827");

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
      target.width = src.width + (preset === "none" ? padding * 2 : 120);
      target.height = src.height + (preset === "none" ? padding * 2 : 120);
      drawFrame(target, src, preset, padding, bg);
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: bg,
      });
      const suffix =
        preset === "phone"
          ? "-phone"
          : preset === "laptop"
            ? "-laptop"
            : "-frame";
      const name = withExtension(`${getBaseName(item.name)}${suffix}`, format);
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
            icon={Smartphone}
            title="截图边框"
            description="将图片放入手机或笔记本外框中，适合制作宣传展示图"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">边框选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>边框样式</Label>
                <div className="flex items-center gap-2">
                  {(
                    [
                      ["phone", "手机"],
                      ["laptop", "笔记本"],
                      ["none", "无"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setPreset(value)}
                      className={cn(
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                        preset === value
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
                <Label>背景颜色</Label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-9 w-16 cursor-pointer rounded-md border"
                  />
                  <span className="text-muted-foreground text-xs">{bg}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  内边距：
                  <span className="text-primary font-medium">{padding}px</span>
                </Label>
                <Slider
                  value={[padding]}
                  min={0}
                  max={120}
                  step={4}
                  onValueChange={(v) => setPadding(v[0])}
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
                      生成边框（{items.length}）
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
