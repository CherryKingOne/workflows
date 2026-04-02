export class NodeId {
  constructor(public readonly value: string) {}
}

export class NodePosition {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number = 1
  ) {}
}

export class NodeContent {
  constructor(
    public readonly type: 'image' | 'text' | 'video',
    public readonly data: Record<string, unknown>
  ) {}
}
