import { DSL } from '../types';

/**
 * 解析结果类型
 */
export interface ParseResult {
  success: boolean;
  data?: DSL;
  error?: string;
  errors?: string[];
}

/**
 * 从文本中提取平衡的 JSON 字符串
 * 解决 AI 输出可能包含额外文本的问题
 */
export function extractBalancedJson(text: string): string | null {
  // 尝试找到 JSON 开始位置
  const jsonStart = text.indexOf('{');
  if (jsonStart === -1) {
    return null;
  }

  // 从开始位置提取可能的 JSON
  const potentialJson = text.slice(jsonStart);

  // 检查是否有完整的括号匹配
  let braceCount = 0;
  let bracketCount = 0;

  for (const char of potentialJson) {
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;

    // 当所有括号都匹配完成时，返回到此处
    if (braceCount === 0 && bracketCount === 0 && potentialJson.indexOf(char) > 0) {
      // 检查后面是否有非空白字符，如果没有则返回
      const rest = potentialJson.slice(potentialJson.indexOf(char) + 1).trim();
      if (!rest || rest === '' || rest === '```') {
        return potentialJson.slice(0, potentialJson.indexOf(char) + 1);
      }
    }
  }

  // 如果还不完整，返回 null
  return null;
}

/**
 * 验证 DSL 结构的完整性和正确性
 */
