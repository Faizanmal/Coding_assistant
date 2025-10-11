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

export class TypeScriptReplacementAgent {
    priority = 1;
    id = 'typescript-agent';
    readonly name = 'typescript';
    readonly extensions = ['.ts', '.tsx', '.d.ts'];
    readonly description = 'Specialized agent for TypeScript and React TypeScript files';
    readonly capabilities = [
        'Type-safe code generation',
        'Interface and type definitions',
        'React component creation',
        'Generic type handling',
        'Import/export optimization',
        'TSConfig integration',
        'Advanced TypeScript patterns',
        'Decorator usage',
        'Async/await patterns',
        'Error handling with types'
    ];

    async createFile(fileName: string, prompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const template = this.getFileTemplate(fileName, context);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'create',
                fileName,
                `${prompt}\n\nBase template:\n${template}`,
                context,
                this.capabilities
            );

            const content = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const analysis = this.analyzeContent(content);
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
                    patterns: analysis.patterns,
                    suggestedFiles: this.suggestRelatedFiles(fileName, content, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `TypeScript creation failed: ${error.message}`,
                metadata: {
                    linesCount: 0,
                    dependencies: [],
                    patterns: []
                }
            };
        }
    }

    async editFile(fileName: string, existingContent: string, editPrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const analysis = this.analyzeContent(existingContent);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'edit',
                fileName,
                `${editPrompt}

Current content analysis:
- Complexity: ${analysis.complexity}
- Patterns: ${analysis.patterns.join(', ')}
- Dependencies: ${analysis.dependencies.join(', ')}

Existing code:
${existingContent}

Instructions:
1. Preserve existing type definitions and interfaces
2. Maintain import/export structure
3. Follow existing code patterns and style
4. Add requested functionality with proper TypeScript typing
5. Return the complete updated file`,
                context,
                this.capabilities
            );

            const newContent = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
            const validation = this.validateSyntax(newContent);

            return {
                success: validation.isValid,
                content: validation.isValid ? newContent : existingContent, // Fallback to original if invalid
                error: validation.isValid ? undefined : `Validation failed: ${validation.errors[0]?.message}`,
                metadata: {
                    linesCount: newContent.split('\n').length,
                    dependencies: this.extractDependencies(newContent),
                    patterns: this.inferPatterns(newContent),
                    suggestedFiles: this.suggestRelatedFiles(fileName, newContent, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                content: existingContent, // Return original content on error
                error: `TypeScript edit failed: ${error.message}`,
                metadata: {
                    linesCount: existingContent.split('\n').length,
                    dependencies: [],
                    patterns: []
                }
            };
        }
    }

    async replaceFile(fileName: string, existingContent: string, replacePrompt: string, context: ProjectContext): Promise<FileOperationResult> {
        try {
            const existingAnalysis = this.analyzeContent(existingContent);
            const enhancedPrompt = FileExtensionAgentRegistry.generatePromptWithContext(
                'replace',
                fileName,
                `${replacePrompt}

Original file analysis:
- Purpose: ${this.inferFilePurpose(fileName, existingContent)}
- Key exports: ${this.extractExports(existingContent).join(', ')}
- Dependencies: ${existingAnalysis.dependencies.join(', ')}

Requirements:
1. Completely replace the file content with new implementation
2. Maintain similar purpose and public interface if applicable
3. Use modern TypeScript patterns and best practices
4. Ensure proper typing throughout
5. Include comprehensive error handling
6. Add appropriate JSDoc comments for complex functions

Original content (for reference):
${existingContent}`,
                context,
                this.capabilities
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
                    patterns: this.inferPatterns(newContent),
                    suggestedFiles: this.suggestRelatedFiles(fileName, newContent, context)
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `TypeScript replacement failed: ${error.message}`,
                metadata: {
                    linesCount: 0,
                    dependencies: [],
                    patterns: []
                }
            };
        }
    }

    analyzeContent(content: string): ContentAnalysis {
        const lines = content.split('\n');
        const patterns: string[] = [];
        const dependencies: string[] = [];
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Analyze TypeScript patterns
        if (content.includes('interface ')) {patterns.push('interfaces');}
        if (content.includes('type ')) {patterns.push('type-aliases');}
        if (content.includes('class ')) {patterns.push('classes');}
        if (content.includes('enum ')) {patterns.push('enums');}
        if (content.includes('namespace ')) {patterns.push('namespaces');}
        if (content.includes('generic')) {patterns.push('generics');}
        if (content.includes('<T>') || content.includes('<K,') || content.includes('<U>')) {patterns.push('generics');}
        if (content.includes('@')) {patterns.push('decorators');}
        if (content.includes('async ') || content.includes('await ')) {patterns.push('async-await');}
        if (content.includes('Promise<')) {patterns.push('promises');}
        if (content.includes('React.') || content.includes('useState') || content.includes('useEffect')) {patterns.push('react-hooks');}
        if (content.includes('export default') || content.includes('export {')) {patterns.push('exports');}

        // Extract dependencies from imports
        const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
        if (importMatches) {
            importMatches.forEach(imp => {
                const match = imp.match(/from\s+['"`]([^'"`]+)['"`]/);
                if (match) {
                    dependencies.push(match[1]);
                }
            });
        }

        // Check for common issues
        if (content.includes('any') && !content.includes('// @ts-ignore')) {
            issues.push('Usage of "any" type detected - consider more specific typing');
        }
        if (content.includes('console.log') && !content.includes('debug')) {
            issues.push('Console.log statements detected - consider using proper logging');
        }
        if (!content.includes('export') && !content.includes('import')) {
            issues.push('No imports/exports detected - file might be isolated');
        }

        // Generate suggestions
        if (!patterns.includes('error-handling') && patterns.includes('async-await')) {
            suggestions.push('Consider adding proper error handling for async operations');
        }
        if (patterns.includes('classes') && !content.includes('constructor')) {
            suggestions.push('Consider adding constructor for class initialization');
        }
        if (patterns.includes('react-hooks') && !content.includes('useCallback') && content.includes('function')) {
            suggestions.push('Consider using useCallback for function memoization');
        }

        // Determine complexity
        let complexity: 'simple' | 'medium' | 'complex' = 'simple';
        if (patterns.length > 3 || lines.length > 50) {complexity = 'medium';}
        if (patterns.length > 6 || lines.length > 150 || patterns.includes('generics')) {complexity = 'complex';}

        return {
            language: 'typescript',
            complexity,
            patterns,
            dependencies,
            issues,
            suggestions
        };
    }

    validateSyntax(content: string): ValidationResult {
        const errors: ValidationResult['errors'] = [];
        const warnings: ValidationResult['warnings'] = [];
        const lines = content.split('\n');

        // Basic TypeScript syntax validation
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Check for unclosed brackets
            const openBrackets = (line.match(/[\{\[]/g) || []).length;
            const closeBrackets = (line.match(/[\}\]]/g) || []).length;
            if (openBrackets !== closeBrackets && !line.trim().endsWith(',') && !line.trim().endsWith(';')) {
                warnings.push({
                    line: lineNum,
                    message: 'Potential bracket mismatch'
                });
            }

            // Check for missing semicolons (simplified)
            if (line.trim().length > 0 && 
                !line.trim().endsWith(';') && 
                !line.trim().endsWith('{') && 
                !line.trim().endsWith('}') &&
                !line.trim().endsWith(',') &&
                !line.trim().startsWith('//') &&
                !line.trim().startsWith('*') &&
                !line.includes('=>') &&
                !line.includes('import ') &&
                !line.includes('export ') &&
                line.includes('=')) {
                warnings.push({
                    line: lineNum,
                    message: 'Consider adding semicolon'
                });
            }

            // Check for TypeScript specific issues
            if (line.includes(': any') && !line.includes('// eslint-disable')) {
                warnings.push({
                    line: lineNum,
                    message: 'Using "any" type - consider more specific typing'
                });
            }
        });

        // Check for missing exports in non-test files
        if (!content.includes('export') && !content.includes('.test.') && !content.includes('.spec.')) {
            warnings.push({
                line: 1,
                message: 'No exports found - file might need to export something'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        const analysis = this.analyzeContent(content);

        // Performance suggestions
        if (analysis.patterns.includes('react-hooks') && content.includes('useEffect')) {
            if (!content.includes('useMemo') && !content.includes('useCallback')) {
                suggestions.push('Consider using useMemo/useCallback for performance optimization');
            }
        }

        // Type safety suggestions
        if (content.includes('any') || content.includes('unknown')) {
            suggestions.push('Replace any/unknown types with more specific types');
        }

        // Code organization suggestions
        if (content.split('\n').length > 100) {
            suggestions.push('Consider breaking this file into smaller modules');
        }

        // Modern TypeScript patterns
        if (content.includes('function ') && !content.includes('arrow functions')) {
            suggestions.push('Consider using arrow functions for better type inference');
        }

        if (analysis.patterns.includes('classes') && !analysis.patterns.includes('interfaces')) {
            suggestions.push('Consider defining interfaces for class contracts');
        }

        return suggestions;
    }

    getFileTemplate(fileName: string, context: ProjectContext): string {
        const baseName = path.basename(fileName, path.extname(fileName));
        const isReactComponent = fileName.endsWith('.tsx') || 
                                 baseName.match(/^[A-Z]/) ||
                                 context.technologies.frontend?.includes('react');

        if (isReactComponent) {
            return this.getReactComponentTemplate(baseName, context);
        }

        if (fileName.includes('.test.') || fileName.includes('.spec.')) {
            return this.getTestTemplate(baseName, context);
        }

        if (fileName.endsWith('.d.ts')) {
            return this.getTypeDefinitionTemplate(baseName);
        }

        // Default TypeScript module template
        return `// ${baseName}.ts
// TODO: Add file description

// Imports
// import { } from '';

// Types and interfaces
export interface ${this.capitalizeFirst(baseName)}Options {
  // TODO: Define options
}

// Main implementation
export class ${this.capitalizeFirst(baseName)} {
  constructor(private options: ${this.capitalizeFirst(baseName)}Options) {}
  
  // TODO: Implement methods
}

// Default export
export default ${this.capitalizeFirst(baseName)};
`;
    }

    private getReactComponentTemplate(componentName: string, context: ProjectContext): string {
        const capitalizedName = this.capitalizeFirst(componentName);
        
        if (context.technologies.testing?.includes('jest') || 
            context.technologies.testing?.includes('@testing-library/react')) {
            return `import React from 'react';

export interface ${capitalizedName}Props {
  // TODO: Define component props
}

const ${capitalizedName}: React.FC<${capitalizedName}Props> = ({ ...props }) => {
  return (
    <div>
      {/* TODO: Implement component */}
      <h1>${capitalizedName}</h1>
    </div>
  );
};

export default ${capitalizedName};
`;
        }

        return `import React from 'react';

interface ${capitalizedName}Props {
  // TODO: Define props
}

export const ${capitalizedName}: React.FC<${capitalizedName}Props> = (props) => {
  return (
    <div>
      {/* TODO: Implement component */}
    </div>
  );
};

export default ${capitalizedName};
`;
    }

    private getTestTemplate(baseName: string, context: ProjectContext): string {
        const testSubject = baseName.replace(/\.(test|spec)$/, '');
        
        if (context.technologies.testing?.includes('jest')) {
            return `import { ${this.capitalizeFirst(testSubject)} } from './${testSubject}';

describe('${this.capitalizeFirst(testSubject)}', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should work correctly', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });

  // TODO: Add more test cases
});
`;
        }

        return `// Test for ${testSubject}
// TODO: Implement tests`;
    }

    private getTypeDefinitionTemplate(baseName: string): string {
        return `// Type definitions for ${baseName}
// TODO: Add comprehensive type definitions

declare module '${baseName}' {
  // TODO: Define module types
  export interface ${this.capitalizeFirst(baseName)} {
    // TODO: Define interface
  }
}
`;
    }

    extractDependencies(content: string): string[] {
        const dependencies: string[] = [];
        
        // Extract from import statements
        const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }

        // Extract dynamic imports
        const dynamicImportRegex = /import\(['"`]([^'"`]+)['"`]\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }

        return [...new Set(dependencies)]; // Remove duplicates
    }

    inferPatterns(content: string): string[] {
        const patterns: string[] = [];
        
        // Design patterns
        if (content.includes('getInstance') && content.includes('private constructor')) {
            patterns.push('singleton');
        }
        if (content.includes('Observable') || content.includes('Subject')) {
            patterns.push('observer');
        }
        if (content.includes('factory') || content.includes('Factory')) {
            patterns.push('factory');
        }
        if (content.includes('extends') || content.includes('implements')) {
            patterns.push('inheritance');
        }

        // React patterns
        if (content.includes('useState') || content.includes('useEffect')) {
            patterns.push('react-hooks');
        }
        if (content.includes('createContext') || content.includes('useContext')) {
            patterns.push('react-context');
        }

        // Async patterns
        if (content.includes('async') && content.includes('await')) {
            patterns.push('async-await');
        }
        if (content.includes('Promise')) {
            patterns.push('promises');
        }

        return patterns;
    }

    private extractExports(content: string): string[] {
        const exports: string[] = [];
        
        // Named exports
        const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
        let match;
        while ((match = namedExportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        // Export lists
        const exportListRegex = /export\s+\{\s*([^}]+)\s*\}/g;
        while ((match = exportListRegex.exec(content)) !== null) {
            const exportedItems = match[1].split(',').map(item => item.trim().split(' as ')[0]);
            exports.push(...exportedItems);
        }

        // Default export
        if (content.includes('export default')) {
            exports.push('default');
        }

        return [...new Set(exports)];
    }

    private inferFilePurpose(fileName: string, content: string): string {
        const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
        
        if (baseName.includes('test') || baseName.includes('spec')) {
            return 'Test file';
        }
        if (baseName.includes('config') || baseName.includes('setting')) {
            return 'Configuration file';
        }
        if (baseName.includes('util') || baseName.includes('helper')) {
            return 'Utility/Helper functions';
        }
        if (baseName.includes('type') || fileName.endsWith('.d.ts')) {
            return 'Type definitions';
        }
        if (content.includes('React.FC') || content.includes('component')) {
            return 'React component';
        }
        if (content.includes('class ') && content.includes('export')) {
            return 'Class module';
        }
        if (content.includes('export default') && content.includes('function')) {
            return 'Function module';
        }
        
        return 'General TypeScript module';
    }

    private suggestRelatedFiles(fileName: string, content: string, context: ProjectContext): string[] {
        const suggestions: string[] = [];
        const baseName = path.basename(fileName, path.extname(fileName));
        const isReactComponent = fileName.endsWith('.tsx');

        // Suggest test file
        if (!fileName.includes('.test.') && !fileName.includes('.spec.')) {
            suggestions.push(`${baseName}.test.ts${isReactComponent ? 'x' : ''}`);
        }

        // Suggest styles for React components
        if (isReactComponent) {
            suggestions.push(`${baseName}.module.css`);
            suggestions.push(`${baseName}.styled.ts`);
        }

        // Suggest type definitions
        if (!fileName.endsWith('.d.ts') && content.includes('interface') && content.includes('export')) {
            suggestions.push(`${baseName}.types.ts`);
        }

        // Suggest story file for components (if Storybook detected)
        if (isReactComponent && context.existingFiles.some(file => file.includes('.stories.'))) {
            suggestions.push(`${baseName}.stories.tsx`);
        }

        return suggestions;
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Register the agent
const tsAgent = new TypeScriptReplacementAgent();
FileExtensionAgentRegistry.getInstance().registerAgent(tsAgent);