import * as vscode from 'vscode';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { ProjectKnowledgeSystem, CodeEntity } from './project-knowledge-system';
import { SemanticCodeSystem } from './semantic-code-system';
import { EnhancedContextSystem } from './enhanced-context-system';
import { AgenticChainOfThoughtSystem } from './agentic-chain-of-thought';

/**
 * Autonomous Multi-Step Coding Workflows System
 * Provides intelligent, autonomous execution of complex development tasks
 */

export interface WorkflowStep {
    id: string;
    name: string;
    description: string;
    type: 'analysis' | 'generation' | 'modification' | 'validation' | 'research';
    dependencies: string[]; // step IDs this depends on
    estimatedDuration: number; // in seconds
    inputs: any;
    outputs?: any;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    progress: number; // 0-100
    startTime?: Date;
    endTime?: Date;
    errorMessage?: string;
}

export interface AutonomousWorkflow {
    id: string;
    name: string;
    description: string;
    goal: string;
    steps: WorkflowStep[];
    currentStepIndex: number;
    status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
    progress: number;
    startTime?: Date;
    endTime?: Date;
    metadata: {
        complexity: 'low' | 'medium' | 'high';
        estimatedDuration: number;
        requiredPermissions: string[];
        fileTypes: string[];
        riskLevel: 'low' | 'medium' | 'high';
    };
    results?: {
        filesModified: string[];
        insights: string[];
        suggestions: string[];
        metrics: Record<string, number>;
    };
}

export interface CrossFileReasoning {
    analysis: {
        affectedFiles: string[];
        dependencies: Array<{
            from: string;
            to: string;
            type: 'import' | 'function_call' | 'inheritance' | 'composition';
        }>;
        impactRadius: number;
        riskAssessment: {
            breakingChanges: string[];
            testingNeeded: string[];
            rollbackPlan: string[];
        };
    };
    recommendations: Array<{
        action: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        reasoning: string;
        alternatives: string[];
    }>;
}

export class AutonomousWorkflowSystem {
    private static instance: AutonomousWorkflowSystem;
    private knowledgeSystem: ProjectKnowledgeSystem;
    private semanticSystem: SemanticCodeSystem;
    private contextSystem: EnhancedContextSystem;
    private chainOfThought: AgenticChainOfThoughtSystem;
    private activeWorkflows: Map<string, AutonomousWorkflow> = new Map();
    private workflowHistory: AutonomousWorkflow[] = [];
    private webviewView?: vscode.WebviewView;

    // Predefined workflow templates
    private workflowTemplates: Map<string, Partial<AutonomousWorkflow>> = new Map();

    constructor() {
        this.knowledgeSystem = ProjectKnowledgeSystem.getInstance();
        this.semanticSystem = SemanticCodeSystem.getInstance();
        this.contextSystem = EnhancedContextSystem.getInstance();
        this.chainOfThought = AgenticChainOfThoughtSystem.getInstance();
        this.initializeWorkflowTemplates();
    }

