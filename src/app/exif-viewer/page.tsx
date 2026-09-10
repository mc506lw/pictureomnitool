"use client";

import * as React from "react";
import {
  Camera,
  Play,
  Square as StopSquare,
  Settings2,
  Copy,
  Check,
  MapPin,
  Calendar,
  Gauge,
  Aperture,
  Timer,
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import exifr from "exifr";

type ExifSummary = {
  make?: string;
  model?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  lensModel?: string;
  software?: string;
  flash?: string;
  whiteBalance?: string;
  gps?: { lat?: number; lon?: number };
  width?: number;
  height?: number;
};

export default function ExifViewerPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [exifMap, setExifMap] = React.useState<Map<string, ExifSummary>>(
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
      try {
        const decoded = await decodeImageFile(item.file);
        const exif = await exifr.parse(item.file, {
          pick: [
            "make",
            "model",
            "dateTimeOriginal",
            "exposureTime",
            "fNumber",
            "iso",
            "focalLength",
            "lensModel",
            "software",
            "flash",
            "whiteBalance",
            "latitude",
            "longitude",
          ],
        });
        const summary: ExifSummary = {
          make: exif?.make,
          model: exif?.model,
          dateTime: exif?.dateTimeOriginal
            ? new Date(exif.dateTimeOriginal).toLocaleString("zh-CN")
            : undefined,
          exposureTime: exif?.exposureTime
            ? `1/${Math.round(1 / (exif.exposureTime as number))}s`
            : undefined,
          fNumber: exif?.fNumber ? `f/${exif.fNumber}` : undefined,
          iso: exif?.iso,
          focalLength: exif?.focalLength ? `${exif.focalLength}mm` : undefined,
          lensModel: exif?.lensModel,
          software: exif?.software,
          flash: exif?.flash ? "已开启" : "未开启",
          whiteBalance: exif?.whiteBalance ? "自动" : "手动",
          gps:
            exif?.latitude && exif?.longitude
              ? { lat: exif.latitude as number, lon: exif.longitude as number }
              : undefined,
          width: decoded.width,
          height: decoded.height,
        };
        setExifMap((prev) => {
          const next = new Map(prev);
          next.set(item.id, summary);
          return next;
        });
        updateItem(item.id, {
          width: decoded.width,
          height: decoded.height,
          thumbnail: decoded.canvas
            ? decoded.canvas.toDataURL("image/jpeg", 0.7)
            : undefined,
          status: "done",
        });
      } catch {
        updateItem(item.id, {
          status: "error",
          error: "无法读取 EXIF 信息，该图片可能不包含元数据",
        });
      }
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "读取失败",
      }),
  });

  const readyCount = items.filter((i) => i.status === "done").length;

  const copyExif = async (itemId: string, exif: ExifSummary) => {
    const text = Object.entries(exif)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const handleReset = () => {
    clearAll();
    process.reset();
    setExifMap(new Map());
    setCopiedId(null);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Camera}
            title="EXIF 查看器"
            description="读取图片的拍摄参数、相机型号、时间和 GPS 位置信息"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">操作</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={process.start}
                disabled={items.length === 0 || process.running}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                读取 EXIF
              </Button>
              {readyCount > 0 && (
                <span className="text-muted-foreground text-xs">
                  已完成 {readyCount} 个
                </span>
              )}
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

              {exifMap.size > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {items.map((item) => {
                    const exif = exifMap.get(item.id);
                    if (!exif) return null;
                    return (
                      <div
                        key={item.id}
                        className="bg-card rounded-lg border p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {getBaseName(item.name)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {exif.width} × {exif.height} ·{" "}
                              {formatBytes(item.size)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => copyExif(item.id, exif)}
                          >
                            {copiedId === item.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                            {copiedId === item.id ? "已复制" : "复制"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {exif.make && (
                            <div className="col-span-2 flex items-center gap-2 text-xs">
                              <Camera className="text-muted-foreground h-4 w-4" />
                              <span className="font-medium">{exif.make}</span>
                              {exif.model && (
                                <span className="text-muted-foreground">
                                  · {exif.model}
                                </span>
                              )}
                            </div>
                          )}
                          {exif.dateTime && (
                            <div className="col-span-2 flex items-center gap-2 text-xs">
                              <Calendar className="text-muted-foreground h-4 w-4" />
                              <span>{exif.dateTime}</span>
                            </div>
                          )}
                          {exif.exposureTime && (
                            <div className="flex items-center gap-2 text-xs">
                              <Timer className="text-muted-foreground h-4 w-4" />
                              <span>快门 {exif.exposureTime}</span>
                            </div>
                          )}
                          {exif.fNumber && (
                            <div className="flex items-center gap-2 text-xs">
                              <Aperture className="text-muted-foreground h-4 w-4" />
                              <span>光圈 {exif.fNumber}</span>
                            </div>
                          )}
                          {exif.iso && (
                            <div className="flex items-center gap-2 text-xs">
                              <Gauge className="text-muted-foreground h-4 w-4" />
                              <span>ISO {exif.iso}</span>
                            </div>
                          )}
                          {exif.focalLength && (
                            <div className="flex items-center gap-2 text-xs">
                              <Camera className="text-muted-foreground h-4 w-4" />
                              <span>焦距 {exif.focalLength}</span>
                            </div>
                          )}
                          {exif.gps && (
                            <div className="col-span-2 flex items-center gap-2 text-xs">
                              <MapPin className="text-muted-foreground h-4 w-4" />
                              <span>
                                {exif.gps.lat?.toFixed(4)},{" "}
                                {exif.gps.lon?.toFixed(4)}
                              </span>
                            </div>
                          )}
                          {exif.software && (
                            <div className="text-muted-foreground col-span-2 text-xs">
                              软件：{exif.software}
                            </div>
                          )}
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
