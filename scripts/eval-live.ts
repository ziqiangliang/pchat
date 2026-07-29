import { readFileSync } from 'fs';
import { evaluateDSL, formatEvalReport } from '../src/evaluator';
import { DSL_SYSTEM_PROMPT } from '../src/config/prompts';

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const QUESTIONS = [
  'TCP 三次握手是怎么工作的？',
  '冒泡排序的原理是什么？',
];

async function generateDSL(question: string): Promise<string> {
  const res = await fetch(`${process.env.VITE_LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VITE_LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.VITE_LLM_MODEL,
      stream: false,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'system',
          content: DSL_SYSTEM_PROMPT.replace('{{LANGUAGE_CONSTRAINT}}', ''),
        },
        { role: 'user', content: question },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? '';
}

async function main() {
  console.log(`Model: ${process.env.VITE_LLM_MODEL}\n`);

  for (const question of QUESTIONS) {
    console.log('='.repeat(60));
    console.log(`Question: ${question}`);
    console.log('='.repeat(60));

    const raw = await generateDSL(question);
    const result = evaluateDSL(raw);

    console.log(formatEvalReport(result));
    console.log('');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
