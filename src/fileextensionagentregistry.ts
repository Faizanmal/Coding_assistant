import * as vscode from 'vscode';
import * as path from 'path';
import { EditTracker } from './edittracker';
import { generateCode } from './codegenerator';

// Minimal interface for all file extension agents (single source-of-truth)
export interface FileExtensionAgent {
    [x: string]: any;
    id?: string;
    name: string;
    extensions: string[];
    description?: string;
    priority?: number;
    capabilities?: string[];
    createFile?: (fileName: string, prompt: string, context: ProjectContext) => Promise<FileOperationResult>;
    editFile?: (fileName: string, existingContent: string, editPrompt: string, context: ProjectContext) => Promise<FileOperationResult>;
    replaceFile?: (fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext) => Promise<FileOperationResult>;
}

export interface ProjectContext {
    workspaceRoot: string;
    projectType: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'library';
    technologies: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        testing?: string[];
        mobile?: string[];
    };
    existingFiles: string[];
    packageJsonContent?: any;
    tsConfigContent?: any;
}

export interface FileOperationResult {
    success: boolean;
    content?: string;
    error?: string;
    metadata: {
        linesCount: number;
        dependencies: string[];
        patterns: string[];
        suggestedFiles?: string[];
    };
}

export interface ContentAnalysis {
    language: string;
    complexity: 'simple' | 'medium' | 'complex';
    patterns: string[];
    dependencies: string[];
    issues: string[];
    suggestions: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        line: number;
        message: string;
        severity: 'error' | 'warning' | 'info';
    }>;
    warnings: Array<{
        line: number;
        message: string;
    }>;
}

// Central registry for file extension agents
export class FileExtensionAgentRegistry {
    private static instance: FileExtensionAgentRegistry;
    private agents: Map<string, FileExtensionAgent> = new Map();
    private extensionMap: Map<string, string> = new Map(); // extension -> agent name
    private projectContext: ProjectContext | null = null;

    private constructor() {
        this.initializeRegistry();
    }

    static getInstance(): FileExtensionAgentRegistry {
        if (!this.instance) {
            this.instance = new FileExtensionAgentRegistry();
        }
        return this.instance;
    }

    private initializeRegistry() {
        // Register default agents to ensure the system has agents to work with
        this.registerDefaultAgents();
        console.log('🤖 FileExtensionAgentRegistry initialized with default agents');
    }

    private registerDefaultAgents() {
        // Frontend agents
        this.registerAgent({
            name: 'react-specialist',
            extensions: ['jsx', 'tsx', 'js', 'ts'],
            description: 'Specializes in React components and frontend development',
            priority: 8,
            capabilities: ['component-creation', 'state-management', 'routing', 'styling']
        });

        this.registerAgent({
            name: 'vue-specialist',
            extensions: ['vue', 'js', 'ts'],
            description: 'Specializes in Vue.js components and applications',
            priority: 7,
            capabilities: ['component-creation', 'vuex', 'routing', 'composition-api']
        });

        this.registerAgent({
            name: 'web-specialist',
            extensions: ['html', 'css', 'scss', 'sass', 'less'],
            description: 'Specializes in HTML, CSS, and web styling',
            priority: 6,
            capabilities: ['responsive-design', 'animations', 'layout', 'accessibility']
        });

        // Backend agents
        this.registerAgent({
            name: 'node-specialist',
            extensions: ['js', 'ts', 'mjs'],
            description: 'Specializes in Node.js backend development',
            priority: 8,
            capabilities: ['api-development', 'database-integration', 'authentication', 'middleware']
        });

        this.registerAgent({
            name: 'python-specialist',
            extensions: ['py', 'pyx', 'pyi'],
            description: 'Specializes in Python development and APIs',
            priority: 7,
            capabilities: ['fastapi', 'django', 'flask', 'data-processing']
        });

        // Database agents
        this.registerAgent({
            name: 'database-specialist',
            extensions: ['sql', 'prisma', 'graphql'],
            description: 'Specializes in database design and queries',
            priority: 6,
            capabilities: ['schema-design', 'query-optimization', 'migrations', 'orm']
        });

        // Configuration agents
        this.registerAgent({
            name: 'config-specialist',
            extensions: ['json', 'yaml', 'yml', 'toml', 'env'],
            description: 'Specializes in configuration files and project setup',
            priority: 5,
            capabilities: ['project-setup', 'build-tools', 'deployment', 'environment-config']
        });

        // Documentation agents
        this.registerAgent({
            name: 'docs-specialist',
            extensions: ['md', 'txt', 'rst'],
            description: 'Specializes in documentation and README files',
            priority: 4,
            capabilities: ['documentation', 'api-docs', 'tutorials', 'project-guides']
        });
    }

    // Register a new file extension agent
    registerAgent(agent: FileExtensionAgent): void {
        this.agents.set(agent.name, agent);
        
        // Map extensions to agent
        agent.extensions.forEach(ext => {
            this.extensionMap.set(ext.toLowerCase(), agent.name);
        });
        
        console.log(`✅ Registered ${agent.name} for extensions: ${agent.extensions.join(', ')}`);
    }

