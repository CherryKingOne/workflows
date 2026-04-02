import { NodeId, NodePosition, NodeContent } from '../valueObjects';
import { ProjectId } from '../../project/valueObjects';

export class CanvasNode {
  constructor(
    public readonly id: NodeId,
    public readonly projectId: ProjectId,
    public position: NodePosition,
    public content: NodeContent,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  updatePosition(newPosition: NodePosition) {
    this.position = newPosition;
    this.updatedAt = new Date();
  }

  updateContent(newContent: NodeContent) {
    this.content = newContent;
    this.updatedAt = new Date();
  }
}
