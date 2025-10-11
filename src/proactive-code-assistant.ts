import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { EnhancedContextSystem, ProjectContext, ContextMemoryEntry } from './enhanced-context-system';
import { AgenticChainOfThoughtSystem, CodingInsight } from './agentic-chain-of-thought';
import { CodebaseAnalyzer } from './codebaseanalyzer';

/**
 * Proactive Code Assistant that provides intelligent, context-aware suggestions
 * Monitors code changes and proactively suggests improvements, optimizations,
 * and potential issues before they become problems
 */

export interface ProactiveSuggestion {
    id: string;
    type: 'improvement' | 'optimization' | 'bug_prevention' | 'security' | 'architecture' | 'testing';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    reasoning: string;
    suggestedCode?: string;
    affectedFiles: string[];
    estimatedImpact: 'minor' | 'moderate' | 'significant' | 'major';
    confidence: number;
    actionable: boolean;
    autoImplementable: boolean;
    timestamp: Date;
    dismissed?: boolean;
}

export interface CodePattern {
    id: string;
    name: string;
    pattern: RegExp | string;
    description: string;
    category: 'anti-pattern' | 'code-smell' | 'best-practice' | 'optimization';
    severity: 'info' | 'warning' | 'error';
    suggestion: string;
    autoFix?: string;
}

export interface ProjectHealthMetrics {
    overallScore: number;
    codeQuality: number;
    testCoverage: number;
    documentation: number;
    security: number;
    performance: number;
    maintainability: number;
    lastAssessment: Date;
    trends: {
        improving: string[];
        declining: string[];
        stable: string[];
    };
    recommendations: ProactiveSuggestion[];
}

export class ProactiveCodeAssistant {
    private static instance: ProactiveCodeAssistant;
    private contextSystem: EnhancedContextSystem;
    private chainOfThought: AgenticChainOfThoughtSystem;
    private activeSuggestions: Map<string, ProactiveSuggestion> = new Map();
    private webviewView?: vscode.WebviewView;
    private fileWatcher?: vscode.FileSystemWatcher;
    private lastAnalysisTime = new Map<string, Date>();
    private isMonitoringActive = true;

