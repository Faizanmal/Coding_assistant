import * as vscode from 'vscode';
import { callAI } from './cli-api';
import { MultiFileGenerator } from './multifilegenerator';

export class NLPFileGenerator {
    static async parseNaturalLanguage(prompt: string): Promise<any> {
        const parsePrompt = `Parse this natural language request into a JSON array of file generation tasks:

"${prompt}"

Extract:
1. File names with extensions
2. What each file should contain
3. Programming language/framework context

Return ONLY valid JSON in this format:
[
    {
        "fileName": "example.js",
        "prompt": "create express server with basic routes",
        "language": "javascript"
    }
]

If no files are mentioned, return empty array [].`;

        const response = await callAI(parsePrompt);
        
        try {
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return [];
        }
    }

    static async generateFromNLP(prompt: string): Promise<string> {
        const requests = await this.parseNaturalLanguage(prompt);
        
        if (!requests || requests.length === 0) {
            return "❌ No file generation tasks found in your request.";
        }

        try {
            await MultiFileGenerator.generateMultipleFiles(requests);
            return `✅ Generated ${requests.length} files: ${requests.map((r: any) => r.fileName).join(', ')}`;
        } catch (error: any) {
            return `❌ Failed to generate files: ${error.message}`;
        }
    }

    static isNLPFileRequest(prompt: string): boolean {
        const patterns = [
            /create.*files?/i,
            /generate.*files?/i,
            /make.*files?/i,
            /build.*project/i,
            /setup.*structure/i,
            /scaffold/i
        ];
        
        return patterns.some(pattern => pattern.test(prompt));
    }
}