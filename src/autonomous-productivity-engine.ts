import * as vscode from 'vscode';
import { callAI } from './codegenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface ProductivityMetrics {
    codeQuality: number;
    developmentSpeed: number;
    errorRate: number;
    testCoverage: number;
    maintainabilityIndex: number;
    duplicateCodePercentage: number;
    cyclomatic_complexity: number;
    cognitiveLoad: number;
}

export interface AutomationRule {
    id: string;
    name: string;
    trigger: 'file_save' | 'code_change' | 'error_detected' | 'schedule' | 'productivity_drop';
    condition: string;
    actions: AutomationAction[];
    priority: number;
    enabled: boolean;
    learningEnabled: boolean;
}

export interface AutomationAction {
    type: 'code_format' | 'add_tests' | 'optimize_imports' | 'refactor' | 'add_documentation' | 'security_scan' | 'performance_analyze' | 'ai_review';
    parameters: any;
    aiModel?: string;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'development' | 'testing' | 'deployment' | 'maintenance' | 'optimization';
    steps: WorkflowStep[];
    triggers: string[];
    estimatedTime: number;
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface WorkflowStep {
    id: string;
    name: string;
    type: 'ai_action' | 'vscode_command' | 'file_operation' | 'shell_command' | 'user_input';
    action: string;
    parameters: any;
    dependencies: string[];
    parallel: boolean;
    retryCount: number;
}

export class AutonomousProductivityEngine {
    private static instance: AutonomousProductivityEngine;
    private automationRules: AutomationRule[] = [];
    private workflowTemplates: WorkflowTemplate[] = [];
    private productivityMetrics: ProductivityMetrics = {
        codeQuality: 0,
        developmentSpeed: 0,
        errorRate: 0,
        testCoverage: 0,
        maintainabilityIndex: 0,
        duplicateCodePercentage: 0,
        cyclomatic_complexity: 0,
        cognitiveLoad: 0
    };
    private context: vscode.ExtensionContext;
    private activeWorkflows: Map<string, any> = new Map();
    private learningData: any[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeDefaultRules();
        this.initializeWorkflowTemplates();
        this.startProductivityMonitoring();
    }

    public static getInstance(context: vscode.ExtensionContext): AutonomousProductivityEngine {
        if (!AutonomousProductivityEngine.instance) {
            AutonomousProductivityEngine.instance = new AutonomousProductivityEngine(context);
        }
        return AutonomousProductivityEngine.instance;
    }

    private initializeDefaultRules(): void {
        this.automationRules = [
            {
                id: 'auto-format-on-save',
                name: 'Auto Format & Optimize on Save',
                trigger: 'file_save',
                condition: 'file.language in ["typescript", "javascript", "python", "java"]',
                actions: [
                    { type: 'code_format', parameters: {} },
                    { type: 'optimize_imports', parameters: {} },
                    { type: 'add_documentation', parameters: { style: 'smart' }, aiModel: 'groq' }
                ],
                priority: 1,
                enabled: true,
                learningEnabled: true
            },
            {
                id: 'auto-test-generation',
                name: 'Auto Generate Tests for New Functions',
                trigger: 'code_change',
                condition: 'hasNewFunction() && !hasTests()',
                actions: [
                    { type: 'add_tests', parameters: { framework: 'auto-detect', coverage: 90 }, aiModel: 'groq' }
                ],
                priority: 2,
                enabled: true,
                learningEnabled: true
            },
            {
                id: 'performance-optimization',
                name: 'Auto Performance Optimization',
                trigger: 'productivity_drop',
                condition: 'performanceScore < 0.7',
                actions: [
                    { type: 'performance_analyze', parameters: {} },
                    { type: 'refactor', parameters: { focus: 'performance' }, aiModel: 'together' }
                ],
                priority: 3,
                enabled: true,
                learningEnabled: true
            },
            {
                id: 'security-scan',
                name: 'Auto Security Vulnerability Scan',
                trigger: 'file_save',
                condition: 'hasSecurityPatterns() || isProductionCode()',
                actions: [
                    { type: 'security_scan', parameters: { comprehensive: true } },
                    { type: 'ai_review', parameters: { focus: 'security' }, aiModel: 'mistral' }
                ],
                priority: 1,
                enabled: true,
                learningEnabled: true
            }
        ];
    }

