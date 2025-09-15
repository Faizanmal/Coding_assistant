import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class AdvancedCompletionProvider implements vscode.InlineCompletionItemProvider {
    
    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[]> {
        
        const line = document.lineAt(position);
        const textBeforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const currentLine = line.text.slice(0, position.character);
        
        // Skip if line is empty or just whitespace
        if (!currentLine.trim()) {
            return [];
        }

        // Get context from surrounding lines
        const contextLines = 10;
        const startLine = Math.max(0, position.line - contextLines);
        const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
        const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const context_code = document.getText(contextRange);

        const prompt = `Complete this ${document.languageId} code. Return only the completion text, no explanations:

Context:
${context_code}

Current line to complete: ${currentLine}|

Complete the line naturally based on the context. Return only what should be added after the cursor.`;

        try {
            const completion = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            if (completion && completion.trim()) {
                return [{
                    insertText: completion.trim(),
                    range: new vscode.Range(position, position)
                }];
            }
        } catch (error) {
            console.error('Completion failed:', error);
        }

        return [];
    }
}