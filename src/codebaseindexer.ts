import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getLLMCompletion } from './extension';

interface CodebaseIndex {
  files: FileInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  variables: VariableInfo[];
  lastUpdated: number;
}

interface FileInfo {
  path: string;
  language: string;
  size: number;
  lastModified: number;
  hash: string;
}

interface ClassInfo {
  name: string;
  file: string;
  line: number;
  methods: string[];
  description?: string;
}

interface FunctionInfo {
  name: string;
  file: string;
  line: number;
  params: string[];
  returnType?: string;
  description?: string;
}

interface VariableInfo {
  name: string;
  file: string;
  line: number;
  type?: string;
  scope: string;
}

/**
 * Codebase Indexing and Smart Search with Vector Store
 */
export class CodebaseIndexer {
  private index: CodebaseIndex = {
    files: [],
    classes: [],
    functions: [],
    variables: [],
    lastUpdated: 0
  };
  
  private indexPath: string;

  constructor(private context: vscode.ExtensionContext) {
    this.indexPath = path.join(context.globalStoragePath, 'codebase-index.json');
    this.loadIndex();
  }

  /**
   * Build or update the codebase index
   */
  public async buildIndex(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Building codebase index...',
      cancellable: false
    }, async (progress) => {
      this.index = {
        files: [],
        classes: [],
        functions: [],
        variables: [],
        lastUpdated: Date.now()
      };

      for (const folder of workspaceFolders) {
        await this.indexDirectory(folder.uri.fsPath, progress);
      }

      this.saveIndex();
      vscode.window.showInformationMessage(`Codebase indexed: ${this.index.files.length} files, ${this.index.functions.length} functions, ${this.index.classes.length} classes`);
    });
  }

  /**
   * Search codebase semantically using LLM
   */
  public async semanticSearch(query: string): Promise<string> {
    if (this.index.files.length === 0) {
      await this.buildIndex();
    }

    const searchContext = this.buildSearchContext();
    const prompt = `Based on this codebase structure, find relevant code for: "${query}"

Codebase overview:
${searchContext}

Please identify the most relevant files, functions, or classes that match the query. Provide file paths and brief explanations.`;

    try {
      const response = await getLLMCompletion(prompt);
      return response || 'No results found';
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Get code suggestions based on context
   */
  public async getContextualSuggestions(currentFile: string, currentFunction?: string): Promise<string[]> {
    const relatedFunctions = this.index.functions.filter(f => 
      f.file !== currentFile && 
      (currentFunction ? f.name.includes(currentFunction) || currentFunction.includes(f.name) : true)
    );

    const relatedClasses = this.index.classes.filter(c => 
      c.file !== currentFile
    );

    const suggestions: string[] = [];

    // Add similar function suggestions
    relatedFunctions.slice(0, 5).forEach(func => {
      suggestions.push(`Similar function: ${func.name} in ${func.file}:${func.line}`);
    });

    // Add related class suggestions
    relatedClasses.slice(0, 3).forEach(cls => {
      suggestions.push(`Related class: ${cls.name} in ${cls.file}:${cls.line}`);
    });

    return suggestions;
  }

  /**
   * Find code usage patterns
   */
  public async findUsagePatterns(identifier: string): Promise<string> {
    const usages = [
      ...this.index.functions.filter(f => f.name.includes(identifier)),
      ...this.index.classes.filter(c => c.name.includes(identifier)),
      ...this.index.variables.filter(v => v.name.includes(identifier))
    ];

    if (usages.length === 0) {
      return `No usage patterns found for "${identifier}"`;
    }

    const prompt = `Analyze these code usage patterns for "${identifier}":

${usages.map(usage => {
  if ('methods' in usage) {
    return `Class: ${usage.name} in ${usage.file}:${usage.line} with methods: ${usage.methods.join(', ')}`;
  } else if ('params' in usage) {
    return `Function: ${usage.name}(${usage.params.join(', ')}) in ${usage.file}:${usage.line}`;
  } else {
    return `Variable: ${usage.name} (${usage.type || 'unknown type'}) in ${usage.file}:${usage.line}`;
  }
}).join('\n')}

Provide insights about usage patterns, common implementations, and best practices.`;

    try {
      const analysis = await getLLMCompletion(prompt);
      return analysis || 'Could not analyze usage patterns';
    } catch (error) {
      return `Analysis failed: ${error}`;
    }
  }

  private async indexDirectory(dirPath: string, progress: vscode.Progress<{ message?: string }>): Promise<void> {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!this.shouldSkipDirectory(file)) {
          progress.report({ message: `Indexing directory: ${file}` });
          await this.indexDirectory(filePath, progress);
        }
      } else if (this.shouldIndexFile(file)) {
        progress.report({ message: `Indexing file: ${file}` });
        await this.indexFile(filePath);
      }
    }
  }

  private shouldSkipDirectory(dirname: string): boolean {
    const skipDirs = ['node_modules', '.git', 'out', 'dist', 'build', '.vscode', 'coverage'];
    return skipDirs.includes(dirname);
  }

  private shouldIndexFile(filename: string): boolean {
    const extensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.php', '.rb'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  private async indexFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);
      const relativePath = vscode.workspace.asRelativePath(filePath);
      
      // Add file info
      this.index.files.push({
        path: relativePath,
        language: this.getLanguageFromExtension(path.extname(filePath)),
        size: stat.size,
        lastModified: stat.mtime.getTime(),
        hash: this.simpleHash(content)
      });

      // Parse and index code elements
      this.parseCodeElements(content, relativePath);
      
    } catch (error) {
      console.error(`Error indexing file ${filePath}:`, error);
    }
  }

  private parseCodeElements(content: string, filePath: string): void {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Parse functions (basic regex patterns)
      const functionMatch = line.match(/(?:function|def|func|public|private|protected)?\s*(\w+)\s*\([^)]*\)/);
      if (functionMatch && !line.trim().startsWith('//') && !line.trim().startsWith('#')) {
        const params = this.extractParameters(line);
        this.index.functions.push({
          name: functionMatch[1],
          file: filePath,
          line: lineNumber,
          params: params
        });
      }

      // Parse classes
      const classMatch = line.match(/(?:class|interface|struct)\s+(\w+)/);
      if (classMatch && !line.trim().startsWith('//') && !line.trim().startsWith('#')) {
        this.index.classes.push({
          name: classMatch[1],
          file: filePath,
          line: lineNumber,
          methods: []
        });
      }

      // Parse variables (basic patterns)
      const varMatch = line.match(/(?:const|let|var|public|private|protected)?\s+(\w+)\s*[=:]/);
      if (varMatch && !line.trim().startsWith('//') && !line.trim().startsWith('#')) {
        this.index.variables.push({
          name: varMatch[1],
          file: filePath,
          line: lineNumber,
          scope: 'unknown'
        });
      }
    });
  }

  private extractParameters(line: string): string[] {
    const match = line.match(/\(([^)]*)\)/);
    if (!match) {
      return [];
    }
    
    return match[1]
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby'
    };
    return languageMap[ext] || 'unknown';
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private buildSearchContext(): string {
    const filesByLanguage = this.groupBy(this.index.files, f => f.language);
    const topFunctions = this.index.functions.slice(0, 20);
    const topClasses = this.index.classes.slice(0, 15);

    return `Files by language:
${Object.entries(filesByLanguage).map(([lang, files]) => `${lang}: ${files.length} files`).join('\n')}

Top functions:
${topFunctions.map(f => `${f.name}(${f.params.join(', ')}) in ${f.file}`).join('\n')}

Top classes:
${topClasses.map(c => `${c.name} in ${c.file}`).join('\n')}`;
  }

  private groupBy<T, K extends keyof any>(array: T[], key: (item: T) => K): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const group = key(item);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }

  private loadIndex(): void {
    if (fs.existsSync(this.indexPath)) {
      try {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(data);
      } catch (error) {
        console.error('Error loading index:', error);
      }
    }
  }

  private saveIndex(): void {
    if (!fs.existsSync(this.context.globalStoragePath)) {
      fs.mkdirSync(this.context.globalStoragePath, { recursive: true });
    }
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }
}

