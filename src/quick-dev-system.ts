import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getprojectcontext } from './extension';
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { EnhancedCodebaseUnderstanding } from './enhanced-codebase-understanding';
import { AugmentedIntelligenceSystem } from './augmented-intelligence-system';

/**
 * QuickDevSystem - A comprehensive system for automating common development workflows
 * with advanced intelligence, contextual awareness, and workflow optimization.
 * 
 * Features:
 * - Automated PR and commit message generation
 * - Interactive scaffolding system with intelligent templates
 * - Advanced code transformation with preview
 * - Contextual smart actions based on file type and content
 * - Cross-file refactoring with dependency updates
 */
export class QuickDevSystem {
    private static instance: QuickDevSystem;
    private projectInfo: any = {};
    private fileTemplates: Map<string, string> = new Map();
    private projectTemplates: Map<string, any> = new Map();
    private transformationHistory: any[] = [];
    private currentWorkspace: string | undefined;
    private fileAssociations: Map<string, string[]> = new Map();
    private patternLibrary: Map<string, RegExp> = new Map();
    private snippetLibrary: Map<string, string> = new Map();
    
    private constructor() {
        this.initializePatternLibrary();
        this.initializeTemplates();
        this.updateWorkspaceInfo();
        
        // Watch for workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.updateWorkspaceInfo();
        });
    }
    
    public static getInstance(): QuickDevSystem {
        if (!QuickDevSystem.instance) {
            QuickDevSystem.instance = new QuickDevSystem();
        }
        return QuickDevSystem.instance;
    }
    
    /**
     * Initialize common code patterns for detection
     */
    private initializePatternLibrary(): void {
        // File type patterns
        this.patternLibrary.set('react_component', /function\s+([A-Z][a-zA-Z0-9]*)\s*\(\s*(?:props|{[^}]*})\s*\)\s*{[\s\S]*return\s*\(/);
        this.patternLibrary.set('react_hook', /^const\s+\[\s*\w+\s*,\s*set[A-Z]/m);
        this.patternLibrary.set('test_file', /(?:describe|test|it)\s*\(\s*['"].*['"]\s*,\s*(?:async\s*)?\(\s*\)\s*=>/);
        this.patternLibrary.set('api_route', /(?:router|app|server)\.(?:get|post|put|delete|patch)\s*\(\s*['"\/]/);
        this.patternLibrary.set('class_definition', /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*{/);
        
        // Common code smells
        this.patternLibrary.set('nested_callbacks', /(?:function|=>)\s*\([^)]*\)\s*{\s*[^{}]*(?:function|=>)\s*\([^)]*\)\s*{\s*[^{}]*(?:function|=>)\s*\(/);
        this.patternLibrary.set('long_method', /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)\s*{[\s\S]{500,}?}/);
        this.patternLibrary.set('magic_numbers', /(?<![a-zA-Z0-9_"'`])(?:\d{4,}|[3-9]\d{2})(?![a-zA-Z0-9_"'`])/);
    }
    
    /**
     * Initialize code templates
     */
    private initializeTemplates(): void {
        // File templates
        this.fileTemplates.set('react_component', 
`import React from 'react';
import PropTypes from 'prop-types';
import styles from './$FILENAME$.module.css';

/**
 * $COMPONENT_NAME$ - $DESCRIPTION$
 */
export const $COMPONENT_NAME$ = ({ $PROPS$ }) => {
  return (
    <div className={styles.container}>
      $CONTENT$
    </div>
  );
};

$COMPONENT_NAME$.propTypes = {
  $PROP_TYPES$
};

$COMPONENT_NAME$.defaultProps = {
  $DEFAULT_PROPS$
};

export default $COMPONENT_NAME$;`);

        this.fileTemplates.set('react_test',
`import { render, screen, fireEvent } from '@testing-library/react';
import { $COMPONENT_NAME$ } from './$FILENAME$';

describe('$COMPONENT_NAME$', () => {
  const defaultProps = {
    $TEST_PROPS$
  };

  test('renders correctly', () => {
    render(<$COMPONENT_NAME$ {...defaultProps} />);
    $ASSERTIONS$
  });

  test('handles interactions correctly', () => {
    render(<$COMPONENT_NAME$ {...defaultProps} />);
    $INTERACTION_TEST$
  });
});`);

        this.fileTemplates.set('typescript_api',
`import { Request, Response, NextFunction } from 'express';
import { $MODEL_NAME$Service } from '../services/$SERVICE_FILE$';

/**
 * $CONTROLLER_NAME$ - Handles $DESCRIPTION$
 */
export class $CONTROLLER_NAME$ {
  /**
   * Get all $RESOURCE_NAME$
   */
  public static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await $MODEL_NAME$Service.findAll();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single $RESOURCE_NAME$ by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const result = await $MODEL_NAME$Service.findById(id);
      
      if (!result) {
        res.status(404).json({ message: '$RESOURCE_NAME$ not found' });
        return;
      }
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new $RESOURCE_NAME$
   */
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      const result = await $MODEL_NAME$Service.create(data);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  $ADDITIONAL_METHODS$
}`);

        // Project templates
        this.projectTemplates.set('express_api', {
            name: 'Express API',
            files: [
                { path: 'src/server.ts', template: 'express_server' },
                { path: 'src/config/index.ts', template: 'config_file' },
                { path: 'src/routes/index.ts', template: 'routes_index' },
                { path: 'src/controllers/index.ts', template: 'controllers_index' },
                { path: 'src/services/index.ts', template: 'services_index' },
                { path: 'src/models/index.ts', template: 'models_index' },
                { path: 'src/middleware/error.middleware.ts', template: 'error_middleware' },
                { path: 'src/middleware/auth.middleware.ts', template: 'auth_middleware' },
                { path: '.env.example', template: 'env_example' },
                { path: 'package.json', template: 'package_json' }
            ],
            variables: {
                PROJECT_NAME: '',
                API_VERSION: 'v1',
                DATABASE_TYPE: 'MongoDB',
                PORT: '3000'
            }
        });
        
        this.projectTemplates.set('react_component_library', {
            name: 'React Component Library',
            files: [
                { path: 'src/index.ts', template: 'component_library_index' },
                { path: 'src/components/index.ts', template: 'components_index' },
                { path: 'src/hooks/index.ts', template: 'hooks_index' },
                { path: 'src/utils/index.ts', template: 'utils_index' },
                { path: 'src/types/index.ts', template: 'types_index' },
                { path: 'package.json', template: 'component_library_package' },
                { path: 'tsconfig.json', template: 'tsconfig' },
                { path: 'rollup.config.js', template: 'rollup_config' },
                { path: '.storybook/main.js', template: 'storybook_main' },
                { path: '.storybook/preview.js', template: 'storybook_preview' }
            ],
            variables: {
                LIBRARY_NAME: '',
                SCOPE: '',
                AUTHOR: ''
            }
        });
    }
    
    /**
     * Update workspace information
     */
    private async updateWorkspaceInfo(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.currentWorkspace = undefined;
            return;
        }
        
        this.currentWorkspace = workspaceFolder.uri.fsPath;
        
        // Load package.json if exists
        const packageJsonPath = path.join(this.currentWorkspace, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(packageJsonContent);
                this.projectInfo.packageJson = packageJson;
                this.projectInfo.dependencies = packageJson.dependencies || {};
                this.projectInfo.devDependencies = packageJson.devDependencies || {};
                
                // Detect project type based on dependencies
                this.projectInfo.isReact = 
                    'react' in this.projectInfo.dependencies || 
                    'react' in this.projectInfo.devDependencies;
                    
                this.projectInfo.isNextJs = 
                    'next' in this.projectInfo.dependencies || 
                    'next' in this.projectInfo.devDependencies;
                    
                this.projectInfo.isNode = 
                    'express' in this.projectInfo.dependencies || 
                    'koa' in this.projectInfo.dependencies ||
                    'fastify' in this.projectInfo.dependencies;
                    
                this.projectInfo.isTypescript = 
                    'typescript' in this.projectInfo.dependencies || 
                    'typescript' in this.projectInfo.devDependencies;
                
                console.log(`📊 Project info updated: React=${this.projectInfo.isReact}, Next.js=${this.projectInfo.isNextJs}, Node=${this.projectInfo.isNode}, TS=${this.projectInfo.isTypescript}`);
            } catch (error) {
                console.error('Error reading package.json:', error);
            }
        }
        
        // Build file associations for related files
        await this.buildFileAssociations();
    }
    
    /**
     * Build associations between related files (component/test, model/controller, etc)
     */
    private async buildFileAssociations(): Promise<void> {
        if (!this.currentWorkspace) {
            return;
        }
        
        this.fileAssociations.clear();
        
        // Get understanding of project structure
        try {
            const codebaseUnderstanding = EnhancedCodebaseUnderstanding.getInstance();
            const projectAnalysis = await codebaseUnderstanding.analyzeCodebaseComprehensively();
            
            // Build file associations from project structure
            // For now, use a simple heuristic based on file paths
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,java,cs}');
                const filePaths = files.map(f => f.fsPath);
                
                // Group files by directory
                const dirGroups = new Map<string, string[]>();
                for (const filePath of filePaths) {
                    const dir = path.dirname(filePath);
                    if (!dirGroups.has(dir)) {
                        dirGroups.set(dir, []);
                    }
                    dirGroups.get(dir)!.push(filePath);
                }
                
                // Associate files in the same directory
                for (const [dir, files] of dirGroups) {
                    for (const file of files) {
                        this.fileAssociations.set(file, files.filter(f => f !== file));
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to build file associations:', error);
        }
    }
    
    /**
     * Generate a commit message based on git diff
     */
    public async generateCommitMessage(diffText: string): Promise<string> {
        try {
            const ais = AugmentedIntelligenceSystem.getInstance();
            
            const prompt = `Generate a concise and descriptive commit message based on the following git diff:\n\n${diffText}\n\nThe commit message should follow conventional commit format (type: description) and be limited to 72 characters for the first line, with an optional body separated by a blank line that provides more context about the change.`;
            
            const result = await ais.processRequest(prompt, 'code_explanation');
            return result.response;
        } catch (error: any) {
            console.error('Error generating commit message:', error);
            return 'Error generating commit message: ' + error.message;
        }
    }
    
    /**
     * Generate pull request description based on commit history
     */
    public async generatePRDescription(commits: string[], branchName: string): Promise<string> {
        try {
            const ais = AugmentedIntelligenceSystem.getInstance();
            const commitList = commits.join('\n');
            
            const prompt = `Generate a comprehensive pull request description based on the following commits and branch name:\n\nBranch: ${branchName}\n\nCommits:\n${commitList}\n\nInclude these sections:\n1. Summary - Brief overview of what this PR accomplishes\n2. Changes - Bullet list of main changes\n3. Testing - How to test these changes\n4. Notes - Any additional information reviewers should know`;
            
            const result = await ais.processRequest(prompt, 'documentation');
            return result.response;
        } catch (error: any) {
            console.error('Error generating PR description:', error);
            return 'Error generating PR description: ' + error.message;
        }
    }
    
    /**
     * Create a new file from template
     */
    public async createFileFromTemplate(
        templateKey: string, 
        filePath: string, 
        variables: Record<string, string>
    ): Promise<string> {
        if (!this.fileTemplates.has(templateKey)) {
            throw new Error(`Template '${templateKey}' not found`);
        }
        
        if (!this.currentWorkspace) {
            throw new Error('No workspace folder is open');
        }
        
        // Get template and apply variables
        let template = this.fileTemplates.get(templateKey)!;
        
        // Replace variables in template
        Object.entries(variables).forEach(([key, value]) => {
            template = template.replace(new RegExp(`\\$${key}\\$`, 'g'), value);
        });
        
        // Replace any remaining variables with placeholders
        template = template.replace(/\$[A-Z_]+\$/g, '');
        
        // Create the file
        const fullPath = path.join(this.currentWorkspace, filePath);
        const dir = path.dirname(fullPath);
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, template);
        return fullPath;
    }
    
    /**
     * Create project from template with intelligent configuration
     */
    public async createProjectFromTemplate(
        templateKey: string,
        targetDir: string,
        variables: Record<string, string>
    ): Promise<string[]> {
        if (!this.projectTemplates.has(templateKey)) {
            throw new Error(`Project template '${templateKey}' not found`);
        }
        
        const template = this.projectTemplates.get(templateKey)!;
        const createdFiles: string[] = [];
        
        // Create base directory if it doesn't exist
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // Merge template variables with provided variables
        const mergedVariables = { ...template.variables, ...variables };
        
        // Process each file in the template
        for (const file of template.files) {
            const filePath = path.join(targetDir, file.path);
            const dir = path.dirname(filePath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Get file content template and substitute variables
            let content = this.fileTemplates.get(file.template) || '';
            
            // Replace variables in content
            Object.entries(mergedVariables).forEach(([key, value]) => {
                content = content.replace(new RegExp(`\\$${key}\\$`, 'g'), value as string);
            });
            
            // Replace any remaining variables with empty strings
            content = content.replace(/\$[A-Z_]+\$/g, '');
            
            fs.writeFileSync(filePath, content);
            createdFiles.push(filePath);
        }
        
        return createdFiles;
    }
    
    /**
     * Analyze code file and provide intelligent actions based on content
     */
    public async analyzeFile(filePath: string): Promise<any> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File '${filePath}' not found`);
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const fileExtension = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        const suggestions: any[] = [];
        
        // Detect file type based on content and extension
        const fileTypes: string[] = [];
        for (const [type, pattern] of this.patternLibrary.entries()) {
            if (pattern.test(content)) {
                fileTypes.push(type);
            }
        }
        
        // Get file associations
        const relatedFiles = this.fileAssociations.get(filePath) || [];
        
        // Detect code smells
        const codeSmells: string[] = [];
        if (this.patternLibrary.get('nested_callbacks')?.test(content)) {
            codeSmells.push('nested_callbacks');
            suggestions.push({
                type: 'refactor',
                title: 'Refactor nested callbacks',
                description: 'Convert nested callbacks to Promise chains or async/await'
            });
        }
        
        if (this.patternLibrary.get('long_method')?.test(content)) {
            codeSmells.push('long_method');
            suggestions.push({
                type: 'refactor',
                title: 'Split long method',
                description: 'Break down long method into smaller, more focused functions'
            });
        }
        
        if (this.patternLibrary.get('magic_numbers')?.test(content)) {
            codeSmells.push('magic_numbers');
            suggestions.push({
                type: 'refactor',
                title: 'Extract magic numbers',
                description: 'Replace magic numbers with named constants'
            });
        }
        
        // React component suggestions
        if (fileTypes.includes('react_component')) {
            // Check if there's a corresponding test file
            const hasTestFile = relatedFiles.some(file => file.includes('.test.') || file.includes('.spec.'));
            if (!hasTestFile) {
                suggestions.push({
                    type: 'create',
                    title: 'Generate test file',
                    description: 'Create a test file for this component',
                    action: 'generate_test_file'
                });
            }
            
            // Check for PropTypes
            if (!content.includes('PropTypes')) {
                suggestions.push({
                    type: 'enhance',
                    title: 'Add PropTypes',
                    description: 'Add PropTypes validation to component',
                    action: 'add_proptypes'
                });
            }
        }
        
        return {
            filePath,
            fileName,
            fileExtension,
            fileTypes,
            relatedFiles,
            codeSmells,
            suggestions,
            hasRelatedFiles: relatedFiles.length > 0
        };
    }
    
    /**
     * Find related files for a given file
     */
    public getRelatedFiles(filePath: string): string[] {
        return this.fileAssociations.get(filePath) || [];
    }
    
    /**
     * Apply a code transformation to multiple related files
     */
    public async applyMultiFileTransformation(
        transformation: string, 
        filePath: string, 
        options: any = {}
    ): Promise<string[]> {
        // Get related files
        const relatedFiles = [filePath, ...this.getRelatedFiles(filePath)];
        const modifiedFiles: string[] = [];
        
        switch (transformation) {
            case 'rename_symbol': {
                const { oldName, newName } = options;
                if (!oldName || !newName) {
                    throw new Error('Old and new names are required');
                }
                
                // Process each file
                for (const file of relatedFiles) {
                    if (fs.existsSync(file)) {
                        let content = fs.readFileSync(file, 'utf8');
                        
                        // Create regex to match the symbol with word boundaries
                        const regex = new RegExp(`\\b${oldName}\\b`, 'g');
                        
                        // Only modify if matches found
                        if (regex.test(content)) {
                            content = content.replace(regex, newName);
                            fs.writeFileSync(file, content);
                            modifiedFiles.push(file);
                        }
                    }
                }
                break;
            }
                
            case 'update_imports': {
                const { oldPath, newPath } = options;
                if (!oldPath || !newPath) {
                    throw new Error('Old and new paths are required');
                }
                
                // Process each file
                for (const file of relatedFiles) {
                    if (fs.existsSync(file)) {
                        let content = fs.readFileSync(file, 'utf8');
                        
                        // Match import statements for the old path
                        const regex = new RegExp(`(import\\s+[^'"]+'${oldPath}'|import\\s+[^"]+\"${oldPath}\")`, 'g');
                        
                        // Only modify if matches found
                        if (regex.test(content)) {
                            content = content.replace(new RegExp(oldPath, 'g'), newPath);
                            fs.writeFileSync(file, content);
                            modifiedFiles.push(file);
                        }
                    }
                }
                break;
            }
                
            default:
                throw new Error(`Transformation '${transformation}' not supported`);
        }
        
        // Record transformation in history
        this.transformationHistory.push({
            type: transformation,
            files: modifiedFiles,
            options,
            timestamp: new Date()
        });
        
        return modifiedFiles;
    }
}

// Register commands
export function registerQuickDevCommands(context: vscode.ExtensionContext): void {
    const quickDev = QuickDevSystem.getInstance();
    
    // Generate commit message
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.generateCommitMessage', async () => {
            try {
                // Get Git diff from current repository
                const result = await vscode.commands.executeCommand('git.openChange');
                const diffText = await vscode.env.clipboard.readText() || 'No diff available';
                
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating commit message',
                    cancellable: false
                }, async (progress) => {
                    const commitMessage = await quickDev.generateCommitMessage(diffText);
                    
                    // Show the commit message in a document
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# Generated Commit Message\n\n${commitMessage}\n\n---\n\nTo use this commit message, copy it and run:\ngit commit -m "paste message here"`,
                        language: 'markdown'
                    });
                    
                    await vscode.window.showTextDocument(doc);
                });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error generating commit message: ${error.message}`);
            }
        })
    );
    
    // Create file from template
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.createFileFromTemplate', async () => {
            const templateOptions = Array.from(quickDev['fileTemplates'].keys());
            
            const templateKey = await vscode.window.showQuickPick(templateOptions, {
                placeHolder: 'Select file template'
            });
            
            if (!templateKey) {
                return;
            }
            
            // Get relative file path
            const filePath = await vscode.window.showInputBox({
                prompt: 'Enter file path relative to workspace root',
                placeHolder: 'src/components/MyComponent.tsx'
            });
            
            if (!filePath) {
                return;
            }
            
            // Get variables based on template
            const variables: Record<string, string> = {};
            
            if (templateKey === 'react_component') {
                // Extract component name from file path
                const fileName = path.basename(filePath, path.extname(filePath));
                variables['COMPONENT_NAME'] = fileName;
                variables['FILENAME'] = fileName;
                
                const description = await vscode.window.showInputBox({
                    prompt: 'Enter component description',
                    placeHolder: 'A reusable button component with various styles'
                }) || '';
                variables['DESCRIPTION'] = description;
                
                const props = await vscode.window.showInputBox({
                    prompt: 'Enter component props (comma separated)',
                    placeHolder: 'variant, size, label, onClick'
                }) || '';
                variables['PROPS'] = props;
                variables['PROP_TYPES'] = props
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p)
                    .map(p => `${p}: PropTypes.any`)
                    .join(',\n  ');
                variables['DEFAULT_PROPS'] = props
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p)
                    .map(p => `${p}: undefined`)
                    .join(',\n  ');
            }
            
            try {
                const createdFilePath = await quickDev.createFileFromTemplate(templateKey, filePath, variables);
                vscode.window.showInformationMessage(`File created: ${createdFilePath}`);
                
                // Open the created file
                const document = await vscode.workspace.openTextDocument(createdFilePath);
                await vscode.window.showTextDocument(document);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error creating file: ${error.message}`);
            }
        })
    );
    
    // Create project from template
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.createProjectFromTemplate', async () => {
            const templateOptions = Array.from(quickDev['projectTemplates'].keys());
            
            const templateKey = await vscode.window.showQuickPick(templateOptions, {
                placeHolder: 'Select project template'
            });
            
            if (!templateKey) {
                return;
            }
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder is open');
                return;
            }
            
            // Get target directory
            const targetDir = await vscode.window.showInputBox({
                prompt: 'Enter target directory (relative to workspace root)',
                placeHolder: 'my-new-project'
            });
            
            if (!targetDir) {
                return;
            }
            
            const fullTargetDir = path.join(workspaceFolder, targetDir);
            
            // Get variables based on template
            const variables: Record<string, string> = {};
            const template = quickDev['projectTemplates'].get(templateKey);
            
            for (const [key, defaultValue] of Object.entries(template.variables)) {
                const value = await vscode.window.showInputBox({
                    prompt: `Enter value for ${key}`,
                    placeHolder: defaultValue as string
                });
                
                if (value) {
                    variables[key] = value;
                }
            }
            
            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Creating ${templateKey} project`,
                    cancellable: false
                }, async (progress) => {
                    const createdFiles = await quickDev.createProjectFromTemplate(
                        templateKey,
                        fullTargetDir,
                        variables
                    );
                    
                    vscode.window.showInformationMessage(
                        `Project created with ${createdFiles.length} files`
                    );
                    
                    // Open readme or main file if exists
                    const mainFile = createdFiles.find(f => f.includes('README.md')) || 
                                     createdFiles.find(f => f.includes('index.ts')) ||
                                     createdFiles[0];
                                     
                    if (mainFile) {
                        const document = await vscode.workspace.openTextDocument(mainFile);
                        await vscode.window.showTextDocument(document);
                    }
                });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error creating project: ${error.message}`);
            }
        })
    );
    
    // Analyze file
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.analyzeFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Analyzing file',
                    cancellable: false
                }, async (progress) => {
                    const filePath = editor.document.uri.fsPath;
                    const analysis = await quickDev.analyzeFile(filePath);
                    
                    // Create markdown document with analysis
                    let content = `# File Analysis: ${analysis.fileName}\n\n`;
                    content += `- **File Path**: ${analysis.filePath}\n`;
                    content += `- **File Type**: ${analysis.fileTypes.join(', ') || 'Unknown'}\n`;
                    content += `- **Related Files**: ${analysis.relatedFiles.length}\n`;
                    
                    if (analysis.codeSmells.length > 0) {
                        content += '\n## 🚩 Code Smells\n\n';
                        for (const smell of analysis.codeSmells) {
                            content += `- ${smell}\n`;
                        }
                    }
                    
                    if (analysis.suggestions.length > 0) {
                        content += '\n## 💡 Suggestions\n\n';
                        for (const suggestion of analysis.suggestions) {
                            content += `### ${suggestion.title}\n`;
                            content += `${suggestion.description}\n\n`;
                        }
                    }
                    
                    if (analysis.relatedFiles.length > 0) {
                        content += '\n## 🔗 Related Files\n\n';
                        for (const file of analysis.relatedFiles) {
                            content += `- ${file}\n`;
                        }
                    }
                    
                    const doc = await vscode.workspace.openTextDocument({
                        content,
                        language: 'markdown'
                    });
                    
                    await vscode.window.showTextDocument(doc);
                });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error analyzing file: ${error.message}`);
            }
        })
    );
    
    // Apply multi-file transformation
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.applyMultiFileTransformation', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            const transformationTypes = [
                'rename_symbol',
                'update_imports'
            ];
            
            const transformation = await vscode.window.showQuickPick(transformationTypes, {
                placeHolder: 'Select transformation type'
            });
            
            if (!transformation) {
                return;
            }
            
            const filePath = editor.document.uri.fsPath;
            const options: any = {};
            
            if (transformation === 'rename_symbol') {
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                
                const oldName = await vscode.window.showInputBox({
                    prompt: 'Enter symbol to rename',
                    value: selectedText
                });
                
                if (!oldName) {
                    return;
                }
                
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter new name',
                    value: oldName
                });
                
                if (!newName) {
                    return;
                }
                
                options.oldName = oldName;
                options.newName = newName;
            } else if (transformation === 'update_imports') {
                const oldPath = await vscode.window.showInputBox({
                    prompt: 'Enter old import path',
                    placeHolder: './components/Button'
                });
                
                if (!oldPath) {
                    return;
                }
                
                const newPath = await vscode.window.showInputBox({
                    prompt: 'Enter new import path',
                    placeHolder: './components/ui/Button'
                });
                
                if (!newPath) {
                    return;
                }
                
                options.oldPath = oldPath;
                options.newPath = newPath;
            }
            
            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Applying transformation',
                    cancellable: false
                }, async (progress) => {
                    const modifiedFiles = await quickDev.applyMultiFileTransformation(
                        transformation,
                        filePath,
                        options
                    );
                    
                    vscode.window.showInformationMessage(
                        `Transformation applied to ${modifiedFiles.length} files`
                    );
                    
                    if (modifiedFiles.length > 0) {
                        let content = `# Transformation Results\n\n`;
                        content += `- **Transformation**: ${transformation}\n`;
                        content += `- **Files Modified**: ${modifiedFiles.length}\n\n`;
                        
                        content += '## Modified Files\n\n';
                        for (const file of modifiedFiles) {
                            content += `- ${file}\n`;
                        }
                        
                        const doc = await vscode.workspace.openTextDocument({
                            content,
                            language: 'markdown'
                        });
                        
                        await vscode.window.showTextDocument(doc);
                    }
                });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error applying transformation: ${error.message}`);
            }
        })
    );
}