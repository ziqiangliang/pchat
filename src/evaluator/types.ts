import { DSL } from '../types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type EvalCategory =
  | 'parse'
  | 'schema'
  | 'semantic'
  | 'layout'
  | 'pedagogy'
  | 'prompt';

export interface EvalIssue {
  severity: IssueSeverity;
  category: EvalCategory;
  code: string;
  message: string;
  stepIndex?: number;
  path?: string;
}

export interface CategoryScore {
  score: number;
  weight: number;
  issues: EvalIssue[];
}

export type EvalGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DSLEvalResult {
  parseable: boolean;
  overallScore: number;
  grade: EvalGrade;
  categories: Record<EvalCategory, CategoryScore>;
  issues: EvalIssue[];
  summary: string;
  dsl?: DSL;
}

export const CATEGORY_WEIGHTS: Record<EvalCategory, number> = {
  parse: 0.25,
  schema: 0.15,
  semantic: 0.25,
  layout: 0.15,
  pedagogy: 0.1,
  prompt: 0.1
};
