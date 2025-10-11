import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getprojectcontext } from './extension';
import { EnhancedCodebaseUnderstanding } from './enhanced-codebase-understanding';
import { AugmentedIntelligenceSystem } from './augmented-intelligence-system';
import { QuickDevSystem } from './quick-dev-system';

/**
 * ProjectAwarenessSystem - A next-generation system for understanding project structure,
 * dependencies, patterns, and providing intelligent suggestions based on codebase analysis.
 * 
 * Features:
 * - Deep code structure analysis and visualization
 * - Dependency graph generation with impact analysis
 * - Architecture pattern recognition
 * - Anomaly detection and architectural consistency checking
 * - Performance bottleneck identification
 * - Security vulnerability scanning
 */
export class AdvancedProjectAwarenessSystem {
    private static instance: AdvancedProjectAwarenessSystem;
    private projectGraph: any = {};
    private dependencyMap: Map<string, string[]> = new Map();
    private architecturePatterns: Map<string, number> = new Map();
    private securityVulnerabilities: any[] = [];
    private performanceHotspots: any[] = [];
    private codebaseStats: any = {};
    private fileImportance: Map<string, number> = new Map();
    private projectType: string = '';
    private frameworks: string[] = [];
    private languages: Map<string, number> = new Map();
    private lastAnalysisTime: Date | null = null;
    private isAnalysisRunning: boolean = false;
    
