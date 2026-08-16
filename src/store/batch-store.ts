"use client";

import { create } from "zustand";
import {
  decodeImageFile,
  makeThumbnail,
  type DecodedImage,
} from "@/lib/image-utils";
import { getExtension, sanitizeFileName } from "@/lib/utils";

export type BatchStatus = "pending" | "processing" | "done" | "error";

export interface BatchResult {
  blob: Blob;
  name: string;
  size: number;
  url?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  ext: string;
  size: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  /** 解码后的画布（工具处理源） */
  canvas?: HTMLCanvasElement;
  status: BatchStatus;
  error?: string;
  result?: BatchResult;
  /** 附加输出（如多尺寸生成时的其余尺寸） */
  extraResults?: BatchResult[];
}

const MAX_ITEMS = 300;

let idCounter = 0;
function nextId(): string {
  return `item-${Date.now()}-${idCounter++}`;
}

interface BatchState {
  items: BatchItem[];
  /** 添加文件并异步解码 */
  addFiles: (files: File[]) => void;
  /** 移除单个文件 */
  removeItem: (id: string) => void;
  /** 清空所有文件与结果 */
  clearAll: () => void;
  /** 更新单个条目 */
  updateItem: (id: string, patch: Partial<BatchItem>) => void;
  /** 重置所有条目为待处理 */
  resetAll: () => void;
  /** 生成唯一输出文件名（自动去重） */
  makeOutputName: (base: string, ext: string) => string;
}

function decodeFile(file: File): Promise<DecodedImage | null> {
  return decodeImageFile(file).catch(() => null);
}

export const useBatchStore = create<BatchState>((set, get) => ({
  items: [],

  addFiles: (files) => {
    const existing = get().items;
    const room = MAX_ITEMS - existing.length;
    if (room <= 0) return;

    const toAdd = files.slice(0, room);
    const newItems: BatchItem[] = toAdd.map((file) => ({
      id: nextId(),
      file,
      name: file.name,
      ext: getExtension(file.name),
      size: file.size,
      status: "pending",
    }));

    set({ items: [...existing, ...newItems] });

    // 异步解码，逐个更新
    for (const item of newItems) {
      decodeFile(item.file).then((decoded) => {
        if (!decoded) {
          get().updateItem(item.id, {
            status: "error",
            error: "无法解码该图片，可能格式不受支持",
          });
          return;
        }
        const thumbnail = makeThumbnail(decoded.canvas);
        get().updateItem(item.id, {
          canvas: decoded.canvas,
          width: decoded.width,
          height: decoded.height,
          thumbnail,
          status: "pending",
        });
      });
    }
  },

  removeItem: (id) => {
    set((state) => {
      const item = state.items.find((i) => i.id === id);
      if (item?.result?.url) URL.revokeObjectURL(item.result.url);
      return { items: state.items.filter((i) => i.id !== id) };
    });
  },

  clearAll: () => {
    const { items } = get();
    for (const item of items) {
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    }
    set({ items: [] });
  },

  updateItem: (id, patch) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },

  resetAll: () => {
    const { items } = get();
    for (const item of items) {
      if (item.result?.url) URL.revokeObjectURL(item.result.url);
    }
    set((state) => ({
      items: state.items.map((i) => ({
        ...i,
        status: "pending" as const,
        error: undefined,
        result: undefined,
        extraResults: undefined,
      })),
    }));
  },

  makeOutputName: (base, ext) => {
    const { items } = get();
    const used = new Set(items.map((i) => i.name.toLowerCase()));
    let name = sanitizeFileName(base);
    if (!name) name = "output";
    let candidate = `${name}.${ext}`;
    let n = 1;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${name}-${n++}.${ext}`;
    }
    return candidate;
  },
}));
