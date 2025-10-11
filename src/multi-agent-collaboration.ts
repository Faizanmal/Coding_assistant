import * as vscode from 'vscode';
import { generateCode } from './codegenerator';

/**
 * Specialized Agent Types for Multi-Agent Collaboration
 */
export enum AgentType {
    DEBUGGER = 'debugger',
    TESTER = 'tester',
    OPTIMIZER = 'optimizer',
    DOCUMENTER = 'documenter',
    COORDINATOR = 'coordinator'
}

export interface AgentTask {
    id: string;
    type: AgentType;
    description: string;
    priority: number;
    dependencies?: string[];
    context: any;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}

export interface AgentCapability {
    name: string;
    description: string;
    supportedLanguages: string[];
    complexity: 'basic' | 'intermediate' | 'advanced';
}

/**
 * Base class for all specialized agents
 */
export abstract class SpecializedAgent {
    protected context: vscode.ExtensionContext;
    protected outputChannel: vscode.OutputChannel;
    
    constructor(
        public readonly type: AgentType,
        public readonly name: string,
        public readonly capabilities: AgentCapability[],
        context: vscode.ExtensionContext
    ) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel(`Agent: ${name}`);
    }

    abstract processTask(task: AgentTask): Promise<AgentTask>;
    
    protected log(message: string): void {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    protected updateTaskStatus(task: AgentTask, status: AgentTask['status'], result?: any, error?: string): void {
        task.status = status;
        if (result) {task.result = result;}
        if (error) {task.error = error;}
        if (status === 'completed' || status === 'failed') {
            task.completedAt = new Date();
        }
    }
}

/**
 * Debugger Agent - Handles debugging, error analysis, and troubleshooting
 */
export class DebuggerAgent extends SpecializedAgent {
    constructor(context: vscode.ExtensionContext) {
        super(
            AgentType.DEBUGGER,
            'Debug Specialist',
            [
                {
                    name: 'Error Analysis',
                    description: 'Analyze runtime errors and exceptions',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
                    complexity: 'advanced'
                },
                {
                    name: 'Debug Session Replay',
                    description: 'Replay and analyze debug sessions with AI commentary',
                    supportedLanguages: ['javascript', 'typescript', 'python'],
                    complexity: 'advanced'
                },
                {
                    name: 'Performance Issue Detection',
                    description: 'Identify performance bottlenecks and memory leaks',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'intermediate'
                }
            ],
            context
        );
    }

