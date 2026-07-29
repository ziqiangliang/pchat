import type { EvalIssue } from './types';
import type { PromptTuneParams, PostProcessConfig, TuneThresholds } from '../config/promptTune';
import {
  DEFAULT_PROMPT_TUNE_PARAMS,
  DEFAULT_POST_PROCESS_CONFIG,
  DEFAULT_TUNE_THRESHOLDS,
} from '../config/promptTune';

export interface CaseEvalSummary {
  id: string;
  domain: string;
  score: number;
  errors: number;
  warnings: number;
  issues: EvalIssue[];
}

export interface TuneAnalysis {
  pass: boolean;
  avgScore: number;
  totalErrors: number;
  totalWarnings: number;
  weakestCases: CaseEvalSummary[];
  issueCounts: Record<string, number>;
  suggestions: string[];
}

export function analyzeTuneResults(
  cases: CaseEvalSummary[],
  thresholds: TuneThresholds = DEFAULT_TUNE_THRESHOLDS
): TuneAnalysis {
  const parseable = cases.filter((c) => c.score > 0 || c.errors === 0);
  const avgScore = parseable.length
    ? Math.round(parseable.reduce((s, c) => s + c.score, 0) / parseable.length)
    : 0;
  const totalErrors = cases.reduce((s, c) => s + c.errors, 0);
  const totalWarnings = cases.reduce((s, c) => s + c.warnings, 0);

  const issueCounts: Record<string, number> = {};
  cases.forEach((c) => {
    c.issues.forEach((issue) => {
      issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
    });
  });

  const weakestCases = [...cases]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const pass = cases.every((c) => c.score >= thresholds.minCaseScore && c.errors <= thresholds.maxErrors)
    && avgScore >= thresholds.minAvgScore
    && totalErrors <= thresholds.maxErrors
    && totalWarnings <= thresholds.maxWarnings;

  const suggestions: string[] = [];
  if (issueCounts.MISSING_NODE_LABEL) suggestions.push('启用 vertex label 修复与 Prompt 强调');
  if (issueCounts.EDGE_LABEL_OVERLAP || issueCounts.EDGE_NODE_LABEL_OVERLAP) {
    suggestions.push('用 dataPoint 中间节点或 timeline 分段，避免连线 label 堆在中点');
  }
  if (issueCounts.NODE_OVERLAP || issueCounts.NODE_TOO_CLOSE || issueCounts.LABEL_OVERLAP) {
    suggestions.push('增大节点间距 / 算法题使用 data 布局 / 避免节点 label 重叠');
  }
  if (issueCounts.TIMELINE_UNKNOWN_NODE) {
    suggestions.push('timeline 的 from/to 必须引用当前可见节点');
  }
  if (issueCounts.TOO_MANY_NODES_PER_STEP) suggestions.push('降低每步最大节点数');
  if (issueCounts.TOO_MANY_STEPS) suggestions.push('降低 maxSteps');
  if (issueCounts.DANGLING_EDGE_FROM || issueCounts.DANGLING_EDGE_TO) suggestions.push('强调 connect 引用已存在节点');
  if (issueCounts.HIGHLIGHT_UNKNOWN_NODE || issueCounts.REMOVE_UNKNOWN_NODE) suggestions.push('强调 highlight/remove 可见性');

  return {
    pass,
    avgScore,
    totalErrors,
    totalWarnings,
    weakestCases,
    issueCounts,
    suggestions,
  };
}