    private initializeWorkflowTemplates(): void {
        this.workflowTemplates = [
            {
                id: 'new-feature-workflow',
                name: 'Complete New Feature Development',
                description: 'End-to-end workflow for developing a new feature with tests, docs, and deployment prep',
                category: 'development',
                steps: [
                    {
                        id: 'analyze-requirements',
                        name: 'Analyze Requirements',
                        type: 'ai_action',
                        action: 'analyze_feature_requirements',
                        parameters: { model: 'groq' },
                        dependencies: [],
                        parallel: false,
                        retryCount: 2
                    },
                    {
                        id: 'generate-architecture',
                        name: 'Generate Architecture Plan',
                        type: 'ai_action',
                        action: 'create_architecture_plan',
                        parameters: { model: 'together' },
                        dependencies: ['analyze-requirements'],
                        parallel: false,
                        retryCount: 2
                    },
                    {
                        id: 'create-files',
                        name: 'Create Core Files',
                        type: 'ai_action',
                        action: 'generate_feature_files',
                        parameters: { model: 'groq' },
                        dependencies: ['generate-architecture'],
                        parallel: true,
                        retryCount: 3
                    },
                    {
                        id: 'generate-tests',
                        name: 'Generate Comprehensive Tests',
                        type: 'ai_action',
                        action: 'generate_tests',
                        parameters: { coverage: 95, model: 'mistral' },
                        dependencies: ['create-files'],
                        parallel: true,
                        retryCount: 2
                    },
                    {
                        id: 'create-documentation',
                        name: 'Create Documentation',
                        type: 'ai_action',
                        action: 'generate_documentation',
                        parameters: { include_examples: true, model: 'groq' },
                        dependencies: ['create-files'],
                        parallel: true,
                        retryCount: 2
                    },
                    {
                        id: 'quality-review',
                        name: 'AI Quality Review',
                        type: 'ai_action',
                        action: 'comprehensive_review',
                        parameters: { model: 'together' },
                        dependencies: ['generate-tests', 'create-documentation'],
                        parallel: false,
                        retryCount: 1
                    }
                ],
                triggers: ['user_request', 'scheduled'],
                estimatedTime: 1800, // 30 minutes
                skillLevel: 'intermediate'
            },
            {
                id: 'code-optimization-workflow',
                name: 'AI-Powered Code Optimization',
                description: 'Comprehensive code optimization including performance, readability, and maintainability',
                category: 'optimization',
                steps: [
                    {
                        id: 'analyze-performance',
                        name: 'Performance Analysis',
                        type: 'ai_action',
                        action: 'analyze_performance_bottlenecks',
                        parameters: { model: 'cerebras' },
                        dependencies: [],
                        parallel: false,
                        retryCount: 2
                    },
                    {
                        id: 'detect-duplicates',
                        name: 'Detect Code Duplicates',
                        type: 'ai_action',
                        action: 'detect_code_duplicates',
                        parameters: { threshold: 0.8 },
                        dependencies: [],
                        parallel: true,
                        retryCount: 1
                    },
                    {
                        id: 'refactor-suggestions',
                        name: 'Generate Refactoring Suggestions',
                        type: 'ai_action',
                        action: 'suggest_refactoring',
                        parameters: { model: 'groq', focus: 'maintainability' },
                        dependencies: ['analyze-performance', 'detect-duplicates'],
                        parallel: false,
                        retryCount: 2
                    },
                    {
                        id: 'apply-optimizations',
                        name: 'Apply AI-Suggested Optimizations',
                        type: 'ai_action',
                        action: 'apply_optimizations',
                        parameters: { confirmation_required: true },
                        dependencies: ['refactor-suggestions'],
                        parallel: false,
                        retryCount: 3
                    }
                ],
                triggers: ['performance_alert', 'scheduled_weekly'],
                estimatedTime: 900, // 15 minutes
                skillLevel: 'advanced'
            }
        ];
    }

