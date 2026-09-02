"use client";

import * as React from "react";
import { Palette, Play, Square, Settings2, Copy, Check } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import {
  ZipExportButton,
  DownloadAllButton,
  downloadZip,
  type ZipEntry,
} from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  extractColors,
  DEFAULT_COLOR_OPTIONS,
  type ExtractedColor,
} from "@/lib/colors";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes, downloadBlob } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ColorExtractPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [maxColors, setMaxColors] = React.useState(
    DEFAULT_COLOR_OPTIONS.maxColors
  );
  const [minBrightness, setMinBrightness] = React.useState(
    DEFAULT_COLOR_OPTIONS.minBrightness
  );
  const [maxBrightness, setMaxBrightness] = React.useState(
    DEFAULT_COLOR_OPTIONS.maxBrightness
  );
  const [colorResults, setColorResults] = React.useState<
    Record<string, ExtractedColor[]>
  >({});
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const colors = extractColors(item.canvas, {
        maxColors,
        minBrightness,
        maxBrightness,
      });
      setColorResults((prev) => ({ ...prev, [item.id]: colors }));
      const blob = await encodeCanvas(item.canvas, "png");
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

  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  const handleCopyColor = (color: string, id: string) => {
    navigator.clipboard.writeText(color);
    setCopiedId(id);
    toast.success(`已复制 ${color}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportPalette = async () => {
    const allColors: { name: string; blob: Blob }[] = [];
    for (const [itemId, colors] of Object.entries(colorResults)) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      const base = item.name.replace(/\.[^.]+$/, "");
      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        const paletteCanvas = document.createElement("canvas");
        paletteCanvas.width = 200;
        paletteCanvas.height = 100;
        const ctx = paletteCanvas.getContext("2d")!;
        ctx.fillStyle = c.color;
        ctx.fillRect(0, 0, 200, 100);
        ctx.fillStyle = "#000";
        ctx.font = "14px monospace";
        ctx.fillText(c.color, 10, 30);
        ctx.fillText(`${Math.round(c.ratio * 100)}%`, 10, 55);
        const blob = await new Promise<Blob>((resolve) =>
          paletteCanvas.toBlob((b) => resolve(b!), "image/png")
        );
        allColors.push({
          name: `${base}_color_${i + 1}_${c.color.replace("#", "")}.png`,
          blob,
        });
      }
    }
    if (allColors.length > 0) {
      await downloadZip(allColors, "color-palette.zip");
    }
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Palette}
            title="颜色提取"
            description="从图片中提取主色调和调色板，支持亮度范围过滤"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">提取设置</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  颜色数量：
                  <span className="text-primary font-medium">{maxColors}</span>
                </Label>
                <Slider
                  value={[maxColors]}
                  min={2}
                  max={12}
                  step={1}
                  onValueChange={(v) => setMaxColors(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  最低亮度：
                  <span className="text-primary font-medium">
                    {minBrightness}
                  </span>
                </Label>
                <Slider
                  value={[minBrightness]}
                  min={0}
                  max={255}
                  step={1}
                  onValueChange={(v) => setMinBrightness(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  最高亮度：
                  <span className="text-primary font-medium">
                    {maxBrightness}
                  </span>
                </Label>
                <Slider
                  value={[maxBrightness]}
                  min={0}
                  max={255}
                  step={1}
                  onValueChange={(v) => setMaxBrightness(v[0])}
                />
              </div>
            </div>
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
                  setColorResults({});
                }}
                allowAdd
                onAdd={addFiles}
                renderResult={(item) => {
                  const colors = colorResults[item.id];
                  if (!colors || colors.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1">
                      {colors.slice(0, 5).map((c, i) => (
                        <div
                          key={i}
                          className="h-4 w-4 rounded border"
                          style={{ backgroundColor: c.color }}
                          title={`${c.color} (${Math.round(c.ratio * 100)}%)`}
                        />
                      ))}
                    </div>
                  );
                }}
              />

              {Object.keys(colorResults).length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-muted-foreground text-xs font-medium">
                      提取结果
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPalette}
                      className="gap-1.5"
                    >
                      导出调色板 ZIP
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {items
                      .filter((i) => colorResults[i.id]?.length > 0)
                      .map((item) => {
                        const colors = colorResults[item.id]!;
                        return (
                          <div key={item.id} className="space-y-2">
                            <div className="text-xs font-medium">
                              {item.name}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {colors.map((c, idx) => {
                                const colorId = `${item.id}-${idx}`;
                                return (
                                  <div
                                    key={idx}
                                    className="group relative flex items-center gap-2 rounded-lg border p-2"
                                  >
                                    <div
                                      className="h-10 w-10 rounded border"
                                      style={{ backgroundColor: c.color }}
                                    />
                                    <div className="space-y-0.5">
                                      <div className="font-mono text-xs font-medium">
                                        {c.color}
                                      </div>
                                      <div className="text-muted-foreground text-[11px]">
                                        {Math.round(c.ratio * 100)}% ·{" "}
                                        {formatBytes(c.count * 4)}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        handleCopyColor(c.color, colorId)
                                      }
                                      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                                      title="复制颜色代码"
                                    >
                                      {copiedId === colorId ? (
                                        <Check className="h-3.5 w-3.5" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
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
                      提取颜色（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="color-extracted-images.zip"
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
