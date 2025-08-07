import fs from "fs";
import path from "path";
import dotenv from 'dotenv';
import glob from "fast-glob";
import pLimit from "p-limit";
import { pipeline } from "@xenova/transformers";

dotenv.config();

// Load code files from directory
export async function loadCodeFiles(rootDir: string): Promise<{ path: string; content: string }[]> {
  const filePaths = await glob(["**/*.ts", "**/*.js", "**/*.py", "**/*.tsx", "**/*.jsx", "**/*.json"], {
    cwd: rootDir,
    absolute: true,
    ignore: ["node_modules/**", "dist/**", "build/**", ".next/**",".env/","backend-server/.env/"],
  });

  return filePaths.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf-8");
    return { path: path.relative(rootDir, filePath), content };
  });
}

export function chunkCode(content: string, maxLen = 1000): string[] {
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

let extractor: any;
const limit = pLimit(5);

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }

  const embeddings: number[][] = [];

  for (const text of texts) {
    const output = await limit(() =>
      extractor(text, {
        pooling: "mean",      // average the embeddings
        normalize: true,      // unit vector
      })
    );
    embeddings.push(output.data);
  }

  return embeddings;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

export function findTopMatches(
  embeddings: number[][],
  queryEmbedding: number[],
  metadata: { path: string; content: string }[],
  topK: number = 3
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
