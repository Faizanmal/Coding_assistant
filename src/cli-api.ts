import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '..', 'backend-server', '.env');
dotenv.config({ path: envPath });

const api = process.env.API_KEY;

export async function callAI(prompt: string): Promise<string> {
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
          { role: 'system', content: 'You are a helpful code assistant. Provide only the code, no explanation, no markdown formatting. Add comments in code if needed.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    type AIResponse = {
      choices?: { message?: { content?: string } }[];
      [key: string]: any;
    };
    
    const data = await res.json() as AIResponse;
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return '[Error] No content generated';
    }

    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);

  } catch (e: any) {
    return `[Error] ${e.message}`;
  }
}