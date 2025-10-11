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

export class PythonReplacementAgent {
    priority = 1;
    id = 'python-agent';
    readonly name = 'python';
    readonly extensions = ['.py', '.pyx', '.pyi'];
    readonly description = 'Specialized agent for Python files with framework support';
    readonly capabilities = [
        'PEP 8 compliant code',
        'Type hints and annotations',
        'Django/Flask framework support',
        'FastAPI integration',
        'Async/await patterns',
        'Exception handling',
        'Testing with pytest'
    ];

    async createFile(fileName: string, prompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const template = this.getFileTemplate(fileName, context);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'create', fileName, `${prompt}\n\nBase template:\n${template}`, context, this.capabilities
            );

            const content = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const validation = this.validateSyntax(content);
            const linesCount = content.split('\n').length;
            
            // Update line count tracking
            EditTracker.updateFileLineCount(fileName, linesCount, true);

            return {
                success: validation.isValid,
                content: validation.isValid ? content : undefined,
                error: validation.isValid ? undefined : validation.errors[0]?.message,
                metadata: {
                    linesCount,
                    dependencies: this.extractDependencies(content),
                    patterns: this.inferPatterns(content),
                    suggestedFiles: this.suggestRelatedFiles(fileName, content, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Python creation failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    async editFile(fileName: string, existingContent: string, editPrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'edit', fileName, `${editPrompt}

Existing code:
${existingContent}

Follow PEP 8 and preserve structure.`, 
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
                success: false, content: existingContent, error: `Python edit failed: ${error.message}`,
                metadata: { linesCount: existingContent.split('\n').length, dependencies: [], patterns: [] }
            };
        }
    }

    async replaceFile(fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'replace', fileName, `${replacePrompt}\n\nReplace with new Python implementation following PEP 8.`, 
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
                success: false, error: `Python replacement failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    analyzeContent(content: string): ContentAnalysis {
        const patterns: string[] = [];
        const dependencies: string[] = [];
        const issues: string[] = [];

        // Analyze patterns
        if (content.includes('class ')) {patterns.push('classes');}
        if (content.includes('def ')) {patterns.push('functions');}
        if (content.includes('async def ')) {patterns.push('async-functions');}
        if (content.includes('@')) {patterns.push('decorators');}
        if (content.includes('from django')) {patterns.push('django');}
        if (content.includes('from fastapi')) {patterns.push('fastapi');}

        // Extract dependencies
        const importMatches = content.match(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm);
        if (importMatches) {
            importMatches.forEach(imp => {
                const match = imp.match(/(?:from\s+(\S+)|import\s+(\S+))/);
                if (match) {dependencies.push((match[1] || match[2]).split('.')[0]);}
            });
        }

        // Check issues
        if (content.includes('print(')) {
            issues.push('Print statements detected - consider using logging for production');
        }

        const complexity = content.split('\n').length > 100 ? 'complex' : 
                          content.split('\n').length > 50 ? 'medium' : 'simple';

        return { language: 'python', complexity, patterns, dependencies, issues, suggestions: [] };
    }

    validateSyntax(content: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const lineNum = index + 1;
            if (line.includes('except:')) {
                warnings.push({ line: lineNum, message: 'Bare except clause - specify exception type' });
            }
        });

        return { isValid: errors.length === 0, errors, warnings };
    }

    suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        if (!content.includes('typing')) {suggestions.push('Add type hints');}
        if (!content.includes('"""')) {suggestions.push('Add docstrings');}
        return suggestions;
    }

    getFileTemplate(fileName: string, context: ProjectContext): string {
        const baseName = path.basename(fileName, '.py');
        
        if (fileName.includes('test_')) {
            return `"""Test module for ${baseName.replace('test_', '')}."""
import pytest

def test_example():
    assert True
`;
        }

        if (fileName === '__init__.py') {
            return `"""Package initialization."""\n__version__ = "0.1.0"\n`;
        }

        return `"""${baseName}.py - TODO: Add description."""

from typing import Any
import logging

logger = logging.getLogger(__name__)

def main() -> None:
    \"\"\"Main function.\"\"\"
    pass

if __name__ == "__main__":
    main()
`;
    }

    extractDependencies(content: string): string[] {
        const dependencies: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(?:from\s+(\S+)|import\s+(\S+))/);
            if (match) {dependencies.push((match[1] || match[2]).split('.')[0]);}
        }
        
        return [...new Set(dependencies)];
    }

    inferPatterns(content: string): string[] {
        const patterns: string[] = [];
        if (content.includes('class ')) {patterns.push('classes');}
        if (content.includes('async ')) {patterns.push('async');}
        if (content.includes('@')) {patterns.push('decorators');}
        return patterns;
    }

    private suggestRelatedFiles(fileName: string, content: string, context: ProjectContext): string[] {
        const baseName = path.basename(fileName, '.py');
        const suggestions: string[] = [];
        
        if (!fileName.includes('test_')) {suggestions.push(`test_${baseName}.py`);}
        if (content.includes('class ')) {suggestions.push(`${baseName}_types.py`);}
        
        return suggestions;
    }
}

// Register the agent
const pythonAgent = new PythonReplacementAgent();
FileExtensionAgentRegistry.getInstance().registerAgent(pythonAgent);