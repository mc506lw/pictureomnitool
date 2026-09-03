"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

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
      <body className="antialiased">
        <div className="mx-auto max-w-2xl space-y-6 p-8">
          <div className="border-destructive/20 bg-destructive/10 flex items-center gap-3 rounded-lg border p-6">
            <AlertTriangle className="text-destructive h-6 w-6" />
            <div>
              <h1 className="text-lg font-semibold">应用出现异常</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                抱歉，应用运行出错。你可以尝试刷新页面。
              </p>
            </div>
          </div>
          <Button onClick={() => reset()}>刷新页面</Button>
        </div>
      </body>
    </html>
  );
}
