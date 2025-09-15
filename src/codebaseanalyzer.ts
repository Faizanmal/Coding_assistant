import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './cli-api';

export class CodebaseAnalyzer {
    private static codebaseContext: string = '';
    
    static async getCodebaseContext(): Promise<string> {
        if (this.codebaseContext) {return this.codebaseContext;}
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return 'No workspace open';}
        
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,js,py,java,go,rs,php,cpp,c,cs,rb,html,css,json,md}',
            '**/node_modules/**'
        );
        
        let context = `CODEBASE OVERVIEW:\n`;
        context += `Workspace: ${workspaceFolder.name}\n\n`;
        
        const filesByType: { [key: string]: string[] } = {};
        
        for (const file of files.slice(0, 50)) { // Limit to 50 files
            const ext = path.extname(file.fsPath);
            if (!filesByType[ext]) {filesByType[ext] = [];}
            filesByType[ext].push(vscode.workspace.asRelativePath(file));
        }
        
        context += `FILE STRUCTURE:\n`;
        for (const [ext, fileList] of Object.entries(filesByType)) {
            context += `${ext}: ${fileList.length} files\n`;
        }
        
        // Get key files content
        const keyFiles = ['package.json', 'README.md', 'main.py', 'app.js', 'index.ts'];
        for (const fileName of keyFiles) {
            const file = files.find(f => f.fsPath.endsWith(fileName));
            if (file) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    context += `\n--- ${fileName} ---\n${content.toString().slice(0, 500)}...\n`;
                } catch {}
            }
        }
        
        this.codebaseContext = context;
        return context;
    }
    
    static async searchCodebase(query: string): Promise<string> {
        const { SmartSearch } = await import('./smartsearch');
        return await SmartSearch.handleSearchRequest(`search ${query}`);
    }
    
    static async analyzeWithAI(question: string): Promise<string> {
        const context = await this.getCodebaseContext();
        
        const prompt = `You are analyzing a codebase. Answer the user's question based on the codebase context.

CODEBASE CONTEXT:
${context}

USER QUESTION: ${question}

Provide a helpful answer based on the codebase structure and content.`;
        
        return await callAI(prompt);
    }
    
    static clearCache(): void {
        this.codebaseContext = '';
    }
}