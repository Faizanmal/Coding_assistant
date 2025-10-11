import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { ProjectKnowledgeSystem, CodeEntity } from './project-knowledge-system';
import { EnhancedContextSystem } from './enhanced-context-system';

/**
 * Advanced Semantic Code Search and Understanding System
 * Provides intelligent code search, semantic understanding, and contextual code generation
 */

export interface SemanticSearchResult {
    entity: CodeEntity;
    relevanceScore: number;
    contextualReason: string;
    suggestedActions: string[];
    relatedEntities: CodeEntity[];
}

export interface CodeUnderstandingResult {
    summary: string;
    purpose: string;
    dependencies: string[];
    complexity: 'low' | 'medium' | 'high';
    maintainability: number;
    suggestions: string[];
    refactoringOpportunities: string[];
    testingSuggestions: string[];
}

export interface LongTermMemory {
    sessionId: string;
    interactions: Array<{
        timestamp: Date;
        userQuery: string;
        aiResponse: string;
        codeContext: string[];
        filesModified: string[];
        insights: string[];
    }>;
    learnings: Array<{
        pattern: string;
        description: string;
        frequency: number;
        lastSeen: Date;
    }>;
    userPreferences: {
        codingStyle: string;
        preferredPatterns: string[];
        frequentTasks: string[];
        expertise: Map<string, number>; // topic -> skill level (0-1)
    };
    projectInsights: Array<{
        insight: string;
        confidence: number;
        evidence: string[];
        lastValidated: Date;
    }>;
}

export class SemanticCodeSystem {
    private static instance: SemanticCodeSystem;
    private knowledgeSystem: ProjectKnowledgeSystem;
    private contextSystem: EnhancedContextSystem;
    private longTermMemory: Map<string, LongTermMemory> = new Map();
    private semanticCache: Map<string, any> = new Map();
    private webviewView?: vscode.WebviewView;

    constructor() {
        this.knowledgeSystem = ProjectKnowledgeSystem.getInstance();
        this.contextSystem = EnhancedContextSystem.getInstance();
        this.loadLongTermMemory();
    }

