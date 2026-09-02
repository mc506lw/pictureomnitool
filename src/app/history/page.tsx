"use client";

import * as React from "react";
import { History, Trash2, Clock, ImageIcon, Download } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { useBatchStore } from "@/store/batch-store";
import { formatBytes, getBaseName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: number;
  size: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  tool: string;
  status: "done" | "error";
  error?: string;
}

const HISTORY_KEY = "pictureomnitool-history";
const MAX_HISTORY = 100;

export function useHistory() {
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const addEntry = React.useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    if (!mounted) return;
    const newEntry: HistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const next = [newEntry, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [mounted]);

  const clearHistory = React.useCallback(() => {
    if (!mounted) return;
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, [mounted]);

  const removeEntry = React.useCallback((id: string) => {
    if (!mounted) return;
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [mounted]);

  return { history, mounted, addEntry, clearHistory, removeEntry };
}

export default function HistoryPage() {
  const { history, mounted, clearHistory, removeEntry } = useHistory();

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString();
  };

  const getStatusBadge = (status: HistoryEntry["status"]) => {
    if (status === "done") {
      return <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 text-[11px] font-medium">成功</span>;
    }
    return <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[11px] font-medium">失败</span>;
  };

  if (!mounted) {
    return (
      <SidebarInset>
        <div className="h-full overflow-auto">
          <div className="mx-auto max-w-5xl space-y-6 p-8">
            <PageHeader
              icon={History}
              title="历史记录"
              description="查看最近处理的图片记录"
            />
            <div className="text-muted-foreground py-10 text-center text-sm">加载中…</div>
          </div>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={History}
            title="历史记录"
            description="查看最近处理的图片记录（本地存储，最多 100 条）"
          />

          {history.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
              <Clock className="mx-auto mb-3 h-8 w-8 opacity-40" />
              暂无历史记录
              <br />
              <span className="text-xs">处理图片后会自动记录在这里</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-xs">
                  共 {history.length} 条记录
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空历史
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                      <tr className="text-left text-xs">
                        <th className="px-4 py-2 font-medium">文件</th>
                        <th className="px-2 py-2 font-medium">工具</th>
                        <th className="px-2 py-2 font-medium">时间</th>
                        <th className="px-2 py-2 font-medium">大小</th>
                        <th className="px-2 py-2 font-medium">状态</th>
                        <th className="px-2 py-2 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {history.map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-accent/40 transition-colors"
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="bg-muted h-9 w-9 shrink-0 overflow-hidden rounded border">
                                {entry.thumbnail ? (
                                  <img
                                    src={entry.thumbnail}
                                    alt={entry.name}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[9px]">
                                    <ImageIcon className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className="max-w-44 truncate text-xs font-medium"
                                  title={entry.name}
                                >
                                  {getBaseName(entry.name)}
                                </div>
                                {entry.width && entry.height && (
                                  <div className="text-muted-foreground text-[11px]">
                                    {entry.width} × {entry.height}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-xs whitespace-nowrap">
                            {entry.tool}
                          </td>
                          <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                            {formatTime(entry.timestamp)}
                          </td>
                          <td className="text-muted-foreground px-2 py-2 text-xs whitespace-nowrap">
                            {formatBytes(entry.size)}
                          </td>
                          <td className="px-2 py-2">
                            {getStatusBadge(entry.status)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              onClick={() => removeEntry(entry.id)}
                              className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                              title="删除"
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
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