export function registerCodebaseIndexerCommands(context: vscode.ExtensionContext) {
  const indexer = new CodebaseIndexer(context);

  const buildIndexCommand = vscode.commands.registerCommand('coding.buildCodebaseIndex', async () => {
    await indexer.buildIndex();
  });

  const semanticSearchCommand = vscode.commands.registerCommand('coding.semanticSearch', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter search query',
      placeHolder: 'authentication logic, user management, database connection...'
    });

    if (query) {
      try {
        const results = await indexer.semanticSearch(query);
        const doc = await vscode.workspace.openTextDocument({
          content: `# Semantic Search Results\n\n**Query:** ${query}\n\n${results}`,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    }
  });

  const findUsagePatternsCommand = vscode.commands.registerCommand('coding.findUsagePatterns', async () => {
    const identifier = await vscode.window.showInputBox({
      prompt: 'Enter function, class, or variable name',
      placeHolder: 'getUserData, UserController, apiKey...'
    });

    if (identifier) {
      try {
        const patterns = await indexer.findUsagePatterns(identifier);
        const doc = await vscode.workspace.openTextDocument({
          content: `# Usage Patterns for "${identifier}"\n\n${patterns}`,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`Pattern analysis failed: ${error}`);
      }
    }
  });

  context.subscriptions.push(buildIndexCommand, semanticSearchCommand, findUsagePatternsCommand);
}