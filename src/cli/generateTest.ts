// commands/generateTest.ts

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getFixFromLLM } from '.'; 

interface Options {
  framework?: 'jest' | 'mocha' | 'vitest';
  output?: string;
}

export async function generateTest(target: string, options: Options) {
  const framework = options.framework || 'jest';

  if (!fs.existsSync(target)) {
    console.error(`❌ Target file ${target} not found.`);
    process.exit(1);
  }

  const sourceCode = fs.readFileSync(target, 'utf-8');

  const prompt = `
You are an expert software engineer.
Generate unit tests in ${framework} for the following code.
Ensure test coverage for edge cases and normal cases.

--- CODE START ---
${sourceCode}
--- CODE END ---

Only return the test file content, no explanation.
`;

  console.log(`🤖 Generating ${framework} tests for ${target}...`);
  const testCode = await getFixFromLLM(prompt); // this calls your LLM

  if (options.output) {
    fs.writeFileSync(options.output, testCode, 'utf-8');
    console.log(`✅ Test code written to ${options.output}`);
  } else {
    console.log('\n--- Generated Test Code ---\n');
    console.log(testCode);
  }
}
