export type NodeType = 'vertex' | 'concept' | 'dataPoint' | 'annotation' | 'image' | 'process' | 'event';
export type EdgeType = 'straight' | 'curve' | 'arrow' | 'diagonal';
export type LayoutType = 'geometry' | 'flow' | 'network' | 'data';
export type AnimationType = 'fade' | 'move' | 'scale' | 'draw';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width?: number;
  height?: number;
  radius?: number;
}

export interface NodeStyle {
  color?: string;
  border?: string;
  font?: string;
  opacity?: number;
  fill?: string;
}

export interface AnnotationTarget {
  type: 'node' | 'edge' | 'angle';
  nodeId?: string;
  edgeId?: string;
  angleNodes?: string[];
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  dx?: number;
  dy?: number;
}

export interface Node {
  id: string;
  label: string;
  type?: NodeType;
  x?: number;
  y?: number;
  pos?: Position;
  size?: Size;
  style?: NodeStyle;
  domain?: string;
  target?: AnnotationTarget;
}

export interface Edge {
  from: string;
  to: string;
  label?: string;
  type?: EdgeType;
  style?: {
    color?: string;
    width?: number;
    dashed?: boolean;
  };
}

export interface Constraint {
  type: 'equalLength' | 'rightAngle' | 'diagonalIntersect' | 'parallel' | 'perpendicular' | 'group' | 'center' | 'horizontal' | 'vertical';
  nodes?: string[];
  pairs?: string[][];
  gap?: number;
  offset?: number;
}

export interface TimelineEvent {
  id: string;
  from: string;
  to: string;
  label?: string;
  direction?: 'forward' | 'backward';
  color?: string;
  delay?: number;
}

export interface LayoutHints {
  type?: LayoutType;
  geometryType?: 'square' | 'triangle' | 'circle' | 'polygon' | 'rectangle';
  constraints?: Constraint[];
}

// ==================== 数学画布层 ====================

/** 数学画布配置（坐标系参数） */
export interface MathCanvas {
  /** 每个数学单位对应的像素数，默认 50 */
  unitSize?: number;
  /** X 轴显示的数学范围，默认 [-7, 7] */
  rangeX?: [number, number];
  /** Y 轴显示的数学范围（Y 向上为正），默认 [-4, 4] */
  rangeY?: [number, number];
  /** 是否显示网格线，默认 true */
  showGrid?: boolean;
  /** 是否显示刻度标签，默认 true */
  showLabels?: boolean;
  /** SVG 像素坐标中的原点位置，默认 {x:400, y:280} */
  origin?: { x: number; y: number };
  /** X 轴标签，默认 "x" */
  xLabel?: string;
  /** Y 轴标签，默认 "y" */
  yLabel?: string;
}

/** 数学点（使用数学坐标） */
export interface MathPoint {
  id: string;
  label?: string;
  /** 数学 X 坐标 */
  x: number;
  /** 数学 Y 坐标（向上为正） */
  y: number;
  /** 点颜色，默认 #e74c3c */
  color?: string;
  /** 点半径，默认 5 */
  radius?: number;
}

/** 数学线段/直线 */
export interface MathLine {
  /** 唯一 ID，默认自动生成 "from->to" */
  id?: string;
  /** 起点 ID（引用 MathPoint.id） */
  from: string;
  /** 终点 ID（引用 MathPoint.id） */
  to: string;
  label?: string;
  /** 是否延伸到坐标系边界（画完整直线），默认 false */
  extend?: boolean;
  /** 线条样式 */
  color?: string;
  width?: number;
  /** 虚线，默认 false */
  dashed?: boolean;
}

/** 数学曲线（函数表达式，预留扩展） */
export interface MathCurve {
  id: string;
  /** JavaScript 表达式，变量为 x，例："x*x", "Math.sin(x)" */
  fn: string;
  /** 绘制范围 [xMin, xMax] */
  range: [number, number];
  label?: string;
  color?: string;
  width?: number;
  dashed?: boolean;
}

