"use client";

import * as React from "react";
import {
  RotateCw,
  Play,
  Square,
  Settings2,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  applyRotateFlip,
  DEFAULT_ROTATE_OPTIONS,
  type RotateFlipOptions,
} from "@/lib/rotate";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PREVIEW_MAX = 420;

function PreviewCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const [url, setUrl] = React.useState<string>("");
  React.useEffect(() => {
    const scale = Math.min(
      1,
      PREVIEW_MAX / Math.max(canvas.width, canvas.height)
    );
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0, w, h);
    setUrl(out.toDataURL("image/png"));
  }, [canvas]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt="预览"
      className="max-h-72 w-full rounded border object-contain"
    />
  );
}

export default function RotatePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [rotateDeg, setRotateDeg] = React.useState(
    DEFAULT_ROTATE_OPTIONS.rotateDeg
  );
  const [flip, setFlip] = React.useState<RotateFlipOptions["flip"]>("none");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const out = applyRotateFlip(item.canvas, { rotateDeg, flip });
      const blob = await encodeCanvas(out, "png");
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

  const [previewUrl, setPreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const source = items.find((i) => i.canvas);
      if (!source?.canvas) {
        setPreviewUrl("");
        return;
      }
      const out = applyRotateFlip(source.canvas, { rotateDeg, flip });
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
  }, [items, rotateDeg, flip]);

  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  const quickAngles = [0, 90, 180, 270];

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={RotateCw}
            title="旋转与翻转"
            description="任意角度旋转、水平/垂直翻转，批量应用到多张图片"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">旋转设置</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  旋转角度：
                  <span className="text-primary font-medium">{rotateDeg}°</span>
                </Label>
                <Slider
                  value={[rotateDeg]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={(v) => setRotateDeg(v[0])}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {quickAngles.map((a) => (
                    <button
                      key={a}
                      onClick={() => setRotateDeg(a)}
                      className={cn(
                        "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
                        rotateDeg === a
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {a === 0 ? "0°" : `${a}°`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>翻转</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFlip("none")}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      flip === "none"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    无
                  </button>
                  <button
                    onClick={() => setFlip("horizontal")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      flip === "horizontal"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <FlipHorizontal className="h-3.5 w-3.5" />
                    水平
                  </button>
                  <button
                    onClick={() => setFlip("vertical")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                      flip === "vertical"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <FlipVertical className="h-3.5 w-3.5" />
                    垂直
                  </button>
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
                      alt="旋转预览"
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
                      旋转翻转（{items.length}）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="rotated-images.zip"
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
