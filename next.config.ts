import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // 生产环境静态导出（用于 GitHub Pages）
  ...(isProd && { output: "export" }),

  // GitHub Pages 子路径部署
  basePath: isProd ? "/pictureomnitool" : "",

  // GitHub Pages 不支持图片优化
  images: {
    unoptimized: true,
  },

  reactStrictMode: true,
};

export default nextConfig;
