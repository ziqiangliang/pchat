import { Node, Edge, LayoutHints, Position, Constraint } from './types';
import {
  CENTER_X,
  CENTER_Y,
  DEFAULT_START_X,
  DEFAULT_SPACING,
  HORIZONTAL_SPACING,
  VERTICAL_SPACING,
  GEOMETRY_SQUARE,
  GEOMETRY_TRIANGLE,
  GEOMETRY_CIRCLE,
  NETWORK_RADIUS,
  NETWORK_ROOT_OFFSET,
  FLOW_LEVEL_SPACING,
  BAR_WIDTH,
  BAR_MAX_HEIGHT,
  BAR_BASE_Y
} from './config';

/**
 * 布局求解器
 * 提供多种布局算法：几何布局、流程布局、网络布局、数据布局
 */
export class LayoutSolver {
  /**
   * 主布局方法
   * 添加防御性输入验证
   */
  solve(nodes: Node[], edges: Edge[], hints?: LayoutHints): Map<string, Position> {
    // 防御性检查：输入验证
    if (!nodes || !Array.isArray(nodes)) {
      return new Map<string, Position>();
    }

    // 处理空节点数组
    if (nodes.length === 0) {
      return new Map<string, Position>();
    }

    if (!hints) {
      return this.defaultLayout(nodes);
    }

    let baseLayout: Map<string, Position>;
    switch (hints.type) {
      case 'geometry':
        baseLayout = this.geometryLayout(nodes, hints);
        break;
      case 'flow':
        baseLayout = this.flowLayout(nodes, edges);
        break;
      case 'network':
        baseLayout = this.networkLayout(nodes, edges);
        break;
      case 'data':
        baseLayout = this.dataLayout(nodes);
        break;
      default:
        baseLayout = this.defaultLayout(nodes);
    }

    if (hints.constraints && Array.isArray(hints.constraints)) {
      return this.applyConstraints(baseLayout, nodes, hints.constraints);
    }

    return baseLayout;
  }

  /**
   * 应用约束条件
   */
  private applyConstraints(
    positions: Map<string, Position>,
    nodes: Node[],
    constraints: Constraint[]
  ): Map<string, Position> {
    const result = new Map(positions);

    // 防御性检查
    if (!constraints || !Array.isArray(constraints)) {
      return result;
    }

    const horizontalConstraint = constraints.find(c => c.type === 'horizontal');
    const verticalConstraint = constraints.find(c => c.type === 'vertical');
    const centerConstraint = constraints.find(c => c.type === 'center');
    const groupConstraints = constraints.filter(c => c.type === 'group');

    if (horizontalConstraint && Array.isArray(horizontalConstraint.nodes)) {
      this.applyHorizontalConstraint(result, horizontalConstraint.nodes);
    }

    if (verticalConstraint && Array.isArray(verticalConstraint.nodes)) {
      this.applyVerticalConstraint(result, verticalConstraint.nodes);
    }

    if (centerConstraint) {
      const hNodes = horizontalConstraint?.nodes || [];
      const vNodes = verticalConstraint?.nodes || [];
      this.applyCenterConstraint(result, centerConstraint.nodes || [], hNodes, vNodes);
    }

    groupConstraints.forEach(c => {
      if (Array.isArray(c.nodes)) {
        this.applyGroupConstraint(result, c.nodes, nodes);
      }
    });

    return result;
  }

