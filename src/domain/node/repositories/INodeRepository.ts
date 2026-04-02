import { CanvasNode } from '../entities/Node';
import { NodeId } from '../valueObjects';
import { ProjectId } from '../../project/valueObjects';

export interface INodeRepository {
  save(node: CanvasNode): Promise<void>;
  findByProjectId(projectId: ProjectId): Promise<CanvasNode[]>;
  findById(id: NodeId): Promise<CanvasNode | null>;
  delete(id: NodeId): Promise<void>;
}
