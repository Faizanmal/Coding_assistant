import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { EnhancedNLPEngine } from './enhanced-nlp-engine';

export interface CodebaseInsight {
    type: 'pattern' | 'issue' | 'opportunity' | 'dependency' | 'security' | 'performance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    location?: {
        file: string;
        line?: number;
        column?: number;
    };
    suggestion: string;
    autoFixAvailable: boolean;
    relatedFiles: string[];
    tags: string[];
}

export interface ProjectUnderstanding {
    architecture: {
        pattern: string;
        layers: string[];
        components: string[];
        dataFlow: string;
    };
    technologies: {
        primary: string[];
        secondary: string[];
        testing: string[];
        build: string[];
    };
    quality: {
        score: number;
        maintainability: number;
        testCoverage: number;
        documentation: number;
        security: number;
    };
    insights: CodebaseInsight[];
    suggestions: {
        immediate: string[];
        shortTerm: string[];
        longTerm: string[];
    };
    riskFactors: string[];
    strengths: string[];
}

export class EnhancedCodebaseUnderstanding {
    private static _instance: EnhancedCodebaseUnderstanding;
    private _knowledgeSystem: ProjectKnowledgeSystem;
    private _agentCoordinator: SmartAgentCoordinator;
    private _nlpEngine: EnhancedNLPEngine;
    private _lastAnalysis?: ProjectUnderstanding;

    private constructor() {
        this._knowledgeSystem = ProjectKnowledgeSystem.getInstance();
        this._agentCoordinator = SmartAgentCoordinator.getInstance();
        this._nlpEngine = EnhancedNLPEngine.getInstance();
    }

    public static getInstance(): EnhancedCodebaseUnderstanding {
        if (!EnhancedCodebaseUnderstanding._instance) {
            EnhancedCodebaseUnderstanding._instance = new EnhancedCodebaseUnderstanding();
        }
        return EnhancedCodebaseUnderstanding._instance;
    }

    public async analyzeCodebaseComprehensively(): Promise<ProjectUnderstanding> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            // Step 1: Basic project analysis
            const basicAnalysis = await this._knowledgeSystem.analyzeProject();
            
            // Step 2: Deep file analysis
            const fileAnalysis = await this._analyzeProjectFiles(workspaceFolder);
            
            // Step 3: Architecture pattern recognition
            const architecture = await this._recognizeArchitecturePattern(fileAnalysis);
            
            // Step 4: Quality assessment
            const quality = await this._assessCodeQuality(fileAnalysis);
            
            // Step 5: Generate insights and suggestions
            const insights = await this._generateInsights(fileAnalysis, architecture, quality);
            
            // Step 6: Risk and opportunity analysis
            const riskAnalysis = await this._analyzeRisksAndOpportunities(fileAnalysis);
            
            const understanding: ProjectUnderstanding = {
                architecture,
                technologies: {
                    primary: basicAnalysis.languages,
                    secondary: await this._detectSecondaryTechnologies(fileAnalysis),
                    testing: await this._detectTestingFrameworks(fileAnalysis),
                    build: await this._detectBuildTools(fileAnalysis)
                },
                quality,
                insights,
                suggestions: {
                    immediate: riskAnalysis.immediate,
                    shortTerm: riskAnalysis.shortTerm,
                    longTerm: riskAnalysis.longTerm
                },
                riskFactors: riskAnalysis.risks,
                strengths: riskAnalysis.strengths
            };

