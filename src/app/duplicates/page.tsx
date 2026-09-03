"use client";

import * as React from "react";
import {
  Images,
  Play,
  Square,
  Settings2,
  ImageOff,
  FolderOpen,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileImage,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { useBatchProcess } from "@/hooks/use-batch-process";
import {
  decodeImageFile,
  makeThumbnail,
} from "@/lib/image-utils";
import { getBaseName, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface DuplicateMeta {
  hash: string;
  width: number;
  height: number;
  thumbnail: string;
}

export interface DuplicateGroup {
  key: string;
  hash: string;
  width: number;
  height: number;
  items: {
    id: string;
    name: string;
    size: number;
    width: number;
    height: number;
    thumbnail: string;
    isOriginal: boolean;
  }[];
  totalSize: number;
}

async function computeImageHash(
  canvas: HTMLCanvasElement,
  samples = 12
): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取画布上下文");
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const points: number[] = [];
  const step = Math.max(1, Math.floor(Math.max(w, h) / samples));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      points.push(pixels[i], pixels[i + 1], pixels[i + 2]);
    }
  }
  const reduced = points
    .slice(0, 256)
    .map((v) => Math.round(v / 16) * 16);
  const sum = reduced.reduce((acc, v) => acc + v, 0);
  const hash = reduced
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  return `${hash.slice(0, 16)}-${sum.toString(16)}`;
}

function buildThumbnail(canvas: HTMLCanvasElement): string {
  const t = document.createElement("canvas");
  const scale = Math.min(1, 120 / Math.max(canvas.width, canvas.height));
  t.width = Math.max(1, Math.round(canvas.width * scale));
  t.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL("image/png");
}

