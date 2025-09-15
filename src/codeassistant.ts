import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class CodeAssistant {
    
    public static async explainCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showErrorMessage('Select code to explain');
            return;
        }

        const prompt = `Explain this ${editor.document.languageId} code in simple terms:

${code}`;

        const explanation = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const panel = vscode.window.createWebviewPanel(
            'codeExplanation',
            'Code Explanation',
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `<!DOCTYPE html>
        <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Code Explanation</h2>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
        ${explanation}
        </div></body></html>`;
    }

    public static async generateTests() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Generate comprehensive unit tests for this ${editor.document.languageId} code:

${code}`;

        const tests = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const testPath = vscode.Uri.joinPath(workspaceFolder.uri, 'test.js');
            await vscode.workspace.fs.writeFile(testPath, Buffer.from(tests));
            
            const doc = await vscode.workspace.openTextDocument(testPath);
            await vscode.window.showTextDocument(doc);
        }
    }

    public static async optimizeCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showErrorMessage('Select code to optimize');
            return;
        }

        const prompt = `Optimize this ${editor.document.languageId} code for better performance and readability:

${code}`;

        const optimized = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, optimized.trim());
        });
    }
}