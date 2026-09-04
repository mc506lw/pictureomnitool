"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Repeat,
  Scaling,
  Crop,
  FileArchive,
  FilePenLine,
  Ruler,
  Stamp,
  ShieldCheck,
  ImageIcon,
  Palette,
  TableProperties,
  RotateCw,
  Info,
  Columns,
  History,
  Text,
  Type,
  Pipette,
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
  Camera,
  Tag,
  Pencil,
  Scissors,
  Activity,
  Box,
  Layers,
  Grid,
  Waves,
  ArrowDownFromLine,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter as SidebarFooterUI,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  description: string;
  icon: LucideIcon;
  url: string;
}

const toolGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "基础工具",
    items: [
      {
        title: "格式转换",
        description: "任意格式互相转换",
        icon: Repeat,
        url: "/convert",
      },
      {
        title: "图片缩放",
        description: "放大缩小 · 多种插值算法",
        icon: Scaling,
        url: "/resize",
      },
      {
        title: "图片裁剪",
        description: "比例裁剪 · 圆形裁剪",
        icon: Crop,
        url: "/crop",
      },
      {
        title: "图片压缩",
        description: "质量压缩 · 目标大小",
        icon: FileArchive,
        url: "/compress",
      },
      {
        title: "图片模糊",
        description: "添加高斯模糊效果",
        icon: CircleOff,
        url: "/blur",
      },
      {
        title: "黑白效果",
        description: "将图片转为黑白灰度",
        icon: CircleCheckBig,
        url: "/grayscale",
      },
    ],
  },
  {
    label: "批量工具",
    items: [
      {
        title: "批量重命名",
        description: "模板批量命名文件",
        icon: FilePenLine,
        url: "/rename",
      },
      {
        title: "尺寸预设",
        description: "社交 · 电商 · 打印预设包",
        icon: Ruler,
        url: "/presets",
      },
      {
        title: "图标制作",
        description: "ICO · Favicon · App 图标",
        icon: Stamp,
        url: "/icon",
      },
    ],
  },
  {
    label: "高级工具",
    items: [
      {
        title: "水印添加",
        description: "文字 / 图片水印，支持位置、透明度、旋转、平铺",
        icon: Text,
        url: "/watermark",
      },
      {
        title: "旋转与翻转",
        description: "任意角度旋转、水平/垂直翻转",
        icon: RotateCw,
        url: "/rotate",
      },
      {
        title: "图片调色",
        description: "亮度、对比度、饱和度、色相、模糊、灰度、反色",
        icon: Palette,
        url: "/adjust",
      },
      {
        title: "拼图合并",
        description: "横向/纵向拼接多张图片，支持间距与对齐",
        icon: Columns,
        url: "/merge",
      },
      {
        title: "图片元数据",
        description: "查看尺寸、大小、修改时间，导出时自动清理",
        icon: Info,
        url: "/metadata",
      },
      {
        title: "颜色提取",
        description: "提取主色调和调色板",
        icon: Pipette,
        url: "/colors",
      },
      {
        title: "历史记录",
        description: "查看最近处理的图片",
        icon: History,
        url: "/history",
      },
      {
        title: "重复图片查找",
        description: "检测并清理重复图片，释放存储空间",
        icon: ImageOff,
        url: "/duplicates",
      },
      {
        title: "图片加边框",
        description: "添加自定义内边距和背景色",
        icon: Square,
        url: "/padding",
      },
      {
        title: "圆角图片",
        description: "为图片添加圆角效果",
        icon: Circle,
        url: "/round-corners",
      },
      {
        title: "图片对比",
        description: "对比两张图片的差异",
        icon: ArrowLeftRight,
        url: "/compare",
      },
      {
        title: "图片切片",
        description: "将图片切割为等分网格切片",
        icon: Grid3X3,
        url: "/split",
      },
      {
        title: "水印预览",
        description: "实时预览水印效果",
        icon: Eye,
        url: "/watermark-preview",
      },
      {
        title: "图片镜像",
        description: "水平或垂直翻转图片",
        icon: FlipHorizontal2,
        url: "/mirror",
      },
      {
        title: "截图边框",
        description: "将图片放入手机或笔记本外框中",
        icon: Smartphone,
        url: "/screenshot-frame",
      },
      {
        title: "图片信息",
        description: "查看并导出图片清单",
        icon: TableProperties,
        url: "/manifest",
      },
      {
        title: "图片标签",
        description: "批量为图片添加关键词标签",
        icon: Tag,
        url: "/image-tags",
      },
      {
        title: "EXIF 查看器",
        description: "读取相机参数和拍摄信息",
        icon: Camera,
        url: "/exif-viewer",
      },
      {
        title: "噪点效果",
        description: "为图片添加随机噪点，营造胶片或复古纹理效果",
        icon: Pipette,
        url: "/noise",
      },
      {
        title: "暗角效果",
        description: "为图片添加径向暗角，突出主体并增强画面层次",
        icon: CircleOff,
        url: "/vignette",
      },
      {
        title: "素描效果",
        description: "基于边缘检测将图片转为铅笔素描风格",
        icon: Pencil,
        url: "/sketch",
      },
      {
        title: "抠图移除",
        description: "基于颜色容差移除相近背景色，保留主体",
        icon: Scissors,
        url: "/cutout",
      },
      {
        title: "ASCII 艺术",
        description: "将图片转换为字符画，导出为文本文件",
        icon: Type,
        url: "/ascii-art",
      },
      {
        title: "渐变叠加",
        description: "为图片叠加线性渐变色彩，快速调整氛围",
        icon: ImageIcon,
        url: "/gradient-overlay",
      },
      {
        title: "图片水印",
        description: "上传水印图片并批量叠加到主图上",
        icon: ImageIcon,
        url: "/watermark-image",
      },
      {
        title: "故障艺术",
        description: "随机错位切片与 RGB 通道偏移，制造赛博故障风格",
        icon: Activity,
        url: "/glitch",
      },
      {
        title: "图案生成",
        description: "将图片生成为可平铺的纹理图案预览",
        icon: Grid3X3,
        url: "/pattern",
      },
      {
        title: "图片转 3D",
        description: "对图片应用透视倾斜与厚度阴影，生成简易立体效果",
        icon: Box,
        url: "/effect-3d",
      },
      {
        title: "图片叠加",
        description: "上传第二张图片并与主图混合，支持多种混合模式",
        icon: Layers,
        url: "/blend",
      },
      {
        title: "网格线叠加",
        description: "在图片上叠加可调节间距、粗细与颜色的网格线",
        icon: Grid,
        url: "/grid-lines",
      },
      {
        title: "半色调网点",
        description: "用彩色圆点模拟印刷网点效果",
        icon: Circle,
        url: "/halftone",
      },
      {
        title: "水波扭曲",
        description: "从中心向外扩散的同心波纹扭曲效果",
        icon: Waves,
        url: "/ripple",
      },
      {
        title: "浮雕效果",
        description: "用方向卷积核模拟高低差的浮雕风格",
        icon: Square,
        url: "/emboss",
      },
      {
        title: "倒影效果",
        description: "在原图下方生成渐变淡出的倒影",
        icon: ArrowDownFromLine,
        url: "/reflection",
      },
      {
        title: "文字叠加",
        description: "在图片中心叠加自定义文字水印",
        icon: Type,
        url: "/text-overlay",
      },
      {
        title: "撕纸效果",
        description: "用随机锯齿边缘模拟撕纸/剪纸边框",
        icon: Scissors,
        url: "/torn-paper",
      },
      {
        title: "负片效果",
        description: "反转颜色生成底片/负片风格",
        icon: CircleOff,
        url: "/negative",
      },
      {
        title: "径向模糊",
        description: "从中心向外辐射的运动模糊效果",
        icon: Circle,
        url: "/radial-blur",
      },
      {
        title: "图片边框",
        description: "在图片外围添加可调节粗细、圆角与颜色的边框",
        icon: Square,
        url: "/frame-border",
      },
      {
        title: "彩虹渐变",
        description: "在图片上叠加彩色线性渐变",
        icon: Palette,
        url: "/rainbow-gradient",
      },
      {
        title: "像素排序",
        description: "按亮度阈值重排像素，生成故障艺术条纹",
        icon: ArrowLeftRight,
        url: "/pixel-sort",
      },
      {
        title: "ASCII 艺术",
        description: "把图片转为字符画风格文本",
        icon: Type,
        url: "/ascii-art",
      },
    ],
  },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={{ children: item.title, hidden: undefined }}
        className={cn(
          active &&
            "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        )}
      >
        <Link href={item.url}>
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg group-data-[collapsible=icon]:mx-0">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">全能图片工具</span>
                  <span className="text-muted-foreground truncate text-xs">
                    一站式图片处理
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <NavLink
              item={{
                title: "首页",
                description: "返回首页",
                icon: Home,
                url: "/",
              }}
              active={pathname === "/"}
            />
          </SidebarMenu>
        </SidebarGroup>

        {toolGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavLink
                  key={item.url}
                  item={item}
                  active={pathname.startsWith(item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="group-data-[collapsible=icon]:hidden">
                <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
                  <ShieldCheck className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    所有处理均在浏览器本地完成，图片不会上传到任何服务器，请放心使用。
                  </p>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooterUI>
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <ThemeSwitcher />
        </div>
        <div className="hidden flex-col items-center gap-2 py-2 group-data-[collapsible=icon]:flex">
          <ThemeSwitcher compact />
        </div>
        <Separator className="group-data-[collapsible=icon]:hidden" />
        <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
          <p className="text-muted-foreground px-2 text-[11px]">
            {open ? "v0.2.0 · 本地处理" : ""}
          </p>
        </div>
      </SidebarFooterUI>

      <SidebarRail />
    </Sidebar>
  );
}
