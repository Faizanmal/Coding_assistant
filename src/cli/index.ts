#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { refactorFile } from './refactor';
import { analyzeFile } from './analyze';
import { startChat } from './ask';
import { generateFromTemplate } from './generate';
import { replaceBlockInFile } from './replace';
import { generateTest } from './generateTest';
import { explainDiff } from './explainDiff';
import { agentRun } from './agentRun';
import { generateCodeToFile } from './generatefile';
import { generateFromTemplates, buildPromptTemplate, PromptEntry } from './templatebuilder';
// import { loadCodeFiles, embedTexts, findTopMatches } from './projawareness';
import { reviewCode } from './review';
import { loadCodeFiles, chunkCode, embedTexts, cosineSimilarity, findTopMatches } from './projectawareness';


dotenv.config();
const api = process.env.API_KEY;
const tog_api = process.env.Hug_face;

export async function callAI(this: any, prompt: string): Promise<string> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
        { role: 'system', content: 'You are a helpful code assistant.Provide only the code, no explanation, no markdown formatting. And comments in code if needed'},
          { role: 'user', content: prompt }
        ]
      })
    });

  type AIResponse = {
    choices?: { message?: { content?: string } }[];
    [key: string]: any;
  };
  const data = await res.json() as AIResponse;

  const c = data?.choices?.[0]?.message?.content;

    if (!c) {return '[Error] No content';}

    return typeof c === 'string' ? c : JSON.stringify(c, null, 2);

  } catch (e: any) {
    return `[Error] ${e.message}`;
  }
}


export async function getFixFromLLM(prompt: string): Promise<string> {

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: `You are a code assistant. For any question asked, if applicable, provide updated 
          or replacement code instead of just an explanation. Format suggestions using clear 
          code blocks and explanations only when necessary.` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  console.log(data);
  return data.choices?.[0]?.message?.content || 'No fix generated';
}

const program = new Command();

program
  .name('myext')
  .description('CLI for your VS Code LLM extension')
  .version('1.0.0');
  
program
  .command('gen')
  .description('Generate code from a prompt')
  .argument('<prompt>', 'Prompt for code generation')
  .action(async (prompt: string) => {
    const spinner = ora('Thinking...').start();
    try {
    const result = await getFixFromLLM(prompt);
    spinner.succeed('Done');
    console.log(chalk.green(result));
    } catch (err) {
      spinner.fail('Error Generating code');
      console.error(err);
    }
  });

program
  .command('refactor')
  .description('Refactor a code file using LLM')
  .argument('<file>', 'Path to the code file')
  .option('--write', 'Overwrite original file', false)
  .option('--format <format>', 'Output format: code | markdown | raw', 'code')
  .action(async (file, options) => {
    await refactorFile(file, {
      write: options.write,
      format: options.format});
  });

program
  .command('analyze')
  .description('Analyze and explain a code file using LLM')
  .argument('<file>', 'Path to the code file')
  .action(async (file) => {
    await analyzeFile(file);
  });

program
  .command('ask')
  .description('Start a live chat session with LLM in the terminal')
  .action(async () => {
    await startChat();
  });

program
  .command('generate')
  .description('Generate code using a named template and arguments')
  .argument('<template>', 'Template file name (without extension)')
  .argument('[args...]', 'Arguments to replace placeholders like {resource}')
  .action(async (template, args) => {
    await generateFromTemplate(template, args);
  });

program
  .command('replace')
  .description('Replace an LLM-marked block of code in a file')
  .argument('<file>', 'Path to the file with @llm:start and @llm:end markers')
  .action(async (file) => {
    await replaceBlockInFile(file);
  });

program
  .command('generate-test <target>')
  .description('Generate unit tests from code')
  .option('--framework <jest|mocha|vitest>', 'Testing framework to use')
  .option('--output <file>', 'Write test to a file instead of stdout')
  .action(generateTest);

program
  .command('explain-diff <oldFile> <newFile>')
  .description('Explain the difference between two versions of a file using LLM')
  .action(explainDiff);
  
program
  .command('agent-run <agentName>') 
  .description('Run an LLM-powered task defined in agents/*.yaml')
  .option('--args <key=value...>', 'Arguments to pass to the agent')
  .action(agentRun);
  
// program
//   .command('generate-file')
//   .description('Generate code using LLM and save it to a new file')
//   .requiredOption('-p, --prompt <prompt>', 'Prompt for code generation')
//   .requiredOption('-f, --file <file>', 'One or more file paths')
//   .action(async (options) => {
//     for (const file of options.file) {
//     await generateCodeToFile(options.prompt, file);
//   }});  

