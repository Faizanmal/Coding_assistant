import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Prompt performance metrics for self-improvement
 */
export interface PromptMetrics {
    promptId: string;
    prompt: string;
    context: string;
    response: string;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    successMetrics: {
        accuracy: number;        // 0-1 scale
        relevance: number;       // 0-1 scale
        completeness: number;    // 0-1 scale
        efficiency: number;      // 0-1 scale (response time/quality ratio)
    };
    executionTime: number;
    timestamp: Date;
    iterations: number;          // How many times this prompt was refined
    previousVersions?: string[]; // Track evolution
}

/**
 * Prompt template with improvement strategies
 */
export interface PromptTemplate {
    id: string;
    name: string;
    category: 'debugging' | 'testing' | 'optimization' | 'documentation' | 'general';
    basePrompt: string;
    variables: { [key: string]: string };
    improvementStrategies: string[];
    successCriteria: {
        minAccuracy: number;
        minRelevance: number;
        minCompleteness: number;
        maxExecutionTime: number;
    };
    version: number;
    createdAt: Date;
    lastUpdated: Date;
}

/**
 * Learning patterns from successful prompts
 */
export interface LearningPattern {
    pattern: string;
    effectiveness: number;
    contexts: string[];
    frequency: number;
    lastUsed: Date;
}

/**
 * Self-Improving Prompt Engine
 */
