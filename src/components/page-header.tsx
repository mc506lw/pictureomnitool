"use client";

import * as React from "react";
import { ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

/** 工具页统一头部 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2.5">
        <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <p className="text-muted-foreground pl-[46px] text-sm">{description}</p>
      <p className="text-muted-foreground/70 flex items-center gap-1 pl-[46px] text-xs">
        <ShieldCheck className="h-3 w-3" />
        图片在浏览器本地处理，不会上传
      </p>
    </div>
  );
}
