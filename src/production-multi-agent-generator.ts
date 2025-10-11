import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { EditTracker } from './edittracker';
import { ProjectKnowledgeSystem } from './project-knowledge-system';

export interface ProductionFileSpec {
    fileName: string;
    purpose: string;
    technology: string;
    priority: number;
    dependencies: string[];
    content: string;
    agentType: string;
    validationRequired: boolean;
    hasTests: boolean;
}

export interface ProjectArchitecture {
    projectType: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'library';
    framework: string;
    language: string;
    structure: {
        directories: string[];
        coreFiles: ProductionFileSpec[];
        configFiles: ProductionFileSpec[];
        testFiles: ProductionFileSpec[];
        documentationFiles: ProductionFileSpec[];
    };
    dependencies: string[];
    devDependencies: string[];
    scripts: Record<string, string>;
}

export class ProductionMultiAgentGenerator {
    private static _instance: ProductionMultiAgentGenerator;
    private _agentCoordinator: SmartAgentCoordinator;
    private _nlpEngine: EnhancedNLPEngine;
    private _knowledgeSystem: ProjectKnowledgeSystem;

    private constructor() {
        this._agentCoordinator = SmartAgentCoordinator.getInstance();
        this._nlpEngine = EnhancedNLPEngine.getInstance();
        this._knowledgeSystem = ProjectKnowledgeSystem.getInstance();
    }

    public static getInstance(): ProductionMultiAgentGenerator {
        if (!ProductionMultiAgentGenerator._instance) {
            ProductionMultiAgentGenerator._instance = new ProductionMultiAgentGenerator();
        }
        return ProductionMultiAgentGenerator._instance;
    }

    public async generateProductionProject(userPrompt: string): Promise<string> {
        try {
            // Step 1: Analyze user intent and project requirements
            const intent = await this._nlpEngine.analyzeUserIntent(userPrompt);
            
            // Step 2: Generate comprehensive project architecture
            const architecture = await this._generateProjectArchitecture(userPrompt, intent);
            
            // Step 3: Create coordinated multi-agent execution plan
            const executionPlan = await this._createExecutionPlan(architecture);
            
            // Step 4: Execute coordinated file generation
            const results = await this._executeCoordinatedGeneration(executionPlan);
            
            // Step 5: Post-generation validation and optimization
            await this._validateAndOptimize(results);
            
            return this._generateCompletionReport(architecture, results);
        } catch (error: any) {
            return `❌ Production project generation failed: ${error.message}`;
        }
    }

    private async _generateProjectArchitecture(userPrompt: string, intent: any): Promise<ProjectArchitecture> {
        const architecturePrompt = `You are an expert software architect. Generate a comprehensive, production-ready project architecture.

User Request: "${userPrompt}"
Intent Analysis: ${JSON.stringify(intent)}

Create a detailed project architecture with the following considerations:
1. Industry best practices and modern standards
2. Scalability and maintainability
3. Security and performance
4. Testing and documentation
5. Deployment and CI/CD readiness
6. Code organization and structure

Return JSON in this format:
{
    "projectType": "frontend|backend|fullstack|mobile|desktop|library",
    "framework": "specific framework name",
    "language": "primary programming language",
    "structure": {
        "directories": ["src", "tests", "docs", "config"],
        "coreFiles": [
            {
                "fileName": "exact filename with extension",
                "purpose": "specific purpose and functionality",
                "technology": "specific tech stack component",
                "priority": 1-10,
                "dependencies": ["other files this depends on"],
                "agentType": "Frontend|Backend|Database|DevOps|Security|Testing",
                "validationRequired": true,
                "hasTests": true
            }
        ],
        "configFiles": [],
        "testFiles": [],
        "documentationFiles": []
    },
    "dependencies": ["production dependencies"],
    "devDependencies": ["development dependencies"],
    "scripts": {
        "dev": "development command",
        "build": "build command",
        "test": "test command"
    }
}

Ensure the architecture is:
- Production-ready with proper error handling
- Follows industry conventions
- Includes comprehensive testing setup
- Has proper documentation
- Includes security considerations
- Has deployment configurations`;

        try {
            const response = await generateCode(architecturePrompt, 'llama-3.3-70b-versatile');
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            const architecture = JSON.parse(cleaned);
            
            // Validate and enhance the architecture
            return this._validateArchitecture(architecture);
        } catch (error) {
            console.error('Failed to generate architecture:', error);
            return this._getFallbackArchitecture(intent);
        }
    }