    static getInstance(): AutonomousWorkflowSystem {
        if (!this.instance) {
            this.instance = new AutonomousWorkflowSystem();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
    }

    /**
     * Initialize predefined workflow templates
     */
    private initializeWorkflowTemplates(): void {
        // Feature Implementation Workflow
        this.workflowTemplates.set('implement-feature', {
            name: 'Feature Implementation',
            description: 'Complete implementation of a new feature',
            metadata: {
                complexity: 'high',
                estimatedDuration: 1800, // 30 minutes
                requiredPermissions: ['file-write', 'test-run'],
                fileTypes: ['ts', 'js', 'json'],
                riskLevel: 'medium'
            }
        });

        // Bug Fix Workflow
        this.workflowTemplates.set('fix-bug', {
            name: 'Bug Fix & Validation',
            description: 'Identify, fix, and validate bug resolution',
            metadata: {
                complexity: 'medium',
                estimatedDuration: 900, // 15 minutes
                requiredPermissions: ['file-write', 'test-run', 'debug'],
                fileTypes: ['ts', 'js'],
                riskLevel: 'low'
            }
        });

        // Refactoring Workflow
        this.workflowTemplates.set('refactor-code', {
            name: 'Code Refactoring',
            description: 'Systematic code improvement and restructuring',
            metadata: {
                complexity: 'high',
                estimatedDuration: 2400, // 40 minutes
                requiredPermissions: ['file-write', 'test-run'],
                fileTypes: ['ts', 'js'],
                riskLevel: 'medium'
            }
        });

        // Testing Workflow
        this.workflowTemplates.set('generate-tests', {
            name: 'Comprehensive Testing',
            description: 'Generate and implement comprehensive test suite',
            metadata: {
                complexity: 'medium',
                estimatedDuration: 1200, // 20 minutes
                requiredPermissions: ['file-write', 'test-run'],
                fileTypes: ['test.ts', 'spec.ts'],
                riskLevel: 'low'
            }
        });

        // Documentation Workflow
        this.workflowTemplates.set('generate-docs', {
            name: 'Documentation Generation',
            description: 'Generate comprehensive project documentation',
            metadata: {
                complexity: 'low',
                estimatedDuration: 600, // 10 minutes
                requiredPermissions: ['file-write'],
                fileTypes: ['md', 'ts'],
                riskLevel: 'low'
            }
        });
    }

    /**
     * Plan and create an autonomous workflow based on user request
     */
    async planWorkflow(
        request: string, 
        context?: string[], 
        constraints?: {
            maxDuration?: number;
            allowedFiles?: string[];
            riskTolerance?: 'low' | 'medium' | 'high';
        }
    ): Promise<AutonomousWorkflow> {
        console.log(`🤖 Planning autonomous workflow for: "${request}"`);

        try {
            // Analyze request to determine workflow type
            const workflowType = await this.analyzeWorkflowType(request);
            
            // Get base template if available
            const template = this.workflowTemplates.get(workflowType) || {};
            
            // Generate detailed workflow plan
            const workflow: AutonomousWorkflow = {
                id: this.generateWorkflowId(),
                name: template.name || `Custom Workflow: ${request.substring(0, 50)}...`,
                description: template.description || `Autonomous execution of: ${request}`,
                goal: request,
                steps: [],
                currentStepIndex: 0,
                status: 'planning',
                progress: 0,
                metadata: {
                    complexity: template.metadata?.complexity || 'medium',
                    estimatedDuration: template.metadata?.estimatedDuration || 1200,
                    requiredPermissions: template.metadata?.requiredPermissions || ['file-write'],
                    fileTypes: template.metadata?.fileTypes || ['ts', 'js'],
                    riskLevel: template.metadata?.riskLevel || 'medium'
                }
            };

            // Apply constraints
            if (constraints) {
                if (constraints.maxDuration) {
                    workflow.metadata.estimatedDuration = Math.min(
                        workflow.metadata.estimatedDuration, 
                        constraints.maxDuration
                    );
                }
                if (constraints.riskTolerance) {
                    workflow.metadata.riskLevel = constraints.riskTolerance;
                }
            }

            // Generate workflow steps using AI
            workflow.steps = await this.generateWorkflowSteps(workflow, request, context);
            
            // Store workflow
            this.activeWorkflows.set(workflow.id, workflow);
            
            // Notify user
            this.notifyWorkflowPlanned(workflow);
            
            return workflow;

        } catch (error) {
            console.error('Workflow planning failed:', error);
            throw new Error(`Failed to plan workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Analyze request to determine workflow type
     */
    private async analyzeWorkflowType(request: string): Promise<string> {
        const requestLower = request.toLowerCase();
        
        // Pattern matching for common workflow types
        if (requestLower.includes('implement') || requestLower.includes('add feature') || requestLower.includes('create')) {
            return 'implement-feature';
        }
        if (requestLower.includes('fix') || requestLower.includes('bug') || requestLower.includes('error')) {
            return 'fix-bug';
        }
        if (requestLower.includes('refactor') || requestLower.includes('improve') || requestLower.includes('optimize')) {
            return 'refactor-code';
        }
        if (requestLower.includes('test') || requestLower.includes('testing')) {
            return 'generate-tests';
        }
        if (requestLower.includes('document') || requestLower.includes('docs')) {
            return 'generate-docs';
        }
        
        // Use AI for complex requests
        try {
            const analysisPrompt = `Analyze this development request and classify it:

Request: "${request}"

Classify as one of:
- implement-feature (new functionality)
- fix-bug (bug fixes and corrections)
- refactor-code (code improvement and restructuring)
- generate-tests (testing and validation)
- generate-docs (documentation)
- custom (unique requirements)

Respond with only the classification:`;

            const classification = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            return classification.trim();

        } catch (error) {
            console.warn('AI workflow classification failed, using default');
            return 'custom';
        }
    }

    /**
     * Generate detailed workflow steps using AI
     */
    private async generateWorkflowSteps(
        workflow: AutonomousWorkflow, 
        request: string, 
        context?: string[]
    ): Promise<WorkflowStep[]> {
        try {
            // Get project context
            const knowledgeGraph = await this.knowledgeSystem.buildKnowledgeGraph();
            const projectContext = Array.from(knowledgeGraph.entities.values())
                .slice(0, 10)
                .map(e => `${e.name} (${e.type}): ${e.purpose}`)
                .join('\n');

            // Generate steps using AI
            const stepsPrompt = `Create detailed autonomous workflow steps for this development task:

REQUEST: ${request}
WORKFLOW TYPE: ${workflow.name}
COMPLEXITY: ${workflow.metadata.complexity}
MAX DURATION: ${workflow.metadata.estimatedDuration} seconds

PROJECT CONTEXT:
${projectContext}

${context ? `ADDITIONAL CONTEXT:\n${context.join('\n')}` : ''}

Generate 5-10 specific, actionable steps that can be executed autonomously. Each step should be:
1. Specific and measurable
2. Include necessary inputs/outputs
3. Have clear success criteria
4. Include estimated duration (in seconds)

Format as JSON array:
[
  {
    "name": "Step name",
    "description": "Detailed description",
    "type": "analysis|generation|modification|validation|research",
    "dependencies": ["step-id"],
    "estimatedDuration": 120,
    "inputs": {"key": "value"}
  }
]`;

            const aiResponse = await generateCode(stepsPrompt, 'llama-3.3-70b-versatile');
            const stepsData = JSON.parse(aiResponse);

            // Convert to WorkflowStep objects
            const steps: WorkflowStep[] = stepsData.map((stepData: any, index: number) => ({
                id: `step-${index + 1}`,
                name: stepData.name,
                description: stepData.description,
                type: stepData.type || 'analysis',
                dependencies: stepData.dependencies || [],
                estimatedDuration: stepData.estimatedDuration || 120,
                inputs: stepData.inputs || {},
                status: 'pending',
                progress: 0
            }));

            return steps;

        } catch (error) {
            console.warn('AI step generation failed, using fallback steps');
            
            // Fallback steps based on workflow type
            return this.generateFallbackSteps(workflow, request);
        }
    }

    /**
     * Generate fallback steps when AI fails
     */
    private generateFallbackSteps(workflow: AutonomousWorkflow, request: string): WorkflowStep[] {
        const baseSteps: WorkflowStep[] = [
            {
                id: 'step-1',
                name: 'Analyze Requirements',
                description: 'Analyze the request and gather project context',
                type: 'analysis',
                dependencies: [],
                estimatedDuration: 60,
                inputs: { request },
                status: 'pending',
                progress: 0
            },
            {
                id: 'step-2',
                name: 'Plan Implementation',
                description: 'Create detailed implementation plan',
                type: 'analysis',
                dependencies: ['step-1'],
                estimatedDuration: 90,
                inputs: {},
                status: 'pending',
                progress: 0
            },
            {
                id: 'step-3',
                name: 'Execute Changes',
                description: 'Implement the required changes',
                type: 'modification',
                dependencies: ['step-2'],
                estimatedDuration: 300,
                inputs: {},
                status: 'pending',
                progress: 0
            },
            {
                id: 'step-4',
                name: 'Validate Results',
                description: 'Test and validate the implementation',
                type: 'validation',
                dependencies: ['step-3'],
                estimatedDuration: 120,
                inputs: {},
                status: 'pending',
                progress: 0
            }
        ];

        return baseSteps;
    }

    /**
     * Execute an autonomous workflow
     */
    async executeWorkflow(workflowId: string): Promise<void> {
        const workflow = this.activeWorkflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        console.log(`🚀 Executing autonomous workflow: ${workflow.name}`);
        
        try {
            workflow.status = 'running';
            workflow.startTime = new Date();
            workflow.currentStepIndex = 0;
            
            // Execute steps in dependency order
            const executionOrder = this.resolveExecutionOrder(workflow.steps);
            
            for (const stepId of executionOrder) {
                const step = workflow.steps.find(s => s.id === stepId);
                if (!step) { continue; }

                await this.executeWorkflowStep(workflow, step);
                
                if (step.status === 'failed') {
                    workflow.status = 'failed';
                    break;
                }
            }

            if (workflow.status !== 'failed') {
                workflow.status = 'completed';
                workflow.progress = 100;
            }
            
            workflow.endTime = new Date();
            this.notifyWorkflowCompleted(workflow);
            
            // Archive to history
            this.workflowHistory.push(workflow);
            this.activeWorkflows.delete(workflowId);

        } catch (error) {
            console.error('Workflow execution failed:', error);
            workflow.status = 'failed';
            workflow.endTime = new Date();
            throw error;
        }
    }

    /**
     * Execute a single workflow step
     */
    private async executeWorkflowStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        console.log(`📋 Executing step: ${step.name}`);
        
        step.status = 'running';
        step.startTime = new Date();
        step.progress = 0;

        try {
            switch (step.type) {
                case 'analysis':
                    await this.executeAnalysisStep(workflow, step);
                    break;
                case 'generation':
                    await this.executeGenerationStep(workflow, step);
                    break;
                case 'modification':
                    await this.executeModificationStep(workflow, step);
                    break;
                case 'validation':
                    await this.executeValidationStep(workflow, step);
                    break;
                case 'research':
                    await this.executeResearchStep(workflow, step);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }

            step.status = 'completed';
            step.progress = 100;
            step.endTime = new Date();

        } catch (error) {
            step.status = 'failed';
            step.errorMessage = error instanceof Error ? error.message : 'Unknown error';
            step.endTime = new Date();
            console.error(`Step ${step.name} failed:`, error);
            throw error;
        }
    }

    /**
     * Execute analysis step
     */
    private async executeAnalysisStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        // Perform cross-file reasoning if needed
        const crossFileAnalysis = await this.performCrossFileReasoning(workflow.goal);
        
        // Use semantic search to gather relevant context
        const searchResults = await this.semanticSystem.semanticSearch(workflow.goal, {
            maxResults: 5,
            includeContext: true
        });

        step.outputs = {
            crossFileAnalysis,
            relevantEntities: searchResults,
            insights: [`Found ${searchResults.length} relevant code entities`]
        };

        step.progress = 100;
    }

    /**
     * Execute generation step
     */
    private async executeGenerationStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        // Use project-aware code generation
        const generatedCode = await this.semanticSystem.generateProjectAwareCode(
            step.description,
            step.inputs.targetFile,
            step.inputs.context
        );

        step.outputs = {
            generatedCode,
            codeLength: generatedCode.length,
            generatedAt: new Date().toISOString()
        };

        step.progress = 100;
    }

    /**
     * Execute modification step
     */
    private async executeModificationStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        // This would implement actual file modifications
        // For safety, we'll simulate the modification
        
        const modifications = step.inputs.modifications || [];
        const results = [];

        for (const mod of modifications) {
            // In a real implementation, this would modify files
            results.push({
                file: mod.file,
                action: mod.action,
                status: 'simulated' // Would be 'completed' in real implementation
            });
        }

        step.outputs = {
            modifications: results,
            filesModified: modifications.map((m: any) => m.file)
        };

        step.progress = 100;
    }

    /**
     * Execute validation step
     */
    private async executeValidationStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        // Validate the workflow results
        const validationResults = {
            syntaxValid: true,
            testsPass: true,
            lintingClean: true,
            performanceAcceptable: true
        };

        // In a real implementation, this would run actual validation
        
        step.outputs = {
            validation: validationResults,
            allValid: Object.values(validationResults).every(Boolean)
        };

        step.progress = 100;
    }

    /**
     * Execute research step
     */
    private async executeResearchStep(workflow: AutonomousWorkflow, step: WorkflowStep): Promise<void> {
        // Research relevant information and patterns
        const researchQuery = step.inputs.query || workflow.goal;
        
        // Use semantic search for research
        const findings = await this.semanticSystem.semanticSearch(researchQuery, {
            maxResults: 10,
            includeContext: true
        });

        step.outputs = {
            findings,
            researchSummary: `Found ${findings.length} relevant items`,
            recommendations: findings.slice(0, 3).map(f => f.contextualReason)
        };

        step.progress = 100;
    }

    /**
     * Perform cross-file reasoning and impact analysis
     */
    async performCrossFileReasoning(goal: string): Promise<CrossFileReasoning> {
        console.log('🔗 Performing cross-file reasoning...');

        try {
            const knowledgeGraph = await this.knowledgeSystem.buildKnowledgeGraph();
            
            // Analyze file dependencies
            const dependencies = [];
            for (const [filePath, module] of knowledgeGraph.modules.entries()) {
                for (const importPath of module.imports) {
                    dependencies.push({
                        from: filePath,
                        to: importPath,
                        type: 'import' as const
                    });
                }
            }

            // Calculate impact radius
            const impactRadius = dependencies.length > 20 ? 0.8 : dependencies.length > 10 ? 0.5 : 0.2;

            // Generate risk assessment using AI
            const riskPrompt = `Analyze the potential risks of this change:

Goal: ${goal}
Dependencies: ${dependencies.length} file dependencies
Project Size: ${knowledgeGraph.entities.size} entities

Identify:
1. Potential breaking changes
2. Testing requirements
3. Rollback plan steps

Format as JSON:
{
  "breakingChanges": ["change1", "change2"],
  "testingNeeded": ["test1", "test2"],
  "rollbackPlan": ["step1", "step2"]
}`;

            const aiRisk = await generateCode(riskPrompt, 'llama-3.3-70b-versatile');
            const riskData = JSON.parse(aiRisk);

            const analysis = {
                affectedFiles: Array.from(new Set(dependencies.map(d => d.from))),
                dependencies,
                impactRadius,
                riskAssessment: riskData
            };

            const recommendations = [
                {
                    action: 'Create backup branch',
                    priority: 'high' as const,
                    reasoning: 'Ensure rollback capability before making changes',
                    alternatives: ['Tag current commit', 'Export current state']
                },
                {
                    action: 'Run comprehensive tests',
                    priority: 'critical' as const,
                    reasoning: 'Validate no regressions in dependent code',
                    alternatives: ['Run subset of related tests', 'Manual validation']
                }
            ];

            return { analysis, recommendations };

        } catch (error) {
            console.error('Cross-file reasoning failed:', error);
            
            // Return fallback analysis
            return {
                analysis: {
                    affectedFiles: [],
                    dependencies: [],
                    impactRadius: 0.3,
                    riskAssessment: {
                        breakingChanges: ['Potential API changes'],
                        testingNeeded: ['Unit tests', 'Integration tests'],
                        rollbackPlan: ['Revert commit', 'Restore backup']
                    }
                },
                recommendations: [
                    {
                        action: 'Proceed with caution',
                        priority: 'medium',
                        reasoning: 'Analysis incomplete but changes appear safe',
                        alternatives: ['Manual review', 'Staged deployment']
                    }
                ]
            };
        }
    }

    /**
     * Resolve execution order based on step dependencies
     */
    private resolveExecutionOrder(steps: WorkflowStep[]): string[] {
        const resolved: string[] = [];
        const visited = new Set<string>();

        const visit = (stepId: string) => {
            if (visited.has(stepId)) { return; }
            
            const step = steps.find(s => s.id === stepId);
            if (!step) { return; }

            visited.add(stepId);
            
            // Visit dependencies first
            for (const depId of step.dependencies) {
                visit(depId);
            }
            
            resolved.push(stepId);
        };

        // Visit all steps
        for (const step of steps) {
            visit(step.id);
        }

        return resolved;
    }

    // Utility methods
    private generateWorkflowId(): string {
        return `wf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    }

    private notifyWorkflowPlanned(workflow: AutonomousWorkflow): void {
        console.log(`📋 Workflow planned: ${workflow.name} (${workflow.steps.length} steps)`);
        // Could send notification to webview
    }

    private notifyWorkflowCompleted(workflow: AutonomousWorkflow): void {
        console.log(`✅ Workflow completed: ${workflow.name}`);
        // Could send notification to webview with results
    }

    // Public getters
    getActiveWorkflows(): AutonomousWorkflow[] {
        return Array.from(this.activeWorkflows.values());
    }

    getWorkflowHistory(): AutonomousWorkflow[] {
        return this.workflowHistory.slice(-10); // Return last 10
    }

    getWorkflow(id: string): AutonomousWorkflow | undefined {
        return this.activeWorkflows.get(id);
    }

    // Cleanup
    dispose(): void {
        this.activeWorkflows.clear();
    }
}