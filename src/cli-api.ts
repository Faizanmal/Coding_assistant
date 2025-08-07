// import { generateFromPrompt } from './llm/extension';
// import { savePromptToHistory } from './history';
import { callAI } from "./codegenerator";

export async function handlePrompt(prompt: string): Promise<string> {
  const result = await callAI(prompt);
  savePromptToHistory(prompt, result);
  return result;
}

const history: { prompt: string; result: string }[] = [];

export function savePromptToHistory(prompt: string, result: string) {
  history.push({ prompt, result });
}

export function getHistory() {
  return history;
}