    public async executeAutomationRule(ruleId: string, context: any): Promise<void> {
        const rule = this.automationRules.find(r => r.id === ruleId && r.enabled);
        if (!rule) {
            return;
        }

        try {
            for (const action of rule.actions) {
                await this.executeAction(action, context);
            }

            // Learn from successful execution
            if (rule.learningEnabled) {
                this.recordSuccessfulExecution(rule, context);
            }

        } catch (error) {
            console.error(`Failed to execute automation rule ${ruleId}:`, error);
            this.recordFailedExecution(rule, context, error);
        }
    }

    public async executeWorkflow(templateId: string, parameters: any = {}): Promise<string> {
        const template = this.workflowTemplates.find(t => t.id === templateId);
        if (!template) {
            throw new Error(`Workflow template ${templateId} not found`);
        }

        const workflowId = `${templateId}-${Date.now()}`;
        this.activeWorkflows.set(workflowId, {
            template,
            status: 'running',
            startTime: Date.now(),
            parameters,
            completedSteps: [],
            currentStep: 0
        });

        try {
            await this.executeWorkflowSteps(template.steps, workflowId);
            this.activeWorkflows.get(workflowId)!.status = 'completed';
            return `Workflow ${template.name} completed successfully`;
        } catch (error) {
            this.activeWorkflows.get(workflowId)!.status = 'failed';
            throw error;
        }
    }

    private async executeWorkflowSteps(steps: WorkflowStep[], workflowId: string): Promise<void> {
        const workflow = this.activeWorkflows.get(workflowId)!;
        const stepGraph = this.buildDependencyGraph(steps);
        
        for (const stepLevel of stepGraph) {
            const promises = stepLevel.map(step => this.executeWorkflowStep(step, workflow));
            await Promise.all(promises);
        }
    }

    private buildDependencyGraph(steps: WorkflowStep[]): WorkflowStep[][] {
        const graph: WorkflowStep[][] = [];
        const processed = new Set<string>();
        const stepMap = new Map(steps.map(s => [s.id, s]));

        while (processed.size < steps.length) {
            const currentLevel: WorkflowStep[] = [];
            
            for (const step of steps) {
                if (!processed.has(step.id)) {
                    const allDependenciesMet = step.dependencies.every(dep => processed.has(dep));
                    if (allDependenciesMet) {
                        currentLevel.push(step);
                    }
                }
            }

            if (currentLevel.length === 0) {
                throw new Error('Circular dependency detected in workflow steps');
            }

            graph.push(currentLevel);
            currentLevel.forEach(step => processed.add(step.id));
        }

        return graph;
    }

    private async executeWorkflowStep(step: WorkflowStep, workflow: any): Promise<void> {
        let retryCount = 0;
        
        while (retryCount <= step.retryCount) {
            try {
                switch (step.type) {
                    case 'ai_action':
                        await this.executeAIAction(step.action, step.parameters);
                        break;
                    case 'vscode_command':
                        await vscode.commands.executeCommand(step.action, step.parameters);
                        break;
                    case 'file_operation':
                        await this.executeFileOperation(step.action, step.parameters);
                        break;
                    case 'shell_command':
                        await this.executeShellCommand(step.action, step.parameters);
                        break;
                    default:
                        throw new Error(`Unknown step type: ${step.type}`);
                }
                
                workflow.completedSteps.push(step.id);
                return;
                
            } catch (error) {
                retryCount++;
                if (retryCount > step.retryCount) {
                    throw error;
                }
                await this.delay(1000 * retryCount); // Exponential backoff
            }
        }
    }

