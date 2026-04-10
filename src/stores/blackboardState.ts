import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';

export type AreaId = 
  | 'top-left' 
  | 'top-right' 
  | 'middle-left' 
  | 'middle-right' 
  | 'middle-center'
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

export interface AreaDefinition {
  id: AreaId;
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  label: string;
}

export interface ElementSummary {
  id: string;
  type: string;
  area: AreaId;
  label: string;
}

export interface BlackboardState {
  canvasSize: {
    width: number;
    height: number;
  };
  occupiedAreas: AreaId[];
  availableAreas: AreaId[];
  currentStep: number;
  elementSummary: ElementSummary[];
}

export interface AreaCoord {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

const AREA_DEFINITIONS: Record<AreaId, AreaDefinition> = {
  'top-left': {
    id: 'top-left',
    x: 50,
    y: 50,
    maxWidth: 300,
    maxHeight: 180,
    label: '左上区域（适合画起始模块、左侧对比内容）'
  },
  'top-right': {
    id: 'top-right',
    x: 450,
    y: 50,
    maxWidth: 300,
    maxHeight: 180,
    label: '右上区域（适合画右侧对比内容、辅助模块）'
  },
  'middle-left': {
    id: 'middle-left',
    x: 50,
    y: 150,
    maxWidth: 250,
    maxHeight: 180,
    label: '左中区域（适合画核心流程左侧模块）'
  },
  'middle-right': {
    id: 'middle-right',
    x: 500,
    y: 150,
    maxWidth: 250,
    maxHeight: 180,
    label: '右中区域（适合画核心流程右侧模块）'
  },
  'middle-center': {
    id: 'middle-center',
    x: 300,
    y: 180,
    maxWidth: 200,
    maxHeight: 150,
    label: '中中区域（适合画核心模块、全局汇总）'
  },
  'bottom-left': {
    id: 'bottom-left',
    x: 50,
    y: 350,
    maxWidth: 300,
    maxHeight: 150,
    label: '左下区域（适合画备注、补充说明）'
  },
  'bottom-center': {
    id: 'bottom-center',
    x: 300,
    y: 350,
    maxWidth: 200,
    maxHeight: 150,
    label: '中下区域（适合画总结模块、流程终点）'
  },
  'bottom-right': {
    id: 'bottom-right',
    x: 500,
    y: 350,
    maxWidth: 250,
    maxHeight: 150,
    label: '右下区域（适合画辅助说明、图例）'
  }
};

export function createInitialBlackboardState(): BlackboardState {
  const allAreas = Object.keys(AREA_DEFINITIONS) as AreaId[];
  return {
    canvasSize: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT
    },
    occupiedAreas: [],
    availableAreas: allAreas,
    currentStep: 0,
    elementSummary: []
  };
}

export function getAreaDefinition(areaId: AreaId): AreaDefinition {
  return AREA_DEFINITIONS[areaId];
}

export function getAllAreas(): AreaDefinition[] {
  return Object.values(AREA_DEFINITIONS);
}

export function getAreaCoord(areaId: AreaId): AreaCoord {
  const definition = AREA_DEFINITIONS[areaId];
  return {
    x: definition.x,
    y: definition.y,
    maxWidth: definition.maxWidth,
    maxHeight: definition.maxHeight
  };
}

export function updateAreaOccupation(
  state: BlackboardState,
  areaId: AreaId,
  elementId: string,
  elementType: string,
  elementLabel: string
): BlackboardState {
  const newOccupiedAreas = [...state.occupiedAreas, areaId];
  const newAvailableAreas = state.availableAreas.filter(area => area !== areaId);
  const newElementSummary = [
    ...state.elementSummary,
    {
      id: elementId,
      type: elementType,
      area: areaId,
      label: elementLabel
    }
  ];

  return {
    ...state,
    occupiedAreas: newOccupiedAreas,
    availableAreas: newAvailableAreas,
    currentStep: state.currentStep + 1,
    elementSummary: newElementSummary
  };
}

export function releaseArea(
  state: BlackboardState,
  areaId: AreaId,
  elementId: string
): BlackboardState {
  const newOccupiedAreas = state.occupiedAreas.filter(area => area !== areaId);
  const newAvailableAreas = [...state.availableAreas, areaId].sort();
  const newElementSummary = state.elementSummary.filter(el => el.id !== elementId);

  return {
    ...state,
    occupiedAreas: newOccupiedAreas,
    availableAreas: newAvailableAreas,
    currentStep: Math.max(0, state.currentStep - 1),
    elementSummary: newElementSummary
  };
}

export function generateAreaSummary(state: BlackboardState): string {
  const occupiedStr = state.occupiedAreas.length > 0 
    ? state.occupiedAreas.join(', ') 
    : '无';
  
  const availableStr = state.availableAreas.join(', ');
  
  const elementStr = state.elementSummary.length > 0
    ? state.elementSummary.map(el => `${el.type}(${el.label})位于${el.area}`).join('；')
    : '无';

  return `已占用区域：${occupiedStr}；可用区域：${availableStr}；已画元素：${elementStr}`;
}

export function generateCompactSummary(state: BlackboardState): {
  occupiedAreas: string;
  availableAreas: string;
  elementSummary: string;
} {
  return {
    occupiedAreas: state.occupiedAreas.length > 0 ? state.occupiedAreas.join(', ') : '无',
    availableAreas: state.availableAreas.join(', '),
    elementSummary: state.elementSummary.map(el => `${el.type}:${el.label}`).join('; ')
  };
}

export function isAreaAvailable(state: BlackboardState, areaId: AreaId): boolean {
  return state.availableAreas.includes(areaId);
}

export function findNearestAvailableArea(
  state: BlackboardState,
  targetArea: AreaId
): AreaId | null {
  if (isAreaAvailable(state, targetArea)) {
    return targetArea;
  }

  const allAreas = Object.keys(AREA_DEFINITIONS) as AreaId[];
  for (const area of allAreas) {
    if (isAreaAvailable(state, area)) {
      return area;
    }
  }

  return null;
}

export function getElementCountInArea(state: BlackboardState, areaId: AreaId): number {
  return state.elementSummary.filter(el => el.area === areaId).length;
}

export function getAreaUsage(state: BlackboardState): Record<AreaId, number> {
  const usage: Record<string, number> = {};
  
  for (const area of state.availableAreas.concat(state.occupiedAreas)) {
    usage[area] = getElementCountInArea(state, area);
  }
  
  return usage as Record<AreaId, number>;
}

export function getNextAvailablePosition(
  state: BlackboardState,
  areaId: AreaId,
  elementHeight: number = 50
): { x: number; y: number } {
  const areaCoord = getAreaCoord(areaId);
  const elementCount = getElementCountInArea(state, areaId);
  const spacing = 20;

  const y = areaCoord.y + elementCount * (elementHeight + spacing);
  
  return {
    x: areaCoord.x,
    y: Math.min(y, areaCoord.y + areaCoord.maxHeight - elementHeight)
  };
}

export function validateAreaLayout(
  state: BlackboardState,
  areaId: AreaId,
  requiredHeight: number
): boolean {
  const areaCoord = getAreaCoord(areaId);
  const elementCount = getElementCountInArea(state, areaId);
  const spacing = 20;
  const totalHeight = (elementCount + 1) * (requiredHeight + spacing);

  return totalHeight <= areaCoord.maxHeight;
}
