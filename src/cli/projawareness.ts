import fs from "fs";
import glob from "fast-glob";
import * as dotenv from 'dotenv';
import { InferenceClient } from "@huggingface/inference";

dotenv.config();
const hug_api = process.env.Hug_face;

export async function loadCodeFiles(rootDir: string): Promise<{ path: string; content: string }[]> {
  const filePaths = await glob(["**/*.ts", "**/*.js", "**/*.py", "**/*.tsx", "**/*.jsx", "**/*.json"], {
    cwd: rootDir,
    absolute: true,
    ignore: ["node_modules/**", "dist/**"],
  });

  return filePaths.map((filePath) => {
    const content = fs.readFileSync(filePath, "utf-8");
    return { path: filePath, content };
  });
}

const client = new InferenceClient(hug_api);

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = "sentence-transformers/all-MiniLM-L6-v2";

  const results = await Promise.all(
    texts.map(async (text) => {
      const output = await client.featureExtraction({
        model,
        inputs: text,
      });

      if (Array.isArray(output) && Array.isArray(output[0])) {
        return output[0] as number[]; // 2D (batched), get first
      } else {
        return output as number[]; // 1D
      }
    })
  );

  return results;
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
    .map((emb, idx) => ({
      score: cosineSimilarity(queryEmbedding, emb),
      file: metadata[idx].path,
      content: metadata[idx].content,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
