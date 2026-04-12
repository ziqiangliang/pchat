import { Node, Edge, Position } from '../types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LAYOUT_OPTIMIZER_ENABLED,
  LAYOUT_MIN_NODE_DISTANCE,
  LAYOUT_NODE_BOUNDARY_PADDING,
  LAYOUT_MAX_ITERATIONS,
  NODE_MIN_WIDTH,
  NODE_MIN_HEIGHT,
  DEFAULT_NODE_RADIUS
} from '../config';

export interface OptimizerConfig {
  enabled: boolean;
  minNodeDistance: number;
  boundaryPadding: number;
  maxIterations: number;
}

const DEFAULT_CONFIG: OptimizerConfig = {
  enabled: LAYOUT_OPTIMIZER_ENABLED,
  minNodeDistance: LAYOUT_MIN_NODE_DISTANCE,
  boundaryPadding: LAYOUT_NODE_BOUNDARY_PADDING,
  maxIterations: LAYOUT_MAX_ITERATIONS
};

export class LayoutOptimizer {
  private config: OptimizerConfig;

  constructor(config: Partial<OptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  optimize(nodes: Node[], _edges: Edge[]): Map<string, Position> {
    if (!this.config.enabled || nodes.length === 0) {
      return this.extractOriginalPositions(nodes);
    }

    const positions = new Map<string, Position>();

    nodes.forEach(node => {
      positions.set(node.id, this.constrainToBounds(node));
    });

    this.resolveCollisions(positions, nodes);

    return positions;
  }

  private extractOriginalPositions(nodes: Node[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    nodes.forEach(node => {
      positions.set(node.id, {
        x: node.x ?? CANVAS_WIDTH / 2,
        y: node.y ?? CANVAS_HEIGHT / 2
      });
    });
    return positions;
  }

  private constrainToBounds(node: Node): Position {
    const padding = this.config.boundaryPadding;
    let x = node.x ?? CANVAS_WIDTH / 2;
    let y = node.y ?? CANVAS_HEIGHT / 2;

    const nodeWidth = this.getNodeWidth(node);
    const nodeHeight = this.getNodeHeight(node);

    const minX = padding + nodeWidth / 2;
    const maxX = CANVAS_WIDTH - padding - nodeWidth / 2;
    const minY = padding + nodeHeight / 2;
    const maxY = CANVAS_HEIGHT - padding - nodeHeight / 2;

    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(minY, Math.min(y, maxY));

    return { x, y };
  }

  private resolveCollisions(positions: Map<string, Position>, nodes: Node[]): void {
    const minDist = this.config.minNodeDistance;

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      let hasCollision = false;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const posA = positions.get(nodes[i].id)!;
          const posB = positions.get(nodes[j].id)!;

          const distance = this.getDistance(posA, posB);

          if (distance < minDist && distance > 0.001) {
            hasCollision = true;

            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const pushDist = (minDist - distance) / 2;
            const ratio = pushDist / distance;

            positions.set(nodes[i].id, {
              x: posA.x - dx * ratio,
              y: posA.y - dy * ratio
            });
            positions.set(nodes[j].id, {
              x: posB.x + dx * ratio,
              y: posB.y + dy * ratio
            });
          }
        }
      }

      nodes.forEach(node => {
        const pos = positions.get(node.id)!;
        const constrained = this.constrainToBounds({ ...node, x: pos.x, y: pos.y });
        positions.set(node.id, constrained);
      });

      if (!hasCollision) break;
    }
  }

  private getDistance(a: Position, b: Position): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private getNodeWidth(node: Node): number {
    if (node.size?.width) return node.size.width;
    if (node.size?.radius) return node.size.radius * 2;
    if (node.type === 'vertex' || node.type === 'dataPoint' || node.type === 'event') {
      return DEFAULT_NODE_RADIUS * 2;
    }
    return NODE_MIN_WIDTH;
  }

  private getNodeHeight(node: Node): number {
    if (node.size?.height) return node.size.height;
    if (node.size?.radius) return node.size.radius * 2;
    if (node.type === 'vertex' || node.type === 'dataPoint' || node.type === 'event') {
      return DEFAULT_NODE_RADIUS * 2;
    }
    return NODE_MIN_HEIGHT;
  }
}

export const layoutOptimizer = new LayoutOptimizer();
