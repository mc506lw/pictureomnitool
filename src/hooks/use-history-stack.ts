"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Direction = "backward" | "forward";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryApi<T> {
  state: HistoryState<T>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  replace: (value: T) => void;
  reset: (initial: T) => void;
  push: (value: T) => void;
}

export function useHistoryStack<T>(
  initial: T,
  limit = 50
): HistoryApi<T> {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const replace = useCallback((value: T) => {
    setState((s) => ({ ...s, present: value }));
  }, []);

  const push = useCallback(
    (value: T) => {
      setState((s) => {
        const past = [...s.past, s.present];
        if (past.length > limit) past.shift();
        return { past, present: value, future: [] };
      });
    },
    [limit]
  );

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      const newPast = s.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [s.present, ...s.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      const newFuture = s.future.slice(1);
      return {
        past: [...s.past, s.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((initialValue: T) => {
    setState({
      past: [],
      present: initialValue,
      future: [],
    });
  }, []);

  return {
    state,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo,
    redo,
    replace,
    reset,
    push,
  };
}

export function useHistoryMiddleware<T>(
  initial: T,
  onChange: (value: T) => void,
  options?: { delay?: number }
): [(partial: Partial<T>) => void, HistoryApi<T>] {
  const delay = options?.delay ?? 0;
  const history = useHistoryStack<T>(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<T>(initial);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialRef = useRef<T>(initial);

  useEffect(() => {
    latestRef.current = history.state.present;
  }, [history.state.present]);

  const commit = useCallback(
    (value: T) => {
      latestRef.current = value;
      history.replace(value);
      onChangeRef.current(value);
    },
    [history]
  );

  const push = useCallback(
    (value: T) => {
      latestRef.current = value;
      history.push(value);
      onChangeRef.current(value);
    },
    [history]
  );

  const move = useCallback(
    (next: T) => {
      latestRef.current = next;
      history.replace(next);
      onChangeRef.current(next);
    },
    [history]
  );

  const patch = useCallback(
    (partial: Partial<T>) => {
      const next = { ...latestRef.current, ...partial } as T;
      if (delay > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => push(next), delay);
        return;
      }
      push(next);
    },
    [delay, push]
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const undo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const previous = history.state.past[history.state.past.length - 1];
    if (!previous) return;
    history.undo();
    latestRef.current = previous;
    onChangeRef.current(previous);
  }, [history]);

  const redo = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = history.state.future[0];
    if (!next) return;
    history.redo();
    latestRef.current = next;
    onChangeRef.current(next);
  }, [history]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    history.reset(initialRef.current);
    latestRef.current = initialRef.current;
    onChangeRef.current(initialRef.current);
  }, [history]);

  return [
    patch,
    {
      ...history,
      undo,
      redo,
      replace: commit,
      reset,
    },
  ];
}
