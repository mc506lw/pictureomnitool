"use client";

import * as React from "react";
import { Repeat, Play, Square, Settings2 } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  encodeCanvas,
  getSupportedEncodeFormats,
  type EncodeFormat,
} from "@/lib/image-utils";
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
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  { value: "#ffffff", label: "白色" },
  { value: "#000000", label: "黑色" },
  { value: "#f5f5f5", label: "浅灰" },
  { value: "#ffd700", label: "金色" },
  { value: "#4caf50", label: "绿色" },
  { value: "#2196f3", label: "蓝色" },
  { value: "transparent", label: "透明" },
];

export default function ConvertPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [format, setFormat] = React.useState<EncodeFormat>("png");
  const [quality, setQuality] = React.useState(92);
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [formats, setFormats] = React.useState<EncodeFormat[]>([]);

  // 客户端挂载后检测浏览器支持的编码格式
  React.useEffect(() => {
    setFormats(getSupportedEncodeFormats());
  }, []);

  const isLossy = format === "jpeg" || format === "webp" || format === "avif";
  const needBg = format === "jpeg";

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const blob = await encodeCanvas(item.canvas, format, {
        quality: quality / 100,
        backgroundColor: bgColor,
      });
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

  const readyCount = items.filter(
    (i) => i.status === "done" && i.result
  ).length;
  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  const handleProcess = () => {
    process.start();
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Repeat}
            title="格式转换"
            description="批量将图片转换为任意格式，支持 PNG / JPEG / WebP / AVIF / BMP / GIF / ICO"
          />

          {/* 选项面板 */}
          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">转换选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>输出格式</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as EncodeFormat)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-[11px]">
                  {format === "ico"
                    ? "ICO 将自动生成 16~256 多尺寸"
                    : format === "gif"
                      ? "GIF 最多 256 色"
                      : format === "bmp"
                        ? "BMP 无损（24/32 位）"
                        : format === "png"
                          ? "PNG 无损，保留透明通道"
                          : "有损格式，可调节质量"}
                </p>
              </div>

              {isLossy && (
                <div className="space-y-2">
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
                  <p className="text-muted-foreground text-[11px]">
                    {quality >= 90
                      ? "高质量（文件较大）"
                      : quality >= 70
                        ? "均衡"
                        : "高压缩（画质下降）"}
                  </p>
                </div>
              )}

              {needBg && (
                <div className="space-y-2">
                  <Label>背景色（JPEG 不支持透明）</Label>
                  <div className="flex items-center gap-2 pt-1">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        title={c.label}
                        onClick={() => setBgColor(c.value)}
                        className={cn(
                          "h-7 w-7 rounded-full border transition-transform",
                          bgColor === c.value &&
                            "ring-primary scale-110 ring-2 ring-offset-2"
                        )}
                        style={{
                          background:
                            c.value === "transparent"
                              ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px"
                              : c.value,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 文件区 */}
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
                      onClick={handleProcess}
                      disabled={items.length === 0 || process.running}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Play className="h-4 w-4" />
                      开始转换（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <>
                        <ZipExportButton
                          entries={entries}
                          zipName="converted-images.zip"
                        />
                        <DownloadAllButton entries={entries} />
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
