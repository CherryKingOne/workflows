import { Project } from '../../../domain/project/entities/Project';
import { ProjectId } from '../../../domain/project/valueObjects';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

export class UpdateProjectCommand {
  constructor(private projectRepo: IProjectRepository) {}

  async execute(id: string, name: string, description: string): Promise<Project> {
    const projectId = new ProjectId(id);
    const project = await this.projectRepo.findById(projectId);
    
    if (!project) {
      throw new Error(`Project with ID ${id} not found`);
    }

    project.updateMeta(name, description);
    await this.projectRepo.save(project);
    
    return project;
  }
}
