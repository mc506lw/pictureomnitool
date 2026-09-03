"use client";

import * as React from "react";
import {
  Info,
  RefreshCcw,
  Trash2,
  Camera,
  MapPin,
  Cpu,
  Clock,
  Palette,
  Shield,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { readImageMeta, formatMetaDate } from "@/lib/meta";
import exifr from "exifr";
import { encodeCanvas } from "@/lib/image-utils";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExifData {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: string;
  iso?: number;
  focalLength?: string;
  lensModel?: string;
  whiteBalance?: string;
  flash?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  copyright?: string;
  artist?: string;
  imageDescription?: string;
  xResolution?: number;
  yResolution?: number;
  resolutionUnit?: string;
  colorSpace?: string;
  exposureProgram?: string;
  meteringMode?: string;
  lightSource?: string;
  sensingMethod?: string;
  customRendered?: string;
  exposureMode?: string;
  digitalZoomRatio?: string;
  sceneCaptureType?: string;
  contrast?: string;
  saturation?: string;
  sharpness?: string;
  subjectDistanceRange?: string;
}

function Section({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-lg border p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="text-primary h-4 w-4" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

export default function MetadataPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const [metas, setMetas] = React.useState<
    Record<string, Awaited<ReturnType<typeof readImageMeta>>>
  >({});
  const [exifDataMap, setExifDataMap] = React.useState<
    Record<string, ExifData | null>
  >({});
  const [loadingExif, setLoadingExif] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const readyItems = items.filter((i) => i.canvas);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!selectedId && readyItems.length > 0) {
      setSelectedId(readyItems[0].id);
    }
  }, [readyItems, selectedId]);

  const selected = readyItems.find((i) => i.id === selectedId) ?? readyItems[0];

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<
        string,
        Awaited<ReturnType<typeof readImageMeta>>
      > = {};
      for (const item of items) {
        if (!item.file) continue;
        try {
          const meta = await readImageMeta(item.file);
          next[item.id] = meta;
        } catch {
          // ignore
        }
      }
      if (!cancelled) setMetas(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const loadExifData = async () => {
    setLoadingExif(true);
    try {
      const next: Record<string, ExifData | null> = {};
      for (const item of items) {
        if (!item.file) {
          next[item.id] = null;
          continue;
        }
        try {
          const exif = await exifr.parse(item.file, {
            pick: [
              "Make",
              "Model",
              "Software",
              "DateTimeOriginal",
              "ExposureTime",
              "FNumber",
              "ISO",
              "FocalLength",
              "LensModel",
              "WhiteBalance",
              "Flash",
              "GPSLatitude",
              "GPSLongitude",
              "GPSAltitude",
              "Copyright",
              "Artist",
              "ImageDescription",
              "XResolution",
              "YResolution",
              "ResolutionUnit",
              "ColorSpace",
              "ExposureProgram",
              "MeteringMode",
              "LightSource",
              "SensingMethod",
              "CustomRendered",
              "ExposureMode",
              "DigitalZoomRatio",
              "SceneCaptureType",
              "Contrast",
              "Saturation",
              "Sharpness",
              "SubjectDistanceRange",
            ],
          });
          if (!exif) {
            next[item.id] = null;
            continue;
          }
          next[item.id] = {
            make: exif.Make as string | undefined,
            model: exif.Model as string | undefined,
            software: exif.Software as string | undefined,
            dateTime: exif.DateTimeOriginal
              ? new Date(exif.DateTimeOriginal).toLocaleString()
              : undefined,
            exposureTime: exif.ExposureTime
              ? (exif.ExposureTime as number) < 1
                ? `1/${Math.round(1 / (exif.ExposureTime as number))}s`
                : `${exif.ExposureTime}s`
              : undefined,
            fNumber: exif.FNumber ? `f/${exif.FNumber}` : undefined,
            iso: exif.ISO as number | undefined,
            focalLength: exif.FocalLength ? `${exif.FocalLength}mm` : undefined,
            lensModel: exif.LensModel as string | undefined,
            whiteBalance:
              exif.WhiteBalance === 0
                ? "自动"
                : exif.WhiteBalance === 1
                  ? "手动"
                  : undefined,
            flash: exif.Flash as string | undefined,
            gpsLatitude: exif.GPSLatitude as number | undefined,
            gpsLongitude: exif.GPSLongitude as number | undefined,
            gpsAltitude: exif.GPSAltitude as number | undefined,
            copyright: exif.Copyright as string | undefined,
            artist: exif.Artist as string | undefined,
            imageDescription: exif.ImageDescription as string | undefined,
            xResolution: exif.XResolution as number | undefined,
            yResolution: exif.YResolution as number | undefined,
            resolutionUnit: exif.ResolutionUnit as string | undefined,
            colorSpace: exif.ColorSpace as string | undefined,
            exposureProgram: exif.ExposureProgram as string | undefined,
            meteringMode: exif.MeteringMode as string | undefined,
            lightSource: exif.LightSource as string | undefined,
            sensingMethod: exif.SensingMethod as string | undefined,
            customRendered: exif.CustomRendered as string | undefined,
            exposureMode: exif.ExposureMode as string | undefined,
            digitalZoomRatio: exif.DigitalZoomRatio as string | undefined,
            sceneCaptureType: exif.SceneCaptureType as string | undefined,
            contrast: exif.Contrast as string | undefined,
            saturation: exif.Saturation as string | undefined,
            sharpness: exif.Sharpness as string | undefined,
            subjectDistanceRange: exif.SubjectDistanceRange as
              string | undefined,
          };
        } catch {
          next[item.id] = null;
        }
      }
      setExifDataMap(next);
      toast.success("EXIF 数据加载完成");
    } finally {
      setLoadingExif(false);
    }
  };

  const handleReprocess = async () => {
    const updates = await Promise.all(
      items.map(async (item) => {
        if (item.canvas) return item;
        try {
          const decoded = await decodeImageFileAsync(item.file);
          return {
            ...item,
            canvas: decoded.canvas,
            width: decoded.width,
            height: decoded.height,
          };
        } catch {
          return item;
        }
      })
    );
    useBatchStore.setState({ items: updates });
    toast.success("已重新解析图片");
  };

  async function decodeImageFileAsync(
    file: File
  ): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
    const { decodeImageFile } = await import("@/lib/image-utils");
    return decodeImageFile(file);
  }

  const selectedMeta = mounted ? metas[selected?.id ?? ""] : undefined;
  const selectedExif = mounted ? exifDataMap[selected?.id ?? ""] : undefined;

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Info}
            title="图片元数据"
            description="查看图片完整信息，包括 EXIF 相机参数、GPS 定位等"
          />

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
          ) : (
            <div className="space-y-4">
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium">图片信息</h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      基础信息来自浏览器解析，EXIF 相机参数需点击下方按钮加载
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadExifData}
                      disabled={loadingExif}
                      className="gap-1.5"
                    >
                      {loadingExif ? "加载中…" : "读取 EXIF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReprocess}
                      className="gap-1.5"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      重新解析
                    </Button>
                  </div>
                </div>
              </div>

              {mounted && items.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-muted-foreground mb-3 text-xs font-medium">
                    预览
                  </div>
                  {selected?.canvas ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <img
                        src={selected.canvas.toDataURL("image/png")}
                        alt={selected.name}
                        className="max-h-48 rounded border object-contain"
                      />
                      <div className="flex-1 space-y-4">
                        {selectedMeta && (
                          <Section icon={Cpu} title="基础信息">
                            <MetaRow label="文件名" value={selectedMeta.name} />
                            <MetaRow
                              label="宽度"
                              value={`${selectedMeta.width} px`}
                            />
                            <MetaRow
                              label="高度"
                              value={`${selectedMeta.height} px`}
                            />
                            <MetaRow
                              label="文件大小"
                              value={formatBytes(selectedMeta.fileSize)}
                            />
                            <MetaRow
                              label="MIME 类型"
                              value={selectedMeta.mimeType}
                            />
                            <MetaRow
                              label="修改时间"
                              value={formatMetaDate(selectedMeta.lastModified)}
                            />
                          </Section>
                        )}

                        {readyItems.length > 1 && (
                          <select
                            value={selectedId ?? undefined}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="border-input bg-background text-muted-foreground h-7 rounded-md border px-2 text-xs"
                          >
                            {readyItems.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      等待图片解析…
                    </p>
                  )}
                </div>
              )}

              {mounted && selectedExif && (
                <div className="space-y-4">
                  {(selectedExif.make ||
                    selectedExif.model ||
                    selectedExif.software) && (
                    <Section icon={Camera} title="相机设备">
                      {selectedExif.make && (
                        <MetaRow label="厂商" value={selectedExif.make} />
                      )}
                      {selectedExif.model && (
                        <MetaRow label="型号" value={selectedExif.model} />
                      )}
                      {selectedExif.software && (
                        <MetaRow label="软件" value={selectedExif.software} />
                      )}
                      {selectedExif.lensModel && (
                        <MetaRow label="镜头" value={selectedExif.lensModel} />
                      )}
                    </Section>
                  )}

                  {(selectedExif.dateTime ||
                    selectedExif.exposureTime ||
                    selectedExif.fNumber ||
                    selectedExif.iso ||
                    selectedExif.focalLength) && (
                    <Section icon={Clock} title="拍摄参数">
                      {selectedExif.dateTime && (
                        <MetaRow
                          label="拍摄时间"
                          value={selectedExif.dateTime}
                        />
                      )}
                      {selectedExif.exposureTime && (
                        <MetaRow
                          label="快门速度"
                          value={selectedExif.exposureTime}
                        />
                      )}
                      {selectedExif.fNumber && (
                        <MetaRow label="光圈" value={selectedExif.fNumber} />
                      )}
                      {selectedExif.iso && (
                        <MetaRow label="ISO" value={selectedExif.iso} />
                      )}
                      {selectedExif.focalLength && (
                        <MetaRow
                          label="焦距"
                          value={selectedExif.focalLength}
                        />
                      )}
                    </Section>
                  )}

                  {selectedExif.gpsLatitude && selectedExif.gpsLongitude && (
                    <Section icon={MapPin} title="GPS 定位">
                      <MetaRow
                        label="纬度"
                        value={selectedExif.gpsLatitude.toFixed(6)}
                      />
                      <MetaRow
                        label="经度"
                        value={selectedExif.gpsLongitude.toFixed(6)}
                      />
                      {selectedExif.gpsAltitude && (
                        <MetaRow
                          label="海拔"
                          value={`${selectedExif.gpsAltitude.toFixed(1)} m`}
                        />
                      )}
                    </Section>
                  )}

                  {(selectedExif.xResolution ||
                    selectedExif.yResolution ||
                    selectedExif.colorSpace ||
                    selectedExif.resolutionUnit) && (
                    <Section icon={Palette} title="图像参数">
                      {selectedExif.xResolution && (
                        <MetaRow
                          label="X 分辨率"
                          value={`${selectedExif.xResolution} dpi`}
                        />
                      )}
                      {selectedExif.yResolution && (
                        <MetaRow
                          label="Y 分辨率"
                          value={`${selectedExif.yResolution} dpi`}
                        />
                      )}
                      {selectedExif.resolutionUnit && (
                        <MetaRow
                          label="分辨率单位"
                          value={selectedExif.resolutionUnit}
                        />
                      )}
                      {selectedExif.colorSpace && (
                        <MetaRow
                          label="色彩空间"
                          value={selectedExif.colorSpace}
                        />
                      )}
                    </Section>
                  )}

                  {(selectedExif.exposureProgram ||
                    selectedExif.meteringMode ||
                    selectedExif.lightSource ||
                    selectedExif.sensingMethod ||
                    selectedExif.customRendered ||
                    selectedExif.exposureMode ||
                    selectedExif.digitalZoomRatio ||
                    selectedExif.sceneCaptureType ||
                    selectedExif.contrast ||
                    selectedExif.saturation ||
                    selectedExif.sharpness ||
                    selectedExif.subjectDistanceRange ||
                    selectedExif.flash ||
                    selectedExif.whiteBalance) && (
                    <Section icon={Shield} title="其他信息">
                      {selectedExif.exposureProgram && (
                        <MetaRow
                          label="曝光程序"
                          value={selectedExif.exposureProgram}
                        />
                      )}
                      {selectedExif.meteringMode && (
                        <MetaRow
                          label="测光模式"
                          value={selectedExif.meteringMode}
                        />
                      )}
                      {selectedExif.lightSource && (
                        <MetaRow
                          label="光源"
                          value={selectedExif.lightSource}
                        />
                      )}
                      {selectedExif.sensingMethod && (
                        <MetaRow
                          label="感应方式"
                          value={selectedExif.sensingMethod}
                        />
                      )}
                      {selectedExif.customRendered && (
                        <MetaRow
                          label="自定义渲染"
                          value={selectedExif.customRendered}
                        />
                      )}
                      {selectedExif.exposureMode && (
                        <MetaRow
                          label="曝光模式"
                          value={selectedExif.exposureMode}
                        />
                      )}
                      {selectedExif.digitalZoomRatio && (
                        <MetaRow
                          label="数码变焦"
                          value={selectedExif.digitalZoomRatio}
                        />
                      )}
                      {selectedExif.sceneCaptureType && (
                        <MetaRow
                          label="场景类型"
                          value={selectedExif.sceneCaptureType}
                        />
                      )}
                      {selectedExif.contrast && (
                        <MetaRow label="对比度" value={selectedExif.contrast} />
                      )}
                      {selectedExif.saturation && (
                        <MetaRow
                          label="饱和度"
                          value={selectedExif.saturation}
                        />
                      )}
                      {selectedExif.sharpness && (
                        <MetaRow label="锐化" value={selectedExif.sharpness} />
                      )}
                      {selectedExif.subjectDistanceRange && (
                        <MetaRow
                          label="对焦距离"
                          value={selectedExif.subjectDistanceRange}
                        />
                      )}
                      {selectedExif.flash && (
                        <MetaRow label="闪光灯" value={selectedExif.flash} />
                      )}
                      {selectedExif.whiteBalance && (
                        <MetaRow
                          label="白平衡"
                          value={selectedExif.whiteBalance}
                        />
                      )}
                    </Section>
                  )}

                  {(selectedExif.copyright ||
                    selectedExif.artist ||
                    selectedExif.imageDescription) && (
                    <Section icon={Info} title="版权与描述">
                      {selectedExif.imageDescription && (
                        <MetaRow
                          label="描述"
                          value={selectedExif.imageDescription}
                        />
                      )}
                      {selectedExif.artist && (
                        <MetaRow label="作者" value={selectedExif.artist} />
                      )}
                      {selectedExif.copyright && (
                        <MetaRow label="版权" value={selectedExif.copyright} />
                      )}
                    </Section>
                  )}
                </div>
              )}

              {mounted &&
                !loadingExif &&
                Object.keys(exifDataMap).length === 0 && (
                  <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-xs">
                    点击上方「读取 EXIF」按钮查看相机参数、GPS 定位等详细元数据
                  </div>
                )}

              {mounted && (
                <BatchTable
                  items={items}
                  onRemove={removeItem}
                  onClearAll={clearAll}
                  showDimensions
                  renderExtra={(item) => {
                    const meta = metas[item.id];
                    if (!meta) return null;
                    return (
                      <div className="text-muted-foreground space-y-0.5 text-[11px]">
                        <div>
                          尺寸：{meta.width} × {meta.height}
                        </div>
                        <div>大小：{formatBytes(meta.fileSize)}</div>
                        <div>修改时间：{formatMetaDate(meta.lastModified)}</div>
                        <div>类型：{meta.mimeType || "-"}</div>
                        {exifDataMap[item.id] && (
                          <div className="text-primary">
                            EXIF 已加载 ·{" "}
                            {
                              Object.values(exifDataMap[item.id]!).filter(
                                Boolean
                              ).length
                            }{" "}
                            项数据
                          </div>
                        )}
                      </div>
                    );
                  }}
                  renderActions={(item) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!item.canvas}
                      onClick={async () => {
                        if (!item.canvas) return;
                        const blob = await encodeCanvas(item.canvas, "png");
                        downloadBlob(
                          blob,
                          item.name.replace(/\.[^.]+$/, "") + ".png"
                        );
                        toast.success("已导出清理后的 PNG");
                      }}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      导出清理版
                    </Button>
                  )}
                  onApplyToAll={async () => {
                    const next: Record<
                      string,
                      Awaited<ReturnType<typeof readImageMeta>>
                    > = {};
                    for (const item of items) {
                      if (!item.file) continue;
                      try {
                        next[item.id] = await readImageMeta(item.file);
                      } catch {
                        // ignore
                      }
                    }
                    setMetas(next);
                  }}
                  applyToAllLabel="读取元数据"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
