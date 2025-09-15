import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class InstantReviewer {
    private static decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.2)',
        border: '1px solid yellow'
    });

    public static async reviewCurrentFile() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Review this ${editor.document.languageId} code and provide specific feedback on:
1. Code quality issues
2. Security vulnerabilities  
3. Performance problems
4. Best practice violations

Return JSON format:
{
  "issues": [
    {"line": number, "type": "quality|security|performance|style", "message": "description", "severity": "high|medium|low"}
  ],
  "overall_score": number_out_of_10,
  "summary": "brief summary"
}

Code:
${code}`;

        try {
            const response = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            const review = JSON.parse(response);
            
            this.showReviewResults(review, editor);
        } catch (error) {
            vscode.window.showErrorMessage('Code review failed: ' + error);
        }
    }

    private static showReviewResults(review: any, editor: vscode.TextEditor) {
        const ranges: vscode.Range[] = [];
        
        review.issues.forEach((issue: any) => {
            if (issue.line > 0 && issue.line <= editor.document.lineCount) {
                const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, 100);
                ranges.push(range);
            }
        });

        editor.setDecorations(this.decorationType, ranges);

        const panel = vscode.window.createWebviewPanel(
            'codeReview',
            'Code Review Results',
            vscode.ViewColumn.Two,
            {}
        );

        const issuesHtml = review.issues.map((issue: any) => 
            `<div class="issue ${issue.severity}">
                <strong>Line ${issue.line}</strong> - ${issue.type.toUpperCase()}
                <p>${issue.message}</p>
            </div>`
        ).join('');

        panel.webview.html = `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                .issue { margin: 10px 0; padding: 10px; border-radius: 5px; }
                .high { background: #ffe6e6; border-left: 4px solid #ff4444; }
                .medium { background: #fff3e6; border-left: 4px solid #ffaa00; }
                .low { background: #e6ffe6; border-left: 4px solid #44ff44; }
                .score { font-size: 24px; text-align: center; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>Code Review Results</h1>
            <div class="score">Overall Score: ${review.overall_score}/10</div>
            <p><strong>Summary:</strong> ${review.summary}</p>
            <h2>Issues Found:</h2>
            ${issuesHtml}
        </body>
        </html>`;
    }

    public static async quickScan() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showErrorMessage('Select code to scan');
            return;
        }

        const prompt = `Quick scan this ${editor.document.languageId} code for obvious issues. Return a brief assessment:

${code}`;

        const assessment = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
        
        vscode.window.showInformationMessage(assessment, { modal: true });
    }
}