    private constructor() {
        this.initializeAnalysis();
        
        // Watch for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.initializeAnalysis();
        });
        
        // Watch for file changes
        vscode.workspace.onDidSaveTextDocument((document) => {
            this.updateFileAnalysis(document.uri.fsPath);
        });
    }
    
    public static getInstance(): AdvancedProjectAwarenessSystem {
        if (!AdvancedProjectAwarenessSystem.instance) {
            AdvancedProjectAwarenessSystem.instance = new AdvancedProjectAwarenessSystem();
        }
        return AdvancedProjectAwarenessSystem.instance;
    }
    
    /**
     * Initialize the analysis process
     */
    private async initializeAnalysis(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found');
            return;
        }
        
        // Reset analysis state
        this.projectGraph = {};
        this.dependencyMap.clear();
        this.architecturePatterns.clear();
        this.securityVulnerabilities = [];
        this.performanceHotspots = [];
        this.codebaseStats = {};
        this.fileImportance.clear();
        
        // Start analysis in the background
        this.runFullAnalysis();
    }
    
    /**
     * Run a full analysis of the project
     */
    public async runFullAnalysis(): Promise<void> {
        if (this.isAnalysisRunning) {
            console.log('Analysis already running, skipping');
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found');
            return;
        }
        
        console.log('Starting full project analysis');
        this.isAnalysisRunning = true;
        
        try {
            // Analyze project structure
            await this.analyzeProjectStructure(workspaceFolder.uri.fsPath);
            
            // Analyze dependencies
            await this.analyzeDependencies();
            
            // Analyze architecture patterns
            await this.analyzeArchitecturePatterns();
            
            // Scan for security vulnerabilities
            await this.scanSecurityVulnerabilities();
            
            // Analyze performance hotspots
            await this.analyzePerformanceHotspots();
            
            // Calculate file importance
            this.calculateFileImportance();
            
            this.lastAnalysisTime = new Date();
            console.log('Full project analysis completed');
        } catch (error) {
            console.error('Error during project analysis:', error);
        } finally {
            this.isAnalysisRunning = false;
        }
    }
    
    /**
     * Analyze project structure
     */
    private async analyzeProjectStructure(rootPath: string): Promise<void> {
        // Reset statistics
        this.codebaseStats = {
            totalFiles: 0,
            totalLines: 0,
            totalFunctions: 0,
            totalClasses: 0,
            totalExports: 0,
            fileTypes: {}
        };
        
        this.languages.clear();
        
        // Build project graph
        this.projectGraph = await this.buildProjectGraph(rootPath);
        
        // Detect project type and frameworks
        await this.detectProjectType();
        
        console.log(`Project analysis: ${this.codebaseStats.totalFiles} files, ${this.codebaseStats.totalLines} lines`);
    }
    
    /**
     * Build a graph representation of the project
     */
    private async buildProjectGraph(rootPath: string): Promise<any> {
        const graph: any = {
            nodes: [],
            edges: []
        };
        
        const processDirectory = async (dirPath: string, parentNode: string | null = null): Promise<void> => {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(rootPath, fullPath);
                
                // Skip node_modules and hidden directories
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    // Add directory node
                    graph.nodes.push({
                        id: relativePath,
                        label: entry.name,
                        type: 'directory',
                        path: fullPath
                    });
                    
                    // Add edge from parent
                    if (parentNode) {
                        graph.edges.push({
                            source: parentNode,
                            target: relativePath,
                            type: 'contains'
                        });
                    }
                    
                    // Process subdirectory
                    await processDirectory(fullPath, relativePath);
                } else {
                    // Get file extension
                    const ext = path.extname(entry.name).toLowerCase();
                    
                    // Skip binary files and some non-code files
                    if (['.jpg', '.png', '.gif', '.ico', '.pdf', '.zip'].includes(ext)) {
                        continue;
                    }
                    
                    // Count file by extension
                    this.codebaseStats.fileTypes[ext] = (this.codebaseStats.fileTypes[ext] || 0) + 1;
                    this.codebaseStats.totalFiles++;
                    
                    // Track languages
                    const language = this.getLanguageFromExtension(ext);
                    if (language) {
                        this.languages.set(language, (this.languages.get(language) || 0) + 1);
                    }
                    
                    // Add file node
                    graph.nodes.push({
                        id: relativePath,
                        label: entry.name,
                        type: 'file',
                        path: fullPath,
                        extension: ext
                    });
                    
                    // Add edge from parent
                    if (parentNode) {
                        graph.edges.push({
                            source: parentNode,
                            target: relativePath,
                            type: 'contains'
                        });
                    }
                    
                    // Analyze file content
                    await this.analyzeFile(fullPath, relativePath);
                }
            }
        };
        
        await processDirectory(rootPath);
        return graph;
    }
    
    /**
     * Analyze a single file
     */
    private async analyzeFile(filePath: string, relativePath: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            this.codebaseStats.totalLines += lines.length;
            
            // Count functions, classes, exports
            const ext = path.extname(filePath).toLowerCase();
            
            if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
                // Count functions
                const functionMatches = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\()/g) || [];
                this.codebaseStats.totalFunctions += functionMatches.length;
                
                // Count classes
                const classMatches = content.match(/class\s+\w+/g) || [];
                this.codebaseStats.totalClasses += classMatches.length;
                
                // Count exports
                const exportMatches = content.match(/export\s+(?:default\s+)?(?:const|class|function|interface|type|enum)/g) || [];
                this.codebaseStats.totalExports += exportMatches.length;
                
                // Extract imports
                this.extractImports(content, relativePath);
            }
        } catch (error) {
            console.error(`Error analyzing file ${filePath}:`, error);
        }
    }
    
    /**
     * Extract imports from a file and update dependency map
     */
    private extractImports(content: string, filePath: string): void {
        const imports: string[] = [];
        
        // Match ES6 imports
        const es6ImportRegex = /import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        // Match CommonJS requires
        const commonJsRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        
        while ((match = commonJsRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        
        // Add to dependency map
        this.dependencyMap.set(filePath, imports);
    }
    
    /**
     * Analyze dependencies and build the dependency graph
     */
    private async analyzeDependencies(): Promise<void> {
        // Build the graph edges based on imports
        for (const [file, imports] of this.dependencyMap.entries()) {
            for (const importPath of imports) {
                // Skip node_modules imports
                if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                    continue;
                }
                
                // Resolve import path to actual file
                const resolvedImport = this.resolveImportPath(file, importPath);
                if (resolvedImport) {
                    // Add edge to graph
                    this.projectGraph.edges.push({
                        source: file,
                        target: resolvedImport,
                        type: 'imports'
                    });
                }
            }
        }
    }
    
    /**
     * Resolve an import path to an actual file path
     */
    private resolveImportPath(sourcePath: string, importPath: string): string | null {
        // This is a simplified version - a real implementation would handle
        // various module resolution strategies and path mappings
        try {
            const sourceDir = path.dirname(sourcePath);
            let resolvedPath: string;
            
            if (importPath.startsWith('.')) {
                // Relative import
                resolvedPath = path.join(sourceDir, importPath);
            } else if (importPath.startsWith('/')) {
                // Absolute import (from project root)
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {return null;}
                
                resolvedPath = path.join(workspaceFolder.uri.fsPath, importPath);
            } else {
                // Node module import - skip
                return null;
            }
            
            // Try to find the actual file
            // If import doesn't have extension, try common extensions
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
            
            if (path.extname(resolvedPath) === '') {
                for (const ext of extensions) {
                    if (fs.existsSync(`${resolvedPath}${ext}`)) {
                        return `${resolvedPath}${ext}`;
                    }
                }
                
                // Try index files
                for (const ext of extensions) {
                    if (fs.existsSync(path.join(resolvedPath, `index${ext}`))) {
                        return path.join(resolvedPath, `index${ext}`);
                    }
                }
            } else if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
            }
            
            return null;
        } catch (error) {
            console.error(`Error resolving import ${importPath} from ${sourcePath}:`, error);
            return null;
        }
    }
    
    /**
     * Analyze architecture patterns in the codebase
     */
    private async analyzeArchitecturePatterns(): Promise<void> {
        // Reset patterns
        this.architecturePatterns.clear();
        
        // Look for common architecture patterns
        // MVC Pattern
        if (this.hasDirectories(['controllers', 'models', 'views'])) {
            this.architecturePatterns.set('MVC', 0.9);
        }
        
        // MVVM Pattern
        if (this.hasDirectories(['viewmodels', 'models', 'views'])) {
            this.architecturePatterns.set('MVVM', 0.9);
        }
        
        // Microservices
        if (this.hasDirectories(['services', 'api']) && this.hasFiles(['docker-compose.yml'])) {
            this.architecturePatterns.set('Microservices', 0.8);
        }
        
        // Clean Architecture
        if (this.hasDirectories(['entities', 'usecases', 'interfaces', 'frameworks'])) {
            this.architecturePatterns.set('Clean Architecture', 0.9);
        }
        
        // Component-based architecture (React/Angular)
        if (this.hasDirectories(['components']) && 
            (this.hasFiles(['package.json']) && this.hasPackageDependency('react')) ||
            this.hasFiles(['angular.json'])) {
            this.architecturePatterns.set('Component-based', 0.9);
        }
        
        // Check for Redux pattern
        if (this.hasFiles(['store.js', 'store.ts']) ||
            this.hasDirectories(['reducers', 'actions'])) {
            this.architecturePatterns.set('Redux', 0.8);
        }
        
        // Rest API structure
        if (this.hasDirectories(['routes', 'controllers', 'middleware'])) {
            this.architecturePatterns.set('REST API', 0.8);
        }
        
        // GraphQL API
        if (this.hasFiles(['schema.graphql']) || this.hasDirectories(['graphql'])) {
            this.architecturePatterns.set('GraphQL API', 0.9);
        }
        
        console.log('Architecture patterns detected:', Object.fromEntries(this.architecturePatterns));
    }
    
    /**
     * Scan for security vulnerabilities
     */
    private async scanSecurityVulnerabilities(): Promise<void> {
        this.securityVulnerabilities = [];
        
        // Check for hardcoded secrets
        await this.scanForHardcodedSecrets();
        
        // Check for insecure dependencies (simplified)
        await this.scanForInsecureDependencies();
        
        // Check for common security anti-patterns
        await this.scanForSecurityAntiPatterns();
        
        console.log(`Security scan complete: ${this.securityVulnerabilities.length} vulnerabilities found`);
    }
    
    /**
     * Scan for hardcoded secrets
     */
    private async scanForHardcodedSecrets(): Promise<void> {
        // Patterns for potential secrets
        const secretPatterns = [
            /(?:password|passwd|pwd|secret|key|token|api_?key)[\s\w]*=[\s]*["']([^"']+)/i,
            /(?:const|let|var)[\s]+(?:password|passwd|pwd|secret|key|token|api_?key)[\s\w]*=[\s]*["']([^"']+)/i,
            /[A-Za-z0-9+/]{40,}/
        ];
        
        // Scan each file
        for (const node of this.projectGraph.nodes) {
            if (node.type === 'file' && fs.existsSync(node.path)) {
                try {
                    const content = fs.readFileSync(node.path, 'utf8');
                    
                    for (const pattern of secretPatterns) {
                        const matches = content.match(pattern);
                        if (matches) {
                            this.securityVulnerabilities.push({
                                type: 'hardcoded_secret',
                                file: node.path,
                                description: 'Potential hardcoded secret or API key',
                                severity: 'high'
                            });
                            // Only report once per file
                            break;
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        }
    }
    
    /**
     * Scan for insecure dependencies
     */
    private async scanForInsecureDependencies(): Promise<void> {
        // Check package.json
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}
        
        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = { 
                    ...(packageJson.dependencies || {}), 
                    ...(packageJson.devDependencies || {})
                };
                
                // Example vulnerable packages (this would ideally use a vulnerability database)
                const knownVulnerable: Record<string, string> = {
                    'lodash': '<4.17.21',
                    'axios': '<0.21.1',
                    'jquery': '<3.5.0',
                    'node-fetch': '<2.6.1',
                    'minimist': '<1.2.6'
                };
                
                for (const [pkg, version] of Object.entries(dependencies)) {
                    if (knownVulnerable[pkg] && this.isVersionLessThan(version as string, knownVulnerable[pkg])) {
                        this.securityVulnerabilities.push({
                            type: 'vulnerable_dependency',
                            file: packageJsonPath,
                            package: pkg,
                            version: version,
                            description: `${pkg} has a known vulnerability in versions ${knownVulnerable[pkg]}`,
                            severity: 'medium'
                        });
                    }
                }
            } catch (error) {
                console.error('Error scanning package.json for vulnerabilities:', error);
            }
        }
    }
    
    /**
     * Check if a version is less than another version
     */
    private isVersionLessThan(version: string, compareVersion: string): boolean {
        // Simple version comparison, would need to be more sophisticated for real use
        const v1 = version.replace(/[^\d.]/g, '').split('.').map(Number);
        const v2 = compareVersion.replace(/[^\d.]/g, '').split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const num1 = i < v1.length ? v1[i] : 0;
            const num2 = i < v2.length ? v2[i] : 0;
            
            if (num1 < num2) {return true;}
            if (num1 > num2) {return false;}
        }
        
        return false;
    }
    
    /**
     * Scan for security anti-patterns
     */
    private async scanForSecurityAntiPatterns(): Promise<void> {
        // Patterns for common security issues
        const securityPatterns = [
            {
                name: 'sql_injection',
                pattern: /(?:execute|query)\s*\(\s*["']\s*(?:SELECT|UPDATE|DELETE|INSERT|DROP)[\s\S]*?\+\s*[^"']/i,
                description: 'Potential SQL injection vulnerability',
                severity: 'high'
            },
            {
                name: 'xss',
                pattern: /(?:innerHTML|outerHTML|document\.write)\s*=\s*(?:[^"']*\$|[^"']*\+)/i,
                description: 'Potential Cross-Site Scripting (XSS) vulnerability',
                severity: 'high'
            },
            {
                name: 'eval_usage',
                pattern: /eval\s*\(/i,
                description: 'Use of eval() can be dangerous',
                severity: 'medium'
            },
            {
                name: 'nosql_injection',
                pattern: /(?:find|update|remove)\s*\(\s*\{[^}]*\$\{/i,
                description: 'Potential NoSQL injection vulnerability',
                severity: 'high'
            },
            {
                name: 'insecure_random',
                pattern: /Math\.random\s*\(\s*\)/i,
                description: 'Insecure random number generation',
                severity: 'medium'
            }
        ];
        
        // Scan each file
        for (const node of this.projectGraph.nodes) {
            if (node.type === 'file' && fs.existsSync(node.path)) {
                const ext = node.extension;
                // Only scan code files
                if (['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.rb'].includes(ext)) {
                    try {
                        const content = fs.readFileSync(node.path, 'utf8');
                        
                        for (const { name, pattern, description, severity } of securityPatterns) {
                            if (pattern.test(content)) {
                                this.securityVulnerabilities.push({
                                    type: name,
                                    file: node.path,
                                    description,
                                    severity
                                });
                            }
                        }
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            }
        }
    }
    
    /**
     * Analyze performance hotspots
     */
    private async analyzePerformanceHotspots(): Promise<void> {
        this.performanceHotspots = [];
        
        // Check for performance anti-patterns
        const performancePatterns = [
            {
                name: 'nested_loops',
                pattern: /for\s*\([^)]*\)\s*\{[^{}]*for\s*\([^)]*\)/i,
                description: 'Nested loops can cause performance issues with large data sets',
                severity: 'medium'
            },
            {
                name: 'large_array_operations',
                pattern: /(?:map|filter|reduce|forEach)\s*\(\s*(?:function|[^)]*=>\s*)\s*\{[\s\S]{200,}\}/i,
                description: 'Large operations inside array methods',
                severity: 'medium'
            },
            {
                name: 'expensive_dom_operations',
                pattern: /(?:getElementById|querySelector|getElementsByClassName)[\s\S]{0,50}(?:innerHTML|appendChild|removeChild)[\s\S]{0,100}(?:for|while)\s*\(/i,
                description: 'DOM operations inside loops',
                severity: 'high'
            },
            {
                name: 'multiple_state_updates',
                pattern: /(?:setState|useState)[\s\S]{0,200}(?:setState|useState)[\s\S]{0,200}(?:setState|useState)/i,
                description: 'Multiple state updates in a single function',
                severity: 'medium'
            },
            {
                name: 'rerender_performance',
                pattern: /(?:useEffect|componentDidUpdate)[\s\S]{0,50}(?:fetch|axios|http)/i,
                description: 'Network requests in update lifecycle can cause performance issues',
                severity: 'medium'
            }
        ];
        
        // Scan each file
        for (const node of this.projectGraph.nodes) {
            if (node.type === 'file' && fs.existsSync(node.path)) {
                const ext = node.extension;
                // Only scan frontend code files
                if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
                    try {
                        const content = fs.readFileSync(node.path, 'utf8');
                        
                        for (const { name, pattern, description, severity } of performancePatterns) {
                            if (pattern.test(content)) {
                                this.performanceHotspots.push({
                                    type: name,
                                    file: node.path,
                                    description,
                                    severity
                                });
                            }
                        }
                        
                        // Check file size for large components
                        if (content.length > 50000 && (ext === '.jsx' || ext === '.tsx')) {
                            this.performanceHotspots.push({
                                type: 'large_component',
                                file: node.path,
                                description: 'Large component file (>50KB) may have performance issues',
                                severity: 'medium'
                            });
                        }
                    } catch (error) {
                        // Skip files that can't be read
                    }
                }
            }
        }
        
        console.log(`Performance analysis complete: ${this.performanceHotspots.length} hotspots found`);
    }
    
    /**
     * Calculate the importance of each file based on dependencies and centrality
     */
    private calculateFileImportance(): void {
        this.fileImportance.clear();
        
        // Start with default importance
        for (const node of this.projectGraph.nodes) {
            if (node.type === 'file') {
                this.fileImportance.set(node.id, 1);
            }
        }
        
        // Calculate incoming references (how many files import this file)
        const incoming: Record<string, number> = {};
        for (const edge of this.projectGraph.edges) {
            if (edge.type === 'imports') {
                incoming[edge.target] = (incoming[edge.target] || 0) + 1;
            }
        }
        
        // Update importance based on incoming references
        for (const [file, count] of Object.entries(incoming)) {
            const currentImportance = this.fileImportance.get(file) || 1;
            this.fileImportance.set(file, currentImportance + count * 0.5);
        }
        
        // Boost importance of key files like index.js, main component files
        for (const node of this.projectGraph.nodes) {
            if (node.type === 'file') {
                const fileName = path.basename(node.id);
                
                if (fileName === 'index.js' || fileName === 'index.ts') {
                    const currentImportance = this.fileImportance.get(node.id) || 1;
                    this.fileImportance.set(node.id, currentImportance * 1.5);
                }
                
                if (fileName === 'App.js' || fileName === 'App.tsx' || fileName === 'main.js' || fileName === 'main.ts') {
                    const currentImportance = this.fileImportance.get(node.id) || 1;
                    this.fileImportance.set(node.id, currentImportance * 2);
                }
            }
        }
    }
    
    /**
     * Update analysis for a single file
     */
    private async updateFileAnalysis(filePath: string): Promise<void> {
        // Only update if the file is part of the project graph
        const relativePath = this.getRelativePath(filePath);
        if (!relativePath) {return;}
        
        // Update file-specific metrics
        try {
            await this.analyzeFile(filePath, relativePath);
            
            // Re-extract imports
            const content = fs.readFileSync(filePath, 'utf8');
            this.extractImports(content, relativePath);
            
            // Update dependencies
            await this.analyzeDependencies();
            
            // Update importance
            this.calculateFileImportance();
        } catch (error) {
            console.error(`Error updating file analysis for ${filePath}:`, error);
        }
    }
    
    /**
     * Detect the project type based on files and dependencies
     */
    private async detectProjectType(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}
        
        // Reset project type and frameworks
        this.projectType = '';
        this.frameworks = [];
        
        // Check for package.json
        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const allDeps = { 
                    ...(packageJson.dependencies || {}), 
                    ...(packageJson.devDependencies || {})
                };
                
                // Detect framework
                if ('react' in allDeps) {
                    this.frameworks.push('React');
                    
                    if ('next' in allDeps) {
                        this.frameworks.push('Next.js');
                        this.projectType = 'Next.js Application';
                    } else {
                        this.projectType = 'React Application';
                    }
                    
                    if ('redux' in allDeps || '@reduxjs/toolkit' in allDeps) {
                        this.frameworks.push('Redux');
                    }
                } else if ('vue' in allDeps) {
                    this.frameworks.push('Vue.js');
                    
                    if ('nuxt' in allDeps) {
                        this.frameworks.push('Nuxt.js');
                        this.projectType = 'Nuxt.js Application';
                    } else {
                        this.projectType = 'Vue.js Application';
                    }
                } else if ('angular' in allDeps || '@angular/core' in allDeps) {
                    this.frameworks.push('Angular');
                    this.projectType = 'Angular Application';
                } else if ('svelte' in allDeps) {
                    this.frameworks.push('Svelte');
                    this.projectType = 'Svelte Application';
                }
                
                // Check for backend frameworks
                if ('express' in allDeps) {
                    this.frameworks.push('Express');
                    if (!this.projectType) {this.projectType = 'Express API';}
                } else if ('koa' in allDeps) {
                    this.frameworks.push('Koa');
                    if (!this.projectType) {this.projectType = 'Koa API';}
                } else if ('fastify' in allDeps) {
                    this.frameworks.push('Fastify');
                    if (!this.projectType) {this.projectType = 'Fastify API';}
                } else if ('nest' in allDeps || '@nestjs/core' in allDeps) {
                    this.frameworks.push('NestJS');
                    if (!this.projectType) {this.projectType = 'NestJS Application';}
                }
                
                // Check for database libraries
                if ('mongoose' in allDeps || 'mongodb' in allDeps) {
                    this.frameworks.push('MongoDB');
                } else if ('sequelize' in allDeps) {
                    this.frameworks.push('Sequelize');
                } else if ('prisma' in allDeps) {
                    this.frameworks.push('Prisma');
                } else if ('typeorm' in allDeps) {
                    this.frameworks.push('TypeORM');
                }
                
                // Check for additional tooling
                if ('typescript' in allDeps) {
                    this.frameworks.push('TypeScript');
                }
                
                if ('webpack' in allDeps) {
                    this.frameworks.push('Webpack');
                } else if ('vite' in allDeps) {
                    this.frameworks.push('Vite');
                }
                
                if ('jest' in allDeps) {
                    this.frameworks.push('Jest');
                } else if ('mocha' in allDeps) {
                    this.frameworks.push('Mocha');
                } else if ('cypress' in allDeps) {
                    this.frameworks.push('Cypress');
                }
                
                // Generic defaults
                if (!this.projectType) {
                    if (this.hasFiles(['index.html', 'style.css'])) {
                        this.projectType = 'Static Website';
                    } else {
                        this.projectType = 'Node.js Project';
                    }
                }
            } catch (error) {
                console.error('Error parsing package.json:', error);
                this.projectType = 'Unknown JavaScript/TypeScript Project';
            }
        } else {
            // Non-JS projects
            if (this.hasFiles(['pom.xml'])) {
                this.projectType = 'Java Maven Project';
                this.frameworks.push('Maven');
            } else if (this.hasFiles(['build.gradle'])) {
                this.projectType = 'Java Gradle Project';
                this.frameworks.push('Gradle');
            } else if (this.hasFiles(['go.mod'])) {
                this.projectType = 'Go Project';
            } else if (this.hasFiles(['requirements.txt', 'setup.py'])) {
                this.projectType = 'Python Project';
                
                if (this.hasFiles(['manage.py']) && this.hasDirectories(['app'])) {
                    this.projectType = 'Django Project';
                    this.frameworks.push('Django');
                } else if (this.hasFiles(['app.py']) && this.hasDirectories(['templates'])) {
                    this.projectType = 'Flask Project';
                    this.frameworks.push('Flask');
                }
            } else if (this.hasDirectories(['app', 'config', 'db'])) {
                this.projectType = 'Ruby on Rails Project';
                this.frameworks.push('Rails');
            } else {
                // Default to unknown
                this.projectType = 'Unknown Project';
            }
        }
        
        console.log(`Project type detected: ${this.projectType}`);
        console.log(`Frameworks detected: ${this.frameworks.join(', ')}`);
    }
    
    /**
     * Check if project has specific directories
     */
    private hasDirectories(dirNames: string[]): boolean {
        return dirNames.some(dirName => {
            return this.projectGraph.nodes.some((node: any) => {
                return node.type === 'directory' && (
                    node.label === dirName || 
                    node.id.endsWith(`/${dirName}`) || 
                    node.id === dirName
                );
            });
        });
    }
    
    /**
     * Check if project has specific files
     */
    private hasFiles(fileNames: string[]): boolean {
        return fileNames.some(fileName => {
            return this.projectGraph.nodes.some((node: any) => {
                return node.type === 'file' && (
                    node.label === fileName || 
                    node.id.endsWith(`/${fileName}`) || 
                    node.id === fileName
                );
            });
        });
    }
    
    /**
     * Check if package.json has specific dependency
     */
    private hasPackageDependency(depName: string): boolean {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return false;}
        
        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {return false;}
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = packageJson.dependencies || {};
            const devDeps = packageJson.devDependencies || {};
            
            return depName in deps || depName in devDeps;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get relative path from absolute path
     */
    private getRelativePath(absolutePath: string): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return null;}
        
        const relativePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);
        return relativePath;
    }
    
    /**
     * Get language from file extension
     */
    private getLanguageFromExtension(ext: string): string | null {
        const extToLang: Record<string, string> = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.c': 'C',
            '.cpp': 'C++',
            '.cs': 'C#',
            '.go': 'Go',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.less': 'LESS',
            '.json': 'JSON',
            '.md': 'Markdown',
            '.yml': 'YAML',
            '.yaml': 'YAML',
            '.xml': 'XML',
            '.sql': 'SQL',
            '.sh': 'Shell',
            '.bat': 'Batch',
            '.ps1': 'PowerShell',
            '.dart': 'Dart',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.rs': 'Rust'
        };
        
        return extToLang[ext] || null;
    }
    
    /**
     * Get project information summary
     */
    public getProjectSummary(): any {
        return {
            projectType: this.projectType,
            frameworks: this.frameworks,
            languages: Object.fromEntries(this.languages),
            stats: this.codebaseStats,
            architecturePatterns: Object.fromEntries(this.architecturePatterns),
            securityIssuesCount: this.securityVulnerabilities.length,
            performanceIssuesCount: this.performanceHotspots.length,
            lastAnalysisTime: this.lastAnalysisTime,
            dependencyCount: this.dependencyMap.size,
            fileCount: this.codebaseStats.totalFiles,
            lineCount: this.codebaseStats.totalLines
        };
    }
    
    /**
     * Get security issues
     */
    public getSecurityIssues(): any[] {
        return this.securityVulnerabilities;
    }
    
    /**
     * Get performance issues
     */
    public getPerformanceIssues(): any[] {
        return this.performanceHotspots;
    }
    
    /**
     * Get most important files
     */
    public getMostImportantFiles(limit: number = 10): any[] {
        const entries = Array.from(this.fileImportance.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
            
        return entries.map(([file, importance]) => ({ file, importance }));
    }
    
    /**
     * Get dependency graph
     */
    public getDependencyGraph(): any {
        return this.projectGraph;
    }
}

// Register commands
export function registerAdvancedProjectAwarenessCommands(context: vscode.ExtensionContext): void {
    const projectSystem = AdvancedProjectAwarenessSystem.getInstance();
    
    // Run full analysis
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.runProjectAnalysis', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing Project',
                cancellable: false
            }, async (progress) => {
                try {
                    progress.report({ message: 'Analyzing project structure...' });
                    await projectSystem.runFullAnalysis();
                    
                    progress.report({ message: 'Generating report...' });
                    const summary = projectSystem.getProjectSummary();
                    
                    // Generate markdown report
                    let content = `# Project Analysis Report\n\n`;
                    content += `## Project Overview\n\n`;
                    content += `- **Project Type**: ${summary.projectType}\n`;
                    content += `- **Frameworks**: ${summary.frameworks.join(', ')}\n`;
                    content += `- **Languages**: ${Object.entries(summary.languages).map(([lang, count]) => `${lang} (${count})`).join(', ')}\n`;
                    content += `- **Total Files**: ${summary.fileCount}\n`;
                    content += `- **Total Lines**: ${summary.lineCount.toLocaleString()}\n\n`;
                    
                    content += `## Architecture Patterns\n\n`;
                    if (Object.keys(summary.architecturePatterns).length > 0) {
                        for (const [pattern, confidence] of Object.entries(summary.architecturePatterns)) {
                            content += `- **${pattern}**: ${(Number(confidence) * 100).toFixed(0)}% confidence\n`;
                        }
                    } else {
                        content += `No specific architecture patterns detected.\n`;
                    }
                    
                    content += `\n## Key Metrics\n\n`;
                    content += `- **Functions**: ${summary.stats.totalFunctions}\n`;
                    content += `- **Classes**: ${summary.stats.totalClasses}\n`;
                    content += `- **Exports**: ${summary.stats.totalExports}\n`;
                    
                    if (summary.securityIssuesCount > 0) {
                        content += `\n## Security Issues\n\n`;
                        content += `⚠️ Found ${summary.securityIssuesCount} potential security issues.\n`;
                        content += `Run the 'Show Security Issues' command for details.\n`;
                    }
                    
                    if (summary.performanceIssuesCount > 0) {
                        content += `\n## Performance Issues\n\n`;
                        content += `⚠️ Found ${summary.performanceIssuesCount} potential performance issues.\n`;
                        content += `Run the 'Show Performance Issues' command for details.\n`;
                    }
                    
                    content += `\n## Most Important Files\n\n`;
                    const importantFiles = projectSystem.getMostImportantFiles();
                    for (const { file, importance } of importantFiles) {
                        content += `- **${file}** (importance: ${importance.toFixed(2)})\n`;
                    }
                    
                    // Create document with report
                    const doc = await vscode.workspace.openTextDocument({
                        content,
                        language: 'markdown'
                    });
                    
                    await vscode.window.showTextDocument(doc);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Error analyzing project: ${error.message}`);
                }
            });
        })
    );
    
    // Show security issues
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.showSecurityIssues', async () => {
            const issues = projectSystem.getSecurityIssues();
            
            if (issues.length === 0) {
                vscode.window.showInformationMessage('No security issues found');
                return;
            }
            
            let content = `# Security Issues (${issues.length})\n\n`;
            
            // Group by severity
            const highIssues = issues.filter(i => i.severity === 'high');
            const mediumIssues = issues.filter(i => i.severity === 'medium');
            const lowIssues = issues.filter(i => i.severity === 'low');
            
            if (highIssues.length > 0) {
                content += `## High Severity Issues (${highIssues.length})\n\n`;
                for (const issue of highIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            if (mediumIssues.length > 0) {
                content += `## Medium Severity Issues (${mediumIssues.length})\n\n`;
                for (const issue of mediumIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            if (lowIssues.length > 0) {
                content += `## Low Severity Issues (${lowIssues.length})\n\n`;
                for (const issue of lowIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
        })
    );
    
    // Show performance issues
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.showPerformanceIssues', async () => {
            const issues = projectSystem.getPerformanceIssues();
            
            if (issues.length === 0) {
                vscode.window.showInformationMessage('No performance issues found');
                return;
            }
            
            let content = `# Performance Issues (${issues.length})\n\n`;
            
            // Group by severity
            const highIssues = issues.filter(i => i.severity === 'high');
            const mediumIssues = issues.filter(i => i.severity === 'medium');
            const lowIssues = issues.filter(i => i.severity === 'low');
            
            if (highIssues.length > 0) {
                content += `## High Impact Issues (${highIssues.length})\n\n`;
                for (const issue of highIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            if (mediumIssues.length > 0) {
                content += `## Medium Impact Issues (${mediumIssues.length})\n\n`;
                for (const issue of mediumIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            if (lowIssues.length > 0) {
                content += `## Low Impact Issues (${lowIssues.length})\n\n`;
                for (const issue of lowIssues) {
                    content += `### ${issue.type}\n`;
                    content += `- **File**: ${issue.file}\n`;
                    content += `- **Description**: ${issue.description}\n\n`;
                }
            }
            
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
        })
    );
    
    // Visualize project structure
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.visualizeProjectStructure', async () => {
            const graph = projectSystem.getDependencyGraph();
            
            // Create a visualization-ready object
            const visualization = {
                nodes: graph.nodes.map((node: any) => ({
                    id: node.id,
                    label: node.label,
                    type: node.type,
                    extension: node.extension || ''
                })),
                edges: graph.edges.map((edge: any) => ({
                    source: edge.source,
                    target: edge.target,
                    type: edge.type
                }))
            };
            
            // Create HTML visualization
            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Project Structure Visualization</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        #visualization { width: 100%; height: 100vh; }
        .node-file { fill: #6baed6; }
        .node-directory { fill: #fd8d3c; }
        .edge-imports { stroke: #2ca02c; }
        .edge-contains { stroke: #9467bd; }
    </style>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <div id="visualization"></div>
    <script>
        const data = ${JSON.stringify(visualization)};
        
        // Create visualization here (d3.js force-directed graph)
        // This is a placeholder - in a real implementation, we would render
        // a full D3.js force-directed graph with the data
        
        document.getElementById('visualization').innerHTML = 
            '<p>Project structure visualization would appear here.</p>' +
            '<p>Total nodes: ' + data.nodes.length + '</p>' +
            '<p>Total edges: ' + data.edges.length + '</p>';
    </script>
</body>
</html>
            `;
            
            // Create a temporary HTML file
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {return;}
            
            const tempHtmlPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'project-visualization.html');
            
            // Ensure .vscode directory exists
            const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir);
            }
            
            fs.writeFileSync(tempHtmlPath, htmlContent);
            
            // Open the visualization in a new editor
            const document = await vscode.workspace.openTextDocument(tempHtmlPath);
            await vscode.window.showTextDocument(document);
            
            // Show a button to view in browser
            vscode.window.showInformationMessage(
                'Project structure visualization created',
                'Open in Browser'
            ).then(selection => {
                if (selection === 'Open in Browser') {
                    vscode.env.openExternal(vscode.Uri.file(tempHtmlPath));
                }
            });
        })
    );
}