"use client";

import * as React from "react";
import {
  Palette,
  Play,
  Square as StopSquare,
  Settings2,
  Copy,
  Check,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { decodeImageFile } from "@/lib/image-utils";
import { getBaseName, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function quantizeColors(
  imageData: ImageData,
  maxColors: number
): { color: string; count: number }[] {
  const colorMap = new Map<string, number>();
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    if (a < 128) continue;
    const step = 16;
    const rq = Math.round(r / step) * step;
    const gq = Math.round(g / step) * step;
    const bq = Math.round(b / step) * step;
    const key = `${rq},${gq},${bq}`;
    colorMap.set(key, (colorMap.get(key) ?? 0) + 1);
  }
  const sorted = Array.from(colorMap.entries())
    .map(([key, count]) => {
      const [r, g, b] = key.split(",").map(Number);
      return {
        color: `rgb(${r}, ${g}, ${b})`,
        count,
        r,
        g,
        b,
      };
    })
    .sort((a, b) => b.count - a.count);
  if (sorted.length <= maxColors) return sorted;
  // simple diversity filter: keep spaced colors
  const result: typeof sorted = [];
  const minDistance = 40;
  for (const candidate of sorted) {
    if (
      result.some(
        (c) =>
          Math.abs(c.r - candidate.r) +
            Math.abs(c.g - candidate.g) +
            Math.abs(c.b - candidate.b) <
          minDistance
      )
    ) {
      continue;
    }
    result.push(candidate);
    if (result.length >= maxColors) break;
  }
  return result;
}

export default function ColorPalettePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [maxColors, setMaxColors] = React.useState(6);
  const [paletteMap, setPaletteMap] = React.useState<Map<string, { color: string; count: number }[]>>(
    new Map()
  );
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.file) throw new Error("缺少图片文件");
      const decoded = await decodeImageFile(item.file);
      const ctx = decoded.canvas.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, decoded.canvas.width, decoded.canvas.height);
      const palette = quantizeColors(imageData, maxColors);
      setPaletteMap((prev) => {
        const next = new Map(prev);
        next.set(item.id, palette);
        return next;
      });
      updateItem(item.id, { status: "done" });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const readyCount = items.filter((i) => i.status === "done").length;

  const handleReset = () => {
    clearAll();
    process.reset();
    setPaletteMap(new Map());
    setCopiedId(null);
  };

  const copyPalette = async (palette: { color: string }[], itemId: string) => {
    const text = palette.map((c) => c.color).join(", ");
    await navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Palette}
            title="配色提取"
            description="从图片中提取主要颜色，快速获取配色方案"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">提取选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  颜色数量：<span className="text-primary font-medium">{maxColors}</span>
                </Label>
                <Slider
                  value={[maxColors]}
                  min={3}
                  max={12}
                  step={1}
                  onValueChange={(v) => setMaxColors(v[0])}
                />
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
                      <Palette className="h-4 w-4" />
                      提取配色（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <span className="text-muted-foreground text-xs">
                        已完成 {readyCount} 个
                      </span>
                    )}
                  </>
                )}
              </div>

              {paletteMap.size > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((item) => {
                    const palette = paletteMap.get(item.id);
                    if (!palette) return null;
                    return (
                      <div key={item.id} className="bg-card rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {getBaseName(item.name)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {item.width ?? "?"} × {item.height ?? "?"} ·{" "}
                              {formatBytes(item.size)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => copyPalette(palette, item.id)}
                          >
                            {copiedId === item.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copiedId === item.id ? "已复制" : "复制色值"}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {palette.map((c, idx) => (
                            <div
                              key={idx}
                              className="flex flex-1 min-w-[80px] flex-col items-center gap-1 rounded-md border p-2"
                            >
                              <div
                                className="h-10 w-full rounded"
                                style={{ backgroundColor: c.color }}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {c.color}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
