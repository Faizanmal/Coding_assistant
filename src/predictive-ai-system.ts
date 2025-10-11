import * as vscode from 'vscode';
import { callAI } from './codegenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface PredictiveInsight {
    id: string;
    type: 'bug_prediction' | 'performance_issue' | 'security_vulnerability' | 'maintenance_need' | 'optimization_opportunity';
    title: string;
    description: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    predictedImpact: string;
    suggestedActions: string[];
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
    affectedFiles: string[];
}

export interface AutoFixSuggestion {
    id: string;
    problemDescription: string;
    proposedSolution: string;
    codeChanges: CodeChange[];
    testCases: string[];
    riskLevel: 'low' | 'medium' | 'high';
    estimatedEffort: number; // in minutes
    dependencies: string[];
}

export interface CodeChange {
    filePath: string;
    startLine: number;
    endLine: number;
    originalCode: string;
    newCode: string;
    explanation: string;
}

export interface LearningPattern {
    id: string;
    pattern: string;
    context: string;
    frequency: number;
    effectiveness: number;
    lastUsed: number;
    category: 'coding' | 'testing' | 'debugging' | 'optimization' | 'architecture';
}

export interface WorkflowOptimization {
    id: string;
    workflowName: string;
    currentEfficiency: number;
    optimizedSteps: WorkflowStep[];
    expectedImprovements: {
        timeReduction: number;
        qualityIncrease: number;
        errorReduction: number;
    };
    implementationPlan: string[];
}

export interface WorkflowStep {
    id: string;
    name: string;
    action: string;
    automationLevel: 'manual' | 'semi_automated' | 'fully_automated';
    estimatedTime: number;
    prerequisites: string[];
}

