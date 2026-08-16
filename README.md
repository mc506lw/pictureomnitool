# 全能图片工具（Picture Omni Tool）

一站式图片处理网站，全部处理在浏览器本地完成，图片不会上传到任何服务器。

## 功能

| 工具       | 说明                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 格式转换   | PNG / JPEG / WebP / AVIF / BMP / GIF / ICO 任意互转，支持批量、质量调节、背景色填充                 |
| 图片缩放   | 百分比 / 固定宽高 / 适应盒子 / 精确尺寸，四种插值算法（最近邻 / 双线性 / 双三次 / Lanczos-3）       |
| 图片裁剪   | 自由裁剪、比例裁剪（1:1 / 4:3 / 16:9 / 证件照等）、圆形裁剪，可批量应用同一选区                     |
| 图片压缩   | 质量压缩、指定目标大小自动调节，压缩前后体积对比                                                    |
| 批量重命名 | 模板化命名（序号 / 日期 / 随机 / 查找替换），实时预览，打包下载                                     |
| 尺寸预设   | 社交平台 / 电商 / 壁纸 / 打印 / 应用图标等 8 大场景预设包，多尺寸批量输出                           |
| 图标制作   | Windows ICO、Favicon 全套、iOS AppIcon（含 Contents.json）、Android mipmap、Windows UWP、macOS ICNS |

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui（new-york 风格，neutral 色板）
- Zustand（状态管理）、lucide-react（图标）、sonner（提示）、JSZip（打包导出）
- 自研图像引擎：可分离卷积缩放（预乘 Alpha）、中位切分 GIF 量化 + LZW、BMP / ICO / ICNS 编码器

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器 http://localhost:3000
pnpm build      # 生产构建
pnpm type-check # 类型检查
pnpm test:gif   # GIF 编解码器自校验（含 omggif / sharp 交叉验证）
```

## 隐私

所有图片均在浏览器端处理（Canvas API），无任何网络请求上传图片。
