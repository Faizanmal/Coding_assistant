import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
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

        const enhancedParsePrompt = `You are an expert software architect. Analyze this request and create a comprehensive file generation plan.

User Request: "${prompt}"

Create a JSON array of files needed for a COMPLETE, PRODUCTION-READY implementation:

For each file, determine:
1. Exact filename with proper extension
2. Detailed description of what the file should contain
3. Programming language/framework
4. Dependencies and integrations with other files

Return ONLY valid JSON in this format:
[
    {
        "fileName": "server.js",
        "prompt": "complete Express.js server with middleware, routes, error handling, logging, security, database integration, authentication, API documentation, and production configurations",
        "language": "javascript"
    }
]

Generate a COMPLETE project structure, not just basic files. Include:
- Main application files
- Configuration files
- Documentation files
- Security and middleware files
- Database/storage files
- Testing setup files (if applicable)
- Environment and deployment files

If no clear file structure can be determined, return empty array [].`;
        
        const response = await generateCode(enhancedParsePrompt, 'llama-3.3-70b-versatile');
        
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
            // Always use multi-agent for NLP requests to get enhanced tracking
            await MultiFileGenerator.generateMultipleFiles(requests, true);
            return `✅ Generated ${requests.length} files: ${requests.map((r: any) => r.fileName).join(', ')}`;
        } catch (error: any) {
            return `❌ Failed to generate files: ${error.message}`;
        }
    }

    static isNLPFileRequest(prompt: string): boolean {
        const patterns = [
            /create.*(?:app|project|website|api|server|component)/i,
            /build.*(?:app|project|website|api|server|component)/i,
            /make.*(?:app|project|website|api|server|component)/i,
            /generate.*(?:app|project|website|api|server|component)/i,
            /setup.*(?:project|structure|app)/i,
            /scaffold/i
        ];
        
        return patterns.some(pattern => pattern.test(prompt));
    }
}