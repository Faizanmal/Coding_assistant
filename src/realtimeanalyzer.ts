import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class RealtimeAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('coding-realtime');
    }

    public activate(context: vscode.ExtensionContext) {
        const disposable = vscode.workspace.onDidChangeTextDocument(
            (event) => this.onDocumentChange(event)
        );
        context.subscriptions.push(disposable, this.diagnosticCollection);
    }

    private onDocumentChange(event: vscode.TextDocumentChangeEvent) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.analyzeDocument(event.document);
        }, 1000);
    }

    private async analyzeDocument(document: vscode.TextDocument) {
        if (document.languageId === 'plaintext') return;

        const code = document.getText();
        const prompt = `Analyze this ${document.languageId} code for potential issues, performance problems, and suggest improvements. Return JSON format:
        {
            "issues": [{"line": number, "message": string, "severity": "error"|"warning"|"info", "suggestion": string}],
            "suggestions": [{"type": string, "description": string}]
        }

        Code:
        ${code}`;

        try {
            const response = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            const analysis = JSON.parse(response);
            
            const diagnostics: vscode.Diagnostic[] = analysis.issues.map((issue: any) => {
                const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, 100);
                const severity = issue.severity === 'error' ? vscode.DiagnosticSeverity.Error :
                               issue.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
                               vscode.DiagnosticSeverity.Information;
                
                return new vscode.Diagnostic(range, issue.message, severity);
            });

            this.diagnosticCollection.set(document.uri, diagnostics);
        } catch (error) {
            console.error('Realtime analysis failed:', error);
        }
    }
}