export class SelfImprovingPromptEngine {
    private metricsHistory: PromptMetrics[] = [];
    private promptTemplates: Map<string, PromptTemplate> = new Map();
    private learningPatterns: LearningPattern[] = [];
    private outputChannel: vscode.OutputChannel;
    private storageUri: vscode.Uri;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Self-Improving Prompts');
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'prompt-engine');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Ensure storage directory exists
            await vscode.workspace.fs.createDirectory(this.storageUri);
            
            // Load existing data
            await this.loadPersistedData();
            
            // Initialize default templates if none exist
            if (this.promptTemplates.size === 0) {
                this.initializeDefaultTemplates();
            }
            
            this.outputChannel.appendLine('Self-Improving Prompt Engine initialized');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Initialization error: ${errorMessage}`);
        }
    }

    /**
     * Generate an improved prompt based on context and learning history
     */
    async generateImprovedPrompt(
        basePrompt: string,
        context: any,
        category: PromptTemplate['category'] = 'general'
    ): Promise<string> {
        // Find similar historical contexts
        const similarPrompts = this.findSimilarPrompts(basePrompt, context);
        
        // Apply learned patterns
        const enhancedPrompt = this.applyLearningPatterns(basePrompt, category);
        
        // Use template if available
        const template = this.getBestTemplate(category);
        let improvedPrompt = enhancedPrompt;
        
        if (template) {
            improvedPrompt = this.applyTemplate(template, enhancedPrompt, context);
        }
        
        // Apply historical insights
        if (similarPrompts.length > 0) {
            improvedPrompt = this.incorporateHistoricalInsights(improvedPrompt, similarPrompts);
        }
        
        this.outputChannel.appendLine(`Generated improved prompt for category: ${category}`);
        return improvedPrompt;
    }

    /**
     * Record prompt performance for learning
     */
    async recordPromptPerformance(
        promptId: string,
        prompt: string,
        context: string,
        response: string,
        metrics: PromptMetrics['successMetrics'],
        executionTime: number,
        userFeedback?: PromptMetrics['userFeedback']
    ): Promise<void> {
        const promptMetrics: PromptMetrics = {
            promptId,
            prompt,
            context,
            response,
            userFeedback,
            successMetrics: metrics,
            executionTime,
            timestamp: new Date(),
            iterations: 1
        };

        this.metricsHistory.push(promptMetrics);
        
        // Update learning patterns
        this.updateLearningPatterns(promptMetrics);
        
        // Update templates if performance is exceptional
        if (this.isExceptionalPerformance(metrics)) {
            await this.updateTemplateFromSuccess(prompt, context, metrics);
        }
        
        // Persist data
        await this.persistData();
        
        this.outputChannel.appendLine(`Recorded performance for prompt: ${promptId}`);
    }

    /**
     * Analyze and improve underperforming prompts
     */
    async improveUnderperformingPrompts(): Promise<void> {
        const underperforming = this.metricsHistory.filter(metric => 
            this.calculateOverallScore(metric.successMetrics) < 0.6
        );

        for (const metric of underperforming) {
            const improvedPrompt = await this.generateImprovement(metric);
            
            // Update the prompt template if exists
            const template = this.findTemplateByPrompt(metric.prompt);
            if (template) {
                template.basePrompt = improvedPrompt;
                template.version++;
                template.lastUpdated = new Date();
            }
            
            this.outputChannel.appendLine(`Improved underperforming prompt: ${metric.promptId}`);
        }
        
        await this.persistData();
    }

    /**
     * Get prompt analytics and insights
     */
    getAnalytics(): any {
        const totalPrompts = this.metricsHistory.length;
        const avgAccuracy = this.metricsHistory.reduce((sum, m) => sum + m.successMetrics.accuracy, 0) / totalPrompts;
        const avgRelevance = this.metricsHistory.reduce((sum, m) => sum + m.successMetrics.relevance, 0) / totalPrompts;
        const avgCompleteness = this.metricsHistory.reduce((sum, m) => sum + m.successMetrics.completeness, 0) / totalPrompts;
        const avgExecutionTime = this.metricsHistory.reduce((sum, m) => sum + m.executionTime, 0) / totalPrompts;

        const categoryPerformance = this.analyzeCategoryPerformance();
        const topPatterns = this.learningPatterns
            .sort((a, b) => b.effectiveness - a.effectiveness)
            .slice(0, 10);

        return {
            totalPrompts,
            averageMetrics: {
                accuracy: Math.round(avgAccuracy * 100) / 100,
                relevance: Math.round(avgRelevance * 100) / 100,
                completeness: Math.round(avgCompleteness * 100) / 100,
                executionTime: Math.round(avgExecutionTime)
            },
            categoryPerformance,
            topLearningPatterns: topPatterns,
            templateCount: this.promptTemplates.size,
            improvementTrends: this.calculateImprovementTrends()
        };
    }

    /**
     * Find prompts similar to the current context
     */
    private findSimilarPrompts(basePrompt: string, context: any): PromptMetrics[] {
        const contextStr = JSON.stringify(context).toLowerCase();
        const promptWords = basePrompt.toLowerCase().split(' ');
        
        return this.metricsHistory
            .filter(metric => {
                const similarity = this.calculateSimilarity(
                    metric.prompt.toLowerCase(),
                    basePrompt.toLowerCase()
                );
                const contextSimilarity = this.calculateSimilarity(
                    metric.context.toLowerCase(),
                    contextStr
                );
                
                return similarity > 0.3 || contextSimilarity > 0.3;
            })
            .sort((a, b) => this.calculateOverallScore(b.successMetrics) - this.calculateOverallScore(a.successMetrics))
            .slice(0, 5);
    }

    /**
     * Apply learned patterns to enhance prompts
     */
    private applyLearningPatterns(prompt: string, category: PromptTemplate['category']): string {
        let enhancedPrompt = prompt;
        
        const relevantPatterns = this.learningPatterns
            .filter(pattern => pattern.contexts.includes(category))
            .sort((a, b) => b.effectiveness - a.effectiveness)
            .slice(0, 3);
        
        for (const pattern of relevantPatterns) {
            if (!enhancedPrompt.includes(pattern.pattern)) {
                enhancedPrompt = this.integratePattern(enhancedPrompt, pattern.pattern);
            }
        }
        
        return enhancedPrompt;
    }

    /**
     * Get the best template for a category
     */
    private getBestTemplate(category: PromptTemplate['category']): PromptTemplate | undefined {
        const templates = Array.from(this.promptTemplates.values())
            .filter(template => template.category === category);
        
        if (templates.length === 0) {return undefined;}
        
        // Return the most recently updated successful template
        return templates.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())[0];
    }

    /**
     * Apply template to prompt
     */
    private applyTemplate(template: PromptTemplate, prompt: string, context: any): string {
        let templatedPrompt = template.basePrompt;
        
        // Replace variables
        for (const [variable, defaultValue] of Object.entries(template.variables)) {
            const contextValue = this.extractContextValue(context, variable) || defaultValue;
            templatedPrompt = templatedPrompt.replace(`{{${variable}}}`, contextValue);
        }
        
        // Integrate original prompt
        templatedPrompt = templatedPrompt.replace('{{ORIGINAL_PROMPT}}', prompt);
        
        return templatedPrompt;
    }

    /**
     * Incorporate insights from historical successful prompts
     */
    private incorporateHistoricalInsights(prompt: string, similarPrompts: PromptMetrics[]): string {
        const successfulPrompts = similarPrompts.filter(p => 
            this.calculateOverallScore(p.successMetrics) > 0.8
        );
        
        if (successfulPrompts.length === 0) {return prompt;}
        
        // Extract successful patterns and phrases
        const successfulPhrases = this.extractSuccessfulPhrases(successfulPrompts);
        
        let enhancedPrompt = prompt;
        for (const phrase of successfulPhrases) {
            if (!enhancedPrompt.includes(phrase) && phrase.length > 10) {
                enhancedPrompt += `\n\nAdditional context: ${phrase}`;
            }
        }
        
        return enhancedPrompt;
    }

    /**
     * Update learning patterns based on prompt performance
     */
    private updateLearningPatterns(metric: PromptMetrics): void {
        const phrases = this.extractPhrases(metric.prompt);
        const overallScore = this.calculateOverallScore(metric.successMetrics);
        
        for (const phrase of phrases) {
            let pattern = this.learningPatterns.find(p => p.pattern === phrase);
            
            if (!pattern) {
                pattern = {
                    pattern: phrase,
                    effectiveness: overallScore,
                    contexts: [this.inferContext(metric.context)],
                    frequency: 1,
                    lastUsed: new Date()
                };
                this.learningPatterns.push(pattern);
            } else {
                // Update effectiveness using weighted average
                pattern.effectiveness = (pattern.effectiveness * pattern.frequency + overallScore) / (pattern.frequency + 1);
                pattern.frequency++;
                pattern.lastUsed = new Date();
                
                const context = this.inferContext(metric.context);
                if (!pattern.contexts.includes(context)) {
                    pattern.contexts.push(context);
                }
            }
        }
    }

    /**
     * Generate improvement for underperforming prompt
     */
    private async generateImprovement(metric: PromptMetrics): Promise<string> {
        const issues = this.identifyIssues(metric.successMetrics);
        const bestPractices = this.getBestPracticesForIssues(issues);
        
        let improvedPrompt = metric.prompt;
        
        // Apply improvements based on identified issues
        for (const practice of bestPractices) {
            improvedPrompt = this.applyBestPractice(improvedPrompt, practice);
        }
        
        return improvedPrompt;
    }

    /**
     * Helper methods
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.split(' '));
        const words2 = new Set(str2.split(' '));
        const intersection = new Set([...words1].filter(word => words2.has(word)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }

    private calculateOverallScore(metrics: PromptMetrics['successMetrics']): number {
        return (metrics.accuracy + metrics.relevance + metrics.completeness + metrics.efficiency) / 4;
    }

    private isExceptionalPerformance(metrics: PromptMetrics['successMetrics']): boolean {
        return this.calculateOverallScore(metrics) > 0.9;
    }

    private extractPhrases(prompt: string): string[] {
        // Extract meaningful phrases (3+ words)
        const words = prompt.split(/\s+/);
        const phrases: string[] = [];
        
        for (let i = 0; i < words.length - 2; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            if (phrase.length > 10) {
                phrases.push(phrase);
            }
        }
        
        return phrases;
    }

    private integratePattern(prompt: string, pattern: string): string {
        // Smart integration of patterns into prompts
        if (prompt.includes('Please') && pattern.includes('step-by-step')) {
            return prompt.replace('Please', 'Please provide a step-by-step');
        }
        return `${prompt}\n\nNote: ${pattern}`;
    }

    private extractContextValue(context: any, variable: string): string {
        try {
            return context[variable] || '';
        } catch {
            return '';
        }
    }

    private extractSuccessfulPhrases(prompts: PromptMetrics[]): string[] {
        const phrases = new Set<string>();
        
        for (const prompt of prompts) {
            const promptPhrases = this.extractPhrases(prompt.prompt);
            promptPhrases.forEach(phrase => phrases.add(phrase));
        }
        
        return Array.from(phrases).slice(0, 5);
    }

    private inferContext(contextStr: string): string {
        if (contextStr.includes('debug')) {return 'debugging';}
        if (contextStr.includes('test')) {return 'testing';}
        if (contextStr.includes('optimize')) {return 'optimization';}
        if (contextStr.includes('document')) {return 'documentation';}
        return 'general';
    }

    private identifyIssues(metrics: PromptMetrics['successMetrics']): string[] {
        const issues: string[] = [];
        
        if (metrics.accuracy < 0.6) {issues.push('accuracy');}
        if (metrics.relevance < 0.6) {issues.push('relevance');}
        if (metrics.completeness < 0.6) {issues.push('completeness');}
        if (metrics.efficiency < 0.6) {issues.push('efficiency');}
        
        return issues;
    }

    private getBestPracticesForIssues(issues: string[]): string[] {
        const practices: string[] = [];
        
        if (issues.includes('accuracy')) {
            practices.push('Add more specific examples');
            practices.push('Include context about expected output format');
        }
        
        if (issues.includes('relevance')) {
            practices.push('Add domain-specific terminology');
            practices.push('Include relevant constraints');
        }
        
        if (issues.includes('completeness')) {
            practices.push('Ask for step-by-step explanation');
            practices.push('Request comprehensive coverage');
        }
        
        if (issues.includes('efficiency')) {
            practices.push('Use more direct language');
            practices.push('Specify output format clearly');
        }
        
        return practices;
    }

    private applyBestPractice(prompt: string, practice: string): string {
        switch (practice) {
            case 'Add more specific examples':
                return `${prompt}\n\nPlease provide specific examples to illustrate your solution.`;
            case 'Include context about expected output format':
                return `${prompt}\n\nFormat your response clearly with headers and bullet points where appropriate.`;
            case 'Add domain-specific terminology':
                return `${prompt}\n\nUse appropriate technical terminology and industry best practices.`;
            case 'Include relevant constraints':
                return `${prompt}\n\nConsider any relevant constraints, limitations, or requirements.`;
            case 'Ask for step-by-step explanation':
                return `${prompt}\n\nProvide a step-by-step explanation of your approach.`;
            case 'Request comprehensive coverage':
                return `${prompt}\n\nEnsure comprehensive coverage of all relevant aspects.`;
            case 'Use more direct language':
                return prompt.replace(/please consider/gi, 'analyze').replace(/might/gi, 'will');
            case 'Specify output format clearly':
                return `${prompt}\n\nStructure your response with clear sections and actionable items.`;
            default:
                return prompt;
        }
    }

    private findTemplateByPrompt(prompt: string): PromptTemplate | undefined {
        for (const template of this.promptTemplates.values()) {
            if (this.calculateSimilarity(template.basePrompt, prompt) > 0.7) {
                return template;
            }
        }
        return undefined;
    }

    private async updateTemplateFromSuccess(
        prompt: string,
        context: string,
        metrics: PromptMetrics['successMetrics']
    ): Promise<void> {
        const category = this.inferContext(context) as PromptTemplate['category'];
        const templateId = `template_${category}_${Date.now()}`;
        
        const template: PromptTemplate = {
            id: templateId,
            name: `High-Performance ${category} Template`,
            category,
            basePrompt: prompt,
            variables: this.extractVariables(prompt),
            improvementStrategies: this.extractStrategies(prompt),
            successCriteria: {
                minAccuracy: metrics.accuracy,
                minRelevance: metrics.relevance,
                minCompleteness: metrics.completeness,
                maxExecutionTime: 30000
            },
            version: 1,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
        
        this.promptTemplates.set(templateId, template);
    }

    private extractVariables(prompt: string): { [key: string]: string } {
        const variables: { [key: string]: string } = {};
        const matches = prompt.match(/\b[A-Z_]+\b/g) || [];
        
        matches.forEach(match => {
            variables[match.toLowerCase()] = `{{${match.toLowerCase()}}}`;
        });
        
        return variables;
    }

    private extractStrategies(prompt: string): string[] {
        const strategies: string[] = [];
        
        if (prompt.includes('step-by-step')) {strategies.push('sequential-approach');}
        if (prompt.includes('example')) {strategies.push('example-driven');}
        if (prompt.includes('specific')) {strategies.push('specificity-focused');}
        if (prompt.includes('comprehensive')) {strategies.push('comprehensive-coverage');}
        
        return strategies;
    }

    private analyzeCategoryPerformance(): any {
        const categories = ['debugging', 'testing', 'optimization', 'documentation', 'general'];
        const performance: any = {};
        
        for (const category of categories) {
            const categoryMetrics = this.metricsHistory.filter(m => 
                this.inferContext(m.context) === category
            );
            
            if (categoryMetrics.length > 0) {
                const avgScore = categoryMetrics.reduce((sum, m) => 
                    sum + this.calculateOverallScore(m.successMetrics), 0
                ) / categoryMetrics.length;
                
                performance[category] = {
                    count: categoryMetrics.length,
                    averageScore: Math.round(avgScore * 100) / 100,
                    improvementTrend: this.calculateTrend(categoryMetrics)
                };
            }
        }
        
        return performance;
    }

    private calculateTrend(metrics: PromptMetrics[]): string {
        if (metrics.length < 2) {return 'insufficient-data';}
        
        const sorted = metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, m) => sum + this.calculateOverallScore(m.successMetrics), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, m) => sum + this.calculateOverallScore(m.successMetrics), 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 0.1) {return 'improving';}
        if (secondAvg < firstAvg - 0.1) {return 'declining';}
        return 'stable';
    }

    private calculateImprovementTrends(): any {
        const recentMetrics = this.metricsHistory
            .filter(m => m.timestamp.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        if (recentMetrics.length < 5) {return { trend: 'insufficient-data' };}
        
        const trend = this.calculateTrend(recentMetrics);
        const avgScore = recentMetrics.reduce((sum, m) => sum + this.calculateOverallScore(m.successMetrics), 0) / recentMetrics.length;
        
        return {
            trend,
            recentAverageScore: Math.round(avgScore * 100) / 100,
            dataPoints: recentMetrics.length
        };
    }

    private initializeDefaultTemplates(): void {
        const debugTemplate: PromptTemplate = {
            id: 'debug_default',
            name: 'Debug Analysis Template',
            category: 'debugging',
            basePrompt: `Analyze the following error and provide a comprehensive debugging solution:

