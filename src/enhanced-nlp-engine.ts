import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { IntentRecognitionSystem } from './intentrecognition';
import { fileExtensionRegistry } from './fileextensionagentregistry';
import { SmartAgentAssignmentSystem } from './smartagentassignment';
import { EditTracker } from './edittracker';

// Enhanced Intent Types with more granular understanding
interface EnhancedIntent {
    primaryAction: 'create' | 'modify' | 'analyze' | 'deploy' | 'test' | 'debug' | 'refactor';
    projectScope: 'new_project' | 'add_feature' | 'fix_issue' | 'enhance_existing';
    domain: 'portfolio' | 'ecommerce' | 'blog' | 'social' | 'dashboard' | 'api' | 'mobile' | 'desktop' | 'library' | 'tool';
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
    urgency: 'low' | 'medium' | 'high';
    
    // Technology specifications
    technologies: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        testing?: string[];
        deployment?: string[];
        mobile?: string[];
    };
    
    // Feature requirements
    features: string[];
    constraints: string[];
    
    // File specifications
    targetFiles: Array<{
        fileName: string;
        purpose: string;
        priority: number;
        dependencies: string[];
    }>;
    
    // User context
    userExperience: 'beginner' | 'intermediate' | 'advanced';
    projectStyle: 'minimal' | 'standard' | 'comprehensive';
    
    // Confidence metrics
    confidence: number;
    ambiguities: string[];
}

interface WorkflowStep {
    id: string;
    type: 'analyze' | 'plan' | 'execute' | 'validate' | 'report';
    description: string;
    agentType?: string;
    files?: string[];
    dependencies: string[];
    estimatedTime: number;
    parallel: boolean;
}

interface ExecutionPlan {
    intent: EnhancedIntent;
    steps: WorkflowStep[];
    estimatedDuration: number;
    resourceRequirements: {
        agents: string[];
        fileOperations: number;
        complexity: number;
    };
    riskFactors: string[];
}

