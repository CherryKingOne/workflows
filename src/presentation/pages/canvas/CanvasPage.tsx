"use client";

import { CanvasBoard } from './components/CanvasBoard';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { ModelConfigInitializer } from '@/src/application/aiModel/ModelConfigInitializer';
import { useEffect, useState } from 'react';

/**
 * Canvas 页面组件 (使用 Hash 路由)
 *
 * 从 URL hash 参数中获取 projectId，加载项目数据并渲染画布。
 * 支持静态导出 (output: 'export')。
 *
 * URL 格式: #/canvas?projectId=xxx
 */
export function CanvasPage() {
  const { project, isLoading: isProjectLoading, error } = useProjectDetail();
  const [isModelConfigReady, setIsModelConfigReady] = useState(false);
  const [modelConfigInitError, setModelConfigInitError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initializeModelConfigs = async () => {
      try {
        await ModelConfigInitializer.initialize();
        if (!cancelled) {
          setIsModelConfigReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setModelConfigInitError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    initializeModelConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

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

  if (modelConfigInitError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-2 text-red-500">模型配置初始化失败</h2>
          <p className="text-zinc-500">{modelConfigInitError.message}</p>
        </div>
      </div>
    );
  }

  if (isProjectLoading || !isModelConfigReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400">正在初始化画布...</p>
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
