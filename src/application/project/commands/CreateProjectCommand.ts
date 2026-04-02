import { Project } from '../../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../../domain/project/valueObjects';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

export class CreateProjectCommand {
  constructor(private projectRepo: IProjectRepository) {}

  async execute(id: string, name: string, description: string): Promise<Project> {
    const projectId = new ProjectId(id);
    const meta = new ProjectMeta(name, description, new Date(), new Date());
    const project = new Project(projectId, meta);
    
    await this.projectRepo.save(project);
    return project;
  }
}
