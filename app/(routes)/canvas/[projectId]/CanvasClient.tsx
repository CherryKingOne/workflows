"use client";

import { use } from 'react';
import { CanvasBoard } from '../../../../src/presentation/pages/canvas/components/CanvasBoard';
import { useProjectDetail } from '../../../../src/presentation/hooks/useProjectDetail';

/**
 * Canvas 页面客户端组件
 *
 * 负责处理客户端逻辑：解析 params、获取项目数据、渲染画布
 * 与服务端入口分离，以便支持静态导出
 */
export function CanvasClient({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = use(params);
  const { project, error } = useProjectDetail(resolvedParams.projectId);

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
