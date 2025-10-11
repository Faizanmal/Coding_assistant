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

export class UniversalReplacementAgent {
    priority = 1;
    id = 'universal-agent';
    readonly name = 'universal';
    readonly extensions = ['*']; // Handles all file types
    readonly description = 'Universal fallback agent for any file type';
    readonly capabilities = [
        'Multi-language support',
        'Generic file operations',
        'Template generation',
        'Content analysis',
        'Documentation creation',
        'Configuration files',
        'Shell scripts',
        'Markdown files',
        'YAML/XML handling',
        'Plain text processing'
    ];

    async createFile(fileName: string, prompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const template = this.getFileTemplate(fileName, context);
            const fileType = this.detectFileType(fileName);
            
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'create', fileName, 
                `${prompt}

File type: ${fileType}
Base template:
${template}`, 
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
                    dependencies: this.extractDependencies(content),
                    patterns: this.inferPatterns(content),
                    suggestedFiles: this.suggestRelatedFiles(fileName, content, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Universal creation failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    async editFile(fileName: string, existingContent: string, editPrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const fileType = this.detectFileType(fileName);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'edit', fileName, 
                `${editPrompt}

File type: ${fileType}
Existing content:
${existingContent}

Maintain file format and structure.`, 
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
                    dependencies: this.extractDependencies(newContent),
                    patterns: this.inferPatterns(newContent)
                }
            };
        } catch (error: any) {
            return {
                success: false, content: existingContent, error: `Universal edit failed: ${error.message}`,
                metadata: { linesCount: existingContent.split('\n').length, dependencies: [], patterns: [] }
            };
        }
    }

    async replaceFile(fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const fileType = this.detectFileType(fileName);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'replace', fileName, 
                `${replacePrompt}\n\nFile type: ${fileType}\nCreate new content with appropriate format and structure.`, 
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
                    dependencies: this.extractDependencies(newContent),
                    patterns: this.inferPatterns(newContent)
                }
            };
        } catch (error: any) {
            return {
                success: false, error: `Universal replacement failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    analyzeContent(content: string): ContentAnalysis {
        const patterns: string[] = [];
        const dependencies: string[] = [];
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Generic analysis
        const lines = content.split('\n');
        const complexity = lines.length > 100 ? 'complex' : lines.length > 50 ? 'medium' : 'simple';

        // Detect common patterns
        if (content.includes('function ') || content.includes('def ') || content.includes('const ')) {
            patterns.push('functions');
        }
        if (content.includes('class ') || content.includes('struct ')) {
            patterns.push('classes');
        }
        if (content.includes('import ') || content.includes('#include') || content.includes('use ')) {
            patterns.push('imports');
        }
        if (content.includes('TODO') || content.includes('FIXME')) {
            patterns.push('todos');
        }

        return { language: 'unknown', complexity, patterns, dependencies, issues, suggestions };
    }

    validateSyntax(content: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];

        // Basic validation - check for common issues
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Check for extremely long lines
            if (line.length > 200) {
                warnings.push({ line: lineNum, message: 'Very long line - consider breaking it up' });
            }
            
            // Check for trailing whitespace
            if (line.endsWith(' ') || line.endsWith('\t')) {
                warnings.push({ line: lineNum, message: 'Trailing whitespace detected' });
            }
        });

        return { isValid: errors.length === 0, errors, warnings };
    }

    suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        
        if (content.includes('TODO')) {
            suggestions.push('Complete TODO items');
        }
        if (content.split('\n').length > 200) {
            suggestions.push('Consider breaking large file into smaller modules');
        }
        if (!content.includes('//') && !content.includes('#') && !content.includes('/*')) {
            suggestions.push('Add comments to explain complex logic');
        }
        
        return suggestions;
    }

    getFileTemplate(fileName: string, context: ProjectContext): string {
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, ext);

        switch (ext) {
            case '.md':
                return this.getMarkdownTemplate(baseName);
            case '.yml':
            case '.yaml':
                return this.getYamlTemplate(baseName);
            case '.xml':
                return this.getXmlTemplate(baseName);
            case '.sh':
            case '.bash':
                return this.getShellTemplate(baseName);
            case '.dockerfile':
            case '':
                if (fileName.toLowerCase() === 'dockerfile') {
                    return this.getDockerfileTemplate(context);
                }
                break;
            case '.gitignore':
                return this.getGitignoreTemplate(context);
            case '.env':
                return this.getEnvTemplate();
        }

        return `# ${baseName}${ext}\n# TODO: Add file content\n`;
    }

    private detectFileType(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName).toLowerCase();

        const typeMap: { [key: string]: string } = {
            '.md': 'markdown',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.sh': 'shell',
            '.bash': 'shell',
            '.ps1': 'powershell',
            '.bat': 'batch',
            '.sql': 'sql',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby'
        };

        if (baseName === 'dockerfile') {return 'dockerfile';}
        if (baseName === 'makefile') {return 'makefile';}
        if (baseName.startsWith('.git')) {return 'git-config';}
        if (baseName.endsWith('ignore')) {return 'ignore-file';}

        return typeMap[ext] || 'text';
    }

    private getMarkdownTemplate(baseName: string): string {
        return `# ${baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

## Description

TODO: Add description

## Usage

TODO: Add usage instructions

## Features

- TODO: List features

## Installation

TODO: Add installation steps

## Contributing

TODO: Add contributing guidelines
`;
    }

    private getYamlTemplate(baseName: string): string {
        return `# ${baseName}.yml
# TODO: Add YAML configuration

name: ${baseName}
version: 1.0.0

# TODO: Add configuration sections
config:
  # Add your configuration here
`;
    }

    private getXmlTemplate(baseName: string): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${baseName}.xml -->
