import { ProjectId, ProjectMeta } from '../valueObjects';

export class Project {
  constructor(
    public readonly id: ProjectId,
    public meta: ProjectMeta
  ) {}

  updateMeta(name: string, description: string) {
    this.meta = new ProjectMeta(name, description, this.meta.createdAt, new Date());
  }
}
