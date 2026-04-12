import { Node, Edge, Position } from '../types';

const CENTER_X = 400;
const CENTER_Y = 250;

export interface ELKLayoutOptions {
  algorithm?: 'layered' | 'force' | 'stress';
  spacing?: number;
  nodeGap?: number;
  layerGap?: number;
}

const DEFAULT_OPTIONS: ELKLayoutOptions = {
  algorithm: 'layered',
  spacing: 50,
  nodeGap: 40,
  layerGap: 80
};

export class ELKLayoutEngine {
  private options: ELKLayoutOptions;

  constructor(options: ELKLayoutOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async layout(nodes: Node[], edges: Edge[]): Promise<Map<string, Position>> {
    if (!nodes || nodes.length === 0) {
      console.log('[ELKLayout] No nodes, returning empty map');
      return new Map<string, Position>();
    }

    console.log('[ELKLayout] Starting layout for', nodes.length, 'nodes,', edges.length, 'edges');

    try {
      let result: Map<string, Position>;
      switch (this.options.algorithm) {
        case 'force':
          result = this.forceLayout(nodes, edges);
          break;
        case 'stress':
          result = this.stressLayout(nodes, edges);
          break;
        case 'layered':
        default:
          result = this.layeredLayout(nodes, edges);
      }
      console.log('[ELKLayout] Layout complete, positions:', result.size);
      return result;
    } catch (error) {
      console.error('[ELKLayout] Layout error:', error);
      return new Map<string, Position>();
    }
  }

  private layeredLayout(nodes: Node[], edges: Edge[]): Map<string, Position> {
    console.log('[ELKLayout] Using layered layout');
    const positions = new Map<string, Position>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const levels = this.assignLevels(nodes, edges, nodeMap);
    console.log('[ELKLayout] Levels assigned:', levels.size);

    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    });
    console.log('[ELKLayout] Level groups:', levelGroups.size);

    const levelGap = this.options.layerGap || 80;
    const nodeGap = this.options.nodeGap || 40;

    const totalLevels = levelGroups.size;
    const totalHeight = (totalLevels - 1) * levelGap;
    const startY = CENTER_Y - totalHeight / 2;

    levelGroups.forEach((nodeIds, level) => {
      const y = startY + level * levelGap;
      const totalWidth = nodeIds.length * 120 + (nodeIds.length - 1) * nodeGap;
      let startX = CENTER_X - totalWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * (120 + nodeGap);
        positions.set(nodeId, { x, y });
      });
    });

    return positions;
  }

  private assignLevels(
    nodes: Node[],
    edges: Edge[],
    nodeMap: Map<string, Node>
  ): Map<string, number> {
    console.log('[ELKLayout] assignLevels: nodes=', nodes.length, 'edges=', edges.length);
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const visited = new Set<string>();

    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    });

    const roots = nodes.filter(n => inDegree.get(n.id) === 0);
    console.log('[ELKLayout] Roots found:', roots.length);
    roots.forEach(r => levels.set(r.id, 0));

    const queue = [...roots];
    let iterations = 0;
    const maxIterations = nodes.length * 2;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;

      if (visited.has(current.id)) continue;
      visited.add(current.id);

      const currentLevel = levels.get(current.id) || 0;

      edges
        .filter(e => e.from === current.id)
        .forEach(e => {
          const targetNode = nodeMap.get(e.to);
          if (!targetNode) return;

          const newLevel = currentLevel + 1;
          if (!levels.has(e.to) || levels.get(e.to)! < newLevel) {
            levels.set(e.to, newLevel);
          }
          if (!visited.has(e.to) && !queue.find(n => n.id === e.to)) {
            queue.push(targetNode);
          }
        });
    }
    console.log('[ELKLayout] assignLevels iterations:', iterations, 'levels size:', levels.size);

    nodes.forEach(n => {
      if (!levels.has(n.id)) {
        levels.set(n.id, 0);
      }
    });

    return levels;
  }

  private forceLayout(nodes: Node[], _edges: Edge[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const spacing = this.options.spacing || 50;

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = nodes.length * spacing * 0.4;
      positions.set(node.id, {
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius
      });
    });

    return positions;
  }

  private stressLayout(nodes: Node[], _edges: Edge[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spacing = this.options.spacing || 50;

    const offsetX = CENTER_X - (cols * spacing) / 2;
    const offsetY = CENTER_Y - (Math.ceil(nodes.length / cols) * spacing) / 2;

    nodes.forEach((node, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      positions.set(node.id, {
        x: offsetX + col * spacing,
        y: offsetY + row * spacing
      });
    });

    return positions;
  }
}

export const elkLayoutEngine = new ELKLayoutEngine();
