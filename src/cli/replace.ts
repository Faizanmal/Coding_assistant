import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { getFixFromLLM } from '.'; 

const START_MARKER = '// @llm:start';
const END_MARKER = '// @llm:end';

export async function replaceBlockInFile(file: string) {
  const spinner = ora(`Replacing LLM block in ${file}`).start();

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    const startIndex = lines.findIndex(line => line.includes(START_MARKER));
    const endIndex = lines.findIndex(line => line.includes(END_MARKER));

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      spinner.fail('Could not find a valid @llm block in the file.');
      return;
    }

    const block = lines.slice(startIndex + 1, endIndex).join('\n');
    const prompt = `Improve and clean up this TypeScript code block. Fix any issues and optimize it:\n\n${block}`;

    const rawOutput = await getFixFromLLM(prompt);
    const code = rawOutput.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1]?.trim() || rawOutput.trim();

    const newLines = [
      ...lines.slice(0, startIndex + 1),
      ...code.split('\n'),
      ...lines.slice(endIndex)
    ];

    fs.writeFileSync(file, newLines.join('\n'), 'utf8');
    spinner.succeed(`Replaced block successfully in ${file}`);
  } catch (err) {
    spinner.fail('Failed to replace block.');
    console.error(chalk.red(err));
  }
}
