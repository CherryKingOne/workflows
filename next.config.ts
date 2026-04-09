import type { NextConfig } from "next";

/**
 * Next.js 配置
 *
 * output: 'export' - 启用静态导出模式，用于 Tauri 桌面应用打包
 *
 * 注意:
 * 使用 hash 路由 (#/projects, #/canvas?projectId=xxx) 来实现客户端路由，
 * 避免动态路由在静态导出时的问题。
 */
const nextConfig: NextConfig = {
  output: 'export',
};

export default nextConfig;