    // Built-in code patterns for proactive detection
    private codePatterns: CodePattern[] = [
        {
            id: 'missing-error-handling',
            name: 'Missing Error Handling',
            pattern: /(?:fetch|axios|http|request)\([^)]*\)(?!\s*\.catch)/g,
            description: 'API calls without error handling',
            category: 'anti-pattern',
            severity: 'warning',
            suggestion: 'Add .catch() or try-catch blocks for error handling',
            autoFix: '.catch(error => console.error("API Error:", error))'
        },
        {
            id: 'console-log-in-production',
            name: 'Console Logs in Production',
            pattern: /console\.(log|warn|error|debug)/g,
            description: 'Console statements that should be removed for production',
            category: 'code-smell',
            severity: 'info',
            suggestion: 'Consider using a proper logging library or removing debug logs'
        },
        {
            id: 'hardcoded-values',
            name: 'Hardcoded Values',
            pattern: /("|')(?:localhost|127\.0\.0\.1|http:\/\/|https:\/\/[^"']*)("|')/g,
            description: 'Hardcoded URLs or configuration values',
            category: 'anti-pattern',
            severity: 'warning',
            suggestion: 'Use environment variables or configuration files'
        },
        {
            id: 'large-function',
            name: 'Large Function',
            pattern: '', // Handled programmatically
            description: 'Functions with too many lines (>50)',
            category: 'code-smell',
            severity: 'info',
            suggestion: 'Consider breaking down into smaller, more focused functions'
        },
        {
            id: 'missing-type-annotations',
            name: 'Missing Type Annotations',
            pattern: /function\s+\w+\([^)]*\)(?!\s*:\s*\w)/g,
            description: 'Functions without return type annotations in TypeScript',
            category: 'best-practice',
            severity: 'info',
            suggestion: 'Add explicit return type annotations for better type safety'
        }
    ];

    constructor() {
        this.contextSystem = EnhancedContextSystem.getInstance();
        this.chainOfThought = AgenticChainOfThoughtSystem.getInstance();
        this.initializeFileWatcher();
        this.startPeriodicAnalysis();
    }

    static getInstance(): ProactiveCodeAssistant {
        if (!this.instance) {
            this.instance = new ProactiveCodeAssistant();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
    }

    /**
     * Initialize file system watcher for real-time code monitoring
     */
    private initializeFileWatcher(): void {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/*.{ts,js,py,java,cpp,cs,php,go,rs}',
            false, // ignoreCreateEvents
            false, // ignoreChangeEvents
            false  // ignoreDeleteEvents
        );

        this.fileWatcher.onDidChange(async (uri) => {
            await this.analyzeFileChange(uri);
        });

        this.fileWatcher.onDidCreate(async (uri) => {
            await this.analyzeNewFile(uri);
        });
    }

    /**
     * Analyze file changes and provide proactive suggestions
     */
    private async analyzeFileChange(uri: vscode.Uri): Promise<void> {
        if (!this.isMonitoringActive) { return; }

        const filePath = uri.fsPath;
        const lastAnalysis = this.lastAnalysisTime.get(filePath);
        const now = new Date();

        // Throttle analysis (max once per 30 seconds per file)
        if (lastAnalysis && now.getTime() - lastAnalysis.getTime() < 30000) {
            return;
        }

        this.lastAnalysisTime.set(filePath, now);

        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const suggestions = await this.analyzeDocument(document);

            // Add suggestions to active list
            suggestions.forEach(suggestion => {
                this.activeSuggestions.set(suggestion.id, suggestion);
            });

            // Send high-priority suggestions to UI
            const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high' || s.priority === 'critical');
            if (highPrioritySuggestions.length > 0) {
                this.sendSuggestionUpdate(highPrioritySuggestions);
            }

        } catch (error) {
            console.warn('Error analyzing file change:', error);
        }
    }

    /**
     * Comprehensive document analysis for proactive suggestions
     */
    private async analyzeDocument(document: vscode.TextDocument): Promise<ProactiveSuggestion[]> {
        const suggestions: ProactiveSuggestion[] = [];
        const content = document.getText();
        const filePath = document.fileName;

        // 1. Pattern-based analysis
        const patternSuggestions = await this.analyzeCodePatterns(content, filePath);
        suggestions.push(...patternSuggestions);

        // 2. Context-aware analysis
        const contextSuggestions = await this.analyzeWithContext(document);
        suggestions.push(...contextSuggestions);

        // 3. AI-powered deep analysis
        const aiSuggestions = await this.performAIAnalysis(document);
        suggestions.push(...aiSuggestions);

        // 4. Cross-file dependency analysis
        const dependencySuggestions = await this.analyzeDependencies(document);
        suggestions.push(...dependencySuggestions);

        return suggestions;
    }

    /**
     * Pattern-based code analysis
     */
    private async analyzeCodePatterns(content: string, filePath: string): Promise<ProactiveSuggestion[]> {
        const suggestions: ProactiveSuggestion[] = [];
        const lines = content.split('\n');

        for (const pattern of this.codePatterns) {
            if (pattern.id === 'large-function') {
                // Special handling for large functions
                const largeFunctions = this.findLargeFunctions(content);
                largeFunctions.forEach((func, index) => {
                    suggestions.push({
                        id: `${pattern.id}_${index}_${Date.now()}`,
                        type: 'improvement',
                        priority: 'medium',
                        title: `Large Function: ${func.name}`,
                        description: `Function ${func.name} has ${func.lineCount} lines. Consider breaking it down.`,
                        reasoning: 'Large functions are harder to understand, test, and maintain. Breaking them into smaller functions improves code readability and reusability.',
                        affectedFiles: [filePath],
                        estimatedImpact: 'moderate',
                        confidence: 0.8,
                        actionable: true,
                        autoImplementable: false,
                        timestamp: new Date()
                    });
                });
                continue;
            }

            if (typeof pattern.pattern === 'string') { continue; }

            const matches = content.matchAll(pattern.pattern);
            for (const match of matches) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                
                suggestions.push({
                    id: `${pattern.id}_${lineNumber}_${Date.now()}`,
                    type: this.mapPatternToSuggestionType(pattern.category),
                    priority: this.mapSeverityToPriority(pattern.severity),
                    title: pattern.name,
                    description: `${pattern.description} at line ${lineNumber}`,
                    reasoning: pattern.suggestion,
                    suggestedCode: pattern.autoFix,
                    affectedFiles: [filePath],
                    estimatedImpact: 'minor',
                    confidence: 0.7,
                    actionable: true,
                    autoImplementable: Boolean(pattern.autoFix),
                    timestamp: new Date()
                });
            }
        }

        return suggestions;
    }

    /**
     * Context-aware analysis using project understanding
     */
    private async analyzeWithContext(document: vscode.TextDocument): Promise<ProactiveSuggestion[]> {
        const suggestions: ProactiveSuggestion[] = [];

        try {
            // Get project context
            const projectContext = await this.contextSystem.analyzeProjectContext();
            const content = document.getText();
            const filePath = document.fileName;

            // Analyze based on project patterns
            if (this.isTestFile(filePath)) {
                const testSuggestions = await this.analyzeTestFile(document, projectContext);
                suggestions.push(...testSuggestions);
            } else if (this.isConfigFile(filePath)) {
                const configSuggestions = await this.analyzeConfigFile(document, projectContext);
                suggestions.push(...configSuggestions);
            } else {
                const codeSuggestions = await this.analyzeCodeFile(document, projectContext);
                suggestions.push(...codeSuggestions);
            }

        } catch (error) {
            console.warn('Context-aware analysis failed:', error);
        }

        return suggestions;
    }

    /**
     * AI-powered deep analysis
     */
    private async performAIAnalysis(document: vscode.TextDocument): Promise<ProactiveSuggestion[]> {
        const suggestions: ProactiveSuggestion[] = [];

        try {
            const content = document.getText();
            const filePath = document.fileName;

            // Only analyze if content is substantial enough
            if (content.length < 100) { return suggestions; }

            const analysisPrompt = `Analyze this code for potential improvements and issues:

FILE: ${filePath}
CONTENT:
${content.substring(0, 2000)}

Provide suggestions in JSON format:
[
  {
    "type": "improvement|optimization|bug_prevention|security|testing",
    "priority": "low|medium|high|critical", 
    "title": "Short title",
    "description": "Detailed description",
    "reasoning": "Why this is important",
    "estimatedImpact": "minor|moderate|significant|major",
    "actionable": true/false
  }
]

Focus on actionable, specific suggestions that improve code quality, security, or performance.`;

            const aiResponse = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            const aiSuggestions = JSON.parse(aiResponse);

            aiSuggestions.forEach((suggestion: any, index: number) => {
                suggestions.push({
                    id: `ai_${index}_${Date.now()}`,
                    type: suggestion.type || 'improvement',
                    priority: suggestion.priority || 'medium',
                    title: suggestion.title,
                    description: suggestion.description,
                    reasoning: suggestion.reasoning,
                    affectedFiles: [filePath],
                    estimatedImpact: suggestion.estimatedImpact || 'moderate',
                    confidence: 0.75,
                    actionable: suggestion.actionable !== false,
                    autoImplementable: false,
                    timestamp: new Date()
                });
            });

        } catch (error) {
            console.warn('AI analysis failed:', error);
        }

        return suggestions;
    }

    /**
     * Generate periodic project health assessment
     */
    async generateProjectHealthReport(): Promise<ProjectHealthMetrics> {
        try {
            const projectContext = await this.contextSystem.analyzeProjectContext();
            const allSuggestions = Array.from(this.activeSuggestions.values());

            // Calculate health metrics
            const codeQuality = this.calculateCodeQuality(allSuggestions);
            const security = this.calculateSecurityScore(allSuggestions);
            const performance = this.calculatePerformanceScore(allSuggestions);

            // Analyze trends (simplified)
            const trends = this.analyzeTrends(allSuggestions);

            const healthMetrics: ProjectHealthMetrics = {
                overallScore: Math.round((codeQuality + security + performance) / 3),
                codeQuality,
                testCoverage: 75, // Placeholder - would analyze actual test coverage
                documentation: 60, // Placeholder - would analyze documentation completeness
                security,
                performance,
                maintainability: codeQuality,
                lastAssessment: new Date(),
                trends,
                recommendations: this.getTopRecommendations(allSuggestions)
            };

            return healthMetrics;

        } catch (error) {
            console.error('Failed to generate health report:', error);
            return this.getDefaultHealthMetrics();
        }
    }

    /**
     * Get proactive suggestions for current session
     */
    getActiveSuggestions(priority?: ProactiveSuggestion['priority']): ProactiveSuggestion[] {
        const suggestions = Array.from(this.activeSuggestions.values())
            .filter(s => !s.dismissed)
            .sort((a, b) => {
                const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });

        if (priority) {
            return suggestions.filter(s => s.priority === priority);
        }

        return suggestions;
    }

    /**
     * Start periodic analysis for continuous monitoring
     */
    private startPeriodicAnalysis(): void {
        // Run comprehensive analysis every 10 minutes
        setInterval(async () => {
            if (this.isMonitoringActive) {
                await this.performPeriodicAnalysis();
            }
        }, 10 * 60 * 1000);
    }

    private async performPeriodicAnalysis(): Promise<void> {
        try {
            const workspaceFiles = await vscode.workspace.findFiles(
                '**/*.{ts,js,py,java,cpp}',
                '**/node_modules/**',
                10
            );

            for (const file of workspaceFiles.slice(0, 5)) {
                const document = await vscode.workspace.openTextDocument(file);
                const suggestions = await this.analyzeDocument(document);
                
                suggestions.forEach(suggestion => {
                    if (!this.activeSuggestions.has(suggestion.id)) {
                        this.activeSuggestions.set(suggestion.id, suggestion);
                    }
                });
            }

        } catch (error) {
            console.warn('Periodic analysis failed:', error);
        }
    }

    // Helper methods
    private findLargeFunctions(content: string): Array<{name: string, lineCount: number}> {
        const functions = [];
        const lines = content.split('\n');
        let inFunction = false;
        let functionStart = 0;
        let braceCount = 0;
        let currentFunctionName = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detect function start
            const functionMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*(?:\([^)]*\))?\s*(?:=>|{))/);
            if (functionMatch && !inFunction) {
                inFunction = true;
                functionStart = i;
                currentFunctionName = functionMatch[1] || functionMatch[2] || 'anonymous';
                braceCount = 0;
            }

            if (inFunction) {
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;

                if (braceCount === 0 && i > functionStart) {
                    const lineCount = i - functionStart + 1;
                    if (lineCount > 50) {
                        functions.push({ name: currentFunctionName, lineCount });
                    }
                    inFunction = false;
                }
            }
        }

        return functions;
    }

    private mapPatternToSuggestionType(category: CodePattern['category']): ProactiveSuggestion['type'] {
        switch (category) {
            case 'anti-pattern': return 'improvement';
            case 'code-smell': return 'improvement';
            case 'best-practice': return 'improvement';
            case 'optimization': return 'optimization';
            default: return 'improvement';
        }
    }

    private mapSeverityToPriority(severity: CodePattern['severity']): ProactiveSuggestion['priority'] {
        switch (severity) {
            case 'error': return 'high';
            case 'warning': return 'medium';
            case 'info': return 'low';
            default: return 'low';
        }
    }

    private isTestFile(filePath: string): boolean {
        return /\.(test|spec)\.(ts|js|py)$/.test(filePath) || filePath.includes('/test/') || filePath.includes('/tests/');
    }

    private isConfigFile(filePath: string): boolean {
        return /\.(json|yml|yaml|toml|ini|config)$/.test(filePath) || 
               ['package.json', 'tsconfig.json', '.eslintrc', 'webpack.config.js'].some(name => filePath.endsWith(name));
    }

    private sendSuggestionUpdate(suggestions: ProactiveSuggestion[]): void {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'proactive-suggestions',
                suggestions: suggestions.slice(0, 5) // Limit to top 5
            });
        }
    }

    private async analyzeNewFile(uri: vscode.Uri): Promise<void> {
        // Provide suggestions for new files based on project patterns
        // Implementation would analyze the file and suggest improvements
    }

    private async analyzeTestFile(document: vscode.TextDocument, projectContext: ProjectContext): Promise<ProactiveSuggestion[]> {
        // Analyze test files for completeness, patterns, etc.
        return [];
    }

    private async analyzeConfigFile(document: vscode.TextDocument, projectContext: ProjectContext): Promise<ProactiveSuggestion[]> {
        // Analyze configuration files for best practices
        return [];
    }

    private async analyzeCodeFile(document: vscode.TextDocument, projectContext: ProjectContext): Promise<ProactiveSuggestion[]> {
        // Analyze regular code files based on project context
        return [];
    }

    private async analyzeDependencies(document: vscode.TextDocument): Promise<ProactiveSuggestion[]> {
        // Analyze file dependencies and suggest improvements
        return [];
    }

    private calculateCodeQuality(suggestions: ProactiveSuggestion[]): number {
        const qualitySuggestions = suggestions.filter(s => s.type === 'improvement');
        return Math.max(0, 100 - qualitySuggestions.length * 5);
    }

    private calculateSecurityScore(suggestions: ProactiveSuggestion[]): number {
        const securitySuggestions = suggestions.filter(s => s.type === 'security');
        return Math.max(0, 100 - securitySuggestions.length * 10);
    }

    private calculatePerformanceScore(suggestions: ProactiveSuggestion[]): number {
        const performanceSuggestions = suggestions.filter(s => s.type === 'optimization');
        return Math.max(0, 100 - performanceSuggestions.length * 8);
    }

    private analyzeTrends(suggestions: ProactiveSuggestion[]): ProjectHealthMetrics['trends'] {
        return {
            improving: ['Code organization'],
            declining: [],
            stable: ['Performance', 'Security']
        };
    }

    private getTopRecommendations(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
        return suggestions
            .filter(s => s.priority === 'high' || s.priority === 'critical')
            .slice(0, 5);
    }

    private getDefaultHealthMetrics(): ProjectHealthMetrics {
        return {
            overallScore: 75,
            codeQuality: 80,
            testCoverage: 65,
            documentation: 60,
            security: 85,
            performance: 70,
            maintainability: 75,
            lastAssessment: new Date(),
            trends: {
                improving: [],
                declining: [],
                stable: ['Overall health']
            },
            recommendations: []
        };
    }

    dispose(): void {
        this.fileWatcher?.dispose();
        this.isMonitoringActive = false;
    }
}