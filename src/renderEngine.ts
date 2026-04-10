import { 
  AreaId, 
  BlackboardState, 
  getAreaCoord, 
  getElementCountInArea 
} from './blackboardState';
import { 
  Node, 
  Edge, 
  Step, 
  AnimationType,
  NODE_STYLES 
} from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  NODE_ANIMATION_DURATION,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_LABEL_PADDING
} from './config';

export interface RenderElement {
  node?: Node;
  edge?: Edge;
  animation?: {
    type: AnimationType;
    duration: number;
  };
  highlight?: boolean;
}

export interface RenderPlan {
  elements: RenderElement[];
  text?: string;
  step: number;
}

export interface LayoutConfig {
  spacing: number;
  maxElementsPerArea: number;
  enableAnimation: boolean;
  animationDuration: number;
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  spacing: 20,
  maxElementsPerArea: 5,
  enableAnimation: true,
  animationDuration: NODE_ANIMATION_DURATION
};

export function calculateElementCoordinates(
  areaId: AreaId,
  elementType: string,
  width: number,
  height: number,
  blackboardState: BlackboardState
): { x: number; y: number } {
  const areaCoord = getAreaCoord(areaId);
  const elementCount = getElementCountInArea(blackboardState, areaId);
  
  let x: number;
  let y: number;

  switch (elementType) {
    case 'rect':
    case 'concept':
    case 'process':
    case 'dataPoint':
      x = areaCoord.x + (areaCoord.maxWidth - width) / 2;
      y = areaCoord.y + elementCount * (height + DEFAULT_LAYOUT_CONFIG.spacing);
      break;

    case 'circle':
    case 'vertex':
      const radius = width / 2;
      x = areaCoord.x + areaCoord.maxWidth / 2;
      y = areaCoord.y + elementCount * (radius * 2 + DEFAULT_LAYOUT_CONFIG.spacing) + radius;
      break;

    case 'text':
    case 'annotation':
      x = areaCoord.x;
      y = areaCoord.y + elementCount * (DEFAULT_NODE_HEIGHT + DEFAULT_LAYOUT_CONFIG.spacing);
      break;

    default:
      x = areaCoord.x + areaCoord.maxWidth / 2 - width / 2;
      y = areaCoord.y + elementCount * (height + DEFAULT_LAYOUT_CONFIG.spacing);
  }

  return {
    x: Math.max(areaCoord.x, Math.min(x, areaCoord.x + areaCoord.maxWidth - width)),
    y: Math.max(areaCoord.y, y)
  };
}

export function createNodeFromDrawLogic(
  areaId: AreaId,
  action: string,
  label: string,
  width: number,
  height: number,
  nodeId: string,
  blackboardState: BlackboardState
): Node {
  const coordinates = calculateElementCoordinates(
    areaId,
    action,
    width,
    height,
    blackboardState
  );

  let nodeType: string;
  let size: { width?: number; height?: number; radius?: number };

  switch (action) {
    case 'rect':
    case 'concept':
      nodeType = 'concept';
      size = { width, height };
      break;

    case 'circle':
    case 'vertex':
      nodeType = 'vertex';
      size = { radius: width / 2 };
      break;

    case 'triangle':
    case 'process':
      nodeType = 'process';
      size = { width, height };
      break;

    case 'diamond':
    case 'dataPoint':
      nodeType = 'dataPoint';
      size = { width, height };
      break;

    case 'text':
    case 'annotation':
      nodeType = 'annotation';
      size = { width, height };
      break;

    default:
      nodeType = 'concept';
      size = { width, height };
  }

  return {
    id: nodeId,
    type: nodeType as Node['type'],
    label,
    x: coordinates.x,
    y: coordinates.y,
    size,
    style: {
      color: NODE_STYLES[nodeType as keyof typeof NODE_STYLES]?.stroke || '#333',
      fill: NODE_STYLES[nodeType as keyof typeof NODE_STYLES]?.fill || '#fff',
      border: NODE_STYLES[nodeType as keyof typeof NODE_STYLES]?.stroke || '#333'
    }
  };
}

export function createEdgeFromDrawLogic(
  fromLabel: string,
  toLabel: string,
  label?: string,
  _edgeId?: string
): Edge {
  return {
    from: fromLabel,
    to: toLabel,
    label,
    type: 'arrow',
    style: {
      color: '#666',
      width: 2
    }
  };
}

export function checkLayoutConflict(
  areaId: AreaId,
  elementHeight: number,
  blackboardState: BlackboardState
): boolean {
  const areaCoord = getAreaCoord(areaId);
  const currentCount = getElementCountInArea(blackboardState, areaId);
  const requiredHeight = (currentCount + 1) * (elementHeight + DEFAULT_LAYOUT_CONFIG.spacing);

  return requiredHeight > areaCoord.maxHeight;
}