            this._lastAnalysis = understanding;
            return understanding;
        } catch (error: any) {
            throw new Error(`Codebase analysis failed: ${error.message}`);
        }
    }

    public async processNaturalLanguageQuery(query: string): Promise<string> {
        try {
            // Ensure we have recent analysis
            if (!this._lastAnalysis) {
                await this.analyzeCodebaseComprehensively();
            }

            // Analyze the query intent
            const intent = await this._nlpEngine.analyzeUserIntent(query);
            
            // Generate contextual response based on codebase understanding
            const response = await this._generateContextualResponse(query, intent, this._lastAnalysis!);
            
            return response;
        } catch (error: any) {
            return `❌ Failed to process query: ${error.message}`;
        }
    }

    private async _analyzeProjectFiles(workspaceFolder: vscode.WorkspaceFolder): Promise<any> {
        const fileMap = new Map<string, any>();
        
        try {
            // Get all code files
            const files = await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
            const codeFiles = files.filter(([name, type]) => 
                type === vscode.FileType.File && 
                /\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|cs|swift|kt|html|css|scss|vue|svelte)$/.test(name)
            );

            // Analyze each file
            for (const [fileName] of codeFiles.slice(0, 20)) { // Limit to prevent timeout
                try {
                    const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                    const content = await vscode.workspace.fs.readFile(filePath);
                    const text = content.toString();
                    
                    const analysis = await this._analyzeIndividualFile(fileName, text);
                    fileMap.set(fileName, analysis);
                } catch (error) {
                    console.warn(`Failed to analyze file ${fileName}:`, error);
                }
            }
        } catch (error) {
            console.error('Failed to read workspace files:', error);
        }

        return fileMap;
    }

    private async _analyzeIndividualFile(fileName: string, content: string): Promise<any> {
        const lines = content.split('\n');
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        
        return {
            fileName,
            extension: fileExt,
            lineCount: lines.length,
            size: content.length,
            complexity: this._calculateComplexity(content),
            imports: this._extractImports(content, fileExt),
            exports: this._extractExports(content, fileExt),
            functions: this._extractFunctions(content, fileExt),
            classes: this._extractClasses(content, fileExt),
            hasTests: fileName.includes('test') || fileName.includes('spec'),
            hasDocumentation: this._hasDocumentation(content),
            securityIssues: this._detectSecurityIssues(content),
            performanceIssues: this._detectPerformanceIssues(content)
        };
    }

    private _calculateComplexity(content: string): number {
        // Simple complexity calculation based on control structures
        const complexityIndicators = [
            /if\s*\(/g,
            /else\s*if\s*\(/g,
            /switch\s*\(/g,
            /for\s*\(/g,
            /while\s*\(/g,
            /try\s*{/g,
            /catch\s*\(/g,
            /&&/g,
            /\|\|/g
        ];

        let complexity = 1; // Base complexity
        complexityIndicators.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return Math.min(complexity, 20); // Cap at 20
    }

    private _extractImports(content: string, fileExt: string): string[] {
        const imports: string[] = [];
        
        if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
            const importMatches = content.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g);
            const requireMatches = content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
            
            if (importMatches) {
                importMatches.forEach(match => {
                    const moduleMatch = match.match(/from\s+['"`]([^'"`]+)['"`]/);
                    if (moduleMatch) {
                        imports.push(moduleMatch[1]);
                    }
                });
            }
            
            if (requireMatches) {
                requireMatches.forEach(match => {
                    const moduleMatch = match.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
                    if (moduleMatch) {
                        imports.push(moduleMatch[1]);
                    }
                });
            }
        } else if (fileExt === 'py') {
            const importMatches = content.match(/^(?:from\s+\S+\s+)?import\s+.+$/gm);
            if (importMatches) {
                imports.push(...importMatches);
            }
        }

        return imports;
    }

    private _extractExports(content: string, fileExt: string): string[] {
        const exports: string[] = [];
        
        if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
            const exportMatches = content.match(/export\s+(?:default\s+)?(?:function\s+|class\s+|const\s+|let\s+|var\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            if (exportMatches) {
                exportMatches.forEach(match => {
                    const nameMatch = match.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
                    if (nameMatch) {
                        exports.push(nameMatch[1]);
                    }
                });
            }
        }

        return exports;
    }

    private _extractFunctions(content: string, fileExt: string): string[] {
        const functions: string[] = [];
        
        if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
            const functionMatches = content.match(/(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|(?:\([^)]*\)\s*{))/g);
            if (functionMatches) {
                functionMatches.forEach(match => {
                    const nameMatch = match.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/);
                    if (nameMatch) {
                        functions.push(nameMatch[1]);
                    }
                });
            }
        } else if (fileExt === 'py') {
            const functionMatches = content.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
            if (functionMatches) {
                functionMatches.forEach(match => {
                    const nameMatch = match.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (nameMatch) {
                        functions.push(nameMatch[1]);
                    }
                });
            }
        }

        return functions;
    }

    private _extractClasses(content: string, fileExt: string): string[] {
        const classes: string[] = [];
        
        if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
            const classMatches = content.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            if (classMatches) {
                classMatches.forEach(match => {
                    const nameMatch = match.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
                    if (nameMatch) {
                        classes.push(nameMatch[1]);
                    }
                });
            }
        } else if (fileExt === 'py') {
            const classMatches = content.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
            if (classMatches) {
                classMatches.forEach(match => {
                    const nameMatch = match.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (nameMatch) {
                        classes.push(nameMatch[1]);
                    }
                });
            }
        }

        return classes;
    }

    private _hasDocumentation(content: string): boolean {
        const docPatterns = [
            /\/\*\*[\s\S]*?\*\//,  // JSDoc
            /"""[\s\S]*?"""/,      // Python docstring
            /'''[\s\S]*?'''/,      // Python docstring
            /<!--[\s\S]*?-->/,     // HTML comments
            /#\s*.+/m              // Comment lines
        ];

        return docPatterns.some(pattern => pattern.test(content));
    }

    private _detectSecurityIssues(content: string): string[] {
        const issues: string[] = [];
        const securityPatterns = [
            { pattern: /eval\s*\(/, issue: 'Use of eval() function' },
            { pattern: /innerHTML\s*=/, issue: 'Direct innerHTML assignment' },
            { pattern: /document\.write\s*\(/, issue: 'Use of document.write()' },
            { pattern: /password.*=.*['"`][^'"`]+['"`]/, issue: 'Hardcoded password' },
            { pattern: /api[_-]?key.*=.*['"`][^'"`]+['"`]/i, issue: 'Hardcoded API key' },
            { pattern: /token.*=.*['"`][^'"`]+['"`]/i, issue: 'Hardcoded token' }
        ];

        securityPatterns.forEach(({ pattern, issue }) => {
            if (pattern.test(content)) {
                issues.push(issue);
            }
        });

        return issues;
    }

    private _detectPerformanceIssues(content: string): string[] {
        const issues: string[] = [];
        const performancePatterns = [
            { pattern: /setInterval\s*\(/, issue: 'Use of setInterval without cleanup' },
            { pattern: /setTimeout\s*\(/, issue: 'Use of setTimeout' },
            { pattern: /document\.getElementById/, issue: 'Repeated DOM queries' },
            { pattern: /querySelector(?:All)?\s*\(/, issue: 'DOM queries in loop' },
            { pattern: /for\s*\([^)]*\.length[^)]*\)/, issue: 'Array length in loop condition' }
        ];

        performancePatterns.forEach(({ pattern, issue }) => {
            if (pattern.test(content)) {
                issues.push(issue);
            }
        });

        return issues;
    }

    private async _recognizeArchitecturePattern(fileAnalysis: Map<string, any>): Promise<any> {
        const fileNames = Array.from(fileAnalysis.keys());
        const hasComponents = fileNames.some(name => name.includes('component') || name.includes('Component'));
        const hasServices = fileNames.some(name => name.includes('service') || name.includes('Service'));
        const hasModels = fileNames.some(name => name.includes('model') || name.includes('Model'));
        const hasControllers = fileNames.some(name => name.includes('controller') || name.includes('Controller'));
        const hasViews = fileNames.some(name => name.includes('view') || name.includes('View'));
        
        let pattern = 'Unknown';
        const layers: string[] = [];
        const components: string[] = [];

        if (hasComponents && hasServices) {
            pattern = 'Component-Service Architecture';
            layers.push('Presentation Layer', 'Service Layer');
        } else if (hasModels && hasViews && hasControllers) {
            pattern = 'Model-View-Controller (MVC)';
            layers.push('Model', 'View', 'Controller');
        } else if (hasComponents) {
            pattern = 'Component-Based Architecture';
            layers.push('Component Layer');
        } else if (hasServices) {
            pattern = 'Service-Oriented Architecture';
            layers.push('Service Layer');
        }

        // Extract component names
        fileAnalysis.forEach((analysis, fileName) => {
            if (analysis.classes.length > 0) {
                components.push(...analysis.classes);
            }
            if (analysis.functions.length > 0) {
                components.push(...analysis.functions.slice(0, 5)); // Limit to avoid clutter
            }
        });

        return {
            pattern,
            layers,
            components: components.slice(0, 10), // Limit to top 10
            dataFlow: this._analyzeDataFlow(fileAnalysis)
        };
    }

    private _analyzeDataFlow(fileAnalysis: Map<string, any>): string {
        let dataFlowPatterns: string[] = [];
        
        fileAnalysis.forEach((analysis) => {
            if (analysis.imports.some((imp: string) => imp.includes('redux') || imp.includes('zustand'))) {
                dataFlowPatterns.push('State Management');
            }
            if (analysis.imports.some((imp: string) => imp.includes('axios') || imp.includes('fetch'))) {
                dataFlowPatterns.push('HTTP Requests');
            }
            if (analysis.imports.some((imp: string) => imp.includes('socket') || imp.includes('websocket'))) {
                dataFlowPatterns.push('Real-time Communication');
            }
        });

        return dataFlowPatterns.length > 0 ? dataFlowPatterns.join(', ') : 'Traditional Request-Response';
    }

    private async _assessCodeQuality(fileAnalysis: Map<string, any>): Promise<any> {
        let totalComplexity = 0;
        let totalFiles = 0;
        let documentedFiles = 0;
        let testFiles = 0;
        let securityIssues = 0;

        fileAnalysis.forEach((analysis) => {
            totalComplexity += analysis.complexity;
            totalFiles++;
            if (analysis.hasDocumentation) {
                documentedFiles++;
            }
            if (analysis.hasTests) {
                testFiles++;
            }
            securityIssues += analysis.securityIssues.length;
        });

        const avgComplexity = totalFiles > 0 ? totalComplexity / totalFiles : 0;
        const documentationRatio = totalFiles > 0 ? documentedFiles / totalFiles : 0;
        const testCoverage = totalFiles > 0 ? testFiles / totalFiles : 0;
        
        // Calculate overall score (0-100)
        let score = 100;
        if (avgComplexity > 10) {
            score -= 20;
        } else if (avgComplexity > 5) {
            score -= 10;
        }
        
        if (documentationRatio < 0.5) {
            score -= 15;
        }
        
        if (testCoverage < 0.3) {
            score -= 20;
        }
        
        if (securityIssues > 0) {
            score -= Math.min(securityIssues * 5, 25);
        }

        return {
            score: Math.max(score, 0),
            maintainability: Math.max(100 - avgComplexity * 5, 0),
            testCoverage: testCoverage * 100,
            documentation: documentationRatio * 100,
            security: Math.max(100 - securityIssues * 10, 0)
        };
    }

    private async _generateInsights(fileAnalysis: Map<string, any>, architecture: any, quality: any): Promise<CodebaseInsight[]> {
        const insights: CodebaseInsight[] = [];

        // Quality insights
        if (quality.score < 70) {
            insights.push({
                type: 'issue',
                severity: quality.score < 50 ? 'high' : 'medium',
                title: 'Code Quality Concerns',
                description: `Overall code quality score is ${quality.score}/100. Consider refactoring complex components.`,
                suggestion: 'Break down complex functions, add documentation, and increase test coverage.',
                autoFixAvailable: false,
                relatedFiles: [],
                tags: ['quality', 'maintainability']
            });
        }

        // Security insights
        fileAnalysis.forEach((analysis, fileName) => {
            if (analysis.securityIssues.length > 0) {
                insights.push({
                    type: 'security',
                    severity: 'high',
                    title: 'Security Issues Detected',
                    description: `Found ${analysis.securityIssues.length} potential security issues in ${fileName}`,
                    location: { file: fileName },
                    suggestion: 'Review and fix security vulnerabilities: ' + analysis.securityIssues.join(', '),
                    autoFixAvailable: false,
                    relatedFiles: [fileName],
                    tags: ['security', 'vulnerability']
                });
            }
        });

        // Architecture insights
        if (architecture.pattern === 'Unknown') {
            insights.push({
                type: 'opportunity',
                severity: 'medium',
                title: 'Architecture Pattern Not Clear',
                description: 'The project structure doesn\'t follow a clear architectural pattern.',
                suggestion: 'Consider organizing code into a clear architectural pattern like MVC, Component-Service, or Layered Architecture.',
                autoFixAvailable: false,
                relatedFiles: [],
                tags: ['architecture', 'organization']
            });
        }

        // Test coverage insights
        if (quality.testCoverage < 50) {
            insights.push({
                type: 'opportunity',
                severity: 'medium',
                title: 'Low Test Coverage',
                description: `Test coverage is only ${quality.testCoverage.toFixed(1)}%.`,
                suggestion: 'Add unit tests for critical components and functions to improve reliability.',
                autoFixAvailable: false,
                relatedFiles: [],
                tags: ['testing', 'quality']
            });
        }

        return insights;
    }

    private async _analyzeRisksAndOpportunities(fileAnalysis: Map<string, any>): Promise<any> {
        const risks: string[] = [];
        const strengths: string[] = [];
        const immediate: string[] = [];
        const shortTerm: string[] = [];
        const longTerm: string[] = [];

        // Analyze complexity distribution
        const complexities = Array.from(fileAnalysis.values()).map(a => a.complexity);
        const avgComplexity = complexities.reduce((sum, c) => sum + c, 0) / complexities.length;

        if (avgComplexity > 8) {
            risks.push('High average complexity across files');
            immediate.push('Refactor most complex functions');
        } else if (avgComplexity < 3) {
            strengths.push('Well-structured, simple codebase');
        }

        // Check for documentation
        const documentedFiles = Array.from(fileAnalysis.values()).filter(a => a.hasDocumentation).length;
        const documentationRatio = documentedFiles / fileAnalysis.size;

        if (documentationRatio > 0.7) {
            strengths.push('Well-documented codebase');
        } else if (documentationRatio < 0.3) {
            risks.push('Poor documentation coverage');
            shortTerm.push('Add documentation to key components');
        }

        // Check for tests
        const testFiles = Array.from(fileAnalysis.values()).filter(a => a.hasTests).length;
        if (testFiles === 0) {
            risks.push('No test files detected');
            immediate.push('Set up testing framework and write basic tests');
        } else {
            strengths.push('Testing infrastructure in place');
        }

        // Security analysis
        const securityIssueFiles = Array.from(fileAnalysis.values()).filter(a => a.securityIssues.length > 0);
        if (securityIssueFiles.length > 0) {
            risks.push('Security vulnerabilities detected');
            immediate.push('Review and fix security issues');
        }

        // Long-term suggestions
        longTerm.push('Consider implementing continuous integration');
        longTerm.push('Set up code quality monitoring');
        longTerm.push('Implement automated testing pipeline');

        return {
            risks,
            strengths,
            immediate,
            shortTerm,
            longTerm
        };
    }

    private async _detectSecondaryTechnologies(fileAnalysis: Map<string, any>): Promise<string[]> {
        const technologies = new Set<string>();
        
        fileAnalysis.forEach((analysis) => {
            analysis.imports.forEach((imp: string) => {
                if (imp.includes('lodash')) {
                    technologies.add('Lodash');
                }
                if (imp.includes('moment') || imp.includes('dayjs')) {
                    technologies.add('Date manipulation library');
                }
                if (imp.includes('axios')) {
                    technologies.add('Axios HTTP client');
                }
                if (imp.includes('express')) {
                    technologies.add('Express.js');
                }
                if (imp.includes('react')) {
                    technologies.add('React');
                }
                if (imp.includes('vue')) {
                    technologies.add('Vue.js');
                }
            });
        });

        return Array.from(technologies);
    }

    private async _detectTestingFrameworks(fileAnalysis: Map<string, any>): Promise<string[]> {
        const frameworks = new Set<string>();
        
        fileAnalysis.forEach((analysis) => {
            analysis.imports.forEach((imp: string) => {
                if (imp.includes('jest')) {
                    frameworks.add('Jest');
                }
                if (imp.includes('vitest')) {
                    frameworks.add('Vitest');
                }
                if (imp.includes('mocha')) {
                    frameworks.add('Mocha');
                }
                if (imp.includes('chai')) {
                    frameworks.add('Chai');
                }
                if (imp.includes('cypress')) {
                    frameworks.add('Cypress');
                }
                if (imp.includes('playwright')) {
                    frameworks.add('Playwright');
                }
            });
        });

        return Array.from(frameworks);
    }

    private async _detectBuildTools(fileAnalysis: Map<string, any>): Promise<string[]> {
        const tools = new Set<string>();
        
        fileAnalysis.forEach((analysis) => {
            if (analysis.fileName === 'webpack.config.js') {
                tools.add('Webpack');
            }
            if (analysis.fileName === 'vite.config.js' || analysis.fileName === 'vite.config.ts') {
                tools.add('Vite');
            }
            if (analysis.fileName === 'rollup.config.js') {
                tools.add('Rollup');
            }
            if (analysis.fileName === 'tsconfig.json') {
                tools.add('TypeScript');
            }
        });

        return Array.from(tools);
    }

    private async _generateContextualResponse(query: string, intent: any, understanding: ProjectUnderstanding): Promise<string> {
        const contextPrompt = `You are an expert code analyst providing insights about a codebase.

Project Understanding:
- Architecture: ${understanding.architecture.pattern}
- Primary Technologies: ${understanding.technologies.primary.join(', ')}
- Quality Score: ${understanding.quality.score}/100
- Test Coverage: ${understanding.quality.testCoverage.toFixed(1)}%
- Total Insights: ${understanding.insights.length}

User Query: "${query}"
Query Intent: ${intent.intent}

Key Insights:
${understanding.insights.slice(0, 5).map(insight => `- ${insight.title}: ${insight.description}`).join('\n')}

Strengths:
${understanding.strengths.slice(0, 3).map(s => `- ${s}`).join('\n')}

Risk Factors:
${understanding.riskFactors.slice(0, 3).map(r => `- ${r}`).join('\n')}

Provide a comprehensive, actionable response that:
1. Directly addresses the user's question
2. Leverages the codebase understanding
3. Provides specific, contextual recommendations
4. Mentions relevant files or components when applicable
5. Suggests concrete next steps

Format the response in markdown with clear sections.`;

        try {
            const response = await generateCode(contextPrompt, 'llama-3.3-70b-versatile');
            return `🧠 **Codebase-Aware Response**\n\n${response}`;
        } catch (error: any) {
            return `❌ Failed to generate contextual response: ${error.message}`;
        }
    }

    public getLastAnalysis(): ProjectUnderstanding | undefined {
        return this._lastAnalysis;
    }

    public async generateCodebaseReport(): Promise<string> {
        const understanding = this._lastAnalysis || await this.analyzeCodebaseComprehensively();
        
        let report = `# 📊 Comprehensive Codebase Analysis Report\n\n`;
        
        // Executive Summary
        report += `## 🎯 Executive Summary\n\n`;
        report += `**Overall Quality Score:** ${understanding.quality.score}/100\n`;
        report += `**Architecture Pattern:** ${understanding.architecture.pattern}\n`;
        report += `**Primary Technologies:** ${understanding.technologies.primary.join(', ')}\n`;
        report += `**Critical Issues:** ${understanding.insights.filter(i => i.severity === 'critical' || i.severity === 'high').length}\n\n`;
        
        // Architecture Overview
        report += `## 🏗️ Architecture Overview\n\n`;
        report += `**Pattern:** ${understanding.architecture.pattern}\n`;
        report += `**Layers:** ${understanding.architecture.layers.join(', ')}\n`;
        report += `**Key Components:** ${understanding.architecture.components.slice(0, 8).join(', ')}\n`;
        report += `**Data Flow:** ${understanding.architecture.dataFlow}\n\n`;
        
        // Technology Stack
        report += `## 🛠️ Technology Stack\n\n`;
        report += `**Primary:** ${understanding.technologies.primary.join(', ')}\n`;
        if (understanding.technologies.secondary.length > 0) {
            report += `**Secondary:** ${understanding.technologies.secondary.join(', ')}\n`;
        }
        if (understanding.technologies.testing.length > 0) {
            report += `**Testing:** ${understanding.technologies.testing.join(', ')}\n`;
        }
        if (understanding.technologies.build.length > 0) {
            report += `**Build Tools:** ${understanding.technologies.build.join(', ')}\n`;
        }
        report += `\n`;
        
        // Quality Metrics
        report += `## 📈 Quality Metrics\n\n`;
        report += `| Metric | Score | Status |\n`;
        report += `|--------|-------|--------|\n`;
        report += `| Overall Quality | ${understanding.quality.score}/100 | ${understanding.quality.score >= 80 ? '✅ Good' : understanding.quality.score >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n`;
        report += `| Maintainability | ${understanding.quality.maintainability.toFixed(1)}/100 | ${understanding.quality.maintainability >= 80 ? '✅ Good' : understanding.quality.maintainability >= 60 ? '⚠️ Fair' : '❌ Poor'} |\n`;
        report += `| Test Coverage | ${understanding.quality.testCoverage.toFixed(1)}% | ${understanding.quality.testCoverage >= 80 ? '✅ Good' : understanding.quality.testCoverage >= 50 ? '⚠️ Fair' : '❌ Poor'} |\n`;
        report += `| Documentation | ${understanding.quality.documentation.toFixed(1)}% | ${understanding.quality.documentation >= 70 ? '✅ Good' : understanding.quality.documentation >= 40 ? '⚠️ Fair' : '❌ Poor'} |\n`;
        report += `| Security | ${understanding.quality.security.toFixed(1)}/100 | ${understanding.quality.security >= 90 ? '✅ Good' : understanding.quality.security >= 70 ? '⚠️ Fair' : '❌ Poor'} |\n\n`;
        
        // Key Insights
        if (understanding.insights.length > 0) {
            report += `## 🔍 Key Insights\n\n`;
            understanding.insights.slice(0, 8).forEach(insight => {
                const severityIcon = {
                    'critical': '🚨',
                    'high': '⚠️',
                    'medium': '📋',
                    'low': 'ℹ️'
                }[insight.severity];
                
                report += `### ${severityIcon} ${insight.title}\n`;
                report += `**Type:** ${insight.type} | **Severity:** ${insight.severity}\n\n`;
                report += `${insight.description}\n\n`;
                report += `**Suggestion:** ${insight.suggestion}\n\n`;
                if (insight.relatedFiles.length > 0) {
                    report += `**Related Files:** ${insight.relatedFiles.join(', ')}\n\n`;
                }
            });
        }
        
        // Strengths
        if (understanding.strengths.length > 0) {
            report += `## ✅ Strengths\n\n`;
            understanding.strengths.forEach(strength => {
                report += `- ${strength}\n`;
            });
            report += `\n`;
        }
        
        // Risk Factors
        if (understanding.riskFactors.length > 0) {
            report += `## ⚠️ Risk Factors\n\n`;
            understanding.riskFactors.forEach(risk => {
                report += `- ${risk}\n`;
            });
            report += `\n`;
        }
        
        // Recommendations
        report += `## 🎯 Recommendations\n\n`;
        
        if (understanding.suggestions.immediate.length > 0) {
            report += `### 🔥 Immediate Actions\n`;
            understanding.suggestions.immediate.forEach(action => {
                report += `- ${action}\n`;
            });
            report += `\n`;
        }
        
        if (understanding.suggestions.shortTerm.length > 0) {
            report += `### 📅 Short-term Goals (1-3 months)\n`;
            understanding.suggestions.shortTerm.forEach(goal => {
                report += `- ${goal}\n`;
            });
            report += `\n`;
        }
        
        if (understanding.suggestions.longTerm.length > 0) {
            report += `### 🚀 Long-term Vision (3-12 months)\n`;
            understanding.suggestions.longTerm.forEach(vision => {
                report += `- ${vision}\n`;
            });
            report += `\n`;
        }
        
        report += `---\n\n`;
        report += `*Report generated on ${new Date().toLocaleString()} by Enhanced Codebase Understanding System*\n`;
        
        return report;
    }
}