"use client";

import { CanvasBoard } from './components/CanvasBoard';
import { useProjectDetail } from '../../hooks/useProjectDetail';

/**
 * Canvas 页面组件 (使用 Hash 路由)
 *
 * 从 URL hash 参数中获取 projectId，加载项目数据并渲染画布。
 * 支持静态导出 (output: 'export')。
 *
 * URL 格式: #/canvas?projectId=xxx
 */
export function CanvasPage() {
  const { project, error } = useProjectDetail();

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-2 text-red-500">无法加载项目</h2>
          <p className="text-zinc-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white">
      <CanvasBoard project={project} />
    </main>
  );
}
