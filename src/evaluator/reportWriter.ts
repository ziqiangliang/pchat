import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildDSLSystemPrompt } from '../config/prompts';
import { PromptTuneParams, PostProcessConfig } from '../config/promptTune';

export interface PromptVersionInfo {
  version: string;
  params: PromptTuneParams;
  postProcess: PostProcessConfig;
  promptHash: string;
}

export function buildPromptVersion(
  params: PromptTuneParams,
  postProcess: PostProcessConfig
): PromptVersionInfo {
  const prompt = buildDSLSystemPrompt(params);
  const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 12);
  const version = `p${promptHash}`;
  return { version, params, postProcess, promptHash };
}

export function createRunOutputDir(prefix: string, promptVersion: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join('evaluator', 'results', `${prefix}-${promptVersion}-${timestamp}`);
  mkdirSync(join(dir, 'raw'), { recursive: true });
  return dir;
}

export function saveRawDSL(
  outputDir: string,
  caseId: string,
  raw: string,
  processed?: unknown
): void {
  writeFileSync(join(outputDir, 'raw', `${caseId}.txt`), raw, 'utf8');
  if (processed !== undefined) {
    writeFileSync(
      join(outputDir, 'raw', `${caseId}.processed.json`),
      JSON.stringify(processed, null, 2),
      'utf8'
    );
  }
}

export function saveRunReport(outputDir: string, report: unknown): string {
  const file = join(outputDir, 'report.json');
  writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
  return file;
}
