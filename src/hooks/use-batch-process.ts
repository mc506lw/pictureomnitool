"use client";

import { useCallback, useRef, useState } from "react";

interface BatchProcessOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
  /** 单文件处理任务；处理期间应抛出异常表示失败 */
  task: (item: T, index: number) => Promise<void>;
  onItemStart?: (item: T) => void;
  onItemDone?: (item: T, index: number) => void;
  onItemError?: (item: T, error: unknown) => void;
}

export interface BatchProcessState {
  running: boolean;
  done: number;
  total: number;
  cancelled: boolean;
  start: () => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * 通用批量处理 Hook：顺序执行、进度上报、可取消
 */
export function useBatchProcess<T>({
  items,
  getItemId,
  task,
  onItemStart,
  onItemDone,
  onItemError,
}: BatchProcessOptions<T>): BatchProcessState {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setCancelled(true);
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setCancelled(false);
    setDone(0);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current || items.length === 0) return;
    runningRef.current = true;
    setRunning(true);
    setCancelled(false);
    cancelRef.current = false;
    setDone(0);

    (async () => {
      try {
        for (let i = 0; i < items.length; i++) {
          if (cancelRef.current) break;
          const item = items[i];
          try {
            onItemStart?.(item);
            await task(item, i);
            if (!cancelRef.current) onItemDone?.(item, i);
          } catch (err) {
            onItemError?.(item, err);
          }
          setDone(i + 1);
          // 让出主线程，保持 UI 响应
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    })();
  }, [items, task, onItemStart, onItemDone, onItemError]);

  return {
    running,
    done,
    total: items.length,
    cancelled,
    start,
    cancel,
    reset,
  };
}