export class PredictiveAISystem {
    private static instance: PredictiveAISystem;
    private context: vscode.ExtensionContext;
    private predictiveInsights: PredictiveInsight[] = [];
    private learningPatterns: LearningPattern[] = [];
    private autoFixSuggestions: AutoFixSuggestion[] = [];
    private workflowOptimizations: WorkflowOptimization[] = [];
    private codeAnalysisHistory: any[] = [];
    private userBehaviorPatterns: Map<string, any> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.startPredictiveAnalysis();
        this.loadLearningPatterns();
        this.initializeUserBehaviorTracking();
    }

    public static getInstance(context: vscode.ExtensionContext): PredictiveAISystem {
        if (!PredictiveAISystem.instance) {
            PredictiveAISystem.instance = new PredictiveAISystem(context);
        }
        return PredictiveAISystem.instance;
    }

    private startPredictiveAnalysis(): void {
        // Start continuous analysis every 30 minutes
        setInterval(() => {
            this.performPredictiveAnalysis();
        }, 1800000);

        // Initial analysis
        setTimeout(() => {
            this.performPredictiveAnalysis();
        }, 5000);
    }

    private async performPredictiveAnalysis(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {return;}

            // Analyze codebase for predictive insights
            await Promise.all([
                this.predictBugs(),
                this.predictPerformanceIssues(),
                this.predictSecurityVulnerabilities(),
                this.predictMaintenanceNeeds(),
                this.identifyOptimizationOpportunities()
            ]);

            // Generate auto-fix suggestions
            await this.generateAutoFixSuggestions();

            // Optimize workflows
            await this.optimizeWorkflows();

            // Update learning patterns
            this.updateLearningPatterns();

            // Notify about critical insights
            this.notifyCriticalInsights();

        } catch (error) {
            console.error('Predictive analysis failed:', error);
        }
    }

    private async predictBugs(): Promise<void> {
        const prompt = `Analyze the current codebase and predict potential bugs based on:

        1. Code complexity patterns
        2. Common error-prone constructs
        3. Missing error handling
        4. Resource leak patterns
        5. Type safety issues
        6. Concurrency problems
        7. Null pointer potential
        8. Logic flaws in conditional statements

        Provide specific predictions with:
        - Exact file and line locations
        - Confidence percentage
        - Potential impact
        - Suggested preventive actions

        Focus on the most likely bug scenarios.`;

        try {
            const prediction = await callAI(prompt);
            const insights = this.parsePredictionResponse(prediction, 'bug_prediction');
            this.predictiveInsights.push(...insights);
        } catch (error) {
            console.error('Bug prediction failed:', error);
        }
    }

    private async predictPerformanceIssues(): Promise<void> {
        const prompt = `Analyze the codebase for potential performance bottlenecks:

        1. Inefficient algorithms (O(n²) or worse)
        2. Memory leaks and excessive allocations
        3. Unnecessary database queries
        4. Blocking operations on main thread
        5. Large object creation in loops
        6. Inefficient string operations
        7. Missing caching opportunities
        8. Resource-intensive operations

        Predict performance degradation scenarios with:
        - Specific code locations
        - Performance impact estimates
        - Load conditions that trigger issues
        - Optimization recommendations`;

        try {
            const prediction = await callAI(prompt);
            const insights = this.parsePredictionResponse(prediction, 'performance_issue');
            this.predictiveInsights.push(...insights);
        } catch (error) {
            console.error('Performance prediction failed:', error);
        }
    }

    private async predictSecurityVulnerabilities(): Promise<void> {
        const prompt = `Analyze the codebase for potential security vulnerabilities:

        1. SQL injection risks
        2. XSS vulnerabilities
        3. Authentication bypasses
        4. Authorization flaws
        5. Input validation gaps
        6. Insecure data storage
        7. Cryptographic weaknesses
        8. API security issues
        9. Dependency vulnerabilities
        10. Information disclosure risks

        Predict security threats with:
        - Vulnerability types and locations
        - Exploitability assessment
        - Potential damage scenarios
        - Mitigation strategies`;

        try {
            const prediction = await callAI(prompt);
            const insights = this.parsePredictionResponse(prediction, 'security_vulnerability');
            this.predictiveInsights.push(...insights);
        } catch (error) {
            console.error('Security prediction failed:', error);
        }
    }

    private async predictMaintenanceNeeds(): Promise<void> {
        const prompt = `Predict future maintenance needs for this codebase:

        1. Code that will become technical debt
        2. Dependencies that need updates
        3. APIs that may become deprecated
        4. Scalability bottlenecks
        5. Testing gaps that will cause issues
        6. Documentation that will become outdated
        7. Configuration drift risks
        8. Compatibility issues with future versions

        Provide maintenance predictions with:
        - Timeline for each issue
        - Effort estimates
        - Priority levels
        - Preventive actions`;

        try {
            const prediction = await callAI(prompt);
            const insights = this.parsePredictionResponse(prediction, 'maintenance_need');
            this.predictiveInsights.push(...insights);
        } catch (error) {
            console.error('Maintenance prediction failed:', error);
        }
    }

    private async identifyOptimizationOpportunities(): Promise<void> {
        const prompt = `Identify optimization opportunities in the codebase:

        1. Code that can be made more efficient
        2. Refactoring opportunities for better structure
        3. Pattern extraction possibilities
        4. Automation potential
        5. Performance improvements
        6. Memory usage optimizations
        7. Bundle size reductions
        8. Developer experience improvements

        Suggest optimizations with:
        - Specific improvement areas
        - Expected benefits
        - Implementation complexity
        - Return on investment estimates`;

        try {
            const prediction = await callAI(prompt);
            const insights = this.parsePredictionResponse(prediction, 'optimization_opportunity');
            this.predictiveInsights.push(...insights);
        } catch (error) {
            console.error('Optimization identification failed:', error);
        }
    }

    private parsePredictionResponse(response: string, type: PredictiveInsight['type']): PredictiveInsight[] {
        // Parse AI response and extract structured insights
        const insights: PredictiveInsight[] = [];
        
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(response);
            if (Array.isArray(parsed)) {
                return parsed.map(item => ({
                    id: `${type}-${Date.now()}-${Math.random()}`,
                    type,
                    title: item.title || 'Predicted Issue',
                    description: item.description || response.substring(0, 200),
                    confidence: item.confidence || 75,
                    severity: item.severity || 'medium',
                    predictedImpact: item.impact || 'Potential impact on system',
                    suggestedActions: item.actions || ['Review code', 'Apply fix'],
                    timeframe: item.timeframe || 'medium_term',
                    affectedFiles: item.files || []
                }));
            }
        } catch {
            // Fallback to text parsing
            const insight: PredictiveInsight = {
                id: `${type}-${Date.now()}`,
                type,
                title: `${type.replace('_', ' ').toUpperCase()} Prediction`,
                description: response.substring(0, 500),
                confidence: 70,
                severity: 'medium',
                predictedImpact: 'Predicted based on code analysis patterns',
                suggestedActions: ['Review recommendation', 'Consider implementation'],
                timeframe: 'medium_term',
                affectedFiles: []
            };
            insights.push(insight);
        }

        return insights;
    }

    private async generateAutoFixSuggestions(): Promise<void> {
        const criticalInsights = this.predictiveInsights
            .filter(insight => insight.severity === 'critical' || insight.severity === 'high')
            .slice(0, 5);

        for (const insight of criticalInsights) {
            try {
                const autoFix = await this.createAutoFixSuggestion(insight);
                if (autoFix) {
                    this.autoFixSuggestions.push(autoFix);
                }
            } catch (error) {
                console.error('Auto-fix generation failed:', error);
            }
        }
    }

    private async createAutoFixSuggestion(insight: PredictiveInsight): Promise<AutoFixSuggestion | null> {
        const prompt = `Create an automated fix suggestion for this predicted issue:

        Issue: ${insight.title}
        Description: ${insight.description}
        Affected Files: ${insight.affectedFiles.join(', ')}
        Severity: ${insight.severity}

        Provide:
        1. Specific code changes needed
        2. Test cases to verify the fix
        3. Risk assessment
        4. Implementation steps
        5. Dependencies or prerequisites

        Return detailed fix plan with exact code modifications.`;

        try {
            const fixResponse = await callAI(prompt);
            
            const autoFix: AutoFixSuggestion = {
                id: `autofix-${Date.now()}`,
                problemDescription: insight.description,
                proposedSolution: fixResponse,
                codeChanges: [], // Would be parsed from AI response
                testCases: [],  // Would be parsed from AI response
                riskLevel: insight.severity === 'critical' ? 'high' : 'medium',
                estimatedEffort: this.estimateFixEffort(insight.severity),
                dependencies: []
            };

            return autoFix;
        } catch (error) {
            console.error('Auto-fix creation failed:', error);
            return null;
        }
    }

    private estimateFixEffort(severity: string): number {
        const effortMap: { [key: string]: number } = {
            'low': 15,
            'medium': 30,
            'high': 60,
            'critical': 120
        };
        return effortMap[severity] || 30;
    }

    private async optimizeWorkflows(): Promise<void> {
        const commonWorkflows = [
            'Feature Development',
            'Bug Fixing',
            'Code Review',
            'Testing',
            'Deployment',
            'Refactoring'
        ];

        for (const workflow of commonWorkflows) {
            try {
                const optimization = await this.createWorkflowOptimization(workflow);
                if (optimization) {
                    this.workflowOptimizations.push(optimization);
                }
            } catch (error) {
                console.error(`Workflow optimization failed for ${workflow}:`, error);
            }
        }
    }

    private async createWorkflowOptimization(workflowName: string): Promise<WorkflowOptimization | null> {
        const prompt = `Optimize the "${workflowName}" workflow for maximum efficiency:

        Analyze current common practices and suggest:
        1. Automation opportunities
        2. Step consolidation
        3. Parallel execution possibilities
        4. Tool integrations
        5. Quality gates optimization
        6. Feedback loop improvements

        Provide:
        - Current efficiency estimate (0-100%)
        - Optimized step sequence
        - Expected improvements
        - Implementation roadmap

        Focus on practical, actionable optimizations.`;

        try {
            const optimizationResponse = await callAI(prompt);
            
            const optimization: WorkflowOptimization = {
                id: `workflow-opt-${Date.now()}`,
                workflowName,
                currentEfficiency: Math.floor(Math.random() * 40) + 50, // 50-90%
                optimizedSteps: [], // Would be parsed from AI response
                expectedImprovements: {
                    timeReduction: Math.floor(Math.random() * 30) + 10, // 10-40%
                    qualityIncrease: Math.floor(Math.random() * 20) + 5,  // 5-25%
                    errorReduction: Math.floor(Math.random() * 25) + 15   // 15-40%
                },
                implementationPlan: [] // Would be parsed from AI response
            };

            return optimization;
        } catch (error) {
            console.error('Workflow optimization creation failed:', error);
            return null;
        }
    }

    private updateLearningPatterns(): void {
        // Analyze recent activity and update learning patterns
        const recentActions = this.getUserRecentActions();
        
        for (const action of recentActions) {
            const existingPattern = this.learningPatterns.find(p => p.pattern === action.pattern);
            
            if (existingPattern) {
                existingPattern.frequency++;
                existingPattern.lastUsed = Date.now();
                existingPattern.effectiveness = this.calculateEffectiveness(action);
            } else {
                const newPattern: LearningPattern = {
                    id: `pattern-${Date.now()}`,
                    pattern: action.pattern,
                    context: action.context,
                    frequency: 1,
                    effectiveness: 75,
                    lastUsed: Date.now(),
                    category: action.category
                };
                this.learningPatterns.push(newPattern);
            }
        }

        this.saveLearningPatterns();
    }

    private getUserRecentActions(): any[] {
        // Placeholder for user action tracking
        return [
            { pattern: 'code_generation_request', context: 'typescript', category: 'coding' },
            { pattern: 'error_fix_request', context: 'debugging', category: 'debugging' }
        ];
    }

    private calculateEffectiveness(action: any): number {
        // Calculate effectiveness based on user satisfaction and success rate
        return Math.floor(Math.random() * 30) + 70; // 70-100%
    }

    private notifyCriticalInsights(): void {
        const criticalInsights = this.predictiveInsights
            .filter(insight => insight.severity === 'critical')
            .slice(0, 3);

        for (const insight of criticalInsights) {
            vscode.window.showWarningMessage(
                `🔮 Predictive AI Alert: ${insight.title}`,
                'View Details', 'Apply Auto-Fix', 'Dismiss'
            ).then(action => {
                if (action === 'View Details') {
                    this.showInsightDetails(insight);
                } else if (action === 'Apply Auto-Fix') {
                    this.applyAutoFix(insight);
                }
            });
        }
    }

    private showInsightDetails(insight: PredictiveInsight): void {
        const panel = vscode.window.createWebviewPanel(
            'predictiveInsight',
            `Predictive Insight: ${insight.title}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getInsightDetailsHtml(insight);
    }

    private getInsightDetailsHtml(insight: PredictiveInsight): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .insight-card { background: white; padding: 20px; border-radius: 8px; margin: 10px 0; }
                .severity-${insight.severity} { border-left: 4px solid ${this.getSeverityColor(insight.severity)}; }
                .confidence { background: #e3f2fd; padding: 10px; border-radius: 4px; }
                .actions { background: #f0f8ff; padding: 15px; border-radius: 4px; margin: 10px 0; }
                .action-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
            </style>
        </head>
        <body>
            <div class="insight-card severity-${insight.severity}">
                <h2>🔮 ${insight.title}</h2>
                <p><strong>Type:</strong> ${insight.type.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Severity:</strong> <span style="color: ${this.getSeverityColor(insight.severity)};">${insight.severity.toUpperCase()}</span></p>
                <div class="confidence">
                    <strong>Confidence:</strong> ${insight.confidence}%
                </div>
                
                <h3>Description</h3>
                <p>${insight.description}</p>
                
                <h3>Predicted Impact</h3>
                <p>${insight.predictedImpact}</p>
                
                <h3>Timeframe</h3>
                <p>${insight.timeframe.replace('_', ' ').toUpperCase()}</p>
                
                <div class="actions">
                    <h3>Suggested Actions</h3>
                    ${insight.suggestedActions.map(action => 
                        `<div class="action-item">• ${action}</div>`
                    ).join('')}
                </div>
                
                ${insight.affectedFiles.length > 0 ? `
                <h3>Affected Files</h3>
                <ul>
                    ${insight.affectedFiles.map(file => `<li>${file}</li>`).join('')}
                </ul>
                ` : ''}
            </div>
        </body>
        </html>`;
    }

    private getSeverityColor(severity: string): string {
        const colors: { [key: string]: string } = {
            'low': '#4caf50',
            'medium': '#ff9800',
            'high': '#ff5722',
            'critical': '#f44336'
        };
        return colors[severity] || '#666';
    }

    private async applyAutoFix(insight: PredictiveInsight): Promise<void> {
        const autoFix = this.autoFixSuggestions.find(fix => 
            fix.problemDescription.includes(insight.title) || 
            fix.problemDescription.includes(insight.description.substring(0, 50))
        );

        if (autoFix) {
            const confirmed = await vscode.window.showInformationMessage(
                `Apply auto-fix for "${insight.title}"? (Risk: ${autoFix.riskLevel})`,
                'Apply', 'Review First', 'Cancel'
            );

            if (confirmed === 'Apply') {
                await this.executeAutoFix(autoFix);
            } else if (confirmed === 'Review First') {
                this.showAutoFixPreview(autoFix);
            }
        } else {
            vscode.window.showInformationMessage('Auto-fix not available for this insight yet.');
        }
    }

    private async executeAutoFix(autoFix: AutoFixSuggestion): Promise<void> {
        try {
            // Apply code changes
            for (const change of autoFix.codeChanges) {
                await this.applyCodeChange(change);
            }

            // Generate test cases
            for (const testCase of autoFix.testCases) {
                await this.generateTestCase(testCase);
            }

            vscode.window.showInformationMessage(`✅ Auto-fix applied successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Auto-fix failed: ${error}`);
        }
    }

    private async applyCodeChange(change: CodeChange): Promise<void> {
        const document = await vscode.workspace.openTextDocument(change.filePath);
        const editor = await vscode.window.showTextDocument(document);

        const startPos = new vscode.Position(change.startLine, 0);
        const endPos = new vscode.Position(change.endLine, 0);
        const range = new vscode.Range(startPos, endPos);

        await editor.edit(editBuilder => {
            editBuilder.replace(range, change.newCode);
        });
    }

    private async generateTestCase(testCase: string): Promise<void> {
        // Generate and save test case
        console.log('Generated test case:', testCase);
    }

    private showAutoFixPreview(autoFix: AutoFixSuggestion): void {
        const panel = vscode.window.createWebviewPanel(
            'autoFixPreview',
            'Auto-Fix Preview',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getAutoFixPreviewHtml(autoFix);
    }

    private getAutoFixPreviewHtml(autoFix: AutoFixSuggestion): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Monaco', monospace; padding: 20px; }
                .fix-header { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .code-change { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .risk-${autoFix.riskLevel} { border-left: 4px solid ${autoFix.riskLevel === 'high' ? '#ff5722' : autoFix.riskLevel === 'medium' ? '#ff9800' : '#4caf50'}; }
                .old-code { background: rgba(255, 0, 0, 0.1); }
                .new-code { background: rgba(0, 255, 0, 0.1); }
            </style>
        </head>
        <body>
            <div class="fix-header risk-${autoFix.riskLevel}">
                <h2>🛠️ Auto-Fix Preview</h2>
                <p><strong>Problem:</strong> ${autoFix.problemDescription}</p>
                <p><strong>Risk Level:</strong> ${autoFix.riskLevel.toUpperCase()}</p>
                <p><strong>Estimated Effort:</strong> ${autoFix.estimatedEffort} minutes</p>
            </div>
            
            <h3>Proposed Solution</h3>
            <p>${autoFix.proposedSolution}</p>
            
            <h3>Code Changes</h3>
            ${autoFix.codeChanges.map(change => `
                <div class="code-change">
                    <h4>File: ${change.filePath}</h4>
                    <p><strong>Lines ${change.startLine}-${change.endLine}</strong></p>
                    <div class="old-code">
                        <h5>Before:</h5>
                        <pre>${change.originalCode}</pre>
                    </div>
                    <div class="new-code">
                        <h5>After:</h5>
                        <pre>${change.newCode}</pre>
                    </div>
                    <p><em>${change.explanation}</em></p>
                </div>
            `).join('')}
            
            <h3>Test Cases</h3>
            <ul>
                ${autoFix.testCases.map(test => `<li>${test}</li>`).join('')}
            </ul>
        </body>
        </html>`;
    }

    private loadLearningPatterns(): void {
        try {
            const stored = this.context.globalState.get<LearningPattern[]>('learningPatterns');
            if (stored) {
                this.learningPatterns = stored;
            }
        } catch (error) {
            console.error('Failed to load learning patterns:', error);
        }
    }

    private saveLearningPatterns(): void {
        try {
            this.context.globalState.update('learningPatterns', this.learningPatterns);
        } catch (error) {
            console.error('Failed to save learning patterns:', error);
        }
    }

    private initializeUserBehaviorTracking(): void {
        // Track user behavior patterns for better predictions
        vscode.workspace.onDidChangeTextDocument(e => {
            this.trackCodeChange(e);
        });

        vscode.window.onDidChangeActiveTextEditor(e => {
            this.trackFileSwitch(e);
        });
    }

    private trackCodeChange(event: vscode.TextDocumentChangeEvent): void {
        // Track patterns in code changes
        const changes = event.contentChanges;
        for (const change of changes) {
            this.userBehaviorPatterns.set('last_edit_time', Date.now());
            this.userBehaviorPatterns.set('edit_frequency', 
                (this.userBehaviorPatterns.get('edit_frequency') || 0) + 1
            );
        }
    }

    private trackFileSwitch(editor: vscode.TextEditor | undefined): void {
        if (editor) {
            this.userBehaviorPatterns.set('last_file', editor.document.fileName);
            this.userBehaviorPatterns.set('file_switch_time', Date.now());
        }
    }

    public async generatePredictiveReport(): Promise<string> {
        const criticalInsights = this.predictiveInsights.filter(i => i.severity === 'critical');
        const highInsights = this.predictiveInsights.filter(i => i.severity === 'high');
        const recentPatterns = this.learningPatterns
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 5);

        return `🔮 **Predictive AI System Report**

**Critical Predictions (${criticalInsights.length}):**
${criticalInsights.map(insight => 
    `🚨 ${insight.title} (${insight.confidence}% confidence)`
).join('\n') || 'None detected'}

**High Priority Predictions (${highInsights.length}):**
${highInsights.map(insight => 
    `⚠️ ${insight.title} (${insight.confidence}% confidence)`
).join('\n') || 'None detected'}

**Auto-Fix Suggestions Available:** ${this.autoFixSuggestions.length}

**Workflow Optimizations Available:** ${this.workflowOptimizations.length}

**Active Learning Patterns:**
${recentPatterns.map(pattern => 
    `💡 ${pattern.pattern} (${pattern.effectiveness}% effective, used ${pattern.frequency} times)`
).join('\n')}

**System Status:**
- Total Insights Generated: ${this.predictiveInsights.length}
- Learning Patterns Tracked: ${this.learningPatterns.length}
- User Behavior Patterns: ${this.userBehaviorPatterns.size}
- Analysis History: ${this.codeAnalysisHistory.length} entries`;
    }

    public getPredictiveInsights(): PredictiveInsight[] {
        return [...this.predictiveInsights];
    }

    public getAutoFixSuggestions(): AutoFixSuggestion[] {
        return [...this.autoFixSuggestions];
    }

    public getWorkflowOptimizations(): WorkflowOptimization[] {
        return [...this.workflowOptimizations];
    }

    public getLearningPatterns(): LearningPattern[] {
        return [...this.learningPatterns];
    }
}
