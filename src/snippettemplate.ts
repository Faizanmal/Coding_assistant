import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface Snippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  category: 'component' | 'function' | 'class' | 'pattern' | 'boilerplate' | 'utility';
  framework?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  variables?: SnippetVariable[];
}

interface SnippetVariable {
  name: string;
  description: string;
  defaultValue: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[]; // For select type
}

interface Template {
  id: string;
  name: string;
  description: string;
  files: TemplateFile[];
  variables: TemplateVariable[];
  category: 'project' | 'component' | 'module' | 'config';
  framework?: string;
  tags: string[];
  createdAt: Date;
}

interface TemplateFile {
  path: string;
  content: string;
  language: string;
}

interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue: string;
  options?: string[];
}

export class SnippetTemplateLibrary {
  private snippets: Snippet[] = [];
  private templates: Template[] = [];
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadLibrary();
  }

  private async loadLibrary() {
    const storedSnippets = this.context.globalState.get<Snippet[]>('snippetLibrary', []);
    const storedTemplates = this.context.globalState.get<Template[]>('templateLibrary', []);
    
    this.snippets = storedSnippets;
    this.templates = storedTemplates;

    // Initialize with default snippets if empty
    if (this.snippets.length === 0) {
      await this.initializeDefaultSnippets();
    }
    
    // Initialize with default templates if empty
    if (this.templates.length === 0) {
      await this.initializeDefaultTemplates();
    }
  }

  private async initializeDefaultSnippets() {
    const defaultSnippets: Snippet[] = [
      {
        id: 'react-functional-component',
        title: 'React Functional Component',
        description: 'Basic React functional component with TypeScript',
        language: 'typescript',
        code: `import React from 'react';

interface {{componentName}}Props {
  // Add props here
}

export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <div className="{{className}}">
      {{content}}
    </div>
  );
};`,
        tags: ['react', 'component', 'typescript', 'functional'],
        category: 'component',
        framework: 'react',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        variables: [
          { name: 'componentName', description: 'Component name', defaultValue: 'MyComponent', type: 'string' },
          { name: 'className', description: 'CSS class name', defaultValue: 'my-component', type: 'string' },
          { name: 'content', description: 'Component content', defaultValue: 'Hello World', type: 'string' }
        ]
      },
      {
        id: 'async-function-with-error-handling',
        title: 'Async Function with Error Handling',
        description: 'Async function with proper error handling and logging',
        language: 'typescript',
        code: `async function {{functionName}}({{parameters}}): Promise<{{returnType}}> {
  try {
    {{functionBody}}
    
    return result;
  } catch (error) {
    console.error(\`Error in {{functionName}}:\`, error);
    {{errorHandling}}
    throw error;
  }
}`,
        tags: ['async', 'error-handling', 'typescript', 'function'],
        category: 'function',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        variables: [
          { name: 'functionName', description: 'Function name', defaultValue: 'fetchData', type: 'string' },
          { name: 'parameters', description: 'Function parameters', defaultValue: '', type: 'string' },
          { name: 'returnType', description: 'Return type', defaultValue: 'any', type: 'string' },
          { name: 'functionBody', description: 'Function implementation', defaultValue: 'const result = await someAsyncOperation();', type: 'string' },
          { name: 'errorHandling', description: 'Error handling code', defaultValue: '// Handle error appropriately', type: 'string' }
        ]
      },
      {
        id: 'express-route-handler',
        title: 'Express Route Handler',
        description: 'Express.js route handler with validation and error handling',
        language: 'typescript',
        code: `import { Request, Response, NextFunction } from 'express';

export const {{handlerName}} = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    {{validation}}
    
    // Process request
    {{processingLogic}}
    
    // Send response
    res.status({{statusCode}}).json({
      success: true,
      data: result,
      message: '{{successMessage}}'
    });
  } catch (error) {
    next(error);
  }
};`,
        tags: ['express', 'route', 'handler', 'typescript', 'api'],
        category: 'function',
        framework: 'express',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        variables: [
          { name: 'handlerName', description: 'Handler function name', defaultValue: 'handleRequest', type: 'string' },
          { name: 'validation', description: 'Request validation logic', defaultValue: '// Add validation logic here', type: 'string' },
          { name: 'processingLogic', description: 'Main processing logic', defaultValue: 'const result = await processData(req.body);', type: 'string' },
          { name: 'statusCode', description: 'HTTP status code', defaultValue: '200', type: 'select', options: ['200', '201', '202', '204'] },
          { name: 'successMessage', description: 'Success message', defaultValue: 'Operation completed successfully', type: 'string' }
        ]
      },
      {
        id: 'custom-hook',
        title: 'Custom React Hook',
        description: 'Custom React hook with TypeScript',
        language: 'typescript',
        code: `import { useState, useEffect, useCallback } from 'react';

interface {{hookName}}Options {
  {{optionsInterface}}
}

interface {{hookName}}Return {
  {{returnInterface}}
}

export const {{hookName}} = (options: {{hookName}}Options): {{hookName}}Return => {
  const [{{stateVariable}}, set{{stateVariableCapitalized}}] = useState<{{stateType}}>({{initialValue}});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  {{hookLogic}}

  return {
    {{stateVariable}},
    loading,
    error,
    {{additionalReturns}}
  };
};`,
        tags: ['react', 'hook', 'typescript', 'custom'],
        category: 'utility',
        framework: 'react',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        variables: [
          { name: 'hookName', description: 'Hook name (without "use" prefix)', defaultValue: 'useCustomHook', type: 'string' },
          { name: 'optionsInterface', description: 'Options interface properties', defaultValue: '// Define options here', type: 'string' },
          { name: 'returnInterface', description: 'Return interface properties', defaultValue: '// Define return type here', type: 'string' },
          { name: 'stateVariable', description: 'Main state variable name', defaultValue: 'data', type: 'string' },
          { name: 'stateVariableCapitalized', description: 'Capitalized state variable', defaultValue: 'Data', type: 'string' },
          { name: 'stateType', description: 'State type', defaultValue: 'any', type: 'string' },
          { name: 'initialValue', description: 'Initial state value', defaultValue: 'null', type: 'string' },
          { name: 'hookLogic', description: 'Hook implementation logic', defaultValue: '// Implement hook logic here', type: 'string' },
          { name: 'additionalReturns', description: 'Additional return values', defaultValue: '// Additional returns', type: 'string' }
        ]
      }
    ];

    this.snippets = defaultSnippets;
    await this.saveSnippets();
  }

  private async initializeDefaultTemplates() {
    const defaultTemplates: Template[] = [
      {
        id: 'react-component-module',
        name: 'React Component Module',
        description: 'Complete React component with styles, tests, and stories',
        category: 'component',
        framework: 'react',
        tags: ['react', 'component', 'testing', 'storybook'],
        createdAt: new Date(),
        variables: [
          { name: 'componentName', description: 'Component name', defaultValue: 'MyComponent', type: 'string' },
          { name: 'componentDescription', description: 'Component description', defaultValue: 'A reusable component', type: 'string' }
        ],
        files: [
          {
            path: '{{componentName}}/{{componentName}}.tsx',
            language: 'typescript',
            content: `import React from 'react';
import './{{componentName}}.scss';

interface {{componentName}}Props {
  // Define props here
}

/**
 * {{componentDescription}}
 */
export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <div className="{{componentName | lowercase}}">
      <h1>{{componentName}}</h1>
    </div>
  );
};`
          },
          {
            path: '{{componentName}}/{{componentName}}.scss',
            language: 'scss',
            content: `.{{componentName | lowercase}} {
  // Component styles here
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
}`
          },
          {
            path: '{{componentName}}/{{componentName}}.test.tsx',
            language: 'typescript',
            content: `import React from 'react';
import { render, screen } from '@testing-library/react';
import { {{componentName}} } from './{{componentName}}';

describe('{{componentName}}', () => {
  it('renders without crashing', () => {
    render(<{{componentName}} />);
    expect(screen.getByText('{{componentName}}')).toBeInTheDocument();
  });
});`
          },
          {
            path: '{{componentName}}/{{componentName}}.stories.tsx',
            language: 'typescript',
            content: `import type { Meta, StoryObj } from '@storybook/react';
import { {{componentName}} } from './{{componentName}}';

const meta: Meta<typeof {{componentName}}> = {
  title: 'Components/{{componentName}}',
  component: {{componentName}},
  parameters: {
    docs: {
      description: {
        component: '{{componentDescription}}'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof {{componentName}}>;

export const Default: Story = {
  args: {}
};`
          },
          {
            path: '{{componentName}}/index.ts',
            language: 'typescript',
            content: `export { {{componentName}} } from './{{componentName}}';
export type { {{componentName}}Props } from './{{componentName}}';`
          }
        ]
      },
      {
        id: 'express-api-module',
        name: 'Express API Module',
        description: 'Complete Express API module with routes, controllers, and middleware',
        category: 'module',
        framework: 'express',
        tags: ['express', 'api', 'typescript', 'rest'],
        createdAt: new Date(),
        variables: [
          { name: 'moduleName', description: 'Module name (singular)', defaultValue: 'user', type: 'string' },
          { name: 'moduleNamePlural', description: 'Module name (plural)', defaultValue: 'users', type: 'string' },
          { name: 'ModuleName', description: 'Module name (capitalized)', defaultValue: 'User', type: 'string' }
        ],
        files: [
          {
            path: '{{moduleNamePlural}}/{{moduleName}}.controller.ts',
            language: 'typescript',
            content: `import { Request, Response, NextFunction } from 'express';
import { {{ModuleName}}Service } from './{{moduleName}}.service';

export class {{ModuleName}}Controller {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const {{moduleNamePlural}} = await {{ModuleName}}Service.findAll();
      res.json({ success: true, data: {{moduleNamePlural}} });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {{moduleName}} = await {{ModuleName}}Service.findById(id);
      
      if (!{{moduleName}}) {
        return res.status(404).json({ success: false, message: '{{ModuleName}} not found' });
      }
      
      res.json({ success: true, data: {{moduleName}} });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {{moduleName}} = await {{ModuleName}}Service.create(req.body);
      res.status(201).json({ success: true, data: {{moduleName}} });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {{moduleName}} = await {{ModuleName}}Service.update(id, req.body);
      
      if (!{{moduleName}}) {
        return res.status(404).json({ success: false, message: '{{ModuleName}} not found' });
      }
      
      res.json({ success: true, data: {{moduleName}} });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await {{ModuleName}}Service.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}`
          },
          {
            path: '{{moduleNamePlural}}/{{moduleName}}.service.ts',
            language: 'typescript',
            content: `export interface {{ModuleName}} {
  id: string;
  // Add other properties here
  createdAt: Date;
  updatedAt: Date;
}

export class {{ModuleName}}Service {
  static async findAll(): Promise<{{ModuleName}}[]> {
    // Implement data retrieval logic
    throw new Error('Not implemented');
  }

  static async findById(id: string): Promise<{{ModuleName}} | null> {
    // Implement single item retrieval logic
    throw new Error('Not implemented');
  }

  static async create(data: Partial<{{ModuleName}}>): Promise<{{ModuleName}}> {
    // Implement creation logic
    throw new Error('Not implemented');
  }

  static async update(id: string, data: Partial<{{ModuleName}}>): Promise<{{ModuleName}} | null> {
    // Implement update logic
    throw new Error('Not implemented');
  }

  static async delete(id: string): Promise<void> {
    // Implement deletion logic
    throw new Error('Not implemented');
  }
}`
          },
          {
            path: '{{moduleNamePlural}}/{{moduleName}}.routes.ts',
            language: 'typescript',
            content: `import { Router } from 'express';
import { {{ModuleName}}Controller } from './{{moduleName}}.controller';
import { validate{{ModuleName}} } from './{{moduleName}}.middleware';

const router = Router();

router.get('/', {{ModuleName}}Controller.getAll);
router.get('/:id', {{ModuleName}}Controller.getById);
router.post('/', validate{{ModuleName}}, {{ModuleName}}Controller.create);
router.put('/:id', validate{{ModuleName}}, {{ModuleName}}Controller.update);
router.delete('/:id', {{ModuleName}}Controller.delete);

export { router as {{moduleName}}Routes };`
          },
          {
            path: '{{moduleNamePlural}}/{{moduleName}}.middleware.ts',
            language: 'typescript',
            content: `import { Request, Response, NextFunction } from 'express';

export const validate{{ModuleName}} = (req: Request, res: Response, next: NextFunction) => {
  // Add validation logic here
  // Example: check required fields, validate data types, etc.
  
  const { body } = req;
  
  // Basic validation example
  if (!body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required'
    });
  }
  
  // Add more specific validation as needed
  
  next();
};`
          }
        ]
      }
    ];

    this.templates = defaultTemplates;
    await this.saveTemplates();
  }

  async searchSnippets(query: string, language?: string): Promise<Snippet[]> {
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    return this.snippets.filter(snippet => {
      // Language filter
      if (language && snippet.language !== language) {
        return false;
      }
      
      // Text search in title, description, and tags
      const searchText = `${snippet.title} ${snippet.description} ${snippet.tags.join(' ')}`.toLowerCase();
      
      return searchTerms.every(term => searchText.includes(term));
    }).sort((a, b) => {
      // Sort by usage count and relevance
      return b.usageCount - a.usageCount;
    });
  }

  async searchTemplates(query: string, framework?: string): Promise<Template[]> {
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    return this.templates.filter(template => {
      // Framework filter
      if (framework && template.framework !== framework) {
        return false;
      }
      
      // Text search
      const searchText = `${template.name} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
      
      return searchTerms.every(term => searchText.includes(term));
    });
  }

  async getSnippet(id: string): Promise<Snippet | undefined> {
    return this.snippets.find(s => s.id === id);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.find(t => t.id === id);
  }

  async addSnippet(snippet: Partial<Snippet>): Promise<string> {
    const newSnippet: Snippet = {
      id: snippet.id || this.generateId(),
      title: snippet.title || 'Untitled Snippet',
      description: snippet.description || '',
      language: snippet.language || 'plaintext',
      code: snippet.code || '',
      tags: snippet.tags || [],
      category: snippet.category || 'utility',
      framework: snippet.framework,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      variables: snippet.variables || []
    };

    this.snippets.push(newSnippet);
    await this.saveSnippets();
    return newSnippet.id;
  }

  async incrementSnippetUsage(id: string) {
    const snippet = this.snippets.find(s => s.id === id);
    if (snippet) {
      snippet.usageCount++;
      snippet.updatedAt = new Date();
      await this.saveSnippets();
    }
  }

  processSnippetVariables(code: string, variables: Record<string, string>): string {
    let processedCode = code;
    
    // Replace variables in the format {{variableName}}
    for (const [name, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
      processedCode = processedCode.replace(regex, value);
      
      // Handle transformations like {{variableName | lowercase}}
      const transformRegex = new RegExp(`\\{\\{${name}\\s*\\|\\s*(\\w+)\\}\\}`, 'g');
      processedCode = processedCode.replace(transformRegex, (match, transform) => {
        switch (transform) {
          case 'lowercase':
            return value.toLowerCase();
          case 'uppercase':
            return value.toUpperCase();
          case 'capitalize':
            return value.charAt(0).toUpperCase() + value.slice(1);
          case 'camelcase':
            return value.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
          case 'pascalcase':
            const camel = value.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
            return camel.charAt(0).toUpperCase() + camel.slice(1);
          default:
            return value;
        }
      });
    }
    
    return processedCode;
  }

  async processTemplate(template: Template, variables: Record<string, string>): Promise<TemplateFile[]> {
    return template.files.map(file => ({
      path: this.processSnippetVariables(file.path, variables),
      content: this.processSnippetVariables(file.content, variables),
      language: file.language
    }));
  }

  private async saveSnippets() {
    await this.context.globalState.update('snippetLibrary', this.snippets);
  }

  private async saveTemplates() {
    await this.context.globalState.update('templateLibrary', this.templates);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // AI-powered search using LLM
  async aiSearch(query: string): Promise<{ snippets: Snippet[]; templates: Template[] }> {
    try {
      const prompt = `Given this search query: "${query}"

Available snippets and templates:
${this.snippets.map(s => `Snippet: ${s.title} - ${s.description} (${s.language}, ${s.tags.join(', ')})`).join('\n')}

${this.templates.map(t => `Template: ${t.name} - ${t.description} (${t.framework || 'any'}, ${t.tags.join(', ')})`).join('\n')}

Return the IDs of the most relevant snippets and templates for this query. Consider semantic meaning, not just keyword matching.
Format: {"snippetIds": ["id1", "id2"], "templateIds": ["id1", "id2"]}`;

      const response = await this.getLLMCompletion(prompt);
      const result = JSON.parse(response);

      const relevantSnippets = this.snippets.filter(s => result.snippetIds?.includes(s.id));
      const relevantTemplates = this.templates.filter(t => result.templateIds?.includes(t.id));

      return {
        snippets: relevantSnippets,
        templates: relevantTemplates
      };
    } catch (error) {
      // Fallback to regular search
      const snippets = await this.searchSnippets(query);
      const templates = await this.searchTemplates(query);
      return { snippets: snippets.slice(0, 5), templates: templates.slice(0, 3) };
    }
  }

  private async getLLMCompletion(prompt: string): Promise<string> {
    // Use the same LLM function as other parts of the extension
    try {
      // @ts-ignore
      return await (global as any).getLLMCompletion?.(prompt) || '{"snippetIds": [], "templateIds": []}';
    } catch (error) {
      return '{"snippetIds": [], "templateIds": []}';
    }
  }
}

// Provider class for webview
class SnippetTemplateProvider implements vscode.WebviewViewProvider {
  private webview?: vscode.WebviewView;
  private library: SnippetTemplateLibrary;

  constructor(private context: vscode.ExtensionContext) {
    this.library = new SnippetTemplateLibrary(context);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webview = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getWebviewContent();
    this.setupMessageHandling();
  }

  private setupMessageHandling() {
    this.webview?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'search':
          await this.handleSearch(message.query, message.searchType);
          break;
        case 'insertSnippet':
          await this.handleInsertSnippet(message.snippetId, message.variables);
          break;
        case 'generateFromTemplate':
          await this.handleGenerateFromTemplate(message.templateId, message.variables);
          break;
        case 'aiSearch':
          await this.handleAISearch(message.query);
          break;
      }
    });
  }

  private async handleSearch(query: string, searchType: 'snippets' | 'templates' | 'both') {
    try {
      let snippets: Snippet[] = [];
      let templates: Template[] = [];

      if (searchType === 'snippets' || searchType === 'both') {
        snippets = await this.library.searchSnippets(query);
      }
      
      if (searchType === 'templates' || searchType === 'both') {
        templates = await this.library.searchTemplates(query);
      }

      this.webview?.webview.postMessage({
        type: 'searchResults',
        data: { snippets, templates }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`);
    }
  }

  private async handleInsertSnippet(snippetId: string, variables: Record<string, string>) {
    try {
      const snippet = await this.library.getSnippet(snippetId);
      if (!snippet) {
        throw new Error('Snippet not found');
      }

      const processedCode = this.library.processSnippetVariables(snippet.code, variables);
      
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        throw new Error('No active editor');
      }

      await activeEditor.insertSnippet(new vscode.SnippetString(processedCode));
      await this.library.incrementSnippetUsage(snippetId);
      
      vscode.window.showInformationMessage(`Inserted snippet: ${snippet.title}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to insert snippet: ${error}`);
    }
  }

  private async handleGenerateFromTemplate(templateId: string, variables: Record<string, string>) {
    try {
      const template = await this.library.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const processedFiles = await this.library.processTemplate(template, variables);
      
      // Create files in the workspace
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      for (const file of processedFiles) {
        const filePath = path.join(workspaceFolder.uri.fsPath, file.path);
        const dir = path.dirname(filePath);
        
        // Create directory if it doesn't exist
        await fs.promises.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.promises.writeFile(filePath, file.content, 'utf8');
      }

      vscode.window.showInformationMessage(`Generated ${processedFiles.length} files from template: ${template.name}`);
      
      // Open the first file
      if (processedFiles.length > 0) {
        const firstFile = path.join(workspaceFolder.uri.fsPath, processedFiles[0].path);
        const doc = await vscode.workspace.openTextDocument(firstFile);
        await vscode.window.showTextDocument(doc);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate from template: ${error}`);
    }
  }

  private async handleAISearch(query: string) {
    try {
      const results = await this.library.aiSearch(query);
      this.webview?.webview.postMessage({
        type: 'aiSearchResults',
        data: results
      });
    } catch (error) {
      vscode.window.showErrorMessage(`AI search failed: ${error}`);
    }
  }

  private getWebviewContent(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snippet & Template Library</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 10px; 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .search-section {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .search-box {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            margin-bottom: 10px;
        }
        .search-controls {
            display: flex;
            gap: 5px;
            margin-bottom: 10px;
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-small {
            padding: 3px 8px;
            font-size: 0.8em;
        }
        .btn-ai {
            background: var(--vscode-textLink-foreground);
            color: white;
        }
        .item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 10px;
            cursor: pointer;
        }
        .item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .item-title {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .item-meta {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
        }
        .item-description {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        .item-tags {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
        .tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.7em;
        }
        .section-header {
            font-weight: bold;
            margin: 20px 0 10px 0;
            color: var(--vscode-textLink-foreground);
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .usage-count {
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7em;
        }
        .no-results {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
            font-style: italic;
        }
        .loading {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="search-section">
        <h3>📚 Snippet & Template Library</h3>
        <input type="text" class="search-box" id="searchInput" placeholder="Search snippets and templates..." onkeyup="handleSearch(event)">
        <div class="search-controls">
            <button class="btn btn-small" onclick="searchType('snippets')">Snippets</button>
            <button class="btn btn-small" onclick="searchType('templates')">Templates</button>
            <button class="btn btn-small" onclick="searchType('both')">Both</button>
            <button class="btn btn-small btn-ai" onclick="aiSearch()">🤖 AI Search</button>
        </div>
    </div>

    <div id="results">
        <div class="no-results">Enter a search term to find snippets and templates</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentSearchType = 'both';

        function searchType(type) {
            currentSearchType = type;
            const query = document.getElementById('searchInput').value.trim();
            if (query) {
                performSearch(query, type);
            }
        }

        function handleSearch(event) {
            const query = event.target.value.trim();
            if (query.length > 2) {
                performSearch(query, currentSearchType);
            } else {
                showNoResults();
            }
        }

        function performSearch(query, type) {
            showLoading();
            vscode.postMessage({ type: 'search', query, searchType: type });
        }

        function aiSearch() {
            const query = document.getElementById('searchInput').value.trim();
            if (!query) {
                alert('Please enter a search query for AI search');
                return;
            }
            showLoading('🤖 AI analyzing your request...');
            vscode.postMessage({ type: 'aiSearch', query });
        }

        function showLoading(message = 'Searching...') {
            document.getElementById('results').innerHTML = \`<div class="loading">\${message}</div>\`;
        }

        function showNoResults() {
            document.getElementById('results').innerHTML = '<div class="no-results">Enter a search term to find snippets and templates</div>';
        }

        function insertSnippet(snippetId, snippet) {
            if (snippet.variables && snippet.variables.length > 0) {
                // Collect variable values
                const variables = {};
                for (const variable of snippet.variables) {
                    let value = variable.defaultValue;
                    if (variable.type === 'select') {
                        value = prompt(\`Select \${variable.description}:\n\${variable.options.join(', ')}\`, variable.defaultValue);
                    } else {
                        value = prompt(\`\${variable.description}:\`, variable.defaultValue);
                    }
                    if (value === null) return; // User cancelled
                    variables[variable.name] = value;
                }
                vscode.postMessage({ type: 'insertSnippet', snippetId, variables });
            } else {
                vscode.postMessage({ type: 'insertSnippet', snippetId, variables: {} });
            }
        }

        function generateFromTemplate(templateId, template) {
            // Collect variable values
            const variables = {};
            for (const variable of template.variables) {
                let value = variable.defaultValue;
                if (variable.type === 'select') {
                    value = prompt(\`Select \${variable.description}:\n\${variable.options.join(', ')}\`, variable.defaultValue);
                } else {
                    value = prompt(\`\${variable.description}:\`, variable.defaultValue);
                }
                if (value === null) return; // User cancelled
                variables[variable.name] = value;
            }
            vscode.postMessage({ type: 'generateFromTemplate', templateId, variables });
        }

        function renderResults(data) {
            let html = '';
            
            if (data.snippets && data.snippets.length > 0) {
                html += '<div class="section-header">📄 Snippets</div>';
                data.snippets.forEach(snippet => {
                    html += \`
                        <div class="item" onclick="insertSnippet('\${snippet.id}', \${JSON.stringify(snippet).replace(/"/g, '&quot;')})">
                            <div class="item-header">
                                <div class="item-title">\${snippet.title}</div>
                                <div class="item-meta">
                                    <span class="usage-count">Used \${snippet.usageCount} times</span>
                                    \${snippet.language}
                                </div>
                            </div>
                            <div class="item-description">\${snippet.description}</div>
                            <div class="item-tags">
                                <span class="tag">\${snippet.category}</span>
                                \${snippet.framework ? \`<span class="tag">\${snippet.framework}</span>\` : ''}
                                \${snippet.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                            </div>
                        </div>
                    \`;
                });
            }
            
            if (data.templates && data.templates.length > 0) {
                html += '<div class="section-header">📁 Templates</div>';
                data.templates.forEach(template => {
                    html += \`
                        <div class="item" onclick="generateFromTemplate('\${template.id}', \${JSON.stringify(template).replace(/"/g, '&quot;')})">
                            <div class="item-header">
                                <div class="item-title">\${template.name}</div>
                                <div class="item-meta">
                                    \${template.files.length} files • \${template.framework || 'any framework'}
                                </div>
                            </div>
                            <div class="item-description">\${template.description}</div>
                            <div class="item-tags">
                                <span class="tag">\${template.category}</span>
                                \${template.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                            </div>
                        </div>
                    \`;
                });
            }
            
            if (html === '') {
                html = '<div class="no-results">No snippets or templates found for your search</div>';
            }
            
            document.getElementById('results').innerHTML = html;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'searchResults':
                case 'aiSearchResults':
                    renderResults(message.data);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

export function registerSnippetTemplateCommands(context: vscode.ExtensionContext) {
  const library = new SnippetTemplateLibrary(context);
  const provider = new SnippetTemplateProvider(context);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('snippetTemplateLibrary', provider)
  );

  // Quick search command
  const quickSearchCommand = vscode.commands.registerCommand('coding.quickSnippetSearch', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Search snippets and templates',
      placeHolder: 'Enter keywords, language, or framework...'
    });

    if (!query) {
      return;
    }

    const results = await library.aiSearch(query);
    const allItems = [...results.snippets, ...results.templates];

    if (allItems.length === 0) {
      vscode.window.showInformationMessage('No snippets or templates found');
      return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = [
      ...results.snippets.map(snippet => ({
        label: `$(code) ${snippet.title}`,
        description: snippet.language,
        detail: snippet.description,
        item: snippet,
        type: 'snippet'
      })),
      ...results.templates.map(template => ({
        label: `$(folder) ${template.name}`,
        description: `${template.files.length} files`,
        detail: template.description,
        item: template,
        type: 'template'
      }))
    ];

    quickPick.placeholder = 'Select a snippet or template';
    quickPick.title = `Search Results for "${query}"`;

    quickPick.onDidChangeSelection(async (selection) => {
      if (selection[0]) {
        const selected = selection[0] as any;
        
        if (selected.type === 'snippet') {
          // Handle snippet insertion with variables
          const snippet = selected.item as Snippet;
          const variables: Record<string, string> = {};
          
          // Collect variables if any
          if (snippet.variables && snippet.variables.length > 0) {
            for (const variable of snippet.variables) {
              const value = await vscode.window.showInputBox({
                prompt: variable.description,
                value: variable.defaultValue
              });
              if (value === undefined) {return;} // User cancelled
              variables[variable.name] = value;
            }
          }
          
          const processedCode = library.processSnippetVariables(snippet.code, variables);
          const activeEditor = vscode.window.activeTextEditor;
          
          if (activeEditor) {
            await activeEditor.insertSnippet(new vscode.SnippetString(processedCode));
            await library.incrementSnippetUsage(snippet.id);
            vscode.window.showInformationMessage(`Inserted: ${snippet.title}`);
          } else {
            vscode.window.showWarningMessage('No active editor to insert snippet');
          }
        } else if (selected.type === 'template') {
          // Handle template generation
          const template = selected.item as Template;
          const variables: Record<string, string> = {};
          
          // Collect variables
          for (const variable of template.variables) {
            const value = await vscode.window.showInputBox({
              prompt: variable.description,
              value: variable.defaultValue
            });
            if (value === undefined) {return;} // User cancelled
            variables[variable.name] = value;
          }
          
          // Generate files
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
          }

          try {
            const processedFiles = await library.processTemplate(template, variables);
            
            for (const file of processedFiles) {
              const filePath = path.join(workspaceFolder.uri.fsPath, file.path);
              const dir = path.dirname(filePath);
              
              await fs.promises.mkdir(dir, { recursive: true });
              await fs.promises.writeFile(filePath, file.content, 'utf8');
            }

            vscode.window.showInformationMessage(`Generated ${processedFiles.length} files from: ${template.name}`);
            
            // Open first file
            if (processedFiles.length > 0) {
              const firstFile = path.join(workspaceFolder.uri.fsPath, processedFiles[0].path);
              const doc = await vscode.workspace.openTextDocument(firstFile);
              await vscode.window.showTextDocument(doc);
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate template: ${error}`);
          }
        }
        
        quickPick.hide();
      }
    });

    quickPick.show();
  });

  context.subscriptions.push(quickSearchCommand);
}