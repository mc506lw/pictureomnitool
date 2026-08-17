"use client";

import * as React from "react";
import { Stamp, Loader2, FolderDown } from "lucide-react";
import { SidebarInset } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/page-header";
import { decodeImageFile } from "@/lib/image-utils";
import { canvasToIco, canvasToIcns } from "@/lib/icons";
import { downloadZip, type ZipEntry } from "@/lib/zip";
import { downloadBlob } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IconOptions {
  padding: number; // 0~0.4
  background: "transparent" | "white" | "black" | "color";
  bgColor: string;
  radius: number; // 0~0.3 圆角比例
}

const DEFAULT_OPTIONS: IconOptions = {
  padding: 0.1,
  background: "transparent",
  bgColor: "#3b82f6",
  radius: 0,
};

/** 按选项绘制应用图标（含安全边距 / 背景 / 圆角） */
function drawAppIcon(
  source: HTMLCanvasElement,
  size: number,
  opts: IconOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // 背景
  if (opts.background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
  } else if (opts.background === "black") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
  } else if (opts.background === "color") {
    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  // 圆角裁剪
  if (opts.radius > 0) {
    const r = size * opts.radius;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.clip();
  }

  // 图片（contain + padding）
  const pad = size * opts.padding;
  const area = size - pad * 2;
  const scale = Math.min(area / source.width, area / source.height);
  const dw = Math.round(source.width * scale);
  const dh = Math.round(source.height * scale);
  const dx = Math.round((size - dw) / 2);
  const dy = Math.round((size - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, dx, dy, dw, dh);
  return canvas;
}

interface PackResult {
  id: string;
  label: string;
  description: string;
  files: ZipEntry[];
  single?: { name: string; blob: Blob };
}

/** 每个图标包的尺寸清单（key 用于勾选） */
interface PackSizeDef {
  key: string;
  /** 可选显示标签；缺省用 fileName 或 size */
  label?: string;
  /** 若设置了 fileName 则有独立文件名；ime：ico 多尺寸合成到单文件 */
  fileName?: string;
  size?: number;
  sizes?: number[];
}

const PACK_SIZE_DEFS: { id: string; defs: PackSizeDef[] }[] = [
  {
    id: "ico",
    defs: [{ key: "ico", label: "ICO 单文件（16~256px）", size: 256 }],
  },
  {
    id: "favicon",
    defs: [
      { key: "favicon-16", fileName: "favicon-16x16.png", size: 16 },
      { key: "favicon-32", fileName: "favicon-32x32.png", size: 32 },
      { key: "favicon-48", fileName: "favicon-48x48.png", size: 48 },
      { key: "apple-180", fileName: "apple-touch-icon.png", size: 180 },
      { key: "android-192", fileName: "android-chrome-192x192.png", size: 192 },
      { key: "android-512", fileName: "android-chrome-512x512.png", size: 512 },
      { key: "mstile-150", fileName: "mstile-150x150.png", size: 150 },
      { key: "favicon-ico", label: "favicon.ico（16/32/48）", size: 32 },
    ],
  },
  {
    id: "ios",
    defs: [
      { key: "20", fileName: "AppIcon-20@1x.png", size: 20 },
      { key: "40", fileName: "AppIcon-20@2x.png", size: 40 },
      { key: "60", fileName: "AppIcon-20@3x.png", size: 60 },
      { key: "29", fileName: "AppIcon-29@1x.png", size: 29 },
      { key: "58", fileName: "AppIcon-29@2x.png", size: 58 },
      { key: "87", fileName: "AppIcon-29@3x.png", size: 87 },
      { key: "40b", fileName: "AppIcon-40@1x.png", size: 40 },
      { key: "80", fileName: "AppIcon-40@2x.png", size: 80 },
      { key: "120", fileName: "AppIcon-40@3x.png", size: 120 },
      { key: "120b", fileName: "AppIcon-60@2x.png", size: 120 },
      { key: "180", fileName: "AppIcon-60@3x.png", size: 180 },
      { key: "76", fileName: "AppIcon-76@1x.png", size: 76 },
      { key: "152", fileName: "AppIcon-76@2x.png", size: 152 },
      { key: "167", fileName: "AppIcon-83.5@2x.png", size: 167 },
      { key: "1024", fileName: "AppIcon-1024.png", size: 1024 },
    ],
  },
  {
    id: "android",
    defs: [
      { key: "mdpi", fileName: "mipmap-mdpi/ic_launcher.png", size: 48 },
      { key: "hdpi", fileName: "mipmap-hdpi/ic_launcher.png", size: 72 },
      { key: "xhdpi", fileName: "mipmap-xhdpi/ic_launcher.png", size: 96 },
      { key: "xxhdpi", fileName: "mipmap-xxhdpi/ic_launcher.png", size: 144 },
      { key: "xxxhdpi", fileName: "mipmap-xxxhdpi/ic_launcher.png", size: 192 },
      { key: "playstore", fileName: "playstore-icon.png", size: 512 },
    ],
  },
  {
    id: "windows",
    defs: [
      { key: "sq44", fileName: "Square44x44Logo.png", size: 44 },
      {
        key: "sq44u",
        fileName: "Square44x44Logo.targetsize-44_altform-unplated.png",
        size: 44,
      },
      { key: "sq71", fileName: "Square71x71Logo.png", size: 71 },
      { key: "sq150", fileName: "Square150x150Logo.png", size: 150 },
      { key: "sq310", fileName: "Square310x310Logo.png", size: 310 },
      { key: "wid310", fileName: "Wide310x150Logo.png", size: 310 },
      { key: "store", fileName: "StoreLogo.png", size: 50 },
    ],
  },
  {
    id: "macos",
    defs: [
      { key: "16", fileName: "icon_16x16.png", size: 16 },
      { key: "32", fileName: "icon_16x16@2x.png", size: 32 },
      { key: "32b", fileName: "icon_32x32.png", size: 32 },
      { key: "64", fileName: "icon_32x32@2x.png", size: 64 },
      { key: "128", fileName: "icon_128x128.png", size: 128 },
      { key: "256", fileName: "icon_128x128@2x.png", size: 256 },
      { key: "256b", fileName: "icon_256x256.png", size: 256 },
      { key: "512", fileName: "icon_256x256@2x.png", size: 512 },
      { key: "512b", fileName: "icon_512x512.png", size: 512 },
      { key: "1024", fileName: "icon_512x512@2x.png", size: 1024 },
      { key: "icns", label: "ICNS 单文件", size: 1024 },
    ],
  },
];

/** 各包默认全选的 key 集合 */
function defaultPackSelection(defs: PackSizeDef[]): string[] {
  return defs.map((d) => d.key);
}

async function buildPacks(
  source: HTMLCanvasElement,
  opts: IconOptions,
  packSel: Record<string, string[]>
): Promise<PackResult[]> {
  const draw = (size: number) => drawAppIcon(source, size, opts);
  const toPng = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))),
        "image/png"
      )
    );

  const packs: PackResult[] = [];
  const has = (pid: string, key: string) =>
    packSel[pid]?.includes(key) ?? false;

  // 1. Windows ICO
  {
    const ico = await canvasToIco(draw(256), [16, 24, 32, 48, 64, 128, 256]);
    packs.push({
      id: "ico",
      label: "Windows ICO",
      description: "单文件多尺寸图标（16~256px）",
      single: has("ico", "ico")
        ? { name: "favicon.ico", blob: ico }
        : undefined,
      files: [],
    });
  }

  // 2. Favicon 全套
  {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === "favicon")!.defs;
    const files: ZipEntry[] = [];
    for (const d of defs) {
      if (!has("favicon", d.key)) continue;
      if (d.key === "favicon-ico") {
        files.push({
          name: "favicon.ico",
          blob: await canvasToIco(draw(48), [16, 32, 48]),
        });
      } else if (d.fileName && d.size) {
        files.push({ name: d.fileName, blob: await toPng(draw(d.size)) });
      }
    }
    // manifest 引用的图标若被勾选则一并生成 manifest
    const have192 = has("favicon", "android-192");
    const have512 = has("favicon", "android-512");
    if (have192 || have512) {
      files.push({
        name: "site.webmanifest",
        blob: new Blob(
          [
            JSON.stringify(
              {
                name: "App",
                short_name: "App",
                icons: [
                  ...(have192
                    ? [
                        {
                          src: "/android-chrome-192x192.png",
                          sizes: "192x192",
                          type: "image/png",
                        },
                      ]
                    : []),
                  ...(have512
                    ? [
                        {
                          src: "/android-chrome-512x512.png",
                          sizes: "512x512",
                          type: "image/png",
                        },
                      ]
                    : []),
                ],
                theme_color:
                  opts.background === "color" ? opts.bgColor : "#ffffff",
                background_color:
                  opts.background === "color" ? opts.bgColor : "#ffffff",
                display: "standalone",
              },
              null,
              2
            ),
          ],
          { type: "application/manifest+json" }
        ),
      });
    }
    packs.push({
      id: "favicon",
      label: "Favicon 全套",
      description: "网站图标全套（16~512px + manifest）",
      files,
    });
  }

  // 3. iOS AppIcon
  {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === "ios")!.defs;
    const images: Record<string, unknown>[] = [];
    const files: ZipEntry[] = [];
    for (const d of defs) {
      if (!has("ios", d.key) || !d.fileName || !d.size) continue;
      files.push({ name: d.fileName, blob: await toPng(draw(d.size)) });
      const match = d.fileName.match(/AppIcon-([\d.]+)@(\d)x\.png/);
      const point = match?.[1];
      const scale = match?.[2];
      const idiom =
        d.size === 1024
          ? "ios-marketing"
          : Number(point) >= 76
            ? "ipad"
            : "iphone";
      images.push({
        filename: d.fileName,
        idiom,
        scale: d.size === 1024 ? "1x" : `${scale}x`,
        size: d.size === 1024 ? "1024x1024" : `${point}x${point}`,
      });
    }
    if (images.length > 0) {
      files.push({
        name: "Contents.json",
        blob: new Blob(
          [
            JSON.stringify(
              { images, info: { author: "xcode", version: 1 } },
              null,
              2
            ),
          ],
          {
            type: "application/json",
          }
        ),
      });
    }
    packs.push({
      id: "ios",
      label: "iOS AppIcon",
      description: "iPhone / iPad 全套图标 + Contents.json",
      files,
    });
  }

  // 4. Android mipmap
  {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === "android")!.defs;
    const files: ZipEntry[] = [];
    for (const d of defs) {
      if (!has("android", d.key) || !d.fileName || !d.size) continue;
      files.push({ name: d.fileName, blob: await toPng(draw(d.size)) });
    }
    packs.push({
      id: "android",
      label: "Android 图标",
      description: "mipmap 各密度图标 + Play 商店图",
      files,
    });
  }

  // 5. Windows UWP
  {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === "windows")!.defs;
    const files: ZipEntry[] = [];
    for (const d of defs) {
      if (!has("windows", d.key) || !d.fileName || !d.size) continue;
      files.push({ name: d.fileName, blob: await toPng(draw(d.size)) });
    }
    packs.push({
      id: "windows",
      label: "Windows UWP",
      description: "Windows 应用商店图标集",
      files,
    });
  }

  // 6. macOS ICNS + iconset
  {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === "macos")!.defs;
    const files: ZipEntry[] = [];
    const images: Record<string, unknown>[] = [];
    for (const d of defs) {
      if (!has("macos", d.key)) continue;
      if (d.key === "icns") continue; // 单独处理
      if (d.fileName && d.size) {
        files.push({ name: d.fileName, blob: await toPng(draw(d.size)) });
        const match = d.fileName.match(/icon_(\d+)x(\d+)(@2x)?\.png/);
        if (match) {
          images.push({
            filename: d.fileName,
            idiom: "mac",
            scale: match[3] ? "2x" : "1x",
            size: `${match[1]}x${match[2]}`,
          });
        }
      }
    }
    if (images.length > 0) {
      files.push({
        name: "Contents.json",
        blob: new Blob(
          [
            JSON.stringify(
              { images, info: { author: "xcode", version: 1 } },
              null,
              2
            ),
          ],
          {
            type: "application/json",
          }
        ),
      });
    }
    packs.push({
      id: "macos",
      label: "macOS 图标",
      description: "ICNS + AppIcon.appiconset 全套",
      files,
      single: has("macos", "icns")
        ? { name: "app-icon.icns", blob: await canvasToIcns(draw(1024)) }
        : undefined,
    });
  }

  return packs;
}