    // Get agent for specific file extension
    getAgentForFile(fileName: string): FileExtensionAgent | null {
        const ext = path.extname(fileName).toLowerCase();
        const agentName = this.extensionMap.get(ext);
        
        if (agentName) {
            return this.agents.get(agentName) || null;
        }
        
        // Fallback to universal agent
        return this.agents.get('universal') || null;
    }

    // Get agent by name
    getAgent(name: string): FileExtensionAgent | null {
        return this.agents.get(name) || null;
    }

    // Get all registered agents
    getAllAgents(): FileExtensionAgent[] {
        return Array.from(this.agents.values());
    }

    // Get agents for multiple files with optimization
    getOptimalAgentAssignments(files: string[]): Map<string, FileExtensionAgent> {
        const assignments = new Map<string, FileExtensionAgent>();
        const agentWorkload = new Map<string, number>();

        // First pass: assign based on specialization
        for (const file of files) {
            const agent = this.getAgentForFile(file);
            if (agent) {
                assignments.set(file, agent);
                agentWorkload.set(agent.name, (agentWorkload.get(agent.name) || 0) + 1);
            }
        }

        // Second pass: load balancing for overloaded agents
        const maxWorkload = 3; // Max files per agent in one batch
        for (const [file, agent] of assignments.entries()) {
            const workload = agentWorkload.get(agent.name) || 0;
            if (workload > maxWorkload) {
                // Try to find alternative agent
                const alternative = this.findAlternativeAgent(file, agent.name);
                if (alternative) {
                    assignments.set(file, alternative);
                    agentWorkload.set(agent.name, workload - 1);
                    agentWorkload.set(alternative.name, (agentWorkload.get(alternative.name) || 0) + 1);
                }
            }
        }

        return assignments;
    }

    private findAlternativeAgent(fileName: string, excludeAgent: string): FileExtensionAgent | null {
        const ext = path.extname(fileName).toLowerCase();
        
        // Look for agents that can handle this extension
        for (const [agentName, agent] of this.agents.entries()) {
            if (agentName !== excludeAgent && 
                (agent.extensions.includes(ext) || agent.extensions.includes('*'))) {
                return agent;
            }
        }
        
        return null;
    }

    // Context management
    updateProjectContext(context: ProjectContext): void {
        this.projectContext = context;
        console.log('📋 Project context updated:', context.projectType);
    }

    getProjectContext(): ProjectContext | null {
        return this.projectContext;
    }

    async analyzeWorkspace(): Promise<ProjectContext> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const context: ProjectContext = {
            workspaceRoot,
            projectType: 'fullstack', // Default
            technologies: {},
            existingFiles: []
        };

        try {
            // Analyze package.json
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            try {
                const packageJsonUri = vscode.Uri.file(packageJsonPath);
                const packageJsonBytes = await vscode.workspace.fs.readFile(packageJsonUri);
                context.packageJsonContent = JSON.parse(packageJsonBytes.toString());
                
                // Extract technologies from dependencies
                context.technologies = this.extractTechnologiesFromPackageJson(context.packageJsonContent);
                context.projectType = this.inferProjectType(context.technologies);
            } catch (error) {
                console.log('No package.json found or invalid JSON');
            }

            // Analyze tsconfig.json
            const tsConfigPath = path.join(workspaceRoot, 'tsconfig.json');
            try {
                const tsConfigUri = vscode.Uri.file(tsConfigPath);
                const tsConfigBytes = await vscode.workspace.fs.readFile(tsConfigUri);
                context.tsConfigContent = JSON.parse(tsConfigBytes.toString());
            } catch (error) {
                console.log('No tsconfig.json found or invalid JSON');
            }

            // Get existing files
            context.existingFiles = await this.getExistingFiles(workspaceRoot);

        } catch (error) {
            console.error('Error analyzing workspace:', error);
        }

