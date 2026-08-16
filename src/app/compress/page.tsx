"use client";

import * as React from "react";
import { FileArchive, Play, Square, Settings2, Target } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { encodeCanvas, type EncodeFormat } from "@/lib/image-utils";
import { withExtension, formatBytes } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function CompressPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [format, setFormat] = React.useState<EncodeFormat>("webp");
  const [quality, setQuality] = React.useState(80);
  const [useTarget, setUseTarget] = React.useState(false);
  const [targetKb, setTargetKb] = React.useState(200);

  const lossy = format === "jpeg" || format === "webp" || format === "avif";

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const q = quality / 100;
      let blob: Blob;
      if (useTarget && lossy) {
        blob = await compressToTarget(item.canvas, format, targetKb * 1024);
      } else {
        blob = await encodeCanvas(item.canvas, format, { quality: q });
      }
      const name = withExtension(item.name, format);
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

  const totalSaved = items
    .filter((i) => i.status === "done" && i.result)
    .reduce((sum, i) => sum + Math.max(0, i.size - i.result!.size), 0);

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={FileArchive}
            title="图片压缩"
            description="批量压缩图片体积，支持质量调节与指定目标大小，压缩效果实时对比"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">压缩选项</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>输出格式</Label>
                <div className="flex gap-2">
                  {(["webp", "jpeg", "avif"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                        format === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-[11px]">
                  WebP 压缩率最高，JPEG 兼容性最好
                </p>
              </div>

              <div
                className={cn(
                  "space-y-2",
                  useTarget && "pointer-events-none opacity-40"
                )}
              >
                <Label>
                  质量：
                  <span className="text-primary font-medium">{quality}%</span>
                </Label>
                <Slider
                  value={[quality]}
                  min={1}
                  max={100}
                  step={1}
                  onValueChange={(v) => setQuality(v[0])}
                />
                <div className="text-muted-foreground flex justify-between text-[11px]">
                  <span>小体积</span>
                  <span>高质量</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    id="target"
                    checked={useTarget}
                    onCheckedChange={setUseTarget}
                  />
                  <Label htmlFor="target" className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    指定目标大小
                  </Label>
                </div>
                {useTarget && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={10240}
                      value={targetKb}
                      onChange={(e) =>
                        setTargetKb(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="h-8"
                    />
                    <span className="text-muted-foreground text-xs">
                      KB / 张
                    </span>
                  </div>
                )}
                <p className="text-muted-foreground text-[11px]">
                  自动二分查找最优质量，使压缩后不超过目标大小
                </p>
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
                onClearAll={clearAll}
                allowAdd
                onAdd={addFiles}
                renderResult={(item) =>
                  item.result ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          item.result.size < item.size
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-destructive"
                        )}
                      >
                        {formatBytes(item.result.size)}
                      </span>
                      {item.result.size < item.size && (
                        <span className="text-emerald-600/80 dark:text-emerald-400/80">
                          (-
                          {Math.round((1 - item.result.size / item.size) * 100)}
                          %)
                        </span>
                      )}
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
                      开始压缩（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="compressed-images.zip"
                        />
                        <DownloadAllButton entries={entries} />
                        <span className="text-muted-foreground text-xs">
                          共节省 {formatBytes(totalSaved)}
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

/** 二分查找质量，使输出接近且不超过目标字节数 */
async function compressToTarget(
  canvas: HTMLCanvasElement,
  format: EncodeFormat,
  targetBytes: number
): Promise<Blob> {
  let low = 1;
  let high = 100;
  let best: Blob | null = null;

  // 先试 50%
  const first = await encodeCanvas(canvas, format, { quality: 0.5 });
  if (first.size <= targetBytes) {
    best = first;
    low = 50;
  } else {
    high = 49;
  }

  for (let i = 0; i < 7; i++) {
    const q = Math.round((low + high) / 2);
    const blob = await encodeCanvas(canvas, format, { quality: q / 100 });
    if (blob.size <= targetBytes) {
      best = blob;
      low = q + 1;
    } else {
      high = q - 1;
    }
    if (low > high) break;
  }

  if (!best) {
    // 最低质量仍超目标：返回最低质量
    best = await encodeCanvas(canvas, format, { quality: 0.05 });
  }
  return best;
}
