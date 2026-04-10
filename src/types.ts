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

export interface Step {
  text: string;
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
}

export interface Meta {
  title?: string;
  domain?: string;
}

export interface DSL {
  title?: string;
  meta?: Meta;
  layoutHints?: LayoutHints;
  steps: Step[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  blackboardState: import('./blackboardState').BlackboardState;
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
  targetArea: import('./blackboardState').AreaId;
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
    fill: '#81C784',
    stroke: '#4CAF50',
    strokeWidth: 2.5,
    fontSize: 12,
    fontWeight: 'bold',
    shape: 'circle'
  },
  concept: {
    fill: '#FFFFFF',
    stroke: '#A1887F',
    strokeWidth: 2,
    fontSize: 14,
    fontWeight: '500',
    shape: 'rect'
  },
  dataPoint: {
    fill: '#64B5F6',
    stroke: '#42A5F5',
    strokeWidth: 2.5,
    fontSize: 12,
    fontWeight: 'bold',
    shape: 'circle'
  },
  annotation: {
    fill: '#FFE082',
    stroke: '#FFB74D',
    strokeWidth: 2,
    fontSize: 11,
    fontWeight: '600',
    shape: 'rect'
  },
  image: {
    fill: '#E1BEE7',
    stroke: '#B39DDB',
    strokeWidth: 2,
    fontSize: 10,
    fontWeight: '500',
    shape: 'rect'
  },
  process: {
    fill: '#FFCCBC',
    stroke: '#FF8A65',
    strokeWidth: 2,
    fontSize: 13,
    fontWeight: '500',
    shape: 'rect'
  },
  event: {
    fill: '#F48FB1',
    stroke: '#EC407A',
    strokeWidth: 2.5,
    fontSize: 11,
    fontWeight: 'bold',
    shape: 'circle'
  }
};
