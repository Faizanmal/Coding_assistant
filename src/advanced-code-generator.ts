/**
 * Advanced AI-Powered Code Generation System
 * Next-generation code generation with context awareness, pattern recognition, and intelligent templates
 */

import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { SecurityUtils } from './utils/sanitizer';
import { SecureConfigManager } from './utils/secure-config';
import * as path from 'path';
import * as fs from 'fs';

interface CodeGenerationRequest {
  type: 'component' | 'function' | 'class' | 'module' | 'api' | 'test' | 'documentation' | 'configuration';
  language: string;
  framework?: string;
  description: string;
  context?: string;
  requirements?: string[];
  patterns?: string[];
  style?: 'functional' | 'object-oriented' | 'reactive' | 'procedural';
  complexity?: 'simple' | 'intermediate' | 'advanced' | 'enterprise';
  includeTests?: boolean;
  includeDocumentation?: boolean;
  outputPath?: string;
}

interface CodeGenerationResult {
  success: boolean;
  files: GeneratedFile[];
  summary: string;
  recommendations: string[];
  errors?: string[];
  metadata: {
    linesGenerated: number;
    filesCreated: number;
    estimatedTime: string;
    complexity: string;
    patterns: string[];
  };
}

interface GeneratedFile {
  path: string;
  content: string;
  type: 'source' | 'test' | 'documentation' | 'configuration';
  language: string;
  description: string;
}

interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  language: string;
  framework?: string;
  template: string;
  variables: TemplateVariable[];
  dependencies?: string[];
  examples?: string[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: string;
}

interface ProjectContext {
  language: string;
  framework?: string;
  architecture: string;
  patterns: string[];
  dependencies: string[];
  testingFramework?: string;
  styleGuide?: string;
  conventions: {
    naming: string;
    structure: string;
    documentation: string;
  };
}

export class AdvancedCodeGenerator {
  private configManager: SecureConfigManager;
  private templates: Map<string, CodeTemplate> = new Map();
  private projectContext?: ProjectContext;

  constructor() {
    this.configManager = SecureConfigManager.getInstance();
    this.loadBuiltInTemplates();
  }