    private async executeAction(action: AutomationAction, context: any): Promise<void> {
        switch (action.type) {
            case 'code_format':
                await vscode.commands.executeCommand('editor.action.formatDocument');
                break;
            case 'optimize_imports':
                await vscode.commands.executeCommand('editor.action.organizeImports');
                break;
            case 'add_tests':
                await this.generateTests(action.parameters, action.aiModel);
                break;
            case 'add_documentation':
                await this.generateDocumentation(action.parameters, action.aiModel);
                break;
            case 'security_scan':
                await this.performSecurityScan(action.parameters);
                break;
            case 'performance_analyze':
                await this.analyzePerformance(action.parameters);
                break;
            case 'ai_review':
                await this.performAIReview(action.parameters, action.aiModel);
                break;
            case 'refactor':
                await this.performRefactoring(action.parameters, action.aiModel);
                break;
        }
    }

    private async executeAIAction(action: string, parameters: any): Promise<void> {
        const prompt = this.buildAIPrompt(action, parameters);
        const model = parameters.model || 'groq';
        const result = await callAI(prompt);
        
        // Process AI result based on action type
        await this.processAIResult(action, result, parameters);
    }

    private buildAIPrompt(action: string, parameters: any): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const context = workspaceFolder ? workspaceFolder.uri.fsPath : '';

        switch (action) {
            case 'analyze_feature_requirements':
                return `Analyze the feature requirements and create a comprehensive development plan. Context: ${context}`;
            case 'create_architecture_plan':
                return `Create a detailed architecture plan for the feature including file structure, dependencies, and integration points.`;
            case 'generate_feature_files':
                return `Generate the core files needed for this feature with full implementation.`;
            case 'generate_tests':
                return `Generate comprehensive tests with ${parameters.coverage || 90}% coverage target.`;
            case 'comprehensive_review':
                return `Perform a comprehensive code review focusing on quality, performance, and maintainability.`;
            default:
                return `Execute ${action} with parameters: ${JSON.stringify(parameters)}`;
        }
    }

    private async processAIResult(action: string, result: string, parameters: any): Promise<void> {
        // Process the AI result based on the action type
        // This would involve parsing the result and taking appropriate actions
        console.log(`Processing AI result for ${action}:`, result);
    }

    private async generateTests(parameters: any, aiModel?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const prompt = `Generate comprehensive unit tests for this code with ${parameters.coverage || 90}% coverage:\n\n${code}`;
        
        const tests = await callAI(prompt);
        
        // Create test file
        const testFileName = this.generateTestFileName(editor.document.fileName);
        const testPath = path.join(path.dirname(editor.document.fileName), testFileName);
        
        await fs.promises.writeFile(testPath, tests);
        vscode.window.showInformationMessage(`Tests generated: ${testFileName}`);
    }

    private async generateDocumentation(parameters: any, aiModel?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const prompt = `Generate comprehensive documentation for this code including JSDoc comments, README sections, and usage examples:\n\n${code}`;
        
        const docs = await callAI(prompt);
        
        // Apply documentation to the code
        await this.applyDocumentationToCode(editor, docs);
    }

    private async performSecurityScan(parameters: any): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const prompt = `Perform a comprehensive security scan of this code. Identify vulnerabilities, security anti-patterns, and provide fixes:\n\n${code}`;
        
        const securityReport = await callAI(prompt);
        
