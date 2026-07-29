import { DSL } from '../types';
import type { DSLEvalResult } from './types';

export interface StepDistribution {
  min: number;
  max: number;
  median: number;
  mean: number;
  histogram: Record<string, number>;
}

export interface CaseMetrics {
  steps: number;
  nodesPerStep: number[];
  avgNodesPerStep: number;
  totalNodesAdded: number;
  stepDistribution: StepDistribution;
  scoreRaw: number;
  scorePostProcess: number;
  scoreFinal: number;
  scoreDeltaPostProcess: number;
  scoreDeltaRetry: number;
  retried: boolean;
  repairCount: number;
}

export interface AggregateMetrics {
  caseCount: number;
  avgScore: number;
  avgSteps: number;
  avgNodesPerStep: number;
  stepDistribution: StepDistribution;
  totalErrors: number;
  totalWarnings: number;
  avgScoreDeltaPostProcess: number;
  avgScoreDeltaRetry: number;
  retriedCount: number;
  repairedCount: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildStepDistribution(values: number[]): StepDistribution {
  if (values.length === 0) {
    return { min: 0, max: 0, median: 0, mean: 0, histogram: {} };
  }

  const histogram: Record<string, number> = {};
  values.forEach((v) => {
    const key = String(v);
    histogram[key] = (histogram[key] ?? 0) + 1;
  });

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    median: median(values),
    mean: Math.round((sum / values.length) * 10) / 10,
    histogram,
  };
}

export function computeCaseMetrics(
  dsl: DSL | undefined,
  scores: {
    raw: number;
    postProcess: number;
    final: number;
  },
  options: { retried: boolean; repairCount: number }
): CaseMetrics {
  const nodesPerStep = (dsl?.steps ?? []).map((step) => step.add?.length ?? 0);
  const totalNodesAdded = nodesPerStep.reduce((a, b) => a + b, 0);
  const steps = dsl?.steps.length ?? 0;
  const avgNodesPerStep = steps > 0
    ? Math.round((totalNodesAdded / steps) * 10) / 10
    : 0;

  return {
    steps,
    nodesPerStep,
    avgNodesPerStep,
    totalNodesAdded,
    stepDistribution: buildStepDistribution(nodesPerStep),
    scoreRaw: scores.raw,
    scorePostProcess: scores.postProcess,
    scoreFinal: scores.final,
    scoreDeltaPostProcess: scores.postProcess - scores.raw,
    scoreDeltaRetry: scores.final - scores.postProcess,
    retried: options.retried,
    repairCount: options.repairCount,
  };
}

export function computeAggregateMetrics(
  cases: Array<{ metrics: CaseMetrics; errors: number; warnings: number }>
): AggregateMetrics {
  const stepCounts = cases.map((c) => c.metrics.steps);
  const nodesPerStepAll = cases.flatMap((c) => c.metrics.nodesPerStep);
  const scores = cases.map((c) => c.metrics.scoreFinal);

  return {
    caseCount: cases.length,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
    avgSteps: stepCounts.length
      ? Math.round((stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length) * 10) / 10
      : 0,
    avgNodesPerStep: nodesPerStepAll.length
      ? Math.round((nodesPerStepAll.reduce((a, b) => a + b, 0) / nodesPerStepAll.length) * 10) / 10
      : 0,
    stepDistribution: buildStepDistribution(stepCounts),
    totalErrors: cases.reduce((s, c) => s + c.errors, 0),
    totalWarnings: cases.reduce((s, c) => s + c.warnings, 0),
    avgScoreDeltaPostProcess: cases.length
      ? Math.round(cases.reduce((s, c) => s + c.metrics.scoreDeltaPostProcess, 0) / cases.length * 10) / 10
      : 0,
    avgScoreDeltaRetry: cases.length
      ? Math.round(cases.reduce((s, c) => s + c.metrics.scoreDeltaRetry, 0) / cases.length * 10) / 10
      : 0,
    retriedCount: cases.filter((c) => c.metrics.retried).length,
    repairedCount: cases.filter((c) => c.metrics.repairCount > 0).length,
  };
}

export function formatAggregateMetrics(metrics: AggregateMetrics): string {
  const lines = [
    `Cases: ${metrics.caseCount} | Avg score: ${metrics.avgScore}`,
    `Steps: mean=${metrics.stepDistribution.mean}, median=${metrics.stepDistribution.median}, min=${metrics.stepDistribution.min}, max=${metrics.stepDistribution.max}`,
    `Avg nodes/step: ${metrics.avgNodesPerStep}`,
    `Score Δ postProcess: ${metrics.avgScoreDeltaPostProcess} | Score Δ retry: ${metrics.avgScoreDeltaRetry}`,
    `Retried: ${metrics.retriedCount} | Repaired: ${metrics.repairedCount}`,
    `Errors: ${metrics.totalErrors} | Warnings: ${metrics.totalWarnings}`,
    `Step histogram: ${JSON.stringify(metrics.stepDistribution.histogram)}`,
  ];
  return lines.join('\n');
}

export function extractScores(result: DSLEvalResult): number {
  return result.overallScore;
}
