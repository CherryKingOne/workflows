import { Project } from '../entities/Project';
import { ProjectId } from '../valueObjects';

export interface IProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: ProjectId): Promise<Project | null>;
  findAll(): Promise<Project[]>;
  delete(id: ProjectId): Promise<void>;
}
