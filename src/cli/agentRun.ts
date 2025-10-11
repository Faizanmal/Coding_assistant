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

function sanitizePath(inputPath: string, basePath: string): string {
  const normalized = path.normalize(inputPath);
  const resolved = path.resolve(basePath, normalized);
  
  // Ensure the resolved path is within the base directory
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('Path traversal detected');
  }
  
  return resolved;
}

function sanitizeAgentName(name: string): string {
  // Only allow alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid agent name');
  }
  return name;
}

export async function agentRun(agentName: string, options: { args?: string[] }) {
  try {
    const sanitizedAgentName = sanitizeAgentName(agentName);
    const agentPath = sanitizePath(`agents/${sanitizedAgentName}.yaml`, process.cwd());
    
    if (!fs.existsSync(agentPath)) {
      console.error(`❌ Agent config not found: ${path.basename(agentPath)}`);
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
    try {
      // Validate file path to prevent traversal
      const safePath = sanitizePath(file, process.cwd());
      const originalCode = fs.readFileSync(safePath, 'utf-8');
      const prompt = `${finalPromptTemplate}\n\n--- FILE START ---\n${originalCode}\n--- FILE END ---`;

      console.log(`🤖 Processing ${path.basename(safePath)}...`);
      const result = await callAI(prompt);

      if (config.output === 'rewrite') {
        fs.writeFileSync(safePath, result, 'utf-8');
        console.log(`✅ Rewritten: ${path.basename(safePath)}`);
      } else {
        console.log(`\n--- ${path.basename(safePath)} ---\n`);
        console.log(result);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
} catch (error: any) {
  console.error(`❌ Agent run failed: ${error.message}`);
  process.exit(1);
}
}