  /**
   * 分组约束：将节点排列成水平组
   */
  private applyGroupConstraint(
    positions: Map<string, Position>,
    groupNodes: string[],
    _allNodes: Node[]
  ): void {
    if (groupNodes.length < 2) return;

    let centerX = 0;
    let centerY = 0;
    let validCount = 0;

    groupNodes.forEach(nodeId => {
      const pos = positions.get(nodeId);
      if (pos) {
        centerX += pos.x;
        centerY += pos.y;
        validCount++;
      }
    });

    if (validCount === 0) return;

    centerX /= validCount;
    centerY /= validCount;

    const spacing = HORIZONTAL_SPACING;
    const startX = centerX - (groupNodes.length - 1) * spacing / 2;

    groupNodes.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: startX + index * spacing,
        y: centerY
      });
    });
  }

  /**
   * 中心约束：将节点放置在其他节点的中心
   */
  private applyCenterConstraint(
    positions: Map<string, Position>,
    centerNodes: string[],
    horizontalNodes: string[] = [],
    verticalNodes: string[] = []
  ): void {
    if (centerNodes.length < 1) return;

    if (centerNodes.length === 1) {
      const nodeId = centerNodes[0];

      const horizontalCount = horizontalNodes.length;
      const verticalCount = verticalNodes.length;

      if (horizontalCount >= 2) {
        const sortedHorizontal = [...horizontalNodes].sort((a, b) => {
          const posA = positions.get(a);
          const posB = positions.get(b);
          return (posA?.x || 0) - (posB?.x || 0);
        });

        const leftNode = sortedHorizontal[0];
        const rightNode = sortedHorizontal[sortedHorizontal.length - 1];
        const leftPos = positions.get(leftNode);
        const rightPos = positions.get(rightNode);

        if (leftPos && rightPos) {
          const centerX = (leftPos.x + rightPos.x) / 2;
          const centerY = leftPos.y;
          positions.set(nodeId, { x: centerX, y: centerY });
          return;
        }
      }

      if (verticalCount >= 2) {
        const sortedVertical = [...verticalNodes].sort((a, b) => {
          const posA = positions.get(a);
          const posB = positions.get(b);
          return (posA?.y || 0) - (posB?.y || 0);
        });

        const topNode = sortedVertical[0];
        const bottomNode = sortedVertical[sortedVertical.length - 1];
        const topPos = positions.get(topNode);
        const bottomPos = positions.get(bottomNode);

        if (topPos && bottomPos) {
          const centerX = topPos.x;
          const centerY = (topPos.y + bottomPos.y) / 2;
          positions.set(nodeId, { x: centerX, y: centerY });
          return;
        }
      }

      const pos = positions.get(nodeId);
      const centerX = pos?.x || CENTER_X;
      const centerY = pos?.y || CENTER_Y;
      positions.set(nodeId, { x: centerX, y: centerY });
      return;
    }

    if (centerNodes.length === 2) {
      const [nodeA, nodeB] = centerNodes;
      const posA = positions.get(nodeA);
      const posB = positions.get(nodeB);
      if (posA && posB) {
        const centerX = (posA.x + posB.x) / 2;
        const centerY = (posA.y + posB.y) / 2;
        const existingCenter = { x: centerX, y: centerY };
        centerNodes.forEach(id => {
          positions.set(id, existingCenter);
        });
      }
      return;
    }

    centerNodes.forEach((nodeId) => {
      positions.set(nodeId, { x: CENTER_X, y: CENTER_Y });
    });
  }

  /**
   * 水平对齐约束
   */
  private applyHorizontalConstraint(
    positions: Map<string, Position>,
    nodes: string[]
  ): void {
    if (nodes.length < 2) return;

    const spacing = HORIZONTAL_SPACING;
    const startX = CENTER_X - (nodes.length - 1) * spacing / 2;

    // 计算平均 Y 坐标
    let totalY = 0;
    let validCount = 0;
    nodes.forEach(nodeId => {
      const pos = positions.get(nodeId);
      if (pos) {
        totalY += pos.y;
        validCount++;
      }
    });

    const avgY = validCount > 0 ? totalY / validCount : CENTER_Y;

    nodes.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: startX + index * spacing,
        y: avgY
      });
    });
  }

  /**
   * 垂直对齐约束
   */
  private applyVerticalConstraint(
    positions: Map<string, Position>,
    nodes: string[]
  ): void {
    if (nodes.length < 2) return;

    const spacing = VERTICAL_SPACING;
    const startY = CENTER_Y - (nodes.length - 1) * spacing / 2;

    // ��算平均 X 坐标
    let totalX = 0;
    let validCount = 0;
    nodes.forEach(nodeId => {
      const pos = positions.get(nodeId);
      if (pos) {
        totalX += pos.x;
        validCount++;
      }
    });

    const avgX = validCount > 0 ? totalX / validCount : CENTER_X;

    nodes.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: avgX,
        y: startY + index * spacing
      });
    });
  }

  /**
   * 默认布局：水平排列
   */
  private defaultLayout(nodes: Node[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const startX = DEFAULT_START_X;
    const spacing = DEFAULT_SPACING;
    const centerY = CENTER_Y;

    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: startX + index * spacing,
        y: centerY
      });
    });

    return positions;
  }

  /**
   * 几何布局：正方形、三角形、圆形
   */
  private geometryLayout(nodes: Node[], hints: LayoutHints): Map<string, Position> {
    const positions = new Map<string, Position>();
    const centerX = CENTER_X;
    const centerY = CENTER_Y;

    switch (hints.geometryType) {
      case 'square':
        const size = GEOMETRY_SQUARE;
        const squarePositions = [
          { x: centerX - size / 2, y: centerY - size / 2 },
          { x: centerX + size / 2, y: centerY - size / 2 },
          { x: centerX + size / 2, y: centerY + size / 2 },
          { x: centerX - size / 2, y: centerY + size / 2 }
        ];
        nodes.forEach((node, index) => {
          if (index < squarePositions.length) {
            positions.set(node.id, squarePositions[index]);
          } else {
            positions.set(node.id, { x: centerX, y: centerY });
          }
        });
        break;

      case 'triangle':
        const triSize = GEOMETRY_TRIANGLE;
        const triPositions = [
          { x: centerX, y: centerY - triSize / 2 },
          { x: centerX - triSize / 2, y: centerY + triSize / 2 },
          { x: centerX + triSize / 2, y: centerY + triSize / 2 }
        ];
        nodes.forEach((node, index) => {
          if (index < triPositions.length) {
            positions.set(node.id, triPositions[index]);
          } else {
            positions.set(node.id, { x: centerX, y: centerY });
          }
        });
        break;

      case 'circle':
        const radius = GEOMETRY_CIRCLE;
        nodes.forEach((node, index) => {
          const angle = (index / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
          positions.set(node.id, {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        });
        break;

      default:
        return this.defaultLayout(nodes);
    }

    return positions;
  }

  /**
   * 流程布局：按层级排列
   */
  private flowLayout(nodes: Node[], edges: Edge[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const spacing = DEFAULT_SPACING;
    const levels = new Map<string, number>();

    // 初始化所有节点层级为 0
    nodes.forEach(node => levels.set(node.id, 0));

    // 计算层级
    edges.forEach(edge => {
      const fromLevel = levels.get(edge.from) || 0;
      const toLevel = levels.get(edge.to) || 0;
      levels.set(edge.to, Math.max(fromLevel + 1, toLevel));
    });

    // 按层级分组
    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    });

    // 计算位置
    const firstLevel = Math.min(...levelGroups.keys());
    levelGroups.forEach((nodeIds, level) => {
      const y = 100 + (level - firstLevel) * FLOW_LEVEL_SPACING;
      const levelWidth = (nodeIds.length - 1) * spacing;
      const startX = CENTER_X - levelWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * spacing;
        positions.set(nodeId, { x, y });
      });
    });

    return positions;
  }

  /**
   * 网络布局：根节点在中间，叶节点环绕
   */
  private networkLayout(nodes: Node[], edges: Edge[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const centerX = CENTER_X;
    const centerY = CENTER_Y;
    const radius = NETWORK_RADIUS;

    const inDegree = new Map<string, number>();
    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => {
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    });

    const roots = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
    const others = nodes.filter(n => (inDegree.get(n.id) || 0) > 0);

    // 根节点水平排列
    roots.forEach((node, i) => {
      const offsetX = roots.length > 1 ? NETWORK_ROOT_OFFSET : 0;
      positions.set(node.id, {
        x: centerX + (i - (roots.length - 1) / 2) * offsetX,
        y: centerY
      });
    });

    // 其他节点环绕
    others.forEach((node, i) => {
      const angle = (i / Math.max(others.length, 1)) * 2 * Math.PI;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    });

    return positions;
  }

  /**
   * 数据布局：条形图
   */
  private dataLayout(nodes: Node[]): Map<string, Position> {
    const positions = new Map<string, Position>();
    const barWidth = BAR_WIDTH;
    const maxHeight = BAR_MAX_HEIGHT;
    const baseY = BAR_BASE_Y;
    const margin = 100;

    nodes.forEach((node, index) => {
      const value = parseFloat(node.label) || 50;
      const height = Math.max(20, Math.min(value, maxHeight));
      positions.set(node.id, {
        x: margin + index * barWidth,
        y: baseY - height
      });
    });

    return positions;
  }
}