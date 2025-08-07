import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import glob from "fast-glob";
import pLimit from "p-limit";
import { pipeline } from "@xenova/transformers";
import { getFixFromLLM } from "./codegenerator";
// import getFixFromLLM from './your-llm-api'; // <-- replace with your actual LLM call

dotenv.config();

let extractor: any;
const limit = pLimit(5);

// Load code files
async function loadCodeFiles(rootDir: string): Promise<{ path: string; content: string }[]> {
  const filePaths = await glob(["**/*.{ts,js,py,tsx,jsx,json}"], {
    cwd: rootDir,
    absolute: true,
    ignore: ["node_modules/**", "dist/**", "build/**", ".next/**", ".env/**"],
  });

  return filePaths.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf-8");
    return { path: path.relative(rootDir, filePath), content };
  });
}

// Chunk code by length or structure
function chunkCode(content: string, maxLen = 1000): string[] {
  const lines = content.split("\n");
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  for (const line of lines) {
    currentChunk.push(line);
    const joined = currentChunk.join("\n");

    if (
      joined.length >= maxLen ||
      /^\s*(function|class|const|let|var|async\s+function)/.test(line)
    ) {
      chunks.push(joined);
      currentChunk = [];
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n"));
  }

  return chunks;
}

// Embed text chunks using transformer
async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }

  const embeddings: number[][] = [];
  for (const text of texts) {
    const output = await limit(() =>
      extractor(text, {
        pooling: "mean",
        normalize: true,
      })
    );
    embeddings.push(output.data);
  }

  return embeddings;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Get top matching code chunks
function findTopMatches(
  embeddings: number[][],
  queryEmbedding: number[],
  metadata: { path: string; content: string }[],
  topK = 3
) {
  return embeddings
    .map((emb, i) => ({
      score: cosineSimilarity(queryEmbedding, emb),
      file: metadata[i].path,
      content: metadata[i].content,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// 🎯 🔥 Final Unified Function
export async function answerFromCodebase({
  question,
  projectDir,
  topK = 3,
  getFixFromLLM,
}: {
  question: string;
  projectDir: string;
  topK?: number;
  getFixFromLLM: (prompt: string) => Promise<string>; // pass your LLM function here
}): Promise<string> {
  const files = await loadCodeFiles(projectDir);

  const chunks = files.flatMap(file =>
    chunkCode(file.content).map(chunk => ({
      path: file.path,
      content: chunk,
    }))
  );

  const embeddings = await embedTexts(chunks.map(c => c.content));
  const [queryEmbedding] = await embedTexts([question]);

  const topMatches = findTopMatches(embeddings, queryEmbedding, chunks, topK);

  const context = topMatches
    .map(t => `// ${t.file}\n${t.content}`)
    .join("\n\n");

  const prompt = `${context}\n\nQ: ${question}\nA:`;

  const answer = await getFixFromLLM(prompt);
  return answer;
}

