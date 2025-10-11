import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';

/**
 * Advanced Project Knowledge Graph System
 * Creates and maintains a dynamic understanding of the entire codebase
 * with semantic relationships, dependencies, and contextual information
 */

export interface CodeEntity {
    id: string;
    name: string;
    type: 'function' | 'class' | 'interface' | 'variable' | 'module' | 'component';
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    signature?: string;
    purpose?: string;
    complexity: 'low' | 'medium' | 'high';
    dependencies: string[];
    dependents: string[];
    tags: string[];
    lastModified: Date;
}

export interface ModuleInfo {
    filePath: string;
    exports: CodeEntity[];
    imports: string[];
    purpose: string;
    category: 'core' | 'utility' | 'component' | 'test' | 'config';
    complexity: number;
    maintainability: number;
    relationships: string[];
}

export interface ProjectKnowledgeGraph {
    entities: Map<string, CodeEntity>;
    modules: Map<string, ModuleInfo>;
    dependencies: Map<string, string[]>;
    patterns: Map<string, string[]>;
    conventions: {
        namingStyle: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';
        indentation: number;
        quotes: 'single' | 'double';
        semicolons: boolean;
        asyncPattern: 'promise' | 'async-await' | 'callback';
    };
    architecture: {
        type: 'mvc' | 'mvvm' | 'component' | 'layered' | 'microservices' | 'monolithic';
        layers: string[];
        entryPoints: string[];
        dataFlow: 'unidirectional' | 'bidirectional' | 'mixed';
    };
    testStrategy: {
        framework: string;
        coverage: number;
        testTypes: string[];
        testPatterns: string[];
    };
    lastUpdated: Date;
}

export class ProjectKnowledgeSystem {
    private static instance: ProjectKnowledgeSystem;
    private knowledgeGraph: ProjectKnowledgeGraph | null = null;
    private analysisCache: Map<string, any> = new Map();
    private fileWatcher?: vscode.FileSystemWatcher;
    private isAnalyzing = false;

    constructor() {
        this.initializeFileWatcher();
    }

    static getInstance(): ProjectKnowledgeSystem {
        if (!this.instance) {
            this.instance = new ProjectKnowledgeSystem();
        }
        return this.instance;
    }

    /**
     * Build comprehensive project knowledge graph
     */
    async buildKnowledgeGraph(): Promise<ProjectKnowledgeGraph> {
        if (this.isAnalyzing) {
            return this.knowledgeGraph || this.getEmptyGraph();
        }

        this.isAnalyzing = true;
        console.log('🧠 Building project knowledge graph...');

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder open');
            }

            // Initialize knowledge graph structure
            const knowledgeGraph: ProjectKnowledgeGraph = {
                entities: new Map(),
                modules: new Map(),
                dependencies: new Map(),
                patterns: new Map(),
                conventions: await this.analyzeCodeConventions(),
                architecture: await this.analyzeArchitecture(),
                testStrategy: await this.analyzeTestStrategy(),
                lastUpdated: new Date()
            };

