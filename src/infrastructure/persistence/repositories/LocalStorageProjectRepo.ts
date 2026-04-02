import { Project } from '../../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../../domain/project/valueObjects';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

export class LocalStorageProjectRepository implements IProjectRepository {
  private readonly STORAGE_KEY = 'workflow_projects';

  async save(project: Project): Promise<void> {
    const projects = await this.findAll();
    const index = projects.findIndex(p => p.id.value === project.id.value);
    
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    
    this.saveToStorage(projects);
  }

  async findById(id: ProjectId): Promise<Project | null> {
    const projects = await this.findAll();
    return projects.find(p => p.id.value === id.value) || null;
  }

  async findAll(): Promise<Project[]> {
    if (typeof window === 'undefined') return [];
    
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];
    
    try {
      const parsed = JSON.parse(data);
      return parsed.map((p: {
        id: { value: string };
        meta: { name: string; description: string; createdAt: string; updatedAt: string };
      }) => new Project(
        new ProjectId(p.id.value),
        new ProjectMeta(
          p.meta.name,
          p.meta.description,
          new Date(p.meta.createdAt),
          new Date(p.meta.updatedAt)
        )
      ));
    } catch {
      return [];
    }
  }

  async delete(id: ProjectId): Promise<void> {
    const projects = await this.findAll();
    const filtered = projects.filter(p => p.id.value !== id.value);
    this.saveToStorage(filtered);
  }

  private saveToStorage(projects: Project[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    }
  }
}
