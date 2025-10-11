import * as vscode from 'vscode';
import * as path from 'path';
import { generateCode } from '../codegenerator';
import { EditTracker } from '../edittracker';
import { 
    FileExtensionAgent, 
    ProjectContext, 
    FileOperationResult, 
    ContentAnalysis, 
    ValidationResult,
    FileExtensionAgentRegistry
} from '../fileextensionagentregistry';

export class JSONReplacementAgent {
    priority = 1;
    id = 'json-agent';
    readonly name = 'json';
    readonly extensions = ['.json', '.jsonc', '.json5'];
    readonly description = 'Specialized agent for JSON configuration files';
    readonly capabilities = [
        'Valid JSON structure',
        'Schema validation',
        'Configuration management',
        'Package.json handling',
        'TSConfig management',
        'Environment configs',
        'API response formatting',
        'Data modeling'
    ];

    async createFile(fileName: string, prompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const template = this.getFileTemplate(fileName, context);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'create', fileName, `${prompt}

Base template:
${template}

Ensure valid JSON format.`, 
                context, this.capabilities
            );

            const content = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const validation = this.validateSyntax(content);

            // Track line count for live changes display
            if (validation.isValid && content) {
                const linesCount = content.split('\n').length;
                EditTracker.updateFileLineCount(fileName, linesCount, true);
            }

            return {
                success: validation.isValid,
                content: validation.isValid ? content : undefined,
                error: validation.isValid ? undefined : validation.errors[0]?.message,
                metadata: {
                    linesCount: content.split('\n').length,
                    dependencies: [],
                    patterns: this.inferPatterns(content),
                    suggestedFiles: this.suggestRelatedFiles(fileName, content, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `JSON creation failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    async editFile(fileName: string, existingContent: string, editPrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'edit', fileName, 
                `${editPrompt}

Existing JSON:
${existingContent}

Maintain valid JSON structure and existing keys where appropriate.`, 
                context, this.capabilities
            );

            const newContent = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const validation = this.validateSyntax(newContent);

            return {
                success: validation.isValid,
                content: validation.isValid ? newContent : existingContent,
                error: validation.isValid ? undefined : `Validation failed: ${validation.errors[0]?.message}`,
                metadata: {
                    linesCount: newContent.split('\n').length,
                    dependencies: [],
                    patterns: this.inferPatterns(newContent)
                }
            };
        } catch (error: any) {
            return {
                success: false, content: existingContent, error: `JSON edit failed: ${error.message}`,
                metadata: { linesCount: existingContent.split('\n').length, dependencies: [], patterns: [] }
            };
        }
    }

    async replaceFile(fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'replace', fileName, 
                `${replacePrompt}\n\nCreate new JSON configuration. Ensure valid JSON format with proper structure.`, 
                context, this.capabilities
            );

            const newContent = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const validation = this.validateSyntax(newContent);

            return {
                success: validation.isValid,
                content: validation.isValid ? newContent : undefined,
                error: validation.isValid ? undefined : `Replacement validation failed: ${validation.errors[0]?.message}`,
                metadata: {
                    linesCount: newContent.split('\n').length,
                    dependencies: [],
                    patterns: this.inferPatterns(newContent)
                }
            };
        } catch (error: any) {
            return {
                success: false, error: `JSON replacement failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    analyzeContent(content: string): ContentAnalysis {
        const patterns: string[] = [];
        const issues: string[] = [];

        try {
            const parsed = JSON.parse(content);
            
            // Identify JSON patterns
            if (parsed.name && parsed.version && (parsed.dependencies || parsed.scripts)) {
                patterns.push('package-json');
            }
            if (parsed.compilerOptions || parsed.include || parsed.exclude) {
                patterns.push('tsconfig');
            }
            if (parsed.extends && parsed.rules) {
                patterns.push('eslint-config');
            }
            if (parsed.env || parsed.database || parsed.api) {
                patterns.push('environment-config');
            }
            if (Array.isArray(parsed) || (typeof parsed === 'object' && Object.keys(parsed).length > 10)) {
                patterns.push('data-structure');
            }

        } catch (error) {
            issues.push('Invalid JSON syntax');
        }

        return {
            language: 'json',
            complexity: 'simple',
            patterns,
            dependencies: [],
            issues,
            suggestions: []
        };
    }

    validateSyntax(content: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];

        try {
            JSON.parse(content);
        } catch (error: any) {
            errors.push({
                line: 1,
                message: `Invalid JSON: ${error.message}`,
                severity: 'error'
            });
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        
        try {
            const parsed = JSON.parse(content);
            
            if (parsed.name === 'package.json' && !parsed.description) {
                suggestions.push('Add description field to package.json');
            }
            if (parsed.compilerOptions && !parsed.compilerOptions.strict) {
                suggestions.push('Enable strict mode in TypeScript config');
            }
            
        } catch (error) {
            suggestions.push('Fix JSON syntax errors');
        }
        
        return suggestions;
    }

    getFileTemplate(fileName: string, context: ProjectContext): string {
        const baseName = path.basename(fileName, '.json');
        
        if (fileName === 'package.json') {
            return this.getPackageJsonTemplate(context);
        }
        
        if (fileName === 'tsconfig.json') {
            return this.getTsConfigTemplate();
        }
        
        if (baseName.includes('config')) {
            return this.getConfigTemplate(baseName);
        }
        
        return '{\n  "TODO": "Add JSON structure"\n}';
    }

    private getPackageJsonTemplate(context: ProjectContext): string {
        return `{
  "name": "my-project",
  "version": "1.0.0",
  "description": "TODO: Add project description",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "jest",
    "build": "npm run build"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {}
}`;
    }

    private getTsConfigTemplate(): string {
        return `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`;
    }

    private getConfigTemplate(configName: string): string {
        return `{
  "name": "${configName}",
  "version": "1.0.0",
  "environment": "development",
  "settings": {
    "TODO": "Add configuration options"
  }
}`;
    }

    extractDependencies(content: string): string[] {
        return []; // JSON files don't have dependencies in the traditional sense
    }

    inferPatterns(content: string): string[] {
        const patterns: string[] = [];
        
        try {
            const parsed = JSON.parse(content);
            
            if (parsed.dependencies) {patterns.push('dependencies');}
            if (parsed.scripts) {patterns.push('scripts');}
            if (parsed.compilerOptions) {patterns.push('compiler-options');}
            if (Array.isArray(parsed)) {patterns.push('array-data');}
            
        } catch (error) {
            // Ignore parse errors for pattern inference
        }
        
        return patterns;
    }

    private suggestRelatedFiles(fileName: string, content: string, context: ProjectContext): string[] {
        const suggestions: string[] = [];
        
        if (fileName === 'package.json') {
            suggestions.push('package-lock.json', '.gitignore', 'README.md');
        }
        if (fileName === 'tsconfig.json') {
            suggestions.push('tsconfig.build.json', '.eslintrc.json');
        }
        
        return suggestions;
    }
}

// Register the agent
const jsonAgent = new JSONReplacementAgent();
FileExtensionAgentRegistry.getInstance().registerAgent(jsonAgent);