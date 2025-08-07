import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { getFixFromLLM } from '.'; 

function replacePlaceholders(template: string, args: string[]): string {
  return template.replace(/{(\w+)}/g, (_, key) => args.shift() || `{${key}}`);
}

function saveOutputFile(output: string, type = 'generate'): string {
  const dir = path.join(process.cwd(), '.llm', 'output');
  if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${type}_${timestamp}.ts`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, output, 'utf8');
  return filePath;
}

export async function generateFromTemplate(templateName: string, args: string[]) {
  const spinner = ora(`Generating code from template: ${templateName}`).start();

  try {
    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.txt`);
    if (!fs.existsSync(templatePath)) {throw new Error(`Template not found: ${templatePath}`);}

    const template = fs.readFileSync(templatePath, 'utf8');
    const prompt = replacePlaceholders(template, [...args]);

    const rawResponse = await getFixFromLLM(prompt);

    const code = rawResponse.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1]?.trim() || rawResponse.trim();
    const savedPath = saveOutputFile(code);

    spinner.succeed(`Code generated and saved to: ${chalk.green(savedPath)}`);
    console.log(chalk.gray(`\n🧠 Prompt used:\n${prompt}\n`));
  } catch (err) {
    spinner.fail('Failed to generate code');
    console.error(chalk.red(err));
  }
}
    