export default function DuplicatesPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [sensitivity, setSensitivity] = React.useState(80);
  const [groups, setGroups] = React.useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedForKeep, setSelectedForKeep] = React.useState<Set<string>>(
    new Set()
  );
  const [statusText, setStatusText] = React.useState(
    "请上传需要检测重复的图片"
  );

  const canvasMapRef = React.useRef<Map<string, HTMLCanvasElement>>(new Map());
  const metaMapRef = React.useRef<Map<string, DuplicateMeta>>(new Map());

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      if (!item.canvas) throw new Error("图片尚未解码完成");
      canvasMapRef.current.set(item.id, item.canvas);
      const hash = await computeImageHash(item.canvas);
      const meta: DuplicateMeta = {
        hash,
        width: item.canvas.width,
        height: item.canvas.height,
        thumbnail: buildThumbnail(item.canvas),
      };
      metaMapRef.current.set(item.id, meta);
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  React.useEffect(() => {
    canvasMapRef.current = canvasMapRef.current;
  }, []);

  React.useEffect(() => {
    metaMapRef.current = metaMapRef.current;
  }, []);

  const handleScan = async () => {
    setGroups([]);
    setSelectedForKeep(new Set());
    setStatusText("正在预解码图片...");
    canvasMapRef.current.clear();
    metaMapRef.current.clear();

    const decodeProcess = items.filter((i) => !i.canvas && i.file);
    if (decodeProcess.length > 0) {
      await Promise.all(
        decodeProcess.map(async (item) => {
          if (!item.canvas && item.file) {
            try {
              const decoded = await decodeImageFile(item.file);
              updateItem(item.id, {
                canvas: decoded.canvas,
                width: decoded.width,
                height: decoded.height,
                thumbnail: makeThumbnail(decoded.canvas),
                status: "pending",
              });
              canvasMapRef.current.set(item.id, decoded.canvas);
            } catch {
              updateItem(item.id, {
                status: "error",
                error: "无法解码该图片，可能格式不受支持",
              });
            }
          }
        })
      );
    }

    setStatusText("正在计算图片哈希...");
    await process.start();

    const allItems = useBatchStore.getState().items;
    const doneItems = allItems.filter((i) => i.status === "done");
    const clusters = new Map<string, typeof doneItems>();

    for (const item of doneItems) {
      const canvas = canvasMapRef.current.get(item.id);
      if (!canvas) continue;
      let meta = metaMapRef.current.get(item.id);
      if (!meta) {
        try {
          const hash = await computeImageHash(canvas);
          meta = {
            hash,
            width: canvas.width,
            height: canvas.height,
            thumbnail: buildThumbnail(canvas),
          };
          metaMapRef.current.set(item.id, meta);
        } catch {
          continue;
        }
      }
      const key = `${meta.hash}-${meta.width}x${meta.height}`;
      const existing = clusters.get(key);
      if (existing) {
        existing.push(item);
      } else {
        clusters.set(key, [item]);
      }
    }

    const newGroups: DuplicateGroup[] = [];
    for (const [, cluster] of clusters) {
      if (cluster.length <= 1) continue;
      const sample = cluster[0];
      const canvas = canvasMapRef.current.get(sample.id);
      const meta = metaMapRef.current.get(sample.id);
      newGroups.push({
        key: `${meta?.hash}-${sample.id}`,
        hash: meta?.hash ?? "",
        width: meta?.width ?? sample.canvas?.width ?? 0,
        height: meta?.height ?? sample.canvas?.height ?? 0,
        items: cluster.map((i) => {
          const itemMeta = metaMapRef.current.get(i.id);
          return {
            id: i.id,
            name: i.name,
            size: i.file?.size ?? 0,
            width: itemMeta?.width ?? i.canvas?.width ?? 0,
            height: itemMeta?.height ?? i.canvas?.height ?? 0,
            thumbnail: itemMeta?.thumbnail ?? "",
            isOriginal: false,
          };
        }),
        totalSize: cluster.reduce((acc, i) => acc + (i.file?.size ?? 0), 0),
      });
    }

    newGroups.sort((a, b) => b.totalSize - a.totalSize);
    setGroups(newGroups);
    const duplicateCount = newGroups.reduce(
      (acc, g) => acc + g.items.length - 1,
      0
    );
    const savedSize = newGroups.reduce(
      (acc, g) => acc + (g.items.length - 1) * (g.totalSize / g.items.length),
      0
    );
    if (newGroups.length > 0) {
      setStatusText(
        `发现 ${newGroups.length} 组重复，共 ${duplicateCount} 个重复文件，可节省约 ${formatBytes(savedSize)} 空间`
      );
    } else if (doneItems.length > 0) {
      setStatusText("未发现明显重复图片");
    } else {
      setStatusText("请上传需要检测重复的图片");
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const markAsKeep = (itemId: string) => {
    setSelectedForKeep((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const removeDuplicates = () => {
    const idsToRemove: string[] = [];
    groups.forEach((g) => {
      g.items.forEach((item) => {
        if (!selectedForKeep.has(item.id)) {
          idsToRemove.push(item.id);
        }
      });
    });
    if (idsToRemove.length === 0) {
      setStatusText("请先选择要保留的图片");
      return;
    }
    idsToRemove.forEach((id) => {
      removeItem(id);
      canvasMapRef.current.delete(id);
      metaMapRef.current.delete(id);
    });
    setSelectedForKeep(new Set());
    setGroups([]);
    setStatusText(`已清理 ${idsToRemove.length} 个重复图片`);
  };

  const handleReset = () => {
    clearAll();
    process.reset();
    setGroups([]);
    setExpandedGroups(new Set());
    setSelectedForKeep(new Set());
    canvasMapRef.current.clear();
    metaMapRef.current.clear();
    setStatusText("已重置，请上传新的图片");
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Images}
            title="重复图片查找"
            description="上传图片并自动检测重复或相似图片，帮助你清理冗余文件"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">检测选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  敏感度：<span className="text-primary font-medium">{sensitivity}%</span>
                </Label>
                <Slider
                  value={[sensitivity]}
                  min={50}
                  max={95}
                  step={5}
                  onValueChange={(v) => setSensitivity(v[0])}
                />
                <p className="text-muted-foreground text-[11px]">
                  敏感度越高，越容易识别相似的重复图片
                </p>
              </div>
              <div className="space-y-2">
                <Label>操作</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={handleScan}
                    disabled={items.length === 0 || process.running}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    开始检测
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    重置
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/40 rounded-lg border p-4">
            <div className="text-muted-foreground text-sm">{statusText}</div>
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
                renderExtra={(item) =>
                  metaMapRef.current.has(item.id) ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs">
                      已哈希
                    </span>
                  ) : null
                }
              />

              {process.running && (
                <div className="bg-card flex items-center gap-3 rounded-lg border p-4">
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
                </div>
              )}

              {groups.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">重复组列表</h3>
                      <p className="text-muted-foreground mt-1 text-xs">
                        点击组可展开/折叠，选择要保留的图片后清理其他重复项
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeDuplicates}
                      className="gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      清理未选中
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {groups.map((group) => {
                      const isExpanded = expandedGroups.has(group.key);
                      const keepCount = group.items.filter((item) =>
                        selectedForKeep.has(item.id)
                      ).length;
                      return (
                        <div
                          key={group.key}
                          className="bg-card rounded-lg border overflow-hidden"
                        >
                          <button
                            onClick={() => toggleGroup(group.key)}
                            className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="text-muted-foreground h-4 w-4" />
                              ) : (
                                <ChevronRight className="text-muted-foreground h-4 w-4" />
                              )}
                              <FileImage className="text-primary h-5 w-5" />
                              <div>
                                <div className="text-sm font-medium">
                                  {group.items.length} 张图片相同
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {group.width} × {group.height} · 总计{" "}
                                  {formatBytes(group.totalSize)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">
                                {keepCount}/{group.items.length} 已保留
                              </span>
                              <span className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-[10px]">
                                重复组
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t px-4 pb-4 pt-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {group.items.map((item) => {
                                  const isSelected =
                                    selectedForKeep.has(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className={cn(
                                        "rounded-lg border p-2 transition-colors cursor-pointer",
                                        isSelected
                                          ? "border-primary bg-primary/5"
                                          : "hover:border-primary/50"
                                      )}
                                      onClick={() => markAsKeep(item.id)}
                                    >
                                      <div className="bg-muted mb-2 overflow-hidden rounded-md border">
                                        {item.thumbnail ? (
                                          <img
                                            src={item.thumbnail}
                                            alt={item.name}
                                            className="h-24 w-full object-contain"
                                          />
                                        ) : (
                                          <div className="flex h-24 w-full items-center justify-center">
                                            <ImageOff className="text-muted-foreground h-6 w-6" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="truncate text-xs font-medium">
                                          {getBaseName(item.name)}
                                        </div>
                                        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                                          <span>
                                            {item.width} × {item.height}
                                          </span>
                                          <span>
                                            {formatBytes(item.size)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {isSelected ? (
                                            <span className="text-primary inline-flex items-center gap-1 text-xs">
                                              <FolderOpen className="h-3 w-3" />
                                              保留
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                                              <Trash2 className="h-3 w-3" />
                                              将删除
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
