import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { getFixFromLLM } from '.';

function sanitizePath(inputPath: string, basePath: string): string {
  const normalized = path.normalize(inputPath);
  const resolved = path.resolve(basePath, normalized);
  
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
} 

function saveLog(content: string, prefix = 'analyze'): string {
  const dir = path.join(process.cwd(), '.llm', 'logs');
  if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(dir, `${prefix}_${timestamp}.md`);
  fs.writeFileSync(logPath, content, 'utf8');
  return logPath;
}

export async function analyzeFile(file: string) {
  const spinner = ora(`Analyzing ${path.basename(file)}...`).start();

  try {
    const safePath = sanitizePath(file, process.cwd());
    const code = fs.readFileSync(safePath, 'utf8');
    const prompt = `Analyze the following code. Explain what it does, summarize each function, and note any potential issues:\n\n${code}`;

    const result = await getFixFromLLM(prompt);
    spinner.succeed(`Analysis complete for ${path.basename(file)}`);

    console.log(chalk.green('\n🧠 Code Analysis:\n'));
    console.log(result.trim());

    const logPath = saveLog(result);
    console.log(chalk.gray(`\n📝 Saved analysis to: ${logPath}\n`));
  } catch (err: any) {
    spinner.fail('Failed to analyze file');
    console.error(chalk.red(err.message));
  }
}
    