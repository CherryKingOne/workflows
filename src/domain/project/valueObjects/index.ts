export class ProjectId {
  constructor(public readonly value: string) {}
}

export class ProjectMeta {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
