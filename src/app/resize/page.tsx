"use client";

import * as React from "react";
import { Scaling, Play, Square, Settings2, Lock, Unlock } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  resizeCanvas,
  INTERPOLATION_LABELS,
  INTERPOLATION_DESCRIPTIONS,
  type Interpolation,
} from "@/lib/resample";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ResizeMode = "percent" | "width" | "height" | "fit" | "exact";

const MODE_LABELS: Record<ResizeMode, string> = {
  percent: "百分比",
  width: "固定宽度",
  height: "固定高度",
  fit: "适应盒子",
  exact: "精确尺寸",
};

export default function ResizePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [mode, setMode] = React.useState<ResizeMode>("percent");
  const [percent, setPercent] = React.useState(50);
  const [width, setWidth] = React.useState(1920);
  const [height, setHeight] = React.useState(1080);
  const [lockAspect, setLockAspect] = React.useState(false);
  const [interpolation, setInterpolation] =
    React.useState<Interpolation>("bicubic");
  const [allowUpscale, setAllowUpscale] = React.useState(true);

  // 计算目标尺寸
  const computeTarget = (
    srcW: number,
    srcH: number
  ): { w: number; h: number } => {
    const ratio = srcW / srcH;
    switch (mode) {
      case "percent": {
        const factor = percent / 100;
        return {
          w: Math.max(1, Math.round(srcW * factor)),
          h: Math.max(1, Math.round(srcH * factor)),
        };
      }
      case "width":
        return {
          w: width,
          h: lockAspect ? Math.max(1, Math.round(width / ratio)) : height,
        };
      case "height":
        return {
          w: lockAspect ? Math.max(1, Math.round(height * ratio)) : width,
          h: height,
        };
      case "fit": {
        const scale = Math.min(width / srcW, height / srcH);
        return {
          w: Math.max(1, Math.round(srcW * scale)),
          h: Math.max(1, Math.round(srcH * scale)),
        };
      }
      case "exact":
        return { w: width, h: height };
    }
  };

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const { w, h } = computeTarget(item.width ?? 1, item.height ?? 1);
      const targetW = Math.min(w, 16384);
      const targetH = Math.min(h, 16384);
      if (!allowUpscale && (targetW > item.width! || targetH > item.height!)) {
        throw new Error("图片将放大，已按设置跳过");
      }
      const resized = resizeCanvas(
        item.canvas,
        targetW,
        targetH,
        interpolation
      );
      const blob = await encodeCanvas(resized, "png");
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

  const outputFormatNote = "输出为 PNG 无损格式";

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Scaling}
            title="图片缩放"
            description="批量放大 / 缩小图片，支持四种插值算法，保持画质细节"
          />

          <div className="bg-card space-y-5 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">缩放选项</h2>
            </div>

            {/* 模式选择 */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(MODE_LABELS) as ResizeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    mode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            {/* 参数输入 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {mode === "percent" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    缩放比例：
                    <span className="text-primary font-medium">{percent}%</span>
                  </Label>
                  <Slider
                    value={[percent]}
                    min={1}
                    max={400}
                    step={1}
                    onValueChange={(v) => setPercent(v[0])}
                  />
                  <div className="text-muted-foreground flex justify-between text-[11px]">
                    <span>1%</span>
                    <span>原图 100%</span>
                    <span>400%</span>
                  </div>
                </div>
              )}

              {(mode === "width" ||
                mode === "height" ||
                mode === "fit" ||
                mode === "exact") && (
                <>
                  <div className="space-y-2">
                    <Label>宽度（px）</Label>
                    <Input
                      type="number"
                      min={1}
                      value={width}
                      onChange={(e) =>
                        setWidth(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>高度（px）</Label>
                    <Input
                      type="number"
                      min={1}
                      value={height}
                      onChange={(e) =>
                        setHeight(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                  </div>
                  {mode !== "fit" && mode !== "exact" && (
                    <div className="flex items-end pb-1">
                      <button
                        onClick={() => setLockAspect(!lockAspect)}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                      >
                        {lockAspect ? (
                          <>
                            <Lock className="h-3.5 w-3.5" /> 锁定宽高比
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" /> 不锁定宽高比
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 插值算法 */}
            <div className="space-y-2">
              <Label>插值算法</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {(Object.keys(INTERPOLATION_LABELS) as Interpolation[]).map(
                  (algo) => (
                    <button
                      key={algo}
                      onClick={() => setInterpolation(algo)}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        interpolation === algo
                          ? "bg-primary/10 border-primary"
                          : "bg-background hover:bg-accent"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs font-medium",
                          interpolation === algo ? "text-primary" : ""
                        )}
                      >
                        {INTERPOLATION_LABELS[algo]}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                        {INTERPOLATION_DESCRIPTIONS[algo]}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="upscale"
                checked={allowUpscale}
                onCheckedChange={setAllowUpscale}
              />
              <Label htmlFor="upscale">
                允许放大（关闭时跳过需要放大的图片）
              </Label>
            </div>
          </div>

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
          ) : (
            <div className="space-y-4">
              <BatchTable
                items={items}
                onRemove={removeItem}
                onClearAll={clearAll}
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
                      onClick={process.start}
                      disabled={items.length === 0}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      开始缩放（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="resized-images.zip"
                        />
                        <DownloadAllButton entries={entries} />
                        <span className="text-muted-foreground text-xs">
                          {entries.length} 个已完成 · {outputFormatNote}
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
