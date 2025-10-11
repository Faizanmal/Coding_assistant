import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { ChatFileManager } from './chatfilemanager';

export interface FileCreationRequest {
    fileName: string;
    description: string;
    fileType: string;
    targetDirectory?: string;
    dependencies?: string[];
    templateType?: string;
}

export interface SmartFileContext {
    projectType: string;
    framework: string;
    language: string;
    existingFiles: string[];
    suggestedDirectory: string;
}

export class SmartFileOperation {
    private static workspaceRoot: string = '';
    private static projectContext: SmartFileContext | null = null;

    static initialize() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            this.workspaceRoot = workspace.uri.fsPath;
            this.analyzeProjectContext();
        }
    }

    /**
     * Enhanced NLP parser for sophisticated file creation commands
     */
    static async parseSmartFileCommand(command: string): Promise<FileCreationRequest[]> {
        const normalizedCommand = command.toLowerCase().trim();
        
        // Handle multiple file creation patterns
        if (this.isMultiFileCommand(normalizedCommand)) {
            return await this.parseMultiFileCommand(command);
        }
        
        // Handle complex single file creation
        if (this.isSmartFileCommand(normalizedCommand)) {
            return await this.parseComplexFileCommand(command);
        }
        
        // Handle template-based creation
        if (this.isTemplateCommand(normalizedCommand)) {
            return await this.parseTemplateCommand(command);
        }
        
        // Fallback to basic file creation
        return await this.parseBasicFileCommand(command);
    }

    /**
     * Check if command involves multiple file creation
     */
    private static isMultiFileCommand(command: string): boolean {
        const multiFileIndicators = [
            'create multiple',
            'generate several',
            'make files',
            'build project',
            'setup workspace',
            'scaffold',
            'and also create',
            'along with',
            'including'
        ];
        
        return multiFileIndicators.some(indicator => command.includes(indicator)) ||
               (command.match(/,/g) || []).length >= 2;
    }

    /**
     * Check if command is a smart/complex file creation
     */
    private static isSmartFileCommand(command: string): boolean {
        const smartIndicators = [
            'with dependencies',
            'using framework',
            'following best practices',
            'with proper structure',
            'enterprise grade',
            'production ready',
            'with tests',
            'with documentation',
            'full featured'
        ];
        
        return smartIndicators.some(indicator => command.includes(indicator));
    }

    /**
     * Check if command uses template-based creation
     */
    private static isTemplateCommand(command: string): boolean {
        const templateIndicators = [
            'template',
            'boilerplate',
            'starter',
            'skeleton',
            'scaffold',
            'blueprint'
        ];
        
        return templateIndicators.some(indicator => command.includes(indicator));
    }

    /**
     * Parse multiple file creation commands
     */
    private static async parseMultiFileCommand(command: string): Promise<FileCreationRequest[]> {
        const requests: FileCreationRequest[] = [];
        
        // Try to extract file mentions
        const filePatterns = [
            /create\s+([^,\s]+\.[^,\s]+)/gi,
            /make\s+([^,\s]+\.[^,\s]+)/gi,
            /generate\s+([^,\s]+\.[^,\s]+)/gi,
            /([^,\s]+\.[^,\s]+)\s+(?:with|containing|for)/gi
        ];
        
        const foundFiles = new Set<string>();
        
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(command)) !== null) {
                foundFiles.add(match[1]);
            }
        }
        
        // If no specific files found, try to infer from project context
        if (foundFiles.size === 0) {
            return await this.inferFilesFromDescription(command);
        }
        
        // Process each found file
        for (const fileName of foundFiles) {
            const description = this.extractDescriptionForFile(command, fileName);
            const fileType = this.determineFileType(fileName);
            const targetDirectory = this.suggestDirectory(fileName, fileType);
            
            requests.push({
                fileName,
                description: description || `Generated ${fileType} file`,
                fileType,
                targetDirectory,
                dependencies: await this.inferDependencies(fileName, description),
                templateType: this.suggestTemplate(fileName, fileType)
            });
        }
        
        return requests;
    }

    /**
     * Parse complex single file creation commands
     */
    private static async parseComplexFileCommand(command: string): Promise<FileCreationRequest[]> {
        const fileName = this.extractFileName(command) || await this.generateSmartFileName(command);
        const description = this.extractComplexDescription(command);
        const fileType = this.determineFileType(fileName);
        
        return [{
            fileName,
            description,
            fileType,
            targetDirectory: this.suggestDirectory(fileName, fileType),
            dependencies: await this.inferDependencies(fileName, description),
            templateType: this.suggestTemplate(fileName, fileType)
        }];
    }

    /**
     * Parse template-based creation commands
     */
    private static async parseTemplateCommand(command: string): Promise<FileCreationRequest[]> {
        const templateType = this.extractTemplateType(command);
        const projectName = this.extractProjectName(command);
        
        return await this.generateTemplateFiles(templateType, projectName, command);
    }

    /**
     * Parse basic file creation commands (fallback)
     */
    private static async parseBasicFileCommand(command: string): Promise<FileCreationRequest[]> {
        const fileName = this.extractFileName(command);
        const description = this.extractBasicDescription(command);
        
        if (!fileName) {
            throw new Error('Could not determine file name from command');
        }
        
        const fileType = this.determineFileType(fileName);
        
        return [{
            fileName,
            description: description || `Basic ${fileType} file`,
            fileType,
            targetDirectory: this.suggestDirectory(fileName, fileType)
        }];
    }

    /**
     * Execute smart file creation
     */
    static async executeSmartFileCreation(requests: FileCreationRequest[]): Promise<string> {
        const results: string[] = [];
        
        for (const request of requests) {
            try {
                const result = await this.createSmartFile(request);
                results.push(result);
            } catch (error: any) {
                results.push(`❌ Failed to create ${request.fileName}: ${error.message}`);
            }
        }
        
        return results.join('\n\n');
    }

    /**
     * Create a single smart file
     */
    private static async createSmartFile(request: FileCreationRequest): Promise<string> {
        const targetPath = path.join(
            this.workspaceRoot,
            request.targetDirectory || '',
            request.fileName
        );
        
        // Check if file exists
        if (fs.existsSync(targetPath)) {
            const confirm = await vscode.window.showWarningMessage(
                `File "${request.fileName}" already exists. Overwrite?`,
                'Yes', 'No'
            );
            if (confirm !== 'Yes') {
                return `❌ File creation cancelled: ${request.fileName}`;
            }
        }
        
        // Generate enhanced content
        const content = await this.generateEnhancedContent(request);
        
        // Ensure directory exists
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write file
        fs.writeFileSync(targetPath, content);
        
        // Open file in editor
        await vscode.window.showTextDocument(vscode.Uri.file(targetPath));
        
        const relativePath = path.relative(this.workspaceRoot, targetPath);
        
        return `✅ Created smart file: ${relativePath}
📁 Location: ${request.targetDirectory || 'root'}
📄 Type: ${request.fileType}
${request.templateType ? `🎯 Template: ${request.templateType}` : ''}
${request.dependencies?.length ? `📦 Dependencies: ${request.dependencies.join(', ')}` : ''}
📏 Lines: ${content.split('\n').length}`;
    }

    /**
     * Generate enhanced file content using AI
     */
    private static async generateEnhancedContent(request: FileCreationRequest): Promise<string> {
        const contextInfo = this.buildContextPrompt(request);
        
        const prompt = `Generate high-quality ${request.fileType} code for file "${request.fileName}".

${contextInfo}

Requirements: ${request.description}

${request.templateType ? `Use ${request.templateType} template structure.` : ''}
${request.dependencies?.length ? `Include these dependencies: ${request.dependencies.join(', ')}` : ''}

Follow best practices for ${request.fileType} development.
Include proper error handling, documentation, and type safety where applicable.
Make the code production-ready and well-structured.

Return only the file content:`;

        return await generateCode(prompt, 'llama-3.3-70b-versatile');
    }

    /**
     * Build context prompt for AI generation
     */
    private static buildContextPrompt(request: FileCreationRequest): string {
        if (!this.projectContext) {
            return 'Generic project context.';
        }
        
        return `Project Context:
- Type: ${this.projectContext.projectType}
- Framework: ${this.projectContext.framework}
- Language: ${this.projectContext.language}
- Target Directory: ${request.targetDirectory || 'root'}
- Existing Files: ${this.projectContext.existingFiles.slice(0, 10).join(', ')}`;
    }

    /**
     * Analyze project context
     */
    private static analyzeProjectContext(): void {
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        const tsConfigPath = path.join(this.workspaceRoot, 'tsconfig.json');
        
        let projectType = 'generic';
        let framework = 'none';
        let language = 'javascript';
        
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                // Detect framework
                if (packageJson.dependencies?.react) {framework = 'react';}
                else if (packageJson.dependencies?.vue) {framework = 'vue';}
                else if (packageJson.dependencies?.angular) {framework = 'angular';}
                else if (packageJson.dependencies?.express) {framework = 'express';}
                else if (packageJson.dependencies?.next) {framework = 'nextjs';}
                
                projectType = 'nodejs';
            } catch (error) {
                console.warn('Could not parse package.json');
            }
        }
        
        if (fs.existsSync(tsConfigPath)) {
            language = 'typescript';
        }
        
        const existingFiles = this.scanExistingFiles();
        
        this.projectContext = {
            projectType,
            framework,
            language,
            existingFiles,
            suggestedDirectory: this.determineSuggestedDirectory(projectType, framework)
        };
    }

    /**
     * Scan existing files in project
     */
    private static scanExistingFiles(): string[] {
        const files: string[] = [];
        
        try {
            const scanDir = (dir: string, depth = 0) => {
                if (depth > 3) {return;} // Limit depth
                
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith('.') || item === 'node_modules') {continue;}
                    
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isFile()) {
                        files.push(path.relative(this.workspaceRoot, fullPath));
                    } else if (stat.isDirectory()) {
                        scanDir(fullPath, depth + 1);
                    }
                }
            };
            
            scanDir(this.workspaceRoot);
        } catch (error) {
            console.warn('Error scanning files:', error);
        }
        
        return files;
    }

    // Helper methods for parsing
    private static extractFileName(command: string): string | null {
        const patterns = [
            /(?:create|make|generate|build)\s+["']?([^"'\s,]+\.[^"'\s,]+)["']?/i,
            /["']([^"']+\.[^"']+)["']/,
            /\b([a-zA-Z0-9_/-]+\.[a-zA-Z0-9]+)\b/
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1];}
        }
        
        return null;
    }

    private static extractComplexDescription(command: string): string {
        const patterns = [
            /(?:with|containing|that|which)\s+(.+?)(?:\s+(?:and|also|including|plus)|\.|$)/i,
            /(?:should|must|needs to)\s+(.+?)(?:\s+(?:and|also|including|plus)|\.|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return 'Advanced file with smart features';
    }

    private static determineFileType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        
        const typeMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'react',
            '.tsx': 'react-typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.css': 'css',
            '.scss': 'scss',
            '.html': 'html',
            '.json': 'json',
            '.md': 'markdown',
            '.sql': 'sql',
            '.yml': 'yaml',
            '.yaml': 'yaml'
        };
        
        return typeMap[ext] || 'text';
    }

    private static suggestDirectory(fileName: string, fileType: string): string {
        const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
        
        // Component files
        if (baseName.includes('component') || fileType.includes('react')) {
            return this.findBestDirectory(['src/components', 'components', 'src']);
        }
        
        // Test files
        if (baseName.includes('test') || baseName.includes('spec')) {
            return this.findBestDirectory(['src/test', 'test', '__tests__', 'tests']);
        }
        
        // Style files
        if (fileType === 'css' || fileType === 'scss') {
            return this.findBestDirectory(['src/styles', 'styles', 'css', 'src']);
        }
        
        // API/Route files
        if (baseName.includes('api') || baseName.includes('route')) {
            return this.findBestDirectory(['src/api', 'api', 'routes', 'src']);
        }
        
        // General source files
        if (['javascript', 'typescript', 'python'].includes(fileType)) {
            return this.findBestDirectory(['src', '']);
        }
        
        return '';
    }

    private static findBestDirectory(candidates: string[]): string {
        for (const candidate of candidates) {
            const fullPath = path.join(this.workspaceRoot, candidate);
            if (fs.existsSync(fullPath)) {
                return candidate;
            }
        }
        
        return candidates[0] || '';
    }

    // Additional helper methods implementation
    private static extractDescriptionForFile(command: string, fileName: string): string {
        // Extract description specific to a file
        const fileKeywords = fileName.replace(/\.[^.]+$/, '').toLowerCase();
        const sentences = command.split(/[.,;]/);
        
        for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(fileKeywords)) {
                return sentence.trim();
            }
        }
        
        return `Smart implementation for ${fileName}`;
    }

    private static async inferDependencies(fileName: string, description: string): Promise<string[]> {
        const dependencies: string[] = [];
        const descLower = description.toLowerCase();
        const fileExt = path.extname(fileName).toLowerCase();
        
        // JavaScript/TypeScript dependencies
        if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
            if (descLower.includes('react')) {dependencies.push('react', 'react-dom');}
            if (descLower.includes('express')) {dependencies.push('express');}
            if (descLower.includes('axios')) {dependencies.push('axios');}
            if (descLower.includes('test')) {dependencies.push('jest', '@testing-library/react');}
            if (descLower.includes('style')) {dependencies.push('styled-components');}
        }
        
        // Python dependencies
        if (fileExt === '.py') {
            if (descLower.includes('flask')) {dependencies.push('flask');}
            if (descLower.includes('django')) {dependencies.push('django');}
            if (descLower.includes('test')) {dependencies.push('pytest');}
            if (descLower.includes('request')) {dependencies.push('requests');}
        }
        
        return dependencies;
    }

    private static suggestTemplate(fileName: string, fileType: string): string | undefined {
        const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
        
        if (fileType === 'react' || fileType === 'react-typescript') {
            if (baseName.includes('component')) {return 'react-component';}
            if (baseName.includes('hook')) {return 'react-hook';}
            if (baseName.includes('context')) {return 'react-context';}
        }
        
        if (fileType === 'javascript' || fileType === 'typescript') {
            if (baseName.includes('api') || baseName.includes('route')) {return 'api-route';}
            if (baseName.includes('service')) {return 'service-class';}
            if (baseName.includes('util')) {return 'utility-functions';}
        }
        
        if (baseName.includes('test') || baseName.includes('spec')) {
            return 'test-suite';
        }
        
        return undefined;
    }

    private static async generateSmartFileName(command: string): Promise<string> {
        const descriptionWords = command.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        
        // Find relevant keywords
        const relevantWords = descriptionWords.filter(word => 
            !['create', 'make', 'generate', 'build', 'file', 'with', 'and', 'the', 'for'].includes(word)
        );
        
        let baseName = relevantWords.slice(0, 2).join('-') || 'smart-file';
        
        // Determine extension based on context
        let extension = '.js'; // default
        
        if (command.includes('typescript') || command.includes('ts')) {extension = '.ts';}
        else if (command.includes('react') && command.includes('typescript')) {extension = '.tsx';}
        else if (command.includes('react')) {extension = '.jsx';}
        else if (command.includes('python')) {extension = '.py';}
        else if (command.includes('style') || command.includes('css')) {extension = '.css';}
        else if (command.includes('test')) {extension = '.test.js';}
        
        return baseName + extension;
    }

    private static extractTemplateType(command: string): string {
        if (command.includes('react')) {return 'react-app';}
        if (command.includes('express')) {return 'express-api';}
        if (command.includes('node')) {return 'nodejs-app';}
        if (command.includes('vue')) {return 'vue-app';}
        if (command.includes('angular')) {return 'angular-app';}
        if (command.includes('python')) {return 'python-project';}
        
        return 'basic';
    }

    private static extractProjectName(command: string): string {
        const namePatterns = [
            /(?:project|app|application)\s+(?:named|called)\s+([a-zA-Z0-9-_]+)/i,
            /([a-zA-Z0-9-_]+)\s+(?:project|app|application)/i
        ];
        
        for (const pattern of namePatterns) {
            const match = command.match(pattern);
            if (match) {return match[1];}
        }
        
        return 'smart-project';
    }

    private static async generateTemplateFiles(templateType: string, projectName: string, command: string): Promise<FileCreationRequest[]> {
        const requests: FileCreationRequest[] = [];
        
        switch (templateType) {
            case 'react-app':
                requests.push(
                    { fileName: 'App.jsx', description: 'Main React application component', fileType: 'react', targetDirectory: 'src' },
                    { fileName: 'index.js', description: 'React application entry point', fileType: 'javascript', targetDirectory: 'src' },
                    { fileName: 'App.css', description: 'Main application styles', fileType: 'css', targetDirectory: 'src' },
                    { fileName: 'package.json', description: 'React project dependencies', fileType: 'json' }
                );
                break;
                
            case 'express-api':
                requests.push(
                    { fileName: 'server.js', description: 'Express server setup', fileType: 'javascript' },
                    { fileName: 'routes/api.js', description: 'API routes', fileType: 'javascript', targetDirectory: 'routes' },
                    { fileName: 'middleware/auth.js', description: 'Authentication middleware', fileType: 'javascript', targetDirectory: 'middleware' },
                    { fileName: 'package.json', description: 'Express project dependencies', fileType: 'json' }
                );
                break;
                
            case 'python-project':
                requests.push(
                    { fileName: 'main.py', description: 'Main Python application', fileType: 'python' },
                    { fileName: 'requirements.txt', description: 'Python dependencies', fileType: 'text' },
                    { fileName: 'config.py', description: 'Configuration settings', fileType: 'python' },
                    { fileName: 'tests/test_main.py', description: 'Unit tests', fileType: 'python', targetDirectory: 'tests' }
                );
                break;
                
            default:
                requests.push({
                    fileName: `${projectName}.js`,
                    description: `Basic ${templateType} file`,
                    fileType: 'javascript'
                });
        }
        
        return requests;
    }

    private static extractBasicDescription(command: string): string {
        const withPattern = /(?:with|containing|that has)\s+(.+)/i;
        const match = command.match(withPattern);
        
        if (match) {
            return match[1].trim();
        }
        
        return 'Basic file implementation';
    }

    private static async inferFilesFromDescription(command: string): Promise<FileCreationRequest[]> {
        const requests: FileCreationRequest[] = [];
        const descLower = command.toLowerCase();
        
        // Infer from common project patterns
        if (descLower.includes('react app') || descLower.includes('react project')) {
            return await this.generateTemplateFiles('react-app', 'react-project', command);
        }
        
        if (descLower.includes('express api') || descLower.includes('node server')) {
            return await this.generateTemplateFiles('express-api', 'express-project', command);
        }
        
        if (descLower.includes('python app') || descLower.includes('python project')) {
            return await this.generateTemplateFiles('python-project', 'python-project', command);
        }
        
        // Generic multi-file inference
        if (descLower.includes('component')) {
            requests.push({
                fileName: 'Component.jsx',
                description: 'React component',
                fileType: 'react',
                targetDirectory: 'src/components'
            });
        }
        
        if (descLower.includes('api')) {
            requests.push({
                fileName: 'api.js',
                description: 'API implementation',
                fileType: 'javascript',
                targetDirectory: 'src/api'
            });
        }
        
        if (descLower.includes('test')) {
            requests.push({
                fileName: 'test.js',
                description: 'Test suite',
                fileType: 'javascript',
                targetDirectory: 'tests'
            });
        }
        
        return requests;
    }

    private static determineSuggestedDirectory(projectType: string, framework: string): string {
        if (framework === 'react' || framework === 'vue' || framework === 'angular') {
            return 'src';
        }
        
        if (projectType === 'nodejs') {
            return 'src';
        }
        
        return '';
    }
}