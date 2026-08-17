"use client";

import Link from "next/link";
import {
  Repeat,
  Scaling,
  Crop,
  FileArchive,
  FilePenLine,
  Ruler,
  Stamp,
  ShieldCheck,
  Zap,
  Package,
  Layers,
  ImageIcon,
  ChevronRight,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";

const tools = [
  {
    icon: Repeat,
    title: "格式转换",
    description:
      "PNG / JPG / WebP / AVIF / BMP / GIF / ICO 任意互转，支持批量与质量调节",
    url: "/convert",
    tag: "批量",
  },
  {
    icon: Scaling,
    title: "图片缩放",
    description:
      "按百分比或固定尺寸缩放，支持最近邻 / 双线性 / 双三次 / Lanczos 插值",
    url: "/resize",
    tag: "4 种算法",
  },
  {
    icon: Crop,
    title: "图片裁剪",
    description: "自由裁剪、比例裁剪、圆形裁剪，证件照尺寸一键裁切",
    url: "/crop",
    tag: "精细",
  },
  {
    icon: FileArchive,
    title: "图片压缩",
    description: "质量压缩、指定目标大小自动调节，压缩前后对比一目了然",
    url: "/compress",
    tag: "目标大小",
  },
  {
    icon: FilePenLine,
    title: "批量重命名",
    description: "序号、日期、随机名、查找替换等模板组合，实时预览，导出 ZIP",
    url: "/rename",
    tag: "模板化",
  },
  {
    icon: Ruler,
    title: "尺寸预设",
    description:
      "社交平台、电商、壁纸、打印、应用图标等 8 大场景预设包一键套用",
    url: "/presets",
    tag: "8 大场景",
  },
  {
    icon: Stamp,
    title: "图标制作",
    description: "导出 ICO、Favicon 全套、iOS / Android / macOS App 图标包",
    url: "/icon",
    tag: "全套导出",
  },
];

export default function Home() {
  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-5xl space-y-10 p-10">
          {/* Hero */}
          <div className="flex items-center gap-6">
            <div className="bg-primary text-primary-foreground flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-lg">
              <ImageIcon className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">全能图片工具</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                一站式图片处理：转换、裁剪、压缩、缩放、重命名、预设、图标制作
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, text: "纯本地处理" },
                  { icon: Zap, text: "批量处理" },
                  { icon: Package, text: "ZIP 打包导出" },
                  { icon: Layers, text: "9 种输入格式" },
                ].map(({ icon: Icon, text }) => (
                  <span
                    key={text}
                    className="bg-muted/60 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 工具网格 */}
          <section>
            <h2 className="text-muted-foreground mb-4 text-sm font-medium">
              全部工具
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <Link
                  key={tool.url}
                  href={tool.url}
                  className="bg-card hover:bg-accent group hover:border-accent-foreground/20 flex h-full items-start gap-4 rounded-lg border p-4 text-left transition-all"
                >
                  <div className="bg-primary/10 group-hover:bg-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                    <tool.icon className="text-primary h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.title}</span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                        {tool.tag}
                      </span>
                    </div>
                    <div className="text-muted-foreground line-clamp-2 min-h-8 text-xs leading-relaxed">
                      {tool.description}
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>

          {/* 隐私说明 */}
          <section>
            <div className="bg-muted/50 rounded-lg border p-5">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="text-primary h-4 w-4" />
                <h3 className="text-sm font-medium">隐私与安全</h3>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                所有图片处理均在你的浏览器本地完成，图片数据不会上传到任何服务器。
                支持批量处理任意数量的图片（建议单批不超过 300 张以保证流畅），
                处理结果可打包为 ZIP 一键下载。
              </p>
            </div>
          </section>
        </div>
      </div>
    </SidebarInset>
  );
}
