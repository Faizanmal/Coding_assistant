import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { SecurityUtils } from './utils/sanitizer';
import { ConnectionManager } from './integration/connectionManager';

dotenv.config();
const api = process.env.GROQ_API_KEY;
const tog_api = process.env.TOGETHER_API_KEY;
const op_api = process.env.OPEN_ROUTER_API_KEY;
const mist_api = process.env.MISTRAL_API_KEY;
const cere_api = process.env.CEREBRAS_API_KEY;
const tav_api = process.env.TAVILY_API_KEY;


if (!api && !tog_api && !op_api && !mist_api && !cere_api && !tav_api) {
  vscode.window.showErrorMessage('API_KEY environment variable is not set.');
}

export async function generateCode(this: any, prompt: string, Model: string): Promise<string> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api}`
      },
      body: JSON.stringify({
        model: Model,
        messages: [

          { role: 'system', content: 'You are a helpful coding assistant.'},
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
        { role: 'system', content: 'You are a helpful code assistant.Provide only the code, no explanation, no markdown formatting.And comments in comments'},
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
  // Try backend first, fallback to direct API
  try {
    const backendResult = await ConnectionManager.sendToBackend('/complete', { prompt });
    if (backendResult?.completion) {
      return backendResult.completion;
    }
  } catch (error) {
    console.log('Backend unavailable, using direct API');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  console.log(SecurityUtils.sanitizeLogInput(JSON.stringify(data)));
  return data.choices?.[0]?.message?.content || 'No fix generated';
}

export async function generateCodeTogether(prompt: string, model: string): Promise<string> {
  try {
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tog_api}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return content ?? '[Together Error] No content';
  } catch (e: any) {
    return `[Together Error] ${e.message}`;
  }
}

export async function generateCodeOpenRouter(prompt: string, model: string): Promise<string> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${op_api}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return content ?? '[OpenRouter Error] No content';
  } catch (e: any) {
    return `[OpenRouter Error] ${e.message}`;
  }
}

export async function generateCodeMistral(prompt: string, model: string): Promise<string> {
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mist_api}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return content ?? '[Mistral Error] No content';
  } catch (e: any) {
    return `[Mistral Error] ${e.message}`;
  }
}

export async function generateCodeCerebras(prompt: string, model: string): Promise<string> {
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cere_api}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful coding assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return content ?? '[Cerebras Error] No content';
  } catch (e: any) {
    return `[Cerebras Error] ${e.message}`;
  }
}

export interface TavilyResult {
	query: string;
	answer: string;
	follow_up_questions?: string[] | null;
	images?: string[];
	results?: { title: string; url: string; content?: string }[];
	response_time?: number;
}

export async function tavilySearch(query: string): Promise<TavilyResult> {
	if (!tav_api) {
		throw new Error("Missing Tavily API key. Set TAVILY_API_KEY in your environment.");
	}

	const response = await fetch('https://api.tavily.com/search', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${tav_api}`
		},
		body: JSON.stringify({
			query,
			include_images: true,
			include_answers: true,
			include_results: true
		})
	});

	if (!response.ok) {
		let errorMessage = `Tavily error: ${response.statusText}`;
		try {
			const errorData = await response.json();
			errorMessage += ` - ${JSON.stringify(errorData)}`;
		} catch {
			// do nothing, default message is enough
		}
		throw new Error(errorMessage);
	}

	const data = await response.json();
  console.log("Response:", SecurityUtils.sanitizeLogInput(JSON.stringify(data)));
	return data as TavilyResult;
}
