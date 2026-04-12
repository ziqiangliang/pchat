import { Node, Edge, SmartChatConfig, NodeType } from '../types';
import { useSmartChatStore, createNewSession } from '../stores/smartChatStore';

export interface ContentNode {
  id: string;
  label: string;
  type: 'concept' | 'process' | 'dataPoint' | 'event' | 'vertex';
  hierarchy?: 'root' | 'parent' | 'child' | 'sibling';
  relations?: string[];
  explanation?: string;
}

export interface ContentEdge {
  from: string;
  to: string;
  label?: string;
  type?: 'association' | 'dependency' | 'composition' | 'inheritance';
}

export interface StructureResult {
  nodes: ContentNode[];
  edges: ContentEdge[];
  explanation: string;
  layoutHint?: 'tree' | 'graph' | 'flow' | 'hierarchy';
}

export interface V2Callbacks {
  onExplainText: (text: string) => void;
  onStructureReady: (structure: StructureResult) => void;
  onLayoutReady: (positions: Map<string, { x: number; y: number }>) => void;
  onRenderComplete: () => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

const DEFAULT_CONFIG: SmartChatConfig = {
  enableStreaming: true,
  maxTokens: 500,
  modelName: 'gpt-4o',
  temperature: 0.7,
  promptMaxTokens: 2000
};

export class SmartChatEngineV2 {
  private callbacks: V2Callbacks;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(_config: SmartChatConfig, callbacks?: V2Callbacks) {
    this.callbacks = callbacks || {} as V2Callbacks;
  }

  async startDrawing(userQuestion: string): Promise<void> {
    if (this.isRunning) {
      console.warn('[SmartChatEngineV2] Already running');
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
      await this.runContentGenerationLoop(userQuestion);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('[SmartChatEngineV2] Error:', error);
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

  private async runContentGenerationLoop(userQuestion: string): Promise<void> {
    const stepCount = 0;
    const maxSteps = 15;

    while (stepCount < maxSteps) {
      if (this.abortController?.signal.aborted) {
        console.log('[SmartChatEngineV2] Loop aborted');
        break;
      }

      const structure = await this.generateContentStructure(userQuestion);
      console.log('[SmartChatEngineV2] Generated structure:', structure);

      if (!structure) {
        console.warn('[SmartChatEngineV2] Failed to generate structure');
        break;
      }

      this.callbacks.onExplainText?.(structure.explanation);
      console.log('[SmartChatEngineV2] Calling onStructureReady with', structure.nodes.length, 'nodes');
      this.callbacks.onStructureReady?.(structure);

      break;
    }
  }

  private async generateContentStructure(userQuestion: string): Promise<StructureResult | null> {
    const systemPrompt = `You are a content structuring AI. Given a user question, you must output a JSON structure describing:

1. NODES: Key concepts, processes, data points, or events to visualize
   - Each node has: id, label, type (concept|process|dataPoint|event|vertex), hierarchy (root|parent|child|sibling)
   - hierarchy determines the relationship level in the overall structure

2. EDGES: Relationships between nodes
   - Each edge has: from (source node id), to (target node id), label (optional), type (association|dependency|composition|inheritance)

3. EXPLANATION: The text explanation to show alongside the visualization

4. LAYOUT_HINT: How the content should be laid out (tree|graph|flow|hierarchy)

Return ONLY a valid JSON object with these fields. No markdown, no explanation.

Example:
{"nodes":[{"id":"n1","label":"Client","type":"concept","hierarchy":"root"},{"id":"n2","label":"Server","type":"concept","hierarchy":"root"},{"id":"n3","label":"Request","type":"process","hierarchy":"child","relations":["n1"]},{"id":"n4","label":"Response","type":"process","hierarchy":"child","relations":["n2"]}],"edges":[{"from":"n1","to":"n3"},{"from":"n3","to":"n2"},{"from":"n2","to":"n4"}],"explanation":"The client sends a request to the server, which processes it and returns a response.","layoutHint":"flow"}`;

    try {
      const response = await this.callLLM(userQuestion, systemPrompt);
      const cleanedResponse = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      console.log('[SmartChatEngineV2] Raw response:', response.substring(0, 200));
      console.log('[SmartChatEngineV2] Cleaned response:', cleanedResponse.substring(0, 200));

      const structure = JSON.parse(cleanedResponse) as StructureResult;
      console.log('[SmartChatEngineV2] Parsed structure:', structure);
      return this.validateStructure(structure) ? structure : null;
    } catch (error) {
      console.error('[SmartChatEngineV2] Failed to generate content:', error);
      return null;
    }
  }

  private validateStructure(structure: any): structure is StructureResult {
    if (!structure || typeof structure !== 'object') return false;
    if (!Array.isArray(structure.nodes)) return false;
    if (!Array.isArray(structure.edges)) return false;
    if (typeof structure.explanation !== 'string') return false;
    return true;
  }

  private async callLLM(userMessage: string, systemPrompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const baseUrl = import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

    if (!apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const endpoint = `${baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  convertToNodes(structure: StructureResult): Node[] {
    return structure.nodes.map(cn => ({
      id: cn.id,
      label: cn.label,
      type: cn.type as NodeType,
      domain: cn.hierarchy,
      style: this.getDefaultStyleForType(cn.type)
    }));
  }

  convertToEdges(structure: StructureResult): Edge[] {
    return structure.edges.map(ce => ({
      from: ce.from,
      to: ce.to,
      label: ce.label,
      type: 'curve' as const
    }));
  }

  private getDefaultStyleForType(type: string): any {
    const styles: Record<string, any> = {
      concept: { fill: '#e3f2fd', stroke: '#1565c0' },
      process: { fill: '#fff3e0', stroke: '#e65100' },
      dataPoint: { fill: '#e8f5e9', stroke: '#2e7d32' },
      event: { fill: '#fce4ec', stroke: '#c2185b' },
      vertex: { fill: '#f3e5f5', stroke: '#7b1fa2' }
    };
    return styles[type] || styles.concept;
  }
}

export const smartChatEngineV2 = new SmartChatEngineV2(DEFAULT_CONFIG);
