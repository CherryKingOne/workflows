import { ProjectId } from '../../../domain/project/valueObjects';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

export class DeleteProjectCommand {
  constructor(private projectRepo: IProjectRepository) {}

  async execute(id: string): Promise<void> {
    const projectId = new ProjectId(id);
    await this.projectRepo.delete(projectId);
  }
}
