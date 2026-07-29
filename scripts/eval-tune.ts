import { readFileSync } from 'fs';
import { buildDSLSystemPrompt } from '../src/config/prompts';
import {
  DEFAULT_PROMPT_TUNE_PARAMS,
  DEFAULT_POST_PROCESS_CONFIG,
  DEFAULT_TUNE_THRESHOLDS,
  PromptTuneParams,
  PostProcessConfig,
} from '../src/config/promptTune';
import { BENCHMARK_CASES, QUICK_BENCHMARK_IDS } from '../evaluator/benchmarkCases';
import {
  analyzeTuneResults,
  adjustTuneParams,
  cloneDefaults,
  type CaseEvalSummary,
} from '../src/evaluator/tuneAnalyzer';
import { generateAndEvaluateCase } from '../src/evaluator/pipeline';
import {
  computeAggregateMetrics,
  formatAggregateMetrics,
} from '../src/evaluator/metrics';
import {
  buildPromptVersion,
  createRunOutputDir,
  saveRawDSL,
  saveRunReport,
} from '../src/evaluator/reportWriter';

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const MAX_ITERATIONS = Number(process.env.TUNE_MAX_ITERATIONS ?? 5);
const useQuick = process.argv.includes('--quick');
const enableRetry = !process.argv.includes('--no-retry');

interface IterationRecord {
  iteration: number;
  promptVersion: ReturnType<typeof buildPromptVersion>;
  params: PromptTuneParams;
  postProcess: PostProcessConfig;
  analysis: ReturnType<typeof analyzeTuneResults>;
  aggregate: ReturnType<typeof computeAggregateMetrics>;
  cases: CaseEvalSummary[];
  caseDetails: Array<Record<string, unknown>>;
  paramChanges: string[];
}

async function runIteration(
  iteration: number,
  params: PromptTuneParams,
  postProcess: PostProcessConfig,
  cases: typeof BENCHMARK_CASES,
  outputDir: string
): Promise<IterationRecord> {
  const systemPrompt = buildDSLSystemPrompt(params);
  const promptVersion = buildPromptVersion(params, postProcess);
  const summaries: CaseEvalSummary[] = [];
  const caseDetails: Array<Record<string, unknown>> = [];

  console.log(`\n${'#'.repeat(70)}`);
  console.log(`Iteration ${iteration} | Prompt ${promptVersion.version}`);
  console.log(`Params: maxSteps=${params.maxSteps}, maxNodes=${params.maxNodesPerStep}, h=${params.minHorizontalSpacing}, v=${params.minVerticalSpacing}`);
  console.log('#'.repeat(70));

  for (const testCase of cases) {
    const start = Date.now();
    process.stdout.write(`  [${testCase.id}] `);

    try {
      const { raw, result } = await generateAndEvaluateCase({
        question: testCase.question,
        systemPrompt,
        postProcess,
        maxSteps: params.maxSteps,
        enableRetry,
      });

      saveRawDSL(outputDir, `${testCase.id}-iter${iteration}`, raw, result.dsl);

      const errors = result.issues.filter((i) => i.severity === 'error').length;
      const warnings = result.issues.filter((i) => i.severity === 'warning').length;
      const m = result.metrics;

      console.log(
        `${result.overallScore} steps=${m.steps} Δpp=${m.scoreDeltaPostProcess} ` +
        `Δretry=${m.scoreDeltaRetry} ${Date.now() - start}ms`
      );

      summaries.push({
        id: testCase.id,
        domain: testCase.domain,
        score: result.overallScore,
        errors,
        warnings,
        issues: result.issues,
      });

      caseDetails.push({
        id: testCase.id,
        question: testCase.question,
        score: result.overallScore,
        metrics: m,
        repairs: result.repairs,
        retried: result.retried,
        rawDslPath: `raw/${testCase.id}-iter${iteration}.txt`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAILED: ${message}`);
      summaries.push({
        id: testCase.id,
        domain: testCase.domain,
        score: 0,
        errors: 1,
        warnings: 0,
        issues: [],
      });
    }
  }

  const analysis = analyzeTuneResults(summaries, DEFAULT_TUNE_THRESHOLDS);
  const aggregate = computeAggregateMetrics(
    caseDetails
      .filter((c) => c.metrics)
      .map((c) => ({
        metrics: c.metrics as import('../src/evaluator/metrics').CaseMetrics,
        errors: summaries.find((s) => s.id === c.id)?.errors ?? 0,
        warnings: summaries.find((s) => s.id === c.id)?.warnings ?? 0,
      }))
  );

  console.log(`\n  → ${formatAggregateMetrics(aggregate).split('\n').join('\n  → ')}`);
  console.log(`  → Pass: ${analysis.pass ? 'YES' : 'NO'}`);

  return {
    iteration,
    promptVersion,
    params: { ...params },
    postProcess: { ...postProcess },
    analysis,
    aggregate,
    cases: summaries,
    caseDetails,
    paramChanges: [],
  };
}

async function main() {
  const cases = useQuick
    ? BENCHMARK_CASES.filter((c) => QUICK_BENCHMARK_IDS.includes(c.id))
    : BENCHMARK_CASES;

  let { params, postProcess } = cloneDefaults();
  params = { ...DEFAULT_PROMPT_TUNE_PARAMS };
  postProcess = { ...DEFAULT_POST_PROCESS_CONFIG };

  const initialVersion = buildPromptVersion(params, postProcess);
  const outputDir = createRunOutputDir('tune', initialVersion.version);

  console.log(`Model: ${process.env.VITE_LLM_MODEL}`);
  console.log(`Cases: ${cases.length} | Max iter: ${MAX_ITERATIONS}`);
  console.log(`Output: ${outputDir}`);

  const records: IterationRecord[] = [];
  let paramChanges: string[] = [];

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const record = await runIteration(i, params, postProcess, cases, outputDir);
    record.paramChanges = paramChanges;
    records.push(record);

    if (record.analysis.pass) {
      console.log('\n✓ Thresholds met.');
      break;
    }

    if (i === MAX_ITERATIONS) break;

    const adjusted = adjustTuneParams(params, postProcess, record.analysis);
    if (adjusted.changes.length === 0) {
      console.log('\nNo further adjustments.');
      break;
    }

    console.log('\n  Next iteration adjustments:');
    adjusted.changes.forEach((c) => console.log(`    - ${c}`));
    params = adjusted.params;
    postProcess = adjusted.postProcess;
    paramChanges = adjusted.changes;
  }

  const best = [...records].sort((a, b) => b.aggregate.avgScore - a.aggregate.avgScore)[0];
  const reportFile = saveRunReport(outputDir, {
    model: process.env.VITE_LLM_MODEL,
    timestamp: new Date().toISOString(),
    options: { useQuick, enableRetry, maxIterations: MAX_ITERATIONS },
    bestIteration: best.iteration,
    bestPromptVersion: best.promptVersion,
    records,
  });

  console.log(`\nBest iter: ${best.iteration} | Avg: ${best.aggregate.avgScore} | Report: ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
