import * as fs from 'fs';
import * as path from 'path';
import { callAI } from '.';


export interface PromptEntry {
  file: string;
  prompt: string;
}

export function buildPromptTemplate(entries: PromptEntry[]): string {
  let template = `You are a code generator. Based on the following instructions, generate the corresponding code for each file.\n\n`;

  for (const entry of entries) {
    template += `### File: ${entry.file}\n`;
    template += `Prompt: ${entry.prompt}\n\n`;
  }

//   template += `Respond with code in this format:\n`;
  template += `Respond with code **in separate code blocks**, one per file, using this format:\n\n`;
  template += "```filename\n<filename>\n<code>\n```\n";
  template += `\nDo not put multiple files in the same block.`;

  return template;
}

export async function generateFromTemplates(template: string, overwrite: boolean = false) {
  try {
    const response = await callAI(template);
    const matches = [...response.matchAll(/```(?:[a-zA-Z0-9+-]*)\s+([\w./-]+)\n([\s\S]*?)```/g)];

    console.log("🧪 Matches found:", matches.length);
    if (matches.length === 0) {
      console.error("❌ No valid file/code blocks found in response.");
      return;
    }

    for (const [, filename, code] of matches) {

      const absolutePath = path.resolve(filename);
      const dir = path.dirname(absolutePath);

      if (fs.existsSync(absolutePath) && !overwrite) {
        console.warn(`⚠️ File already exists & overwrite is disable. Enable Overwrite if you want to update existing file: ${absolutePath}`);
        continue;
      }

      fs.mkdirSync(dir, { recursive: true });
//      fs.writeFileSync(absolutePath, code.trimStart().trimEnd(), 'utf8');

      if (overwrite && fs.existsSync(absolutePath)) {
        // fs.appendFileSync(absolutePath, '\n\n' + code.trim(), 'utf8');
        fs.appendFileSync(absolutePath,`\n\n// ---- Generated Code Below ----\n${code.trim()}`,'utf8');
        console.log(`🔁 Appended to existing file: ${absolutePath}`);
        } else {
        fs.writeFileSync(absolutePath, code.trim(), 'utf8');
        console.log(`✅ File written: ${absolutePath}`);
}

      console.log(`✅ File written: ${absolutePath}`);
    }
  } catch (err) {
    console.error("❌ Error during template generation:", err);
  }
}
