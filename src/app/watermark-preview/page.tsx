"use client";

import * as React from "react";
import {
  Eye,
  Play,
  Square as StopSquare,
  Settings2,
  Type,
  ImageIcon,
  RotateCw,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { encodeCanvas, makeThumbnail } from "@/lib/image-utils";
import { withExtension, formatBytes, getBaseName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WatermarkType = "text" | "image";

function drawPreview(
  canvas: HTMLCanvasElement,
  type: WatermarkType,
  text: string,
  textColor: string,
  fontSize: number,
  opacity: number,
  rotation: number,
  tile: boolean,
  scale: number = 1
) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalAlpha = opacity;
  if (rotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }
  if (type === "text" && text) {
    ctx.font = `${fontSize * scale}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    if (tile) {
      const stepX = ctx.measureText(text).width + 80 * scale;
      const stepY = fontSize * scale + 40 * scale;
      for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
        for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
          ctx.fillText(text, x, y);
        }
      }
    } else {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }
  ctx.restore();
}

export default function WatermarkPreviewPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [watermarkType, setWatermarkType] = React.useState<WatermarkType>("text");
  const [text, setText] = React.useState("Watermark");
  const [textColor, setTextColor] = React.useState("#ffffff");
  const [fontSize, setFontSize] = React.useState(32);
  const [opacity, setOpacity] = React.useState(0.7);
  const [rotation, setRotation] = React.useState(0);
  const [tile, setTile] = React.useState(false);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const [previewMap, setPreviewMap] = React.useState<Map<string, string>>(
    new Map()
  );

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const target = document.createElement("canvas");
      target.width = item.canvas.width;
      target.height = item.canvas.height;
      const ctx = target.getContext("2d")!;
      ctx.drawImage(item.canvas, 0, 0);
      ctx.save();
      ctx.globalAlpha = opacity;
      if (rotation !== 0) {
        ctx.translate(target.width / 2, target.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-target.width / 2, -target.height / 2);
      }
      if (watermarkType === "text" && text) {
        ctx.font = `${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        if (tile) {
          const stepX = ctx.measureText(text).width + 80;
          const stepY = fontSize + 40;
          for (let y = -target.height; y < target.height * 2; y += stepY) {
            for (let x = -target.width; x < target.width * 2; x += stepX) {
              ctx.fillText(text, x, y);
            }
          }
        } else {
          ctx.fillText(text, target.width / 2, target.height / 2);
        }
      }
      ctx.restore();
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: "#ffffff",
      });
      const name = withExtension(`${getBaseName(item.name)}-watermarked`, format);
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

  React.useEffect(() => {
    const next = new Map<string, string>();
    items.forEach((item) => {
      if (item.canvas) {
        const p = document.createElement("canvas");
        p.width = item.canvas.width;
        p.height = item.canvas.height;
        drawPreview(
          p,
          watermarkType,
          text,
          textColor,
          fontSize,
          opacity,
          rotation,
          tile,
          1
        );
        next.set(item.id, p.toDataURL("image/png"));
      }
    });
    setPreviewMap(next);
  }, [items, watermarkType, text, textColor, fontSize, opacity, rotation, tile]);

  const handleReset = () => {
    clearAll();
    process.reset();
    setPreviewMap(new Map());
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Eye}
            title="水印预览"
            description="实时预览文字水印效果，调整透明度、角度和重复模式"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">水印选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>水印文字</Label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="请输入水印文字"
                />
              </div>
              <div className="space-y-2">
                <Label>文字颜色</Label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-9 w-16 cursor-pointer rounded-md border"
                  />
                  <span className="text-muted-foreground text-xs">
                    {textColor}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  字号：<span className="text-primary font-medium">{fontSize}px</span>
                </Label>
                <Slider
                  value={[fontSize]}
                  min={12}
                  max={120}
                  step={4}
                  onValueChange={(v) => setFontSize(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  透明度：<span className="text-primary font-medium">{Math.round(opacity * 100)}%</span>
                </Label>
                <Slider
                  value={[opacity]}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onValueChange={(v) => setOpacity(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  旋转：<span className="text-primary font-medium">{rotation}°</span>
                </Label>
                <Slider
                  value={[rotation]}
                  min={0}
                  max={360}
                  step={15}
                  onValueChange={(v) => setRotation(v[0])}
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
            <div className="flex items-center gap-2">
              <Button
                variant={tile ? "default" : "outline"}
                size="sm"
                onClick={() => setTile((v) => !v)}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                平铺模式
              </Button>
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

              {previewMap.size > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-card overflow-hidden rounded-lg border"
                    >
                      <div className="bg-muted flex aspect-video items-center justify-center">
                        {previewMap.get(item.id) ? (
                          <img
                            src={previewMap.get(item.id)}
                            alt={item.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            预览生成中...
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 p-2">
                        <div className="truncate text-xs font-medium">
                          {getBaseName(item.name)}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {item.width ?? "?"} × {item.height ?? "?"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                      应用水印（{items.length}）
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
