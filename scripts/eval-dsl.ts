import { readFile } from 'fs/promises';
import { evaluateDSL, formatEvalReport } from '../src/evaluator';

async function readInput(path?: string): Promise<string> {
  if (path === '--stdin') {
    return await new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  }

  if (!path) {
    throw new Error('Usage: npm run eval:dsl -- <file.json|--stdin> [--json]');
  }

  return readFile(path, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const inputPath = args.find((arg) => !arg.startsWith('--'));

  const raw = await readInput(inputPath);
  const result = evaluateDSL(raw);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatEvalReport(result));
  }

  process.exit(result.parseable && result.overallScore >= 60 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
