"use client";

import * as React from "react";
import { Ruler, Play, Square, Check } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { PRESET_PACKS, type PresetPack, type SizePreset } from "@/lib/presets";
import { resizeCanvas, type Interpolation } from "@/lib/resample";
import { encodeCanvas } from "@/lib/image-utils";
import { formatBytes, sanitizeFileName } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type FitMode = "contain" | "cover" | "fill";

const FIT_LABELS: Record<FitMode, string> = {
  contain: "完整包含（留白）",
  cover: "铺满裁剪",
  fill: "拉伸填满",
};

/** 按 fit 模式生成目标尺寸画布 */
function fitCanvas(
  source: HTMLCanvasElement,
  w: number,
  h: number,
  mode: FitMode,
  interpolation: Interpolation
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (mode === "fill") {
    const resized = resizeCanvas(source, w, h, interpolation);
    ctx.drawImage(resized, 0, 0);
    return canvas;
  }

  const scale =
    mode === "cover"
      ? Math.max(w / source.width, h / source.height)
      : Math.min(w / source.width, h / source.height);
  const dw = Math.round(source.width * scale);
  const dh = Math.round(source.height * scale);
  const dx = Math.round((w - dw) / 2);
  const dy = Math.round((h - dh) / 2);
  const resized = resizeCanvas(source, dw, dh, interpolation);
  ctx.drawImage(resized, dx, dy);
  return canvas;
}

export default function PresetsPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [packId, setPackId] = React.useState<string>(PRESET_PACKS[0].id);
  const [selectedSizes, setSelectedSizes] = React.useState<Set<string>>(
    new Set()
  );
  const [fitMode, setFitMode] = React.useState<FitMode>("contain");
  const [interpolation, setInterpolation] =
    React.useState<Interpolation>("bicubic");
  const [outputFormat, setOutputFormat] = React.useState<"png" | "jpeg">("png");
  const [whiteBg, setWhiteBg] = React.useState(false);

  const pack = PRESET_PACKS.find((p) => p.id === packId) ?? PRESET_PACKS[0];

  React.useEffect(() => {
    // 切换预设包时默认全选
    setSelectedSizes(
      new Set(pack.presets.map((p) => `${p.width}x${p.height}`))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId]);

  const toggleSize = (p: SizePreset) => {
    const key = `${p.width}x${p.height}`;
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const sizes = pack.presets.filter((p) =>
        selectedSizes.has(`${p.width}x${p.height}`)
      );
      if (sizes.length === 0) throw new Error("未选择任何尺寸");
      const base = sanitizeFileName(item.name.replace(/\.[^.]+$/, ""));
      const outputs: { blob: Blob; name: string; size: number }[] = [];
      for (const size of sizes) {
        const fitted = fitCanvas(
          item.canvas,
          size.width,
          size.height,
          fitMode,
          interpolation
        );
        const blob = await encodeCanvas(fitted, outputFormat, {
          quality: 0.92,
          backgroundColor: whiteBg ? "#ffffff" : undefined,
        });
        outputs.push({
          blob,
          name: `${base}@${size.width}x${size.height}.${outputFormat}`,
          size: blob.size,
        });
      }
      // 多尺寸结果存入第一个，其余附加到导出列表
      const first = outputs[0];
      updateItem(item.id, {
        result: { blob: first.blob, name: first.name, size: first.size },
        extraResults: outputs.slice(1),
      });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const entries: ZipEntry[] = React.useMemo(() => {
    const list: ZipEntry[] = [];
    for (const item of items) {
      if (item.status !== "done" || !item.result) continue;
      list.push({ name: item.result.name, blob: item.result.blob });
      if (item.extraResults) {
        for (const e of item.extraResults)
          list.push({ name: e.name, blob: e.blob });
      }
    }
    return list;
  }, [items]);

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Ruler}
            title="尺寸预设包"
            description="社交平台、电商、壁纸、打印等常用尺寸一键套用，批量输出多尺寸图片"
          />

          {/* 预设包选择 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESET_PACKS.map((p: PresetPack) => (
              <button
                key={p.id}
                onClick={() => setPackId(p.id)}
                className={cn(
                  "bg-card rounded-lg border p-3 text-left transition-colors",
                  packId === p.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                )}
              >
                <div className="text-lg">{p.icon}</div>
                <div className="mt-1 text-xs font-medium">{p.name}</div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  {p.presets.length} 个尺寸
                </div>
              </button>
            ))}
          </div>

          {/* 尺寸选择 */}
          <div className="bg-card rounded-lg border p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">{pack.name}</h2>
                <p className="text-muted-foreground text-xs">
                  {pack.description}
                </p>
              </div>
              <button
                onClick={() => {
                  if (selectedSizes.size === pack.presets.length)
                    setSelectedSizes(new Set());
                  else
                    setSelectedSizes(
                      new Set(pack.presets.map((p) => `${p.width}x${p.height}`))
                    );
                }}
                className="text-muted-foreground hover:text-primary text-xs font-medium transition-colors"
              >
                {selectedSizes.size === pack.presets.length
                  ? "取消全选"
                  : "全选"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {pack.presets.map((p) => {
                const key = `${p.width}x${p.height}`;
                const selected = selectedSizes.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSize(p)}
                    className={cn(
                      "relative flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-accent"
                    )}
                  >
                    <div>
                      <div className="text-xs font-medium">{p.name}</div>
                      <div className="text-muted-foreground font-mono text-[11px]">
                        {p.width} × {p.height}
                      </div>
                    </div>
                    {selected && (
                      <span className="bg-primary text-primary-foreground flex h-5 w-5 items-center justify-center rounded-full">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 输出选项 */}
          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs font-medium">
                  填充方式
                </div>
                <div className="space-y-1.5">
                  {(Object.keys(FIT_LABELS) as FitMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFitMode(m)}
                      className={cn(
                        "block w-full rounded-md border px-3 py-1.5 text-left text-xs font-medium transition-colors",
                        fitMode === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {FIT_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs font-medium">
                  输出格式
                </div>
                <div className="flex gap-2">
                  {(["png", "jpeg"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setOutputFormat(f)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        outputFormat === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <label className="text-muted-foreground flex items-center gap-2 pt-2 text-xs">
                  <input
                    type="checkbox"
                    checked={whiteBg}
                    onChange={(e) => setWhiteBg(e.target.checked)}
                    className="accent-foreground"
                  />
                  contain 时填充白色背景（JPEG 必填）
                </label>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs font-medium">
                  插值算法
                </div>
                <select
                  value={interpolation}
                  onChange={(e) =>
                    setInterpolation(e.target.value as Interpolation)
                  }
                  className="border-input bg-background text-muted-foreground h-8 w-full rounded-md border px-2 text-xs"
                >
                  <option value="nearest">最近邻（像素画）</option>
                  <option value="bilinear">双线性</option>
                  <option value="bicubic">双三次（推荐）</option>
                  <option value="lanczos">Lanczos-3</option>
                </select>
                <p className="text-muted-foreground text-[11px]">
                  已选 {selectedSizes.size} 个尺寸 × {items.length} 张图片 ={" "}
                  {selectedSizes.size * items.length} 个输出
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
                      disabled={items.length === 0 || selectedSizes.size === 0}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      开始生成（{selectedSizes.size * items.length} 个输出）
                    </button>
                    {entries.length > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName={`${pack.name}-output.zip`}
                        />
                        <DownloadAllButton entries={entries} />
                        <span className="text-muted-foreground text-xs">
                          已生成 {entries.length} 个文件
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