            // Get all relevant files
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,jsx,tsx,py,java,cpp,cs,php,go,rs,vue}',
                '**/node_modules/**',
                500
            );

            console.log(`📁 Analyzing ${files.length} files...`);

            // Process files in batches to avoid overwhelming the system
            const batchSize = 10;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await Promise.all(batch.map(file => this.analyzeFile(file, knowledgeGraph)));
                
                // Update progress
                const progress = Math.round(((i + batch.length) / files.length) * 100);
                console.log(`📊 Analysis progress: ${progress}%`);
            }

            // Build relationships and dependencies
            await this.buildDependencyGraph(knowledgeGraph);
            await this.identifyPatterns(knowledgeGraph);
            await this.enrichWithAIInsights(knowledgeGraph);

            this.knowledgeGraph = knowledgeGraph;
            console.log('✅ Project knowledge graph built successfully');

            return knowledgeGraph;

        } catch (error) {
            console.error('❌ Failed to build knowledge graph:', error);
            return this.getEmptyGraph();
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Analyze individual file and extract code entities
     */
    private async analyzeFile(uri: vscode.Uri, graph: ProjectKnowledgeGraph): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            const filePath = vscode.workspace.asRelativePath(uri);

            // Extract code entities based on language
            const entities = await this.extractCodeEntities(content, filePath, document.languageId);
            
            // Add entities to graph
            entities.forEach(entity => {
                graph.entities.set(entity.id, entity);
            });

            // Analyze module information
            const moduleInfo = await this.analyzeModule(content, filePath, document.languageId);
            graph.modules.set(filePath, moduleInfo);

            // Cache analysis results
            this.analysisCache.set(filePath, {
                entities,
                moduleInfo,
                lastAnalyzed: new Date()
            });

        } catch (error) {
            console.warn(`⚠️ Failed to analyze ${uri.fsPath}:`, error);
        }
    }

    /**
     * Extract code entities from file content using AST-like analysis
     */
    private async extractCodeEntities(content: string, filePath: string, languageId: string): Promise<CodeEntity[]> {
        const entities: CodeEntity[] = [];
        const lines = content.split('\n');

        // Language-specific patterns
        const patterns = this.getLanguagePatterns(languageId);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Function detection
            for (const pattern of patterns.functions) {
                const match = line.match(pattern.regex);
                if (match) {
                    const entity = await this.createFunctionEntity(
                        match, i, lines, filePath, pattern.type
                    );
                    if (entity) {entities.push(entity);}
                }
            }

            // Class detection
            for (const pattern of patterns.classes) {
                const match = line.match(pattern.regex);
                if (match) {
                    const entity = await this.createClassEntity(
                        match, i, lines, filePath
                    );
                    if (entity) { entities.push(entity); }
                }
            }

            // Interface detection (for TypeScript)
            if (languageId === 'typescript' || languageId === 'javascript') {
                const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
                if (interfaceMatch) {
                    const entity = await this.createInterfaceEntity(
                        interfaceMatch, i, lines, filePath
                    );
                    if (entity) { entities.push(entity); }
                }
            }
        }

        return entities;
    }

    /**
     * Create function entity with AI-enhanced purpose analysis
     */
    private async createFunctionEntity(
        match: RegExpMatchArray, 
        lineIndex: number, 
        lines: string[], 
        filePath: string,
        type: string
    ): Promise<CodeEntity | null> {
        try {
            const functionName = match[1] || match[2] || 'anonymous';
            const signature = lines[lineIndex].trim();
            
            // Find function body end
            let endLine = lineIndex;
            let braceCount = 0;
            let started = false;
            
            for (let i = lineIndex; i < lines.length; i++) {
                const line = lines[i];
                const openBraces = (line.match(/{/g) || []).length;
                const closeBraces = (line.match(/}/g) || []).length;
                
                braceCount += openBraces - closeBraces;
                
                if (openBraces > 0) { started = true; }
                if (started && braceCount === 0) {
                    endLine = i;
                    break;
                }
            }

            const functionContent = lines.slice(lineIndex, endLine + 1).join('\n');
            
            // AI-powered purpose analysis
            const purpose = await this.analyzeFunctionPurpose(functionName, functionContent);
            
            // Calculate complexity
            const complexity = this.calculateComplexity(functionContent);

            const entity: CodeEntity = {
                id: `${filePath}:${functionName}:${lineIndex}`,
                name: functionName,
                type: 'function',
                filePath,
                startLine: lineIndex + 1,
                endLine: endLine + 1,
                content: functionContent,
                signature,
                purpose,
                complexity,
                dependencies: this.extractDependencies(functionContent),
                dependents: [],
                tags: this.generateTags(functionName, functionContent, purpose),
                lastModified: new Date()
            };

            return entity;

        } catch (error) {
            console.warn('Error creating function entity:', error);
            return null;
        }
    }

    /**
     * AI-powered function purpose analysis
     */
    private async analyzeFunctionPurpose(name: string, content: string): Promise<string> {
        try {
            const analysisPrompt = `Analyze this function and provide a concise purpose description:

Function Name: ${name}
Content Preview: ${content.substring(0, 500)}

Provide a single sentence describing what this function does, its main purpose, and any notable patterns or responsibilities.`;

            const purpose = await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
            return purpose.split('\n')[0].substring(0, 200); // First line, max 200 chars
            
        } catch (error) {
            // Fallback to heuristic analysis
            return this.heuristicPurposeAnalysis(name, content);
        }
    }

    /**
     * Heuristic purpose analysis fallback
     */
    private heuristicPurposeAnalysis(name: string, content: string): string {
        // Analyze function name patterns
        if (name.startsWith('get')) { return `Retrieves ${name.substring(3).toLowerCase()} data or information`; }
        if (name.startsWith('set')) { return `Sets or updates ${name.substring(3).toLowerCase()} value`; }
        if (name.startsWith('is') || name.startsWith('has')) { return `Checks or validates ${name.substring(2).toLowerCase()} condition`; }
        if (name.startsWith('create')) { return `Creates new ${name.substring(6).toLowerCase()} instance or object`; }
        if (name.startsWith('delete') || name.startsWith('remove')) { return `Removes or deletes ${name.substring(6).toLowerCase()} data`; }
        if (name.startsWith('update')) { return `Updates existing ${name.substring(6).toLowerCase()} information`; }
        if (name.startsWith('validate')) { return `Validates ${name.substring(8).toLowerCase()} input or data`; }
        if (name.startsWith('process')) { return `Processes ${name.substring(7).toLowerCase()} data or operations`; }
        if (name.includes('handler') || name.includes('Handle')) { return `Handles events or user interactions`; }
        if (name.includes('util') || name.includes('helper')) { return `Utility function providing helper functionality`; }
        
        // Analyze content patterns
        if (content.includes('return')) { return `Function that returns computed or retrieved data`; }
        if (content.includes('console.log')) { return `Function that includes logging or debugging functionality`; }
        if (content.includes('async') || content.includes('await')) { return `Asynchronous function handling concurrent operations`; }
        if (content.includes('try') && content.includes('catch')) { return `Function with error handling and exception management`; }
        
        return `${name} function performing specific operations within the application`;
    }

    /**
     * Calculate code complexity score
     */
    private calculateComplexity(content: string): 'low' | 'medium' | 'high' {
        const lines = content.split('\n').length;
        const cyclomaticIndicators = (content.match(/if|for|while|switch|catch|\?|&&|\|\|/g) || []).length;
        const nestingLevel = this.calculateNesting(content);
        
        const score = lines * 0.1 + cyclomaticIndicators * 2 + nestingLevel * 3;
        
        if (score < 10) { return 'low'; }
        if (score < 25) { return 'medium'; }
        return 'high';
    }

    /**
     * Calculate nesting level
     */
    private calculateNesting(content: string): number {
        let maxNesting = 0;
        let currentNesting = 0;
        
        for (const char of content) {
            if (char === '{') {
                currentNesting++;
                maxNesting = Math.max(maxNesting, currentNesting);
            } else if (char === '}') {
                currentNesting--;
            }
        }
        
        return maxNesting;
    }

    /**
     * Extract dependencies from code content
     */
    private extractDependencies(content: string): string[] {
        const dependencies = new Set<string>();
        
        // Import statements
        const imports = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        imports?.forEach(imp => {
            const match = imp.match(/from\s+['"]([^'"]+)['"]/);
            if (match) {dependencies.add(match[1]);}
        });
        
        // Require statements
        const requires = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
        requires?.forEach(req => {
            const match = req.match(/['"]([^'"]+)['"]/);
            if (match) {dependencies.add(match[1]);}
        });
        
        // Function calls (simplified detection)
        const functionCalls = content.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
        functionCalls?.forEach(call => {
            const name = call.replace('(', '').trim();
            if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
                dependencies.add(name);
            }
        });
        
        return Array.from(dependencies);
    }

    /**
     * Generate semantic tags for code entities
     */
    private generateTags(name: string, content: string, purpose: string): string[] {
        const tags = new Set<string>();
        
        // Name-based tags
        if (name.includes('test') || name.includes('Test')) {tags.add('testing');}
        if (name.includes('util') || name.includes('helper')) {tags.add('utility');}
        if (name.includes('handler') || name.includes('Handle')) {tags.add('event-handling');}
        if (name.includes('api') || name.includes('Api')) {tags.add('api');}
        if (name.includes('db') || name.includes('database')) {tags.add('database');}
        
        // Content-based tags
        if (content.includes('async') || content.includes('await')) {tags.add('async');}
        if (content.includes('Promise')) {tags.add('promise');}
        if (content.includes('fetch') || content.includes('axios')) {tags.add('http-request');}
        if (content.includes('localStorage') || content.includes('sessionStorage')) {tags.add('storage');}
        if (content.includes('addEventListener') || content.includes('onClick')) {tags.add('event-listener');}
        if (content.includes('useState') || content.includes('useEffect')) {tags.add('react-hook');}
        if (content.includes('export')) {tags.add('exported');}
        if (content.includes('private') || content.includes('#')) {tags.add('private');}
        
        // Purpose-based tags
        if (purpose.includes('validate')) {tags.add('validation');}
        if (purpose.includes('transform') || purpose.includes('convert')) {tags.add('transformation');}
        if (purpose.includes('render') || purpose.includes('display')) {tags.add('rendering');}
        if (purpose.includes('calculate') || purpose.includes('compute')) {tags.add('computation');}
        
        return Array.from(tags);
    }

    /**
     * Get language-specific parsing patterns
     */
    private getLanguagePatterns(languageId: string) {
        const patterns = {
            typescript: {
                functions: [
                    { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
                    { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/, type: 'arrow-function' },
                    { regex: /(\w+)\s*:\s*(?:async\s+)?\(.*?\)\s*=>/, type: 'method' }
                ],
                classes: [
                    { regex: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/ }
                ]
            },
            javascript: {
                functions: [
                    { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
                    { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/, type: 'arrow-function' }
                ],
                classes: [
                    { regex: /(?:export\s+)?class\s+(\w+)/ }
                ]
            },
            python: {
                functions: [
                    { regex: /def\s+(\w+)\s*\(/, type: 'function' },
                    { regex: /async\s+def\s+(\w+)\s*\(/, type: 'async-function' }
                ],
                classes: [
                    { regex: /class\s+(\w+)/ }
                ]
            }
        };

        return patterns[languageId as keyof typeof patterns] || patterns.typescript;
    }

    /**
     * Analyze code conventions across the project
     */
    private async analyzeCodeConventions(): Promise<ProjectKnowledgeGraph['conventions']> {
        const files = await vscode.workspace.findFiles('**/*.{ts,js,jsx,tsx}', '**/node_modules/**', 20);
        let totalLines = 0;
        let camelCaseCount = 0;
        let singleQuoteCount = 0;
        let doubleQuoteCount = 0;
        let semicolonCount = 0;
        let noSemicolonCount = 0;
        let indentationSpaces = 0;
        let asyncAwaitCount = 0;
        let promiseCount = 0;

        for (const file of files.slice(0, 10)) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();
                const lines = content.split('\n');
                totalLines += lines.length;

                // Analyze naming conventions
                const variables = content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
                variables?.forEach(v => {
                    const name = v.split(/\s+/)[1];
                    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {camelCaseCount++;}
                });

                // Analyze quote usage
                singleQuoteCount += (content.match(/'/g) || []).length;
                doubleQuoteCount += (content.match(/"/g) || []).length;

                // Analyze semicolon usage
                const codeLines = lines.filter(line => line.trim() && !line.trim().startsWith('//'));
                codeLines.forEach(line => {
                    if (line.trim().endsWith(';')) {semicolonCount++;}
                    else if (line.trim().match(/[;}]$/)) {semicolonCount++;}
                    else if (line.trim().match(/[^{}\s]$/)) {noSemicolonCount++;}
                });

                // Analyze indentation
                const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\t'));
                if (indentedLines.length > 0) {
                    const spaceIndents = indentedLines.filter(line => line.startsWith('  '));
                    indentationSpaces += spaceIndents.length > 0 ? 2 : 4;
                }

                // Analyze async patterns
                asyncAwaitCount += (content.match(/async|await/g) || []).length;
                promiseCount += (content.match(/\.then\s*\(|new Promise/g) || []).length;

            } catch (error) {
                console.warn(`Error analyzing conventions in ${file.fsPath}:`, error);
            }
        }

        return {
            namingStyle: camelCaseCount > 0 ? 'camelCase' : 'snake_case',
            indentation: indentationSpaces > 0 ? Math.round(indentationSpaces / 10) : 2,
            quotes: singleQuoteCount > doubleQuoteCount ? 'single' : 'double',
            semicolons: semicolonCount > noSemicolonCount,
            asyncPattern: asyncAwaitCount > promiseCount ? 'async-await' : 'promise'
        };
    }

    /**
     * Analyze project architecture
     */
    private async analyzeArchitecture(): Promise<ProjectKnowledgeGraph['architecture']> {
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);
        const fileNames = files.map(f => vscode.workspace.asRelativePath(f));
        
        // Detect architecture patterns
        const hasControllers = fileNames.some(f => f.includes('controller'));
        const hasModels = fileNames.some(f => f.includes('model'));
        const hasViews = fileNames.some(f => f.includes('view') || f.includes('component'));
        const hasServices = fileNames.some(f => f.includes('service'));
        const hasRoutes = fileNames.some(f => f.includes('route'));

        let architectureType: ProjectKnowledgeGraph['architecture']['type'] = 'monolithic';
        const layers: string[] = [];

        if (hasControllers && hasModels && hasViews) {
            architectureType = 'mvc';
            layers.push('model', 'view', 'controller');
        } else if (hasViews && !hasControllers) {
            architectureType = 'component';
            layers.push('components', 'services', 'utilities');
        } else if (hasServices && hasRoutes) {
            architectureType = 'layered';
            layers.push('routes', 'services', 'data');
        }

        // Find entry points
        const entryPoints = fileNames.filter(f => 
            f.includes('main') || f.includes('index') || f.includes('app') || f.includes('server')
        );

        return {
            type: architectureType,
            layers,
            entryPoints,
            dataFlow: 'unidirectional' // Default, could be enhanced with more analysis
        };
    }

    /**
     * Analyze test strategy
     */
    private async analyzeTestStrategy(): Promise<ProjectKnowledgeGraph['testStrategy']> {
        const testFiles = await vscode.workspace.findFiles('**/*.{test,spec}.{ts,js,jsx,tsx}', '**/node_modules/**', 50);
        const allFiles = await vscode.workspace.findFiles('**/*.{ts,js,jsx,tsx}', '**/node_modules/**', 200);
        
        let framework = 'none';
        const testTypes: string[] = [];
        const testPatterns: string[] = [];

        if (testFiles.length > 0) {
            // Analyze first few test files to detect framework
            for (const file of testFiles.slice(0, 5)) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const content = document.getText();

                    if (content.includes('describe') && content.includes('it')) {
                        framework = content.includes('jest') ? 'jest' : 'mocha';
                    } else if (content.includes('test(')) {
                        framework = 'jest';
                    } else if (content.includes('assert')) {
                        framework = 'node-assert';
                    }

                    // Detect test types
                    if (content.includes('integration') || file.fsPath.includes('integration')) {
                        testTypes.push('integration');
                    }
                    if (content.includes('e2e') || file.fsPath.includes('e2e')) {
                        testTypes.push('e2e');
                    }
                    if (!testTypes.includes('unit')) {
                        testTypes.push('unit');
                    }

                } catch (error) {
                    console.warn(`Error analyzing test file ${file.fsPath}:`, error);
                }
            }
        }

        const coverage = Math.min(100, (testFiles.length / Math.max(allFiles.length, 1)) * 100);

        return {
            framework,
            coverage: Math.round(coverage),
            testTypes,
            testPatterns
        };
    }

    /**
     * Build dependency relationships between entities
     */
    private async buildDependencyGraph(graph: ProjectKnowledgeGraph): Promise<void> {
        console.log('🔗 Building dependency relationships...');

        for (const [entityId, entity] of graph.entities) {
            // Find dependents (entities that depend on this one)
            for (const [otherId, otherEntity] of graph.entities) {
                if (otherId !== entityId) {
                    // Check if otherEntity depends on entity
                    if (otherEntity.dependencies.includes(entity.name) ||
                        otherEntity.content.includes(entity.name)) {
                        entity.dependents.push(otherId);
                    }
                }
            }

            // Update dependencies map
            if (entity.dependencies.length > 0) {
                graph.dependencies.set(entityId, entity.dependencies);
            }
        }
    }

    /**
     * Identify common patterns across the codebase
     */
    private async identifyPatterns(graph: ProjectKnowledgeGraph): Promise<void> {
        console.log('🔍 Identifying code patterns...');

        const patterns = new Map<string, string[]>();

        // Analyze naming patterns
        const functionNames: string[] = [];
        const classNames: string[] = [];
        
        for (const entity of graph.entities.values()) {
            if (entity.type === 'function') {
                functionNames.push(entity.name);
            } else if (entity.type === 'class') {
                classNames.push(entity.name);
            }
        }

        // Group by common prefixes/suffixes
        const functionPrefixes = this.extractCommonPrefixes(functionNames);
        const classSuffixes = this.extractCommonSuffixes(classNames);

        if (functionPrefixes.length > 0) {
            patterns.set('function_prefixes', functionPrefixes);
        }
        if (classSuffixes.length > 0) {
            patterns.set('class_suffixes', classSuffixes);
        }

        // Analyze architectural patterns
        const hasFactoryPattern = Array.from(graph.entities.values())
            .some(e => e.name.toLowerCase().includes('factory'));
        const hasSingletonPattern = Array.from(graph.entities.values())
            .some(e => e.content.includes('getInstance'));
        const hasObserverPattern = Array.from(graph.entities.values())
            .some(e => e.content.includes('addEventListener') || e.content.includes('subscribe'));

        const architecturalPatterns: string[] = [];
        if (hasFactoryPattern) {architecturalPatterns.push('Factory');}
        if (hasSingletonPattern) {architecturalPatterns.push('Singleton');}
        if (hasObserverPattern) {architecturalPatterns.push('Observer');}

        if (architecturalPatterns.length > 0) {
            patterns.set('architectural_patterns', architecturalPatterns);
        }

        graph.patterns = patterns;
    }

    /**
     * Enrich knowledge graph with AI insights
     */
    private async enrichWithAIInsights(graph: ProjectKnowledgeGraph): Promise<void> {
        console.log('🤖 Enriching with AI insights...');

        try {
            // Generate project summary for AI analysis
            const projectSummary = this.generateProjectSummary(graph);
            
            const insightPrompt = `Analyze this project structure and provide insights:

${projectSummary}

Provide insights about:
1. Overall code quality and maintainability
2. Potential improvements or refactoring opportunities  
3. Architecture strengths and weaknesses
4. Missing patterns or best practices
5. Suggested next steps for development

Format as JSON: {"insights": ["insight1", "insight2", ...]}`;

            const response = await generateCode(insightPrompt, 'llama-3.3-70b-versatile');
            const aiInsights = JSON.parse(response);
            
            // Store insights as patterns
            if (aiInsights.insights && Array.isArray(aiInsights.insights)) {
                graph.patterns.set('ai_insights', aiInsights.insights);
            }

        } catch (error) {
            console.warn('Failed to generate AI insights:', error);
        }
    }

    /**
     * Generate project summary for AI analysis
     */
    private generateProjectSummary(graph: ProjectKnowledgeGraph): string {
        const entityCount = graph.entities.size;
        const moduleCount = graph.modules.size;
        const functionCount = Array.from(graph.entities.values()).filter(e => e.type === 'function').length;
        const classCount = Array.from(graph.entities.values()).filter(e => e.type === 'class').length;

        return `Project Analysis Summary:
- Total entities: ${entityCount}
- Modules: ${moduleCount}
- Functions: ${functionCount}
- Classes: ${classCount}
- Architecture: ${graph.architecture.type}
- Test framework: ${graph.testStrategy.framework}
- Test coverage: ${graph.testStrategy.coverage}%
- Code conventions: ${JSON.stringify(graph.conventions)}
- Key patterns: ${Array.from(graph.patterns.keys()).join(', ')}`;
    }

    // Helper methods
    private extractCommonPrefixes(names: string[]): string[] {
        const prefixes = new Map<string, number>();
        
        names.forEach(name => {
            for (let i = 2; i <= Math.min(name.length, 8); i++) {
                const prefix = name.substring(0, i);
                prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
            }
        });

        return Array.from(prefixes.entries())
            .filter(([prefix, count]) => count >= 3 && prefix.length >= 3)
            .map(([prefix]) => prefix);
    }

    private extractCommonSuffixes(names: string[]): string[] {
        const suffixes = new Map<string, number>();
        
        names.forEach(name => {
            for (let i = 2; i <= Math.min(name.length, 8); i++) {
                const suffix = name.substring(name.length - i);
                suffixes.set(suffix, (suffixes.get(suffix) || 0) + 1);
            }
        });

        return Array.from(suffixes.entries())
            .filter(([suffix, count]) => count >= 3 && suffix.length >= 3)
            .map(([suffix]) => suffix);
    }

    private async createClassEntity(
        match: RegExpMatchArray,
        lineIndex: number,
        lines: string[],
        filePath: string
    ): Promise<CodeEntity | null> {
        // Similar implementation to createFunctionEntity but for classes
        const className = match[1];
        // Implementation details...
        return null; // Placeholder
    }

    private async createInterfaceEntity(
        match: RegExpMatchArray,
        lineIndex: number,
        lines: string[],
        filePath: string
    ): Promise<CodeEntity | null> {
        // Similar implementation for interfaces
        const interfaceName = match[1];
        // Implementation details...
        return null; // Placeholder
    }

    private async analyzeModule(content: string, filePath: string, languageId: string): Promise<ModuleInfo> {
        // Analyze module exports, imports, and purpose
        const exports: CodeEntity[] = [];
        const imports: string[] = [];
        
        // Extract imports
        const importMatches = content.match(/import.*?from\s+['"]([^'"]+)['"]/g);
        importMatches?.forEach(imp => {
            const match = imp.match(/from\s+['"]([^'"]+)['"]/);
            if (match) {imports.push(match[1]);}
        });

        return {
            filePath,
            exports,
            imports,
            purpose: 'Module providing functionality', // Placeholder
            category: 'core',
            complexity: 0,
            maintainability: 0,
            relationships: []
        };
    }

    private initializeFileWatcher(): void {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,jsx,tsx,py,java,cpp}');
        
        this.fileWatcher.onDidChange(() => {
            // Invalidate cache and trigger incremental update
            this.analysisCache.clear();
        });

        this.fileWatcher.onDidCreate(() => {
            // Add new file to analysis
            this.analysisCache.clear();
        });

        this.fileWatcher.onDidDelete(() => {
            // Remove file from knowledge graph
            this.analysisCache.clear();
        });
    }

    private getEmptyGraph(): ProjectKnowledgeGraph {
        return {
            entities: new Map(),
            modules: new Map(),
            dependencies: new Map(),
            patterns: new Map(),
            conventions: {
                namingStyle: 'camelCase',
                indentation: 2,
                quotes: 'single',
                semicolons: true,
                asyncPattern: 'async-await'
            },
            architecture: {
                type: 'monolithic',
                layers: [],
                entryPoints: [],
                dataFlow: 'unidirectional'
            },
            testStrategy: {
                framework: 'none',
                coverage: 0,
                testTypes: [],
                testPatterns: []
            },
            lastUpdated: new Date()
        };
    }

    /**
     * Query the knowledge graph with semantic search
     */
    async queryKnowledge(query: string, maxResults: number = 10): Promise<CodeEntity[]> {
        if (!this.knowledgeGraph) {
            await this.buildKnowledgeGraph();
        }

        const results: Array<{ entity: CodeEntity; score: number }> = [];
        
        for (const entity of this.knowledgeGraph!.entities.values()) {
            const score = this.calculateRelevanceScore(entity, query);
            if (score > 0.1) {
                results.push({ entity, score });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(r => r.entity);
    }

    private calculateRelevanceScore(entity: CodeEntity, query: string): number {
        const queryLower = query.toLowerCase();
        let score = 0;

        // Name matching
        if (entity.name.toLowerCase().includes(queryLower)) {score += 0.8;}
        
        // Purpose matching
        if (entity.purpose?.toLowerCase().includes(queryLower)) {score += 0.6;}
        
        // Content matching
        if (entity.content.toLowerCase().includes(queryLower)) {score += 0.4;}
        
        // Tag matching
        if (entity.tags.some(tag => tag.toLowerCase().includes(queryLower))) {score += 0.3;}

        return Math.min(score, 1.0);
    }

    /**
     * Get knowledge graph summary
     */
    getKnowledgeSummary(): string {
        if (!this.knowledgeGraph) {
            return 'Knowledge graph not built yet. Use buildKnowledgeGraph() first.';
        }

        const graph = this.knowledgeGraph;
        
        return `📊 **Project Knowledge Graph Summary**

**Entities**: ${graph.entities.size} total
- Functions: ${Array.from(graph.entities.values()).filter(e => e.type === 'function').length}
- Classes: ${Array.from(graph.entities.values()).filter(e => e.type === 'class').length}
- Interfaces: ${Array.from(graph.entities.values()).filter(e => e.type === 'interface').length}

**Modules**: ${graph.modules.size}

**Architecture**: ${graph.architecture.type}
**Test Coverage**: ${graph.testStrategy.coverage}%

**Code Conventions**:
- Naming: ${graph.conventions.namingStyle}
- Quotes: ${graph.conventions.quotes}
- Semicolons: ${graph.conventions.semicolons ? 'Yes' : 'No'}
- Async Pattern: ${graph.conventions.asyncPattern}

**Patterns Found**: ${Array.from(graph.patterns.keys()).join(', ')}

*Last Updated*: ${graph.lastUpdated.toLocaleString()}`;
    }

    // Enhanced method for sidebar compatibility
    public async analyzeProject(): Promise<any> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        try {
            // Get file statistics
            const files = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
            const codeFiles = files.filter(([name]) => 
                /\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|cs|swift|kt)$/.test(name)
            );

            // Detect languages
            const languages = new Set<string>();
            for (const [fileName] of codeFiles) {
                const ext = path.extname(fileName).slice(1);
                const langMap: Record<string, string> = {
                    'js': 'JavaScript',
                    'ts': 'TypeScript',
                    'jsx': 'React',
                    'tsx': 'React TypeScript',
                    'py': 'Python',
                    'java': 'Java',
                    'go': 'Go',
                    'rs': 'Rust',
                    'php': 'PHP',
                    'rb': 'Ruby',
                    'cpp': 'C++',
                    'c': 'C',
                    'cs': 'C#',
                    'swift': 'Swift',
                    'kt': 'Kotlin'
                };
                if (langMap[ext]) {
                    languages.add(langMap[ext]);
                }
            }

            // Calculate complexity (basic heuristic)
            let complexityScore = 0;
            if (files.length > 50) {
                complexityScore += 3;
            } else if (files.length > 20) {
                complexityScore += 2;
            } else {
                complexityScore += 1;
            }

            if (languages.size > 3) {
                complexityScore += 2;
            } else if (languages.size > 1) {
                complexityScore += 1;
            }

            // Check for framework indicators
            const packageJsonPath = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
            try {
                const packageContent = await vscode.workspace.fs.readFile(packageJsonPath);
                const packageObj = JSON.parse(packageContent.toString());
                if (packageObj.dependencies) {
                    const deps = Object.keys(packageObj.dependencies);
                    if (deps.some(dep => ['react', 'vue', 'angular'].includes(dep))) {
                        complexityScore += 2;
                    }
                    if (deps.some(dep => ['express', 'fastapi', 'django'].includes(dep))) {
                        complexityScore += 2;
                    }
                }
            } catch (error) {
                // No package.json or couldn't read it
            }

            return {
                totalFiles: files.length,
                codeFiles: codeFiles.length,
                languages: Array.from(languages),
                complexityScore: Math.min(complexityScore, 10),
                projectType: this.detectProjectType(files.map(([name]) => name)),
                hasTests: files.some(([name]) => name.includes('test') || name.includes('spec')),
                hasConfig: files.some(([name]) => ['package.json', 'tsconfig.json', 'webpack.config.js'].includes(name))
            };
        } catch (error) {
            console.error('Project analysis failed:', error);
            return {
                totalFiles: 0,
                codeFiles: 0,
                languages: [],
                complexityScore: 0,
                projectType: 'unknown',
                hasTests: false,
                hasConfig: false
            };
        }
    }

    private detectProjectType(fileNames: string[]): string {
        if (fileNames.includes('package.json')) {
            if (fileNames.some(name => name.includes('react') || name.includes('jsx'))) {
                return 'React Application';
            } else if (fileNames.some(name => name.includes('vue'))) {
                return 'Vue Application';
            } else if (fileNames.some(name => name.includes('express') || name.includes('server'))) {
                return 'Node.js Server';
            } else {
                return 'JavaScript/Node.js Project';
            }
        } else if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) {
            return 'Python Project';
        } else if (fileNames.includes('Cargo.toml')) {
            return 'Rust Project';
        } else if (fileNames.includes('go.mod')) {
            return 'Go Project';
        } else if (fileNames.some(name => name.endsWith('.java'))) {
            return 'Java Project';
        } else {
            return 'Mixed/Other Project';
        }
    }

    dispose(): void {
        this.fileWatcher?.dispose();
    }
}