    async processTask(task: AgentTask): Promise<AgentTask> {
        this.log(`Processing debug task: ${task.description}`);
        
        try {
            switch (task.context.action) {
                case 'analyzeError':
                    return await this.analyzeError(task);
                case 'debugReplay':
                    return await this.debugReplay(task);
                case 'performanceAnalysis':
                    return await this.analyzePerformance(task);
                default:
                    throw new Error(`Unknown debug action: ${task.context.action}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updateTaskStatus(task, 'failed', null, errorMessage);
            return task;
        }
    }

    private async analyzeError(task: AgentTask): Promise<AgentTask> {
        const { errorMessage, stackTrace, codeContext } = task.context;
        
        const analysis = await generateCode(
            `Analyze this error and provide debugging steps:
            Error: ${errorMessage}
            Stack Trace: ${stackTrace}
            Code Context: ${codeContext}
            
            Provide:
            1. Root cause analysis
            2. Step-by-step debugging approach
            3. Potential fixes
            4. Prevention strategies`,
            'analysis'
        );

        this.updateTaskStatus(task, 'completed', {
            analysis: analysis,
            debuggingSteps: this.extractDebuggingSteps(analysis),
            suggestedFixes: this.extractSuggestedFixes(analysis)
        });

        return task;
    }

    private async debugReplay(task: AgentTask): Promise<AgentTask> {
        const { debugLog, sessionData } = task.context;
        
        const commentary = await generateCode(
            `Provide AI commentary for this debug session replay:
            Debug Log: ${debugLog}
            Session Data: ${JSON.stringify(sessionData, null, 2)}
            
            Provide step-by-step commentary explaining:
            1. What happened at each step
            2. Variable state changes
            3. Control flow decisions
            4. Potential issues identified`,
            'commentary'
        );

        this.updateTaskStatus(task, 'completed', {
            commentary: commentary,
            insights: this.extractInsights(commentary),
            recommendations: this.extractRecommendations(commentary)
        });

        return task;
    }

    private async analyzePerformance(task: AgentTask): Promise<AgentTask> {
        const { performanceData, codeMetrics } = task.context;
        
        const analysis = await generateCode(
            `Analyze performance data and identify bottlenecks:
            Performance Data: ${JSON.stringify(performanceData, null, 2)}
            Code Metrics: ${JSON.stringify(codeMetrics, null, 2)}
            
            Identify:
            1. Performance bottlenecks
            2. Memory usage issues
            3. Optimization opportunities
            4. Specific code changes needed`,
            'performance-analysis'
        );

        this.updateTaskStatus(task, 'completed', {
            analysis: analysis,
            bottlenecks: this.extractBottlenecks(analysis),
            optimizations: this.extractOptimizations(analysis)
        });

        return task;
    }

    private extractDebuggingSteps(content: string): string[] {
        // Extract debugging steps from AI analysis
        const steps = content.match(/\d+\.\s+(.+)/g) || [];
        return steps.map(step => step.replace(/^\d+\.\s+/, ''));
    }

    private extractSuggestedFixes(content: string): string[] {
        // Extract suggested fixes from analysis
        const fixSection = content.split('fixes')[1] || content;
        return fixSection.split('\n').filter(line => line.trim().length > 0);
    }

    private extractInsights(content: string): string[] {
        // Extract insights from debug commentary
        const insights = content.match(/insight[:\s]+(.+)/gi) || [];
        return insights.map(insight => insight.replace(/insight[:\s]+/i, ''));
    }

    private extractRecommendations(content: string): string[] {
        // Extract recommendations from commentary
        const recommendations = content.match(/recommend[:\s]+(.+)/gi) || [];
        return recommendations.map(rec => rec.replace(/recommend[:\s]+/i, ''));
    }

    private extractBottlenecks(content: string): string[] {
        // Extract performance bottlenecks
        const bottlenecks = content.match(/bottleneck[:\s]+(.+)/gi) || [];
        return bottlenecks.map(b => b.replace(/bottleneck[:\s]+/i, ''));
    }

    private extractOptimizations(content: string): string[] {
        // Extract optimization suggestions
        const optimizations = content.match(/optim[a-z]*[:\s]+(.+)/gi) || [];
        return optimizations.map(opt => opt.replace(/optim[a-z]*[:\s]+/i, ''));
    }
}

/**
 * Tester Agent - Handles test generation, test analysis, and quality assurance
 */
export class TesterAgent extends SpecializedAgent {
    constructor(context: vscode.ExtensionContext) {
        super(
            AgentType.TESTER,
            'Test Specialist',
            [
                {
                    name: 'Unit Test Generation',
                    description: 'Generate comprehensive unit tests',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'intermediate'
                },
                {
                    name: 'Integration Test Creation',
                    description: 'Create integration and e2e tests',
                    supportedLanguages: ['javascript', 'typescript', 'python'],
                    complexity: 'advanced'
                },
                {
                    name: 'Test Coverage Analysis',
                    description: 'Analyze and improve test coverage',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'intermediate'
                }
            ],
            context
        );
    }

    async processTask(task: AgentTask): Promise<AgentTask> {
        this.log(`Processing test task: ${task.description}`);
        
        try {
            switch (task.context.action) {
                case 'generateUnitTests':
                    return await this.generateUnitTests(task);
                case 'generateIntegrationTests':
                    return await this.generateIntegrationTests(task);
                case 'analyzeCoverage':
                    return await this.analyzeCoverage(task);
                default:
                    throw new Error(`Unknown test action: ${task.context.action}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updateTaskStatus(task, 'failed', null, errorMessage);
            return task;
        }
    }

    private async generateUnitTests(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, filePath, framework } = task.context;
        
        const tests = await generateCode(
            `Generate comprehensive unit tests for this code:
            File: ${filePath}
            Source Code: ${sourceCode}
            Testing Framework: ${framework || 'Jest'}
            
            Generate tests that cover:
            1. Happy path scenarios
            2. Edge cases
            3. Error conditions
            4. Boundary values
            5. Mock dependencies where needed`,
            'test-generation'
        );

        this.updateTaskStatus(task, 'completed', {
            tests: tests,
            testCases: this.extractTestCases(tests),
            coverage: this.estimateCoverage(tests, sourceCode)
        });

        return task;
    }

    private async generateIntegrationTests(task: AgentTask): Promise<AgentTask> {
        const { components, apiEndpoints, workflow } = task.context;
        
        const tests = await generateCode(
            `Generate integration tests for this workflow:
            Components: ${JSON.stringify(components, null, 2)}
            API Endpoints: ${JSON.stringify(apiEndpoints, null, 2)}
            Workflow: ${workflow}
            
            Create tests that verify:
            1. Component interactions
            2. API contract compliance
            3. End-to-end workflows
            4. Data flow integrity`,
            'integration-test-generation'
        );

        this.updateTaskStatus(task, 'completed', {
            tests: tests,
            testScenarios: this.extractTestScenarios(tests),
            dependencies: this.extractTestDependencies(tests)
        });

        return task;
    }

    private async analyzeCoverage(task: AgentTask): Promise<AgentTask> {
        const { coverageData, sourceFiles } = task.context;
        
        const analysis = await generateCode(
            `Analyze test coverage and suggest improvements:
            Coverage Data: ${JSON.stringify(coverageData, null, 2)}
            Source Files: ${sourceFiles.join(', ')}
            
            Provide:
            1. Coverage gaps analysis
            2. Critical uncovered areas
            3. Specific test suggestions
            4. Priority recommendations`,
            'coverage-analysis'
        );

        this.updateTaskStatus(task, 'completed', {
            analysis: analysis,
            gaps: this.extractCoverageGaps(analysis),
            suggestions: this.extractTestSuggestions(analysis)
        });

        return task;
    }

    private extractTestCases(content: string): string[] {
        const testCases = content.match(/(?:test|it)\s*\(['"`]([^'"`]+)['"`]/g) || [];
        return testCases.map(test => test.match(/['"`]([^'"`]+)['"`]/)?.[1] || '');
    }

    private estimateCoverage(tests: string, sourceCode: string): number {
        // Simple heuristic to estimate coverage
        const testLines = tests.split('\n').length;
        const sourceLines = sourceCode.split('\n').length;
        return Math.min(95, Math.round((testLines / sourceLines) * 100));
    }

    private extractTestScenarios(content: string): string[] {
        const scenarios = content.match(/describe\s*\(['"`]([^'"`]+)['"`]/g) || [];
        return scenarios.map(scenario => scenario.match(/['"`]([^'"`]+)['"`]/)?.[1] || '');
    }

    private extractTestDependencies(content: string): string[] {
        const imports = content.match(/(?:import|require)\s*[^;]+/g) || [];
        return imports.map(imp => imp.trim());
    }

    private extractCoverageGaps(content: string): string[] {
        const gaps = content.match(/gap[:\s]+(.+)/gi) || [];
        return gaps.map(gap => gap.replace(/gap[:\s]+/i, ''));
    }

    private extractTestSuggestions(content: string): string[] {
        const suggestions = content.match(/suggest[:\s]+(.+)/gi) || [];
        return suggestions.map(sug => sug.replace(/suggest[:\s]+/i, ''));
    }
}

/**
 * Optimizer Agent - Handles code optimization, performance improvements
 */
export class OptimizerAgent extends SpecializedAgent {
    constructor(context: vscode.ExtensionContext) {
        super(
            AgentType.OPTIMIZER,
            'Optimization Specialist',
            [
                {
                    name: 'Performance Optimization',
                    description: 'Optimize code for better performance',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'advanced'
                },
                {
                    name: 'Memory Optimization',
                    description: 'Reduce memory usage and prevent leaks',
                    supportedLanguages: ['javascript', 'typescript', 'python'],
                    complexity: 'advanced'
                },
                {
                    name: 'Code Quality Enhancement',
                    description: 'Improve code maintainability and readability',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'intermediate'
                }
            ],
            context
        );
    }

    async processTask(task: AgentTask): Promise<AgentTask> {
        this.log(`Processing optimization task: ${task.description}`);
        
        try {
            switch (task.context.action) {
                case 'optimizePerformance':
                    return await this.optimizePerformance(task);
                case 'optimizeMemory':
                    return await this.optimizeMemory(task);
                case 'enhanceCodeQuality':
                    return await this.enhanceCodeQuality(task);
                default:
                    throw new Error(`Unknown optimization action: ${task.context.action}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updateTaskStatus(task, 'failed', null, errorMessage);
            return task;
        }
    }

    private async optimizePerformance(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, filePath, performanceMetrics } = task.context;
        
        const optimization = await generateCode(
            `Optimize this code for better performance:
            File: ${filePath}
            Source Code: ${sourceCode}
            Performance Metrics: ${JSON.stringify(performanceMetrics, null, 2)}
            
            Provide optimized code with:
            1. Algorithm improvements
            2. Data structure optimizations
            3. Caching strategies
            4. Async/parallel processing improvements
            5. Database query optimizations`,
            'performance-optimization'
        );

        this.updateTaskStatus(task, 'completed', {
            optimizedCode: optimization,
            improvements: this.extractImprovements(optimization),
            estimatedGains: this.extractPerformanceGains(optimization)
        });

        return task;
    }

    private async optimizeMemory(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, memoryProfile } = task.context;
        
        const optimization = await generateCode(
            `Optimize this code for better memory usage:
            Source Code: ${sourceCode}
            Memory Profile: ${JSON.stringify(memoryProfile, null, 2)}
            
            Focus on:
            1. Memory leak prevention
            2. Object lifecycle management
            3. Garbage collection optimization
            4. Resource cleanup
            5. Memory-efficient data structures`,
            'memory-optimization'
        );

        this.updateTaskStatus(task, 'completed', {
            optimizedCode: optimization,
            memoryImprovements: this.extractMemoryImprovements(optimization),
            recommendations: this.extractMemoryRecommendations(optimization)
        });

        return task;
    }

    private async enhanceCodeQuality(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, codeMetrics } = task.context;
        
        const enhancement = await generateCode(
            `Enhance code quality and maintainability:
            Source Code: ${sourceCode}
            Code Metrics: ${JSON.stringify(codeMetrics, null, 2)}
            
            Improve:
            1. Code readability
            2. Function/class structure
            3. Variable naming
            4. Error handling
            5. Documentation
            6. Design patterns application`,
            'code-quality-enhancement'
        );

        this.updateTaskStatus(task, 'completed', {
            enhancedCode: enhancement,
            qualityImprovements: this.extractQualityImprovements(enhancement),
            maintainabilityScore: this.calculateMaintainabilityScore(enhancement)
        });

        return task;
    }

    private extractImprovements(content: string): string[] {
        const improvements = content.match(/improv[a-z]*[:\s]+(.+)/gi) || [];
        return improvements.map(imp => imp.replace(/improv[a-z]*[:\s]+/i, ''));
    }

    private extractPerformanceGains(content: string): string[] {
        const gains = content.match(/gain[:\s]+(.+)/gi) || [];
        return gains.map(gain => gain.replace(/gain[:\s]+/i, ''));
    }

    private extractMemoryImprovements(content: string): string[] {
        const improvements = content.match(/memory[:\s]+(.+)/gi) || [];
        return improvements.map(imp => imp.replace(/memory[:\s]+/i, ''));
    }

    private extractMemoryRecommendations(content: string): string[] {
        const recommendations = content.match(/recommend[:\s]+(.+)/gi) || [];
        return recommendations.map(rec => rec.replace(/recommend[:\s]+/i, ''));
    }

    private extractQualityImprovements(content: string): string[] {
        const improvements = content.match(/quality[:\s]+(.+)/gi) || [];
        return improvements.map(imp => imp.replace(/quality[:\s]+/i, ''));
    }

    private calculateMaintainabilityScore(content: string): number {
        // Simple heuristic to calculate maintainability score
        const factors = [
            content.includes('readable') ? 20 : 0,
            content.includes('documented') ? 20 : 0,
            content.includes('modular') ? 20 : 0,
            content.includes('error handling') ? 20 : 0,
            content.includes('pattern') ? 20 : 0
        ];
        return factors.reduce((sum, score) => sum + score, 0);
    }
}

/**
 * Documenter Agent - Handles documentation generation and maintenance
 */
export class DocumenterAgent extends SpecializedAgent {
    constructor(context: vscode.ExtensionContext) {
        super(
            AgentType.DOCUMENTER,
            'Documentation Specialist',
            [
                {
                    name: 'API Documentation',
                    description: 'Generate comprehensive API documentation',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java'],
                    complexity: 'intermediate'
                },
                {
                    name: 'Code Comments',
                    description: 'Add inline code comments and explanations',
                    supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
                    complexity: 'basic'
                },
                {
                    name: 'Architecture Documentation',
                    description: 'Create architectural and design documentation',
                    supportedLanguages: ['all'],
                    complexity: 'advanced'
                }
            ],
            context
        );
    }

    async processTask(task: AgentTask): Promise<AgentTask> {
        this.log(`Processing documentation task: ${task.description}`);
        
        try {
            switch (task.context.action) {
                case 'generateApiDocs':
                    return await this.generateApiDocumentation(task);
                case 'addCodeComments':
                    return await this.addCodeComments(task);
                case 'createArchitectureDocs':
                    return await this.createArchitectureDocumentation(task);
                default:
                    throw new Error(`Unknown documentation action: ${task.context.action}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.updateTaskStatus(task, 'failed', null, errorMessage);
            return task;
        }
    }

    private async generateApiDocumentation(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, apiEndpoints, schemas } = task.context;
        
        const documentation = await generateCode(
            `Generate comprehensive API documentation:
            Source Code: ${sourceCode}
            API Endpoints: ${JSON.stringify(apiEndpoints, null, 2)}
            Schemas: ${JSON.stringify(schemas, null, 2)}
            
            Create documentation including:
            1. Endpoint descriptions
            2. Request/response formats
            3. Authentication requirements
            4. Error handling
            5. Usage examples
            6. SDK/client code samples`,
            'api-documentation'
        );

        this.updateTaskStatus(task, 'completed', {
            documentation: documentation,
            endpoints: this.extractEndpointDocs(documentation),
            examples: this.extractCodeExamples(documentation)
        });

        return task;
    }

    private async addCodeComments(task: AgentTask): Promise<AgentTask> {
        const { sourceCode, filePath, commentStyle } = task.context;
        
        const commentedCode = await generateCode(
            `Add comprehensive inline comments to this code:
            File: ${filePath}
            Source Code: ${sourceCode}
            Comment Style: ${commentStyle || 'JSDoc'}
            
            Add:
            1. Function/method documentation
            2. Complex logic explanations
            3. Parameter descriptions
            4. Return value documentation
            5. Usage examples where appropriate
            6. TODO/FIXME notes where needed`,
            'code-commenting'
        );

        this.updateTaskStatus(task, 'completed', {
            commentedCode: commentedCode,
            commentCount: this.countComments(commentedCode),
            coverage: this.calculateCommentCoverage(commentedCode, sourceCode)
        });

        return task;
    }

    private async createArchitectureDocumentation(task: AgentTask): Promise<AgentTask> {
        const { projectStructure, dependencies, designPatterns } = task.context;
        
        const documentation = await generateCode(
            `Create architectural documentation for this project:
            Project Structure: ${JSON.stringify(projectStructure, null, 2)}
            Dependencies: ${JSON.stringify(dependencies, null, 2)}
            Design Patterns: ${JSON.stringify(designPatterns, null, 2)}
            
            Document:
            1. System architecture overview
            2. Component relationships
            3. Data flow diagrams
            4. Design decisions and rationale
            5. Deployment architecture
            6. Security considerations
            7. Performance characteristics`,
            'architecture-documentation'
        );

        this.updateTaskStatus(task, 'completed', {
            documentation: documentation,
            diagrams: this.extractDiagramReferences(documentation),
            sections: this.extractDocumentationSections(documentation)
        });

        return task;
    }

    private extractEndpointDocs(content: string): string[] {
        const endpoints = content.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+[^\s]+/g) || [];
        return endpoints;
    }

    private extractCodeExamples(content: string): string[] {
        const examples = content.match(/```[^`]*```/g) || [];
        return examples;
    }

    private countComments(content: string): number {
        const comments = content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || [];
        return comments.length;
    }

    private calculateCommentCoverage(commentedCode: string, originalCode: string): number {
        const originalLines = originalCode.split('\n').length;
        const commentLines = (commentedCode.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        return Math.round((commentLines / originalLines) * 100);
    }

    private extractDiagramReferences(content: string): string[] {
        const diagrams = content.match(/diagram[:\s]+(.+)/gi) || [];
        return diagrams.map(diag => diag.replace(/diagram[:\s]+/i, ''));
    }

    private extractDocumentationSections(content: string): string[] {
        const sections = content.match(/^#+\s+(.+)$/gm) || [];
        return sections.map(section => section.replace(/^#+\s+/, ''));
    }
}

/**
 * Multi-Agent Coordinator - Orchestrates collaboration between agents
 */
export class MultiAgentCoordinator {
    private agents: Map<AgentType, SpecializedAgent> = new Map();
    private taskQueue: AgentTask[] = [];
    private activeTasks: Map<string, AgentTask> = new Map();
    private completedTasks: AgentTask[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Multi-Agent Coordinator');
        this.initializeAgents();
    }

    private initializeAgents(): void {
        this.agents.set(AgentType.DEBUGGER, new DebuggerAgent(this.context));
        this.agents.set(AgentType.TESTER, new TesterAgent(this.context));
        this.agents.set(AgentType.OPTIMIZER, new OptimizerAgent(this.context));
        this.agents.set(AgentType.DOCUMENTER, new DocumenterAgent(this.context));

        this.outputChannel.appendLine('Multi-Agent System initialized with specialized agents:');
        for (const [type, agent] of this.agents) {
            this.outputChannel.appendLine(`- ${agent.name} (${type})`);
        }
    }

    /**
     * Create and queue a new task for processing
     */
    async createTask(
        type: AgentType,
        description: string,
        context: any,
        priority: number = 1,
        dependencies?: string[]
    ): Promise<string> {
        const task: AgentTask = {
            id: this.generateTaskId(),
            type,
            description,
            priority,
            dependencies,
            context,
            status: 'pending',
            createdAt: new Date()
        };

        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first

        this.outputChannel.appendLine(`Task created: ${task.id} - ${task.description}`);
        
        // Start processing if not already running
        this.processQueue();
        
        return task.id;
    }

    /**
     * Process the task queue
     */
    private async processQueue(): Promise<void> {
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift()!;
            
            // Check if dependencies are completed
            if (task.dependencies && !this.areDependenciesCompleted(task.dependencies)) {
                // Re-queue task at the end
                this.taskQueue.push(task);
                continue;
            }

            // Process the task
            await this.processTask(task);
        }
    }

    /**
     * Process a single task
     */
    private async processTask(task: AgentTask): Promise<void> {
        const agent = this.agents.get(task.type);
        if (!agent) {
            task.status = 'failed';
            task.error = `No agent found for type: ${task.type}`;
            this.completedTasks.push(task);
            return;
        }

        this.activeTasks.set(task.id, task);
        this.outputChannel.appendLine(`Processing task: ${task.id} with ${agent.name}`);

        try {
            const completedTask = await agent.processTask(task);
            this.activeTasks.delete(task.id);
            this.completedTasks.push(completedTask);
            
            this.outputChannel.appendLine(`Task completed: ${task.id} - Status: ${completedTask.status}`);
            
            // Notify completion
            this.notifyTaskCompletion(completedTask);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            task.status = 'failed';
            task.error = errorMessage;
            this.activeTasks.delete(task.id);
            this.completedTasks.push(task);
            
            this.outputChannel.appendLine(`Task failed: ${task.id} - Error: ${errorMessage}`);
        }
    }

    /**
     * Check if all dependencies are completed
     */
    private areDependenciesCompleted(dependencies: string[]): boolean {
        return dependencies.every(depId => 
            this.completedTasks.some(task => task.id === depId && task.status === 'completed')
        );
    }

    /**
     * Generate unique task ID
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Notify task completion to interested parties
     */
    private notifyTaskCompletion(task: AgentTask): void {
        // Show notification for completed tasks
        if (task.status === 'completed') {
            vscode.window.showInformationMessage(
                `✅ ${task.type} task completed: ${task.description}`
            );
        } else if (task.status === 'failed') {
            vscode.window.showErrorMessage(
                `❌ ${task.type} task failed: ${task.description}`
            );
        }
    }

    /**
     * Get task status
     */
    getTaskStatus(taskId: string): AgentTask | undefined {
        return this.activeTasks.get(taskId) || 
               this.completedTasks.find(task => task.id === taskId);
    }

    /**
     * Get all tasks by status
     */
    getTasksByStatus(status: AgentTask['status']): AgentTask[] {
        const activeTasks = Array.from(this.activeTasks.values()).filter(task => task.status === status);
        const completedTasks = this.completedTasks.filter(task => task.status === status);
        const queuedTasks = this.taskQueue.filter(task => task.status === status);
        
        return [...activeTasks, ...completedTasks, ...queuedTasks];
    }

    /**
     * Get agent capabilities
     */
    getAgentCapabilities(): Map<AgentType, AgentCapability[]> {
        const capabilities = new Map<AgentType, AgentCapability[]>();
        for (const [type, agent] of this.agents) {
            capabilities.set(type, agent.capabilities);
        }
        return capabilities;
    }

    /**
     * Cancel a pending task
     */
    cancelTask(taskId: string): boolean {
        const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
        if (queueIndex !== -1) {
            this.taskQueue.splice(queueIndex, 1);
            this.outputChannel.appendLine(`Task cancelled: ${taskId}`);
            return true;
        }
        return false;
    }

    /**
     * Get system statistics
     */
    getSystemStats(): any {
        return {
            totalAgents: this.agents.size,
            queuedTasks: this.taskQueue.length,
            activeTasks: this.activeTasks.size,
            completedTasks: this.completedTasks.length,
            failedTasks: this.completedTasks.filter(task => task.status === 'failed').length,
            successRate: this.completedTasks.length > 0 
                ? Math.round((this.completedTasks.filter(task => task.status === 'completed').length / this.completedTasks.length) * 100)
                : 0
        };
    }
}

// Export the coordinator instance
let coordinatorInstance: MultiAgentCoordinator | undefined;

export function getMultiAgentCoordinator(context: vscode.ExtensionContext): MultiAgentCoordinator {
    if (!coordinatorInstance) {
        coordinatorInstance = new MultiAgentCoordinator(context);
    }
    return coordinatorInstance;
}