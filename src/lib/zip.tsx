"use client";

import * as React from "react";
import JSZip from "jszip";
import { FolderDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob, sanitizeFileName, formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** 将多个文件打包为 ZIP 并下载 */
export async function downloadZip(
  entries: ZipEntry[],
  zipName: string
): Promise<void> {
  if (entries.length === 0) {
    toast.warning("没有可导出的文件");
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  for (const entry of entries) {
    let name = sanitizeFileName(entry.name);
    let n = 1;
    const lower = name.toLowerCase();
    while (used.has(lower)) {
      const dot = name.lastIndexOf(".");
      name =
        dot > 0
          ? `${name.slice(0, dot)}-${n++}${name.slice(dot)}`
          : `${name}-${n++}`;
      // 防死循环
      if (n > 100) break;
    }
    used.add(name.toLowerCase());
    zip.file(name, entry.blob);
  }
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  downloadBlob(blob, sanitizeFileName(zipName) || "images.zip");
  toast.success(`已导出 ${entries.length} 个文件（${formatBytes(blob.size)}）`);
}

interface ZipExportButtonProps {
  entries: ZipEntry[];
  zipName: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

/** ZIP 导出按钮 */
export function ZipExportButton({
  entries,
  zipName,
  className,
  children,
  disabled,
}: ZipExportButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const count = entries.length;

  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await downloadZip(entries, zipName);
        } catch (err) {
          console.error(err);
          toast.error("导出失败，请重试");
        } finally {
          setBusy(false);
        }
      }}
      disabled={disabled || busy || count === 0}
      className={cn(
        "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FolderDown className="h-4 w-4" />
      )}
      {children ?? `导出 ZIP（${count}）`}
    </button>
  );
}

/** 逐个下载所有文件 */
export async function downloadAll(entries: ZipEntry[]): Promise<void> {
  for (const entry of entries) {
    downloadBlob(entry.blob, entry.name);
    await new Promise((r) => setTimeout(r, 150));
  }
  toast.success(`已开始下载 ${entries.length} 个文件`);
}

interface DownloadAllButtonProps {
  entries: ZipEntry[];
  disabled?: boolean;
}

export function DownloadAllButton({
  entries,
  disabled,
}: DownloadAllButtonProps) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await downloadAll(entries);
        } finally {
          setBusy(false);
        }
      }}
      disabled={disabled || busy || entries.length === 0}
      className="border-input bg-background hover:bg-accent inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      逐个下载
    </button>
  );
}
