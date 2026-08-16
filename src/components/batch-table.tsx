"use client";

import * as React from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { BatchItem, BatchStatus } from "@/store/batch-store";
import { formatBytes, getBaseName } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  BatchStatus,
  { label: string; className: string; icon?: typeof Loader2 }
> = {
  pending: { label: "待处理", className: "bg-muted text-muted-foreground" },
  processing: {
    label: "处理中",
    className: "bg-primary/10 text-primary",
    icon: Loader2,
  },
  done: {
    label: "已完成",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  error: {
    label: "失败",
    className: "bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: BatchStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.className
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-3 w-3", status === "processing" && "animate-spin")}
        />
      )}
      {meta.label}
    </span>
  );
}

interface BatchTableProps {
  items: BatchItem[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onAdd?: (files: File[]) => void;
  /** 是否允许添加新文件 */
  allowAdd?: boolean;
  /** 渲染名称列时是否显示尺寸 */
  showDimensions?: boolean;
  /** 渲染结果列（自定义） */
  renderResult?: (item: BatchItem) => React.ReactNode;
  /** 全选状态（未实现多选时可不传） */
  selectable?: boolean;
}

/** 批量文件表格 */
export function BatchTable({
  items,
  onRemove,
  onClearAll,
  onAdd,
  allowAdd = false,
  showDimensions = true,
  renderResult,
}: BatchTableProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-sm">
        <AlertTriangle className="h-6 w-6 opacity-40" />
        暂无文件，请先添加图片
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-xs">
          共 {items.length} 个文件 · 合计{" "}
          {formatBytes(items.reduce((s, i) => s + i.size, 0))}
        </div>
        <div className="flex items-center gap-2">
          {allowAdd && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.svg,.ico"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) onAdd?.(files);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="border-input bg-background hover:bg-accent inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors"
              >
                添加文件
              </button>
            </>
          )}
          <button
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            全部清空
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
              <tr className="text-left text-xs">
                <th className="px-3 py-2 font-medium">文件</th>
                {showDimensions && (
                  <th className="px-2 py-2 font-medium">尺寸</th>
                )}
                <th className="px-2 py-2 font-medium">大小</th>
                <th className="px-2 py-2 font-medium">状态</th>
                {renderResult && (
                  <th className="px-2 py-2 font-medium">结果</th>
                )}
                <th className="px-2 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-accent/40 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-muted h-9 w-9 shrink-0 overflow-hidden rounded border">
                        {item.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnail}
                            alt={item.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[9px] uppercase">
                            {item.ext}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="max-w-44 truncate text-xs font-medium"
                          title={item.name}
                        >
                          {getBaseName(item.name)}
                        </div>
                        <div className="text-muted-foreground text-[11px] uppercase">
                          {item.ext || "?"}
                        </div>
                      </div>
                    </div>
                  </td>
                  {showDimensions && (
                    <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                      {item.width && item.height
                        ? `${item.width} × ${item.height}`
                        : "解码中…"}
                    </td>
                  )}
                  <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                    {formatBytes(item.size)}
                  </td>
                  <td className="px-2 py-2">
                    {item.error ? (
                      <span
                        className="text-destructive text-[11px]"
                        title={item.error}
                      >
                        {item.error.length > 16
                          ? `${item.error.slice(0, 16)}…`
                          : item.error}
                      </span>
                    ) : (
                      <StatusBadge status={item.status} />
                    )}
                  </td>
                  {renderResult && (
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {renderResult(item)}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                      title="移除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
