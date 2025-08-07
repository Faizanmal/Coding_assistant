import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { getFixFromLLM } from '.';

function extractCode(text: string): string {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

function wrapMarkdown(code: string, lang: string = 'ts'): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function saveLogFile(content: string, prefix = 'refactor'): string {
  const dir = path.join(process.cwd(), '.llm', 'logs');
  if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `${prefix}_${timestamp}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

export async function refactorFile(file: string, options: {
  write: boolean;
  format: 'code' | 'markdown' | 'raw';
}) {
  const spinner = ora(`Refactoring ${file}...`).start();
  try {
    const input = fs.readFileSync(file, 'utf8');
    const prompt = `Refactor and improve the following code. Keep the same functionality. Return the updated code in a code block:\n\n${input}`;
    
    const llmResponse = await getFixFromLLM(prompt);
    const rawOutput = llmResponse.trim();

    const logPath = saveLogFile(rawOutput);
    spinner.info(`Raw output saved to: ${chalk.cyan(logPath)}`);

    let outputCode = rawOutput;
    if (options.format === 'code') {
      outputCode = extractCode(rawOutput);
    } else if (options.format === 'markdown') {
      outputCode = wrapMarkdown(extractCode(rawOutput));
    }

    const outputPath = options.write
      ? file
      : file.replace(/\.ts$/, '.refactored.ts');

    fs.writeFileSync(outputPath, outputCode, 'utf8');
    spinner.succeed(`Saved refactored code to: ${chalk.green(outputPath)}`);
  } catch (err) {
    spinner.fail('Error during refactoring');
    console.error(chalk.red(err));
  }
}