    static getInstance(): SemanticCodeSystem {
        if (!this.instance) {
            this.instance = new SemanticCodeSystem();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
    }

    /**
     * Advanced semantic code search with AI-powered understanding
     */
    async semanticSearch(query: string, options?: {
        includeContext?: boolean;
        maxResults?: number;
        searchScope?: 'functions' | 'classes' | 'all';
        similarityThreshold?: number;
    }): Promise<SemanticSearchResult[]> {
        console.log(`🔍 Performing semantic search for: "${query}"`);

        const {
            includeContext = true,
            maxResults = 10,
            searchScope = 'all',
            similarityThreshold = 0.3
        } = options || {};

        try {
            // Get project knowledge graph
            const knowledgeGraph = await this.knowledgeSystem.buildKnowledgeGraph();
            
            // Filter entities based on search scope
            let entities = Array.from(knowledgeGraph.entities.values());
            if (searchScope !== 'all') {
                entities = entities.filter(e => e.type === searchScope.slice(0, -1) as any);
            }

            // Perform AI-enhanced semantic matching
            const results: SemanticSearchResult[] = [];

            for (const entity of entities) {
                const relevanceScore = await this.calculateSemanticRelevance(entity, query, knowledgeGraph);
                
                if (relevanceScore >= similarityThreshold) {
                    const contextualReason = await this.generateContextualReason(entity, query);
                    const suggestedActions = await this.generateSuggestedActions(entity, query);
                    const relatedEntities = await this.findRelatedEntities(entity, knowledgeGraph);

                    results.push({
                        entity,
                        relevanceScore,
                        contextualReason,
                        suggestedActions,
                        relatedEntities
                    });
                }
            }

            // Sort by relevance and return top results
            results.sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            // Store search in long-term memory
            await this.recordInteraction(query, `Found ${results.length} relevant entities`, []);

            return results.slice(0, maxResults);

        } catch (error) {
            console.error('Semantic search failed:', error);
            return [];
        }
    }

    /**
     * Calculate semantic relevance using AI and multiple signals
     */
    private async calculateSemanticRelevance(
        entity: CodeEntity, 
        query: string, 
        knowledgeGraph: any
    ): Promise<number> {
        let score = 0;

        // Direct text matching (basic)
        const queryLower = query.toLowerCase();
        const entityText = `${entity.name} ${entity.purpose} ${entity.content}`.toLowerCase();
        
        if (entityText.includes(queryLower)) {
            score += 0.4;
        }

        // Semantic matching using AI
        try {
            const semanticPrompt = `Analyze the semantic similarity between:
Query: "${query}"
Code Entity: ${entity.name} - ${entity.purpose}

Rate similarity from 0.0 to 1.0 based on:
1. Functional similarity
2. Purpose alignment  
3. Context relevance
4. Conceptual relationship

Respond with only a number between 0.0 and 1.0:`;

            const aiScore = await generateCode(semanticPrompt, 'llama-3.3-70b-versatile');
            const parsedScore = parseFloat(aiScore.trim());
            
            if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 1) {
                score += parsedScore * 0.6;
            }

        } catch (error) {
            console.warn('AI semantic matching failed, using heuristics');
        }

        // Tag matching
        const queryWords = query.toLowerCase().split(' ');
        const matchingTags = entity.tags.filter(tag => 
            queryWords.some(word => tag.toLowerCase().includes(word))
        );
        score += (matchingTags.length / entity.tags.length) * 0.2;

        // Dependency relevance
        if (entity.dependencies.some(dep => queryLower.includes(dep.toLowerCase()))) {
            score += 0.1;
        }

        // Complexity bonus (prefer simpler matches for general queries)
        if (entity.complexity === 'low' && !query.includes('complex')) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Generate contextual reason for why entity matches query
     */
    private async generateContextualReason(entity: CodeEntity, query: string): Promise<string> {
        try {
            const reasonPrompt = `Explain why this code entity is relevant to the user's query:

Query: "${query}"
Entity: ${entity.name} (${entity.type})
Purpose: ${entity.purpose}
Tags: ${entity.tags.join(', ')}

Provide a concise, helpful explanation of the relevance:`;

            const reason = await generateCode(reasonPrompt, 'llama-3.3-70b-versatile');
            return reason.trim().substring(0, 200);

        } catch (error) {
            return `${entity.name} matches your query based on its ${entity.type} functionality and purpose.`;
        }
    }

    /**
     * Generate suggested actions for found entity
     */
    private async generateSuggestedActions(entity: CodeEntity, query: string): Promise<string[]> {
        const actions = [];

        // Standard actions based on entity type
        switch (entity.type) {
            case 'function':
                actions.push('View function implementation');
                actions.push('Analyze function dependencies');
                actions.push('Generate unit tests');
                if (entity.complexity === 'high') {
                    actions.push('Suggest refactoring opportunities');
                }
                break;
            
            case 'class':
                actions.push('View class structure');
                actions.push('Analyze class methods');
                actions.push('Generate class documentation');
                actions.push('Find usage patterns');
                break;
            
            case 'interface':
                actions.push('View interface definition');
                actions.push('Find implementations');
                actions.push('Generate mock objects');
                break;
        }

        // Query-specific actions
        if (query.includes('test') || query.includes('testing')) {
            actions.push('Generate comprehensive tests');
            actions.push('Analyze test coverage');
        }

        if (query.includes('optimize') || query.includes('performance')) {
            actions.push('Analyze performance bottlenecks');
            actions.push('Suggest optimizations');
        }

        if (query.includes('refactor')) {
            actions.push('Identify refactoring opportunities');
            actions.push('Suggest design patterns');
        }

        return actions.slice(0, 5); // Limit to 5 most relevant actions
    }

    /**
     * Find entities related to the current entity
     */
    private async findRelatedEntities(
        entity: CodeEntity, 
        knowledgeGraph: any
    ): Promise<CodeEntity[]> {
        const related: CodeEntity[] = [];

        // Find entities with shared dependencies
        for (const otherEntity of knowledgeGraph.entities.values()) {
            if (otherEntity.id === entity.id) { continue; }

            const sharedDeps = entity.dependencies.filter(dep => 
                otherEntity.dependencies.includes(dep)
            );
            
            if (sharedDeps.length > 0) {
                related.push(otherEntity);
            }
        }

        // Find entities in same file
        const sameFileEntities: CodeEntity[] = [];
        for (const entity2 of knowledgeGraph.entities.values()) {
            if (entity2.filePath === entity.filePath && entity2.id !== entity.id) {
                sameFileEntities.push(entity2);
            }
        }
        
        related.push(...sameFileEntities.slice(0, 3));

        // Find entities that depend on this one
        const dependents: CodeEntity[] = [];
        for (const entity3 of knowledgeGraph.entities.values()) {
            if (entity3.dependencies.includes(entity.name)) {
                dependents.push(entity3);
            }
        }
        
        related.push(...dependents.slice(0, 2));

        return related.slice(0, 5);
    }

    /**
     * Understand code with deep AI analysis
     */
    async understandCode(
        code: string, 
        filePath?: string, 
        context?: string[]
    ): Promise<CodeUnderstandingResult> {
        console.log('🧠 Performing deep code analysis...');

        try {
            // Build comprehensive analysis prompt
            const analysisPrompt = `Perform deep analysis of this code:

${filePath ? `File: ${filePath}` : ''}
${context ? `Context Files: ${context.join(', ')}` : ''}

Code:
${code}

Provide comprehensive analysis including:
1. Summary of what the code does
2. Main purpose and responsibilities
3. Dependencies and relationships
4. Complexity assessment (low/medium/high)
5. Maintainability score (0-100)
6. Specific improvement suggestions
7. Refactoring opportunities
8. Testing recommendations

Format as JSON:
{
  "summary": "Brief summary",
  "purpose": "Main purpose",
  "dependencies": ["dep1", "dep2"],
  "complexity": "low|medium|high",
  "maintainability": 85,
  "suggestions": ["suggestion1", "suggestion2"],
  "refactoringOpportunities": ["opportunity1"],
  "testingSuggestions": ["test1", "test2"]
}`;

            const aiResponse = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            const analysis = JSON.parse(aiResponse);

            // Enhance with project context if available
            if (filePath) {
                const projectInsights = await this.getProjectContextForFile(filePath);
                analysis.suggestions = [...analysis.suggestions, ...projectInsights];
            }

            // Store in long-term memory
            await this.recordInteraction(
                `Understand code in ${filePath || 'current context'}`,
                analysis.summary,
                filePath ? [filePath] : []
            );

            return analysis;

        } catch (error) {
            console.error('Code understanding failed:', error);
            
            // Fallback analysis
            return {
                summary: 'Code analysis temporarily unavailable',
                purpose: 'Function or code block requiring analysis',
                dependencies: [],
                complexity: 'medium',
                maintainability: 70,
                suggestions: ['Review code structure', 'Consider adding documentation'],
                refactoringOpportunities: ['Break down into smaller functions'],
                testingSuggestions: ['Add unit tests', 'Test edge cases']
            };
        }
    }

    /**
     * Generate project-aware code suggestions
     */
    async generateProjectAwareCode(
        prompt: string, 
        targetFile?: string, 
        insertionContext?: string
    ): Promise<string> {
        console.log('🚀 Generating project-aware code...');

        try {
            // Get project knowledge and conventions
            const knowledgeGraph = await this.knowledgeSystem.buildKnowledgeGraph();
            const conventions = knowledgeGraph.conventions;
            
            // Analyze target file if provided
            let fileContext = '';
            if (targetFile) {
                try {
                    const document = await vscode.workspace.openTextDocument(targetFile);
                    const existingCode = document.getText();
                    fileContext = `\nExisting file content:\n${existingCode.substring(0, 1000)}...`;
                } catch (error) {
                    console.warn('Could not read target file:', error);
                }
            }

            // Get similar code patterns from project
            const similarPatterns = await this.findSimilarPatterns(prompt, knowledgeGraph);
            
            // Build comprehensive generation prompt
            const generationPrompt = `Generate code that fits perfectly with this project's patterns and conventions:

USER REQUEST: ${prompt}

PROJECT CONVENTIONS:
- Naming: ${conventions.namingStyle}
- Indentation: ${conventions.indentation} spaces
- Quotes: ${conventions.quotes}
- Semicolons: ${conventions.semicolons ? 'Required' : 'Optional'}
- Async Pattern: ${conventions.asyncPattern}

SIMILAR PATTERNS IN PROJECT:
${similarPatterns.map(p => `- ${p.name}: ${p.purpose}`).join('\n')}

${fileContext}

${insertionContext ? `INSERTION CONTEXT:\n${insertionContext}` : ''}

Generate code that:
1. Follows the project's established conventions
2. Uses similar patterns and styles found in the codebase
3. Integrates seamlessly with existing code
4. Includes appropriate error handling and documentation
5. Follows the project's architectural patterns

Return only the generated code without explanation:`;

            const generatedCode = await generateCode(generationPrompt, 'llama-3.3-70b-versatile');
            
            // Record successful generation
            await this.recordInteraction(
                prompt,
                `Generated ${generatedCode.split('\n').length} lines of project-aware code`,
                targetFile ? [targetFile] : []
            );

            return generatedCode;

        } catch (error) {
            console.error('Project-aware code generation failed:', error);
            return `// Code generation failed. Please try again.\n// Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    /**
     * Find similar code patterns in the project
     */
    private async findSimilarPatterns(
        prompt: string, 
        knowledgeGraph: any
    ): Promise<CodeEntity[]> {
        const entities: CodeEntity[] = [];
        for (const entity of knowledgeGraph.entities.values()) {
            entities.push(entity as CodeEntity);
        }
        const scored: Array<{entity: CodeEntity, score: number}> = [];

        for (const entity of entities) {
            const score = await this.calculatePatternSimilarity(entity, prompt);
            if (score > 0.3) {
                scored.push({ entity, score });
            }
        }

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(item => item.entity);
    }

    /**
     * Calculate pattern similarity for code generation
     */
    private async calculatePatternSimilarity(entity: CodeEntity, prompt: string): Promise<number> {
        const promptLower = prompt.toLowerCase();
        let score = 0;

        // Check for functional similarity
        if (entity.purpose?.toLowerCase().includes(promptLower)) {
            score += 0.6;
        }

        // Check tags for relevance
        const relevantTags = entity.tags.filter(tag => 
            promptLower.includes(tag.toLowerCase())
        );
        score += (relevantTags.length / Math.max(entity.tags.length, 1)) * 0.3;

        // Prefer functions for code generation
        if (entity.type === 'function') {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Get project context for a specific file
     */
    private async getProjectContextForFile(filePath: string): Promise<string[]> {
        const insights = [];

        try {
            const knowledgeGraph = await this.knowledgeSystem.buildKnowledgeGraph();
            const module = knowledgeGraph.modules.get(filePath);
            
            if (module) {
                insights.push(`File is categorized as ${module.category}`);
                if (module.complexity > 0.7) {
                    insights.push('Consider breaking down complex functions');
                }
                if (module.imports.length > 10) {
                    insights.push('High number of imports - consider dependency injection');
                }
            }

        } catch (error) {
            console.warn('Could not get project context:', error);
        }

        return insights;
    }

    /**
     * Record interaction in long-term memory
     */
    private async recordInteraction(
        query: string, 
        response: string, 
        filesModified: string[]
    ): Promise<void> {
        const sessionId = 'default'; // Could be enhanced to track multiple sessions
        
        if (!this.longTermMemory.has(sessionId)) {
            this.longTermMemory.set(sessionId, {
                sessionId,
                interactions: [],
                learnings: [],
                userPreferences: {
                    codingStyle: 'standard',
                    preferredPatterns: [],
                    frequentTasks: [],
                    expertise: new Map()
                },
                projectInsights: []
            });
        }

        const memory = this.longTermMemory.get(sessionId)!;
        
        memory.interactions.push({
            timestamp: new Date(),
            userQuery: query,
            aiResponse: response,
            codeContext: [],
            filesModified,
            insights: []
        });

        // Limit memory size
        if (memory.interactions.length > 1000) {
            memory.interactions = memory.interactions.slice(-500);
        }

        // Update user expertise based on interaction
        this.updateUserExpertise(memory, query);

        // Save to persistent storage
        await this.saveLongTermMemory();
    }

    /**
     * Update user expertise based on interactions
     */
    private updateUserExpertise(memory: LongTermMemory, query: string): void {
        const topics = this.extractTopicsFromQuery(query);
        
        topics.forEach(topic => {
            const current = memory.userPreferences.expertise.get(topic) || 0;
            memory.userPreferences.expertise.set(topic, Math.min(current + 0.1, 1.0));
        });
    }

    /**
     * Extract topics from user query
     */
    private extractTopicsFromQuery(query: string): string[] {
        const topics = [];
        const queryLower = query.toLowerCase();

        // Technology detection
        if (queryLower.includes('react')) { topics.push('react'); }
        if (queryLower.includes('typescript')) { topics.push('typescript'); }
        if (queryLower.includes('node')) { topics.push('nodejs'); }
        if (queryLower.includes('test')) { topics.push('testing'); }
        if (queryLower.includes('api')) { topics.push('api-development'); }
        if (queryLower.includes('database')) { topics.push('database'); }
        if (queryLower.includes('performance')) { topics.push('performance'); }
        if (queryLower.includes('security')) { topics.push('security'); }

        // Task detection
        if (queryLower.includes('refactor')) { topics.push('refactoring'); }
        if (queryLower.includes('optimize')) { topics.push('optimization'); }
        if (queryLower.includes('debug')) { topics.push('debugging'); }

        return topics;
    }

    /**
     * Get user's expertise profile
     */
    getUserExpertise(sessionId: string = 'default'): Map<string, number> {
        const memory = this.longTermMemory.get(sessionId);
        return memory?.userPreferences.expertise || new Map();
    }

    /**
     * Get interaction history
     */
    getInteractionHistory(sessionId: string = 'default', limit: number = 20): Array<any> {
        const memory = this.longTermMemory.get(sessionId);
        return memory?.interactions.slice(-limit) || [];
    }

    // Storage methods
    private async loadLongTermMemory(): Promise<void> {
        try {
            // In a real implementation, this would load from persistent storage
            // For now, we'll start with empty memory
            console.log('📚 Long-term memory initialized');
        } catch (error) {
            console.warn('Failed to load long-term memory:', error);
        }
    }

    private async saveLongTermMemory(): Promise<void> {
        try {
            // In a real implementation, this would save to persistent storage
            // For now, we'll just log the action
            console.log('💾 Long-term memory saved');
        } catch (error) {
            console.warn('Failed to save long-term memory:', error);
        }
    }

    /**
     * Clear semantic cache (useful for testing or memory management)
     */
    clearCache(): void {
        this.semanticCache.clear();
        console.log('🧹 Semantic cache cleared');
    }

    dispose(): void {
        this.semanticCache.clear();
    }
}