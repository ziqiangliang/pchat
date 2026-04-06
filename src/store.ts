import { create } from 'zustand';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  graphicalData?: any;
}

interface CanvasState {
  shapes: any[];
  selectedShape: string | null;
  isDrawing: boolean;
  editor: any; // tldraw editor实例
}

interface AppState {
  // 用户状态
  userInput: string;
  setUserInput: (input: string) => void;
  chatHistory: Message[];
  setChatHistory: (history: Message[]) => void;

  // 画布状态
  canvasState: CanvasState;
  setCanvasState: (state: CanvasState) => void;
  setEditor: (editor: any) => void;

  // AI 状态
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // 用户状态
  userInput: '',
  setUserInput: (input) => set({ userInput: input }),
  chatHistory: [],
  setChatHistory: (history) => set({ chatHistory: history }),

  // 画布状态
  canvasState: {
    shapes: [],
    selectedShape: null,
    isDrawing: false,
    editor: null
  },
  setCanvasState: (state) => set({ canvasState: state }),
  setEditor: (editor) => set((state) => ({
    canvasState: { ...state.canvasState, editor }
  })),

  // AI 状态
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  error: null,
  setError: (error) => set({ error: error })
}));
