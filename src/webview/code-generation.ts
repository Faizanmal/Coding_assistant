// Unified code generation utilities for webview
import { 
    generateCode,
    generateCodeTogether, 
    generateCodeOpenRouter, 
    generateCodeMistral, 
    generateCodeCerebras 
} from '../codegenerator';

export async function generateCodeUnified(provider: string, model: string, prompt: string): Promise<string> {
    switch (provider) {
        case 'together':
            return generateCodeTogether(prompt, model.replace('together/', ''));
        case 'openrouter':
            return generateCodeOpenRouter(prompt, model.replace('openrouter/', ''));
        case 'mistral':
            return generateCodeMistral(prompt, model);
        case 'cerebras':
            return await generateCodeCerebras(prompt, model);
        case 'groq':
        default:
            return generateCode(prompt, model);
    }
}