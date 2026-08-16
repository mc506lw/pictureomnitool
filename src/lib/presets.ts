/**
 * 尺寸预设包
 * 覆盖社交平台、电商、壁纸、打印、应用图标等常用场景
 */

export interface SizePreset {
  name: string;
  width: number;
  height: number;
  /** 适用场景说明 */
  note?: string;
}

export interface PresetPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  presets: SizePreset[];
}

export const PRESET_PACKS: PresetPack[] = [
  {
    id: "social-avatar",
    name: "社交平台头像",
    description: "各大平台头像与封面图标准尺寸",
    icon: "👤",
    presets: [
      { name: "微信头像", width: 400, height: 400 },
      { name: "QQ 头像", width: 400, height: 400 },
      { name: "微博头像", width: 400, height: 400 },
      { name: "抖音头像", width: 300, height: 300 },
      { name: "B站头像", width: 400, height: 400 },
      { name: "知乎头像", width: 200, height: 200 },
      { name: "微信公众号封面", width: 900, height: 383 },
      { name: "朋友圈封面", width: 1080, height: 1920 },
      { name: "抖音视频封面", width: 1080, height: 1920 },
      { name: "B站视频封面", width: 1146, height: 717 },
    ],
  },
  {
    id: "ecommerce",
    name: "电商图片",
    description: "淘宝 / 京东 / 拼多多等平台商品图",
    icon: "🛒",
    presets: [
      { name: "淘宝主图", width: 800, height: 800 },
      { name: "淘宝白底图", width: 800, height: 800 },
      { name: "淘宝详情页", width: 750, height: 750 },
      { name: "京东主图", width: 800, height: 800 },
      { name: "京东详情页", width: 790, height: 790 },
      { name: "拼多多主图", width: 750, height: 750 },
      { name: "拼多多详情页", width: 750, height: 750 },
      { name: "小红书封面", width: 1080, height: 1440 },
      { name: "闲鱼主图", width: 800, height: 800 },
    ],
  },
  {
    id: "phone-wallpaper",
    name: "手机壁纸",
    description: "主流手机分辨率壁纸与锁屏",
    icon: "📱",
    presets: [
      { name: "iPhone 8/SE 壁纸", width: 750, height: 1334 },
      { name: "iPhone X~14 壁纸", width: 1170, height: 2532 },
      { name: "iPhone 15 Pro 壁纸", width: 1206, height: 2622 },
      { name: "安卓 1080P 壁纸", width: 1080, height: 1920 },
      { name: "安卓 2K 壁纸", width: 1440, height: 2560 },
      { name: "安卓 4K 壁纸", width: 2160, height: 3840 },
      { name: "华为折叠屏", width: 1768, height: 2208 },
      { name: "iPad 壁纸", width: 2048, height: 2732 },
    ],
  },
  {
    id: "desktop-wallpaper",
    name: "电脑壁纸",
    description: "显示器与笔记本常见分辨率",
    icon: "🖥️",
    presets: [
      { name: "HD 壁纸", width: 1920, height: 1080 },
      { name: "2K 壁纸", width: 2560, height: 1440 },
      { name: "4K 壁纸", width: 3840, height: 2160 },
      { name: "5K 壁纸", width: 5120, height: 2880 },
      { name: "MacBook Air 壁纸", width: 2560, height: 1664 },
      { name: "MacBook Pro 壁纸", width: 3024, height: 1964 },
      { name: "21:9 超宽屏", width: 3440, height: 1440 },
      { name: "三屏拼接", width: 5760, height: 1080 },
    ],
  },
  {
    id: "print",
    name: "打印输出",
    description: "按 300 DPI 计算的打印尺寸（像素）",
    icon: "🖨️",
    presets: [
      { name: "1 寸证件照", width: 295, height: 413 },
      { name: "2 寸证件照", width: 413, height: 579 },
      { name: "5 寸照片", width: 1500, height: 2100 },
      { name: "6 寸照片", width: 1800, height: 1200 },
      { name: "7 寸照片", width: 2100, height: 1500 },
      { name: "A4 纸（300DPI）", width: 2480, height: 3508 },
      { name: "A5 纸（300DPI）", width: 1748, height: 2480 },
      { name: "明信片", width: 1800, height: 1200 },
    ],
  },
  {
    id: "app-icon",
    name: "应用图标",
    description: "各类应用商店与系统图标",
    icon: "🪪",
    presets: [
      { name: "App Store 图标", width: 1024, height: 1024 },
      { name: "Android 图标", width: 512, height: 512 },
      { name: "华为应用市场", width: 216, height: 216 },
      { name: "小米应用商店", width: 216, height: 216 },
      { name: "OPPO 软件商店", width: 216, height: 216 },
      { name: "vivo 应用商店", width: 216, height: 216 },
      { name: "Windows 图标", width: 256, height: 256 },
      { name: "macOS 图标", width: 512, height: 512 },
    ],
  },
  {
    id: "logo-usage",
    name: "Logo 应用",
    description: "Logo 在各场景的标准使用尺寸",
    icon: "🏷️",
    presets: [
      { name: "网站导航栏 Logo", width: 120, height: 40 },
      { name: "网页页脚 Logo", width: 200, height: 60 },
      { name: "水印 Logo", width: 300, height: 300 },
      { name: "PPT 封面 Logo", width: 600, height: 200 },
      { name: "名片 Logo", width: 400, height: 400 },
      { name: "宣传海报 Logo", width: 800, height: 800 },
      { name: "邮件签名 Logo", width: 320, height: 80 },
      { name: "展会易拉宝 Logo", width: 1000, height: 1000 },
    ],
  },
  {
    id: "game",
    name: "游戏素材",
    description: "游戏开发常用素材尺寸",
    icon: "🎮",
    presets: [
      { name: "Steam 宣传图", width: 460, height: 215 },
      { name: "Steam 库封面", width: 600, height: 900 },
      { name: "Steam 大图", width: 3840, height: 1240 },
      { name: "TapTap 图标", width: 512, height: 512 },
      { name: "TapTap 宣传图", width: 750, height: 750 },
      { name: "itch.io 封面", width: 630, height: 500 },
      { name: "游戏横幅", width: 1920, height: 1080 },
      { name: "直播封面", width: 1280, height: 720 },
    ],
  },
];

/** 按 id 查找预设包 */
export function getPresetPack(id: string): PresetPack | undefined {
  return PRESET_PACKS.find((p) => p.id === id);
}
