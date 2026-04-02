import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../../domain/project/valueObjects';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

interface ProjectDto {
  id: { value: string };
  meta: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

export class TauriProjectRepository implements IProjectRepository {
  async save(_project: Project): Promise<void> {
    throw new Error('Not implemented: we will directly call specific commands from frontend.');
  }

  async findById(_id: ProjectId): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async findAll(): Promise<Project[]> {
    try {
      const projectsData = await invoke<ProjectDto[]>('get_projects');
      
      return projectsData.map(p => new Project(
        new ProjectId(p.id.value),
        new ProjectMeta(
          p.meta.name,
          p.meta.description,
          new Date(p.meta.createdAt),
          new Date(p.meta.updatedAt)
        )
      ));
    } catch (e) {
      console.error("Failed to fetch projects from Tauri backend:", e);
      return [];
    }
  }

  async delete(id: ProjectId): Promise<void> {
    await invoke('delete_project', { id: id.value });
  }
}
