import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getLLMCompletion } from './extension';

interface PromptTemplate {
  name: string;
  description: string;
  prompt: string;
  category: string;
  tags: string[];
  variables?: { [key: string]: string };
}

/**
 * Prompt Builder UI for creating and managing reusable prompts
 */
export class PromptBuilderProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'coding.promptBuilder';
  private _view?: vscode.WebviewView;
  private templates: PromptTemplate[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.loadTemplates();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'saveTemplate':
            this.saveTemplate(message.template);
            break;
          case 'executePrompt':
            this.executePrompt(message.prompt, message.variables);
            break;
          case 'deleteTemplate':
            this.deleteTemplate(message.name);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Builder</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .template-item { border: 1px solid var(--vscode-panel-border); margin: 10px 0; padding: 15px; border-radius: 5px; }
        .template-header { display: flex; justify-content: space-between; align-items: center; }
        .template-name { font-weight: bold; }
        .template-category { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 2px 6px; border-radius: 3px; font-size: 11px; }
        .template-description { margin: 8px 0; color: var(--vscode-descriptionForeground); }
        .template-prompt { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 3px; font-family: monospace; margin: 8px 0; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin: 2px; }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        .new-template { background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); margin: 10px 0; padding: 15px; border-radius: 5px; }
        input, textarea, select { width: 100%; padding: 8px; margin: 4px 0; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; }
    </style>
