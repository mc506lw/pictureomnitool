import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ImageIcon } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";

export default function NotFound() {
  return (
    <SidebarInset>
      <div className="mx-auto max-w-2xl space-y-6 p-8 text-center">
        <ImageIcon className="text-muted-foreground mx-auto h-16 w-16" />
        <h1 className="text-2xl font-bold">页面未找到</h1>
        <p className="text-muted-foreground">
          你访问的页面不存在或已被移除，请返回首页重新开始。
        </p>
        <Button asChild>
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    </SidebarInset>
  );
}
