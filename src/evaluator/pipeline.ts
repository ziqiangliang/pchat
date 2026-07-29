import {
  postProcessDSL,
  buildRepairPrompt,
  formatEvalIssuesForRetry,
} from '../utils/dslPostProcessor';
import { PostProcessConfig } from '../config/promptTune';
import { evaluateDSL, evaluateDSLObject, buildEvalResult } from './dslEvaluator';
import { computeCaseMetrics, type CaseMetrics } from './metrics';
import type { DSLEvalResult } from './types';

export interface ProcessedEvalResult extends DSLEvalResult {
  repairs: string[];
  retried: boolean;
  metrics: CaseMetrics;
  rawDsl?: DSLEvalResult['dsl'];
}

export interface FullPipelineResult {
  raw: string;
  rawEval: DSLEvalResult;
  result: ProcessedEvalResult;
}

export function evaluateWithPostProcess(
  rawText: string,
  postProcess: PostProcessConfig,
  options?: { question?: string; maxSteps?: number }
): ProcessedEvalResult {
  const rawEval = evaluateDSL(rawText);
  const rawScore = rawEval.overallScore;

  if (!rawEval.parseable || !rawEval.dsl) {
    const metrics = computeCaseMetrics(undefined, {
      raw: rawScore,
      postProcess: rawScore,
      final: rawScore,
    }, { retried: false, repairCount: 0 });

    return { ...rawEval, repairs: [], retried: false, metrics, rawDsl: undefined };
  }

  const { dsl, repairs } = postProcessDSL(rawEval.dsl, postProcess, {
    question: options?.question,
    maxSteps: options?.maxSteps,
  });

  const processedIssues = evaluateDSLObject(dsl).issues;
  const promptIssues = rawEval.issues.filter((item) => item.category === 'prompt');
  const merged = buildEvalResult([...promptIssues, ...processedIssues], true, dsl);
  const postScore = merged.overallScore;

  const metrics = computeCaseMetrics(dsl, {
    raw: rawScore,
    postProcess: postScore,
    final: postScore,
  }, { retried: false, repairCount: repairs.length });

  return {
    ...merged,
    repairs,
    retried: false,
    metrics,
    rawDsl: rawEval.dsl,
  };
}

export async function generateAndEvaluateCase(options: {
  question: string;
  systemPrompt: string;
  postProcess: PostProcessConfig;
  maxSteps: number;
  enableRetry: boolean;
  fetchImpl?: typeof fetch;
}): Promise<FullPipelineResult> {
  const fetchFn = options.fetchImpl ?? fetch;
  const baseUrl = process.env.VITE_LLM_BASE_URL;
  const apiKey = process.env.VITE_LLM_API_KEY;
  const model = process.env.VITE_LLM_MODEL;

  async function callLLM(messages: Array<{ role: string; content: string }>) {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        thinking: { type: 'disabled' },
        messages,
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0]?.message?.content ?? '';
  }

  const messages = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.question },
  ];

  let raw = await callLLM(messages);
  const rawEval = evaluateDSL(raw);
  let result = evaluateWithPostProcess(raw, options.postProcess, {
    question: options.question,
    maxSteps: options.maxSteps,
  });

  if (options.enableRetry) {
    const retryIssues = formatEvalIssuesForRetry(result.issues);
    if (retryIssues.length > 0 && result.overallScore < 95) {
      const repairPrompt = buildRepairPrompt(retryIssues);
      raw = await callLLM([
        ...messages,
        { role: 'assistant', content: raw },
        { role: 'user', content: repairPrompt },
      ]);
      result = evaluateWithPostProcess(raw, options.postProcess, {
        question: options.question,
        maxSteps: options.maxSteps,
      });
      result.retried = true;
      result.metrics = {
        ...result.metrics,
        scoreFinal: result.overallScore,
        scoreDeltaRetry: result.overallScore - result.metrics.scorePostProcess,
        retried: true,
      };
    }
  }

  return { raw, rawEval, result };
}