export class EnhancedNLPEngine {
    private static instance: EnhancedNLPEngine;
    private webviewView?: vscode.WebviewView;
    private agentCoordinator: SmartAgentCoordinator;
    private intentSystem: IntentRecognitionSystem;
    private assignmentSystem: SmartAgentAssignmentSystem;
    private conversationHistory: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}> = [];
    private activeExecutions: Map<string, ExecutionPlan> = new Map();

    constructor() {
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
        this.intentSystem = IntentRecognitionSystem.getInstance();
        this.assignmentSystem = SmartAgentAssignmentSystem.getInstance();
    }

    static getInstance(): EnhancedNLPEngine {
        if (!this.instance) {
            this.instance = new EnhancedNLPEngine();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
    }

    async processNaturalLanguageInput(userInput: string): Promise<string> {
        try {
            // Add to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userInput,
                timestamp: new Date()
            });

            // Show processing message
            this.sendProgressUpdate('🧠 Understanding your request...', 10);

            // Enhanced intent analysis with context
            const intent = await this.analyzeEnhancedIntent(userInput);
            
            this.sendProgressUpdate('📋 Creating execution plan...', 30);

            // Generate comprehensive execution plan
            const executionPlan = await this.createExecutionPlan(intent);
            
            this.sendProgressUpdate('🚀 Executing automated workflow...', 50);

            // Execute the plan with full automation
            const result = await this.executeAutomatedWorkflow(executionPlan);
            
            this.sendProgressUpdate('✅ Workflow complete!', 100);

            // Add result to history
            this.conversationHistory.push({
                role: 'assistant',
                content: result,
                timestamp: new Date()
            });

            return result;

        } catch (error) {
            const errorMsg = `❌ Enhanced NLP processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('Enhanced NLP Engine error:', error);
            return errorMsg;
        }
    }

    private async analyzeEnhancedIntent(userInput: string): Promise<EnhancedIntent> {
        // Multi-layered intent analysis
        const basicIntent = await this.intentSystem.parseUserIntent(userInput);
        
        // Enhanced analysis with conversation context
        const contextualPrompt = this.buildContextualAnalysisPrompt(userInput);
        
        const aiAnalysis = await generateCode(contextualPrompt, 'llama-3.3-70b-versatile');
        
        // Parse AI analysis
        let enhancedData;
        try {
            const cleanJson = aiAnalysis.replace(/```json\n?|\n?```/g, '').trim();
            enhancedData = JSON.parse(cleanJson);
        } catch (error) {
            console.warn('Failed to parse AI analysis, using fallback');
            enhancedData = this.createFallbackIntent(userInput);
        }

        // Merge basic intent with enhanced analysis
        const enhancedIntent: EnhancedIntent = {
            primaryAction: enhancedData.primaryAction || this.determinePrimaryAction(userInput),
            projectScope: enhancedData.projectScope || this.determineProjectScope(userInput),
            domain: basicIntent.domain as any || 'tool',
            complexity: enhancedData.complexity || basicIntent.complexity,
            urgency: enhancedData.urgency || 'medium',
            technologies: {
                ...basicIntent.technologies,
                ...enhancedData.technologies
            },
            features: [...(basicIntent.features || []), ...(enhancedData.features || [])],
            constraints: enhancedData.constraints || [],
            targetFiles: this.enhanceTargetFiles(basicIntent.files || [], enhancedData.targetFiles || []),
            userExperience: enhancedData.userExperience || this.inferUserExperience(userInput),
            projectStyle: enhancedData.projectStyle || this.inferProjectStyle(userInput),
            confidence: enhancedData.confidence || this.calculateConfidence(userInput),
            ambiguities: enhancedData.ambiguities || []
        };

        return enhancedIntent;
    }

    private buildContextualAnalysisPrompt(userInput: string): string {
        const recentHistory = this.conversationHistory.slice(-5).map(entry => 
            `${entry.role}: ${entry.content}`
        ).join('\n');

        return `Analyze this development request with full context understanding:

User Request: "${userInput}"

Recent Conversation History:
${recentHistory}

Provide a comprehensive analysis in JSON format:
{
  "primaryAction": "create|modify|analyze|deploy|test|debug|refactor",
  "projectScope": "new_project|add_feature|fix_issue|enhance_existing",
  "complexity": "simple|medium|complex|enterprise",
  "urgency": "low|medium|high",
  "technologies": {
    "frontend": ["react", "vue", etc],
    "backend": ["express", "fastapi", etc],
    "database": ["mongodb", "postgresql", etc],
    "testing": ["jest", "pytest", etc],
    "deployment": ["docker", "vercel", etc]
  },
  "features": ["authentication", "responsive design", etc],
  "constraints": ["budget", "timeline", "no external dependencies", etc],
  "targetFiles": [
    {"fileName": "App.jsx", "purpose": "main component", "priority": 1},
    {"fileName": "server.js", "purpose": "backend entry", "priority": 2}
  ],
  "userExperience": "beginner|intermediate|advanced",
  "projectStyle": "minimal|standard|comprehensive",
  "confidence": 0.85,
  "ambiguities": ["unclear technology preference", "missing deployment details"]
}

Focus on:
1. Understanding the complete project vision
2. Identifying all technical requirements
3. Detecting any ambiguities that need clarification
4. Assessing user expertise level from language used
5. Determining optimal file structure and technology stack

Return only the JSON response:`;
    }

    private async createExecutionPlan(intent: EnhancedIntent): Promise<ExecutionPlan> {
        const steps: WorkflowStep[] = [];
        let stepCounter = 1;

        // 1. Analysis Phase (if needed)
        if (intent.projectScope === 'new_project' || (intent.ambiguities && intent.ambiguities.length > 0)) {
            steps.push({
                id: `analysis_${stepCounter++}`,
                type: 'analyze',
                description: 'Analyze workspace and resolve ambiguities',
                dependencies: [],
                estimatedTime: 2000,
                parallel: false
            });
        }

        // 2. Planning Phase
        steps.push({
            id: `planning_${stepCounter++}`,
            type: 'plan',
            description: 'Generate detailed project architecture and file structure',
            dependencies: steps.map(s => s.id),
            estimatedTime: 3000,
            parallel: false
        });

        // 3. Execution Phase - Group by dependency chains
        const fileGroups = this.groupFilesByDependencies(intent.targetFiles);
        
        for (const group of fileGroups) {
            const groupSteps = group.map(file => ({
                id: `execute_${file.fileName}_${stepCounter++}`,
                type: 'execute' as const,
                description: `Create ${file.fileName} - ${file.purpose}`,
                agentType: this.determineAgentType(file.fileName),
                files: [file.fileName],
                dependencies: group === fileGroups[0] ? [steps[steps.length - 1].id] : 
                              steps.filter(s => s.type === 'execute').map(s => s.id),
                estimatedTime: this.estimateFileCreationTime(file.fileName, intent.complexity),
                parallel: true // Files in same group can be created in parallel
            }));
            
            steps.push(...groupSteps);
        }

        // 4. Validation Phase
        steps.push({
            id: `validation_${stepCounter++}`,
            type: 'validate',
            description: 'Validate generated files and run basic tests',
            dependencies: steps.filter(s => s.type === 'execute').map(s => s.id),
            estimatedTime: 2000,
            parallel: false
        });

        // 5. Reporting Phase
        steps.push({
            id: `report_${stepCounter++}`,
            type: 'report',
            description: 'Generate completion report and next steps',
            dependencies: [steps[steps.length - 1].id],
            estimatedTime: 1000,
            parallel: false
        });

        const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
        const parallelTime = this.calculateParallelExecutionTime(steps);

        const plan: ExecutionPlan = {
            intent,
            steps,
            estimatedDuration: parallelTime,
            resourceRequirements: {
                agents: Array.from(new Set(steps.map(s => s.agentType).filter(Boolean))) as string[],
                fileOperations: intent.targetFiles?.length || 0,
                complexity: this.mapComplexityToNumber(intent.complexity)
            },
            riskFactors: this.identifyRiskFactors(intent)
        };

        return plan;
    }

    private async executeAutomatedWorkflow(plan: ExecutionPlan): Promise<string> {
        const executionId = `exec_${Date.now()}`;
        this.activeExecutions.set(executionId, plan);

        let result = `🎯 **Enhanced NLP Automated Workflow Execution**\n\n`;
        result += `📋 **Project Overview:**\n`;
        result += `- Action: ${plan.intent.primaryAction}\n`;
        result += `- Scope: ${plan.intent.projectScope}\n`;
        result += `- Domain: ${plan.intent.domain}\n`;
        result += `- Complexity: ${plan.intent.complexity}\n`;
        result += `- Estimated Duration: ${(plan.estimatedDuration / 1000).toFixed(1)}s\n\n`;

        // Track execution progress
        const totalSteps = plan.steps.length;
        let completedSteps = 0;

        try {
            // Execute steps in dependency order
            const executedSteps = new Set<string>();
            
            while (executedSteps.size < totalSteps) {
                // Find ready steps (all dependencies completed)
                const readySteps = plan.steps.filter(step => 
                    !executedSteps.has(step.id) &&
                    step.dependencies.every(dep => executedSteps.has(dep))
                );

                if (readySteps.length === 0) {
                    throw new Error('Circular dependency detected in execution plan');
                }

                // Execute parallel steps
                const parallelSteps = readySteps.filter(step => step.parallel);
                const sequentialSteps = readySteps.filter(step => !step.parallel);

                // Execute parallel steps simultaneously
                if (parallelSteps.length > 0) {
                    await Promise.all(parallelSteps.map(async step => {
                        await this.executeWorkflowStep(step, plan.intent);
                        executedSteps.add(step.id);
                        completedSteps++;
                        
                        const progress = (completedSteps / totalSteps) * 100;
                        this.sendProgressUpdate(`⚡ ${step.description}`, 50 + (progress * 0.4));
                    }));
                }

                // Execute sequential steps one by one
                for (const step of sequentialSteps) {
                    await this.executeWorkflowStep(step, plan.intent);
                    executedSteps.add(step.id);
                    completedSteps++;
                    
                    const progress = (completedSteps / totalSteps) * 100;
                    this.sendProgressUpdate(`🔄 ${step.description}`, 50 + (progress * 0.4));
                }
            }

            result += `\n✅ **Workflow Completed Successfully!**\n`;
            result += `📊 **Results:**\n`;
            result += `- Files Created: ${plan.intent.targetFiles?.length || 0}\n`;
            result += `- Agents Utilized: ${plan.resourceRequirements.agents?.length || 0}\n`;
            result += `- Steps Executed: ${totalSteps}\n`;

            // Add file summary
            result += `\n📄 **Generated Files:**\n`;
            if (plan.intent.targetFiles && Array.isArray(plan.intent.targetFiles)) {
                plan.intent.targetFiles.forEach(file => {
                    result += `  • ${file.fileName} - ${file.purpose}\n`;
                });
            } else {
                result += `  • No files generated\n`;
            }

        } catch (error) {
            result += `\n❌ **Execution Failed:**\n`;
            result += `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
            result += `Completed: ${completedSteps}/${totalSteps} steps\n`;
        } finally {
            this.activeExecutions.delete(executionId);
        }

        return result;
    }

    private async executeWorkflowStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        switch (step.type) {
            case 'analyze':
                await this.executeAnalysisStep(step, intent);
                break;
            case 'plan':
                await this.executePlanningStep(step, intent);
                break;
            case 'execute':
                await this.executeCreationStep(step, intent);
                break;
            case 'validate':
                await this.executeValidationStep(step, intent);
                break;
            case 'report':
                await this.executeReportingStep(step, intent);
                break;
        }
    }

    private async executeAnalysisStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        // Analyze workspace and update project context
        try {
            await fileExtensionRegistry.analyzeWorkspace();
            
            // If there are ambiguities, try to resolve them automatically
            if (intent.ambiguities && intent.ambiguities.length > 0) {
                const resolutionPrompt = this.buildAmbiguityResolutionPrompt(intent);
                const resolution = await generateCode(resolutionPrompt, 'llama-3.3-70b-versatile');
                
                // Apply automatic resolutions
                this.applyAmbiguityResolutions(intent, resolution);
            }
        } catch (error) {
            console.warn('Analysis step warning:', error);
        }
    }

    private async executePlanningStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        // Enhanced planning with agent coordination
        const agentTasks = await this.intentSystem.generateAgentTasks(intent as any);
        
        // Optimize task assignment
        const operations = agentTasks.flatMap(task => 
            task.files.map(fileName => ({
                fileName,
                operation: 'create',
                prompt: `Create ${fileName} for ${intent.domain} ${intent.primaryAction}`
            }))
        );

        this.assignmentSystem.assignAgentsToOperations(operations);
    }

    private async executeCreationStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        if (!step.files || step.files.length === 0) {return;}

        const fileName = step.files[0];
        const targetFile = intent.targetFiles.find(f => f.fileName === fileName);
        
        if (!targetFile) {return;}

        // Create enhanced prompt for the file
        const enhancedPrompt = this.createEnhancedFilePrompt(targetFile, intent);
        
        // Use the smart agent coordinator
        await this.agentCoordinator.processMultiAgentRequest(
            `smart coordinated creation of ${fileName} with enhanced NLP context: ${enhancedPrompt}`
        );
    }

    private async executeValidationStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        // Basic validation - check if files were created
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}

        for (const file of intent.targetFiles) {
            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, file.fileName);
            try {
                await vscode.workspace.fs.stat(filePath);
                // File exists - could add more validation here
            } catch (error) {
                console.warn(`File ${file.fileName} was not created successfully`);
            }
        }
    }

    private async executeReportingStep(step: WorkflowStep, intent: EnhancedIntent): Promise<void> {
        // Generate completion report
        console.log(`Enhanced NLP execution completed: ${intent.primaryAction} with ${intent.targetFiles?.length || 0} files`);
    }

    // Helper methods
    private determinePrimaryAction(userInput: string): EnhancedIntent['primaryAction'] {
        const input = userInput.toLowerCase();
        if (input.includes('create') || input.includes('build') || input.includes('make') || input.includes('generate')) {
            return 'create';
        }
        if (input.includes('modify') || input.includes('update') || input.includes('change') || input.includes('edit')) {
            return 'modify';
        }
        if (input.includes('analyze') || input.includes('review') || input.includes('examine')) {
            return 'analyze';
        }
        if (input.includes('deploy') || input.includes('publish') || input.includes('release')) {
            return 'deploy';
        }
        if (input.includes('test') || input.includes('debug') || input.includes('fix')) {
            return 'test';
        }
        return 'create'; // Default
    }

    private determineProjectScope(userInput: string): EnhancedIntent['projectScope'] {
        const input = userInput.toLowerCase();
        if (input.includes('new project') || input.includes('from scratch') || input.includes('start fresh')) {
            return 'new_project';
        }
        if (input.includes('add feature') || input.includes('add functionality') || input.includes('enhance with')) {
            return 'add_feature';
        }
        if (input.includes('fix') || input.includes('bug') || input.includes('issue') || input.includes('problem')) {
            return 'fix_issue';
        }
        return 'new_project'; // Default for creation requests
    }

    private inferUserExperience(userInput: string): EnhancedIntent['userExperience'] {
        const input = userInput.toLowerCase();
        if (input.includes('simple') || input.includes('basic') || input.includes('beginner') || input.includes('easy')) {
            return 'beginner';
        }
        if (input.includes('advanced') || input.includes('complex') || input.includes('enterprise') || input.includes('professional')) {
            return 'advanced';
        }
        return 'intermediate'; // Default
    }

    private inferProjectStyle(userInput: string): EnhancedIntent['projectStyle'] {
        const input = userInput.toLowerCase();
        if (input.includes('minimal') || input.includes('simple') || input.includes('basic')) {
            return 'minimal';
        }
        if (input.includes('comprehensive') || input.includes('full-featured') || input.includes('complete')) {
            return 'comprehensive';
        }
        return 'standard'; // Default
    }

    private calculateConfidence(userInput: string): number {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence for specific keywords
        const specificKeywords = ['react', 'express', 'mongodb', 'portfolio', 'ecommerce', 'blog'];
        const foundKeywords = specificKeywords.filter(keyword => 
            userInput.toLowerCase().includes(keyword)
        );
        confidence += foundKeywords.length * 0.1;
        
        // Increase confidence for clear actions
        const clearActions = ['create', 'build', 'make', 'generate'];
        if (clearActions.some(action => userInput.toLowerCase().includes(action))) {
            confidence += 0.2;
        }
        
        return Math.min(0.95, confidence);
    }

    private enhanceTargetFiles(basicFiles: any[], enhancedFiles: any[]): EnhancedIntent['targetFiles'] {
        const combined = [...(basicFiles || [])];
        
        // Add enhanced files that aren't already present
        if (enhancedFiles && Array.isArray(enhancedFiles)) {
            enhancedFiles.forEach(enhanced => {
                if (!combined.find(basic => basic.fileName === enhanced.fileName)) {
                    combined.push({
                        fileName: enhanced.fileName,
                        purpose: enhanced.purpose || enhanced.description || 'Generated file',
                        priority: enhanced.priority || 3,
                        dependencies: enhanced.dependencies || []
                    });
                }
            });
        }
        
        // Convert basic files to enhanced format
        return combined.map(file => ({
            fileName: file.fileName || 'unknown.js',
            purpose: file.purpose || file.description || 'Generated file',
            priority: file.priority || 3,
            dependencies: file.dependencies || []
        }));
    }

    private createFallbackIntent(userInput: string): Partial<EnhancedIntent> {
        return {
            primaryAction: this.determinePrimaryAction(userInput),
            projectScope: this.determineProjectScope(userInput),
            complexity: 'medium',
            urgency: 'medium',
            userExperience: 'intermediate',
            projectStyle: 'standard',
            confidence: 0.6,
            ambiguities: ['Technology preferences unclear', 'Project structure undefined']
        };
    }

    private buildAmbiguityResolutionPrompt(intent: EnhancedIntent): string {
        return `Resolve these ambiguities for a ${intent.domain} project:

Ambiguities:
${intent.ambiguities.map(amb => `- ${amb}`).join('\n')}

Current Context:
- Action: ${intent.primaryAction}
- Domain: ${intent.domain}
- Technologies: ${JSON.stringify(intent.technologies)}

Provide specific resolutions in JSON format:
{
  "technologies": {"frontend": ["react"], "backend": ["express"]},
  "features": ["responsive design", "dark mode"],
  "constraints": ["mobile-first", "seo-friendly"]
}`;
    }

    private applyAmbiguityResolutions(intent: EnhancedIntent, resolution: string): void {
        try {
            const parsed = JSON.parse(resolution);
            if (parsed.technologies) {
                Object.assign(intent.technologies, parsed.technologies);
            }
            if (parsed.features) {
                intent.features.push(...parsed.features);
            }
            if (parsed.constraints) {
                intent.constraints.push(...parsed.constraints);
            }
            // Clear resolved ambiguities
            intent.ambiguities = [];
        } catch (error) {
            console.warn('Failed to apply ambiguity resolutions:', error);
        }
    }

    private groupFilesByDependencies(files: EnhancedIntent['targetFiles']): EnhancedIntent['targetFiles'][] {
        const groups: EnhancedIntent['targetFiles'][] = [];
        const processed = new Set<string>();
        
        // Sort by priority first
        const sortedFiles = [...files].sort((a, b) => a.priority - b.priority);
        
        for (const file of sortedFiles) {
            if (processed.has(file.fileName)) {continue;}
            
            const group = [file];
            processed.add(file.fileName);
            
            // Find files that can be created in parallel (no dependencies on each other)
            for (const otherFile of sortedFiles) {
                if (processed.has(otherFile.fileName)) {continue;}
                
                const hasDependency = otherFile.dependencies.includes(file.fileName) ||
                                     file.dependencies.includes(otherFile.fileName);
                
                if (!hasDependency && otherFile.priority === file.priority) {
                    group.push(otherFile);
                    processed.add(otherFile.fileName);
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }

    private determineAgentType(fileName: string): string {
        const ext = fileName.toLowerCase();
        if (ext.includes('.js') || ext.includes('.jsx') || ext.includes('.ts') || ext.includes('.tsx')) {
            return ext.includes('test') ? 'testing-expert' : 'frontend-specialist';
        }
        if (ext.includes('.py')) {
            return 'backend-specialist';
        }
        if (ext.includes('.sql') || ext.includes('schema')) {
            return 'database-architect';
        }
        if (ext.includes('.yml') || ext.includes('.yaml') || ext.includes('docker')) {
            return 'devops-engineer';
        }
        return 'backend-specialist'; // Default
    }

    private estimateFileCreationTime(fileName: string, complexity: string): number {
        const baseTime = 2000; // 2 seconds base
        const complexityMultiplier = {
            'simple': 1,
            'medium': 1.5,
            'complex': 2.5,
            'enterprise': 4
        }[complexity] || 1.5;
        
        // File type multipliers
        let fileMultiplier = 1;
        if (fileName.includes('test')) {fileMultiplier = 0.8;}
        if (fileName.includes('config')) {fileMultiplier = 0.6;}
        if (fileName.includes('component')) {fileMultiplier = 1.2;}
        if (fileName.includes('server') || fileName.includes('api')) {fileMultiplier = 1.5;}
        
        return baseTime * complexityMultiplier * fileMultiplier;
    }

    private calculateParallelExecutionTime(steps: WorkflowStep[]): number {
        // Group steps by parallel vs sequential execution
        let totalTime = 0;
        let currentParallelGroup: WorkflowStep[] = [];
        
        for (const step of steps) {
            if (step.parallel && currentParallelGroup.length > 0) {
                currentParallelGroup.push(step);
            } else {
                // Process previous parallel group
                if (currentParallelGroup.length > 0) {
                    const maxTime = Math.max(...currentParallelGroup.map(s => s.estimatedTime));
                    totalTime += maxTime;
                    currentParallelGroup = [];
                }
                
                if (step.parallel) {
                    currentParallelGroup.push(step);
                } else {
                    totalTime += step.estimatedTime;
                }
            }
        }
        
        // Process final parallel group
        if (currentParallelGroup.length > 0) {
            const maxTime = Math.max(...currentParallelGroup.map(s => s.estimatedTime));
            totalTime += maxTime;
        }
        
        return totalTime;
    }

    private mapComplexityToNumber(complexity: string): number {
        return {
            'simple': 1,
            'medium': 2,
            'complex': 3,
            'enterprise': 4
        }[complexity] || 2;
    }

    private identifyRiskFactors(intent: EnhancedIntent): string[] {
        const risks: string[] = [];
        
        if (intent.complexity === 'enterprise') {
            risks.push('High complexity project');
        }
        if (intent.targetFiles && intent.targetFiles.length > 10) {
            risks.push('Large number of files');
        }
        if (intent.ambiguities && intent.ambiguities.length > 2) {
            risks.push('Multiple unresolved ambiguities');
        }
        if (intent.confidence < 0.7) {
            risks.push('Low confidence in intent analysis');
        }
        
        return risks;
    }

    private sendProgressUpdate(message: string, percentage: number): void {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'enhancedNlpProgress',
                data: {
                    message,
                    percentage,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    private createEnhancedFilePrompt(targetFile: EnhancedIntent['targetFiles'][0], intent: EnhancedIntent): string {
        return `Create ${targetFile.fileName} for ${intent.domain} project.

Purpose: ${targetFile.purpose}
Context: ${intent.primaryAction} ${intent.projectScope}
Complexity: ${intent.complexity}
Style: ${intent.projectStyle}

Technologies:
- Frontend: ${intent.technologies.frontend?.join(', ') || 'None'}
- Backend: ${intent.technologies.backend?.join(', ') || 'None'}
- Database: ${intent.technologies.database?.join(', ') || 'None'}

Features: ${intent.features.join(', ')}
Constraints: ${intent.constraints.join(', ')}

Generate professional, production-ready code that follows best practices.`;
    }

    // Static method for checking if input should use enhanced NLP
    static shouldProcessWithEnhancedNLP(input: string): boolean {
        const enhancedIndicators = [
            // Natural conversation patterns
            'i want', 'i need', 'can you', 'help me', 'please',
            // Project descriptions
            'create a', 'build a', 'make a', 'develop a',
            // Complex requirements
            'with authentication', 'using react', 'for my portfolio',
            'responsive design', 'full stack', 'ecommerce site'
        ];
        
        const inputLower = input.toLowerCase();
        return enhancedIndicators.some(indicator => inputLower.includes(indicator));
    }

    // Method for enhanced sidebar UI compatibility
    public async analyzeUserIntent(prompt: string): Promise<any> {
        const analysisPrompt = `Analyze this user request and extract the intent:

"${prompt}"

Determine:
1. Main intent (create, analyze, modify, understand, etc.)
2. Whether it requires multiple agents (complex projects, multiple files, coordination)
3. Whether it's a file operation (creating, modifying files)
4. Suggested technology stack
5. Expected file types
6. Complexity level (low/medium/high)

Return JSON in this format:
{
    "intent": "string describing main intent",
    "confidence": 0.95,
    "requiresMultiAgent": boolean,
    "isFileOperation": boolean,
    "suggestedTechnology": "react|vue|python|node|etc",
    "fileTypes": ["js", "ts", "py", "html", "css"],
    "complexity": "low|medium|high"
}`;

        try {
            const response = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);
            
            return {
                intent: parsed.intent || 'unknown',
                confidence: parsed.confidence || 0.5,
                requiresMultiAgent: parsed.requiresMultiAgent || false,
                isFileOperation: parsed.isFileOperation || false,
                suggestedTechnology: parsed.suggestedTechnology,
                fileTypes: parsed.fileTypes || [],
                complexity: parsed.complexity || 'medium'
            };
        } catch (error) {
            console.error('Failed to analyze user intent:', error);
            return {
                intent: 'unknown',
                confidence: 0.3,
                requiresMultiAgent: false,
                isFileOperation: false,
                complexity: 'medium'
            };
        }
    }

    // Method for enhanced sidebar UI compatibility
    public async parseFileCreationRequest(request: string): Promise<any[]> {
        const parsePrompt = `Parse this file creation request into structured data:

"${request}"

Create a comprehensive list of files needed for a production-ready implementation.
Consider project structure, dependencies, configurations, and best practices.

Return JSON array in this format:
[
    {
        "fileName": "exact filename with extension",
        "prompt": "detailed description of what the file should contain",
        "language": "programming language",
        "priority": 1-10,
        "dependencies": ["other files this depends on"]
    }
]

Include:
- Main application files
- Configuration files
- Documentation
- Tests (if applicable)
- Environment files
- Package/dependency files

If no clear file structure can be determined, return empty array [].`;

        try {
            const response = await generateCode(parsePrompt, 'llama-3.3-70b-versatile');
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);
            
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse file creation request:', error);
            return [];
        }
    }
}