// commands/generateTest.ts

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getFixFromLLM } from '.';

function sanitizePath(inputPath: string, basePath: string): string {
  const normalized = path.normalize(inputPath);
  const resolved = path.resolve(basePath, normalized);
  
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
} 

interface Options {
  framework?: 'jest' | 'mocha' | 'vitest';
  output?: string;
}

export async function generateTest(target: string, options: Options) {
  const framework = options.framework || 'jest';

  try {
    const safePath = sanitizePath(target, process.cwd());
    
    if (!fs.existsSync(safePath)) {
      console.error(`❌ Target file ${path.basename(target)} not found.`);
      process.exit(1);
    }

    const sourceCode = fs.readFileSync(safePath, 'utf-8');

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
    const safeOutputPath = sanitizePath(options.output, process.cwd());
    fs.writeFileSync(safeOutputPath, testCode, 'utf-8');
    console.log(`✅ Test code written to ${path.basename(options.output)}`);
  } else {
    console.log('\n--- Generated Test Code ---\n');
    console.log(testCode);
  }
} catch (error: any) {
  console.error(`❌ Test generation failed: ${error.message}`);
  process.exit(1);
}
}
