import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class QuickFixes {
    
    public static async addLogging() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        const prompt = `Add appropriate logging statements to this ${editor.document.languageId} code:

${code}`;

        const withLogging = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, withLogging.trim());
        });
    }

    public static async addErrorHandling() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        const prompt = `Add comprehensive error handling to this ${editor.document.languageId} code:

${code}`;

        const withErrorHandling = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, withErrorHandling.trim());
        });
    }

    public static async convertToAsync() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        const prompt = `Convert this ${editor.document.languageId} code to use async/await pattern:

${code}`;

        const asyncCode = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, asyncCode.trim());
        });
    }
}