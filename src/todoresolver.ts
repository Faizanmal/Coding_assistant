import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface TODOItem {
  id: string;
  text: string;
  file: string;
  line: number;
  column: number;
  type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE' | 'BUG';
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: string; // Surrounding code context
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  suggestedSolution?: string;
  relatedFiles?: string[];
  createdAt: Date;
  resolvedAt?: Date;
  assignee?: string;
}

interface ContextualSolution {
  solution: string;
  explanation: string;
  codeExample: string;
  confidence: number;
  relatedPatterns: string[];
  estimatedTime: string;
}

export class ContextualTODOResolver {
  private todos: TODOItem[] = [];
  private context: vscode.ExtensionContext;
  private workspaceRoot: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.scanWorkspace();
  }

  async scanWorkspace(): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    try {
      const files = await this.getAllFiles(this.workspaceRoot);
      const codeFiles = files.filter(file => this.isCodeFile(file));

      this.todos = [];
      
      for (const file of codeFiles) {
        const fileTodos = await this.scanFile(file);
        this.todos.push(...fileTodos);
      }

      // Sort by priority and creation date
      this.todos.sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      });

    } catch (error) {
      console.error('Error scanning workspace for TODOs:', error);
    }
  }

  private async getAllFiles(dir: string, fileList: string[] = []): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.promises.stat(filePath);
        
        if (stat.isDirectory()) {
          // Skip common directories that shouldn't contain TODOs
          if (!['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(file)) {
            await this.getAllFiles(filePath, fileList);
          }
        } else {
          fileList.push(filePath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
    
    return fileList;
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.php',
      '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj', '.dart', '.vue',
      '.svelte', '.html', '.css', '.scss', '.sass', '.less', '.sql', '.sh'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return codeExtensions.includes(ext);
  }

  private async scanFile(filePath: string): Promise<TODOItem[]> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const todos: TODOItem[] = [];

      // Enhanced regex to capture various TODO formats
      const todoRegex = /(\/\/\s*|\/\*\s*|#\s*|<!--\s*|"""\s*|'''\s*)\b(TODO|FIXME|HACK|NOTE|BUG)\b\s*:?\s*(.*?)(\s*\*\/|-->|"""|\n|$)/gi;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        while ((match = todoRegex.exec(line)) !== null) {
          const type = match[2].toUpperCase() as TODOItem['type'];
          const text = match[3].trim();
          
          if (text) {
            const todo: TODOItem = {
              id: this.generateId(),
              text,
              file: filePath,
              line: i + 1,
              column: match.index || 0,
              type,
              priority: this.determinePriority(text, type),
              context: this.getContext(lines, i),
              estimatedComplexity: await this.estimateComplexity(text, filePath, i),
              createdAt: new Date()
            };

            // Try to find related files
            todo.relatedFiles = await this.findRelatedFiles(todo);
            
            todos.push(todo);
          }
        }
      }

      return todos;
    } catch (error) {
      return [];
    }
  }

  private determinePriority(text: string, type: TODOItem['type']): TODOItem['priority'] {
    const criticalKeywords = ['critical', 'urgent', 'security', 'vulnerable', 'crash', 'error'];
    const highKeywords = ['important', 'performance', 'optimize', 'refactor', 'memory'];
    const lowKeywords = ['minor', 'cosmetic', 'cleanup', 'optional'];

    const textLower = text.toLowerCase();

    if (type === 'BUG' || type === 'FIXME') {
      if (criticalKeywords.some(keyword => textLower.includes(keyword))) {
        return 'critical';
      }
      return 'high';
    }

    if (criticalKeywords.some(keyword => textLower.includes(keyword))) {
      return 'critical';
    }

    if (highKeywords.some(keyword => textLower.includes(keyword))) {
      return 'high';
    }

    if (lowKeywords.some(keyword => textLower.includes(keyword))) {
      return 'low';
    }

    return 'medium';
  }

  private getContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 2);
    const end = Math.min(lines.length, lineIndex + 3);
    return lines.slice(start, end).join('\n');
  }

  private async estimateComplexity(text: string, filePath: string, lineIndex: number): Promise<TODOItem['estimatedComplexity']> {
    // Simple heuristics for complexity estimation
    const complexityIndicators = {
      simple: ['typo', 'rename', 'comment', 'format', 'style'],
      moderate: ['refactor', 'optimize', 'improve', 'update', 'add'],
      complex: ['rewrite', 'redesign', 'architecture', 'algorithm', 'performance']
    };

    const textLower = text.toLowerCase();

    for (const [complexity, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => textLower.includes(indicator))) {
        return complexity as TODOItem['estimatedComplexity'];
      }
    }

    // Check surrounding code complexity
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const contextSize = 10;
      const start = Math.max(0, lineIndex - contextSize);
      const end = Math.min(lines.length, lineIndex + contextSize);
      const context = lines.slice(start, end).join('\n');

      // Count complexity indicators in context
      const complexityScore = 
        (context.match(/function|class|interface/g) || []).length * 2 +
        (context.match(/if|for|while|switch/g) || []).length +
        (context.match(/try|catch|throw/g) || []).length * 1.5;

      if (complexityScore > 10) {
        return 'complex';
      }
      if (complexityScore > 5) {
        return 'moderate';
      }
      return 'simple';
    } catch {
      return 'moderate';
    }
  }

  private async findRelatedFiles(todo: TODOItem): Promise<string[]> {
    const relatedFiles: string[] = [];
    const text = todo.text.toLowerCase();

    // Extract potential file names or function names from TODO text
    const fileExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp'];
    const potentialNames = text.match(/\b[a-zA-Z][a-zA-Z0-9_-]*\b/g) || [];

    try {
      const allFiles = await this.getAllFiles(this.workspaceRoot);
      
      for (const name of potentialNames) {
        const matchingFiles = allFiles.filter(file => {
          const fileName = path.basename(file, path.extname(file)).toLowerCase();
          return fileName.includes(name.toLowerCase()) || 
                 file.toLowerCase().includes(name.toLowerCase());
        });
        
        relatedFiles.push(...matchingFiles.slice(0, 3)); // Limit to 3 matches per name
      }
    } catch (error) {
      // Continue without related files
    }

    return [...new Set(relatedFiles)]; // Remove duplicates
  }

  async generateSolution(todoId: string): Promise<ContextualSolution | null> {
    const todo = this.todos.find(t => t.id === todoId);
    if (!todo) {
      return null;
    }

    try {
      const fileContent = await fs.promises.readFile(todo.file, 'utf8');
      const language = this.getLanguageFromFile(todo.file);
      
      const prompt = `Analyze this TODO and provide a contextual solution:

TODO Type: ${todo.type}
TODO Text: "${todo.text}"
File: ${path.basename(todo.file)}
Language: ${language}
Priority: ${todo.priority}
Estimated Complexity: ${todo.estimatedComplexity}

Context (surrounding code):
\`\`\`${language}
${todo.context}
\`\`\`

Additional file context (relevant sections):
\`\`\`${language}
${this.getRelevantFileContext(fileContent, todo.line)}
\`\`\`

Please provide:
1. A clear, actionable solution
2. Explanation of why this approach is recommended
3. Concrete code example showing the implementation
4. Confidence level (0-100%)
5. Related design patterns or best practices
6. Estimated time to implement

Format as JSON:
{
  "solution": "Clear step-by-step solution",
  "explanation": "Why this approach is recommended",
  "codeExample": "Concrete code showing implementation",
  "confidence": 85,
  "relatedPatterns": ["pattern1", "pattern2"],
  "estimatedTime": "30 minutes"
}`;

      const response = await this.getLLMCompletion(prompt);
      const solution = JSON.parse(response);
      
      // Store the solution with the TODO
      const todoIndex = this.todos.findIndex(t => t.id === todoId);
      if (todoIndex !== -1) {
        this.todos[todoIndex].suggestedSolution = solution.solution;
      }
      
      return solution;
    } catch (error) {
      console.error('Error generating solution:', error);
      return {
        solution: 'Unable to generate automatic solution. Manual analysis required.',
        explanation: 'The AI solution generator encountered an error.',
        codeExample: '// Manual implementation needed',
        confidence: 0,
        relatedPatterns: [],
        estimatedTime: 'Unknown'
      };
    }
  }

  private getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath);
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'tsx',
      '.jsx': 'jsx',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust'
    };
    return languageMap[ext] || 'plaintext';
  }

  private getRelevantFileContext(content: string, todoLine: number): string {
    const lines = content.split('\n');
    const contextSize = 15;
    const start = Math.max(0, todoLine - contextSize);
    const end = Math.min(lines.length, todoLine + contextSize);
    return lines.slice(start, end).join('\n');
  }

  async resolveTODO(todoId: string, resolution?: string): Promise<boolean> {
    const todoIndex = this.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) {
      return false;
    }

    const todo = this.todos[todoIndex];
    
    // Mark as resolved
    todo.resolvedAt = new Date();
    
    // Optionally remove the TODO comment from the file
    if (resolution === 'remove') {
      try {
        const content = await fs.promises.readFile(todo.file, 'utf8');
        const lines = content.split('\n');
        
        // Remove or comment out the TODO line
        if (lines[todo.line - 1]) {
          const todoLineContent = lines[todo.line - 1];
          const todoRegex = /(\/\/\s*|\/\*\s*|#\s*|<!--\s*)\b(TODO|FIXME|HACK|NOTE|BUG)\b.*$/;
          
          if (todoRegex.test(todoLineContent)) {
            // Replace TODO with DONE or remove entirely
            lines[todo.line - 1] = todoLineContent.replace(todoRegex, '$1DONE: Resolved');
            
            await fs.promises.writeFile(todo.file, lines.join('\n'), 'utf8');
          }
        }
      } catch (error) {
        console.error('Error updating file:', error);
        return false;
      }
    }

    return true;
  }

  getTODOs(filters?: {
    type?: TODOItem['type'][];
    priority?: TODOItem['priority'][];
    complexity?: TODOItem['estimatedComplexity'][];
    file?: string;
    resolved?: boolean;
  }): TODOItem[] {
    let filteredTodos = [...this.todos];

    if (filters) {
      if (filters.type) {
        filteredTodos = filteredTodos.filter(todo => filters.type!.includes(todo.type));
      }
      
      if (filters.priority) {
        filteredTodos = filteredTodos.filter(todo => filters.priority!.includes(todo.priority));
      }
      
      if (filters.complexity) {
        filteredTodos = filteredTodos.filter(todo => filters.complexity!.includes(todo.estimatedComplexity));
      }
      
      if (filters.file) {
        filteredTodos = filteredTodos.filter(todo => todo.file.includes(filters.file!));
      }
      
      if (filters.resolved !== undefined) {
        filteredTodos = filteredTodos.filter(todo => 
          filters.resolved ? todo.resolvedAt : !todo.resolvedAt
        );
      }
    }

    return filteredTodos;
  }

  getTODOStats(): {
    total: number;
    byType: Record<TODOItem['type'], number>;
    byPriority: Record<TODOItem['priority'], number>;
    byComplexity: Record<TODOItem['estimatedComplexity'], number>;
    resolved: number;
  } {
    const unresolved = this.todos.filter(todo => !todo.resolvedAt);
    
    const stats = {
      total: this.todos.length,
      byType: {} as Record<TODOItem['type'], number>,
      byPriority: {} as Record<TODOItem['priority'], number>,
      byComplexity: {} as Record<TODOItem['estimatedComplexity'], number>,
      resolved: this.todos.filter(todo => todo.resolvedAt).length
    };

    // Initialize counts
    ['TODO', 'FIXME', 'HACK', 'NOTE', 'BUG'].forEach(type => {
      stats.byType[type as TODOItem['type']] = 0;
    });
    
    ['low', 'medium', 'high', 'critical'].forEach(priority => {
      stats.byPriority[priority as TODOItem['priority']] = 0;
    });
    
    ['simple', 'moderate', 'complex'].forEach(complexity => {
      stats.byComplexity[complexity as TODOItem['estimatedComplexity']] = 0;
    });

    // Count occurrences
    unresolved.forEach(todo => {
      stats.byType[todo.type]++;
      stats.byPriority[todo.priority]++;
      stats.byComplexity[todo.estimatedComplexity]++;
    });

    return stats;
  }

  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getLLMCompletion(prompt: string): Promise<string> {
    try {
      // @ts-ignore
      return await (global as any).getLLMCompletion?.(prompt) || '{"solution":"Manual analysis required","explanation":"AI unavailable","codeExample":"// Implementation needed","confidence":0,"relatedPatterns":[],"estimatedTime":"Unknown"}';
    } catch (error) {
      return '{"solution":"Manual analysis required","explanation":"AI unavailable","codeExample":"// Implementation needed","confidence":0,"relatedPatterns":[],"estimatedTime":"Unknown"}';
    }
  }
}

