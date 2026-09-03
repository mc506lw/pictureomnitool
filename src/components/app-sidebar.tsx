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
  RotateCw,
  Info,
  Columns,
  History,
  Text,
  Pipette,
  CircleOff,
  CircleCheckBig,
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