export function adjustTuneParams(
  params: PromptTuneParams,
  postProcess: PostProcessConfig,
  analysis: TuneAnalysis
): { params: PromptTuneParams; postProcess: PostProcessConfig; changes: string[] } {
  const nextParams = { ...params };
  const nextPost = { ...postProcess };
  const changes: string[] = [];
  const counts = analysis.issueCounts;

  if (counts.MISSING_NODE_LABEL) {
    if (!nextPost.fillVertexLabelFromId) {
      nextPost.fillVertexLabelFromId = true;
      changes.push('postProcess.fillVertexLabelFromId = true');
    }
    if (!nextParams.emphasizeVertexLabel) {
      nextParams.emphasizeVertexLabel = true;
      changes.push('prompt.emphasizeVertexLabel = true');
    }
  }

  const hasNodeLayoutIssues = Boolean(
    counts.NODE_OVERLAP || counts.NODE_TOO_CLOSE || counts.LABEL_OVERLAP
  );
  const hasEdgeLabelIssues = Boolean(
    counts.EDGE_LABEL_OVERLAP || counts.EDGE_NODE_LABEL_OVERLAP
  );

  if (hasEdgeLabelIssues) {
    if (!nextParams.emphasizeEdgeLabelLayout) {
      nextParams.emphasizeEdgeLabelLayout = true;
      changes.push('prompt.emphasizeEdgeLabelLayout = true');
    }
    if (!nextParams.emphasizeRemoveCleanup) {
      nextParams.emphasizeRemoveCleanup = true;
      changes.push('prompt.emphasizeRemoveCleanup = true (cleanup temp packet nodes)');
    }
  }

  if (hasNodeLayoutIssues || hasEdgeLabelIssues) {
    if (nextParams.minHorizontalSpacing < 150) {
      nextParams.minHorizontalSpacing += 20;
      changes.push(`prompt.minHorizontalSpacing → ${nextParams.minHorizontalSpacing}`);
    }
    if (nextParams.minVerticalSpacing < 120) {
      nextParams.minVerticalSpacing += 20;
      changes.push(`prompt.minVerticalSpacing → ${nextParams.minVerticalSpacing}`);
    }
  }

  if (hasNodeLayoutIssues) {
    if (!nextParams.emphasizeDataLayoutForAlgorithm) {
      nextParams.emphasizeDataLayoutForAlgorithm = true;
      changes.push('prompt.emphasizeDataLayoutForAlgorithm = true');
    }
    if (!nextPost.injectDataLayoutForAlgorithm) {
      nextPost.injectDataLayoutForAlgorithm = true;
      changes.push('postProcess.injectDataLayoutForAlgorithm = true');
    }
  }

  if (counts.TOO_MANY_NODES_PER_STEP && nextParams.maxNodesPerStep > 1) {
    nextParams.maxNodesPerStep -= 1;
    changes.push(`prompt.maxNodesPerStep → ${nextParams.maxNodesPerStep}`);
  }

  if (counts.TOO_MANY_STEPS && nextParams.maxSteps > 5) {
    nextParams.maxSteps -= 1;
    changes.push(`prompt.maxSteps → ${nextParams.maxSteps}`);
  }

  if (counts.DANGLING_EDGE_FROM || counts.DANGLING_EDGE_TO) {
    if (!nextParams.emphasizeHighlightVisible) {
      nextParams.emphasizeHighlightVisible = true;
      changes.push('prompt.emphasizeHighlightVisible = true');
    }
  }

  if (counts.HIGHLIGHT_UNKNOWN_NODE || counts.REMOVE_UNKNOWN_NODE || counts.TIMELINE_UNKNOWN_NODE) {
    if (!nextParams.emphasizeHighlightVisible) {
      nextParams.emphasizeHighlightVisible = true;
      changes.push('prompt.emphasizeHighlightVisible = true');
    }
    if (!nextParams.emphasizeRemoveCleanup) {
      nextParams.emphasizeRemoveCleanup = true;
      changes.push('prompt.emphasizeRemoveCleanup = true');
    }
  }

  if (changes.length === 0 && !analysis.pass) {
    if (nextParams.maxSteps > 5) {
      nextParams.maxSteps -= 1;
      changes.push(`prompt.maxSteps → ${nextParams.maxSteps} (fallback)`);
    }
  }

  return { params: nextParams, postProcess: nextPost, changes };
}

export function cloneDefaults() {
  return {
    params: { ...DEFAULT_PROMPT_TUNE_PARAMS },
    postProcess: { ...DEFAULT_POST_PROCESS_CONFIG },
    thresholds: { ...DEFAULT_TUNE_THRESHOLDS },
  };
}
