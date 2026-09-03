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
  Palette,
  Camera,
  LayoutGrid,
  RotateCw,
  Info,
  Columns,
  History,
  Type,
  Pipette,
  Sparkles,
  ArrowRight,
  Star,
  Clock,
  Download,
  CircleOff,
  CircleCheckBig,
  ImageOff,
  Square,
  Circle,
  ArrowLeftRight,
  Grid3X3,
  Eye,
  FlipHorizontal2,
  Smartphone,
  TableProperties,
  Tag,
  Pencil,
  Scissors,
} from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const tools = [
  {
    icon: Repeat,
    title: "格式转换",
    description:
      "PNG / JPG / WebP / AVIF / BMP / GIF / ICO 任意互转，支持批量与质量调节",
    url: "/convert",
    tag: "批量",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    icon: Scaling,
    title: "图片缩放",
    description:
      "按百分比或固定尺寸缩放，支持最近邻 / 双线性 / 双三次 / Lanczos 插值",
    url: "/resize",
    tag: "4 种算法",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    icon: Crop,
    title: "图片裁剪",
    description: "自由裁剪、比例裁剪、圆形裁剪，证件照尺寸一键裁切",
    url: "/crop",
    tag: "精细",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    icon: FileArchive,
    title: "图片压缩",
    description: "质量压缩、指定目标大小自动调节，压缩前后对比一目了然",
    url: "/compress",
    tag: "目标大小",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    icon: CircleOff,
    title: "图片模糊",
    description: "添加高斯模糊效果，可调节模糊程度",
    url: "/blur",
    tag: "模糊",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: CircleCheckBig,
    title: "黑白效果",
    description: "将彩色图片转换为黑白灰度效果",
    url: "/grayscale",
    tag: "灰度",
    color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: FilePenLine,
    title: "批量重命名",
    description: "序号、日期、随机名、查找替换等模板组合，实时预览，导出 ZIP",
    url: "/rename",
    tag: "模板化",
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
  {
    icon: Ruler,
    title: "尺寸预设",
    description:
      "社交平台、电商、壁纸、打印、应用图标等 8 大场景预设包一键套用",
    url: "/presets",
    tag: "8 大场景",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Stamp,
    title: "图标制作",
    description: "导出 ICO、Favicon 全套、iOS / Android / macOS App 图标包",
    url: "/icon",
    tag: "全套导出",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: Stamp,
    title: "水印添加",
    description: "文字水印 / 图片水印，支持位置、透明度、旋转、平铺模式",
    url: "/watermark",
    tag: "多模式",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: RotateCw,
    title: "旋转与翻转",
    description: "任意角度旋转、水平/垂直翻转，一键应用到批量图片",
    url: "/rotate",
    tag: "灵活",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    icon: Palette,
    title: "专业调色",
    description: "DaVinci Resolve 风格调色：曲线、色轮、色温、晕影、锐化",
    url: "/adjust",
    tag: "专业级",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    icon: Columns,
    title: "拼图合并",
    description: "横向/纵向拼接多张图片，支持间距、背景色与对齐方式",
    url: "/merge",
    tag: "批量",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    icon: Info,
    title: "图片元数据",
    description: "查看尺寸、体积、修改时间，导出时自动清理敏感元数据",
    url: "/metadata",
    tag: "隐私",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  {
    icon: Pipette,
    title: "颜色提取",
    description: "从图片中提取主色调和调色板，支持亮度范围过滤",
    url: "/colors",
    tag: "新功能",
    color: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    icon: History,
    title: "历史记录",
    description: "查看最近处理的图片记录，本地存储，最多 100 条",
    url: "/history",
    tag: "新功能",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: ImageOff,
    title: "重复图片查找",
    description: "自动识别重复或相似图片，支持选择保留后一键清理",
    url: "/duplicates",
    tag: "清理",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: Square,
    title: "图片加边框",
    description: "添加自定义内边距和背景色，适配社交平台或打印需求",
    url: "/padding",
    tag: "新功能",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    icon: Circle,
    title: "圆角图片",
    description: "为图片添加圆角效果，适合头像、卡片和社交媒体素材",
    url: "/round-corners",
    tag: "新功能",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: ArrowLeftRight,
    title: "图片对比",
    description: "上传两张图片并直观对比差异，支持滑动查看重叠效果",
    url: "/compare",
    tag: "新功能",
    color: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  },
  {
    icon: Grid3X3,
    title: "图片切片",
    description: "将图片切割为等分网格切片，适合拼图或分块处理",
    url: "/split",
    tag: "新功能",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
  {
    icon: Eye,
    title: "水印预览",
    description: "实时预览文字水印效果，调整透明度、角度和重复模式",
    url: "/watermark-preview",
    tag: "新功能",
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
  {
    icon: FlipHorizontal2,
    title: "图片镜像",
    description: "水平或垂直翻转图片，适合制作镜像效果",
    url: "/mirror",
    tag: "新功能",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: Smartphone,
    title: "截图边框",
    description: "将图片放入手机或笔记本外框中，适合制作宣传展示图",
    url: "/screenshot-frame",
    tag: "新功能",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    icon: TableProperties,
    title: "图片信息",
    description: "查看并导出图片清单，含尺寸、格式、体积和缩略图",
    url: "/manifest",
    tag: "新功能",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    icon: Tag,
    title: "图片标签",
    description: "批量为图片添加关键词标签，便于分类、检索和导出",
    url: "/image-tags",
    tag: "新功能",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    icon: Camera,
    title: "EXIF 查看器",
    description: "读取相机参数、拍摄时间、ISO、光圈和 GPS 位置信息",
    url: "/exif-viewer",
    tag: "新功能",
    color: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  },
  {
    icon: LayoutGrid,
    title: "拼图组合",
    description: "将多张图片组合为网格拼图，支持间距、圆角和背景色",
    url: "/collage",
    tag: "新功能",
    color: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    icon: Pipette,
    title: "噪点效果",
    description: "为图片添加随机噪点，营造胶片或复古纹理效果",
    url: "/noise",
    tag: "新功能",
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
  {
    icon: CircleOff,
    title: "暗角效果",
    description: "为图片添加径向暗角，突出主体并增强画面层次",
    url: "/vignette",
    tag: "新功能",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    icon: Pencil,
    title: "素描效果",
    description: "基于边缘检测将图片转为铅笔素描风格",
    url: "/sketch",
    tag: "新功能",
    color: "bg-stone-500/10 text-stone-600 dark:text-stone-400",
  },
  {
    icon: Scissors,
    title: "抠图移除",
    description: "基于颜色容差移除相近背景色，保留主体",
    url: "/cutout",
    tag: "新功能",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    icon: Type,
    title: "ASCII 艺术",
    description: "将图片转换为字符画，导出为文本文件",
    url: "/ascii-art",
    tag: "新功能",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: ImageIcon,
    title: "渐变叠加",
    description: "为图片叠加线性渐变色彩，快速调整氛围",
    url: "/gradient-overlay",
    tag: "新功能",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
];

const stats = [
  { icon: Zap, label: "处理速度", value: "纯本地", desc: "无需上传" },
  { icon: Package, label: "批量导出", value: "ZIP", desc: "一键下载" },
  { icon: ShieldCheck, label: "隐私安全", value: "100%", desc: "本地处理" },
  { icon: Layers, label: "支持格式", value: "9+", desc: "主流格式" },
];

export default function Home() {
  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto w-full max-w-6xl space-y-12 p-6 sm:p-10">
          {/* Hero Section */}
          <section className="from-primary/5 via-background to-background relative overflow-hidden rounded-2xl border bg-gradient-to-br p-8 sm:p-12">
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-xl shadow-lg">
                    <ImageIcon className="h-7 w-7" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                      全能图片工具
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Picture Omni Tool
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
                  一站式浏览器本地图片处理平台。无需上传，隐私安全。
                  支持格式转换、裁剪、压缩、缩放、重命名、预设、图标制作、
                  水印、旋转、专业调色、拼图、元数据、颜色提取等 14 项专业工具。
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: ShieldCheck, text: "纯本地处理" },
                    { icon: Zap, text: "批量处理" },
                    { icon: Package, text: "ZIP 打包导出" },
                    { icon: Layers, text: "9+ 种格式" },
                  ].map(({ icon: Icon, text }) => (
                    <span
                      key={text}
                      className="bg-background/80 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur-sm"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {text}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:w-80">
                {stats.map(({ icon: Icon, label, value, desc }) => (
                  <div
                    key={label}
                    className="bg-background/80 rounded-xl border p-4 backdrop-blur-sm"
                  >
                    <Icon className="text-primary mb-2 h-5 w-5" />
                    <div className="text-muted-foreground text-xs">{label}</div>
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 工具网格 */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">全部工具</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  14 项专业工具，覆盖图片处理全流程
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                v0.2.0
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.url}
                    href={tool.url}
                    className="group bg-card hover:bg-accent/50 relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {tool.tag}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <h3 className="group-hover:text-primary text-sm font-medium transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                    <div className="text-primary mt-4 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      开始使用 <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 特性说明 */}
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="bg-card rounded-xl border p-6">
              <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-sm font-medium">隐私优先</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                所有图片处理均在浏览器本地完成，数据不会上传到任何服务器，确保您的隐私安全。
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-sm font-medium">极速处理</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                基于 Canvas API 和自研图像引擎
                优化，处理速度快，支持批量处理大量图片。
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-sm font-medium">便捷导出</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                支持单张下载和 ZIP 批量打包导出，方便管理和分享处理后的图片。
              </p>
            </div>
          </section>

          {/* 隐私说明 */}
          <section>
            <div className="bg-muted/50 rounded-xl border p-6">
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
