import { Node, Edge, Position } from '../types';
import { ANNOTATION_OFFSET, ANGLE_ANNOTATION_OFFSET } from '../config';

/**
 * 标注布局引擎
 * 计算标注节点的正确位置
 */
export class AnnotationLayoutEngine {
  private annotationOffset = ANNOTATION_OFFSET;

  calculateAnnotationPosition(
    annotation: Node,
    basePositions: Map<string, Position>,
    _nodes: Node[],
    _edges: Edge[]
  ): { position: Position; targetPosition: Position } | null {
    if (!annotation.target) {
      return null;
    }

    const { type, nodeId, edgeId, angleNodes, position } = annotation.target;

    switch (type) {
      case 'node':
        return this.calculateNodeAnnotationPosition(
          annotation,
          nodeId!,
          position || 'top',
          basePositions
        );

      case 'edge':
        return this.calculateEdgeAnnotationPosition(
          annotation,
          edgeId!,
          position || 'top',
          basePositions
        );

      case 'angle':
        return this.calculateAngleAnnotationPosition(
          annotation,
          angleNodes!,
          position || 'auto',
          basePositions
        );

      default:
        return null;
    }
  }

  private calculateNodeAnnotationPosition(
    _annotation: Node,
    targetNodeId: string,
    position: string,
    basePositions: Map<string, Position>
  ): { position: Position; targetPosition: Position } | null {
    const targetPos = basePositions.get(targetNodeId);
    if (!targetPos) return null;

    const annotationPos = this.getOffsetPosition(targetPos, position);

    return {
      position: annotationPos,
      targetPosition: targetPos
    };
  }

  private calculateEdgeAnnotationPosition(
    _annotation: Node,
    edgeId: string,
    position: string,
    basePositions: Map<string, Position>
  ): { position: Position; targetPosition: Position } | null {
    // 防御性检查：确保 edgeId 格式正确
    if (!edgeId || !edgeId.includes('-')) return null;

    const [fromId, toId] = edgeId.split('-');
    if (!fromId || !toId) return null;

    const fromPos = basePositions.get(fromId);
    const toPos = basePositions.get(toId);

    if (!fromPos || !toPos) return null;

    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;

    const targetPos = { x: midX, y: midY };
    const annotationPos = this.getOffsetPosition(targetPos, position);

    return {
      position: annotationPos,
      targetPosition: targetPos
    };
  }

  private calculateAngleAnnotationPosition(
    _annotation: Node,
    angleNodes: string[],
    position: string,
    basePositions: Map<string, Position>
  ): { position: Position; targetPosition: Position } | null {
    // 防御性检查
    if (!angleNodes || angleNodes.length !== 3) return null;

    const nodeA = basePositions.get(angleNodes[0]);
    const vertex = basePositions.get(angleNodes[1]);
    const nodeC = basePositions.get(angleNodes[2]);

    if (!nodeA || !vertex || !nodeC) return null;

    const targetPos = vertex;

    const annotationPos = this.calculateAngleAnnotationOffset(
      nodeA, vertex, nodeC, position
    );

    return {
      position: annotationPos,
      targetPosition: targetPos
    };
  }

  private calculateAngleAnnotationOffset(
    nodeA: Position,
    vertex: Position,
    nodeC: Position,
    position: string
  ): Position {
    // 防御性检查
    if (!nodeA || !vertex || !nodeC) {
      return { x: 0, y: 0 };
    }

    const angleA = Math.atan2(nodeA.y - vertex.y, nodeA.x - vertex.x);
    const angleC = Math.atan2(nodeC.y - vertex.y, nodeC.x - vertex.x);

    let bisectorAngle: number;
    if (position === 'auto') {
      bisectorAngle = (angleA + angleC) / 2;
    } else {
      bisectorAngle = this.positionToAngle(position);
    }

    const offset = ANGLE_ANNOTATION_OFFSET;
    return {
      x: vertex.x + offset * Math.cos(bisectorAngle),
      y: vertex.y + offset * Math.sin(bisectorAngle)
    };
  }

  private getOffsetPosition(targetPos: Position, position: string): Position {
    const offset = this.annotationOffset;

    // 防御性检查
    if (!targetPos) {
      return { x: 0, y: 0 };
    }

    switch (position) {
      case 'top':
        return { x: targetPos.x, y: targetPos.y - offset };
      case 'bottom':
        return { x: targetPos.x, y: targetPos.y + offset };
      case 'left':
        return { x: targetPos.x - offset, y: targetPos.y };
      case 'right':
        return { x: targetPos.x + offset, y: targetPos.y };
      case 'auto':
      default:
        return { x: targetPos.x, y: targetPos.y - offset };
    }
  }

  private positionToAngle(position: string): number {
    switch (position) {
      case 'top':
        return -Math.PI / 2;
      case 'bottom':
        return Math.PI / 2;
      case 'left':
        return Math.PI;
      case 'right':
        return 0;
      default:
        return -Math.PI / 2;
    }
  }

  processAnnotations(
    nodes: Node[],
    basePositions: Map<string, Position>,
    edges: Edge[]
  ): Map<string, { position: Position; targetPosition: Position }> {
    const result = new Map<string, { position: Position; targetPosition: Position }>();

    // 防御性检查
    if (!nodes || !Array.isArray(nodes)) {
      return result;
    }

    nodes
      .filter(node => node && node.type === 'annotation' && node.target)
      .forEach(annotation => {
        const calculated = this.calculateAnnotationPosition(
          annotation,
          basePositions,
          nodes,
          edges
        );
        if (calculated) {
          result.set(annotation.id, calculated);
        }
      });

    return result;
  }
}