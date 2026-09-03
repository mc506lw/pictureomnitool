"use client";

import * as React from "react";
import {
  FileJson,
  Play,
  Square as StopSquare,
  Settings2,
  TableProperties,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import { decodeImageFile, makeThumbnail } from "@/lib/image-utils";
import { getBaseName, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ManifestItem = {
  name: string;
  width: number;
  height: number;
  size: number;
  format: string;
  thumbnail: string;
};

export default function ManifestPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [format, setFormat] = React.useState<"json" | "csv">("json");
  const [manifest, setManifest] = React.useState<ManifestItem[]>([]);
  const [processing, setProcessing] = React.useState(false);

  const buildManifest = async () => {
    setProcessing(true);
    const next: ManifestItem[] = [];
    for (const item of items) {
      let decoded = { canvas: item.canvas, width: item.width ?? 0, height: item.height ?? 0 };
      if (!decoded.canvas && item.file) {
        try {
          decoded = await decodeImageFile(item.file);
        } catch {
          continue;
        }
      }
      updateItem(item.id, {
        canvas: decoded.canvas,
        width: decoded.width,
        height: decoded.height,
        thumbnail: decoded.canvas ? makeThumbnail(decoded.canvas) : undefined,
        status: "done",
      });
      if (decoded.canvas) {
        next.push({
          name: item.name,
          width: decoded.width,
          height: decoded.height,
          size: item.size,
          format: getBaseName(item.name).split(".").pop() ?? "",
          thumbnail: makeThumbnail(decoded.canvas),
        });
      }
    }
    setManifest(next);
    setProcessing(false);
  };

  const handleReset = () => {
    clearAll();
    setManifest([]);
  };

  const downloadManifest = () => {
    if (manifest.length === 0) return;
    let content: string;
    let mime: string;
    if (format === "json") {
      content = JSON.stringify(manifest, null, 2);
      mime = "application/json";
    } else {
      const header = "name,width,height,size,format\n";
      const rows = manifest
        .map(
          (m) =>
            `${m.name},${m.width},${m.height},${m.size},${m.format}`
        )
        .join("\n");
      content = header + rows;
      mime = "text/csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={TableProperties}
            title="图片信息"
            description="查看并导出图片清单，含尺寸、格式、体积和缩略图"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">导出选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>导出格式</Label>
                <div className="flex items-center gap-2 pt-1">
                  {(["json", "csv"] as const).map((f) => (
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
              <div className="space-y-2">
                <Label>操作</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Button onClick={buildManifest} disabled={items.length === 0 || processing} className="gap-2">
                    <Play className="h-4 w-4" />
                    生成清单
                  </Button>
                  <Button variant="outline" onClick={downloadManifest} disabled={manifest.length === 0} className="gap-2">
                    <FileJson className="h-4 w-4" />
                    下载清单
                  </Button>
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
              />

              {manifest.length > 0 && (
                <div className="bg-card rounded-lg border">
                  <div className="border-b p-4">
                    <div className="text-sm font-medium">图片清单</div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      共 {manifest.length} 个文件
                    </div>
                  </div>
                  <div className="divide-y">
                    {manifest.map((m, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4">
                        {m.thumbnail ? (
                          <img
                            src={m.thumbnail}
                            alt={m.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="bg-muted h-10 w-10 rounded" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{m.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {m.width} × {m.height} · {formatBytes(m.size)} · {m.format.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