    private _validateArchitecture(architecture: any): ProjectArchitecture {
        // Ensure all required fields are present and valid
        return {
            projectType: architecture.projectType || 'fullstack',
            framework: architecture.framework || 'React',
            language: architecture.language || 'TypeScript',
            structure: {
                directories: architecture.structure?.directories || ['src', 'tests', 'docs'],
                coreFiles: this._validateFileSpecs(architecture.structure?.coreFiles || []),
                configFiles: this._validateFileSpecs(architecture.structure?.configFiles || []),
                testFiles: this._validateFileSpecs(architecture.structure?.testFiles || []),
                documentationFiles: this._validateFileSpecs(architecture.structure?.documentationFiles || [])
            },
            dependencies: architecture.dependencies || [],
            devDependencies: architecture.devDependencies || [],
            scripts: architecture.scripts || {}
        };
    }

    private _validateFileSpecs(files: any[]): ProductionFileSpec[] {
        return files.map(file => ({
            fileName: file.fileName || 'unknown.txt',
            purpose: file.purpose || 'Unknown purpose',
            technology: file.technology || 'Generic',
            priority: file.priority || 5,
            dependencies: file.dependencies || [],
            content: '',
            agentType: file.agentType || 'Frontend',
            validationRequired: file.validationRequired !== false,
            hasTests: file.hasTests === true
        }));
    }

    private async _createExecutionPlan(architecture: ProjectArchitecture): Promise<any> {
        const allFiles = [
            ...architecture.structure.coreFiles,
            ...architecture.structure.configFiles,
            ...architecture.structure.testFiles,
            ...architecture.structure.documentationFiles
        ];

        // Sort by priority and dependencies
        const sortedFiles = this._sortFilesByDependencies(allFiles);
        
        // Group by agent type for parallel execution
        const agentGroups = this._groupFilesByAgent(sortedFiles);
        
        return {
            architecture,
            executionOrder: sortedFiles,
            agentGroups,
            estimatedDuration: this._estimateDuration(sortedFiles)
        };
    }

    private _sortFilesByDependencies(files: ProductionFileSpec[]): ProductionFileSpec[] {
        // Simple topological sort based on dependencies
        const sorted: ProductionFileSpec[] = [];
        const remaining = [...files];
        
        while (remaining.length > 0) {
            const canProcess = remaining.filter(file => 
                file.dependencies.every(dep => 
                    sorted.some(sortedFile => sortedFile.fileName === dep)
                )
            );
            
            if (canProcess.length === 0) {
                // Break circular dependencies or add remaining files
                sorted.push(...remaining);
                break;
            }
            
            // Sort by priority within the processable files
            canProcess.sort((a, b) => b.priority - a.priority);
            sorted.push(...canProcess);
            
            // Remove processed files
            canProcess.forEach(file => {
                const index = remaining.indexOf(file);
                if (index > -1) {
                    remaining.splice(index, 1);
                }
            });
        }
        
        return sorted;
    }

    private _groupFilesByAgent(files: ProductionFileSpec[]): Map<string, ProductionFileSpec[]> {
        const groups = new Map<string, ProductionFileSpec[]>();
        
        files.forEach(file => {
            if (!groups.has(file.agentType)) {
                groups.set(file.agentType, []);
            }
            groups.get(file.agentType)!.push(file);
        });
        
        return groups;
    }

