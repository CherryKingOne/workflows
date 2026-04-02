import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../domain/project/valueObjects';

interface ProjectDto {
  id: { value: string };
  meta: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setIsLoading(true);
      const data = await invoke<ProjectDto[]>('get_projects');
      const found = data.find(p => p.id.value === projectId);
      
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
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, isLoading, error };
}
