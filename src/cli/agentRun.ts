import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import yaml from 'js-yaml';
import { callAI } from '.';

interface AgentConfig {
  name: string;
  description?: string;
  scope: string;
  prompt: string;
  output?: 'print' | 'rewrite';
}

function applyTemplate(str: string, args: Record<string, string>): string {
  return str.replace(/{{(.*?)}}/g, (_, key) => args[key.trim()] ?? '');
}

export async function agentRun(agentName: string, options: { args?: string[] }) {
  const agentPath = path.join(process.cwd(), 'agents', `${agentName}.yaml`);
  if (!fs.existsSync(agentPath)) {
    console.error(`❌ Agent config not found: ${agentPath}`);
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(agentPath, 'utf-8')) as AgentConfig;

  // Parse args (CLI -> key=value)
  const args = Object.fromEntries(
    (options.args || []).map((a) => {
      const [k, v] = a.split('=');
      return [k, v];
    })
  );

  const finalPromptTemplate = applyTemplate(config.prompt, args);
  const files = await glob(config.scope);

  if (files.length === 0) {
    console.warn(`⚠️ No files matched: ${config.scope}`);
    return;
  }

  for (const file of files) {
    const originalCode = fs.readFileSync(file, 'utf-8');
    const prompt = `${finalPromptTemplate}\n\n--- FILE START ---\n${originalCode}\n--- FILE END ---`;

    console.log(`🤖 Processing ${file}...`);
    const result = await callAI(prompt);

    if (config.output === 'rewrite') {
      fs.writeFileSync(file, result, 'utf-8');
      console.log(`✅ Rewritten: ${file}`);
    } else {
      console.log(`\n--- ${file} ---\n`);
      console.log(result);
    }
  }
}
