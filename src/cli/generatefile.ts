import fs from 'fs';
import path from 'path';
import { callAI } from '.'; // Your existing LLM interface

export async function generateCodeToFile(prompt: string, filePath: string) {
  try {
    const generatedCode = await callAI(prompt); // Your LLM call
    const absolutePath = path.resolve(filePath);

    // Check if file already exists
    if (fs.existsSync(absolutePath)) {
      console.error(`❌ File already exists: ${absolutePath}`);
      return;
    }

    // Ensure the directory exists
    const dir = path.dirname(absolutePath);
    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(absolutePath, generatedCode, 'utf8');
    console.log(`✅ Code written to ${absolutePath}`);
  } catch (error) {
    console.error(`❌ Error generating code:`, error);
  }
}