        // Display security report
        vscode.window.showInformationMessage('Security scan completed. Check output panel for details.');
        console.log('Security Report:', securityReport);
    }

    private async analyzePerformance(parameters: any): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const prompt = `Analyze this code for performance bottlenecks, complexity issues, and optimization opportunities:\n\n${code}`;
        
        const performanceReport = await callAI(prompt);
        
        // Update productivity metrics
        this.updateProductivityMetrics(performanceReport);
        
        vscode.window.showInformationMessage('Performance analysis completed.');
    }

    private async performAIReview(parameters: any, aiModel?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const focus = parameters.focus || 'general';
        const prompt = `Perform a detailed code review focusing on ${focus}. Provide specific suggestions for improvement:\n\n${code}`;
        
        const review = await callAI(prompt);
        
        // Display review in a webview
        this.showReviewPanel(review);
    }

    private async performRefactoring(parameters: any, aiModel?: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const code = editor.document.getText();
        const focus = parameters.focus || 'maintainability';
        const prompt = `Refactor this code focusing on ${focus}. Provide the complete refactored code:\n\n${code}`;
        
        const refactoredCode = await callAI(prompt);
        
        // Apply refactoring with confirmation
        const apply = await vscode.window.showInformationMessage(
            'Apply AI-suggested refactoring?',
            'Yes', 'No', 'Show Diff'
        );

        if (apply === 'Yes') {
            await editor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                editBuilder.replace(fullRange, refactoredCode);
            });
        }
    }

    private generateTestFileName(fileName: string): string {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        return `${base}.test${ext}`;
    }

    private async applyDocumentationToCode(editor: vscode.TextEditor, docs: string): Promise<void> {
        // Parse documentation and apply to appropriate locations in the code
        // This is a simplified implementation
        const position = new vscode.Position(0, 0);
        await editor.edit(editBuilder => {
            editBuilder.insert(position, `/**\n * ${docs}\n */\n`);
        });
    }

    private updateProductivityMetrics(performanceReport: string): void {
        // Parse performance report and update metrics
        // This would involve sophisticated analysis of the AI response
        this.productivityMetrics.developmentSpeed = Math.random() * 100; // Placeholder
        this.productivityMetrics.codeQuality = Math.random() * 100; // Placeholder
    }

    private showReviewPanel(review: string): void {
        const panel = vscode.window.createWebviewPanel(
            'aiReview',
            'AI Code Review',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getReviewHtml(review);
    }

    private getReviewHtml(review: string): string {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .review-section { margin: 20px 0; padding: 15px; border-left: 4px solid #007acc; }
                .suggestion { background: #f0f8ff; padding: 10px; margin: 10px 0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>🤖 AI Code Review</h1>
            <div class="review-section">
                <pre>${review}</pre>
            </div>
        </body>
        </html>`;
    }

    private async executeFileOperation(action: string, parameters: any): Promise<void> {
        // Implement file operations
        console.log(`Executing file operation: ${action}`, parameters);
    }

    private async executeShellCommand(action: string, parameters: any): Promise<void> {
        // Implement shell command execution
        console.log(`Executing shell command: ${action}`, parameters);
    }

    private recordSuccessfulExecution(rule: AutomationRule, context: any): void {
        this.learningData.push({
            ruleId: rule.id,
            context,
            success: true,
            timestamp: Date.now()
        });
    }

    private recordFailedExecution(rule: AutomationRule, context: any, error: any): void {
        this.learningData.push({
            ruleId: rule.id,
            context,
            success: false,
            error: error.message,
            timestamp: Date.now()
        });
    }

    private startProductivityMonitoring(): void {
        // Monitor workspace activity and trigger automation rules
        setInterval(() => {
            this.evaluateProductivityMetrics();
        }, 60000); // Check every minute
    }

    private evaluateProductivityMetrics(): void {
        // Calculate current productivity metrics
        const currentMetrics = this.calculateCurrentMetrics();
        
        // Check if any automation rules should be triggered
        for (const rule of this.automationRules) {
            if (rule.enabled && this.shouldTriggerRule(rule, currentMetrics)) {
                this.executeAutomationRule(rule.id, { metrics: currentMetrics });
            }
        }
    }

    private calculateCurrentMetrics(): ProductivityMetrics {
        // Implement sophisticated metrics calculation
        return this.productivityMetrics;
    }

    private shouldTriggerRule(rule: AutomationRule, metrics: ProductivityMetrics): boolean {
        // Implement rule condition evaluation
        if (rule.trigger === 'productivity_drop') {
            return metrics.developmentSpeed < 70 || metrics.codeQuality < 80;
        }
        return false;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getProductivityMetrics(): ProductivityMetrics {
        return { ...this.productivityMetrics };
    }

    public getActiveWorkflows(): Map<string, any> {
        return new Map(this.activeWorkflows);
    }

    public getAutomationRules(): AutomationRule[] {
        return [...this.automationRules];
    }

    public updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>): void {
        const index = this.automationRules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            this.automationRules[index] = { ...this.automationRules[index], ...updates };
        }
    }

    public addCustomWorkflow(template: WorkflowTemplate): void {
        this.workflowTemplates.push(template);
    }
}