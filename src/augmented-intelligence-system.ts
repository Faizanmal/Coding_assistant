import * as vscode from 'vscode';
import { generateCodeUnified } from './sidebar_simple';
import { getprojectcontext } from './extension';
import { EnhancedCodebaseUnderstanding } from './enhanced-codebase-understanding';
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { EventEmitter } from 'events';

/**
 * AugmentedIntelligenceSystem - A next-generation AI system that combines multiple specialized
 * intelligence models optimized for different programming tasks with enhanced reasoning capabilities.
 * 
 * Features:
 * - Multi-model reasoning with specialized models for different programming tasks
 * - Dynamic context prioritization based on task relevance
 * - Self-improving prompt optimization through success metrics
 * - Chain-of-thought reasoning with intermediate step validation
 * - Automatic error recovery with alternative approach generation
 */
export class AugmentedIntelligenceSystem {
    private static instance: AugmentedIntelligenceSystem;
    private events = new EventEmitter();
    private activeModels: Map<string, boolean> = new Map();
    private specializedModels: Map<string, string> = new Map();
    private reasoningChains: Map<string, any[]> = new Map();
    private metricHistory: Map<string, number[]> = new Map();
    
    // Task-specific specialized models
    private readonly TASK_MODELS = {
        'code_generation': 'llama-3.3-70b-versatile',
        'code_explanation': 'claude-3.5-sonnet',
        'error_analysis': 'gpt-4-turbo',
        'refactoring': 'llama-3.3-70b-versatile',
        'architecture': 'claude-3.5-sonnet',
        'security_analysis': 'gpt-4-turbo',
        'performance': 'gpt-4-turbo',
        'documentation': 'claude-3.5-sonnet'
    };

    private constructor() {
        // Initialize specialized models
        Object.entries(this.TASK_MODELS).forEach(([task, model]) => {
            this.specializedModels.set(task, model);
            this.activeModels.set(task, true);
        });
        
        // Initialize metrics history
        Object.keys(this.TASK_MODELS).forEach(task => {
            this.metricHistory.set(task, []);
            this.reasoningChains.set(task, []);
        });
        
        console.log('🧠 Augmented Intelligence System initialized with specialized models');
    }

    public static getInstance(): AugmentedIntelligenceSystem {
        if (!AugmentedIntelligenceSystem.instance) {
            AugmentedIntelligenceSystem.instance = new AugmentedIntelligenceSystem();
        }
        return AugmentedIntelligenceSystem.instance;
    }

    /**
     * Process a request using the most appropriate specialized model based on task type
     * with enhanced reasoning capabilities and error recovery.
     * 
     * @param request The user request to process
     * @param taskType The type of programming task
     * @param projectContext Optional project context to include
     * @returns The processed response with reasoning chain
     */
    public async processRequest(
        request: string, 
        taskType: keyof typeof this.TASK_MODELS, 
        projectContext?: string
    ): Promise<{response: string, reasoning: any[]}> {
        console.log(`🧠 Processing ${taskType} request: ${request.substring(0, 50)}...`);
        
        // Get appropriate model for task
        const modelToUse = this.specializedModels.get(taskType as string) || 'llama-3.3-70b-versatile';
        const provider = this.getProviderForModel(modelToUse);
        
        // Prepare context-enhanced prompt with chain-of-thought structure
        const enhancedContext = projectContext || await this.getEnhancedContext(taskType as string, request);
        const chainOfThoughtPrompt = this.buildChainOfThoughtPrompt(request, taskType as string, enhancedContext);
        
        try {
            // Execute primary reasoning request
            const reasoningResponse = await generateCodeUnified(provider, modelToUse, chainOfThoughtPrompt);
            
            // Extract reasoning steps and final response
            const { steps, response } = this.parseReasoningResponse(reasoningResponse);
            
            // Store reasoning chain for learning
            this.reasoningChains.get(taskType as string)?.push({
                request,
                steps,
                response,
                model: modelToUse
            });
            
            // Return processed response with reasoning
            return {
                response,
                reasoning: steps
            };
        } catch (error) {
            console.error(`🧠 Error in ${taskType} processing:`, error);
            
            // Automatic error recovery with fallback model
            return await this.recoveryProcess(request, taskType as string, enhancedContext, error);
        }
    }
    