export function validateDSL(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查是否为对象
  if (!json || typeof json !== 'object') {
    errors.push('DSL 必须是对象');
    return { valid: false, errors };
  }

  const dsl = json as Record<string, unknown>;

  // 检查 steps 是否存在
  if (!dsl.steps) {
    errors.push('缺少 steps 字段');
  } else if (!Array.isArray(dsl.steps)) {
    errors.push('steps 必须是数组');
  } else if (dsl.steps.length === 0) {
    errors.push('steps 不能为空');
  } else {
    // 验证每个 step
    dsl.steps.forEach((step: unknown, index: number) => {
      if (!step || typeof step !== 'object') {
        errors.push(`steps[${index}] 必须是对象`);
        return;
      }

      const stepObj = step as Record<string, unknown>;

      // 每个 step 必须有 text
      if (!stepObj.text && typeof stepObj.text !== 'string') {
        errors.push(`steps[${index}] 缺少 text 字段`);
      }
    });
  }

  // 验证 meta（如果存在）
  if (dsl.meta !== undefined) {
    if (!dsl.meta || typeof dsl.meta !== 'object') {
      errors.push('meta 必须是对象');
    } else {
      const meta = dsl.meta as Record<string, unknown>;
      // domain 可以是任意描述性字符串，不做严格枚举限制
      if (meta.domain && typeof meta.domain !== 'string') {
        errors.push('domain 必须是字符串');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 带反馈的 DSL 解析
 * 提供友好的错误信息
 */
export function parseDSLWithFeedback(text: string): ParseResult {
  // 尝试直接解析
  try {
    const directMatch = text.match(/\{[\s\S]*\}/);
    if (directMatch) {
      const parsed = JSON.parse(directMatch[0]);
      const validation = validateDSL(parsed);

      if (validation.valid) {
        return { success: true, data: parsed };
      }

      // 如果验证失败，返回验证错误
      return {
        success: false,
        error: validation.errors[0],
        errors: validation.errors
      };
    }
  } catch {
    // 继续尝试提取
  }

  // 尝试提取平衡的 JSON
  const extracted = extractBalancedJson(text);
  if (!extracted) {
    return {
      success: false,
      error: '无法找到有效的 JSON 对象'
    };
  }

  try {
    const parsed = JSON.parse(extracted);
    const validation = validateDSL(parsed);

    if (validation.valid) {
      return { success: true, data: parsed };
    }

    return {
      success: false,
      error: validation.errors[0],
      errors: validation.errors
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'JSON 解析错误';
    return {
      success: false,
      error: `JSON 解析失败: ${errorMessage}`
    };
  }
}

/**
 * 安全地解析可能包含 JSON 的文本
 */
export function safeParseDSL(text: string): ParseResult {
  if (!text || text.trim() === '') {
    return {
      success: false,
      error: '输入为空'
    };
  }

  return parseDSLWithFeedback(text);
}

/**
 * 清理文本中的 markdown 代码块标记
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/g, '')
    .replace(/^```\s*/g, '')
    .replace(/```$/g, '')
    .trim();
}

/**
 * 流式解析器：提取已完成的 steps
 * 用于流式接收时实时解析部分 DSL
 */
export interface StreamingParseResult {
  completedSteps: unknown[];
  remainingContent: string;
  isComplete: boolean;
  partialStep: unknown | null;
}

export function extractStreamingSteps(content: string): StreamingParseResult {
  if (!content || content.trim() === '') {
    return {
      completedSteps: [],
      remainingContent: '',
      isComplete: false,
      partialStep: null
    };
  }

  const cleanedContent = cleanMarkdown(content);
  
  let completedSteps: unknown[] = [];
  let remainingContent = cleanedContent;
  let isComplete = false;
  let partialStep: unknown | null = null;

  // 尝试渐进式提取 steps
  const result = extractPartialSteps(cleanedContent);
  completedSteps = result.completedSteps;
  partialStep = result.partialStep;
  remainingContent = result.remainingContent;

  // 检查 steps 数组是否完整（通过检查 ] 的数量）
  const bracketCount = (cleanedContent.match(/\[\s*\]|\[|\]/g) || [])
    .reduce((count, char) => {
      if (char === '[') return count + 1;
      if (char === ']') return count - 1;
      return count;
    }, 0);

  // 如果没有剩余的未关闭的 [，则认为完成
  // 但如果有未完成的 step（partialStep），则认为未完成
  isComplete = bracketCount <= 0 && partialStep === null && completedSteps.length > 0;

  return {
    completedSteps,
    remainingContent,
    isComplete,
    partialStep
  };
}

/**
 * 渐进式提取 steps
 * 尝试从可能不完整的 JSON 中提取已完成的 step 对象
 * 使用括号平衡计数算法，支持嵌套的 {} 和 []
 */
function extractPartialSteps(content: string): {
  completedSteps: unknown[];
  partialStep: unknown | null;
  remainingContent: string;
} {
  const completedSteps: unknown[] = [];
  let partialStep: unknown | null = null;
  let remainingContent = content;
  let lastParsedIndex = 0;

  // 查找 "steps": [ 的位置（而不是随便一个 [）
  const stepsKeyPattern = /"steps"\s*:\s*\[/;
  const stepsMatch = content.match(stepsKeyPattern);
  if (!stepsMatch) {
    return { completedSteps, partialStep, remainingContent };
  }
  
  // 找到 steps 数组的起始位置（[ 的位置）
  const stepsArrayStart = content.indexOf('[', stepsMatch.index!);
  if (stepsArrayStart === -1) {
    return { completedSteps, partialStep, remainingContent };
  }

  // 从数组开始位置查找完整的对象
  let searchStart = stepsArrayStart + 1;
  let inString = false;
  let stringChar = '';
  let braceCount = 0;
  let bracketCount = 0;

  for (let i = searchStart; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // 处理字符串
    if (!inString && (char === '"' || char === "'")) {
      // 检查是否是转义的引号
      if (prevChar !== '\\') {
        inString = true;
        stringChar = char;
      }
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = '';
    }

    // 如果在字符串内，跳过括号计数
    if (inString) continue;

    // 括号计数
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;

    // 当遇到一个完整的对象结束时（} 且 braceCount 回到 0）
    if (char === '}' && braceCount === 0) {
      // 向前找最近的未配对的 {
      let objectStart = i;
      let tempBraceCount = 0;
      
      for (let j = i - 1; j >= searchStart; j--) {
        const c = content[j];
        if (c === '}') {
          tempBraceCount++;
        } else if (c === '{') {
          if (tempBraceCount > 0) {
            tempBraceCount--;
          } else {
            objectStart = j;
            break;
          }
        }
      }
      
      const potentialObject = content.slice(objectStart, i + 1);
      
      // 尝试解析为 JSON
      try {
        const parsed = JSON.parse(potentialObject);
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          completedSteps.push(parsed);
          lastParsedIndex = i + 1;
        }
      } catch {
        // JSON 解析失败，可能是部分的，尝试提取 text
        const textMatch = potentialObject.match(/"text"\s*:\s*"([^"]*)"/);
        if (textMatch) {
          partialStep = { text: textMatch[1] };
        }
      }
    }
  }

  // 移除已提取的部分
  if (lastParsedIndex > 0) {
    remainingContent = content.slice(lastParsedIndex);
  }

  return {
    completedSteps,
    partialStep,
    remainingContent
  };
}

/**
 * 从部分内容中提取单个 step
 * 更激进的提取策略，用于流式接收
 */
export function extractPartialStep(content: string): {
  step: unknown | null;
  remainingContent: string;
  isComplete: boolean;
} {
  if (!content) {
    return { step: null, remainingContent: '', isComplete: false };
  }

  // 查找最近的 { 和 } 
  let braceStart = -1;
  let braceCount = 0;
  let braceEnd = -1;

  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i] === '}') {
      braceEnd = i;
      braceCount = 1;
      break;
    }
  }

  if (braceEnd === -1) {
    return { step: null, remainingContent: content, isComplete: false };
  }

  // 从 braceEnd 向前找对应的 {
  for (let i = braceEnd - 1; i >= 0; i--) {
    if (content[i] === '}') braceCount++;
    else if (content[i] === '{') {
      braceCount--;
      if (braceCount === 0) {
        braceStart = i;
        break;
      }
    }
  }

  if (braceStart === -1) {
    return { step: null, remainingContent: content, isComplete: false };
  }

  const potentialStep = content.slice(braceStart, braceEnd + 1);
  
  try {
    const parsed = JSON.parse(potentialStep);
    if (parsed && typeof parsed === 'object' && 'text' in parsed) {
      return {
        step: parsed,
        remainingContent: content.slice(0, braceStart) + content.slice(braceEnd + 1),
        isComplete: true
      };
    }
  } catch {
    // JSON 不完整
  }

  // 检查是否有 text 字段的部分内容
  const textMatch = content.match(/"text"\s*:\s*"([^"]*)"/);
  if (textMatch) {
    return {
      step: { text: textMatch[1] },
      remainingContent: content,
      isComplete: false
    };
  }

  return { step: null, remainingContent: content, isComplete: false };
}