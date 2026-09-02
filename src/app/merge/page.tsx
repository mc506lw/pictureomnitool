"use client";

import * as React from "react";
import {
  Columns,
  Rows,
  Play,
  Square,
  Settings2,
  GripVertical,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  mergeImages,
  DEFAULT_MERGE_OPTIONS,
  type MergeOptions,
} from "@/lib/merge";
import { encodeCanvas } from "@/lib/image-utils";
import { formatBytes } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PREVIEW_MAX = 520;

export default function MergePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [direction, setDirection] =
    React.useState<MergeOptions["direction"]>("horizontal");
  const [spacing, setSpacing] = React.useState(DEFAULT_MERGE_OPTIONS.spacing);
  const [background, setBackground] = React.useState(
    DEFAULT_MERGE_OPTIONS.background
  );
  const [align, setAlign] = React.useState<MergeOptions["align"]>("center");

  const readyItems = items.filter((i) => i.canvas);

  const [previewUrl, setPreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sources = readyItems.map((i) => i.canvas!).filter(Boolean);
      if (sources.length < 2) {
        setPreviewUrl("");
        return;
      }
      const out = mergeImages(sources, {
        direction,
        spacing,
        background,
        align,
      });
      const scale = Math.min(1, PREVIEW_MAX / Math.max(out.width, out.height));
      const w = Math.max(1, Math.round(out.width * scale));
      const h = Math.max(1, Math.round(out.height * scale));
      const preview = document.createElement("canvas");
      preview.width = w;
      preview.height = h;
      preview.getContext("2d")!.drawImage(out, 0, 0, w, h);
      if (!cancelled) setPreviewUrl(preview.toDataURL("image/png"));
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [readyItems, direction, spacing, background, align]);

  const process = useBatchProcess({
    items: readyItems,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const out = mergeImages(
        readyItems.map((i) => i.canvas!),
        { direction, spacing, background, align }
      );
      const blob = await encodeCanvas(out, "png");
      const ext = direction === "horizontal" ? "h" : "v";
      const base = items.map((i) => i.name.replace(/\.[^.]+$/, "")).join("_");
      const name = `${base}_merged_${ext}.png`;
      for (const i of readyItems) {
        updateItem(i.id, { result: { blob, name, size: blob.size } });
      }
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

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Columns}
            title="拼图合并"
            description="将多张图片横向或纵向拼接，支持间距和背景色"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">合并设置</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>方向</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDirection("horizontal")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      direction === "horizontal"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Columns className="h-3.5 w-3.5" />
                    横向
                  </button>
                  <button
                    onClick={() => setDirection("vertical")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      direction === "vertical"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Rows className="h-3.5 w-3.5" />
                    纵向
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  间距：
                  <span className="text-primary font-medium">{spacing}px</span>
                </Label>
                <Slider
                  value={[spacing]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={(v) => setSpacing(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label>背景色</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="h-9 w-16 cursor-pointer rounded border"
                  />
                  <span className="text-muted-foreground font-mono text-xs">
                    {background}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>对齐</Label>
                <div className="flex gap-2">
                  {(["start", "center", "end"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAlign(a)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                        align === a
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {a === "start"
                        ? "顶/左"
                        : a === "center"
                          ? "居中"
                          : "底/右"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {items.length < 2 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-xs">
              请至少添加 2 张图片进行合并（当前 {items.length} 张）
            </div>
          ) : (
            <div className="space-y-4">
              <BatchTable
                items={items}
                onRemove={removeItem}
                onClearAll={clearAll}
                allowAdd
                onAdd={addFiles}
                showDimensions
              />

              {readyItems.length >= 2 && (
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-muted-foreground mb-3 text-xs font-medium">
                    实时预览
                  </div>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="合并预览"
                      className="max-h-72 w-full rounded border object-contain"
                    />
                  ) : (
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      正在生成预览…
                    </p>
                  )}
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
                      disabled={readyItems.length < 2 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      合并图片（{readyItems.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="merged-images.zip"
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
