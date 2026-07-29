import { readFileSync } from 'fs';
import { buildDSLSystemPrompt } from '../src/config/prompts';
import {
  DEFAULT_PROMPT_TUNE_PARAMS,
  DEFAULT_POST_PROCESS_CONFIG,
} from '../src/config/promptTune';
import { BENCHMARK_CASES, QUICK_BENCHMARK_IDS } from '../evaluator/benchmarkCases';
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

const useQuick = process.argv.includes('--quick');
const openOnly = process.argv.includes('--open');
const enableRetry = !process.argv.includes('--no-retry');

function selectCases() {
  const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const filterId = cliArgs[0];

  if (filterId && BENCHMARK_CASES.some((c) => c.id === filterId)) {
    return BENCHMARK_CASES.filter((c) => c.id === filterId);
  }

  if (openOnly) return BENCHMARK_CASES.filter((c) => c.open);
  if (useQuick) return BENCHMARK_CASES.filter((c) => QUICK_BENCHMARK_IDS.includes(c.id));
  return BENCHMARK_CASES;
}

async function main() {
  const cases = selectCases();
  const promptVersion = buildPromptVersion(DEFAULT_PROMPT_TUNE_PARAMS, DEFAULT_POST_PROCESS_CONFIG);
  const systemPrompt = buildDSLSystemPrompt(DEFAULT_PROMPT_TUNE_PARAMS);
  const outputDir = createRunOutputDir('batch', promptVersion.version);

  console.log(`Model: ${process.env.VITE_LLM_MODEL}`);
  console.log(`Prompt version: ${promptVersion.version} (${promptVersion.promptHash})`);
  console.log(`Cases: ${cases.length} | Retry: ${enableRetry}`);
  console.log(`Output: ${outputDir}\n`);

  const caseResults = [];

  for (const testCase of cases) {
    const start = Date.now();
    const tag = testCase.open ? '[open]' : '';
    process.stdout.write(`${tag}[${testCase.id}] ${testCase.question.slice(0, 30)}... `);

    try {
      const { raw, rawEval, result } = await generateAndEvaluateCase({
        question: testCase.question,
        systemPrompt,
        postProcess: DEFAULT_POST_PROCESS_CONFIG,
        maxSteps: DEFAULT_PROMPT_TUNE_PARAMS.maxSteps,
        enableRetry,
      });

      saveRawDSL(outputDir, testCase.id, raw, result.dsl);

      const errors = result.issues.filter((i) => i.severity === 'error').length;
      const warnings = result.issues.filter((i) => i.severity === 'warning').length;
      const m = result.metrics;

      console.log(
        `${result.overallScore} (${result.grade}) ` +
        `steps=${m.steps} nodes/step=${m.avgNodesPerStep} ` +
        `Δpp=${m.scoreDeltaPostProcess} Δretry=${m.scoreDeltaRetry} ` +
        `${Date.now() - start}ms`
      );

      caseResults.push({
        id: testCase.id,
        domain: testCase.domain,
        open: testCase.open ?? false,
        question: testCase.question,
        score: result.overallScore,
        grade: result.grade,
        parseable: result.parseable,
        errors,
        warnings,
        metrics: m,
        repairs: result.repairs,
        retried: result.retried,
        topIssues: result.issues
          .filter((i) => i.severity !== 'info')
          .slice(0, 3)
          .map((i) => `[${i.severity}] ${i.code}`),
        durationMs: Date.now() - start,
        scoreRaw: rawEval.overallScore,
        rawDslPath: `raw/${testCase.id}.txt`,
        processedDslPath: `raw/${testCase.id}.processed.json`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAILED: ${message}`);
      caseResults.push({
        id: testCase.id,
        domain: testCase.domain,
        open: testCase.open ?? false,
        question: testCase.question,
        score: 0,
        grade: 'F',
        parseable: false,
        errors: 1,
        warnings: 0,
        error: message,
        durationMs: Date.now() - start,
      });
    }
  }

  const validCases = caseResults.filter((c) => c.metrics);
  const aggregate = computeAggregateMetrics(
    validCases.map((c) => ({
      metrics: c.metrics!,
      errors: c.errors ?? 0,
      warnings: c.warnings ?? 0,
    }))
  );

  console.log('\n' + '='.repeat(70));
  console.log('AGGREGATE METRICS');
  console.log('='.repeat(70));
  console.log(formatAggregateMetrics(aggregate));

  const report = {
    model: process.env.VITE_LLM_MODEL,
    timestamp: new Date().toISOString(),
    promptVersion,
    options: { useQuick, openOnly, enableRetry },
    aggregate,
    cases: caseResults,
  };

  const reportFile = saveRunReport(outputDir, report);
  console.log(`\nReport: ${reportFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