// Provider for the TODO resolver webview
class TODOResolverProvider implements vscode.WebviewViewProvider {
  private webview?: vscode.WebviewView;
  private resolver: ContextualTODOResolver;

  constructor(private context: vscode.ExtensionContext) {
    this.resolver = new ContextualTODOResolver(context);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webview = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getWebviewContent();
    this.setupMessageHandling();
    this.refreshTODOs();
  }

  private setupMessageHandling() {
    this.webview?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'refreshTODOs':
          await this.handleRefreshTODOs();
          break;
        case 'generateSolution':
          await this.handleGenerateSolution(message.todoId);
          break;
        case 'resolveTODO':
          await this.handleResolveTODO(message.todoId, message.resolution);
          break;
        case 'filterTODOs':
          await this.handleFilterTODOs(message.filters);
          break;
        case 'openFile':
          await this.handleOpenFile(message.file, message.line);
          break;
      }
    });
  }

  private async handleRefreshTODOs() {
    await this.resolver.scanWorkspace();
    this.refreshTODOs();
  }

  private async handleGenerateSolution(todoId: string) {
    try {
      const solution = await this.resolver.generateSolution(todoId);
      this.webview?.webview.postMessage({
        type: 'solutionGenerated',
        data: { todoId, solution }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate solution: ${error}`);
    }
  }

  private async handleResolveTODO(todoId: string, resolution: string) {
    try {
      const success = await this.resolver.resolveTODO(todoId, resolution);
      if (success) {
        this.refreshTODOs();
        vscode.window.showInformationMessage('TODO resolved successfully');
      } else {
        vscode.window.showErrorMessage('Failed to resolve TODO');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to resolve TODO: ${error}`);
    }
  }

  private async handleFilterTODOs(filters: any) {
    const todos = this.resolver.getTODOs(filters);
    this.webview?.webview.postMessage({
      type: 'todosFiltered',
      data: { todos, stats: this.resolver.getTODOStats() }
    });
  }

  private async handleOpenFile(file: string, line: number) {
    try {
      const doc = await vscode.workspace.openTextDocument(file);
      const editor = await vscode.window.showTextDocument(doc);
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  private refreshTODOs() {
    const todos = this.resolver.getTODOs({ resolved: false });
    const stats = this.resolver.getTODOStats();
    
    this.webview?.webview.postMessage({
      type: 'todosLoaded',
      data: { todos, stats }
    });
  }

  private getWebviewContent(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TODO Resolver</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 10px; 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
            gap: 10px;
            margin-bottom: 15px;
        }
        .stat-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 1.5em;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .stat-label {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
        }
        .filters {
            display: flex;
            gap: 5px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .filter-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.8em;
        }
        .filter-btn:hover, .filter-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 5px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .todo-item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
        }
        .todo-header {
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            cursor: pointer;
        }
        .todo-header:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .todo-main {
            flex: 1;
        }
        .todo-type {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: bold;
            margin-right: 8px;
        }
        .todo-type.TODO { background: #007ACC; color: white; }
        .todo-type.FIXME { background: #FF6B6B; color: white; }
        .todo-type.HACK { background: #FFB347; color: black; }
        .todo-type.NOTE { background: #98D8C8; color: black; }
        .todo-type.BUG { background: #DC143C; color: white; }
        .todo-text {
            font-weight: bold;
            margin: 5px 0;
        }
        .todo-location {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        .todo-meta {
            display: flex;
            gap: 10px;
            font-size: 0.7em;
        }
        .priority {
            padding: 2px 6px;
            border-radius: 8px;
            font-weight: bold;
        }
        .priority.critical { background: #DC143C; color: white; }
        .priority.high { background: #FF6B6B; color: white; }
        .priority.medium { background: #FFB347; color: black; }
        .priority.low { background: #98D8C8; color: black; }
        .todo-actions {
            display: flex;
            gap: 5px;
        }
        .action-btn {
            background: transparent;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 0.7em;
        }
        .action-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .todo-details {
            padding: 0 10px 10px 10px;
            border-top: 1px solid var(--vscode-panel-border);
            display: none;
        }
        .todo-details.expanded {
            display: block;
        }
        .solution-section {
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .solution-header {
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-textLink-foreground);
        }
        .code-block {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .confidence-bar {
            width: 100%;
            height: 4px;
            background: var(--vscode-progressBar-background);
            border-radius: 2px;
            margin: 5px 0;
        }
        .confidence-fill {
            height: 100%;
            background: var(--vscode-progressBar-background);
            border-radius: 2px;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .no-todos {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>🎯 TODO Resolver</h3>
        <button class="btn" onclick="refreshTODOs()">🔄 Refresh</button>
    </div>

    <div id="stats" class="stats"></div>

    <div class="filters" id="filters"></div>

    <div id="todos">
        <div class="loading">Loading TODOs...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTodos = [];
        let currentStats = {};
        let activeFilters = {};

        function refreshTODOs() {
            document.getElementById('todos').innerHTML = '<div class="loading">Scanning workspace...</div>';
            vscode.postMessage({ type: 'refreshTODOs' });
        }

        function applyFilter(filterType, value) {
            if (!activeFilters[filterType]) {
                activeFilters[filterType] = [];
            }
            
            const index = activeFilters[filterType].indexOf(value);
            if (index > -1) {
                activeFilters[filterType].splice(index, 1);
            } else {
                activeFilters[filterType].push(value);
            }
            
            // Clean up empty filter arrays
            if (activeFilters[filterType].length === 0) {
                delete activeFilters[filterType];
            }
            
            updateFilterButtons();
            vscode.postMessage({ type: 'filterTODOs', filters: activeFilters });
        }

        function updateFilterButtons() {
            const filterBtns = document.querySelectorAll('.filter-btn');
            filterBtns.forEach(btn => {
                const type = btn.dataset.type;
                const value = btn.dataset.value;
                const isActive = activeFilters[type] && activeFilters[type].includes(value);
                btn.classList.toggle('active', isActive);
            });
        }

        function renderStats(stats) {
            const statsHtml = \`
                <div class="stat-card">
                    <div class="stat-number">\${stats.total - stats.resolved}</div>
                    <div class="stat-label">Active</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">\${stats.byPriority.critical || 0}</div>
                    <div class="stat-label">Critical</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">\${stats.byPriority.high || 0}</div>
                    <div class="stat-label">High</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">\${stats.resolved}</div>
                    <div class="stat-label">Resolved</div>
                </div>
            \`;
            document.getElementById('stats').innerHTML = statsHtml;
        }

        function renderFilters() {
            const filtersHtml = \`
                <button class="filter-btn" data-type="priority" data-value="critical" onclick="applyFilter('priority', 'critical')">Critical</button>
                <button class="filter-btn" data-type="priority" data-value="high" onclick="applyFilter('priority', 'high')">High</button>
                <button class="filter-btn" data-type="priority" data-value="medium" onclick="applyFilter('priority', 'medium')">Medium</button>
                <button class="filter-btn" data-type="priority" data-value="low" onclick="applyFilter('priority', 'low')">Low</button>
                <button class="filter-btn" data-type="type" data-value="BUG" onclick="applyFilter('type', 'BUG')">Bugs</button>
                <button class="filter-btn" data-type="type" data-value="FIXME" onclick="applyFilter('type', 'FIXME')">Fix Me</button>
                <button class="filter-btn" data-type="type" data-value="TODO" onclick="applyFilter('type', 'TODO')">To Do</button>
                <button class="filter-btn" data-type="complexity" data-value="complex" onclick="applyFilter('complexity', 'complex')">Complex</button>
            \`;
            document.getElementById('filters').innerHTML = filtersHtml;
        }

        function renderTODOs(todos) {
            if (todos.length === 0) {
                document.getElementById('todos').innerHTML = '<div class="no-todos">🎉 No TODOs found! Great job!</div>';
                return;
            }

            const todosHtml = todos.map(todo => \`
                <div class="todo-item">
                    <div class="todo-header" onclick="toggleDetails('\${todo.id}')">
                        <div class="todo-main">
                            <div>
                                <span class="todo-type \${todo.type}">\${todo.type}</span>
                                <span class="todo-text">\${todo.text}</span>
                            </div>
                            <div class="todo-location" onclick="openFile('\${todo.file}', \${todo.line}); event.stopPropagation();">
                                📁 \${todo.file.split(/[\\\\/]/).pop()} : \${todo.line}
                            </div>
                            <div class="todo-meta">
                                <span class="priority \${todo.priority}">\${todo.priority}</span>
                                <span>Complexity: \${todo.estimatedComplexity}</span>
                            </div>
                        </div>
                        <div class="todo-actions">
                            <button class="action-btn" onclick="generateSolution('\${todo.id}'); event.stopPropagation();">💡 Solve</button>
                            <button class="action-btn" onclick="resolveTODO('\${todo.id}', 'mark'); event.stopPropagation();">✅ Resolve</button>
                        </div>
                    </div>
                    <div class="todo-details" id="details-\${todo.id}">
                        <div class="solution-section">
                            <div class="solution-header">📋 Context</div>
                            <div class="code-block">\${todo.context}</div>
                        </div>
                        \${todo.suggestedSolution ? \`
                            <div class="solution-section">
                                <div class="solution-header">💡 Suggested Solution</div>
                                <p>\${todo.suggestedSolution}</p>
                            </div>
                        \` : ''}
                        <div id="solution-\${todo.id}"></div>
                    </div>
                </div>
            \`).join('');
            
            document.getElementById('todos').innerHTML = todosHtml;
        }

        function toggleDetails(todoId) {
            const details = document.getElementById(\`details-\${todoId}\`);
            details.classList.toggle('expanded');
        }

        function generateSolution(todoId) {
            const solutionDiv = document.getElementById(\`solution-\${todoId}\`);
            solutionDiv.innerHTML = '<div class="loading">🤖 Generating solution...</div>';
            vscode.postMessage({ type: 'generateSolution', todoId });
        }

        function resolveTODO(todoId, resolution) {
            vscode.postMessage({ type: 'resolveTODO', todoId, resolution });
        }

        function openFile(file, line) {
            vscode.postMessage({ type: 'openFile', file, line });
        }

        function renderSolution(todoId, solution) {
            const solutionDiv = document.getElementById(\`solution-\${todoId}\`);
            if (!solution) return;

            solutionDiv.innerHTML = \`
                <div class="solution-section">
                    <div class="solution-header">🤖 AI Generated Solution (Confidence: \${solution.confidence}%)</div>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: \${solution.confidence}%; background: \${solution.confidence > 70 ? '#4CAF50' : solution.confidence > 40 ? '#FF9800' : '#F44336'}"></div>
                    </div>
                    <p><strong>Solution:</strong> \${solution.solution}</p>
                    <p><strong>Explanation:</strong> \${solution.explanation}</p>
                    <div class="solution-header">💻 Code Example</div>
                    <div class="code-block">\${solution.codeExample}</div>
                    <p><strong>Estimated Time:</strong> \${solution.estimatedTime}</p>
                    \${solution.relatedPatterns.length > 0 ? \`<p><strong>Related Patterns:</strong> \${solution.relatedPatterns.join(', ')}</p>\` : ''}
                </div>
            \`;
        }

        // Initialize
        renderFilters();
        refreshTODOs();

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'todosLoaded':
                case 'todosFiltered':
                    currentTodos = message.data.todos;
                    currentStats = message.data.stats;
                    renderStats(currentStats);
                    renderTODOs(currentTodos);
                    break;
                case 'solutionGenerated':
                    renderSolution(message.data.todoId, message.data.solution);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

export function registerTODOResolverCommands(context: vscode.ExtensionContext) {
  const resolver = new ContextualTODOResolver(context);
  const provider = new TODOResolverProvider(context);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('todoResolver', provider)
  );

  // Quick scan command
  const scanTODOsCommand = vscode.commands.registerCommand('coding.scanTODOs', async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "🎯 Scanning for TODOs",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Analyzing workspace..." });
      await resolver.scanWorkspace();
      
      const stats = resolver.getTODOStats();
      const activeTodos = stats.total - stats.resolved;
      
      progress.report({ message: `Found ${activeTodos} active TODOs` });
      
      vscode.window.showInformationMessage(
        `TODO Scan Complete: ${activeTodos} active, ${stats.resolved} resolved`
      );
    });
  });

  // Generate solution command
  const generateSolutionCommand = vscode.commands.registerCommand('coding.generateTODOSolution', async () => {
    const todos = resolver.getTODOs({ resolved: false });
    if (todos.length === 0) {
      vscode.window.showInformationMessage('No unresolved TODOs found');
      return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = todos.map(todo => ({
      label: `$(${todo.type === 'BUG' ? 'bug' : 'checklist'}) ${todo.text}`,
      description: `${todo.priority} priority • ${todo.estimatedComplexity}`,
      detail: `${path.basename(todo.file)}:${todo.line}`,
      todo: todo
    }));

    quickPick.placeholder = 'Select a TODO to generate solution';
    quickPick.title = '🎯 Generate TODO Solution';

    quickPick.onDidChangeSelection(async (selection) => {
      if (selection[0]) {
        const item = selection[0] as any;
        const todo = item.todo;
        
        quickPick.hide();
        
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "🤖 Generating Solution",
          cancellable: false
        }, async (progress) => {
          progress.report({ message: `Analyzing "${todo.text}"...` });
          
          const solution = await resolver.generateSolution(todo.id);
          
          if (solution) {
            // Show solution in a new document
            const fileExt = path.extname(todo.file);
            const language = fileExt === '.ts' ? 'typescript' : fileExt === '.js' ? 'javascript' : fileExt === '.py' ? 'python' : 'javascript';
            
            const doc = await vscode.workspace.openTextDocument({
              content: `# TODO Solution

**TODO:** ${todo.text}
**File:** ${todo.file}:${todo.line}
**Priority:** ${todo.priority}
**Complexity:** ${todo.estimatedComplexity}

## 🤖 AI Generated Solution (Confidence: ${solution.confidence}%)

**Solution:** ${solution.solution}

**Explanation:** ${solution.explanation}

**Estimated Time:** ${solution.estimatedTime}

## 💻 Code Example

\`\`\`${language}
${solution.codeExample}
\`\`\`

${solution.relatedPatterns.length > 0 ? `## 🔗 Related Patterns

${solution.relatedPatterns.map(pattern => `- ${pattern}`).join('\n')}` : ''}

## 📋 Context

\`\`\`
${todo.context}
\`\`\`
`,
              language: 'markdown'
            });

            await vscode.window.showTextDocument(doc);
          } else {
            vscode.window.showErrorMessage('Failed to generate solution');
          }
        });
      }
    });

    quickPick.show();
  });

  context.subscriptions.push(scanTODOsCommand, generateSolutionCommand);
}