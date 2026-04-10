import { create } from 'zustand';
import { 
  SmartChatConfig, 
  SmartChatState, 
  LLMSession, 
  DrawingStep,
  Node,
  Edge 
} from './types';
import { 
  BlackboardState, 
  createInitialBlackboardState 
} from './blackboardState';

interface SmartChatActions {
  setActive: (active: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setSession: (session: LLMSession | null) => void;
  addDrawingStep: (step: DrawingStep) => void;
  setCurrentDrawingStep: (step: number) => void;
  clearDrawingSteps: () => void;
  updateConfig: (config: Partial<SmartChatConfig>) => void;
  updateBlackboardState: (state: BlackboardState) => void;
  addNode: (node: Node) => void;
  addEdge: (edge: Edge) => void;
  reset: () => void;
}

const DEFAULT_SMART_CHAT_CONFIG: SmartChatConfig = {
  enableStreaming: true,
  maxTokens: 500,
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  promptMaxTokens: 150
};

const initialSmartChatState: SmartChatState & { 
  blackboardState: BlackboardState;
  sessionNodes: Map<string, Node>;
  sessionEdges: Edge[];
} = {
  isActive: false,
  isStreaming: false,
  currentSession: null,
  drawingSteps: [],
  currentDrawingStep: 0,
  config: DEFAULT_SMART_CHAT_CONFIG,
  blackboardState: createInitialBlackboardState(),
  sessionNodes: new Map<string, Node>(),
  sessionEdges: []
};

export const useSmartChatStore = create<SmartChatState & { 
  blackboardState: BlackboardState;
  sessionNodes: Map<string, Node>;
  sessionEdges: Edge[];
} & SmartChatActions>((set) => ({
  ...initialSmartChatState,

  setActive: (active) => set({ isActive: active }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setSession: (session) => set({ currentSession: session }),

  addDrawingStep: (step) => set((state) => ({
    drawingSteps: [...state.drawingSteps, step]
  })),

  setCurrentDrawingStep: (step) => set({ currentDrawingStep: step }),

  clearDrawingSteps: () => set({ 
    drawingSteps: [], 
    currentDrawingStep: 0 
  }),

  updateConfig: (config) => set((state) => ({
    config: { ...state.config, ...config }
  })),

  updateBlackboardState: (blackboardState) => set({ blackboardState }),

  addNode: (node) => set((state) => {
    const newNodes = new Map(state.sessionNodes);
    newNodes.set(node.id, node);
    return { sessionNodes: newNodes };
  }),

  addEdge: (edge) => set((state) => {
    console.log('[smartChatStore] addEdge called, current edges:', state.sessionEdges.length);
    console.log('[smartChatStore] adding edge:', edge);
    return {
      sessionEdges: [...state.sessionEdges, edge]
    };
  }),

  reset: () => set({
    isActive: false,
    isStreaming: false,
    currentSession: null,
    drawingSteps: [],
    currentDrawingStep: 0,
    config: DEFAULT_SMART_CHAT_CONFIG,
    blackboardState: createInitialBlackboardState(),
    sessionNodes: new Map(),
    sessionEdges: []
  })
}));

export function createNewSession(): LLMSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
