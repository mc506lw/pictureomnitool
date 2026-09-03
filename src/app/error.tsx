"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <SidebarInset>
          <div className="mx-auto max-w-2xl space-y-6 p-8">
            <div className="bg-destructive/10 flex items-center gap-3 rounded-lg border p-6">
              <AlertTriangle className="text-destructive h-6 w-6" />
              <div>
                <h1 className="text-lg font-semibold">页面出现异常</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  抱歉，页面运行出错。你可以尝试刷新页面或返回首页。
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => reset()}>重试</Button>
            </div>
          </div>
        </SidebarInset>
      </body>
    </html>
  );
}
