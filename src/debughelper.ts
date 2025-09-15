import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class DebugHelper {
    
    public static async analyzeError() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        if (diagnostics.length === 0) {
            vscode.window.showInformationMessage('No errors found');
            return;
        }

        const error = diagnostics[0];
        const errorLine = editor.document.lineAt(error.range.start.line).text;
        const context = editor.document.getText(new vscode.Range(
            Math.max(0, error.range.start.line - 3),
            0,
            Math.min(editor.document.lineCount - 1, error.range.start.line + 3),
            0
        ));

        const prompt = `Analyze this error and provide a solution:
Error: ${error.message}
Line: ${errorLine}
Context:
${context}`;

        const solution = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const panel = vscode.window.createWebviewPanel(
            'errorAnalysis',
            'Error Analysis',
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `<!DOCTYPE html>
        <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Error Analysis & Solution</h2>
        <div style="background: #ffe6e6; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
        <strong>Error:</strong> ${error.message}
        </div>
        <div style="background: #e6ffe6; padding: 15px; border-radius: 5px;">
        ${solution}
        </div></body></html>`;
    }

    public static async addDebugLogs() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        const prompt = `Add debug logging statements to this ${editor.document.languageId} code to help with debugging:

${code}`;

        const withLogs = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, withLogs.trim());
        });
    }

    public static async generateBreakpoints() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Suggest optimal breakpoint locations for debugging this ${editor.document.languageId} code. Return line numbers and reasons:

${code}`;

        const suggestions = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        const panel = vscode.window.createWebviewPanel(
            'breakpointSuggestions',
            'Breakpoint Suggestions',
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `<!DOCTYPE html>
        <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Suggested Breakpoints</h2>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 5px;">
        ${suggestions}
        </div></body></html>`;
    }
}