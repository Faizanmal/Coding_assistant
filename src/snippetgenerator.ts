import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class SnippetGenerator {
    
    public static async generateFromDescription() {
        const description = await vscode.window.showInputBox({
            prompt: 'Describe the code snippet you need',
            placeHolder: 'e.g., API endpoint with validation, React component with hooks'
        });

        if (!description) return;

        const editor = vscode.window.activeTextEditor;
        const language = editor?.document.languageId || 'javascript';

        const prompt = `Generate a ${language} code snippet for: ${description}. Return only the code, no explanations.`;

        const snippet = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        if (editor) {
            const position = editor.selection.active;
            await editor.edit(editBuilder => {
                editBuilder.insert(position, snippet.trim());
            });
        }
    }

    public static async createBoilerplate() {
        const type = await vscode.window.showQuickPick([
            'Express Server',
            'React Component',
            'Python Class',
            'REST API',
            'Database Model',
            'Test Suite'
        ], { placeHolder: 'Choose boilerplate type' });

        if (!type) return;

        const prompt = `Generate a complete ${type} boilerplate with best practices. Include imports, error handling, and comments.`;

        const boilerplate = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const fileName = type.toLowerCase().replace(' ', '_') + '.js';
            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(boilerplate));
            
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    public static async generateRegex() {
        const description = await vscode.window.showInputBox({
            prompt: 'Describe what you want to match with regex',
            placeHolder: 'e.g., email addresses, phone numbers, URLs'
        });

        if (!description) return;

        const prompt = `Generate a regex pattern for: ${description}. Return the pattern and a brief explanation.`;

        const result = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const position = editor.selection.active;
            await editor.edit(editBuilder => {
                editBuilder.insert(position, result.trim());
            });
        }
    }
}