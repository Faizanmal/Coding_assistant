import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './cli-api';

interface FileGenerationRequest {
    fileName: string;
    prompt: string;
    language?: string;
}

export class MultiFileGenerator {
    static async generateMultipleFiles(requests: FileGenerationRequest[], useMultiAgent = false): Promise<void> {
        if (useMultiAgent) {
            const { MultiAgentGenerator } = await import('./multiagentgenerator');
            const tasks = requests.map(req => ({
                fileName: req.fileName,
                prompt: req.prompt,
                language: req.language || this.getLanguageFromExtension(path.extname(req.fileName))
            }));
            
            await MultiAgentGenerator.generateWithAgents(tasks);
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        const results: { file: string; success: boolean; error?: string }[] = [];

        for (const request of requests) {
            try {
                const filePath = path.join(workspaceFolder.uri.fsPath, request.fileName);
                
                if (fs.existsSync(filePath)) {
                    results.push({ 
                        file: request.fileName, 
                        success: false, 
                        error: 'File already exists' 
                    });
                    continue;
                }

                const code = await callAI(request.prompt);
                
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(filePath, code, 'utf8');
                results.push({ file: request.fileName, success: true });

            } catch (error: any) {
                results.push({ 
                    file: request.fileName, 
                    success: false, 
                    error: error.message 
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        if (successCount > 0) {
            vscode.window.showInformationMessage(
                `✅ Generated ${successCount} files successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
            );
        }
        
        if (failCount > 0) {
            const failures = results.filter(r => !r.success);
            vscode.window.showErrorMessage(
                `❌ Failed to generate: ${failures.map(f => f.file).join(', ')}`
            );
        }
    }

    static parseMultiFilePrompt(prompt: string): FileGenerationRequest[] | null {
        // Pattern: "generate files: file1.js:prompt1, file2.py:prompt2"
        const multiFilePattern = /generate\s+files?\s*:\s*(.+)/i;
        const match = prompt.match(multiFilePattern);
        
        if (!match) {return null;}

        const fileSpecs = match[1].split(',').map(spec => spec.trim());
        const requests: FileGenerationRequest[] = [];

        for (const spec of fileSpecs) {
            const colonIndex = spec.indexOf(':');
            if (colonIndex === -1) {continue;}

            const fileName = spec.substring(0, colonIndex).trim();
            const filePrompt = spec.substring(colonIndex + 1).trim();
            
            if (fileName && filePrompt) {
                const ext = path.extname(fileName).toLowerCase();
                const language = this.getLanguageFromExtension(ext);
                
                requests.push({
                    fileName,
                    prompt: filePrompt,
                    language
                });
            }
        }

        return requests.length > 0 ? requests : null;
    }

    private static getLanguageFromExtension(ext: string): string {
        const langMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown'
        };
        return langMap[ext] || 'text';
    }
}