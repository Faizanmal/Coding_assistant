import * as vscode from 'vscode';
import { callAI } from './codegenerator';

interface DebugContext {
    breakpointType: 'standard' | 'conditional' | 'logpoint';
    condition?: string;
    logMessage?: string;
    hitCount: number;
    location: { file: string; line: number };
    isActive: boolean;
}

interface VariableAnalysis {
    name: string;
    type: string;
    value: string;
    scope: 'local' | 'global' | 'closure';
    mutationHistory: { value: string; timestamp: number }[];
    suspiciousChanges: boolean;
    suggestions: string[];
}

interface StackTraceAnalysis {
    frames: {
        file: string;
        line: number;
        column?: number;
        function: string;
        locals: VariableAnalysis[];
    }[];
    potentialRootCause: string;
    debuggingSuggestions: string[];
    relevantCode?: string;
}

interface DiagnosedBug {
    severity: 'critical' | 'major' | 'minor';
    category: string;
    description: string;
    affectedLines: number[];
    rootCause: string;
    fixSuggestions: string[];
    estimatedFixTime: 'quick' | 'medium' | 'complex';
    confidence: number; // 0-100
}

export class AdvancedDebugAssistant {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private debugContexts: Map<string, DebugContext> = new Map();
    private variableSnapshots: Map<string, VariableAnalysis[]> = new Map();
    private breakpointWatchers: Set<string> = new Set();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Advanced Debug Assistant');
        this.setupDebugListeners();
    }

    /**
     * Setup debug session listeners
     */
    private setupDebugListeners() {
        vscode.debug.onDidChangeActiveDebugSession(session => {
            if (session) {
                this.outputChannel.appendLine(`Debug session started: ${session.name}`);
            }
        });

        vscode.debug.onDidTerminateDebugSession(session => {
            this.outputChannel.appendLine(`Debug session ended: ${session.name}`);
            this.debugContexts.clear();
        });
    }

    /**
     * Create intelligent context-aware breakpoint
     */
    async createSmartBreakpoint(
        file: string,
        line: number,
        context?: string
    ): Promise<DebugContext | null> {
        try {
            // Analyze the code at breakpoint location
            const editor = vscode.window.visibleTextEditors.find(e => e.document.fileName === file);
            if (!editor) {
                vscode.window.showErrorMessage(`File ${file} not open`);
                return null;
            }

            const lineText = editor.document.lineAt(line).text;
            
            // Use AI to suggest smart breakpoint condition
            const prompt = `Analyze this line of code for debugging:
Line ${line}: ${lineText}

Suggest:
1. A conditional breakpoint condition (if needed)
2. What variables to watch
3. Common bugs in this pattern

Format as JSON:
{
    "conditionNeeded": true/false,
    "condition": "condition expression",
    "watchVariables": ["var1", "var2"],
    "commonBugs": ["bug1", "bug2"]
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                return null;
            }

            const analysis = JSON.parse(jsonMatch[0]);

            const breakpointContext: DebugContext = {
                breakpointType: analysis.conditionNeeded ? 'conditional' : 'standard',
                condition: analysis.condition,
                hitCount: 0,
                location: { file, line },
                isActive: true
            };

            this.debugContexts.set(`${file}:${line}`, breakpointContext);

            this.outputChannel.appendLine(`✨ Smart breakpoint created at ${file}:${line}`);
            if (analysis.watchVariables.length > 0) {
                this.outputChannel.appendLine(`   Watch: ${analysis.watchVariables.join(', ')}`);
            }

            return breakpointContext;
        } catch (error) {
            this.outputChannel.appendLine(`Error creating smart breakpoint: ${error}`);
            return null;
        }
    }

    /**
     * Analyze variable mutations and detect issues
     */
    async analyzeVariable(
        name: string,
        currentValue: string,
        type: string,
        scope: 'local' | 'global' | 'closure'
    ): Promise<VariableAnalysis> {
        const key = `${scope}:${name}`;
        const previousValue = this.variableSnapshots.get(key)?.[0];

        const analysis: VariableAnalysis = {
            name,
            type,
            value: currentValue,
            scope,
            mutationHistory: [
                {
                    value: currentValue,
                    timestamp: Date.now()
                }
            ],
            suspiciousChanges: false,
            suggestions: []
        };

        try {
            // Check if value changed unexpectedly
            if (previousValue && previousValue.value !== currentValue) {
                const prompt = `Variable analysis:
Name: ${name}
Type: ${type}
Previous value: ${previousValue.value}
Current value: ${currentValue}

Is this change suspicious? Analyze for:
1. Memory corruption
2. Race condition
3. Unexpected mutation
4. Type mismatch

Format as JSON:
{
    "suspicious": true/false,
    "reason": "explanation",
    "debugSuggestions": ["suggestion1", "suggestion2"]
}`;

                const response = await callAI(prompt);
                const jsonMatch = response.match(/\{[\s\S]*\}/);

                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    analysis.suspiciousChanges = result.suspicious;
                    analysis.suggestions = result.debugSuggestions;
                }
            }

            // Update snapshot
            this.variableSnapshots.set(key, [analysis]);
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing variable: ${error}`);
        }

        return analysis;
    }

    /**
     * Analyze stack trace and identify root cause
     */
    async analyzeStackTrace(
        frames: {
            file: string;
            line: number;
            function: string;
            locals?: string[];
        }[]
    ): Promise<StackTraceAnalysis> {
        try {
            const frameDescriptions = frames
                .map(f => `${f.function} (${f.file}:${f.line})`)
                .join('\n');

            const prompt = `Analyze this stack trace for root cause:

${frameDescriptions}

Identify:
1. The likely root cause
2. Which frame is most suspicious
3. Debugging steps to investigate
4. Common patterns that cause this error

Format as JSON:
{
    "rootCause": "description",
    "suspiciousFrame": "frame number",
    "debugSteps": ["step1", "step2"],
    "commonPatterns": ["pattern1", "pattern2"]
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error('Failed to parse AI response');
            }

            const analysis = JSON.parse(jsonMatch[0]);

            return {
                frames: frames.map(f => ({
                    file: f.file,
                    line: f.line,
                    function: f.function,
                    locals: (f.locals || []).map(name => ({
                        name,
                        type: 'unknown',
                        value: 'unknown',
                        scope: 'local' as const,
                        mutationHistory: [],
                        suspiciousChanges: false,
                        suggestions: []
                    }))
                })),
                potentialRootCause: analysis.rootCause,
                debuggingSuggestions: analysis.debugSteps,
                relevantCode: frames[0]?.function
            };
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing stack trace: ${error}`);
            return {
                frames: frames.map(f => ({
                    file: f.file,
                    line: f.line,
                    function: f.function,
                    locals: []
                })),
                potentialRootCause: 'Unable to determine',
                debuggingSuggestions: []
            };
        }
    }

    /**
     * Diagnose a bug from error message and context
     */
    async diagnoseError(
        errorMessage: string,
        context: string,
        affectedCode: string
    ): Promise<DiagnosedBug | null> {
        try {
            const prompt = `Diagnose this bug:

Error: ${errorMessage}
Context: ${context}
Affected Code:
\`\`\`
${affectedCode}
\`\`\`

Provide comprehensive diagnosis:
1. Bug severity (critical/major/minor)
2. Category (logic error, race condition, memory, etc)
3. Root cause
4. Fix suggestions (3-5 specific suggestions)
5. Estimated fix time

Format as JSON:
{
    "severity": "critical|major|minor",
    "category": "category name",
    "description": "brief description",
    "rootCause": "root cause explanation",
    "fixSuggestions": ["suggestion1", "suggestion2", "suggestion3"],
    "estimatedTime": "quick|medium|complex",
    "confidence": 85
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                return null;
            }

            const diagnosis = JSON.parse(jsonMatch[0]);

            const lines = affectedCode.split('\n').map((_, i) => i);

            return {
                severity: diagnosis.severity,
                category: diagnosis.category,
                description: diagnosis.description,
                affectedLines: lines.slice(0, 3),
                rootCause: diagnosis.rootCause,
                fixSuggestions: diagnosis.fixSuggestions,
                estimatedFixTime: diagnosis.estimatedTime,
                confidence: diagnosis.confidence
            };
        } catch (error) {
            this.outputChannel.appendLine(`Error diagnosing bug: ${error}`);
            return null;
        }
    }

    /**
     * Show debug insights panel
     */
    async showDebugPanel() {
        const panel = vscode.window.createWebviewPanel(
            'advancedDebug',
            'Advanced Debug Assistant',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        const breakpointCount = this.debugContexts.size;
        const contextArray = Array.from(this.debugContexts.values());

        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
        }
        .stat-box {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #3794ff;
        }
        .stat-number {
            font-size: 28px;
            font-weight: bold;
            color: #3794ff;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 12px;
            color: #858585;
        }
        .section {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #f093fb;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f093fb;
        }
        .breakpoint {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 4px solid #f5576c;
        }
        .breakpoint-file {
            color: #3794ff;
            font-weight: bold;
        }
        .breakpoint-type {
            display: inline-block;
            padding: 3px 8px;
            background: #f5576c;
            color: white;
            border-radius: 3px;
            font-size: 10px;
            margin-top: 5px;
        }
        button {
            background: #f5576c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
        }
        button:hover {
            background: #f093fb;
        }
        .empty {
            text-align: center;
            color: #858585;
            padding: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐛 Advanced Debug Assistant</h1>
        <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">
            Smart breakpoints, variable analysis, and intelligent debugging
        </p>
    </div>

    <div class="stats">
        <div class="stat-box">
            <div class="stat-number">${breakpointCount}</div>
            <div class="stat-label">Smart Breakpoints</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${contextArray.reduce((sum, c) => sum + c.hitCount, 0)}</div>
            <div class="stat-label">Total Hits</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${contextArray.filter(c => c.breakpointType === 'conditional').length}</div>
            <div class="stat-label">Conditional</div>
        </div>
    </div>

    ${breakpointCount > 0 ? `
    <div class="section">
        <h2>📍 Active Breakpoints</h2>
        ${contextArray.map((ctx, i) => `
            <div class="breakpoint">
                <div class="breakpoint-file">${ctx.location.file}:${ctx.location.line}</div>
                <div style="font-size: 12px; color: #858585; margin-top: 5px;">
                    Hit Count: ${ctx.hitCount} | Status: ${ctx.isActive ? '✅ Active' : '⏸️ Inactive'}
                </div>
                ${ctx.condition ? `
                    <div style="background: #2d2d30; padding: 8px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 11px;">
                        ${ctx.condition}
                    </div>
                ` : ''}
                <span class="breakpoint-type">${ctx.breakpointType}</span>
                <button onclick="alert('Remove breakpoint ${i}')">Remove</button>
            </div>
        `).join('')}
    </div>
    ` : `
    <div class="section">
        <div class="empty">
            <p>No breakpoints created yet</p>
            <p style="font-size: 12px; margin-top: 10px;">Use the command palette to create smart breakpoints</p>
        </div>
    </div>
    `}

    <div class="section">
        <h2>⚡ Quick Actions</h2>
        <button onclick="alert('Analyze current frame')">Analyze Stack</button>
        <button onclick="alert('Watch all variables')">Watch Variables</button>
        <button onclick="alert('Show memory')">Memory Inspector</button>
    </div>
</body>
</html>`;
    }

    /**
     * Get current debug status
     */
    getDebugStatus() {
        return {
            activeBreakpoints: this.debugContexts.size,
            totalHits: Array.from(this.debugContexts.values()).reduce((sum, c) => sum + c.hitCount, 0),
            hasConditionalBreakpoints: Array.from(this.debugContexts.values()).some(c => c.breakpointType === 'conditional')
        };
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register debug assistant commands
 */
export function registerAdvancedDebugCommands(context: vscode.ExtensionContext) {
    const debugAssistant = new AdvancedDebugAssistant(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.debug.smartBreakpoint', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const line = editor.selection.active.line;
            const file = editor.document.fileName;

            const bp = await debugAssistant.createSmartBreakpoint(file, line);
            if (bp) {
                vscode.window.showInformationMessage(`Smart breakpoint created at line ${line + 1}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.debug.analyzeStack', async () => {
            await debugAssistant.showDebugPanel();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.debug.diagnoseError', async () => {
            const errorMessage = await vscode.window.showInputBox({
                prompt: 'Enter error message'
            });

            if (!errorMessage) {
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const code = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
            const diagnosis = await debugAssistant.diagnoseError(
                errorMessage,
                'Active editor context',
                code || 'No code selected'
            );

            if (diagnosis) {
                const message = `
🐛 Bug Diagnosis
Severity: ${diagnosis.severity}
Category: ${diagnosis.category}
Root Cause: ${diagnosis.rootCause}
Confidence: ${diagnosis.confidence}%

Suggested Fixes:
${diagnosis.fixSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}
                `;
                vscode.window.showInformationMessage(message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.debug.showPanel', async () => {
            await debugAssistant.showDebugPanel();
        })
    );
}
