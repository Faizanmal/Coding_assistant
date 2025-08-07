import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getFixFromLLM } from '.'; // Ensure this is correct

interface ReviewOptions {
  file: string;
  fileB?: string;
  out?: string;
  mode?: 'full' | 'diff';
  model?: string;
  suggest?: boolean;
  apply?: boolean;
}

export async function reviewCode(options: ReviewOptions): Promise<void> {
  try {
    const { file, fileB, out, mode = 'full', suggest, apply, model = 'default' } = options;

    if (!file) { return console.error('❌ Error: --file is required');}

    if (!fs.existsSync(file)) {
      console.error(`❌ Error: File not found at ${file}`);
      process.exit(1);
    }

    if (mode === 'diff') {
      if (!fileB) {
        console.error('❌ Error: --fileB is required in diff mode');
        process.exit(1);
      }

      if (!fs.existsSync(fileB)) {
        console.error(`❌ Error: File B not found at ${fileB}`);
        process.exit(1);
      }
    }

    const filePath = path.resolve(file);
    const originalCode = fs.readFileSync(filePath, 'utf8');

    const input = (mode === 'diff' && fileB)
      ? getDiffBetweenFiles(file, fileB)
      : originalCode;



    const contentToReview = getContentToReview(file, fileB, mode);
    // const prompt = buildReviewPrompt(contentToReview, mode);

    const prompt = suggest
      ? buildSuggestionPrompt(input)
      : buildReviewPrompt(input, mode);

    const response = await getFixFromLLM(prompt);

     if (apply && suggest) {
      const suggestedCode = extractSuggestedCodeBlock(response);
      fs.writeFileSync(filePath, suggestedCode, 'utf8');
      console.log(`✅ Suggestions applied to ${file}`);
    }

    if (out) {
      fs.writeFileSync(path.resolve(out), response, 'utf8');
      console.log(`✅ Review saved to ${out}`);
    } else {
      console.log('\n🧠 AI Review:\n');
      console.log(response);
    }
  } catch (err) {
    console.error('❌ Error during review:', err);
    process.exit(1);
  }
}

function buildSuggestionPrompt(code: string): string {
  return `
You are a code refactoring assistant.

Given the following code, suggest an improved version with:
- Bug fixes
- Performance or readability improvements
- Best practices

ONLY return the full updated code in a Markdown code block, no explanation.

Code:
\`\`\`ts
${code}
\`\`\`
`;
}

function extractSuggestedCodeBlock(response: string): string {
  const match = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1] : response;
}

function getContentToReview(file: string, fileB?: string, mode: string = 'full'): string {
  if (mode === 'diff' && fileB) {
    return getDiffBetweenFiles(file, fileB);
  } else {
    return fs.readFileSync(path.resolve(file), 'utf8');
  }
}

function buildReviewPrompt(codeOrDiff: string, mode: string): string {
  return `
You are an expert software engineer. Perform a code review on the following ${mode === 'diff' ? 'diff' : 'code'}:

${codeOrDiff}

Provide:
- Bugs or logical flaws
- Suggestions for improvement
- Code style recommendations
- Security or performance concerns

Return your answer as structured Markdown bullet points.
`;
}

export function getDiffBetweenFiles(fileA: string, fileB: string): string {
  try {
    const diff = execSync(`diff -u ${fileA} ${fileB}`, { encoding: 'utf8' });
    return diff;
  } catch (e: any) {
    return e.stdout || e.message || 'No diff found.';
  }
}
