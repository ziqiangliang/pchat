import { DSL } from '../types';
import { PostProcessConfig, DEFAULT_POST_PROCESS_CONFIG } from '../config/promptTune';

export interface PostProcessResult {
  dsl: DSL;
  repairs: string[];
}

const ALGORITHM_KEYWORDS = /排序|查找|数组|算法|binary|sort|search/i;

function fillVertexLabels(dsl: DSL, repairs: string[]): void {
  dsl.steps.forEach((step, stepIndex) => {
    step.add?.forEach((node, nodeIndex) => {
      if (!node.id) return;
      if (node.type === 'vertex' && (!node.label || node.label.trim() === '')) {
        node.label = node.id;
        repairs.push(`steps[${stepIndex}].add[${nodeIndex}]: vertex label ← id "${node.id}"`);
      }
    });
  });
}

function injectDataLayout(dsl: DSL, question: string, repairs: string[]): void {
  const title = `${dsl.title ?? ''} ${dsl.meta?.domain ?? ''}`;
  if (!ALGORITHM_KEYWORDS.test(`${title} ${question}`)) return;
  if (dsl.layoutHints?.type === 'data') return;

  dsl.layoutHints = { ...dsl.layoutHints, type: 'data' };
  repairs.push('layoutHints.type ← data (algorithm keyword detected)');
}

function clampStepCount(dsl: DSL, maxSteps: number, repairs: string[]): void {
  if (dsl.steps.length <= maxSteps) return;
  const removed = dsl.steps.length - maxSteps;
  dsl.steps = dsl.steps.slice(0, maxSteps);
  repairs.push(`steps: truncated ${removed} trailing step(s) to max ${maxSteps}`);
}

export function postProcessDSL(
  dsl: DSL,
  config: PostProcessConfig = DEFAULT_POST_PROCESS_CONFIG,
  options?: { question?: string; maxSteps?: number }
): PostProcessResult {
  const cloned: DSL = JSON.parse(JSON.stringify(dsl));
  const repairs: string[] = [];

  if (config.fillVertexLabelFromId) {
    fillVertexLabels(cloned, repairs);
  }

  if (config.injectDataLayoutForAlgorithm && options?.question) {
    injectDataLayout(cloned, options.question, repairs);
  }

  if (options?.maxSteps) {
    clampStepCount(cloned, options.maxSteps, repairs);
  }

  return { dsl: cloned, repairs };
}

export function buildRepairPrompt(issues: string[]): string {
  return [
    '你上一次输出的 DSL 存在以下问题，请修复后重新输出完整 JSON（只输出 JSON，不要解释）：',
    ...issues.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
}

export function formatEvalIssuesForRetry(
  issues: Array<{ severity: string; code: string; message: string; stepIndex?: number }>
): string[] {
  return issues
    .filter((item) => item.severity === 'error' || item.severity === 'warning')
    .slice(0, 8)
    .map((item) => {
      const at = item.stepIndex !== undefined ? ` (step ${item.stepIndex + 1})` : '';
      return `[${item.code}]${at} ${item.message}`;
    });
}
