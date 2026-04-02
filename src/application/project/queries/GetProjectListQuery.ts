import { Project } from '../../../domain/project/entities/Project';
import { IProjectRepository } from '../../../domain/project/repositories/IProjectRepository';

export class GetProjectListQuery {
  constructor(private projectRepo: IProjectRepository) {}

  async execute(): Promise<Project[]> {
    return await this.projectRepo.findAll();
  }
}