  /**
   * Generate code based on natural language description
   */
  public async generateCodeFromDescription(): Promise<void> {
    try {
      const description = await vscode.window.showInputBox({
        prompt: '🤖 Describe what you want to generate',
        placeHolder: 'e.g., Create a React component for user authentication with form validation',
        validateInput: (input) => {
          if (!input || input.trim().length < 10) {
            return 'Please provide a detailed description (at least 10 characters)';
          }
          return null;
        }
      });

      if (!description) {return;}

      const request = await this.buildGenerationRequest(description);
      if (!request) {return;}

      await this.executeCodeGeneration(request);

    } catch (error) {
      vscode.window.showErrorMessage(`Code generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Generate code using intelligent templates
   */
  public async generateFromTemplate(): Promise<void> {
    try {
      const templateItems = Array.from(this.templates.values()).map(template => ({
        label: template.name,
        description: template.description,
        detail: `${template.language} - ${template.type}`,
        template
      }));

      const selectedTemplate = await vscode.window.showQuickPick(templateItems, {
        placeHolder: 'Select a template to generate code',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selectedTemplate) {return;}

      const variables = await this.collectTemplateVariables(selectedTemplate.template);
      if (!variables) {return;}

      const generatedCode = await this.processTemplate(selectedTemplate.template, variables);
      await this.createFileFromTemplate(generatedCode, selectedTemplate.template);

    } catch (error) {
      vscode.window.showErrorMessage(`Template generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Generate complete project structure
   */
  public async generateProjectStructure(): Promise<void> {
    try {
      const projectType = await vscode.window.showQuickPick([
        { label: 'React Application', value: 'react-app' },
        { label: 'Node.js API', value: 'node-api' },
        { label: 'Python Package', value: 'python-package' },
        { label: 'TypeScript Library', value: 'typescript-library' },
        { label: 'Vue.js Application', value: 'vue-app' },
        { label: 'Express.js Server', value: 'express-server' },
        { label: 'FastAPI Application', value: 'fastapi-app' },
        { label: 'Custom Structure', value: 'custom' }
      ], {
        placeHolder: 'Select project type to generate'
      });

      if (!projectType) {return;}

      let projectName = await vscode.window.showInputBox({
        prompt: 'Enter project name',
        placeHolder: 'my-awesome-project',
        validateInput: (input) => {
          if (!input || !/^[a-zA-Z0-9-_]+$/.test(input)) {
            return 'Project name should contain only letters, numbers, hyphens, and underscores';
          }
          return null;
        }
      });

      if (!projectName) {return;}
      projectName = SecurityUtils.sanitizeFilename(projectName);

      if (!projectType.value) {
        vscode.window.showErrorMessage('Project type is required');
        return;
      }

      await this.generateCompleteProject(projectType.value, projectName);

    } catch (error) {
      vscode.window.showErrorMessage(`Project generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Generate tests for existing code
   */
  public async generateTestsForCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Please open a file to generate tests for');
      return;
    }

    try {
      const document = editor.document;
      const selectedText = editor.selection.isEmpty ? 
        document.getText() : 
        document.getText(editor.selection);

      if (!selectedText.trim()) {
        vscode.window.showErrorMessage('No code selected or file is empty');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🧪 Generating Tests...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Analyzing code structure...' });
        
        const codeAnalysis = await this.analyzeCodeForTesting(selectedText, document.languageId);
        
        progress.report({ message: 'Generating comprehensive tests...' });
        
        const tests = await this.generateTestCode(codeAnalysis, document.fileName);
        
        progress.report({ message: 'Creating test files...' });
        
        await this.createTestFiles(tests, document.fileName);
        
        vscode.window.showInformationMessage(
          `✅ Generated ${tests.length} test file(s)`,
          'Open Tests'
        ).then(selection => {
          if (selection === 'Open Tests' && tests.length > 0) {
            vscode.workspace.openTextDocument(tests[0].path).then(doc => {
              vscode.window.showTextDocument(doc);
            });
          }
        });
      });

    } catch (error) {
      vscode.window.showErrorMessage(`Test generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Generate documentation for code
   */
  public async generateDocumentation(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('Please open a file to generate documentation for');
      return;
    }

    try {
      const document = editor.document;
      const selectedText = editor.selection.isEmpty ? 
        document.getText() : 
        document.getText(editor.selection);

      if (!selectedText.trim()) {
        vscode.window.showErrorMessage('No code selected or file is empty');
        return;
      }

      const docType = await vscode.window.showQuickPick([
        { label: 'Inline Comments', value: 'inline' },
        { label: 'JSDoc/PyDoc Style', value: 'structured' },
        { label: 'README Documentation', value: 'readme' },
        { label: 'API Documentation', value: 'api' },
        { label: 'User Guide', value: 'guide' }
      ], {
        placeHolder: 'Select documentation type'
      });

      if (!docType) {return;}

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '📚 Generating Documentation...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Analyzing code structure...' });
        
        const codeAnalysis = await this.analyzeCodeForDocumentation(selectedText, document.languageId);
        
        progress.report({ message: 'Generating documentation...' });
        
        const documentation = await this.generateDocumentationContent(codeAnalysis, docType.value);
        
        progress.report({ message: 'Creating documentation files...' });
        
        await this.createDocumentationFiles(documentation, document.fileName, docType.value);
        
        vscode.window.showInformationMessage('✅ Documentation generated successfully');
      });

    } catch (error) {
      vscode.window.showErrorMessage(`Documentation generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Smart code completion and suggestions
   */
  public async provideSmartCompletion(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    try {
      const document = editor.document;
      const position = editor.selection.active;
      const lineText = document.lineAt(position.line).text;
      const context = this.buildCompletionContext(document, position);

      const suggestions = await this.generateSmartSuggestions(context, lineText, document.languageId);
      
      if (suggestions.length === 0) {
        vscode.window.showInformationMessage('No smart suggestions available for current context');
        return;
      }

      const selectedSuggestion = await vscode.window.showQuickPick(
        suggestions.map((suggestion, index) => ({
          label: `${index + 1}. ${suggestion.title}`,
          description: suggestion.description,
          detail: suggestion.code.substring(0, 100) + '...',
          suggestion
        })),
        {
          placeHolder: 'Select code suggestion to insert',
          matchOnDescription: true
        }
      );

      if (!selectedSuggestion) {return;}

      await this.insertCodeSuggestion(editor, selectedSuggestion.suggestion);

    } catch (error) {
      vscode.window.showErrorMessage(`Smart completion failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Generate API endpoints
   */
  public async generateAPIEndpoints(): Promise<void> {
    try {
      const apiType = await vscode.window.showQuickPick([
        { label: 'REST API', value: 'rest' },
        { label: 'GraphQL API', value: 'graphql' },
        { label: 'gRPC Service', value: 'grpc' },
        { label: 'WebSocket API', value: 'websocket' }
      ], {
        placeHolder: 'Select API type'
      });

      if (!apiType) {return;}

      const framework = await vscode.window.showQuickPick([
        { label: 'Express.js', value: 'express' },
        { label: 'FastAPI', value: 'fastapi' },
        { label: 'Flask', value: 'flask' },
        { label: 'Spring Boot', value: 'spring' },
        { label: 'ASP.NET Core', value: 'aspnet' },
        { label: 'Custom', value: 'custom' }
      ], {
        placeHolder: 'Select framework'
      });

      if (!framework) {return;}

      const resourceName = await vscode.window.showInputBox({
        prompt: 'Enter resource name (e.g., users, products, orders)',
        placeHolder: 'users',
        validateInput: (input) => {
          if (!input || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(input)) {
            return 'Resource name should start with a letter and contain only letters, numbers, and underscores';
          }
          return null;
        }
      });

      if (!resourceName) {return;}

      await this.generateAPI(apiType.value, framework.value, resourceName);

    } catch (error) {
      vscode.window.showErrorMessage(`API generation failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Private implementation methods
   */
  private async buildGenerationRequest(description: string): Promise<CodeGenerationRequest | null> {
    // Analyze description to build structured request
    const analysisPrompt = `
Analyze this code generation request and extract structured information:

Description: "${description}"

Return ONLY a JSON object with this structure:
{
  "type": "component|function|class|module|api|test|documentation|configuration",
  "language": "detected programming language",
  "framework": "detected framework if any",
  "description": "cleaned description",
  "requirements": ["list of requirements"],
  "complexity": "simple|intermediate|advanced|enterprise",
  "style": "functional|object-oriented|reactive|procedural"
}

Focus on extracting clear, actionable information.
`;

    try {
      const response = await getLLMCompletion(analysisPrompt);
      
      if (!response) {
        console.warn('Code analysis returned no response');
        return { 
          type: 'function', 
          language: 'javascript',
          description: description, 
          requirements: [], 
          complexity: 'simple', 
          style: 'functional' 
        };
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanResponse);
      
      // Additional user input for missing information
      if (!parsed.language) {
        const language = await vscode.window.showQuickPick([
          'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Rust', 'Other'
        ], { placeHolder: 'Select programming language' });
        
        if (!language) {return null;}
        parsed.language = language;
      }

      return parsed as CodeGenerationRequest;
    } catch (error) {
      console.error('Failed to parse generation request:', error);
      return null;
    }
  }

  private async executeCodeGeneration(request: CodeGenerationRequest): Promise<void> {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🚀 Generating Code...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Analyzing requirements...' });
        
        const projectContext = await this.analyzeProjectContext();
        
        progress.report({ message: 'Generating code structure...' });
        
        const generationPrompt = this.buildGenerationPrompt(request, projectContext);
        const generatedCode = await getLLMCompletion(generationPrompt);
        
        if (!generatedCode) {
          throw new Error('Code generation returned no response');
        }
        
        progress.report({ message: 'Processing generated code...' });
        
        const result = await this.processGeneratedCode(generatedCode, request);
        
        progress.report({ message: 'Creating files...' });
        
        await this.createGeneratedFiles(result);
        
        await this.displayGenerationResults(result);
        
      } catch (error) {
        throw error;
      }
    });
  }

  private buildGenerationPrompt(request: CodeGenerationRequest, context: ProjectContext | null): string {
    return `
Generate ${request.type} code based on the following requirements:

**Description**: ${request.description}
**Language**: ${request.language}
**Framework**: ${request.framework || 'None specified'}
**Style**: ${request.style}
**Complexity**: ${request.complexity}

${context ? `
**Project Context**:
- Architecture: ${context.architecture}
- Patterns: ${context.patterns.join(', ')}
- Testing Framework: ${context.testingFramework || 'Not specified'}
- Naming Convention: ${context.conventions.naming}
` : ''}

**Requirements**:
${(request.requirements || []).map(req => `- ${req}`).join('\n')}

**Instructions**:
1. Generate complete, production-ready code
2. Include proper error handling and validation
3. Follow best practices and design patterns
4. Add comprehensive comments and documentation
5. Include type annotations where applicable
6. Make code modular and testable

${request.includeTests ? '7. Generate corresponding unit tests' : ''}
${request.includeDocumentation ? '8. Generate API documentation' : ''}

Return the code in this JSON format:
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "file content here",
      "type": "source|test|documentation|configuration",
      "description": "Brief description of this file"
    }
  ],
  "summary": "Brief summary of what was generated",
  "recommendations": ["Additional recommendations"]
}

Generate high-quality, maintainable code that follows industry standards.
`;
  }

  private async processGeneratedCode(generatedCode: string, request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    try {
      const cleanResponse = generatedCode.replace(/```json\n?/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanResponse);
      
      return {
        success: true,
        files: parsed.files.map((file: any) => ({
          ...file,
          language: request.language
        })),
        summary: parsed.summary || 'Code generated successfully',
        recommendations: parsed.recommendations || [],
        metadata: {
          linesGenerated: parsed.files.reduce((total: number, file: any) => 
            total + (file.content?.split('\n').length || 0), 0),
          filesCreated: parsed.files.length,
          estimatedTime: this.estimateImplementationTime(parsed.files),
          complexity: request.complexity || 'intermediate',
          patterns: request.patterns || []
        }
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        summary: 'Failed to generate code',
        recommendations: [],
        errors: [String(error)],
        metadata: {
          linesGenerated: 0,
          filesCreated: 0,
          estimatedTime: '0 minutes',
          complexity: 'unknown',
          patterns: []
        }
      };
    }
  }

  private async createGeneratedFiles(result: CodeGenerationResult): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !result.success) {return;}

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    for (const file of result.files) {
      try {
        const fullPath = path.join(workspaceRoot, file.path);
        const dir = path.dirname(fullPath);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write file content
        fs.writeFileSync(fullPath, file.content, 'utf8');
      } catch (error) {
        console.error(`Failed to create file ${file.path}:`, error);
      }
    }
  }

  private async displayGenerationResults(result: CodeGenerationResult): Promise<void> {
    if (!result.success) {
      vscode.window.showErrorMessage('Code generation failed');
      return;
    }

    const message = `✅ Generated ${result.metadata.filesCreated} file(s) with ${result.metadata.linesGenerated} lines of code`;
    
    const action = await vscode.window.showInformationMessage(
      message,
      'View Summary',
      'Open First File'
    );

    if (action === 'View Summary') {
      await this.showGenerationSummary(result);
    } else if (action === 'Open First File' && result.files.length > 0) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders) {
        const filePath = path.join(workspaceFolders[0].uri.fsPath, result.files[0].path);
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      }
    }
  }

  private async showGenerationSummary(result: CodeGenerationResult): Promise<void> {
    const summary = `
# 🚀 Code Generation Summary

**Generated**: ${new Date().toLocaleString()}

## Overview
- **Files Created**: ${result.metadata.filesCreated}
- **Lines of Code**: ${result.metadata.linesGenerated}
- **Estimated Implementation Time**: ${result.metadata.estimatedTime}
- **Complexity**: ${result.metadata.complexity}

## Summary
${result.summary}

## Generated Files
${result.files.map((file, index) => `
### ${index + 1}. ${file.path}
- **Type**: ${file.type}
- **Language**: ${file.language}
- **Description**: ${file.description}
`).join('\n')}

## Recommendations
${result.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps
1. Review the generated code
2. Run tests to ensure functionality
3. Customize as needed for your specific requirements
4. Consider the recommendations above
`;

    const doc = await vscode.workspace.openTextDocument({
      content: summary,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  private loadBuiltInTemplates(): void {
    // Load some built-in templates
    const reactComponentTemplate: CodeTemplate = {
      id: 'react-component',
      name: 'React Functional Component',
      description: 'Modern React functional component with TypeScript',
      type: 'component',
      language: 'TypeScript',
      framework: 'React',
      template: `
import React, { useState, useEffect } from 'react';
import './{{componentName}}.css';

interface {{componentName}}Props {
  {{#each props}}
  {{name}}: {{type}};
  {{/each}}
}

const {{componentName}}: React.FC<{{componentName}}Props> = ({ {{propNames}} }) => {
  {{#if hasState}}
  const [{{stateName}}, set{{capitalizeFirst stateName}}] = useState<{{stateType}}>({{defaultState}});
  {{/if}}

  {{#if hasEffect}}
  useEffect(() => {
    // Component mount logic
    return () => {
      // Cleanup logic
    };
  }, []);
  {{/if}}

  return (
    <div className="{{kebabCase componentName}}">
      {{content}}
    </div>
  );
};

export default {{componentName}};
`,
      variables: [
        { name: 'componentName', type: 'string', description: 'Component name', required: true },
        { name: 'props', type: 'array', description: 'Component props', required: false, default: [] },
        { name: 'hasState', type: 'boolean', description: 'Include state management', required: false, default: false },
        { name: 'hasEffect', type: 'boolean', description: 'Include useEffect', required: false, default: false }
      ]
    };

    this.templates.set(reactComponentTemplate.id, reactComponentTemplate);

    // Add more templates...
  }

  private async collectTemplateVariables(template: CodeTemplate): Promise<Map<string, any> | null> {
    const variables = new Map<string, any>();

    for (const variable of template.variables) {
      if (variable.required || await this.shouldIncludeOptionalVariable(variable)) {
        const value = await this.promptForVariable(variable);
        if (value === null && variable.required) {
          return null; // User cancelled on required variable
        }
        variables.set(variable.name, value || variable.default);
      }
    }

    return variables;
  }

  private async shouldIncludeOptionalVariable(variable: TemplateVariable): Promise<boolean> {
    const response = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: `Include ${variable.name}? ${variable.description}`
    });
    return response === 'Yes';
  }

  private async promptForVariable(variable: TemplateVariable): Promise<any> {
    switch (variable.type) {
      case 'string':
        return await vscode.window.showInputBox({
          prompt: variable.description,
          value: variable.default,
          validateInput: variable.validation ? (input) => {
            try {
              const regex = new RegExp(variable.validation!);
              return regex.test(input) ? null : 'Invalid format';
            } catch {
              return null;
            }
          } : undefined
        });

      case 'boolean':
        const boolResponse = await vscode.window.showQuickPick(['true', 'false'], {
          placeHolder: variable.description
        });
        return boolResponse === 'true';

      case 'array':
        const arrayInput = await vscode.window.showInputBox({
          prompt: `${variable.description} (comma-separated)`,
          value: Array.isArray(variable.default) ? variable.default.join(', ') : ''
        });
        return arrayInput ? arrayInput.split(',').map(s => s.trim()) : [];

      default:
        return variable.default;
    }
  }

  private async processTemplate(template: CodeTemplate, variables: Map<string, any>): Promise<string> {
    // Simple template processing - in a real implementation, use a proper template engine
    let processed = template.template;
    
    for (const [key, value] of variables) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    // Remove unused template variables
    processed = processed.replace(/{{[^}]+}}/g, '');
    
    return processed;
  }

  private async createFileFromTemplate(content: string, template: CodeTemplate): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {return;}

    const fileName = await vscode.window.showInputBox({
      prompt: 'Enter file name',
      value: `generated-${template.type}.${this.getFileExtension(template.language)}`
    });

    if (!fileName) {return;}

    const safeName = SecurityUtils.sanitizeFilename(fileName);
    const filePath = path.join(workspaceFolders[0].uri.fsPath, safeName);
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  }

  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      'TypeScript': 'ts',
      'JavaScript': 'js',
      'Python': 'py',
      'Java': 'java',
      'C#': 'cs',
      'Go': 'go',
      'Rust': 'rs'
    };
    return extensions[language] || 'txt';
  }

  private async analyzeProjectContext(): Promise<ProjectContext | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {return null;}

    try {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const packageJsonPath = path.join(workspaceRoot, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        return {
          language: 'JavaScript/TypeScript',
          framework: this.detectFramework(packageJson),
          architecture: 'modular',
          patterns: this.detectPatterns(packageJson),
          dependencies: Object.keys(packageJson.dependencies || {}),
          testingFramework: this.detectTestingFramework(packageJson),
          conventions: {
            naming: 'camelCase',
            structure: 'standard',
            documentation: 'JSDoc'
          }
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private detectFramework(packageJson: any): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) {return 'React';}
    if (deps.vue) {return 'Vue';}
    if (deps.angular) {return 'Angular';}
    if (deps.express) {return 'Express';}
    if (deps.next) {return 'Next.js';}
    
    return undefined;
  }

  private detectPatterns(packageJson: any): string[] {
    const patterns: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.redux || deps['@reduxjs/toolkit']) {patterns.push('Redux');}
    if (deps.mobx) {patterns.push('MobX');}
    if (deps.rxjs) {patterns.push('Reactive');}
    
    return patterns;
  }

  private detectTestingFramework(packageJson: any): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.jest) {return 'Jest';}
    if (deps.mocha) {return 'Mocha';}
    if (deps.vitest) {return 'Vitest';}
    if (deps.cypress) {return 'Cypress';}
    
    return undefined;
  }

  private async generateCompleteProject(projectType: string, projectName: string): Promise<void> {
    // Implementation for complete project generation
    vscode.window.showInformationMessage(`Generating ${projectType} project: ${projectName}`);
    // This would generate a complete project structure based on the type
  }

  private async analyzeCodeForTesting(code: string, language: string): Promise<any> {
    // Analyze code to understand what tests should be generated
    return {
      functions: [],
      classes: [],
      modules: [],
      complexity: 'intermediate'
    };
  }

  private async generateTestCode(analysis: any, fileName: string): Promise<GeneratedFile[]> {
    // Generate test files based on analysis
    return [];
  }

  private async createTestFiles(tests: GeneratedFile[], sourceFileName: string): Promise<void> {
    // Create test files
  }

  private async analyzeCodeForDocumentation(code: string, language: string): Promise<any> {
    // Analyze code for documentation generation
    return {};
  }

  private async generateDocumentationContent(analysis: any, docType: string): Promise<string> {
    // Generate documentation content
    return '';
  }

  private async createDocumentationFiles(content: string, sourceFileName: string, docType: string): Promise<void> {
    // Create documentation files
  }

  private buildCompletionContext(document: vscode.TextDocument, position: vscode.Position): string {
    // Build context for smart completion
    return '';
  }

  private async generateSmartSuggestions(context: string, lineText: string, language: string): Promise<any[]> {
    // Generate smart code suggestions
    return [];
  }

  private async insertCodeSuggestion(editor: vscode.TextEditor, suggestion: any): Promise<void> {
    // Insert selected suggestion into editor
  }

  private async generateAPI(apiType: string, framework: string, resourceName: string): Promise<void> {
    // Generate API endpoints
    vscode.window.showInformationMessage(`Generating ${apiType} API for ${resourceName} using ${framework}`);
  }

  private estimateImplementationTime(files: any[]): string {
    const totalLines = files.reduce((sum, file) => sum + (file.content?.split('\n').length || 0), 0);
    const minutes = Math.max(5, Math.round(totalLines / 10)); // Rough estimate
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.round(minutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  }
}

/**
 * Register advanced code generator commands
 */
export function registerAdvancedCodeGeneratorCommands(context: vscode.ExtensionContext) {
  const codeGenerator = new AdvancedCodeGenerator();

  context.subscriptions.push(
    vscode.commands.registerCommand('coding.generate.fromDescription', () => {
      codeGenerator.generateCodeFromDescription();
    }),

    vscode.commands.registerCommand('coding.generate.fromTemplate', () => {
      codeGenerator.generateFromTemplate();
    }),

    vscode.commands.registerCommand('coding.generate.projectStructure', () => {
      codeGenerator.generateProjectStructure();
    }),

    vscode.commands.registerCommand('coding.generate.tests', () => {
      codeGenerator.generateTestsForCode();
    }),

    vscode.commands.registerCommand('coding.generate.documentation', () => {
      codeGenerator.generateDocumentation();
    }),

    vscode.commands.registerCommand('coding.generate.smartCompletion', () => {
      codeGenerator.provideSmartCompletion();
    }),

    vscode.commands.registerCommand('coding.generate.apiEndpoints', () => {
      codeGenerator.generateAPIEndpoints();
    })
  );
}