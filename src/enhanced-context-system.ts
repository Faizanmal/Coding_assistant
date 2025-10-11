import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { CodebaseAnalyzer } from './codebaseanalyzer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced Context Memory System with persistent multi-turn conversation context
 * and cross-file code understanding capabilities
 */
export interface ContextMemoryEntry {
    id: string;
    timestamp: Date;
    content: string;
    type: 'conversation' | 'file_change' | 'code_analysis' | 'user_preference' | 'project_insight';
    relevanceScore: number;
    associatedFiles: string[];
    tags: string[];
    embedding?: number[];
}

export interface ProjectContext {
    projectType: string;
    mainLanguages: string[];
    frameworks: string[];
    architecture: string;
    keyFiles: Map<string, string>; // filename -> purpose
    dependencies: string[];
    patterns: string[];
    lastAnalysis: Date;
}

export interface UserContext {
    preferences: {
        codingStyle: 'verbose' | 'concise' | 'functional' | 'oop';
        commentStyle: 'minimal' | 'detailed' | 'docstring';
        errorHandling: 'defensive' | 'optimistic' | 'strict';
        testingApproach: 'tdd' | 'bdd' | 'integration' | 'unit';
    };
    expertise: {
        languages: Map<string, 'beginner' | 'intermediate' | 'expert'>;
        frameworks: Map<string, 'beginner' | 'intermediate' | 'expert'>;
        domains: string[]; // e.g., 'web', 'mobile', 'data-science', 'devops'
    };
    workingPatterns: {
        activeHours: { start: number; end: number };
        sessionDuration: number;
        frequentOperations: string[];
    };
}

export class EnhancedContextSystem {
    private static instance: EnhancedContextSystem;
    private contextMemory: Map<string, ContextMemoryEntry[]> = new Map();
    private projectContext: ProjectContext | null = null;
    private userContext: UserContext;
    private conversationThreads: Map<string, ContextMemoryEntry[]> = new Map();
    private fileChangeHistory: Map<string, string[]> = new Map();
    private memoryCapacity = 1000; // Max entries per session
    
    constructor() {
        this.userContext = this.initializeUserContext();
        this.loadPersistedContext();
    }

    static getInstance(): EnhancedContextSystem {
        if (!this.instance) {
            this.instance = new EnhancedContextSystem();
        }
        return this.instance;
    }

    private initializeUserContext(): UserContext {
        return {
            preferences: {
                codingStyle: 'verbose',
                commentStyle: 'detailed',
                errorHandling: 'defensive',
                testingApproach: 'unit'
            },
            expertise: {
                languages: new Map(),
                frameworks: new Map(),
                domains: []
            },
            workingPatterns: {
                activeHours: { start: 9, end: 17 },
                sessionDuration: 60,
                frequentOperations: []
            }
        };
    }

    /**
     * Add context entry with automatic relevance scoring and embedding
     */
    async addContext(
        sessionId: string,
        content: string,
        type: ContextMemoryEntry['type'],
        associatedFiles: string[] = [],
        tags: string[] = []
    ): Promise<void> {
        const entry: ContextMemoryEntry = {
            id: this.generateContextId(),
            timestamp: new Date(),
            content,
            type,
            relevanceScore: await this.calculateRelevanceScore(content, type),
            associatedFiles,
            tags,
            // embedding: await this.generateEmbedding(content) // Would implement with actual embedding API
        };

        if (!this.contextMemory.has(sessionId)) {
            this.contextMemory.set(sessionId, []);
        }

        const sessionMemory = this.contextMemory.get(sessionId)!;
        sessionMemory.push(entry);

        // Maintain memory capacity
        if (sessionMemory.length > this.memoryCapacity) {
            // Remove lowest relevance entries
            sessionMemory.sort((a, b) => b.relevanceScore - a.relevanceScore);
            sessionMemory.splice(this.memoryCapacity);
        }

        // Persist important context
        if (entry.relevanceScore > 0.7) {
            await this.persistContext(entry);
        }
    }

    /**
     * Retrieve relevant context for current query with semantic search
     */
    async getRelevantContext(
        sessionId: string, 
        query: string, 
        maxEntries: number = 10
    ): Promise<ContextMemoryEntry[]> {
        const sessionMemory = this.contextMemory.get(sessionId) || [];
        
        // Score entries based on semantic similarity and recency
        const scoredEntries = await Promise.all(
            sessionMemory.map(async (entry) => ({
                entry,
                score: await this.calculateContextRelevance(entry, query)
            }))
        );

        // Sort by relevance and return top entries
        return scoredEntries
            .sort((a, b) => b.score - a.score)
            .slice(0, maxEntries)
            .map(item => item.entry);
    }

