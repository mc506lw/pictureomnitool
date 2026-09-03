"use client";

import * as React from "react";
import { Palette, Play, Square, Settings2, RefreshCw } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { ZipExportButton, DownloadAllButton, type ZipEntry } from "@/lib/zip";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  applyColorGrade,
  DEFAULT_GRADE_OPTIONS,
  type ColorGradeOptions,
  type CurvePoint,
} from "@/lib/color-grade";
import { encodeCanvas } from "@/lib/image-utils";
import { withExtension, formatBytes } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useHistoryStack } from "@/hooks/use-history-stack";

const PREVIEW_MAX = 420;

type Action = "undo" | "redo" | "reset";

function CurveEditor({
  points,
  onChange,
  color,
}: {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  color: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);

  const size = 256;
  const padding = 20;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = size + padding * 2;
    const h = size + padding * 2;
    canvas.width = w;
    canvas.height = h;

    // 背景
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // 网格
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = padding + (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + size, pos);
      ctx.stroke();
    }

    // 对角线参考
    ctx.strokeStyle = "#444";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, padding + size);
    ctx.lineTo(padding + size, padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // 曲线
    if (points.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const first = points[0];
      ctx.moveTo(padding + first.x, padding + size - first.y);

      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineTo(padding + p.x, padding + size - p.y);
      }
      ctx.stroke();
    }

    // 控制点
    for (const p of points) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(padding + p.x, padding + size - p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [points, color]);

  const getCanvasPoint = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left - padding) / size) * 255;
    const y = ((rect.bottom - e.clientY - padding) / size) * 255;
    return {
      x: Math.max(0, Math.min(255, x)),
      y: Math.max(0, Math.min(255, y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    if (!point) return;

    // 检查是否点击了现有控制点
    const threshold = 15;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dist = Math.sqrt((p.x - point.x) ** 2 + (p.y - point.y) ** 2);
      if (dist < threshold) {
        setDragging(i);
        return;
      }
    }

    // 添加新控制点
    const newPoints = [...points, point].sort((a, b) => a.x - b.x);
    onChange(newPoints);
    setDragging(newPoints.length - 1);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging === null) return;
    const point = getCanvasPoint(e);
    if (!point) return;

    const newPoints = [...points];
    // 保持端点固定
    if (dragging === 0) {
      newPoints[0] = { x: 0, y: point.y };
    } else if (dragging === newPoints.length - 1) {
      newPoints[newPoints.length - 1] = { x: 255, y: point.y };
    } else {
      newPoints[dragging] = point;
    }
    onChange(newPoints);
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="cursor-crosshair rounded border"
      style={{ width: size + padding * 2, height: size + padding * 2 }}
    />
  );
}

