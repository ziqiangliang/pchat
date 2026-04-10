import { BlackboardState, generateCompactSummary, AreaId } from '../stores/blackboardState';
import { Node, Edge, Step } from '../types';

export interface LLMOutput {
  explainText: string;
  targetArea: AreaId;
  drawLogic: DrawLogic;
}

export interface DrawLogic {
  action: 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'triangle' | 'diamond';
  label?: string;
  width?: number;
  height?: number;
  radius?: number;
  from?: string;
  to?: string;
  color?: string;
}

export interface DSLCommand {
  type: 'DRAW' | 'TEXT' | 'CONNECT' | 'ANIMATE' | 'HIGHLIGHT';
  area?: AreaId;
  node?: Partial<Node>;
  edge?: Partial<Edge>;
  step?: Partial<Step>;
  raw?: string;
}

export interface TransformedInstruction {
  explainText: string;
  dslCommands: DSLCommand[];
  targetArea: AreaId;
}

const SYSTEM_PROMPT = `你是一个专业的边讲边画AI助手，擅长在虚拟黑板上分步绘制示意图。

核心职责：
1. 根据用户问题，逐步讲解技术概念
2. 在黑板的不同区域绘制图形（矩形、圆形、箭头等）
3. 每一步仅输出一句讲解 + 一个绘图指令

黑板区域划分（8个固定区域）：
- top-left：左上区域
- top-right：右上区域
- middle-left：左中区域
- middle-right：右中区域
- middle-center：中中区域
- bottom-left：左下区域
- bottom-center：中下区域
- bottom-right：右下区域

绘图指令格式：
- 矩形：rect(width=200, height=100, label="标签文字")
- 圆形：circle(radius=50, label="标签文字")
- 箭头：arrow(from="源标签", to="目标标签")
- 文字：text(content="文字内容")

重要规则：
1. 仅从"可用区域"中选择下一个绘图区域
2. 讲解文字简洁，1句话即可
3. 不输出任何坐标信息，坐标由前端计算
4. 绘图逻辑清晰，包含必要的尺寸和标签信息
5. 如果需要连接两个已存在的元素，使用arrow指令

请严格按照以下JSON格式输出（不要输出其他内容）：
{
  "explainText": "讲解文字",
  "targetArea": "区域ID",
  "drawLogic": {
    "action": "指令类型",
    ...其他参数
  }
}`;

export function generatePrompt(
  userQuestion: string,
  blackboardState: BlackboardState
): string {
  const summary = generateCompactSummary(blackboardState);
  
  const prompt = `用户问题：${userQuestion}

当前黑板状态：
- 已占用区域：${summary.occupiedAreas}
- 可用区域：${summary.availableAreas}
- 已画元素：${summary.elementSummary}

请输出下一步的讲解文本、目标区域和绘图指令。`;

  return prompt;
}

export function createFullPrompt(
  userQuestion: string,
  blackboardState: BlackboardState
): { system: string; user: string } {
  return {
    system: SYSTEM_PROMPT,
    user: generatePrompt(userQuestion, blackboardState)
  };
}

export function parseLLMOutput(rawOutput: string): LLMOutput | null {
  try {
    const cleanedOutput = cleanJSONString(rawOutput);
    const parsed = JSON.parse(cleanedOutput);
    
    if (!parsed.explainText || !parsed.targetArea || !parsed.drawLogic) {
      console.error('Missing required fields in LLM output:', parsed);
      return null;
    }

    const validAreas: AreaId[] = [
      'top-left', 'top-right', 'middle-left', 'middle-right',
      'middle-center', 'bottom-left', 'bottom-center', 'bottom-right'
    ];

    if (!validAreas.includes(parsed.targetArea)) {
      console.error('Invalid target area:', parsed.targetArea);
      return null;
    }

    return {
      explainText: String(parsed.explainText),
      targetArea: parsed.targetArea as AreaId,
      drawLogic: {
        action: parsed.drawLogic.action,
        label: parsed.drawLogic.label,
        width: parsed.drawLogic.width,
        height: parsed.drawLogic.height,
        radius: parsed.drawLogic.radius,
        from: parsed.drawLogic.from,
        to: parsed.drawLogic.to,
        color: parsed.drawLogic.color
      }
    };
  } catch (error) {
    console.error('Failed to parse LLM output:', error);
    return null;
  }
}

