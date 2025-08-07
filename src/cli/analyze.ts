import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { getFixFromLLM } from '.'; 

function saveLog(content: string, prefix = 'analyze'): string {
  const dir = path.join(process.cwd(), '.llm', 'logs');
  if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(dir, `${prefix}_${timestamp}.md`);
  fs.writeFileSync(logPath, content, 'utf8');
  return logPath;
}

export async function analyzeFile(file: string) {
  const spinner = ora(`Analyzing ${file}...`).start();

  try {
    const code = fs.readFileSync(file, 'utf8');
    const prompt = `Analyze the following code. Explain what it does, summarize each function, and note any potential issues:\n\n${code}`;

    const result = await getFixFromLLM(prompt);
    spinner.succeed(`Analysis complete for ${file}`);

    console.log(chalk.green('\n🧠 Code Analysis:\n'));
    console.log(result.trim());

    const logPath = saveLog(result);
    console.log(chalk.gray(`\n📝 Saved analysis to: ${logPath}\n`));
  } catch (err) {
    spinner.fail('Failed to analyze file');
    console.error(chalk.red(err));
  }
}
    