export default function ColorGradePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [opts, setOpts] = React.useState<ColorGradeOptions>(
    DEFAULT_GRADE_OPTIONS
  );
  const [activeTab, setActiveTab] = React.useState("basic");
  const history = useHistoryStack<ColorGradeOptions>(DEFAULT_GRADE_OPTIONS);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitHistory = React.useCallback(
    (next: ColorGradeOptions) => {
      history.replace(next);
      setOpts(next);
    },
    [history]
  );

  const pushHistory = React.useCallback(
    (next: ColorGradeOptions) => {
      history.push(next);
      setOpts(next);
    },
    [history]
  );

  const patch = (partial: Partial<ColorGradeOptions>) => {
    const next = { ...opts, ...partial };
    commitHistory(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushHistory(next), 300);
  };

  const undo = React.useCallback(() => {
    const next = history.state.past[history.state.past.length - 1];
    if (!next) return;
    history.undo();
    setOpts(next);
  }, [history]);

  const redo = React.useCallback(() => {
    const next = history.state.future[0];
    if (!next) return;
    history.redo();
    setOpts(next);
  }, [history]);

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      const out = applyColorGrade(item.canvas, opts);
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

  const entries: ZipEntry[] = items
    .filter((i) => i.status === "done" && i.result)
    .map((i) => ({ name: i.result!.name, blob: i.result!.blob }));

  const resetOptions = () => {
    history.push(DEFAULT_GRADE_OPTIONS);
    setOpts(DEFAULT_GRADE_OPTIONS);
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-8">
          <div className="flex items-center justify-between">
            <PageHeader
              icon={Palette}
              title="专业调色"
              description="DaVinci Resolve 风格的分区调色：曲线、色轮、色温、晕影、锐化"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={history.state.past.length === 0}
              >
                撤销
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={history.state.future.length === 0}
              >
                重做
              </Button>
              <Button variant="outline" size="sm" onClick={resetOptions}>
                重置
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            {/* 左侧：控制面板 */}
            <div className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">基础</TabsTrigger>
                  <TabsTrigger value="curves">曲线</TabsTrigger>
                  <TabsTrigger value="color">色轮</TabsTrigger>
                  <TabsTrigger value="fx">特效</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="bg-card space-y-4 rounded-lg border p-5">
                    <div className="flex items-center gap-2">
                      <Settings2 className="text-muted-foreground h-4 w-4" />
                      <h2 className="text-sm font-medium">基础调整</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          亮度：
                          <span className="text-primary font-medium">
                            {opts.brightness.toFixed(2)}
                          </span>
                        </Label>
                        <Slider
                          value={[opts.brightness * 100]}
                          min={0}
                          max={200}
                          step={1}
                          onValueChange={(v) =>
                            patch({ brightness: v[0] / 100 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          对比度：
                          <span className="text-primary font-medium">
                            {opts.contrast.toFixed(2)}
                          </span>
                        </Label>
                        <Slider
                          value={[opts.contrast * 100]}
                          min={0}
                          max={200}
                          step={1}
                          onValueChange={(v) => patch({ contrast: v[0] / 100 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          饱和度：
                          <span className="text-primary font-medium">
                            {opts.saturation.toFixed(2)}
                          </span>
                        </Label>
                        <Slider
                          value={[opts.saturation * 100]}
                          min={0}
                          max={200}
                          step={1}
                          onValueChange={(v) =>
                            patch({ saturation: v[0] / 100 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          色相：
                          <span className="text-primary font-medium">
                            {opts.hueRotate}°
                          </span>
                        </Label>
                        <Slider
                          value={[opts.hueRotate]}
                          min={0}
                          max={360}
                          step={1}
                          onValueChange={(v) => patch({ hueRotate: v[0] })}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="curves" className="space-y-4">
                  <div className="bg-card rounded-lg border p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Settings2 className="text-muted-foreground h-4 w-4" />
                      <h2 className="text-sm font-medium">曲线调整</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">主曲线</Label>
                        <CurveEditor
                          points={opts.masterCurve}
                          onChange={(masterCurve) => patch({ masterCurve })}
                          color="#fff"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">红色</Label>
                        <CurveEditor
                          points={opts.redCurve}
                          onChange={(redCurve) => patch({ redCurve })}
                          color="#f00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">绿色</Label>
                        <CurveEditor
                          points={opts.greenCurve}
                          onChange={(greenCurve) => patch({ greenCurve })}
                          color="#0f0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">蓝色</Label>
                        <CurveEditor
                          points={opts.blueCurve}
                          onChange={(blueCurve) => patch({ blueCurve })}
                          color="#00f"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="color" className="space-y-4">
                  <div className="bg-card rounded-lg border p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Settings2 className="text-muted-foreground h-4 w-4" />
                      <h2 className="text-sm font-medium">色轮</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-4">
                        <Label className="text-xs">色温 / 色调</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>色温</span>
                              <span className="text-primary">
                                {opts.temperature > 0
                                  ? "暖"
                                  : opts.temperature < 0
                                    ? "冷"
                                    : "中性"}
                              </span>
                            </div>
                            <Slider
                              value={[opts.temperature + 100]}
                              min={0}
                              max={200}
                              step={1}
                              onValueChange={(v) =>
                                patch({ temperature: v[0] - 100 })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>色调</span>
                              <span className="text-primary">
                                {opts.tint > 0
                                  ? "绿"
                                  : opts.tint < 0
                                    ? "品红"
                                    : "中性"}
                              </span>
                            </div>
                            <Slider
                              value={[opts.tint + 100]}
                              min={0}
                              max={200}
                              step={1}
                              onValueChange={(v) => patch({ tint: v[0] - 100 })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-xs">阴影</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>色相</span>
                              <span className="text-primary">
                                {opts.shadowHue}°
                              </span>
                            </div>
                            <Slider
                              value={[opts.shadowHue + 180]}
                              min={0}
                              max={360}
                              step={1}
                              onValueChange={(v) =>
                                patch({ shadowHue: v[0] - 180 })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>饱和度</span>
                              <span className="text-primary">
                                {opts.shadowSat}%
                              </span>
                            </div>
                            <Slider
                              value={[opts.shadowSat + 100]}
                              min={0}
                              max={200}
                              step={1}
                              onValueChange={(v) =>
                                patch({ shadowSat: v[0] - 100 })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-xs">中间调</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>色相</span>
                              <span className="text-primary">
                                {opts.midtoneHue}°
                              </span>
                            </div>
                            <Slider
                              value={[opts.midtoneHue + 180]}
                              min={0}
                              max={360}
                              step={1}
                              onValueChange={(v) =>
                                patch({ midtoneHue: v[0] - 180 })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>饱和度</span>
                              <span className="text-primary">
                                {opts.midtoneSat}%
                              </span>
                            </div>
                            <Slider
                              value={[opts.midtoneSat + 100]}
                              min={0}
                              max={200}
                              step={1}
                              onValueChange={(v) =>
                                patch({ midtoneSat: v[0] - 100 })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-xs">高光</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>色相</span>
                              <span className="text-primary">
                                {opts.highlightHue}°
                              </span>
                            </div>
                            <Slider
                              value={[opts.highlightHue + 180]}
                              min={0}
                              max={360}
                              step={1}
                              onValueChange={(v) =>
                                patch({ highlightHue: v[0] - 180 })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>饱和度</span>
                              <span className="text-primary">
                                {opts.highlightSat}%
                              </span>
                            </div>
                            <Slider
                              value={[opts.highlightSat + 100]}
                              min={0}
                              max={200}
                              step={1}
                              onValueChange={(v) =>
                                patch({ highlightSat: v[0] - 100 })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fx" className="space-y-4">
                  <div className="bg-card rounded-lg border p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Settings2 className="text-muted-foreground h-4 w-4" />
                      <h2 className="text-sm font-medium">特效</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-4">
                        <Label className="text-xs">晕影</Label>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>强度</span>
                              <span className="text-primary">
                                {Math.round(opts.vignette * 100)}%
                              </span>
                            </div>
                            <Slider
                              value={[opts.vignette * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(v) =>
                                patch({ vignette: v[0] / 100 })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>柔和度</span>
                              <span className="text-primary">
                                {Math.round(opts.vignetteSoftness * 100)}%
                              </span>
                            </div>
                            <Slider
                              value={[opts.vignetteSoftness * 100]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(v) =>
                                patch({ vignetteSoftness: v[0] / 100 })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>锐化</span>
                          <span className="text-primary">
                            {opts.sharpen.toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[opts.sharpen * 100]}
                          min={0}
                          max={200}
                          step={1}
                          onValueChange={(v) => patch({ sharpen: v[0] / 100 })}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetOptions}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重置
                </Button>
              </div>
            </div>

            {/* 右侧：预览 */}
            <div className="space-y-4">
              <div className="bg-card rounded-lg border p-4">
                <div className="text-muted-foreground mb-3 text-xs font-medium">
                  实时预览
                </div>
                {items.length > 0 && items[0].canvas ? (
                  <PreviewCanvas canvas={items[0].canvas} opts={opts} />
                ) : (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    等待图片解码…
                  </p>
                )}
              </div>

              <div className="bg-card space-y-3 rounded-lg border p-4">
                <div className="text-muted-foreground text-xs font-medium">
                  导出
                </div>
                <div className="space-y-2">
                  <button
                    onClick={process.start}
                    disabled={items.length === 0 || process.running}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Play className="h-4 w-4" />
                    调色（{items.length}）
                  </button>
                  {entries.length > 0 && (
                    <>
                      <ZipExportButton
                        entries={entries}
                        zipName="color-graded-images.zip"
                        className="w-full"
                      />
                      <DownloadAllButton entries={entries} className="w-full" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*,.svg,.ico" />
          ) : (
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
          )}
        </div>
      </div>
    </SidebarInset>
  );
}

function PreviewCanvas({
  canvas,
  opts,
}: {
  canvas: HTMLCanvasElement;
  opts: ColorGradeOptions;
}) {
  const [previewUrl, setPreviewUrl] = React.useState<string>("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
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

    const result = applyColorGrade(out, opts);
    setPreviewUrl(result.toDataURL("image/png"));
  }, [canvas, opts, mounted]);

  if (!mounted || !previewUrl) return null;
  return (
    <img
      src={previewUrl}
      alt="调色预览"
      className="max-h-72 w-full rounded border object-contain"
    />
  );
}
