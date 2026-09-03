"use client";

import * as React from "react";
import {
  Grid3X3,
  Play,
  Square as StopSquare,
  Settings2,
  Download,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { encodeCanvas } from "@/lib/image-utils";
import { getBaseName, formatBytes, withExtension } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ZipExportButton, type ZipEntry } from "@/lib/zip";

export default function SplitPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [rows, setRows] = React.useState(2);
  const [cols, setCols] = React.useState(2);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const src = item.canvas;
      const tileW = Math.floor(src.width / cols);
      const tileH = Math.floor(src.height / rows);
      const entries: ZipEntry[] = [];
      const extraResults = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const target = document.createElement("canvas");
          target.width = tileW;
          target.height = tileH;
          const ctx = target.getContext("2d")!;
          ctx.drawImage(
            src,
            c * tileW,
            r * tileH,
            tileW,
            tileH,
            0,
            0,
            tileW,
            tileH
          );
          const blob = await encodeCanvas(target, format, {
            quality: 0.92,
            backgroundColor: "#ffffff",
          });
          const name = withExtension(
            `${getBaseName(item.name)}-${r + 1}x${c + 1}`,
            format
          );
          entries.push({ name, blob });
          extraResults.push({ blob, name, size: blob.size });
        }
      }
      const first = entries[0];
      updateItem(item.id, {
        result: { blob: first.blob, name: first.name, size: first.blob.size },
        extraResults,
      });
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

  const allEntries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.extraResults)
    .flatMap((i) =>
      (i.extraResults ?? []).map((r) => ({ name: r.name, blob: r.blob }))
    );

  const handleReset = () => {
    clearAll();
    process.reset();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Grid3X3}
            title="图片切片"
            description="将图片切割为等分网格切片，适合拼图、分块处理或网页切片导出"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">切片选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  行数：<span className="text-primary font-medium">{rows}</span>
                </Label>
                <Slider
                  value={[rows]}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(v) => setRows(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  列数：<span className="text-primary font-medium">{cols}</span>
                </Label>
                <Slider
                  value={[cols]}
                  min={1}
                  max={8}
                  step={1}
                  onValueChange={(v) => setCols(v[0])}
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
                renderExtra={(item) =>
                  item.extraResults && item.extraResults.length > 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {item.extraResults.length} 个切片
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
                      开始切片（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <>
                        <ZipExportButton
                          entries={allEntries}
                          zipName="sliced-images.zip"
                        />
                        <span className="text-muted-foreground text-xs">
                          已完成 {readyCount} 个，共 {allEntries.length} 个切片
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
