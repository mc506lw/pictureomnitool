"use client";

import * as React from "react";
import { Layers, Play, Square as StopSquare, Settings2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
] as const;

function blendPixel(a: number, b: number, mode: string): number {
  switch (mode) {
    case "multiply":
      return (a * b) / 255;
    case "screen":
      return 255 - ((255 - a) * (255 - b)) / 255;
    case "overlay":
      return a < 128
        ? (2 * a * b) / 255
        : 255 - (2 * (255 - a) * (255 - b)) / 255;
    case "darken":
      return Math.min(a, b);
    case "lighten":
      return Math.max(a, b);
    case "color-dodge":
      return b === 255 ? 255 : Math.min(255, (a * 256) / (255 - b + 1));
    case "color-burn":
      return b === 0 ? 0 : Math.max(0, 255 - ((255 - a) * 256) / (b + 1));
    case "hard-light":
      return b < 128
        ? (2 * a * b) / 255
        : 255 - (2 * (255 - a) * (255 - b)) / 255;
    case "soft-light":
      return b < 128
        ? a - (255 - 2 * b) * a * (255 - a) / (255 * 255)
        : a + (2 * b - 255) * (Math.sqrt(a / 255) * 255 - a) / 255;
    case "difference":
      return Math.abs(a - b);
    case "exclusion":
      return a + b - (2 * a * b) / 255;
    default:
      return b;
  }
}

export default function BlendPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [mode, setMode] = React.useState<string>("multiply");
  const [opacity, setOpacity] = React.useState(80);
  const [blendFile, setBlendFile] = React.useState<File | null>(null);
  const [blendImage, setBlendImage] = React.useState<HTMLImageElement | null>(null);
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
      if (!blendImage || !blendFile) {
        throw new Error("请先上传叠加图片");
      }
      const target = document.createElement("canvas");
      target.width = src.width;
      target.height = src.height;
      const ctx = target.getContext("2d")!;
      ctx.drawImage(src, 0, 0);
      ctx.globalAlpha = opacity / 100;
      ctx.globalCompositeOperation = mode as GlobalCompositeOperation;
      ctx.drawImage(blendImage, 0, 0, target.width, target.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: "#000000",
      });
      const name = withExtension(
        `${getBaseName(item.name)}-blend-${mode}`,
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

  const onBlendChange = async (files: File[] | null) => {
    const file = files?.[0];
    if (!file) return;
    setBlendFile(file);
    const img = new window.Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    setBlendImage(img);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Layers}
            title="图片叠加"
            description="上传第二张图片并与主图混合，支持多种混合模式"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">叠加选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>叠加图片</Label>
                <FileDropzone
                  onFiles={onBlendChange}
                  accept="image/*"
                  multiple={false}
                />
                {blendFile && (
                  <p className="text-muted-foreground text-xs">
                    已选择：{blendFile.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>混合模式</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择混合模式" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLEND_MODES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  不透明度：<span className="text-primary font-medium">{opacity}%</span>
                </Label>
                <Slider
                  value={[opacity]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setOpacity(v[0])}
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
                      disabled={
                        items.length === 0 || process.running || !blendImage
                      }
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      混合叠加（{items.length}）
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