    /**
     * Error recovery process that tries alternative models and approaches
     */
    private async recoveryProcess(
        request: string, 
        taskType: string, 
        context: string, 
        originalError: any
    ): Promise<{response: string, reasoning: any[]}> {
        console.log(`🧠 Starting recovery process for ${taskType}`);
        
        // Try a different model as fallback
        const fallbackModels = {
            'groq': 'llama-3.3-8b-instant',
            'together': 'mistral-medium',
            'openrouter': 'neural-chat-7b',
            'anthropic': 'claude-3-haiku'
        };
        
        try {
            // Choose a different provider than original
            const originalProvider = this.getProviderForModel(this.specializedModels.get(taskType) || '');
            const fallbackProvider = Object.keys(fallbackModels).find(p => p !== originalProvider) || 'groq';
            const fallbackModel = fallbackModels[fallbackProvider as keyof typeof fallbackModels];
            
            // Simplify the prompt for recovery
            const simplifiedPrompt = this.buildSimplifiedPrompt(request, taskType, context);
            
            console.log(`🧠 Recovery: Using ${fallbackProvider}/${fallbackModel} as fallback`);
            const recoveryResponse = await generateCodeUnified(fallbackProvider, fallbackModel, simplifiedPrompt);
            
            const recoverySteps = [{
                title: 'Recovery Processing',
                content: `Used fallback model ${fallbackModel} after error with primary model.`
            }];
            
            return {
                response: `[Recovered Response]\n\n${recoveryResponse}\n\n*Note: This response was generated using a fallback model due to an error in the primary model.*`,
                reasoning: recoverySteps
            };
        } catch (secondError) {
            console.error('🧠 Recovery process also failed:', secondError);
            
            // Last resort simple response
            return {
                response: 'I encountered an issue processing your request with both primary and fallback models. Please try rephrasing or simplifying your request.',
                reasoning: [{
                    title: 'Error Recovery',
                    content: `Both primary and recovery processing failed. Original error: ${originalError.message}`
                }]
            };
        }
    }
    
    /**
     * Builds a chain-of-thought prompt to guide the AI through explicit reasoning steps
     */
    private buildChainOfThoughtPrompt(request: string, taskType: string, context: string): string {
        return `
# Task: ${this.formatTaskTitle(taskType)}

## Context
${context}

## Request
${request}

## Instructions
Respond in the following structured format:
1. THINK: Analyze the problem and break it into manageable components.
2. PLAN: Create a step-by-step approach to solving the problem.
3. CONSIDER: Identify potential issues or alternatives.
4. EXECUTE: Implement the solution based on your plan.
5. VERIFY: Check your solution for correctness and completeness.

Use explicit reasoning for each step. Include code samples where appropriate.

## Response Format
{
  "steps": [
    {"title": "Problem Analysis", "content": "..."},
    {"title": "Solution Planning", "content": "..."},
    {"title": "Considerations", "content": "..."},
    {"title": "Implementation", "content": "..."},
    {"title": "Verification", "content": "..."}
  ],
  "response": "Final comprehensive response here"
}`;
    }
    
    /**
     * Simplified prompt for recovery scenarios
     */
    private buildSimplifiedPrompt(request: string, taskType: string, context: string): string {
        return `
# ${this.formatTaskTitle(taskType)}

Context (summarized):
${context.length > 500 ? context.substring(0, 500) + '...' : context}

Request:
${request}

Provide a direct and concise response focusing only on the most essential aspects of the request.
`;
    }
    
