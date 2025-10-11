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

export class JavaScriptReplacementAgent {
    priority = 1;
    id = 'javascript-agent';
    readonly name = 'javascript';
    readonly extensions = ['.js', '.jsx', '.mjs', '.cjs'];
    readonly description = 'Specialized agent for JavaScript and React files';
    readonly capabilities = [
        'Modern ES6+ syntax',
        'React component creation',
        'Node.js backend development',
        'Express.js integration',
        'Async/await patterns',
        'Module system (ESM/CommonJS)',
        'Event handling',
        'DOM manipulation',
        'API integration',
        'Testing with Jest'
    ];

    async createFile(fileName: string, prompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const template = this.getFileTemplate(fileName, context);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'create', fileName, `${prompt}\n\nBase template:\n${template}`, context, this.capabilities
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
                error: `JavaScript creation failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    async editFile(fileName: string, existingContent: string, editPrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'edit', fileName, 
                `${editPrompt}

Existing code:
${existingContent}

Use modern JavaScript patterns and preserve existing structure.`, 
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
                success: false, content: existingContent, error: `JavaScript edit failed: ${error.message}`,
                metadata: { linesCount: existingContent.split('\n').length, dependencies: [], patterns: [] }
            };
        }
    }

    async replaceFile(fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'replace', fileName, 
                `${replacePrompt}\n\nReplace with new JavaScript implementation using modern ES6+ syntax.`, 
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
                success: false, error: `JavaScript replacement failed: ${error.message}`,
                metadata: { linesCount: 0, dependencies: [], patterns: [] }
            };
        }
    }

    analyzeContent(content: string): ContentAnalysis {
        const patterns: string[] = [];
        const dependencies: string[] = [];
        const issues: string[] = [];

        // Analyze patterns
        if (content.includes('function ') || content.includes('=>')) {patterns.push('functions');}
        if (content.includes('class ')) {patterns.push('classes');}
        if (content.includes('async ') || content.includes('await ')) {patterns.push('async-await');}
        if (content.includes('useState') || content.includes('useEffect')) {patterns.push('react-hooks');}
        if (content.includes('React.') || content.includes('jsx')) {patterns.push('react');}
        if (content.includes('express') || content.includes('app.get')) {patterns.push('express');}
        if (content.includes('module.exports') || content.includes('exports.')) {patterns.push('commonjs');}
        if (content.includes('export ') || content.includes('import ')) {patterns.push('esm');}

        // Extract dependencies
        const importMatches = content.match(/(?:import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g);
        if (importMatches) {
            importMatches.forEach(imp => {
                const match = imp.match(/['"`]([^'"`]+)['"`]/);
                if (match) {dependencies.push(match[1]);}
            });
        }

        // Check issues
        if (content.includes('console.log')) {
            issues.push('Console.log statements detected - consider proper logging for production');
        }
        if (content.includes('var ')) {
            issues.push('Usage of "var" detected - consider using "let" or "const"');
        }

        const complexity = content.split('\n').length > 100 ? 'complex' : 
                          content.split('\n').length > 50 ? 'medium' : 'simple';

        return { language: 'javascript', complexity, patterns, dependencies, issues, suggestions: [] };
    }

    validateSyntax(content: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Check for var usage
            if (line.includes('var ') && !line.includes('// legacy')) {
                warnings.push({ line: lineNum, message: 'Consider using "let" or "const" instead of "var"' });
            }
            
            // Check for missing semicolons (simplified)
            if (line.trim().length > 0 && 
                !line.trim().endsWith(';') && 
                !line.trim().endsWith('{') && 
                !line.trim().endsWith('}') &&
                !line.trim().endsWith(',') &&
                !line.trim().startsWith('//') &&
                line.includes('=') &&
                !line.includes('=>')) {
                warnings.push({ line: lineNum, message: 'Consider adding semicolon' });
            }
        });

        return { isValid: errors.length === 0, errors, warnings };
    }

    suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        
        if (content.includes('function ') && !content.includes('=>')) {
            suggestions.push('Consider using arrow functions for shorter syntax');
        }
        if (!content.includes('async') && content.includes('Promise')) {
            suggestions.push('Consider using async/await instead of Promises');
        }
        if (content.includes('React.Component') && !content.includes('useState')) {
            suggestions.push('Consider using functional components with hooks');
        }
        
        return suggestions;
    }

    getFileTemplate(fileName: string, context: ProjectContext): string {
        const baseName = path.basename(fileName, path.extname(fileName));
        const isReactComponent = fileName.endsWith('.jsx') || 
                                 baseName.match(/^[A-Z]/) ||
                                 context.technologies.frontend?.includes('react');

        if (isReactComponent) {
            return this.getReactComponentTemplate(baseName);
        }

        if (fileName.includes('.test.') || fileName.includes('.spec.')) {
            return this.getTestTemplate(baseName);
        }

        if (context.technologies.backend?.includes('express')) {
            return this.getExpressTemplate(baseName);
        }

        // Default JavaScript module
        return `// ${baseName}.js
// TODO: Add file description

/**
 * ${this.capitalizeFirst(baseName)} module
 * TODO: Add detailed description
 */

// Main function
const ${baseName} = () => {
  // TODO: Implement functionality
};

// Export
module.exports = ${baseName};
`;
    }

    private getReactComponentTemplate(componentName: string): string {
        const capitalizedName = this.capitalizeFirst(componentName);
        
        return `import React, { useState, useEffect } from 'react';

/**
 * ${capitalizedName} component
 * TODO: Add component description
 */
const ${capitalizedName} = ({ ...props }) => {
  // State
  const [state, setState] = useState(null);

  // Effects
  useEffect(() => {
    // TODO: Add effect logic
  }, []);

  // Render
  return (
    <div>
      <h1>${capitalizedName}</h1>
      {/* TODO: Add component content */}
    </div>
  );
};

export default ${capitalizedName};
`;
    }

    private getTestTemplate(baseName: string): string {
        const testSubject = baseName.replace(/\.(test|spec)$/, '');
        
        return `// Test for ${testSubject}
const ${testSubject} = require('./${testSubject}');

describe('${testSubject}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  test('should work correctly', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  // TODO: Add more test cases
});
`;
    }

    private getExpressTemplate(baseName: string): string {
        return `// Express ${baseName}
const express = require('express');
const router = express.Router();

// Middleware
router.use((req, res, next) => {
  // TODO: Add middleware logic
  next();
});

// Routes
router.get('/', (req, res) => {
  res.json({ message: 'Hello from ${baseName}' });
});

router.post('/', (req, res) => {
  // TODO: Handle POST request
  res.json({ success: true });
});

module.exports = router;
`;
    }

    extractDependencies(content: string): string[] {
        const dependencies: string[] = [];
        
        // Extract from import/require statements
        const importRegex = /(?:import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]|require\(['"`]([^'"`]+)['"`]\))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1] || match[2]);
        }
        
        return [...new Set(dependencies)];
    }

    inferPatterns(content: string): string[] {
        const patterns: string[] = [];
        
        if (content.includes('useState') || content.includes('useEffect')) {patterns.push('react-hooks');}
        if (content.includes('async') && content.includes('await')) {patterns.push('async-await');}
        if (content.includes('class ') && content.includes('extends')) {patterns.push('inheritance');}
        if (content.includes('export default') || content.includes('module.exports')) {patterns.push('module-export');}
        
        return patterns;
    }

    private suggestRelatedFiles(fileName: string, content: string, context: ProjectContext): string[] {
        const baseName = path.basename(fileName, path.extname(fileName));
        const suggestions: string[] = [];
        
        if (!fileName.includes('.test.')) {suggestions.push(`${baseName}.test.js`);}
        if (fileName.endsWith('.jsx')) {suggestions.push(`${baseName}.module.css`);}
        
        return suggestions;
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Register the agent
const jsAgent = new JavaScriptReplacementAgent();
FileExtensionAgentRegistry.getInstance().registerAgent(jsAgent);