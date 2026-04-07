import { create } from 'zustand';
import { DSL, Node, Edge, AnimationType, TimelineEvent, ChatMessage, Step } from './types';

// ==================== 类型定义 ====================

interface GraphState {
  // DSL 数据
  dsl: DSL | null;
  setDsl: (dsl: DSL | null) => void;

  // 当前步骤索引
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // 图节点和边
  nodes: Map<string, Node>;
  setNodes: (nodes: Map<string, Node>) => void;

  edges: Edge[];
  setEdges: (edges: Edge[]) => void;

  // 可见性状态
  visibleNodeIds: Set<string>;
  setVisibleNodeIds: (ids: Set<string>) => void;

  visibleEdgeIds: Set<string>;
  setVisibleEdgeIds: (ids: Set<string>) => void;

  // 高亮状态
  highlightedNodes: Set<string>;
  setHighlightedNodes: (ids: Set<string>) => void;

  highlightedEdges: Set<string>;
  setHighlightedEdges: (ids: Set<string>) => void;

  // 动画状态
  nodeAnimations: Map<string, AnimationType>;
  setNodeAnimations: (animations: Map<string, AnimationType>) => void;

  activeTimelineEvents: TimelineEvent[];
  setActiveTimelineEvents: (events: TimelineEvent[]) => void;

  timelineAnimations: Map<string, { progress: number }>;
  setTimelineAnimations: (animations: Map<string, { progress: number }>) => void;

  // 显示文字（打字机效果）
  displayText: string;
  setDisplayText: (text: string) => void;

  // 播放控制状态
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;

  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;

  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  pendingSteps: Step[];
  addPendingSteps: (steps: Step[]) => void;
  clearPendingSteps: () => void;

  playedStepIds: Set<string>;
  addPlayedStepId: (id: string) => void;
  clearPlayedStepIds: () => void;

  // 只重置图形显示状态，保留 DSL
  resetGraphDisplay: () => void;

  // 重置图状态
  resetGraphState: () => void;
}

interface UIState {
  // 用户输入
  userInput: string;
  setUserInput: (input: string) => void;

  // 聊天历史
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;

  // 加载状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingStartTime: number | null;
  setLoadingStartTime: (time: number | null) => void;

  // 错误状态
  error: string | null;
  setError: (error: string | null) => void;

  // JSON 面板
  pastedJson: string;
  setPastedJson: (json: string) => void;
  showJsonPanel: boolean;
  setShowJsonPanel: (show: boolean) => void;
}

type AppState = GraphState & UIState;

// ==================== 初始状态 ====================
const initialGraphState = {
  dsl: null,
  currentStep: -1,
  nodes: new Map<string, Node>(),
  edges: [] as Edge[],
  visibleNodeIds: new Set<string>(),
  visibleEdgeIds: new Set<string>(),
  highlightedNodes: new Set<string>(),
  highlightedEdges: new Set<string>(),
  nodeAnimations: new Map<string, AnimationType>(),
  activeTimelineEvents: [] as TimelineEvent[],
  timelineAnimations: new Map<string, { progress: number }>(),
  displayText: '',
  isStreaming: false,
  isPaused: false,
  playbackSpeed: 1,
  pendingSteps: [] as Step[],
  playedStepIds: new Set<string>()
};

const initialUIState = {
  userInput: '',
  chatHistory: [] as ChatMessage[],
  isLoading: false,
  loadingStartTime: null,
  error: null,
  pastedJson: '',
  showJsonPanel: false
};

// ==================== Store ====================
export const useStore = create<AppState>((set) => ({
  // ...图状态
  ...initialGraphState,

  setDsl: (dsl) => set({ dsl }),
  setCurrentStep: (step) => set({ currentStep: step }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setVisibleNodeIds: (ids) => set({ visibleNodeIds: ids }),
  setVisibleEdgeIds: (ids) => set({ visibleEdgeIds: ids }),
  setHighlightedNodes: (ids) => set({ highlightedNodes: ids }),
  setHighlightedEdges: (ids) => set({ highlightedEdges: ids }),
  setNodeAnimations: (animations) => set({ nodeAnimations: animations }),
  setActiveTimelineEvents: (events) => set({ activeTimelineEvents: events }),
  setTimelineAnimations: (animations) => set({ timelineAnimations: animations }),
  setDisplayText: (text) => set({ displayText: text }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  addPendingSteps: (steps) => set((state) => ({ pendingSteps: [...state.pendingSteps, ...steps] })),
  clearPendingSteps: () => set({ pendingSteps: [] }),
  addPlayedStepId: (id) => set((state) => {
    const newSet = new Set(state.playedStepIds);
    newSet.add(id);
    return { playedStepIds: newSet };
  }),
  clearPlayedStepIds: () => set({ playedStepIds: new Set() }),

  // 只重置图形显示状态，保留 DSL（用于步骤跳转）
  resetGraphDisplay: () => set({
    currentStep: -1,
    nodes: new Map(),
    edges: [],
    visibleNodeIds: new Set(),
    visibleEdgeIds: new Set(),
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
    nodeAnimations: new Map(),
    activeTimelineEvents: [],
    timelineAnimations: new Map(),
    displayText: '',
    pendingSteps: [],
    playedStepIds: new Set(),
  }),

  resetGraphState: () => set({
    dsl: null,
    currentStep: -1,
    nodes: new Map(),
    edges: [],
    visibleNodeIds: new Set(),
    visibleEdgeIds: new Set(),
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
    nodeAnimations: new Map(),
    activeTimelineEvents: [],
    timelineAnimations: new Map(),
    displayText: '',
    isStreaming: false,
    isPaused: false,
    playbackSpeed: 1,
    pendingSteps: [],
    playedStepIds: new Set()
  }),

  // ...UI状态
  ...initialUIState,

  setUserInput: (input) => set({ userInput: input }),
  setChatHistory: (historyOrUpdater) => set((state) => ({
    chatHistory: typeof historyOrUpdater === 'function'
      ? historyOrUpdater(state.chatHistory)
      : historyOrUpdater
  })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLoadingStartTime: (time) => set({ loadingStartTime: time }),
  setError: (error) => set({ error }),
  setPastedJson: (json) => set({ pastedJson: json }),
  setShowJsonPanel: (show) => set({ showJsonPanel: show })
}));