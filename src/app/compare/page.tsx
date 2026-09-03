"use client";

import * as React from "react";
import {
  ArrowLeftRight,
  ImageOff,
  Settings2,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { FileDropzone } from "@/components/file-dropzone";
import { BatchTable } from "@/components/batch-table";
import { useBatchStore } from "@/store/batch-store";
import { decodeImageFile, makeThumbnail } from "@/lib/image-utils";
import { getBaseName, formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface CompareMeta {
  width: number;
  height: number;
  thumbnail: string;
}

export default function ComparePage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [leftId, setLeftId] = React.useState<string>("");
  const [rightId, setRightId] = React.useState<string>("");
  const [sliderPos, setSliderPos] = React.useState(50);
  const [previews, setPreviews] = React.useState<{
    left: { url: string; width: number; height: number };
    right: { url: string; width: number; height: number };
  } | null>(null);

  const metaMapRef = React.useRef<Map<string, CompareMeta>>(new Map());

  React.useEffect(() => {
    if (items.length >= 2) {
      if (!leftId || !items.find((i) => i.id === leftId)) {
        setLeftId(items[0].id);
      }
      if (!rightId || !items.find((i) => i.id === rightId)) {
        setRightId(items[1].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handlePredecode = async () => {
    const decodeTargets = items.filter((i) => !i.canvas && i.file);
    if (decodeTargets.length === 0) return;
    await Promise.all(
      decodeTargets.map(async (item) => {
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
            metaMapRef.current.set(item.id, {
              width: decoded.width,
              height: decoded.height,
              thumbnail: makeThumbnail(decoded.canvas),
            });
          } catch {
            updateItem(item.id, {
              status: "error",
              error: "无法解码该图片，可能格式不受支持",
            });
          }
        }
      })
    );
  };

  const buildPreview = React.useCallback(
    async (left: string, right: string) => {
      await handlePredecode();
      const leftItem = items.find((i) => i.id === left);
      const rightItem = items.find((i) => i.id === right);
      if (!leftItem?.canvas || !rightItem?.canvas) return;
      const leftWidth = leftItem.canvas.width;
      const leftHeight = leftItem.canvas.height;
      const rightWidth = rightItem.canvas.width;
      const rightHeight = rightItem.canvas.height;
      const maxWidth = Math.max(leftWidth, rightWidth);
      const maxHeight = Math.max(leftHeight, rightHeight);
      const leftUrl = leftItem.canvas.toDataURL("image/png");
      const rightUrl = rightItem.canvas.toDataURL("image/png");
      setPreviews({
        left: { url: leftUrl, width: leftWidth, height: leftHeight },
        right: { url: rightUrl, width: rightWidth, height: rightHeight },
      });
    },
    [items, updateItem]
  );

  React.useEffect(() => {
    if (leftId && rightId) {
      buildPreview(leftId, rightId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftId, rightId]);

  const handleReset = () => {
    clearAll();
    setLeftId("");
    setRightId("");
    setPreviews(null);
    setSliderPos(50);
    metaMapRef.current.clear();
  };

  const leftItem = items.find((i) => i.id === leftId);
  const rightItem = items.find((i) => i.id === rightId);

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={ArrowLeftRight}
            title="图片对比"
            description="上传两张图片并直观对比差异，支持滑动查看重叠效果"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">对比设置</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>左侧图片</Label>
                <select
                  value={leftId}
                  onChange={(e) => setLeftId(e.target.value)}
                  className="border-input bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">请选择图片</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getBaseName(item.name)}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[11px]">
                  {leftItem
                    ? `${leftItem.width ?? "?"} × ${leftItem.height ?? "?"} · ${formatBytes(leftItem.size)}`
                    : "请上传并选择左侧图片"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>右侧图片</Label>
                <select
                  value={rightId}
                  onChange={(e) => setRightId(e.target.value)}
                  className="border-input bg-background text-foreground h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">请选择图片</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getBaseName(item.name)}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[11px]">
                  {rightItem
                    ? `${rightItem.width ?? "?"} × ${rightItem.height ?? "?"} · ${formatBytes(rightItem.size)}`
                    : "请上传并选择右侧图片"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => buildPreview(leftId, rightId)}
                disabled={!leftId || !rightId}
                className="gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                刷新对比
              </Button>
              <Button variant="outline" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <FileDropzone onFiles={addFiles} accept="image/*" multiple />
          ) : (
            <BatchTable
              items={items}
              onRemove={removeItem}
              onClearAll={handleReset}
              allowAdd
              onAdd={addFiles}
            />
          )}

          {previews && leftItem?.canvas && rightItem?.canvas && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">对比视图</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    拖动滑块对比两张图片
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs">
                    滑块位置：<span className="text-primary font-medium">{sliderPos}%</span>
                  </Label>
                </div>
              </div>

              <div className="bg-card overflow-hidden rounded-lg border">
                <div
                  className="relative mx-auto select-none"
                  style={{
                    maxWidth: "100%",
                    aspectRatio: `${previews.left.width} / ${previews.left.height}`,
                  }}
                >
                  <img
                    src={previews.right.url}
                    alt="右侧图片"
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <img
                      src={previews.left.url}
                      alt="左侧图片"
                      className="h-full w-full object-contain"
                      style={{
                        width: `${(previews.left.width / previews.right.width) * 100}%`,
                        minWidth: `${(previews.left.width / previews.right.width) * 100}%`,
                      }}
                      draggable={false}
                    />
                  </div>
                  <div
                    className="absolute inset-y-0 border-l-2 border-primary"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="bg-primary text-primary-foreground absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg">
                      <ArrowLeftRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-xs font-medium">左侧图片</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {leftItem
                      ? `${getBaseName(leftItem.name)} · ${leftItem.width}×${leftItem.height}`
                      : "未选择"}
                  </div>
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-xs font-medium">右侧图片</div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    {rightItem
                      ? `${getBaseName(rightItem.name)} · ${rightItem.width}×${rightItem.height}`
                      : "未选择"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>调整对比位置</Label>
                <Slider
                  value={[sliderPos]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => setSliderPos(v[0])}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