    /**
     * Advanced project analysis with cross-file understanding
     */
    async analyzeProjectContext(): Promise<ProjectContext> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        const files = await vscode.workspace.findFiles(
            '**/*.{ts,js,py,java,cpp,cs,php,go,rs,vue,jsx,tsx}',
            '**/node_modules/**'
        );

        let codeAnalysis = '';
        const keyFiles = new Map<string, string>();
        const languages = new Set<string>();
        const frameworks = new Set<string>();
        const patterns = new Set<string>();

        // Analyze key files for project understanding
        const keyFileNames = ['package.json', 'requirements.txt', 'pom.xml', 'Cargo.toml', 'composer.json'];
        
        for (const fileName of keyFileNames) {
            const configFiles = files.filter(f => f.fsPath.endsWith(fileName));
            for (const file of configFiles.slice(0, 5)) {
                try {
                    const content = await vscode.workspace.fs.readFile(file);
                    const fileContent = content.toString();
                    
                    // Extract project information
                    if (fileName === 'package.json') {
                        const pkg = JSON.parse(fileContent);
                        Object.keys(pkg.dependencies || {}).forEach(dep => frameworks.add(dep));
                        Object.keys(pkg.devDependencies || {}).forEach(dep => frameworks.add(dep));
                    }
                    
                    keyFiles.set(fileName, fileContent.substring(0, 1000));
                } catch (error) {
                    console.warn(`Error reading ${fileName}:`, error);
                }
            }
        }

        // Analyze code patterns and architecture
        for (const file of files.slice(0, 20)) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const fileContent = content.toString();
                const ext = path.extname(file.fsPath).substring(1);
                
                languages.add(ext);
                
                // Detect patterns
                if (fileContent.includes('class ')) { patterns.add('oop'); }
                if (fileContent.includes('function ') || fileContent.includes('=>')) { patterns.add('functional'); }
                if (fileContent.includes('async ') || fileContent.includes('await ')) { patterns.add('async'); }
                if (fileContent.includes('test(') || fileContent.includes('describe(')) { patterns.add('testing'); }
                
