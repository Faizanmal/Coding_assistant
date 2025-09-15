import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class PerformanceProfiler {
    
    public static async analyzePerformance() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Analyze this ${editor.document.languageId} code for performance issues and bottlenecks. 
        Return JSON format:
        {
            "performance_issues": [
                {
                    "line": number,
                    "issue": "description",
                    "severity": "high|medium|low",
                    "suggestion": "optimization suggestion",
                    "estimated_impact": "performance impact"
                }
            ],
            "optimizations": [
                {
                    "type": "optimization_type",
                    "description": "what to optimize",
                    "code_example": "optimized code example"
                }
            ]
        }

        Code:
        ${code}`;

        try {
            const response = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            const analysis = JSON.parse(response);
            
            const panel = vscode.window.createWebviewPanel(
                'performanceAnalysis',
                'Performance Analysis',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = this.getPerformanceAnalysisHtml(analysis);
        } catch (error) {
            vscode.window.showErrorMessage('Performance analysis failed: ' + error);
        }
    }

    public static async generateBenchmark() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showErrorMessage('Please select code to benchmark');
            return;
        }

        const prompt = `Generate a comprehensive benchmark test for this ${editor.document.languageId} code. 
        Include multiple test cases, timing measurements, and memory usage analysis:

        ${selectedText}`;

        try {
            const benchmark = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const benchmarkPath = vscode.Uri.joinPath(workspaceFolder.uri, 'benchmark_test.js');
                await vscode.workspace.fs.writeFile(benchmarkPath, Buffer.from(benchmark));
                
                const doc = await vscode.workspace.openTextDocument(benchmarkPath);
                await vscode.window.showTextDocument(doc);
            }
            
            vscode.window.showInformationMessage('Benchmark test generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage('Benchmark generation failed: ' + error);
        }
    }

    private static getPerformanceAnalysisHtml(analysis: any): string {
        const issuesHtml = analysis.performance_issues.map((issue: any) => 
            `<div class="issue ${issue.severity}">
                <h3>Line ${issue.line}: ${issue.issue}</h3>
                <p><strong>Severity:</strong> ${issue.severity}</p>
                <p><strong>Suggestion:</strong> ${issue.suggestion}</p>
                <p><strong>Impact:</strong> ${issue.estimated_impact}</p>
            </div>`
        ).join('');

        const optimizationsHtml = analysis.optimizations.map((opt: any) => 
            `<div class="optimization">
                <h3>${opt.type}</h3>
                <p>${opt.description}</p>
                <pre><code>${opt.code_example}</code></pre>
            </div>`
        ).join('');

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                .issue { border: 1px solid #ccc; margin: 10px 0; padding: 15px; border-radius: 5px; }
                .high { border-left: 5px solid #ff4444; }
                .medium { border-left: 5px solid #ffaa00; }
                .low { border-left: 5px solid #44ff44; }
                .optimization { background: #f0f8ff; padding: 15px; margin: 10px 0; border-radius: 5px; }
                pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>Performance Analysis Report</h1>
            <h2>Performance Issues</h2>
            ${issuesHtml}
            <h2>Optimization Suggestions</h2>
            ${optimizationsHtml}
        </body>
        </html>`;
    }
}