/** Step 中的数学层操作 */
export interface MathOperation {
  addPoints?: MathPoint[];
  addLines?: MathLine[];
  addCurves?: MathCurve[];
  removePoints?: string[];
  removeLines?: string[];
  removeCurves?: string[];
  highlight?: string[];
}

export interface Step {
  text: string;
  // ===== 节点层操作（像素坐标）=====
  add?: Node[];
  connect?: Edge[];
  remove?: string[];
  highlight?: string[];
  animate?: {
    type: AnimationType;
    target?: string;
    duration?: number;
  };
  timeline?: TimelineEvent[];
  // ===== 数学层操作（数学坐标）=====
  /** 控制坐标系出场（带动画），一般放在第一步 */
  showCoord?: boolean;
  /** 数学画布层的增删操作 */
  math?: MathOperation;
}

export interface Meta {
  title?: string;
  domain?: string;
}

export interface DSL {
  title?: string;
  meta?: Meta;
  layoutHints?: LayoutHints;
  /** 数学画布配置（坐标系参数），存在时启用数学层 */
  mathCanvas?: MathCanvas;
  steps: Step[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  timestamp: number;
}

export interface SmartChatConfig {
  enableStreaming: boolean;
  maxTokens: number;
  modelName: string;
  temperature: number;
  promptMaxTokens: number;
}

export interface DrawingContext {
  userQuestion: string;
  currentStep: number;
  blackboardState: import('../stores/blackboardState').BlackboardState;
  nodes: Map<string, Node>;
  edges: Edge[];
}

export interface LLMSession {
  id: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingStep {
  explainText: string;
  targetArea: import('../stores/blackboardState').AreaId;
  node?: Node;
  edge?: Edge;
  animationType: AnimationType;
  timestamp: number;
}

export interface SmartChatState {
  isActive: boolean;
  isStreaming: boolean;
  currentSession: LLMSession | null;
  drawingSteps: DrawingStep[];
  currentDrawingStep: number;
  config: SmartChatConfig;
}

export interface NodeStyleConfig {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontWeight: string;
  shape: 'circle' | 'rect' | 'diamond' | 'polygon';
}

export const NODE_STYLES: Record<NodeType, NodeStyleConfig> = {
  vertex: {
    fill: 'rgba(52, 199, 89, 0.18)',
    stroke: 'rgba(52, 199, 89, 0.65)',
    strokeWidth: 2,
    fontSize: 12,
    fontWeight: '600',
    shape: 'circle'
  },
  concept: {
    fill: 'rgba(255, 255, 255, 0.22)',
    stroke: 'rgba(120, 120, 128, 0.35)',
    strokeWidth: 1.5,
    fontSize: 14,
    fontWeight: '500',
    shape: 'rect'
  },
  dataPoint: {
    fill: 'rgba(0, 122, 255, 0.18)',
    stroke: 'rgba(0, 122, 255, 0.6)',
    strokeWidth: 2,
    fontSize: 12,
    fontWeight: '600',
    shape: 'circle'
  },
  annotation: {
    fill: 'rgba(255, 159, 10, 0.15)',
    stroke: 'rgba(255, 159, 10, 0.55)',
    strokeWidth: 1.5,
    fontSize: 11,
    fontWeight: '500',
    shape: 'rect'
  },
  image: {
    fill: 'rgba(175, 82, 222, 0.15)',
    stroke: 'rgba(175, 82, 222, 0.55)',
    strokeWidth: 1.5,
    fontSize: 10,
    fontWeight: '500',
    shape: 'rect'
  },
  process: {
    fill: 'rgba(255, 59, 48, 0.12)',
    stroke: 'rgba(255, 59, 48, 0.5)',
    strokeWidth: 1.5,
    fontSize: 13,
    fontWeight: '500',
    shape: 'rect'
  },
  event: {
    fill: 'rgba(255, 45, 85, 0.16)',
    stroke: 'rgba(255, 45, 85, 0.6)',
    strokeWidth: 2,
    fontSize: 11,
    fontWeight: '600',
    shape: 'circle'
  }
};
