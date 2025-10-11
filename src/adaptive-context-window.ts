import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File relevance metrics for context selection
 */
export interface FileRelevance {
    filePath: string;
    relevanceScore: number;
    reasons: string[];
    lastModified: Date;
    size: number;
    language: string;
    dependencies: string[];
    usageFrequency: number;
    semanticSimilarity: number;
}

/**
 * Context window configuration
 */
export interface ContextConfig {
    maxTokens: number;
    maxFiles: number;
    priorityWeights: {
        recency: number;
        relevance: number;
        size: number;
        frequency: number;
        dependencies: number;
    };
    fileTypePreferences: { [key: string]: number };
    includePaths: string[];
    excludePaths: string[];
}

/**
 * Context analysis result
 */
export interface ContextAnalysis {
    selectedFiles: FileRelevance[];
    totalTokens: number;
    coverage: number;
    confidence: number;
    recommendations: string[];
    executionTime: number;
}

/**
 * File usage tracking
 */
interface FileUsage {
    filePath: string;
    accessCount: number;
    lastAccessed: Date;
    contexts: string[];
    successRate: number;
}

/**
 * Adaptive Context Window Manager
 * Automatically selects the most relevant project files to keep context efficient
 */
export class AdaptiveContextWindow {
    private fileUsage: Map<string, FileUsage> = new Map();
    private contextHistory: ContextAnalysis[] = [];
    private outputChannel: vscode.OutputChannel;
    private storageUri: vscode.Uri;
    private defaultConfig: ContextConfig;
    private workspaceAnalysis: Map<string, any> = new Map();

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Adaptive Context Window');
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'adaptive-context');
        
        this.defaultConfig = {
            maxTokens: 8000,
            maxFiles: 15,
            priorityWeights: {
                recency: 0.25,
                relevance: 0.35,
                size: 0.15,
                frequency: 0.15,
                dependencies: 0.10
            },
            fileTypePreferences: {
                '.ts': 1.0,
                '.js': 1.0,
                '.py': 1.0,
                '.java': 1.0,
                '.json': 0.8,
                '.md': 0.6,
                '.txt': 0.4,
                '.log': 0.2
            },
            includePaths: ['src/', 'lib/', 'components/', 'utils/'],
            excludePaths: ['node_modules/', 'dist/', 'build/', '.git/', 'coverage/']
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await this.loadPersistedData();
            await this.analyzeWorkspace();
            
            this.outputChannel.appendLine('Adaptive Context Window initialized');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Initialization error: ${errorMessage}`);
        }
    }

    /**
     * Select most relevant files for current context
     */
    async selectRelevantContext(
        query: string,
        currentFile?: string,
        config?: Partial<ContextConfig>
    ): Promise<ContextAnalysis> {
        const startTime = Date.now();
        const effectiveConfig = { ...this.defaultConfig, ...config };

        try {
            // Get all potential files
            const allFiles = await this.getAllProjectFiles();
            
            // Calculate relevance scores
            const fileRelevances = await Promise.all(
                allFiles.map(file => this.calculateFileRelevance(file, query, currentFile))
            );

            // Filter and sort by relevance
            const relevantFiles = fileRelevances
                .filter(file => file.relevanceScore > 0.1)
                .sort((a, b) => b.relevanceScore - a.relevanceScore);

            // Select optimal subset within token limits
            const selectedFiles = await this.selectOptimalSubset(relevantFiles, effectiveConfig);

            // Calculate analysis metrics
            const totalTokens = this.calculateTotalTokens(selectedFiles);
            const coverage = this.calculateCoverage(selectedFiles, allFiles.length);
            const confidence = this.calculateConfidence(selectedFiles, query);

            const analysis: ContextAnalysis = {
                selectedFiles,
                totalTokens,
                coverage,
                confidence,
                recommendations: this.generateRecommendations(selectedFiles, effectiveConfig),
                executionTime: Date.now() - startTime
            };

            // Update usage statistics
            this.updateUsageStatistics(selectedFiles, query);
            
            // Store in history
            this.contextHistory.push(analysis);

            // Persist data
            await this.persistData();

            this.outputChannel.appendLine(
                `Context selection completed: ${selectedFiles.length} files, ${totalTokens} tokens, ${Math.round(confidence * 100)}% confidence`
            );

            return analysis;

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`Context selection failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get all project files with filtering
     */
    private async getAllProjectFiles(): Promise<string[]> {
        const files: string[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return files;
        }

        for (const folder of workspaceFolders) {
            const folderFiles = await this.scanDirectory(folder.uri.fsPath);
            files.push(...folderFiles);
        }

        return this.filterFiles(files);
    }

    /**
     * Recursively scan directory for files
     */
    private async scanDirectory(dirPath: string): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Check if directory should be excluded
                    if (!this.shouldExcludeDirectory(entry.name)) {
                        const subFiles = await this.scanDirectory(fullPath);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Silently skip directories we can't read
        }

        return files;
    }

    /**
     * Filter files based on configuration
     */
    private filterFiles(files: string[]): string[] {
        return files.filter(file => {
            const relativePath = this.getRelativePath(file);
            
            // Check exclusions
            for (const excludePath of this.defaultConfig.excludePaths) {
                if (relativePath.includes(excludePath)) {
                    return false;
                }
            }

            // Check file extension
            const ext = path.extname(file);
            return this.defaultConfig.fileTypePreferences[ext] !== undefined;
        });
    }

    /**
     * Calculate relevance score for a file
     */
    private async calculateFileRelevance(
        filePath: string,
        query: string,
        currentFile?: string
    ): Promise<FileRelevance> {
        const reasons: string[] = [];
        let relevanceScore = 0;

        try {
            // Get file stats
            const stats = await fs.stat(filePath);
            const content = await this.getFileContent(filePath);
            const language = this.getLanguageFromPath(filePath);

            // Base score from file type preference
            const ext = path.extname(filePath);
            const typeScore = this.defaultConfig.fileTypePreferences[ext] || 0.5;
            relevanceScore += typeScore * 0.2;
            if (typeScore > 0.7) {
                reasons.push('preferred file type');
            }

            // Recency score
            const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            const recencyScore = Math.max(0, 1 - daysSinceModified / 30); // 30 days decay
            relevanceScore += recencyScore * this.defaultConfig.priorityWeights.recency;
            if (recencyScore > 0.7) {
                reasons.push('recently modified');
            }

            // Semantic similarity score
            const semanticScore = await this.calculateSemanticSimilarity(content, query);
            relevanceScore += semanticScore * this.defaultConfig.priorityWeights.relevance;
            if (semanticScore > 0.6) {
                reasons.push('semantically similar to query');
            }

            // Size score (prefer medium-sized files)
            const sizeScore = this.calculateSizeScore(content.length);
            relevanceScore += sizeScore * this.defaultConfig.priorityWeights.size;
            if (sizeScore > 0.7) {
                reasons.push('optimal size');
            }

            // Frequency score
            const usage = this.fileUsage.get(filePath);
            const frequencyScore = usage ? Math.min(1, usage.accessCount / 100) : 0;
            relevanceScore += frequencyScore * this.defaultConfig.priorityWeights.frequency;
            if (frequencyScore > 0.5) {
                reasons.push('frequently accessed');
            }

            // Dependency score
            const dependencies = await this.analyzeDependencies(filePath, content);
            const dependencyScore = this.calculateDependencyScore(dependencies, currentFile);
            relevanceScore += dependencyScore * this.defaultConfig.priorityWeights.dependencies;
            if (dependencyScore > 0.5) {
                reasons.push('has relevant dependencies');
            }

            // Current file boost
            if (currentFile && filePath === currentFile) {
                relevanceScore += 0.3;
                reasons.push('current file');
            }

            return {
                filePath,
                relevanceScore: Math.min(1, relevanceScore),
                reasons,
                lastModified: stats.mtime,
                size: stats.size,
                language,
                dependencies,
                usageFrequency: usage?.accessCount || 0,
                semanticSimilarity: semanticScore
            };

        } catch (error) {
            return {
                filePath,
                relevanceScore: 0,
                reasons: ['error reading file'],
                lastModified: new Date(0),
                size: 0,
                language: 'unknown',
                dependencies: [],
                usageFrequency: 0,
                semanticSimilarity: 0
            };
        }
    }

    /**
     * Calculate semantic similarity between content and query
     */
    private async calculateSemanticSimilarity(content: string, query: string): Promise<number> {
        // Simple keyword-based similarity (can be enhanced with embedding models)
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const contentWords = new Set(content.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...queryWords].filter(word => contentWords.has(word)));
        const union = new Set([...queryWords, ...contentWords]);
        
        const jaccardSimilarity = intersection.size / union.size;

        // Boost for exact phrase matches
        const phraseBoost = query.toLowerCase().split(' ').some(phrase => 
            content.toLowerCase().includes(phrase)
        ) ? 0.3 : 0;

        // Boost for code-specific matches
        const codeBoost = this.calculateCodeSpecificSimilarity(content, query);

        return Math.min(1, jaccardSimilarity + phraseBoost + codeBoost);
    }

    /**
     * Calculate code-specific similarity
     */
    private calculateCodeSpecificSimilarity(content: string, query: string): number {
        let boost = 0;

        // Function/method name matches
        const functionMatches = query.match(/\b\w+\(/g);
        if (functionMatches) {
            for (const match of functionMatches) {
                const funcName = match.replace('(', '');
                if (content.includes(funcName)) {
                    boost += 0.2;
                }
            }
        }

        // Class name matches
        const classMatches = query.match(/\bclass\s+(\w+)/gi);
        if (classMatches) {
            for (const match of classMatches) {
                const className = match.split(/\s+/)[1];
                if (content.includes(className)) {
                    boost += 0.2;
                }
            }
        }

        // Variable/property matches
        const propMatches = query.match(/\.\w+/g);
        if (propMatches) {
            for (const match of propMatches) {
                if (content.includes(match)) {
                    boost += 0.1;
                }
            }
        }

        return Math.min(0.5, boost);
    }

    /**
     * Calculate size score (prefer medium-sized files)
     */
    private calculateSizeScore(size: number): number {
        // Optimal size around 5KB, with penalty for very small or very large files
        const optimalSize = 5000;
        const ratio = size / optimalSize;
        
        if (ratio < 0.1) {
            return 0.3; // Very small files
        }
        if (ratio > 10) {
            return 0.2;  // Very large files
        }
        
        return 1 - Math.abs(1 - ratio) / 2;
    }

    /**
     * Analyze file dependencies
     */
    private async analyzeDependencies(filePath: string, content: string): Promise<string[]> {
        const dependencies: string[] = [];
        
        // Extract import statements
        const importRegexes = [
            /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,  // ES6 imports
            /require\(['"`]([^'"`]+)['"`]\)/g,              // CommonJS requires
            /from\s+['"`]([^'"`]+)['"`]/g,                  // Python imports
            /#include\s*[<"]([^>"]+)[>"]/g                  // C/C++ includes
        ];

        for (const regex of importRegexes) {
            let match;
            while ((match = regex.exec(content)) !== null) {
                dependencies.push(match[1]);
            }
        }

        return dependencies;
    }

    /**
     * Calculate dependency score based on relationships
     */
    private calculateDependencyScore(dependencies: string[], currentFile?: string): number {
        let score = 0;

        if (currentFile) {
            const currentFileName = path.basename(currentFile, path.extname(currentFile));
            
            // Boost if file is imported by current file or vice versa
            for (const dep of dependencies) {
                if (dep.includes(currentFileName) || currentFileName.includes(dep)) {
                    score += 0.3;
                }
            }
        }

        // Boost for common utility files
        const utilityPatterns = ['util', 'helper', 'common', 'shared', 'lib'];
        for (const pattern of utilityPatterns) {
            if (dependencies.some(dep => dep.includes(pattern))) {
                score += 0.1;
            }
        }

        return Math.min(1, score);
    }

    /**
     * Select optimal subset of files within token limits
     */
    private async selectOptimalSubset(
        relevantFiles: FileRelevance[],
        config: ContextConfig
    ): Promise<FileRelevance[]> {
        const selected: FileRelevance[] = [];
        let totalTokens = 0;

        // Start with highest relevance files
        const sortedFiles = [...relevantFiles].sort((a, b) => b.relevanceScore - a.relevanceScore);

        for (const file of sortedFiles) {
            if (selected.length >= config.maxFiles) {
                break;
            }

            const fileTokens = await this.estimateTokens(file.filePath);
            
            if (totalTokens + fileTokens <= config.maxTokens) {
                selected.push(file);
                totalTokens += fileTokens;
            } else if (selected.length < 3) {
                // Always include at least a few files, even if we exceed token limit slightly
                selected.push(file);
                totalTokens += fileTokens;
            }
        }

        return selected;
    }

    /**
     * Estimate token count for a file
     */
    private async estimateTokens(filePath: string): Promise<number> {
        try {
            const content = await this.getFileContent(filePath);
            // Rough estimation: 1 token ≈ 4 characters
            return Math.ceil(content.length / 4);
        } catch {
            return 0;
        }
    }

    /**
     * Calculate total tokens for selected files
     */
    private calculateTotalTokens(files: FileRelevance[]): number {
        return files.reduce((total, file) => total + Math.ceil(file.size / 4), 0);
    }

    /**
     * Calculate coverage percentage
     */
    private calculateCoverage(selectedFiles: FileRelevance[], totalFiles: number): number {
        return totalFiles > 0 ? Math.round((selectedFiles.length / totalFiles) * 100) : 0;
    }

    /**
     * Calculate confidence score
     */
    private calculateConfidence(files: FileRelevance[], query: string): number {
        if (files.length === 0) {
            return 0;
        }

        const avgRelevance = files.reduce((sum, file) => sum + file.relevanceScore, 0) / files.length;
        const topFileRelevance = Math.max(...files.map(f => f.relevanceScore));
        const coverageBonus = Math.min(0.2, files.length / 10);

        return Math.min(1, avgRelevance * 0.5 + topFileRelevance * 0.3 + coverageBonus);
    }

    /**
     * Generate recommendations for context improvement
     */
    private generateRecommendations(files: FileRelevance[], config: ContextConfig): string[] {
        const recommendations: string[] = [];

        // Check if we're using too many/few files
        if (files.length < 3) {
            recommendations.push('Consider including more related files for better context');
        } else if (files.length > config.maxFiles * 0.8) {
            recommendations.push('Context is near maximum file limit - consider refining query');
        }

        // Check token usage
        const totalTokens = this.calculateTotalTokens(files);
        if (totalTokens > config.maxTokens * 0.9) {
            recommendations.push('Context is near token limit - consider excluding large files');
        }

        // Check relevance distribution
        const avgRelevance = files.reduce((sum, f) => sum + f.relevanceScore, 0) / files.length;
        if (avgRelevance < 0.5) {
            recommendations.push('Low average relevance - consider refining search terms');
        }

        // Check file diversity
        const languages = new Set(files.map(f => f.language));
        if (languages.size === 1 && files.length > 5) {
            recommendations.push('Consider including files from different components/modules');
        }

        return recommendations;
    }

    /**
     * Update usage statistics for selected files
     */
    private updateUsageStatistics(files: FileRelevance[], query: string): void {
        const context = this.categorizeQuery(query);
        
        for (const file of files) {
            let usage = this.fileUsage.get(file.filePath);
            
            if (!usage) {
                usage = {
                    filePath: file.filePath,
                    accessCount: 0,
                    lastAccessed: new Date(),
                    contexts: [],
                    successRate: 0.5
                };
                this.fileUsage.set(file.filePath, usage);
            }
            
            usage.accessCount++;
            usage.lastAccessed = new Date();
            
            if (!usage.contexts.includes(context)) {
                usage.contexts.push(context);
            }
        }
    }

    /**
     * Categorize query for context tracking
     */
    private categorizeQuery(query: string): string {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('debug') || lowerQuery.includes('error')) {
            return 'debugging';
        }
        if (lowerQuery.includes('test')) {
            return 'testing';
        }
        if (lowerQuery.includes('optimize') || lowerQuery.includes('performance')) {
            return 'optimization';
        }
        if (lowerQuery.includes('document')) {
            return 'documentation';
        }
        if (lowerQuery.includes('refactor')) {
            return 'refactoring';
        }
        
        return 'general';
    }

    /**
     * Analyze workspace structure
     */
    private async analyzeWorkspace(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            const analysis = {
                totalFiles: 0,
                fileTypes: new Map<string, number>(),
                averageFileSize: 0,
                lastAnalyzed: new Date()
            };

            const files = await this.getAllProjectFiles();
            analysis.totalFiles = files.length;

            for (const file of files) {
                const ext = path.extname(file);
                analysis.fileTypes.set(ext, (analysis.fileTypes.get(ext) || 0) + 1);
            }

            this.workspaceAnalysis.set(folder.uri.fsPath, analysis);
        }
    }

    /**
     * Helper methods
     */
    private shouldExcludeDirectory(dirName: string): boolean {
        return this.defaultConfig.excludePaths.some(exclude => 
            dirName.includes(exclude.replace('/', ''))
        );
    }

    private getRelativePath(filePath: string): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return filePath;
        }

        for (const folder of workspaceFolders) {
            if (filePath.startsWith(folder.uri.fsPath)) {
                return path.relative(folder.uri.fsPath, filePath);
            }
        }

        return filePath;
    }

    private async getFileContent(filePath: string, maxSize: number = 50000): Promise<string> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content.length > maxSize ? content.substring(0, maxSize) + '...' : content;
        } catch {
            return '';
        }
    }

    private getLanguageFromPath(filePath: string): string {
        const ext = path.extname(filePath);
        const languageMap: { [key: string]: string } = {
            '.ts': 'typescript',
            '.js': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin'
        };
        
        return languageMap[ext] || 'text';
    }

    /**
     * Get analytics and insights
     */
    getAnalytics(): any {
        const totalContexts = this.contextHistory.length;
        const avgFiles = totalContexts > 0 
            ? this.contextHistory.reduce((sum, c) => sum + c.selectedFiles.length, 0) / totalContexts 
            : 0;
        const avgConfidence = totalContexts > 0
            ? this.contextHistory.reduce((sum, c) => sum + c.confidence, 0) / totalContexts
            : 0;
        const avgExecutionTime = totalContexts > 0
            ? this.contextHistory.reduce((sum, c) => sum + c.executionTime, 0) / totalContexts
            : 0;

        return {
            totalContextSelections: totalContexts,
            averageFilesSelected: Math.round(avgFiles * 10) / 10,
            averageConfidence: Math.round(avgConfidence * 100) / 100,
            averageExecutionTime: Math.round(avgExecutionTime),
            mostUsedFiles: this.getMostUsedFiles(),
            workspaceInsights: Object.fromEntries(this.workspaceAnalysis)
        };
    }

    private getMostUsedFiles(): Array<{ path: string; count: number }> {
        return Array.from(this.fileUsage.values())
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 10)
            .map(usage => ({ path: usage.filePath, count: usage.accessCount }));
    }

    /**
     * Persistence methods
     */
    private async loadPersistedData(): Promise<void> {
        try {
            const usageFile = vscode.Uri.joinPath(this.storageUri, 'file-usage.json');
            const historyFile = vscode.Uri.joinPath(this.storageUri, 'context-history.json');

            try {
                const usageData = await vscode.workspace.fs.readFile(usageFile);
                const usageArray = JSON.parse(Buffer.from(usageData).toString());
                this.fileUsage = new Map(usageArray.map((u: FileUsage) => [u.filePath, u]));
            } catch {}

            try {
                const historyData = await vscode.workspace.fs.readFile(historyFile);
                this.contextHistory = JSON.parse(Buffer.from(historyData).toString());
            } catch {}

        } catch (error) {
            this.outputChannel.appendLine(`Failed to load persisted data: ${(error as Error).message}`);
        }
    }

    private async persistData(): Promise<void> {
        try {
            const usageFile = vscode.Uri.joinPath(this.storageUri, 'file-usage.json');
            const historyFile = vscode.Uri.joinPath(this.storageUri, 'context-history.json');

            await vscode.workspace.fs.writeFile(
                usageFile,
                Buffer.from(JSON.stringify(Array.from(this.fileUsage.values()), null, 2))
            );

            // Keep only last 100 context entries
            const recentHistory = this.contextHistory.slice(-100);
            await vscode.workspace.fs.writeFile(
                historyFile,
                Buffer.from(JSON.stringify(recentHistory, null, 2))
            );

        } catch (error) {
            this.outputChannel.appendLine(`Failed to persist data: ${(error as Error).message}`);
        }
    }
}

// Export singleton instance
let contextWindowInstance: AdaptiveContextWindow | undefined;

export function getAdaptiveContextWindow(context: vscode.ExtensionContext): AdaptiveContextWindow {
    if (!contextWindowInstance) {
        contextWindowInstance = new AdaptiveContextWindow(context);
    }
    return contextWindowInstance;
}