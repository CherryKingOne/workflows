"use client";

import { HashRouterProvider, HashRoutes, useHashRouter } from '../src/presentation/components/common/HashRouter';
import { ProjectList } from '../src/presentation/pages/projects/components/ProjectList';
import { CanvasPage } from '../src/presentation/pages/canvas/CanvasPage';
import { useEffect } from 'react';

/**
 * 默认页面 - 显示项目列表并自动设置 hash
 */
function DefaultPage() {
  const { navigateToProjects, route } = useHashRouter();

  useEffect(() => {
    // 如果没有路由，自动导航到项目列表
    if (!route) {
      navigateToProjects();
    }
  }, [navigateToProjects, route]);

  // 直接渲染项目列表，避免空白闪烁
  return (
    <main className="flex-1 flex flex-col min-h-screen bg-black text-white">
      <ProjectList />
    </main>
  );
}

/**
 * 主应用入口
 *
 * 使用 Hash 路由处理所有页面导航，支持静态导出。
 *
 * 路由格式:
 * - #/projects - 项目列表页
 * - #/canvas?projectId=xxx - 画布编辑页
 */
export default function Home() {
  return (
    <HashRouterProvider>
      <HashRoutes
        routes={{
          projects: (
            <main className="flex-1 flex flex-col min-h-screen bg-black text-white">
              <ProjectList />
            </main>
          ),
          canvas: <CanvasPage />,
        }}
        fallback={<DefaultPage />}
      />
    </HashRouterProvider>
  );
}