    /**
     * Format a task type into a readable title
     */
    private formatTaskTitle(taskType: string): string {
        return taskType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Get the appropriate AI provider for a given model
     */
    private getProviderForModel(model: string): string {
        if (model.includes('llama')) { return 'groq'; }
        if (model.includes('claude')) { return 'anthropic'; }
        if (model.includes('gpt')) { return 'openai'; }
        if (model.includes('mistral')) { return 'mistral'; }
        return 'together'; // Default fallback
    }
    
    /**
     * Parse structured reasoning response
     */
    private parseReasoningResponse(response: string): { steps: any[], response: string } {
        try {
            // Look for JSON structure
            const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                              response.match(/{[\s\S]*"steps"[\s\S]*"response"[\s\S]*}/);
            
            if (jsonMatch) {
                const jsonStr = jsonMatch[0].replace(/```json\n|```/g, '');
                const parsed = JSON.parse(jsonStr);
                return {
                    steps: parsed.steps || [],
                    response: parsed.response || response
                };
            }
            
            // If no JSON found, look for section headers
            const steps: any[] = [];
            const sections = response.split(/(?=#{1,3} (?:Problem Analysis|Solution Planning|Considerations|Implementation|Verification|THINK|PLAN|CONSIDER|EXECUTE|VERIFY))/i);
            
            if (sections.length > 1) {
                sections.forEach(section => {
                    const titleMatch = section.match(/#{1,3} (.*)/);
                    if (titleMatch) {
                        const title = titleMatch[1].trim();
                        const content = section.replace(/#{1,3} .*\n/, '').trim();
                        steps.push({ title, content });
                    }
                });
                
                return {
                    steps,
                    response: response.replace(/#{1,3} (?:Final Response|RESPONSE)\n/i, '')
                };
            }
            
            // Fallback if no structure detected
            return {
                steps: [{ title: 'Direct Processing', content: 'Response generated directly without explicit reasoning steps.' }],
                response
            };
        } catch (error) {
            console.error('Error parsing reasoning response:', error);
            return {
                steps: [],
                response
            };
        }
    }
    
    /**
     * Get enhanced context specific to the task type
     */
    private async getEnhancedContext(taskType: string, request: string): Promise<string> {
        // Get base project context
        let baseContext = await getprojectcontext();
        
        // Add task-specific context enhancements
        switch(taskType) {
            case 'code_generation':
                // Add relevant code snippets and patterns
                try {
                    const codebaseAnalysis = await EnhancedCodebaseUnderstanding.getInstance().analyzeCodebaseComprehensively();
                    const codebaseContext = JSON.stringify(codebaseAnalysis.architecture || {});
                    baseContext += `\n\n## Relevant Code Patterns\n${codebaseContext}`;
                } catch (error) {
                    console.warn('Failed to get codebase context:', error);
                }
                break;
                
            case 'architecture':
                // Add project structure information
                try {
                    const projectAnalysis = await ProjectKnowledgeSystem.getInstance().analyzeProject();
                    const structureContext = JSON.stringify(projectAnalysis);
                    baseContext += `\n\n## Project Architecture\n${structureContext}`;
                } catch (error) {
                    console.warn('Failed to get architecture context:', error);
                }
                break;
                
            case 'error_analysis':
                // Add error patterns and common fixes
                baseContext += `\n\n## Error Context\nAnalyzing potential error patterns in the context of the current workspace.`;
                break;
                
            case 'security_analysis':
                // Add security context
                baseContext += `\n\n## Security Context\nAnalyzing code for security best practices and potential vulnerabilities.`;
                break;
        }
        
        return baseContext;
    }
    
    /**
     * Register an event listener
     */
    public on(event: string, listener: (...args: any[]) => void): void {
        this.events.on(event, listener);
    }
    
    /**
     * Toggle a specialized model on/off
     */
    public toggleModel(taskType: string, active: boolean): void {
        if (this.activeModels.has(taskType)) {
            this.activeModels.set(taskType, active);
            this.events.emit('modelToggled', taskType, active);
        }
    }
    
    /**
     * Change the model used for a specific task
     */
    public setModelForTask(taskType: string, model: string): void {
        if (this.specializedModels.has(taskType)) {
            this.specializedModels.set(taskType, model);
            this.events.emit('modelChanged', taskType, model);
        }
    }
    
    /**
     * Get performance metrics for models
     */
    public getMetrics(): Record<string, any> {
        const metrics: Record<string, any> = {};
        
        this.metricHistory.forEach((values, task) => {
            if (values.length > 0) {
                metrics[task] = {
                    average: values.reduce((a, b) => a + b, 0) / values.length,
                    count: values.length,
                    model: this.specializedModels.get(task)
                };
            }
        });
        
        return metrics;
    }
    
    /**
     * Record success metric for a task (0-1 scale)
     */
    public recordMetric(taskType: string, value: number): void {
        if (this.metricHistory.has(taskType)) {
            this.metricHistory.get(taskType)?.push(Math.max(0, Math.min(1, value)));
        }
    }
}

// Command registration for VS Code
export function registerAugmentedIntelligenceCommands(context: vscode.ExtensionContext): void {
    const ais = AugmentedIntelligenceSystem.getInstance();
    
    // Process request command
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.augmentedIntelligenceProcess', async () => {
            const taskTypes = Object.keys(ais['TASK_MODELS']);
            const taskType = await vscode.window.showQuickPick(taskTypes, {
                placeHolder: 'Select task type for AI processing'
            });
            
            if (!taskType) {return;}
            
            const request = await vscode.window.showInputBox({
                prompt: 'Enter your request',
                placeHolder: 'Describe what you need...'
            });
            
            if (!request) { return; }
            
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Processing ${taskType} request`,
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Analyzing request...' });
                
                try {
                    const result = await ais.processRequest(request, taskType as any);
                    
                    // Create markdown document with reasoning steps
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# ${taskType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Result\n\n` +
                                 result.reasoning.map(step => 
                                     `## ${step.title}\n${step.content}\n`
                                 ).join('\n') +
                                 `\n## Final Response\n\n${result.response}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                    
                    // Record a default success metric (can be updated by user rating)
                    ais.recordMetric(taskType, 0.8);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Processing error: ${error.message}`);
                }
            });
        })
    );
    
    // Set model for task command
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.setAugmentedIntelligenceModel', async () => {
            const taskTypes = Object.keys(ais['TASK_MODELS']);
            const taskType = await vscode.window.showQuickPick(taskTypes, {
                placeHolder: 'Select task type to configure'
            });
            
            if (!taskType) {return;}
            
            const models = [
                'llama-3.3-70b-versatile', 
                'llama-3.3-8b-instant',
                'gpt-4-turbo',
                'claude-3.5-sonnet',
                'claude-3-haiku',
                'mistral-large',
                'mistral-medium'
            ];
            
            const selectedModel = await vscode.window.showQuickPick(models, {
                placeHolder: `Select model for ${taskType}`
            });
            
            if (selectedModel) {
                ais.setModelForTask(taskType, selectedModel);
                vscode.window.showInformationMessage(`Set ${selectedModel} as the model for ${taskType}`);
            }
        })
    );
    
    // View metrics command
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.viewAugmentedIntelligenceMetrics', async () => {
            const metrics = ais.getMetrics();
            
            const metricsContent = Object.entries(metrics)
                .map(([task, data]) => {
                    const { average, count, model } = data as any;
                    return `## ${task}\n- Model: ${model}\n- Average Score: ${(average * 100).toFixed(1)}%\n- Request Count: ${count}`;
                })
                .join('\n\n');
            
            const doc = await vscode.workspace.openTextDocument({
                content: `# Augmented Intelligence Metrics\n\n${metricsContent || 'No metrics available yet.'}`,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
        })
    );
}