                codeAnalysis += `\n--- ${file.fsPath} ---\n${fileContent.substring(0, 500)}`;
            } catch (error) {
                console.warn(`Error analyzing ${file.fsPath}:`, error);
            }
        }

        // AI-powered project analysis
        const analysisPrompt = `Analyze this codebase and provide structured insights:

CODE ANALYSIS:
${codeAnalysis}

KEY FILES:
${Array.from(keyFiles.entries()).map(([name, content]) => `${name}: ${content}`).join('\n')}

Provide a JSON response with:
{
  "projectType": "web-app" | "library" | "cli-tool" | "mobile-app" | "api" | "desktop-app",
  "architecture": "mvc" | "mvvm" | "microservices" | "monolithic" | "component-based" | "layered",
  "mainPurpose": "description",
  "keyComponents": ["component1", "component2"],
  "suggestedImprovements": ["improvement1", "improvement2"]
}`;

        try {
            const aiAnalysis = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            const analysisResult = JSON.parse(aiAnalysis);
            
            this.projectContext = {
                projectType: analysisResult.projectType || 'unknown',
                mainLanguages: Array.from(languages),
                frameworks: Array.from(frameworks),
                architecture: analysisResult.architecture || 'unknown',
                keyFiles,
                dependencies: Array.from(frameworks),
                patterns: Array.from(patterns),
                lastAnalysis: new Date()
            };

            return this.projectContext;
        } catch (error) {
            console.error('AI analysis failed, using heuristic analysis:', error);
            
            // Fallback to heuristic analysis
            this.projectContext = {
                projectType: this.inferProjectType(Array.from(frameworks)),
                mainLanguages: Array.from(languages),
                frameworks: Array.from(frameworks),
                architecture: 'unknown',
                keyFiles,
                dependencies: Array.from(frameworks),
                patterns: Array.from(patterns),
                lastAnalysis: new Date()
            };

            return this.projectContext;
        }
    }

    /**
     * Build comprehensive context for AI interactions
     */
    async buildContextualPrompt(sessionId: string, userQuery: string): Promise<string> {
        // Get relevant conversation history
        const relevantContext = await this.getRelevantContext(sessionId, userQuery);
        
        // Get current project context
        if (!this.projectContext || this.projectContext.lastAnalysis < new Date(Date.now() - 30 * 60 * 1000)) {
            await this.analyzeProjectContext();
        }

        // Get current file context
        const activeEditor = vscode.window.activeTextEditor;
        let currentFileContext = '';
        if (activeEditor) {
            const document = activeEditor.document;
            currentFileContext = `
CURRENT FILE: ${document.fileName}
LANGUAGE: ${document.languageId}
CONTENT PREVIEW:
${document.getText().substring(0, 2000)}...
`;
        }

        // Build comprehensive context
        const contextPrompt = `
CONVERSATION CONTEXT:
${relevantContext.map(entry => `[${entry.type}] ${entry.content}`).join('\n')}

PROJECT CONTEXT:
Type: ${this.projectContext?.projectType}
Languages: ${this.projectContext?.mainLanguages.join(', ')}
Frameworks: ${this.projectContext?.frameworks.slice(0, 10).join(', ')}
Architecture: ${this.projectContext?.architecture}
Patterns: ${this.projectContext?.patterns.join(', ')}

USER PREFERENCES:
Coding Style: ${this.userContext.preferences.codingStyle}
Comment Style: ${this.userContext.preferences.commentStyle}
Error Handling: ${this.userContext.preferences.errorHandling}

${currentFileContext}

USER QUERY: ${userQuery}

Based on this comprehensive context, provide an intelligent, project-aware response that:
1. References relevant conversation history
2. Considers the project structure and patterns
3. Aligns with user preferences
4. Provides actionable, contextual suggestions
5. Offers multi-step reasoning when appropriate
`;

        return contextPrompt;
    }

    // Helper methods
    private generateContextId(): string {
        return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async calculateRelevanceScore(content: string, type: ContextMemoryEntry['type']): Promise<number> {
        // Simple heuristic scoring (can be enhanced with ML)
        let score = 0.5;
        
        switch (type) {
            case 'conversation':
                score = content.length > 50 ? 0.7 : 0.4;
                break;
            case 'file_change':
                score = 0.8;
                break;
            case 'code_analysis':
                score = 0.9;
                break;
            case 'project_insight':
                score = 0.95;
                break;
            case 'user_preference':
                score = 0.6;
                break;
        }
        
        // Boost score for recent entries
        score += 0.1;
        
        return Math.min(score, 1.0);
    }

    private async calculateContextRelevance(entry: ContextMemoryEntry, query: string): Promise<number> {
        // Semantic similarity calculation (simplified)
        const queryLower = query.toLowerCase();
        const contentLower = entry.content.toLowerCase();
        
        let similarity = 0;
        const queryWords = queryLower.split(' ');
        const contentWords = contentLower.split(' ');
        
        for (const queryWord of queryWords) {
            for (const contentWord of contentWords) {
                if (queryWord === contentWord) {
                    similarity += 1;
                } else if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
                    similarity += 0.5;
                }
            }
        }
        
        // Normalize by content length and add recency boost
        const normalizedSimilarity = similarity / Math.max(queryWords.length, contentWords.length);
        const recencyBoost = Math.max(0, 1 - (Date.now() - entry.timestamp.getTime()) / (24 * 60 * 60 * 1000));
        
        return Math.min((normalizedSimilarity * 0.7) + (entry.relevanceScore * 0.2) + (recencyBoost * 0.1), 1.0);
    }

    private inferProjectType(frameworks: string[]): string {
        if (frameworks.some(f => ['react', 'vue', 'angular'].includes(f))) { return 'web-app'; }
        if (frameworks.some(f => ['express', 'fastapi', 'spring'].includes(f))) { return 'api'; }
        if (frameworks.some(f => ['electron', 'tauri'].includes(f))) { return 'desktop-app'; }
        if (frameworks.some(f => ['react-native', 'flutter'].includes(f))) { return 'mobile-app'; }
        return 'unknown';
    }

    private async persistContext(entry: ContextMemoryEntry): Promise<void> {
        // Implement persistence to workspace storage
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const contextFile = path.join(workspaceFolder.uri.fsPath, '.vscode', 'ai-context.json');
                const contextData = { entries: [entry] }; // Simplified for demo
                // In real implementation, append to existing context
                // await fs.promises.writeFile(contextFile, JSON.stringify(contextData, null, 2));
            }
        } catch (error) {
            console.warn('Failed to persist context:', error);
        }
    }

    private async loadPersistedContext(): Promise<void> {
        // Load previously persisted context
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const contextFile = path.join(workspaceFolder.uri.fsPath, '.vscode', 'ai-context.json');
                if (fs.existsSync(contextFile)) {
                    // const contextData = JSON.parse(await fs.promises.readFile(contextFile, 'utf8'));
                    // Process and load context data
                }
            }
        } catch (error) {
            console.warn('Failed to load persisted context:', error);
        }
    }
}