"use client";

import * as React from "react";
import {
  Tag,
  Play,
  Square as StopSquare,
  Settings2,
  X,
  Check,
  Download,
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TagMeta = {
  tags: string[];
  thumbnail?: string;
};

export default function TagsPage() {
  const items = useBatchStore((s) => s.items);
  const addFiles = useBatchStore((s) => s.addFiles);
  const removeItem = useBatchStore((s) => s.removeItem);
  const clearAll = useBatchStore((s) => s.clearAll);
  const updateItem = useBatchStore((s) => s.updateItem);

  const [commonTag, setCommonTag] = React.useState("");
  const [metaMap, setMetaMap] = React.useState<Map<string, TagMeta>>(new Map());

  const process = useBatchProcess({
    items,
    getItemId: (i) => i.id,
    onItemStart: (i) =>
      updateItem(i.id, { status: "processing", error: undefined }),
    task: async (item) => {
      let src = item.canvas;
      if (!src) {
        if (!item.file) throw new Error("缺少图片文件");
        const decoded = await decodeImageFile(item.file);
        src = decoded.canvas;
      }
      const meta = metaMap.get(item.id) ?? { tags: [] };
      updateItem(item.id, {
        canvas: src,
        width: src.width,
        height: src.height,
        thumbnail: makeThumbnail(src),
        status: "done",
      });
      setMetaMap((prev) => {
        const next = new Map(prev);
        next.set(item.id, { tags: meta.tags, thumbnail: makeThumbnail(src) });
        return next;
      });
    },
    onItemDone: (i) => updateItem(i.id, { status: "done" }),
    onItemError: (i, err) =>
      updateItem(i.id, {
        status: "error",
        error: err instanceof Error ? err.message : "处理失败",
      }),
  });

  const readyCount = items.filter((i) => i.status === "done").length;

  const addCommonTag = () => {
    const tag = commonTag.trim();
    if (!tag) return;
    setMetaMap((prev) => {
      const next = new Map(prev);
      items.forEach((item) => {
        const meta = next.get(item.id) ?? { tags: [] };
        if (!meta.tags.includes(tag)) {
          next.set(item.id, { tags: [...meta.tags, tag] });
        }
      });
      return next;
    });
    setCommonTag("");
  };

  const toggleTag = (itemId: string, tag: string) => {
    setMetaMap((prev) => {
      const next = new Map(prev);
      const meta = next.get(itemId) ?? { tags: [] };
      const tags = meta.tags.includes(tag)
        ? meta.tags.filter((t) => t !== tag)
        : [...meta.tags, tag];
      next.set(itemId, { ...meta, tags });
      return next;
    });
  };

  const removeTag = (itemId: string, tag: string) => {
    setMetaMap((prev) => {
      const next = new Map(prev);
      const meta = next.get(itemId);
      if (!meta) return prev;
      next.set(itemId, { ...meta, tags: meta.tags.filter((t) => t !== tag) });
      return next;
    });
  };

  const exportCsv = () => {
    if (metaMap.size === 0) {
      toast.warning("请先为图片添加标签");
      return;
    }
    const header = "name,tags\n";
    const rows = items
      .map((item) => {
        const meta = metaMap.get(item.id);
        const tags = meta?.tags?.join(";") ?? "";
        return `${item.name},"${tags.replace(/"/g, '""')}"`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "image-tags.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    clearAll();
    process.reset();
    setMetaMap(new Map());
    setCommonTag("");
  };

  const uniqueTags = Array.from(
    new Set(
      metaMap.size > 0
        ? items.flatMap((item) => metaMap.get(item.id)?.tags ?? [])
        : []
    )
  );

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Tag}
            title="图片标签"
            description="批量为图片添加关键词标签，便于分类、检索和导出"
          />

          <div className="bg-card space-y-4 rounded-lg border p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="text-muted-foreground h-4 w-4" />
              <h2 className="text-sm font-medium">标签选项</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>批量添加标签</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={commonTag}
                    onChange={(e) => setCommonTag(e.target.value)}
                    placeholder="输入标签后回车"
                  />
                  <Button onClick={addCommonTag} className="gap-2">
                    <Check className="h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>快捷标签</Label>
                <div className="flex flex-wrap gap-2">
                  {["封面", "人物", "风景", "产品", "截图", "草稿"].map(
                    (tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setCommonTag(tag);
                          addCommonTag();
                        }}
                        className={cn(
                          "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                          "hover:bg-accent"
                        )}
                      >
                        {tag}
                      </button>
                    )
                  )}
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
                renderExtra={(item) => {
                  const meta = metaMap.get(item.id);
                  if (!meta?.tags?.length) return null;
                  return (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {meta.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-muted flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(item.id, tag)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  );
                }}
              />

              {uniqueTags.length > 0 && (
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-sm font-medium">当前标签</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uniqueTags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-muted rounded-full px-3 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                      刷新标签（{items.length}）
                    </button>
                    {readyCount > 0 && (
                      <>
                        <Button
                          variant="outline"
                          onClick={exportCsv}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          导出 CSV
                        </Button>
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