program
  .command('generate-file')
  .description('Generate code using LLM and save it to new files')
  .requiredOption('-p, --prompt <prompts...>', 'One or more prompts for code generation')
  .requiredOption('-f, --file <files...>', 'One or more file paths to save the code')
  .action(async (options) => {
    const { prompt: prompts, file: files } = options;

    if (prompts.length !== files.length) {
      console.error('❌ The number of prompts must match the number of file paths.');
      process.exit(1);
    }

    await Promise.all(
      prompts.map((prompt: string, index: number) => generateCodeToFile(prompt, files[index]))
    );
  });

program
  .command('generate-multi')
  .description('Generate multiple files from a JSON file of prompts')
  .requiredOption('-i, --input <inputFile>', 'Path to JSON file with file-prompt pairs')
  .option('-o, --overwrite', 'Allow overwriting existing files', false)
  .action(async (options) => {  
    try {
      const inputPath = path.resolve(options.input);
      const promptData: PromptEntry[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

      const template = buildPromptTemplate(promptData);
      await generateFromTemplates(template, options.overwrite);
    } catch (err) {
      console.error('❌ Failed to generate files:', err);
    }
  });


// program
//   .command("ask_context")
//   .argument("<question>")
//   .option("-d, --dir <dir>", "Project directory", ".")
//   .option("-k, --topk <number>", "Top K results", "3")
//   .action(async (question, opts) => {
//     console.log(chalk.blue("🔍 Scanning codebase..."));
//     const files = await loadCodeFiles(opts.dir);
//     const contents = files.map((f) => f.content.slice(0, 2000));

//     console.log(chalk.blue("📊 Embedding documents..."));
//     const docEmbeddings = await embedTexts(contents);

//     console.log(chalk.blue("❓ Embedding query..."));
//     const [queryEmbedding] = await embedTexts([question]);

//     const top = findTopMatches(docEmbeddings, queryEmbedding, files, +opts.topk);

//     console.log(chalk.green("\n📄 Top Matching Files:"));
//     top.forEach((t, i) => console.log(chalk.yellow(`${i + 1}. ${t.file} (score: ${t.score.toFixed(3)})`)));

//     const context = top.map((t) => `// ${t.file}\n${t.content}`).join("\n\n");
//     const prompt = `${context}\n\nQ: ${question}\nA:`;

//     console.log(chalk.green("\n🤖 Sending to LLM..."));
//     const answer = await callAI(prompt);
//     console.log(chalk.cyan("\n=== LLM Response ===\n"), answer);
//   });

program
  .command('review')
  .description('AI-powered code review tool')
  .option('-f, --file <path>', 'Path to the input file')
  .option('-b, --fileB <path>', 'Path to the second file for diff mode')
  .option('-m, --mode <mode>', 'Review mode: full or diff', 'full')
  .option('--model <model>', 'Model to use for LLM', 'default')
  .option('--suggest', 'Generate code suggestions', false)
  .option('--apply', 'Apply suggestions directly to file', false)   
  .option('-o, --out <output>', 'Path to save the output')
  .action(async (options) => {
    try {
    await reviewCode(options);
  } catch (err) {
    console.error('❌ Error:', err);
      process.exit(1);
  }
});

program
  .command("ask_codebase")
  .argument("<question>")
  .option("-d, --dir <dir>", "Project directory", ".")
  .option("-k, --topk <number>", "Top K results", "3")
  .action(async (question, opts) => {
    console.log(chalk.blue("🔍 Scanning codebase..."));
    const files = await loadCodeFiles(opts.dir);

    console.log(chalk.blue("🔧 Chunking code..."));
    const chunks = files.flatMap(file =>
      chunkCode(file.content).map(chunk => ({
        path: file.path,
        content: chunk,
      }))
    );

    console.log(chalk.blue("📊 Embedding chunks..."));
    const embeddings = await embedTexts(chunks.map(c => c.content));

    console.log(chalk.blue("❓ Embedding question..."));
    const [queryEmbedding] = await embedTexts([question]);

    const top = findTopMatches(embeddings, queryEmbedding, chunks, +opts.topk);

    console.log(chalk.green("\n📄 Top Matching Chunks:"));
    top.forEach((t, i) =>
      console.log(chalk.yellow(`${i + 1}. ${t.file} (score: ${t.score.toFixed(3)})`))
    );

    const context = top.map((t) => `// ${t.file}\n${t.content}`).join("\n\n");
    const prompt = `${context}\n\nQ: ${question}\nA:`;

    console.log(chalk.green("\n🤖 Sending to LLM..."));
    const answer = await getFixFromLLM(prompt);

    console.log(chalk.cyan("\n=== LLM Response ===\n"), answer);
  });

program.parse(process.argv);

