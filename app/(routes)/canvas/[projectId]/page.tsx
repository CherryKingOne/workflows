"use client";

import { use } from 'react';
import { CanvasBoard } from '../../../../src/presentation/pages/canvas/components/CanvasBoard';
import { useProjectDetail } from '../../../../src/presentation/hooks/useProjectDetail';

export default function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
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
