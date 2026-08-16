"use client";

import * as React from "react";
import { UploadCloud, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  compact?: boolean;
  className?: string;
  label?: string;
}

/** 拖拽 / 点击选择文件区域 */
export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  compact = false,
  className,
  label = "拖拽图片到此处，或点击选择文件",
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "border-input hover:bg-accent/50 flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
        dragging && "bg-accent border-primary",
        compact ? "gap-1 p-4" : "gap-2 p-8",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      {dragging ? (
        <ImagePlus className={compact ? "h-5 w-5" : "h-8 w-8"} />
      ) : (
        <UploadCloud className={compact ? "h-5 w-5" : "h-8 w-8"} />
      )}
      <p
        className={cn(
          "text-muted-foreground text-center",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {label}
      </p>
      <p className="text-muted-foreground/60 text-center text-[11px]">
        支持 PNG / JPG / WebP / GIF / BMP / SVG / AVIF / ICO，可多选
      </p>
    </div>
  );
}

/** 文件列表工具栏（添加/清空） */
export function FileListToolbar({
  onAdd,
  onClear,
  count,
  disabled,
}: {
  onAdd: (files: File[]) => void;
  onClear: () => void;
  count: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-sm">
        共 <span className="text-foreground font-medium">{count}</span> 个文件
      </div>
      <div className="flex items-center gap-2">
        <input
          type="file"
          id="file-add-input"
          accept="image/*,.svg,.ico"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onAdd(files);
            e.target.value = "";
          }}
        />
        <label
          htmlFor="file-add-input"
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          添加文件
        </label>
        <button
          onClick={onClear}
          disabled={disabled || count === 0}
          className="border-input bg-background hover:bg-destructive hover:text-destructive-foreground inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium opacity-100 transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          清空
        </button>
      </div>
    </div>
  );
}