Error: {{ERROR_MESSAGE}}
Code Context: {{CODE_CONTEXT}}
Environment: {{ENVIRONMENT}}

Please provide:
1. Root cause analysis
2. Step-by-step debugging approach  
3. Specific code fixes
4. Prevention strategies for future occurrences

{{ORIGINAL_PROMPT}}`,
            variables: {
                error_message: '{{ERROR_MESSAGE}}',
                code_context: '{{CODE_CONTEXT}}',
                environment: '{{ENVIRONMENT}}'
            },
            improvementStrategies: ['step-by-step', 'comprehensive-coverage', 'prevention-focused'],
            successCriteria: {
                minAccuracy: 0.8,
                minRelevance: 0.8,
                minCompleteness: 0.7,
                maxExecutionTime: 25000
            },
            version: 1,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        this.promptTemplates.set('debug_default', debugTemplate);
    }

    /**
     * Persistence methods
     */
    private async loadPersistedData(): Promise<void> {
        try {
            const metricsFile = vscode.Uri.joinPath(this.storageUri, 'metrics.json');
            const templatesFile = vscode.Uri.joinPath(this.storageUri, 'templates.json');
            const patternsFile = vscode.Uri.joinPath(this.storageUri, 'patterns.json');

            try {
                const metricsData = await vscode.workspace.fs.readFile(metricsFile);
                this.metricsHistory = JSON.parse(Buffer.from(metricsData).toString());
            } catch {}

            try {
                const templatesData = await vscode.workspace.fs.readFile(templatesFile);
                const templates = JSON.parse(Buffer.from(templatesData).toString());
                this.promptTemplates = new Map(Object.entries(templates));
            } catch {}

            try {
                const patternsData = await vscode.workspace.fs.readFile(patternsFile);
                this.learningPatterns = JSON.parse(Buffer.from(patternsData).toString());
            } catch {}

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Failed to load persisted data: ${errorMessage}`);
        }
    }

    private async persistData(): Promise<void> {
        try {
            const metricsFile = vscode.Uri.joinPath(this.storageUri, 'metrics.json');
            const templatesFile = vscode.Uri.joinPath(this.storageUri, 'templates.json');
            const patternsFile = vscode.Uri.joinPath(this.storageUri, 'patterns.json');

            await vscode.workspace.fs.writeFile(
                metricsFile,
                Buffer.from(JSON.stringify(this.metricsHistory, null, 2))
            );

            await vscode.workspace.fs.writeFile(
                templatesFile,
                Buffer.from(JSON.stringify(Object.fromEntries(this.promptTemplates), null, 2))
            );

            await vscode.workspace.fs.writeFile(
                patternsFile,
                Buffer.from(JSON.stringify(this.learningPatterns, null, 2))
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Failed to persist data: ${errorMessage}`);
        }
    }
}

// Export singleton instance
let promptEngineInstance: SelfImprovingPromptEngine | undefined;

export function getSelfImprovingPromptEngine(context: vscode.ExtensionContext): SelfImprovingPromptEngine {
    if (!promptEngineInstance) {
        promptEngineInstance = new SelfImprovingPromptEngine(context);
    }
    return promptEngineInstance;
}