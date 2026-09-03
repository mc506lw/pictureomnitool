"use client";

import * as React from "react";
import {
  LayoutGrid,
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
import { decodeImageFile, encodeCanvas } from "@/lib/image-utils";
import { getBaseName, formatBytes, withExtension } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ZipExportButton, type ZipEntry } from "@/lib/zip";
import { cn } from "@/lib/utils";

export default function CollagePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [rows, setRows] = React.useState(2);
  const [cols, setCols] = React.useState(2);
  const [spacing, setSpacing] = React.useState(8);
  const [radius, setRadius] = React.useState(0);
  const [format, setFormat] = React.useState<"png" | "jpeg" | "webp">("png");
  const [bg, setBg] = React.useState("#ffffff");

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.file) throw new Error("缺少图片文件");
      const decoded = await decodeImageFile(item.file);
      const cellW = decoded.width;
      const cellH = decoded.height;
      const totalW = cols * cellW + (cols - 1) * spacing;
      const totalH = rows * cellH + (rows - 1) * spacing;
      const target = document.createElement("canvas");
      target.width = totalW;
      target.height = totalH;
      const ctx = target.getContext("2d")!;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, totalW, totalH);
      ctx.drawImage(decoded.canvas, 0, 0, cellW, cellH);
      const blob = await encodeCanvas(target, format, {
        quality: 0.92,
        backgroundColor: bg,
      });
      const name = withExtension(`${getBaseName(item.name)}-collage`, format);
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

  const allEntries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  const handleReset = () => {
    clearAll();
    process.reset();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={LayoutGrid}
            title="拼图组合"
            description="将多张图片组合为网格拼图，支持间距、圆角和背景色"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">拼图选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>行数</Label>
                <Slider
                  value={[rows]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(v) => setRows(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>列数</Label>
                <Slider
                  value={[cols]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(v) => setCols(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>间距</Label>
                <Slider
                  value={[spacing]}
                  min={0}
                  max={64}
                  step={4}
                  onValueChange={(v) => setSpacing(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>圆角</Label>
                <Slider
                  value={[radius]}
                  min={0}
                  max={64}
                  step={4}
                  onValueChange={(v) => setRadius(v[0])}
                />
              </div>
              <div className="space-y-2">
                <Label>背景色</Label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={bg}
                    onChange={(e) => setBg(e.target.value)}
                    className="h-9 w-16 cursor-pointer rounded-md border"
                  />
                  <span className="text-muted-foreground text-xs">{bg}</span>
                </div>
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
            <FileDropzone onFiles={addFiles} accept="image/*" multiple />
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
                      disabled={items.length === 0 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      生成拼图（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <>
                        <ZipExportButton
                          entries={allEntries}
                          zipName="collages.zip"
                        />
                        <span className="text-muted-foreground text-xs">
                          已完成 {readyCount} 个
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
