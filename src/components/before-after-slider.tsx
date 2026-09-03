"use client";

import * as React from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  className,
}: BeforeAfterSliderProps) {
  const [ratio, setRatio] = React.useState(50);
  const [dragging, setDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const updateRatio = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setRatio(Math.max(0, Math.min(100, pct)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    updateRatio(e.clientX);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => updateRatio(e.clientX);
    const handleUp = () => setDragging(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-md border",
        "select-none touch-none",
        className
      )}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "none" }}
    >
      <img
        src={beforeUrl}
        alt="原图"
        className="block h-full w-full object-contain"
        draggable={false}
      />
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${ratio}%` }}
      >
        <img
          src={afterUrl}
          alt="处理后"
          className="block h-full w-full object-contain"
          style={{ width: `${100 / (ratio / 100)}%`, minWidth: "100%" }}
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-y-0 bg-black/10"
        style={{ left: `${ratio}%`, width: "2px" }}
      />
      <div
        className="absolute inset-y-0 flex items-center"
        style={{ left: `${ratio}%`, transform: "translateX(-50%)" }}
      >
        <div className="bg-background border flex h-8 w-8 items-center justify-center rounded-full shadow-sm">
          <div className="text-muted-foreground text-[10px]">⟷</div>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
        原图
      </div>
      <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
        处理后
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
