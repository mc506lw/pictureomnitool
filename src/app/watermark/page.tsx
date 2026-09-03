"use client";

import * as React from "react";
import { Stamp, Play, Square, Settings2, ImageIcon, Type } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  applyWatermark,
  DEFAULT_WATERMARK_OPTIONS,
  type WatermarkOptions,
} from "@/lib/watermark";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PREVIEW_MAX = 420;

const POSITIONS: { value: WatermarkOptions["position"]; label: string }[] = [
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中" },
  { value: "top-right", label: "右上" },
  { value: "center", label: "居中" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下中" },
  { value: "bottom-right", label: "右下" },
  { value: "tile", label: "平铺" },
];

export default function WatermarkPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [mode, setMode] = React.useState<"text" | "image">("text");
  const [text, setText] = React.useState(DEFAULT_WATERMARK_OPTIONS.text);
  const [fontSize, setFontSize] = React.useState(
    DEFAULT_WATERMARK_OPTIONS.fontSize
  );
  const [color, setColor] = React.useState(DEFAULT_WATERMARK_OPTIONS.color);
  const [opacity, setOpacity] = React.useState(
    DEFAULT_WATERMARK_OPTIONS.opacity
  );
  const [position, setPosition] = React.useState<WatermarkOptions["position"]>(
    DEFAULT_WATERMARK_OPTIONS.position
  );
  const [rotate, setRotate] = React.useState(DEFAULT_WATERMARK_OPTIONS.rotate);
  const [padding, setPadding] = React.useState(
    DEFAULT_WATERMARK_OPTIONS.padding
  );
  const [watermarkFile, setWatermarkFile] = React.useState<File | null>(null);

  const opts: WatermarkOptions = {
    mode,
    text,
    fontSize,
    color,
    opacity,
    position,
    rotate,
    padding,
  };

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const out = await applyWatermark(
        item.canvas,
        opts,
        watermarkFile ?? undefined
      );
      const blob = await encodeCanvas(out, "png");
      const suffix = mode === "text" ? "watermarked" : "watermarked-img";
      const base = item.name.replace(/\.[^.]+$/, "");
      const name = `${base}_${suffix}.png`;
      updateItem(item.id, { result: { blob, name, size: blob.size } });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const [previewUrl, setPreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const source = items.find((i) => i.canvas);
      if (!source?.canvas) {
        setPreviewUrl("");
        return;
      }
      const out = await applyWatermark(
        source.canvas,
        opts,
        watermarkFile ?? undefined
      );
      const scale = Math.min(
        1,
        PREVIEW_MAX / Math.max(source.canvas.width, source.canvas.height)
      );
      const w = Math.max(1, Math.round(source.canvas.width * scale));
      const h = Math.max(1, Math.round(source.canvas.height * scale));
      const preview = document.createElement("canvas");
      preview.width = w;
      preview.height = h;
      const ctx = preview.getContext("2d")!;
      ctx.drawImage(out, 0, 0, w, h);
      if (!cancelled) setPreviewUrl(preview.toDataURL("image/png"));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [items, opts, watermarkFile]);

  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Stamp}
            title="水印添加"
            description="为图片添加文字水印或图片水印，支持位置、透明度、旋转、平铺"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">水印设置</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>水印类型</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("text")}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      mode === "text"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Type className="mr-1 inline h-3.5 w-3.5" />
                    文字
                  </button>
                  <button
                    onClick={() => setMode("image")}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      mode === "image"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <ImageIcon className="mr-1 inline h-3.5 w-3.5" />
                    图片
                  </button>
                </div>
              </div>

              {mode === "text" && (
                <div className="space-y-2">
                  <Label>水印文字</Label>
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="输入水印文字"
                  />
                </div>
              )}

              {mode === "image" && (
                <div className="space-y-2">
                  <Label>水印图片</Label>
                  <label className="border-input bg-background hover:bg-accent flex h-9 cursor-pointer items-center rounded-md border px-3 text-xs transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setWatermarkFile(f);
                      }}
                    />
                    {watermarkFile ? watermarkFile.name : "选择水印图片"}
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {mode === "text" && (
                <div className="space-y-2">
                  <Label>
                    字号：
                    <span className="text-primary font-medium">
                      {fontSize}px
                    </span>
                  </Label>
                  <Slider
                    value={[fontSize]}
                    min={12}
                    max={120}
                    step={1}
                    onValueChange={(v) => setFontSize(v[0])}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  透明度：
                  <span className="text-primary font-medium">
                    {Math.round(opacity * 100)}%
                  </span>
                </Label>
                <Slider
                  value={[opacity * 100]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={(v) => setOpacity(v[0] / 100)}
                />
              </div>

              <div className="space-y-2">
                <Label>位置</Label>
                <Select
                  value={position}
                  onValueChange={(v) =>
                    setPosition(v as WatermarkOptions["position"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  旋转：
                  <span className="text-primary font-medium">{rotate}°</span>
                </Label>
                <Slider
                  value={[rotate]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={(v) => setRotate(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  边距：
                  <span className="text-primary font-medium">{padding}px</span>
                </Label>
                <Slider
                  value={[padding]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(v) => setPadding(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>颜色</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-16 cursor-pointer rounded border"
                  />
                  <span className="text-muted-foreground font-mono text-xs">
                    {color}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
          ) : (
            <div className="space-y-4">
              {items.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-muted-foreground mb-3 text-xs font-medium">
                    实时预览
                  </div>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="水印预览"
                      className="max-h-72 w-full rounded border object-contain"
                    />
                  ) : (
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      等待图片解码…
                    </p>
                  )}
                </div>
              )}

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
                onApplyToAll={process.start}
                applyToAllLabel="应用到全部"
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
                      onClick={process.start}
                      disabled={items.length === 0 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      添加水印（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="watermarked-images.zip"
                        />
                        <DownloadAllButton entries={entries} />
                        <span className="text-muted-foreground text-xs">
                          已完成 {entries.length} 个
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
    </SidebarInset>
  );
}