</head>
<body>
    <h2>🛠️ Prompt Builder</h2>
    
    <div class="new-template">
        <h3>Create New Template</h3>
        <input type="text" id="templateName" placeholder="Template Name" />
        <select id="templateCategory">
            <option value="coding">Coding</option>
            <option value="documentation">Documentation</option>
            <option value="testing">Testing</option>
            <option value="debugging">Debugging</option>
            <option value="refactoring">Refactoring</option>
            <option value="custom">Custom</option>
        </select>
        <input type="text" id="templateDescription" placeholder="Description" />
        <textarea id="templatePrompt" rows="4" placeholder="Prompt template (use {{variable}} for placeholders)"></textarea>
        <input type="text" id="templateTags" placeholder="Tags (comma-separated)" />
        <button class="button" onclick="saveTemplate()">Save Template</button>
    </div>

    <div id="templates">
        ${this.templates.map(template => `
        <div class="template-item">
            <div class="template-header">
                <span class="template-name">${template.name}</span>
                <span class="template-category">${template.category}</span>
            </div>
            <div class="template-description">${template.description}</div>
            <div class="template-prompt">${template.prompt}</div>
            <div>
                <button class="button" onclick="executePrompt('${template.name}')">Execute</button>
                <button class="button" onclick="deleteTemplate('${template.name}')">Delete</button>
            </div>
        </div>
        `).join('')}
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function saveTemplate() {
            const template = {
                name: document.getElementById('templateName').value,
                category: document.getElementById('templateCategory').value,
                description: document.getElementById('templateDescription').value,
                prompt: document.getElementById('templatePrompt').value,
                tags: document.getElementById('templateTags').value.split(',').map(t => t.trim())
            };
            
            if (template.name && template.prompt) {
                vscode.postMessage({ command: 'saveTemplate', template });
                document.getElementById('templateName').value = '';
                document.getElementById('templateDescription').value = '';
                document.getElementById('templatePrompt').value = '';
                document.getElementById('templateTags').value = '';
            }
        }

        function executePrompt(templateName) {
            const template = ${JSON.stringify(this.templates)}.find(t => t.name === templateName);
            if (template) {
                const variables = {};
                const matches = template.prompt.match(/\\{\\{(.*?)\\}\\}/g);
                if (matches) {
                    matches.forEach(match => {
                        const varName = match.replace('{{', '').replace('}}', '');
                        variables[varName] = prompt(\`Enter value for \${varName}:\`) || '';
                    });
                }
                vscode.postMessage({ command: 'executePrompt', prompt: template.prompt, variables });
            }
        }

        function deleteTemplate(name) {
            if (confirm('Delete template: ' + name + '?')) {
                vscode.postMessage({ command: 'deleteTemplate', name });
            }
        }
    </script>
</body>
</html>`;
  }

  private loadTemplates() {
    const templatesFile = path.join(this.context.globalStoragePath, 'prompt-templates.json');
    if (fs.existsSync(templatesFile)) {
      try {
        this.templates = JSON.parse(fs.readFileSync(templatesFile, 'utf-8'));
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
    
    // Load default templates if none exist
    if (this.templates.length === 0) {
      this.templates = this.getDefaultTemplates();
      this.saveTemplatesToFile();
    }
  }

  private saveTemplatesToFile() {
    const templatesFile = path.join(this.context.globalStoragePath, 'prompt-templates.json');
    if (!fs.existsSync(this.context.globalStoragePath)) {
      fs.mkdirSync(this.context.globalStoragePath, { recursive: true });
    }
    fs.writeFileSync(templatesFile, JSON.stringify(this.templates, null, 2));
  }

  private saveTemplate(template: PromptTemplate) {
    const existingIndex = this.templates.findIndex(t => t.name === template.name);
    if (existingIndex >= 0) {
      this.templates[existingIndex] = template;
    } else {
      this.templates.push(template);
    }
    this.saveTemplatesToFile();
    this.refresh();
  }

  private deleteTemplate(name: string) {
    this.templates = this.templates.filter(t => t.name !== name);
    this.saveTemplatesToFile();
    this.refresh();
  }

  private async executePrompt(prompt: string, variables: { [key: string]: string }) {
    let finalPrompt = prompt;
    
    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    try {
      const response = await getLLMCompletion(finalPrompt);
      if (response) {
        const doc = await vscode.workspace.openTextDocument({
          content: `# Prompt Result\n\n## Prompt\n${finalPrompt}\n\n## Response\n${response}`,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
      }
    } catch (error) {
      vscode.window.showErrorMessage('Error executing prompt: ' + error);
    }
  }

  private refresh() {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this._view.webview);
    }
  }

  private getDefaultTemplates(): PromptTemplate[] {
    return [
      {
        name: 'Code Review',
        description: 'Review code for best practices and improvements',
        prompt: 'Review this {{language}} code for best practices, performance, security, and maintainability:\n\n{{code}}',
        category: 'coding',
        tags: ['review', 'best-practices']
      },
      {
        name: 'Bug Fix',
        description: 'Analyze and fix bugs in code',
        prompt: 'This {{language}} code has a bug. Analyze and fix it:\n\n{{code}}\n\nError: {{error}}',
        category: 'debugging',
        tags: ['debug', 'fix']
      },
      {
        name: 'Documentation Generator',
        description: 'Generate comprehensive documentation',
        prompt: 'Generate detailed documentation for this {{language}} code including usage examples:\n\n{{code}}',
        category: 'documentation',
        tags: ['docs', 'comments']
      },
      {
        name: 'Test Generator',
        description: 'Generate unit tests for code',
        prompt: 'Generate comprehensive unit tests for this {{language}} {{type}} (function/class):\n\n{{code}}',
        category: 'testing',
        tags: ['test', 'unittest']
      },
      {
        name: 'Refactor Code',
        description: 'Refactor code for better structure',
        prompt: 'Refactor this {{language}} code to improve {{aspect}} (readability/performance/maintainability):\n\n{{code}}',
        category: 'refactoring',
        tags: ['refactor', 'optimize']
      }
    ];
  }
}

export function registerPromptBuilderCommands(context: vscode.ExtensionContext) {
  const provider = new PromptBuilderProvider(context.extensionUri, context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PromptBuilderProvider.viewType, provider),
    vscode.commands.registerCommand('coding.openPromptBuilder', () => {
      vscode.commands.executeCommand('workbench.view.extension.coding-prompt-builder');
    })
  );
}