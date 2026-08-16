import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化文件大小 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${sizes[i]}`;
}

/** 获取文件名（不含扩展名） */
export function getBaseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** 获取文件扩展名（小写，不含点） */
export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** 拼接新的文件名 */
export function withExtension(name: string, ext: string): string {
  return `${getBaseName(name)}.${ext}`;
}

/** 去除非法文件名字符 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim();
}

/** 数字补零 */
export function padStart(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** 从 Blob 下载文件 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 异步顺序执行任务，带进度回调，可取消 */
export async function runSequential<T>(
  items: T[],
  task: (item: T, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    if (isCancelled?.()) return;
    await task(items[i], i);
    onProgress?.(i + 1, items.length);
  }
}
