import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../domain/project/valueObjects';
import { useHashRouter } from '../components/common/HashRouter';

interface ProjectDto {
  id: { value: string };
  meta: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * 从 URL hash 参数中获取 projectId
 * URL 格式: #/canvas?projectId=xxx
 */
function getProjectIdFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/[?&]projectId=([^&]+)/);
  return match ? match[1] : null;
}

/**
 * 获取项目详情 Hook
 *
 * 支持两种模式:
 * 1. 不传参数: 从 URL hash 参数中自动获取 projectId
 * 2. 传入 projectId: 直接使用传入的 projectId
 *
 * Hash 路由格式: #/canvas?projectId=xxx
 */
export function useProjectDetail(projectId?: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 获取 hash 路由上下文，监听路由变化
  const { route } = useHashRouter();

  // 确定实际使用的 projectId
  const effectiveProjectId = projectId ?? route?.params?.projectId ?? null;

  const fetchProject = useCallback(async () => {
    if (!effectiveProjectId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await invoke<ProjectDto[]>('get_projects');
      const found = data.find(p => p.id.value === effectiveProjectId);

      if (found) {
        setProject(new Project(
          new ProjectId(found.id.value),
          new ProjectMeta(
            found.meta.name,
            found.meta.description,
            new Date(found.meta.createdAt),
            new Date(found.meta.updatedAt)
          )
        ));
      } else {
        throw new Error('Project not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProjectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, isLoading, error };
}
