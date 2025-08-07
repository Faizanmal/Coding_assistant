// commands/explainDiff.ts

import fs from 'fs';
import path from 'path';
import { getFixFromLLM } from '.';

export async function explainDiff(oldPath: string, newPath: string) {
  if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) {
    console.error('❌ One or both files do not exist.');
    process.exit(1);
  }

  const oldCode = fs.readFileSync(oldPath, 'utf-8');
  const newCode = fs.readFileSync(newPath, 'utf-8');

  const prompt = `
You are a senior developer. Explain the difference between two versions of a file.
Highlight what changed, why it likely changed, and any improvements or regressions.

--- OLD VERSION ---
${oldCode}
--- NEW VERSION ---
${newCode}

Respond with a short, professional explanation in markdown format.
`;

  console.log('🤖 Analyzing file differences...');
  const explanation = await getFixFromLLM(prompt);

  console.log('\n--- Diff Explanation ---\n');
  console.log(explanation);
}