        this.updateProjectContext(context);
        return context;
    }

    private extractTechnologiesFromPackageJson(packageJson: any): ProjectContext['technologies'] {
        const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };

        const technologies: ProjectContext['technologies'] = {};

        // Frontend frameworks
        const frontendFrameworks = ['react', 'vue', 'angular', '@angular/core', 'svelte', 'next', 'nuxt'];
        technologies.frontend = frontendFrameworks.filter(fw => dependencies[fw]);

        // Backend frameworks
        const backendFrameworks = ['express', 'fastify', 'koa', '@nestjs/core', 'hapi'];
        technologies.backend = backendFrameworks.filter(fw => dependencies[fw]);

        // Testing frameworks
        const testingFrameworks = ['jest', 'mocha', 'vitest', '@testing-library/react', 'cypress', 'playwright'];
        technologies.testing = testingFrameworks.filter(fw => dependencies[fw]);

        // Database libraries
        const databaseLibs = ['mongoose', 'prisma', 'sequelize', 'typeorm', 'mongodb'];
        technologies.database = databaseLibs.filter(lib => dependencies[lib]);

        // Mobile frameworks
        const mobileFrameworks = ['react-native', '@react-native/core', 'expo'];
        technologies.mobile = mobileFrameworks.filter(fw => dependencies[fw]);

        return technologies;
    }

    private inferProjectType(technologies: ProjectContext['technologies']): ProjectContext['projectType'] {
        if (technologies.mobile && technologies.mobile.length > 0) {
            return 'mobile';
        }
        
        if (technologies.frontend && technologies.backend && 
            technologies.frontend.length > 0 && technologies.backend.length > 0) {
            return 'fullstack';
        }
        
        if (technologies.frontend && technologies.frontend.length > 0) {
            return 'frontend';
        }
        
        if (technologies.backend && technologies.backend.length > 0) {
            return 'backend';
        }
        
        return 'library';
    }

    private async getExistingFiles(workspaceRoot: string): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(workspaceRoot));
            
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && !name.startsWith('.')) {
                    files.push(name);
                } else if (type === vscode.FileType.Directory && 
                          !name.startsWith('.') && 
                          !['node_modules', 'dist', 'build'].includes(name)) {
                    // Recursively get files from important directories
                    const subFiles = await this.getFilesFromDirectory(
                        path.join(workspaceRoot, name), 
                        name, 
                        2 // Max depth
                    );
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error('Error reading workspace files:', error);
        }
        
        return files;
    }

    private async getFilesFromDirectory(dirPath: string, prefix: string, maxDepth: number): Promise<string[]> {
        if (maxDepth <= 0) {return [];}
        
        const files: string[] = [];
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            
            for (const [name, type] of entries) {
                const relativePath = `${prefix}/${name}`;
                
                if (type === vscode.FileType.File && !name.startsWith('.')) {
                    files.push(relativePath);
                } else if (type === vscode.FileType.Directory && 
                          !name.startsWith('.') && 
                          !['node_modules', 'dist', 'build'].includes(name)) {
                    const subFiles = await this.getFilesFromDirectory(
                        path.join(dirPath, name), 
                        relativePath, 
                        maxDepth - 1
                    );
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            // Ignore permission errors
        }
        
        return files;
    }

    // Utility methods for agents
    static generatePromptWithContext(
        operation: 'create' | 'edit' | 'replace',
        fileName: string,
        prompt: string,
        context: ProjectContext,
        agentCapabilities: string[]
    ): string {
        let enhancedPrompt = `You are a specialized ${path.extname(fileName).slice(1).toUpperCase()} file agent.

Operation: ${operation.toUpperCase()} ${fileName}
Request: ${prompt}

Project Context:
- Type: ${context.projectType}
- Workspace: ${path.basename(context.workspaceRoot)}`;

        if (context.technologies.frontend?.length) {
            enhancedPrompt += `\n- Frontend: ${context.technologies.frontend.join(', ')}`;
        }
        if (context.technologies.backend?.length) {
            enhancedPrompt += `\n- Backend: ${context.technologies.backend.join(', ')}`;
        }
        if (context.technologies.database?.length) {
            enhancedPrompt += `\n- Database: ${context.technologies.database.join(', ')}`;
        }
        if (context.technologies.testing?.length) {
            enhancedPrompt += `\n- Testing: ${context.technologies.testing.join(', ')}`;
        }

        enhancedPrompt += `\n\nAgent Capabilities: ${agentCapabilities.join(', ')}`;

        if (context.existingFiles.length > 0) {
            const relevantFiles = context.existingFiles
                .filter(file => path.extname(file).slice(1) === path.extname(fileName).slice(1))
                .slice(0, 5);
            
            if (relevantFiles.length > 0) {
                enhancedPrompt += `\n\nExisting ${path.extname(fileName).slice(1).toUpperCase()} files: ${relevantFiles.join(', ')}`;
            }
        }

        enhancedPrompt += `\n\nGenerate professional, production-ready code that integrates well with the existing project structure.`;

        if (operation === 'edit') {
            enhancedPrompt += `\nWhen editing, preserve existing functionality and add the requested changes seamlessly.`;
        } else if (operation === 'replace') {
            enhancedPrompt += `\nWhen replacing, maintain the file's purpose but implement the requested changes comprehensively.`;
        }

        return enhancedPrompt;
    }

    // Performance monitoring
    getAgentPerformanceStats(): Map<string, {
        totalOperations: number;
        successRate: number;
        avgExecutionTime: number;
    }> {
        // This would be implemented with actual performance tracking
        const stats = new Map();
        
        for (const agent of this.agents.values()) {
            stats.set(agent.name, {
                totalOperations: 0,
                successRate: 100,
                avgExecutionTime: 0
            });
        }
        
        return stats;
    }

    // Health check for all agents
    async performHealthCheck(): Promise<Map<string, boolean>> {
        const healthStatus = new Map<string, boolean>();
        
        for (const [name, agent] of this.agents.entries()) {
            try {
                // Simple validation test
                const testResult = agent.analyzeContent('// Test comment');
                healthStatus.set(name, testResult.language !== '');
            } catch (error) {
                healthStatus.set(name, false);
                console.error(`Health check failed for ${name}:`, error);
            }
        }
        
        return healthStatus;
    }
}

// Export singleton instance
export const fileExtensionRegistry = FileExtensionAgentRegistry.getInstance();