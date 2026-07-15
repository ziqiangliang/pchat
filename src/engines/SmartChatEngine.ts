import { 
  BlackboardState, 
  updateAreaOccupation
} from '../stores/blackboardState';
import { 
  createFullPrompt, 
  parseLLMOutput
} from '../utils/instructionTransformer';
import { 
  createNodeFromDrawLogic, 
  createEdgeFromDrawLogic
} from './renderEngine';
import { 
  Node, 
  Edge, 
  SmartChatConfig,
  DrawingStep
} from '../types';
import { useSmartChatStore, createNewSession } from '../stores/smartChatStore';
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../config/api';

export interface SmartChatCallbacks {
  onExplainText: (text: string) => void;
  onNodeAdded: (node: Node) => void;
  onEdgeAdded: (edge: Edge) => void;
  onStepComplete: (step: DrawingStep) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export class SmartChatEngine {
  private config: SmartChatConfig;
  private callbacks: Partial<SmartChatCallbacks>;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: SmartChatConfig, callbacks?: Partial<SmartChatCallbacks>) {
    this.config = config;
    this.callbacks = callbacks || {};
  }

  async startDrawing(
    userQuestion: string,
    _apiEndpoint?: string,
    _apiKey?: string
  ): Promise<void> {
    if (this.isRunning) {
      console.warn('SmartChatEngine is already running');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    const store = useSmartChatStore.getState();
    store.reset();
    store.setActive(true);

    const session = createNewSession();
    store.setSession(session);

    try {
      await this.runDrawingLoop(userQuestion);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('SmartChatEngine error:', error);
        this.callbacks.onError?.(error);
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
      store.setActive(false);
      this.callbacks.onComplete?.();
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
  }

  private async runDrawingLoop(
    userQuestion: string
  ): Promise<void> {
    let blackboardState = useSmartChatStore.getState().blackboardState;
    let stepCount = 0;
    const maxSteps = 20;
    const nodeCounter = { value: 0 };

    while (stepCount < maxSteps) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const prompt = createFullPrompt(userQuestion, blackboardState);

      const store = useSmartChatStore.getState();
      store.setStreaming(true);

      try {
        const response = await this.callLLM(prompt);

        const llmOutput = parseLLMOutput(response);

        if (!llmOutput) {
          console.warn('[SmartChatEngine] Failed to parse LLM output, stopping');
          break;
        }

        this.callbacks.onExplainText?.(llmOutput.explainText);

        const nodeId = `node:${Date.now()}:${nodeCounter.value}:${stepCount}`;
        nodeCounter.value++;

        let node: Node | undefined;
        let edge: Edge | undefined;

        if (llmOutput.drawLogic.action === 'arrow') {
          const fromLabel = llmOutput.drawLogic.from;
          const toLabel = llmOutput.drawLogic.to;

          const currentStore = useSmartChatStore.getState();
          const allNodes = Array.from(currentStore.sessionNodes.values());

          const fromNode = allNodes.find(n => n.label === fromLabel);
          const toNode = allNodes.find(n => n.label === toLabel);

          if (fromNode && toNode) {
            edge = createEdgeFromDrawLogic(
              fromNode.id,
              toNode.id,
              llmOutput.drawLogic.label
            );

            store.addEdge(edge);
            this.callbacks.onEdgeAdded?.(edge);
          } else {
            console.warn('[SmartChatEngine] Could not find nodes for arrow connection');
          }
        } else {
          node = createNodeFromDrawLogic(
            llmOutput.targetArea,
            llmOutput.drawLogic.action,
            llmOutput.drawLogic.label || '',
            llmOutput.drawLogic.width || 200,
            llmOutput.drawLogic.height || 100,
            nodeId,
            blackboardState
          );

          store.addNode(node);
          this.callbacks.onNodeAdded?.(node);

          const drawingStep: DrawingStep = {
            explainText: llmOutput.explainText,
            targetArea: llmOutput.targetArea,
            node,
            edge: undefined,
            animationType: 'fade',
            timestamp: Date.now()
          };

          store.addDrawingStep(drawingStep);
          this.callbacks.onStepComplete?.(drawingStep);

          blackboardState = updateAreaOccupation(
            blackboardState,
            llmOutput.targetArea,
            nodeId,
            llmOutput.drawLogic.action,
            llmOutput.drawLogic.label || ''
          );

          store.updateBlackboardState(blackboardState);
        }

        if (llmOutput.drawLogic.action === 'arrow' && edge) {
          const drawingStep: DrawingStep = {
            explainText: llmOutput.explainText,
            targetArea: llmOutput.targetArea,
            node: undefined,
            edge,
            animationType: 'draw',
            timestamp: Date.now()
          };

          store.addDrawingStep(drawingStep);
          this.callbacks.onStepComplete?.(drawingStep);
        }

        stepCount++;
        store.setCurrentDrawingStep(stepCount);

        await this.delay(500);

      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('[SmartChatEngine] Error in drawing loop:', error);
          throw error;
        }
        break;
      } finally {
        store.setStreaming(false);
      }
    }
  }

  private async callLLM(
    prompt: { system: string; user: string },
    _apiEndpoint?: string,
    _apiKey?: string
  ): Promise<string> {
    if (!LLM_API_KEY) {
      throw new Error('请设置 VITE_LLM_API_KEY 环境变量');
    }

    if (!LLM_BASE_URL || !LLM_MODEL) {
      throw new Error('请设置 VITE_LLM_BASE_URL 和 VITE_LLM_MODEL 环境变量');
    }

    const apiEndpoint = `${LLM_BASE_URL}/chat/completions`;

    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ];

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false
      }),
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(newConfig: Partial<SmartChatConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SmartChatConfig {
    return { ...this.config };
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  getCurrentState(): {
    isRunning: boolean;
    stepCount: number;
    blackboardState: BlackboardState;
  } {
    const store = useSmartChatStore.getState();
    return {
      isRunning: this.isRunning,
      stepCount: store.drawingSteps.length,
      blackboardState: store.blackboardState
    };
  }
}

export function createSmartChatEngine(
  config?: Partial<SmartChatConfig>,
  callbacks?: Partial<SmartChatCallbacks>
): SmartChatEngine {
  const fullConfig: SmartChatConfig = {
    enableStreaming: config?.enableStreaming ?? true,
    maxTokens: config?.maxTokens ?? 500,
    modelName: config?.modelName ?? 'gpt-4o-mini',
    temperature: config?.temperature ?? 0.7,
    promptMaxTokens: config?.promptMaxTokens ?? 150
  };

  return new SmartChatEngine(fullConfig, callbacks);
}