export function suggestAlternativeArea(
  preferredArea: AreaId,
  blackboardState: BlackboardState,
  elementHeight: number
): AreaId | null {
  const allAreas: AreaId[] = [
    'top-left', 'top-right', 'middle-left', 'middle-right',
    'middle-center', 'bottom-left', 'bottom-center', 'bottom-right'
  ];

  for (const area of allAreas) {
    if (area !== preferredArea && !blackboardState.occupiedAreas.includes(area)) {
      if (!checkLayoutConflict(area, elementHeight, blackboardState)) {
        return area;
      }
    }
  }

  return null;
}

export function generateStep(
  explainText: string,
  node?: Node,
  edge?: Edge,
  highlightIds?: string[],
  animationType: AnimationType = 'fade'
): Step {
  const step: Step = {
    text: explainText
  };

  if (node) {
    step.add = [node];
  }

  if (edge) {
    step.connect = [edge];
  }

  if (highlightIds && highlightIds.length > 0) {
    step.highlight = highlightIds;
  }

  if (node || edge) {
    step.animate = {
      type: animationType,
      duration: DEFAULT_LAYOUT_CONFIG.animationDuration
    };
  }

  return step;
}

export function createRenderPlan(
  explainText: string,
  node?: Node,
  edge?: Edge,
  highlightIds?: string[],
  stepNumber: number = 0
): RenderPlan {
  const elements: RenderElement[] = [];

  if (node) {
    elements.push({
      node,
      animation: {
        type: 'fade',
        duration: DEFAULT_LAYOUT_CONFIG.animationDuration
      }
    });
  }

  if (edge) {
    elements.push({
      edge,
      animation: {
        type: 'draw',
        duration: DEFAULT_LAYOUT_CONFIG.animationDuration
      }
    });
  }

  if (highlightIds && highlightIds.length > 0) {
    highlightIds.forEach(_id => {
      elements.push({ highlight: true });
    });
  }

  return {
    elements,
    text: explainText,
    step: stepNumber
  };
}

export function optimizeLayout(
  nodes: Node[],
  canvasWidth: number = CANVAS_WIDTH,
  canvasHeight: number = CANVAS_HEIGHT
): Node[] {
  return nodes.map(node => {
    if (node.x === undefined || node.y === undefined) {
      return node;
    }

    let x = node.x;
    let y = node.y;
    const width = node.size?.width || DEFAULT_NODE_LABEL_PADDING;
    const height = node.size?.height || DEFAULT_NODE_HEIGHT;

    x = Math.max(0, Math.min(x, canvasWidth - width));
    y = Math.max(0, Math.min(y, canvasHeight - height));

    return {
      ...node,
      x,
      y
    };
  });
}

export function calculateOptimalSpacing(
  areaWidth: number,
  elementWidth: number,
  minElements: number = 2
): number {
  const maxElements = Math.floor(areaWidth / elementWidth);
  const actualElements = Math.max(minElements, maxElements);
  return (areaWidth - elementWidth * actualElements) / (actualElements + 1);
}

export function validateCoordinates(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number = CANVAS_WIDTH,
  canvasHeight: number = CANVAS_HEIGHT
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x + width <= canvasWidth &&
    y + height <= canvasHeight
  );
}

export function calculateCenterPosition(
  areaId: AreaId,
  elementWidth: number,
  elementHeight: number
): { x: number; y: number } {
  const areaCoord = getAreaCoord(areaId);
  
  return {
    x: areaCoord.x + (areaCoord.maxWidth - elementWidth) / 2,
    y: areaCoord.y + (areaCoord.maxHeight - elementHeight) / 2
  };
}

export function createAnimationSequence(
  steps: Step[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Step[] {
  return steps.map((step, _index) => ({
    ...step,
    animate: step.animate || {
      type: 'fade' as AnimationType,
      duration: config.animationDuration
    }
  }));
}

export function estimateRenderComplexity(
  blackboardState: BlackboardState,
  newElementCount: number = 1
): 'low' | 'medium' | 'high' {
  const totalElements = blackboardState.elementSummary.length + newElementCount;
  const occupiedAreas = blackboardState.occupiedAreas.length;

  if (totalElements <= 5 && occupiedAreas <= 3) {
    return 'low';
  } else if (totalElements <= 15 && occupiedAreas <= 6) {
    return 'medium';
  } else {
    return 'high';
  }
}

export function getRecommendedAnimationDuration(
  complexity: 'low' | 'medium' | 'high'
): number {
  switch (complexity) {
    case 'low':
      return NODE_ANIMATION_DURATION;
    case 'medium':
      return NODE_ANIMATION_DURATION * 1.2;
    case 'high':
      return NODE_ANIMATION_DURATION * 1.5;
  }
}