function cleanJSONString(str: string): string {
  let cleaned = str.trim();
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  cleaned = cleaned.replace(/```json\n?/g, '');
  cleaned = cleaned.replace(/```\n?/g, '');
  
  return cleaned;
}

export function convertToDSL(
  llmOutput: LLMOutput,
  coordinates: { x: number; y: number },
  nodeId: string
): DSLCommand[] {
  const commands: DSLCommand[] = [];
  
  const { drawLogic } = llmOutput;
  
  switch (drawLogic.action) {
    case 'rect':
      commands.push({
        type: 'DRAW',
        area: llmOutput.targetArea,
        node: {
          id: nodeId,
          type: 'concept',
          label: drawLogic.label || '',
          x: coordinates.x,
          y: coordinates.y,
          size: {
            width: drawLogic.width || 200,
            height: drawLogic.height || 100
          }
        }
      });
      break;

    case 'circle':
      commands.push({
        type: 'DRAW',
        area: llmOutput.targetArea,
        node: {
          id: nodeId,
          type: 'vertex',
          label: drawLogic.label || '',
          x: coordinates.x,
          y: coordinates.y,
          size: {
            radius: drawLogic.radius || 50
          }
        }
      });
      break;

    case 'triangle':
      commands.push({
        type: 'DRAW',
        area: llmOutput.targetArea,
        node: {
          id: nodeId,
          type: 'process',
          label: drawLogic.label || '',
          x: coordinates.x,
          y: coordinates.y,
          size: {
            width: drawLogic.width || 100,
            height: drawLogic.height || 100
          }
        }
      });
      break;

    case 'diamond':
      commands.push({
        type: 'DRAW',
        area: llmOutput.targetArea,
        node: {
          id: nodeId,
          type: 'dataPoint',
          label: drawLogic.label || '',
          x: coordinates.x,
          y: coordinates.y,
          size: {
            width: drawLogic.width || 80,
            height: drawLogic.height || 80
          }
        }
      });
      break;

    case 'text':
      commands.push({
        type: 'DRAW',
        area: llmOutput.targetArea,
        node: {
          id: nodeId,
          type: 'annotation',
          label: drawLogic.label || '',
          x: coordinates.x,
          y: coordinates.y
        }
      });
      break;

    case 'arrow':
      if (drawLogic.from && drawLogic.to) {
        commands.push({
          type: 'CONNECT',
          edge: {
            from: drawLogic.from,
            to: drawLogic.to,
            label: drawLogic.label,
            type: 'arrow',
            style: {
              color: drawLogic.color || '#666'
            }
          }
        });
      }
      break;

    default:
      console.warn('Unknown draw action:', drawLogic.action);
  }

  return commands;
}

export function transformInstruction(
  llmOutput: LLMOutput,
  coordinates: { x: number; y: number },
  nodeId: string
): TransformedInstruction {
  return {
    explainText: llmOutput.explainText,
    dslCommands: convertToDSL(llmOutput, coordinates, nodeId),
    targetArea: llmOutput.targetArea
  };
}

export function estimatePromptTokens(prompt: string): number {
  const words = prompt.split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

export function validatePromptLength(prompt: string, maxTokens: number = 150): boolean {
  const estimatedTokens = estimatePromptTokens(prompt);
  return estimatedTokens <= maxTokens;
}

export function parseStreamingChunk(chunk: string): Partial<LLMOutput> | null {
  try {
    const parsed = JSON.parse(chunk);
    return {
      explainText: parsed.explainText,
      targetArea: parsed.targetArea,
      drawLogic: parsed.drawLogic
    };
  } catch {
    return null;
  }
}
