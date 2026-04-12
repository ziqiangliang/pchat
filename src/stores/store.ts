import { create } from 'zustand';
import { DSL, Node, Edge, AnimationType, TimelineEvent, ChatMessage, Step } from '../types';
import { TTSState } from '../services/ttsService';

// ==================== 类型定义 ====================

export type PlayMode = 'incremental' | 'replay' | null;

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
  
  isAutoPlaying: boolean;
  setIsAutoPlaying: (playing: boolean) => void;

  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  // 统一播放状态管理
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
  
  playedStepCount: number;
  setPlayedStepCount: (count: number) => void;
  incrementPlayedStepCount: () => void;

  pendingSteps: Step[];
  addPendingSteps: (steps: Step[]) => void;
  clearPendingSteps: () => void;
  shiftPendingStep: () => Step | undefined;

  // 只重置图形显示状态，保留 DSL
  resetGraphDisplay: () => void;

  // 重置图状态
  resetGraphState: () => void;
  
  // 停止播放（清理状态）
  stopPlayback: () => void;
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
  
  // 主题状态
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;

  // TTS 状态
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  ttsState: TTSState;
  setTtsState: (state: TTSState) => void;
  ttsAutoPlay: boolean;
  setTtsAutoPlay: (autoPlay: boolean) => void;
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
  isAutoPlaying: false,
  playbackSpeed: 1,
  playMode: null as PlayMode,
  playedStepCount: 0,
  pendingSteps: [] as Step[]
};

const initialUIState = {
  userInput: '',
  chatHistory: [] as ChatMessage[],
  isLoading: false,
  loadingStartTime: null,
  error: null,
  pastedJson: '',
  showJsonPanel: false,
  isDarkMode: false,
  ttsEnabled: false,
  ttsState: {
    isSpeaking: false,
    isPaused: false,
    currentText: '',
    availableVoices: [],
    selectedVoice: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    isSupported: false
  } as TTSState,
  ttsAutoPlay: false
};

// ==================== Store ====================
export const useStore = create<AppState>((set, get) => ({
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
  setIsAutoPlaying: (playing) => set({ isAutoPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  setPlayMode: (mode) => set({ playMode: mode }),
  setPlayedStepCount: (count) => set({ playedStepCount: count }),
  incrementPlayedStepCount: () => set((state) => ({ playedStepCount: state.playedStepCount + 1 })),
  
  addPendingSteps: (steps) => set((state) => ({ pendingSteps: [...state.pendingSteps, ...steps] })),
  clearPendingSteps: () => set({ pendingSteps: [] }),
  shiftPendingStep: () => {
    const state = get();
    if (state.pendingSteps.length === 0) return undefined;
    const [first, ...rest] = state.pendingSteps;
    set({ pendingSteps: rest });
    return first;
  },

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
    playedStepCount: 0,
    playMode: null
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
    isAutoPlaying: false,
    playbackSpeed: 1,
    pendingSteps: [],
    playedStepCount: 0,
    playMode: null
  }),
  
  stopPlayback: () => {
    set({ 
      isAutoPlaying: false, 
      playMode: null,
      pendingSteps: []
    });
  },

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
  setShowJsonPanel: (show) => set({ showJsonPanel: show }),
  setIsDarkMode: (dark) => set({ isDarkMode: dark }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  
  setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),
  setTtsState: (state) => set({ ttsState: state }),
  setTtsAutoPlay: (autoPlay) => set({ ttsAutoPlay: autoPlay })
}));