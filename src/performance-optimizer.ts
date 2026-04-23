import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface PerformanceIssue {
    type: 'algorithm' | 'memory' | 'io' | 'network' | 'database' | 'complexity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    location: {
        file: string;
        line: number;
        column: number;
    };
    description: string;
    impact: string;
    suggestion: string;
    codeSnippet?: string;
    optimizedCode?: string;
    estimatedImprovement?: string;
}

interface PerformanceReport {
    score: number; // 0-100
    issues: PerformanceIssue[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    recommendations: string[];
    benchmarkResults?: any;
}

export class PerformanceOptimizer {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Performance Optimizer');
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('performance');
    }

    /**
     * Analyze current file for performance issues
     */
    async analyzeCurrentFile(): Promise<PerformanceReport | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return null;
        }

        const document = editor.document;
        const code = document.getText();
        const language = document.languageId;

        return await this.analyzeCode(code, language, document.uri.fsPath);
    }

    /**
     * Analyze entire workspace for performance issues
     */
    async analyzeWorkspace(): Promise<PerformanceReport> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        const allIssues: PerformanceIssue[] = [];
        const files = await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,go,rb,php}',
            '**/node_modules/**'
        );

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing workspace performance...',
            cancellable: true
        }, async (progress, token) => {
            for (let i = 0; i < files.length; i++) {
                if (token.isCancellationRequested) {
                    break;
                }

                progress.report({
                    message: `Analyzing ${path.basename(files[i].fsPath)}`,
                    increment: (100 / files.length)
                });

                const document = await vscode.workspace.openTextDocument(files[i]);
                const code = document.getText();
                const report = await this.analyzeCode(code, document.languageId, document.uri.fsPath);
                
                if (report) {
                    allIssues.push(...report.issues);
                }
            }
        });

        return this.generateReport(allIssues);
    }

    /**
     * Analyze code for performance issues using AI
     */
    private async analyzeCode(
        code: string,
        language: string,
        filePath: string
    ): Promise<PerformanceReport | null> {
        try {
            const prompt = `Analyze this ${language} code for performance issues and bottlenecks:

\`\`\`${language}
${code}
\`\`\`

Identify:
1. Algorithmic inefficiencies (O(n²) when O(n) is possible, etc.)
2. Memory leaks or excessive memory usage
3. Unnecessary I/O operations
4. Network request optimization opportunities
5. Database query optimization
6. Code complexity issues

For each issue found, provide:
- Type (algorithm/memory/io/network/database/complexity)
- Severity (critical/high/medium/low)
- Line number where issue occurs
- Description of the problem
- Performance impact
- Specific optimization suggestion
- Optimized code snippet if applicable
- Estimated performance improvement

Format as JSON array:
[
    {
        "type": "algorithm",
        "severity": "high",
        "line": 15,
        "column": 5,
        "description": "Nested loop causing O(n²) complexity",
        "impact": "Slow performance with large datasets",
        "suggestion": "Use hash map for O(n) lookup",
        "codeSnippet": "original code",
        "optimizedCode": "optimized code",
        "estimatedImprovement": "10x faster"
    }
]`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                const issues: PerformanceIssue[] = JSON.parse(jsonMatch[0]);
                
                // Add file path to each issue
                issues.forEach(issue => {
                    issue.location = {
                        ...issue.location,
                        file: filePath
                    };
                });

                return this.generateReport(issues);
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing code: ${error}`);
            return null;
        }
    }

    /**
     * Generate performance report from issues
     */
    private generateReport(issues: PerformanceIssue[]): PerformanceReport {
        const summary = {
            critical: issues.filter(i => i.severity === 'critical').length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length
        };

        // Calculate score (100 - weighted severity)
        const score = Math.max(0, 100 - (
            summary.critical * 25 +
            summary.high * 10 +
            summary.medium * 5 +
            summary.low * 2
        ));

        const recommendations = this.generateRecommendations(issues);

        return {
            score,
            issues,
            summary,
            recommendations
        };
    }

    /**
     * Generate AI-powered recommendations
     */
    private generateRecommendations(issues: PerformanceIssue[]): string[] {
        const recommendations: string[] = [];

        // Prioritize critical issues
        const critical = issues.filter(i => i.severity === 'critical');
        if (critical.length > 0) {
            recommendations.push(`🚨 Fix ${critical.length} critical performance issues immediately`);
        }

        // Group by type
        const byType = issues.reduce((acc, issue) => {
            if (!acc[issue.type]) {
                acc[issue.type] = [];
            }
            acc[issue.type].push(issue);
            return acc;
        }, {} as Record<string, PerformanceIssue[]>);

        // Add type-specific recommendations
        if (byType.algorithm && byType.algorithm.length > 0) {
            recommendations.push(`⚡ Optimize ${byType.algorithm.length} algorithmic inefficiencies`);
        }
        if (byType.memory && byType.memory.length > 0) {
            recommendations.push(`💾 Address ${byType.memory.length} memory usage issues`);
        }
        if (byType.database && byType.database.length > 0) {
            recommendations.push(`🗄️ Optimize ${byType.database.length} database queries`);
        }

        return recommendations;
    }

    /**
     * Show performance report in webview
     */
    async showPerformanceReport(report: PerformanceReport) {
        const panel = vscode.window.createWebviewPanel(
            'performanceReport',
            'Performance Analysis Report',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateReportHTML(report);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'applyFix':
                        await this.applyOptimization(message.issue);
                        break;
                    case 'showIssue':
                        await this.navigateToIssue(message.issue);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Generate HTML for performance report
     */
    private generateReportHTML(report: PerformanceReport): string {
        const scoreColor = report.score >= 80 ? '#89d185' : report.score >= 60 ? '#cca700' : '#f48771';
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Analysis Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 28px;
            margin-bottom: 10px;
            color: white;
        }
        .score-container {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 20px;
        }
        .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: conic-gradient(${scoreColor} ${report.score}%, #2d2d30 0);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .score-inner {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: #1e1e1e;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        .score-number {
            font-size: 32px;
            font-weight: bold;
            color: ${scoreColor};
        }
        .score-label {
            font-size: 12px;
            color: #858585;
        }
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
        }
        .stat-box {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-box.critical .stat-number { color: #f48771; }
        .stat-box.high .stat-number { color: #ff6b6b; }
        .stat-box.medium .stat-number { color: #cca700; }
        .stat-box.low .stat-number { color: #4a9eff; }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        h2 {
            margin-bottom: 20px;
            color: #3794ff;
            font-size: 20px;
            border-bottom: 2px solid #3794ff;
            padding-bottom: 10px;
        }
        .issue {
            background: #1e1e1e;
            padding: 20px;
            margin-bottom: 15px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        .issue.critical { border-left-color: #f48771; }
        .issue.high { border-left-color: #ff6b6b; }
        .issue.medium { border-left-color: #cca700; }
        .issue.low { border-left-color: #4a9eff; }
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 12px;
        }
        .issue-title {
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 5px;
        }
        .issue-location {
            color: #858585;
            font-size: 13px;
        }
        .badge {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .badge.critical { background: #f48771; }
        .badge.high { background: #ff6b6b; }
        .badge.medium { background: #cca700; }
        .badge.low { background: #4a9eff; }
        .issue-description {
            margin: 10px 0;
            color: #cccccc;
        }
        .issue-impact {
            background: #2d2d30;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 14px;
        }
        .issue-suggestion {
            background: #264f78;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .code-block {
            background: #1e1e1e;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            overflow-x: auto;
            border: 1px solid #3c3c3c;
        }
        .improvement {
            color: #89d185;
            font-weight: bold;
            margin-top: 8px;
        }
        .actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
            transition: opacity 0.2s;
        }
        button:hover { opacity: 0.8; }
        .btn-primary {
            background: #3794ff;
            color: white;
        }
        .btn-secondary {
            background: #2d2d30;
            color: #d4d4d4;
            border: 1px solid #3c3c3c;
        }
        .recommendations {
            list-style: none;
        }
        .recommendations li {
            padding: 12px;
            margin-bottom: 8px;
            background: #2d2d30;
            border-radius: 4px;
            border-left: 3px solid #3794ff;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Performance Analysis Report</h1>
        <div class="score-container">
            <div class="score-circle">
                <div class="score-inner">
                    <div class="score-number">${report.score}</div>
                    <div class="score-label">SCORE</div>
                </div>
            </div>
            <div class="summary-stats">
                <div class="stat-box critical">
                    <div class="stat-number">${report.summary.critical}</div>
                    <div>Critical</div>
                </div>
                <div class="stat-box high">
                    <div class="stat-number">${report.summary.high}</div>
                    <div>High</div>
                </div>
                <div class="stat-box medium">
                    <div class="stat-number">${report.summary.medium}</div>
                    <div>Medium</div>
                </div>
                <div class="stat-box low">
                    <div class="stat-number">${report.summary.low}</div>
                    <div>Low</div>
                </div>
            </div>
        </div>
    </div>

    ${report.recommendations.length > 0 ? `
    <div class="section">
        <h2>💡 Recommendations</h2>
        <ul class="recommendations">
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>🔍 Performance Issues (${report.issues.length})</h2>
        ${report.issues.map((issue, index) => `
            <div class="issue ${issue.severity}">
                <div class="issue-header">
                    <div>
                        <div class="issue-title">${issue.description}</div>
                        <div class="issue-location">
                            📁 ${path.basename(issue.location.file)} : Line ${issue.location.line}
                        </div>
                    </div>
                    <span class="badge ${issue.severity}">${issue.severity}</span>
                </div>
                
                <div class="issue-description">
                    <strong>Type:</strong> ${issue.type}
                </div>

                <div class="issue-impact">
                    <strong>💥 Impact:</strong> ${issue.impact}
                </div>

                <div class="issue-suggestion">
                    <strong>✨ Suggestion:</strong> ${issue.suggestion}
                </div>

                ${issue.codeSnippet ? `
                    <div>
                        <strong>Current Code:</strong>
                        <div class="code-block">${this.escapeHtml(issue.codeSnippet)}</div>
                    </div>
                ` : ''}

                ${issue.optimizedCode ? `
                    <div>
                        <strong>Optimized Code:</strong>
                        <div class="code-block">${this.escapeHtml(issue.optimizedCode)}</div>
                    </div>
                ` : ''}

                ${issue.estimatedImprovement ? `
                    <div class="improvement">
                        📈 Estimated Improvement: ${issue.estimatedImprovement}
                    </div>
                ` : ''}

                <div class="actions">
                    <button class="btn-primary" onclick="applyFix(${index})">
                        Apply Fix
                    </button>
                    <button class="btn-secondary" onclick="showIssue(${index})">
                        Go to Code
                    </button>
                </div>
            </div>
        `).join('')}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function applyFix(index) {
            vscode.postMessage({
                command: 'applyFix',
                issue: ${JSON.stringify(report.issues)}[index]
            });
        }

        function showIssue(index) {
            vscode.postMessage({
                command: 'showIssue',
                issue: ${JSON.stringify(report.issues)}[index]
            });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Apply optimization suggestion
     */
    private async applyOptimization(issue: PerformanceIssue) {
        if (!issue.optimizedCode) {
            vscode.window.showWarningMessage('No optimization code available');
            return;
        }

        const uri = vscode.Uri.file(issue.location.file);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Find and replace the code
        const line = document.lineAt(issue.location.line - 1);
        const range = line.range;

        await editor.edit(editBuilder => {
            editBuilder.replace(range, issue.optimizedCode!);
        });

        vscode.window.showInformationMessage('✅ Optimization applied!');
    }

    /**
     * Navigate to issue location
     */
    private async navigateToIssue(issue: PerformanceIssue) {
        const uri = vscode.Uri.file(issue.location.file);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        const position = new vscode.Position(issue.location.line - 1, issue.location.column);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
    }

    /**
     * Auto-fix all safe optimizations
     */
    async autoFixPerformanceIssues(report: PerformanceReport) {
        const safeIssues = report.issues.filter(i => 
            i.optimizedCode && (i.severity === 'low' || i.severity === 'medium')
        );

        if (safeIssues.length === 0) {
            vscode.window.showInformationMessage('No safe auto-fixes available');
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Apply ${safeIssues.length} performance optimizations?`,
            'Yes',
            'No'
        );

        if (confirmation !== 'Yes') {
            return;
        }

        for (const issue of safeIssues) {
            await this.applyOptimization(issue);
        }

        vscode.window.showInformationMessage(`✅ Applied ${safeIssues.length} optimizations!`);
    }

    /**
     * Escape HTML for display
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    dispose() {
        this.outputChannel.dispose();
        this.diagnosticCollection.dispose();
    }
}

/**
 * Register performance optimizer commands
 */
export function registerPerformanceOptimizerCommands(context: vscode.ExtensionContext) {
    const optimizer = new PerformanceOptimizer(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.performance.analyzeFile', async () => {
            const report = await optimizer.analyzeCurrentFile();
            if (report) {
                await optimizer.showPerformanceReport(report);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.performance.analyzeWorkspace', async () => {
            const report = await optimizer.analyzeWorkspace();
            await optimizer.showPerformanceReport(report);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.performance.autoFix', async () => {
            const report = await optimizer.analyzeCurrentFile();
            if (report) {
                await optimizer.autoFixPerformanceIssues(report);
            }
        })
    );
}