export default function IconPage() {
  const [opts, setOpts] = React.useState<IconOptions>(DEFAULT_OPTIONS);
  const [source, setSource] = React.useState<HTMLCanvasElement | null>(null);
  const [sourceName, setSourceName] = React.useState("");
  const [sourceInfo, setSourceInfo] = React.useState("");
  const [packs, setPacks] = React.useState<PackResult[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  // 每个包的尺寸选择（默认全选）
  const [packSel, setPackSel] = React.useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const p of PACK_SIZE_DEFS) init[p.id] = defaultPackSelection(p.defs);
    return init;
  });

  const patch = (p: Partial<IconOptions>) =>
    setOpts((prev) => ({ ...prev, ...p }));

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const decoded = await decodeImageFile(file);
      setSource(decoded.canvas);
      setSourceName(decoded.name);
      setSourceInfo(`${decoded.width} × ${decoded.height}`);
      setPacks([]);
    } catch {
      toast.error("无法解码该图片");
    } finally {
      setLoading(false);
    }
  };

  const togglePackKey = (pid: string, key: string) => {
    setPackSel((prev) => {
      const cur = prev[pid] ?? [];
      return {
        ...prev,
        [pid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
      };
    });
  };

  const setPackAll = (pid: string, all: boolean) => {
    const defs = PACK_SIZE_DEFS.find((p) => p.id === pid)!.defs;
    setPackSel((prev) => ({
      ...prev,
      [pid]: all ? defs.map((d) => d.key) : [],
    }));
  };

  const handleGenerate = async () => {
    if (!source) return;
    setBusy(true);
    try {
      const result = await buildPacks(source, opts, packSel);
      setPacks(result);
      toast.success("图标生成完成");
    } catch (err) {
      console.error(err);
      toast.error("生成失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const hasContent = (p: PackResult) =>
    p.files.length > 0 || p.single !== undefined;
  const allEntries: { folder: string; pack: PackResult }[] = packs
    .filter(hasContent)
    .map((p) => ({ folder: p.id, pack: p }));

  const handleDownloadAll = async () => {
    const entries: ZipEntry[] = [];
    for (const { folder, pack } of allEntries) {
      if (pack.single) {
        entries.push({
          name: `${folder}/${pack.single.name}`,
          blob: pack.single.blob,
        });
      }
      for (const f of pack.files) {
        entries.push({ name: `${folder}/${f.name}`, blob: f.blob });
      }
    }
    await downloadZip(entries, "app-icons-all.zip");
  };

  return (
    <SidebarInset>
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-5xl space-y-6 p-8">
          <PageHeader
            icon={Stamp}
            title="图标制作"
            description="从一张图片生成全套应用图标：ICO、Favicon、iOS、Android、Windows、macOS"
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            {/* 左：源图 + 选项 */}
            <div className="space-y-4">
              {/* 源图 */}
              <div className="bg-card rounded-lg border p-5">
                <h2 className="text-sm font-medium">源图片</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  建议使用 1024×1024 正方形图片；非正方形将等比缩放并居中
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <label className="border-input bg-background hover:bg-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors">
                    选择图片
                    <input
                      type="file"
                      accept="image/*,.svg,.ico"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {loading && (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  )}
                  {source && !loading && (
                    <div className="text-muted-foreground text-xs">
                      <span className="text-foreground font-medium">
                        {sourceName}
                      </span>{" "}
                      · {sourceInfo}
                    </div>
                  )}
                </div>
                {source && (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="bg-muted h-24 w-24 shrink-0 overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={source.toDataURL("image/png")}
                        alt="源图"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="text-muted-foreground text-xs leading-relaxed">
                      源图：{source.width} × {source.height}
                      <br />
                      将生成：ICO · Favicon · iOS · Android · Windows · macOS
                    </div>
                  </div>
                )}
              </div>

              {/* 选项 */}
              <div className="bg-card space-y-4 rounded-lg border p-5">
                <h2 className="text-sm font-medium">图标选项</h2>

                <div className="space-y-2">
                  <Label>
                    安全边距：
                    <span className="text-primary font-medium">
                      {Math.round(opts.padding * 100)}%
                    </span>
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={Math.round(opts.padding * 100)}
                    onChange={(e) =>
                      patch({ padding: Number(e.target.value) / 100 })
                    }
                    className="accent-foreground w-full"
                  />
                  <div className="text-muted-foreground flex justify-between text-[11px]">
                    <span>贴边</span>
                    <span>iOS 推荐 10%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>背景</Label>
                  <div className="flex gap-2">
                    {(
                      [
                        { v: "transparent", label: "透明" },
                        { v: "white", label: "白色" },
                        { v: "black", label: "黑色" },
                        { v: "color", label: "自定义" },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.v}
                        onClick={() => patch({ background: b.v })}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                          opts.background === b.v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  {opts.background === "color" && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="color"
                        value={opts.bgColor}
                        onChange={(e) => patch({ bgColor: e.target.value })}
                        className="h-8 w-12 cursor-pointer rounded border"
                      />
                      <span className="text-muted-foreground font-mono text-xs">
                        {opts.bgColor}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>
                    圆角：
                    <span className="text-primary font-medium">
                      {Math.round(opts.radius * 100)}%
                    </span>
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={Math.round(opts.radius * 100)}
                    onChange={(e) =>
                      patch({ radius: Number(e.target.value) / 100 })
                    }
                    className="accent-foreground w-full"
                  />
                  <div className="text-muted-foreground flex justify-between text-[11px]">
                    <span>直角</span>
                    <span>iOS 圆角约 22.9%</span>
                  </div>
                </div>
              </div>

              {/* 输出尺寸选择 */}
              {source && (
                <div className="bg-card space-y-4 rounded-lg border p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium">输出尺寸选择</h2>
                    <span className="text-muted-foreground text-xs">
                      {
                        Object.keys(packSel).filter(
                          (pid) => (packSel[pid] ?? []).length > 0
                        ).length
                      }{" "}
                      / {PACK_SIZE_DEFS.length} 个平台
                    </span>
                  </div>
                  <div className="max-h-80 space-y-3 overflow-auto pr-1">
                    {PACK_SIZE_DEFS.map(({ id, defs }) => {
                      const sel = packSel[id] ?? [];
                      const all = sel.length === defs.length;
                      return (
                        <div key={id} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {
                                [
                                  { id: "ico", label: "Windows ICO" },
                                  { id: "favicon", label: "Favicon" },
                                  { id: "ios", label: "iOS AppIcon" },
                                  { id: "android", label: "Android" },
                                  { id: "windows", label: "Windows UWP" },
                                  { id: "macos", label: "macOS" },
                                ].find((p) => p.id === id)?.label
                              }
                            </span>
                            <button
                              onClick={() => setPackAll(id, !all)}
                              className="text-muted-foreground hover:text-primary text-[11px] font-medium"
                            >
                              {all ? "取消全部" : "选全部"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {defs.map((d) => {
                              const on = sel.includes(d.key);
                              return (
                                <label
                                  key={d.key}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors",
                                    on
                                      ? "bg-primary/10 border-primary"
                                      : "bg-background hover:bg-accent"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => togglePackKey(id, d.key)}
                                    className="accent-foreground h-3.5 w-3.5"
                                  />
                                  <span className="truncate">
                                    {d.fileName ??
                                      d.label ??
                                      (d.sizes
                                        ? `ICO ${d.sizes.join("/")}px`
                                        : `${d.size}px`)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!source || busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Stamp className="h-4 w-4" />
                )}
                {busy ? "正在生成…" : "生成所选图标包"}
              </button>
            </div>

            {/* 右：生成结果 */}
            <div className="space-y-4">
              {packs.length === 0 ? (
                <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center text-xs">
                  选择源图片并点击「生成全部图标包」，
                  <br />
                  这里将展示各平台图标包的下载入口
                </div>
              ) : (
                <>
                  <div className="bg-card space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground text-xs font-medium">
                        预览
                      </div>
                      <button
                        onClick={handleDownloadAll}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors"
                      >
                        <FolderDown className="h-3.5 w-3.5" />
                        下载全部（ZIP）
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {[16, 32, 64, 128, 256, 512, 1024].map((size) => (
                        <div
                          key={size}
                          className="flex flex-col items-center gap-1"
                        >
                          <div className="bg-muted overflow-hidden rounded border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={drawAppIcon(source!, size, opts).toDataURL(
                                "image/png"
                              )}
                              alt={`${size}px`}
                              style={{
                                width: Math.min(size, 96),
                                height: Math.min(size, 96),
                              }}
                              className="object-contain"
                            />
                          </div>
                          <span className="text-muted-foreground text-[10px]">
                            {size}px
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {allEntries.map(({ pack }) => (
                      <div
                        key={pack.id}
                        className="bg-card flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium">
                            {pack.label}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {pack.description}
                          </div>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {pack.single && (
                            <button
                              onClick={() =>
                                downloadBlob(
                                  pack.single!.blob,
                                  pack.single!.name
                                )
                              }
                              className="border-input bg-background hover:bg-accent inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors"
                            >
                              下载 {pack.single.name}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const entries =
                                pack.single && pack.files.length === 0
                                  ? [
                                      {
                                        name: pack.single.name,
                                        blob: pack.single.blob,
                                      },
                                    ]
                                  : pack.files;
                              await downloadZip(entries, `${pack.label}.zip`);
                            }}
                            disabled={pack.files.length === 0 && !pack.single}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-40"
                          >
                            ZIP（{pack.files.length + (pack.single ? 1 : 0)}）
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    合计{" "}
                    {allEntries.reduce(
                      (s, e) =>
                        s + e.pack.files.length + (e.pack.single ? 1 : 0),
                      0
                    )}{" "}
                    个文件
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