<root>
  <!-- TODO: Add XML content -->
</root>
`;
    }

    private getShellTemplate(baseName: string): string {
        return `#!/bin/bash
# ${baseName}.sh
# TODO: Add script description

set -e  # Exit on error
set -u  # Exit on undefined variable

# Variables
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

# Functions
main() {
    echo "Starting ${baseName}..."
    # TODO: Add main logic
    echo "Completed ${baseName}."
}

# Execute main function
main "$@"
`;
    }

    private getDockerfileTemplate(context: ProjectContext): string {
        if (context.technologies.frontend?.includes('react')) {
            return `# Multi-stage build for React app
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
        }

        return `# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
`;
    }

    private getGitignoreTemplate(context: ProjectContext): string {
        let template = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
/build
/dist

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db
`;

        if (context.technologies.backend?.includes('python')) {
            template += `
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
`;
        }

        return template;
    }

    private getEnvTemplate(): string {
        return `# Environment Variables
# TODO: Add your environment variables

# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# API Keys
API_KEY=

# Security
JWT_SECRET=
`;
    }

    extractDependencies(content: string): string[] {
        const dependencies: string[] = [];
        
        // Detect file type from content patterns
        let fileType = 'text';
        if (content.includes('FROM ') && content.includes('COPY')) {fileType = 'dockerfile';}
        else if (content.includes('version:') || content.includes('services:')) {fileType = 'yaml';}

        switch (fileType) {
            case 'yaml':
                // Extract from YAML imports or references
                const yamlMatches = content.match(/(?:image|from):\s*([^\s]+)/g);
                if (yamlMatches) {
                    yamlMatches.forEach(match => {
                        const dep = match.split(':')[1]?.trim();
                        if (dep) {dependencies.push(dep);}
                    });
                }
                break;
            case 'dockerfile':
                // Extract base images
                const dockerMatches = content.match(/FROM\s+([^\s]+)/g);
                if (dockerMatches) {
                    dockerMatches.forEach(match => {
                        const image = match.replace('FROM', '').trim();
                        dependencies.push(image);
                    });
                }
                break;
        }

        return [...new Set(dependencies)];
    }

    inferPatterns(content: string): string[] {
        const patterns: string[] = [];
        
        // Detect file type from content patterns
        let fileType = 'text';
        if (content.includes('FROM ') && content.includes('COPY')) {fileType = 'dockerfile';}
        else if (content.includes('version:') || content.includes('services:')) {fileType = 'yaml';}
        else if (content.includes('# ') && content.includes('## ')) {fileType = 'markdown';}

        switch (fileType) {
            case 'markdown':
                if (content.includes('## ')) {patterns.push('structured-document');}
                if (content.includes('```')) {patterns.push('code-blocks');}
                if (content.includes('- [ ]')) {patterns.push('todo-lists');}
                break;
            case 'yaml':
                if (content.includes('version:')) {patterns.push('versioned-config');}
                if (content.includes('services:')) {patterns.push('docker-compose');}
                if (content.includes('steps:')) {patterns.push('ci-pipeline');}
                break;
            case 'dockerfile':
                if (content.includes('COPY')) {patterns.push('file-copying');}
                if (content.includes('RUN')) {patterns.push('command-execution');}
                if (content.includes('EXPOSE')) {patterns.push('port-exposure');}
                break;
        }

        return patterns;
    }

    private suggestRelatedFiles(fileName: string, content: string, context: ProjectContext): string[] {
        const suggestions: string[] = [];
        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, ext);

        switch (ext) {
            case '.md':
                if (fileName === 'README.md') {
                    suggestions.push('CONTRIBUTING.md', 'LICENSE', '.gitignore');
                }
                break;
            case '.yml':
            case '.yaml':
                if (fileName.includes('docker-compose')) {
                    suggestions.push('Dockerfile', '.dockerignore');
                }
                break;
        }

        return suggestions;
    }
}

// Register the agent
const universalAgent = new UniversalReplacementAgent();
FileExtensionAgentRegistry.getInstance().registerAgent(universalAgent);