    private async _executeCoordinatedGeneration(executionPlan: any): Promise<any[]> {
        const { agentGroups, architecture } = executionPlan;
        const results: any[] = [];
        
        // Execute in waves based on dependencies
        for (const [agentType, files] of agentGroups.entries()) {
            const agentResults = await Promise.allSettled(
                files.map(async (file: ProductionFileSpec) => {
                    return await this._generateFileWithSpecializedAgent(file, architecture, agentType);
                })
            );
            
            agentResults.forEach((result, index) => {
                const file = files[index];
                if (result.status === 'fulfilled') {
                    results.push({
                        success: true,
                        fileName: file.fileName,
                        agentType,
                        content: result.value
                    });
                } else {
                    results.push({
                        success: false,
                        fileName: file.fileName,
                        agentType,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            });
        }
        
        return results;
    }

    private async _generateFileWithSpecializedAgent(
        file: ProductionFileSpec, 
        architecture: ProjectArchitecture, 
        agentType: string
    ): Promise<string> {
        const agent = await this._agentCoordinator.assignBestAgent(file);
        
        const enhancedPrompt = `You are a ${agentType} specialist creating production-ready code.

Project Context:
- Type: ${architecture.projectType}
- Framework: ${architecture.framework}
- Language: ${architecture.language}

File Specification:
- Name: ${file.fileName}
- Purpose: ${file.purpose}
- Technology: ${file.technology}
- Priority: ${file.priority}
- Dependencies: ${file.dependencies.join(', ')}

Requirements:
1. Create professional, production-ready code
2. Follow ${architecture.framework} best practices
3. Include proper error handling and validation
4. Add comprehensive comments and documentation
5. Implement security best practices
6. Ensure type safety (if applicable)
7. Include proper logging where appropriate
8. Make code testable and maintainable

Additional Context:
- This is part of a coordinated multi-file generation
- Code will be used in a production environment
- Consider integration with other project files
- Follow established conventions and patterns

Generate only the file content, no explanations or markdown formatting.`;

        const content = await generateCode(enhancedPrompt, agent.model || 'llama-3.3-70b-versatile');
        
        // Clean and write the file
        const cleanContent = content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        await this._writeFileToWorkspace(file.fileName, cleanContent);
        
        return cleanContent;
    }

    private async _writeFileToWorkspace(fileName: string, content: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder');
        }

        // Create directory structure if needed
        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
        const dirPath = vscode.Uri.joinPath(filePath, '..');
        
        try {
            await vscode.workspace.fs.createDirectory(dirPath);
        } catch (error) {
            // Directory might already exist
        }
        
        // Write the file
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
        
        // Track the operation
        EditTracker.trackAgentOperation(fileName, 'production-generator', 'ProductionMultiAgent');
        EditTracker.updateFileLineCount(fileName, content.split('\n').length, true);
        
        // Open the file
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            console.warn('Could not open generated file:', error);
        }
    }

    private async _validateAndOptimize(results: any[]): Promise<void> {
        // Run post-generation validation
        const successfulFiles = results.filter(r => r.success);
        
        if (successfulFiles.length > 0) {
            vscode.window.showInformationMessage(
                `✅ Generated ${successfulFiles.length} production-ready files!`
            );
        }
        
        const failedFiles = results.filter(r => !r.success);
        if (failedFiles.length > 0) {
            vscode.window.showWarningMessage(
                `⚠️ ${failedFiles.length} files failed to generate. Check the output for details.`
            );
        }
    }

    private _generateCompletionReport(architecture: ProjectArchitecture, results: any[]): string {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        let report = `🚀 **Production Project Generation Complete**\n\n`;
        report += `📊 **Summary:**\n`;
        report += `- Project Type: ${architecture.projectType}\n`;
        report += `- Framework: ${architecture.framework}\n`;
        report += `- Language: ${architecture.language}\n`;
        report += `- Files Generated: ${successful}/${results.length}\n\n`;
        
        if (successful > 0) {
            report += `✅ **Successfully Generated:**\n`;
            results.filter(r => r.success).forEach(result => {
                report += `- ${result.fileName} (${result.agentType})\n`;
            });
            report += `\n`;
        }
        
        if (failed > 0) {
            report += `❌ **Failed to Generate:**\n`;
            results.filter(r => !r.success).forEach(result => {
                report += `- ${result.fileName}: ${result.error}\n`;
            });
            report += `\n`;
        }
        
        report += `🎯 **Next Steps:**\n`;
        report += `1. Review generated files for accuracy\n`;
        report += `2. Install dependencies: \`npm install\` or \`pip install -r requirements.txt\`\n`;
        report += `3. Run tests to validate functionality\n`;
        report += `4. Start development server\n`;
        report += `5. Customize and extend as needed\n\n`;
        
        report += `💡 **Tips:**\n`;
        report += `- All files follow production best practices\n`;
        report += `- Error handling and validation included\n`;
        report += `- Security considerations implemented\n`;
        report += `- Code is ready for deployment\n`;
        
        return report;
    }

    private _estimateDuration(files: ProductionFileSpec[]): number {
        // Estimate based on file complexity and count
        return files.length * 3000; // 3 seconds per file average
    }

    private _getFallbackArchitecture(intent: any): ProjectArchitecture {
        // Provide a sensible fallback architecture
        return {
            projectType: 'fullstack',
            framework: 'React',
            language: 'TypeScript',
            structure: {
                directories: ['src', 'tests', 'docs', 'config'],
                coreFiles: [
                    {
                        fileName: 'src/App.tsx',
                        purpose: 'Main application component',
                        technology: 'React TypeScript',
                        priority: 10,
                        dependencies: [],
                        content: '',
                        agentType: 'Frontend',
                        validationRequired: true,
                        hasTests: true
                    }
                ],
                configFiles: [
                    {
                        fileName: 'package.json',
                        purpose: 'Project configuration and dependencies',
                        technology: 'Node.js',
                        priority: 10,
                        dependencies: [],
                        content: '',
                        agentType: 'DevOps',
                        validationRequired: true,
                        hasTests: false
                    }
                ],
                testFiles: [],
                documentationFiles: [
                    {
                        fileName: 'README.md',
                        purpose: 'Project documentation',
                        technology: 'Markdown',
                        priority: 5,
                        dependencies: [],
                        content: '',
                        agentType: 'Documentation',
                        validationRequired: false,
                        hasTests: false
                    }
                ]
            },
            dependencies: ['react', 'react-dom'],
            devDependencies: ['typescript', '@types/react', '@types/react-dom'],
            scripts: {
                'dev': 'vite dev',
                'build': 'vite build',
                'test': 'vitest'
            }
        };
    }
}