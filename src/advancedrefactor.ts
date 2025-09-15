import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class AdvancedRefactorAssistant {
    
    public static async refactorSelection() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showErrorMessage('Please select code to refactor');
            return;
        }

        const options = await vscode.window.showQuickPick([
            'Extract Method',
            'Extract Variable',
            'Optimize Performance',
            'Improve Readability',
            'Add Error Handling',
            'Convert to Modern Syntax'
        ], { placeHolder: 'Choose refactoring type' });

        if (!options) return;

        const prompt = `Refactor this ${editor.document.languageId} code using "${options}" technique. 
        Return only the refactored code without explanations:

        ${selectedText}`;

        try {
            const refactoredCode = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, refactoredCode.trim());
            });

            vscode.window.showInformationMessage(`Code refactored using: ${options}`);
        } catch (error) {
            vscode.window.showErrorMessage('Refactoring failed: ' + error);
        }
    }

    public static async suggestRefactorings() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Analyze this ${editor.document.languageId} code and suggest specific refactoring opportunities. 
        Return JSON format:
        {
            "suggestions": [
                {
                    "type": "refactoring_type",
                    "description": "what to refactor",
                    "line": line_number,
                    "reason": "why refactor this"
                }
            ]
        }

        Code:
        ${code}`;

        try {
            const response = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            const suggestions = JSON.parse(response);
            
            const panel = vscode.window.createWebviewPanel(
                'refactorSuggestions',
                'Refactoring Suggestions',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = this.getRefactorSuggestionsHtml(suggestions.suggestions);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to generate suggestions: ' + error);
        }
    }

    private static getRefactorSuggestionsHtml(suggestions: any[]): string {
        const suggestionItems = suggestions.map(s => 
            `<div class="suggestion">
                <h3>${s.type}</h3>
                <p><strong>Line ${s.line}:</strong> ${s.description}</p>
                <p><em>Reason:</em> ${s.reason}</p>
            </div>`
        ).join('');

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                .suggestion { border: 1px solid #ccc; margin: 10px 0; padding: 15px; border-radius: 5px; }
                h3 { color: #007acc; margin-top: 0; }
            </style>
        </head>
        <body>
            <h1>Refactoring Suggestions</h1>
            ${suggestionItems}
        </body>
        </html>`;
    }
}