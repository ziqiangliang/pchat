export interface PromptTuneParams {
  maxSteps: number;
  maxNodesPerStep: number;
  minHorizontalSpacing: number;
  minVerticalSpacing: number;
  emphasizeDataLayoutForAlgorithm: boolean;
  emphasizeVertexLabel: boolean;
  emphasizeRemoveCleanup: boolean;
  emphasizeHighlightVisible: boolean;
  /** 避免连线 label 堆叠在中点（如 TCP 握手、多步协议） */
  emphasizeEdgeLabelLayout: boolean;
}

export const DEFAULT_PROMPT_TUNE_PARAMS: PromptTuneParams = {
  maxSteps: 8,
  maxNodesPerStep: 1,
  minHorizontalSpacing: 160,
  minVerticalSpacing: 120,
  emphasizeDataLayoutForAlgorithm: true,
  emphasizeVertexLabel: false,
  emphasizeRemoveCleanup: true,
  emphasizeHighlightVisible: true,
  emphasizeEdgeLabelLayout: true,
};

export interface PostProcessConfig {
  fillVertexLabelFromId: boolean;
  injectDataLayoutForAlgorithm: boolean;
}

export const DEFAULT_POST_PROCESS_CONFIG: PostProcessConfig = {
  fillVertexLabelFromId: true,
  injectDataLayoutForAlgorithm: true,
};

export interface TuneThresholds {
  minCaseScore: number;
  minAvgScore: number;
  maxErrors: number;
  maxWarnings: number;
}

export const DEFAULT_TUNE_THRESHOLDS: TuneThresholds = {
  minCaseScore: 95,
  minAvgScore: 97,
  maxErrors: 0,
  maxWarnings: 2,
};
