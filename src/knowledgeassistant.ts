import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  type: 'pattern' | 'framework' | 'api' | 'concept' | 'best-practice';
  tags: string[];
  examples: string[];
  relevanceScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ContextualSuggestion {
  entry: KnowledgeEntry;
  relevance: number;
  reason: string;
  applicationExample: string;
}

export class KnowledgeAwareAssistant {
  private knowledgeBase: KnowledgeEntry[] = [];
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadKnowledgeBase();
  }

  private async loadKnowledgeBase() {
    const storedKnowledge = this.context.globalState.get<KnowledgeEntry[]>('knowledgeBase', []);
    this.knowledgeBase = storedKnowledge;
    
    // Initialize with common patterns if empty
    if (this.knowledgeBase.length === 0) {
      await this.initializeDefaultKnowledge();
    }
  }

  private async initializeDefaultKnowledge() {
    const defaultEntries: KnowledgeEntry[] = [
      {
        id: 'singleton-pattern',
        title: 'Singleton Pattern',
        content: 'Ensures a class has only one instance and provides global access to it',
        type: 'pattern',
        tags: ['design-pattern', 'creational', 'global-state'],
        examples: [
          'class Singleton { private static instance: Singleton; private constructor() {} static getInstance() { if (!this.instance) { this.instance = new Singleton(); } return this.instance; } }',
          'Configuration managers, logging systems, database connections'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'observer-pattern',
        title: 'Observer Pattern',
        content: 'Defines a subscription mechanism to notify multiple objects about events',
        type: 'pattern',
        tags: ['design-pattern', 'behavioral', 'event-driven'],
        examples: [
          'interface Observer { update(data: any): void; } class Subject { private observers: Observer[] = []; attach(observer: Observer) { this.observers.push(observer); } notify(data: any) { this.observers.forEach(o => o.update(data)); } }',
          'Event systems, MVC architecture, state management'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'async-await-pattern',
        title: 'Async/Await Best Practices',
        content: 'Modern JavaScript/TypeScript asynchronous programming patterns',
        type: 'best-practice',
        tags: ['javascript', 'typescript', 'async', 'promises'],
        examples: [
          'async function fetchData() { try { const response = await fetch("/api/data"); const data = await response.json(); return data; } catch (error) { console.error("Fetch failed:", error); throw error; } }',
          'Error handling with try-catch, parallel execution with Promise.all'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.knowledgeBase = defaultEntries;
    await this.saveKnowledgeBase();
  }

  private async saveKnowledgeBase() {
    await this.context.globalState.update('knowledgeBase', this.knowledgeBase);
  }

  async addKnowledgeEntry(entry: Partial<KnowledgeEntry>): Promise<string> {
    const newEntry: KnowledgeEntry = {
      id: entry.id || this.generateId(),
      title: entry.title || 'Untitled',
      content: entry.content || '',
      type: entry.type || 'concept',
      tags: entry.tags || [],
      examples: entry.examples || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.knowledgeBase.push(newEntry);
    await this.saveKnowledgeBase();
    return newEntry.id;
  }

  async getContextualSuggestions(activeFile?: string, selectedText?: string): Promise<ContextualSuggestion[]> {
    const context = await this.analyzeCurrentContext(activeFile, selectedText);
    const suggestions: ContextualSuggestion[] = [];

    for (const entry of this.knowledgeBase) {
      const relevance = this.calculateRelevance(entry, context);
      if (relevance > 0.3) {
        suggestions.push({
          entry,
          relevance,
          reason: this.generateRelevanceReason(entry, context),
          applicationExample: await this.generateApplicationExample(entry, context)
        });
      }
    }

    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  private async analyzeCurrentContext(activeFile?: string, selectedText?: string) {
    const context: any = {
      language: 'unknown',
      keywords: [],
      patterns: [],
      frameworks: [],
      selectedText: selectedText || ''
    };

    if (activeFile) {
      context.language = path.extname(activeFile).slice(1);
      
      try {
        const content = await fs.promises.readFile(activeFile, 'utf8');
        context.keywords = this.extractKeywords(content);
        context.patterns = this.detectPatterns(content);
        context.frameworks = this.detectFrameworks(content);
      } catch (error) {
        // File reading failed, use limited context
      }
    }

    return context;
  }

  private extractKeywords(content: string): string[] {
    const keywords = new Set<string>();
    
    // Common programming keywords
    const patterns = [
      /\b(class|interface|function|async|await|promise|callback)\b/gi,
      /\b(database|api|http|rest|graphql|json)\b/gi,
      /\b(component|service|controller|model|view)\b/gi,
      /\b(test|mock|stub|spy|assertion)\b/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.add(match.toLowerCase()));
      }
    });

    return Array.from(keywords);
  }

  private detectPatterns(content: string): string[] {
    const patterns = [];
    
    if (content.includes('getInstance') || content.includes('private constructor')) {
      patterns.push('singleton');
    }
    if (content.includes('observer') || content.includes('subscribe') || content.includes('notify')) {
      patterns.push('observer');
    }
    if (content.includes('factory') || content.includes('create')) {
      patterns.push('factory');
    }
    if (content.includes('decorator') || content.includes('@')) {
      patterns.push('decorator');
    }

    return patterns;
  }

  private detectFrameworks(content: string): string[] {
    const frameworks = [];
    
    if (content.includes('react') || content.includes('jsx') || content.includes('useState')) {
      frameworks.push('react');
    }
    if (content.includes('angular') || content.includes('@Component')) {
      frameworks.push('angular');
    }
    if (content.includes('express') || content.includes('app.get')) {
      frameworks.push('express');
    }
    if (content.includes('vscode') || content.includes('ExtensionContext')) {
      frameworks.push('vscode');
    }

    return frameworks;
  }

  private calculateRelevance(entry: KnowledgeEntry, context: any): number {
    let relevance = 0;

    // Language match
    if (entry.tags.includes(context.language)) {
      relevance += 0.3;
    }

    // Keyword overlap
    const keywordOverlap = entry.tags.filter(tag => context.keywords.includes(tag)).length;
    relevance += keywordOverlap * 0.1;

    // Pattern match
    const patternOverlap = context.patterns.filter((pattern: string) => 
      entry.id.includes(pattern) || entry.tags.includes(pattern)
    ).length;
    relevance += patternOverlap * 0.4;

    // Framework match
    const frameworkOverlap = entry.tags.filter(tag => context.frameworks.includes(tag)).length;
    relevance += frameworkOverlap * 0.2;

    // Selected text relevance
    if (context.selectedText) {
      const selectedWords = context.selectedText.toLowerCase().split(/\s+/);
      const titleWords = entry.title.toLowerCase().split(/\s+/);
      const wordOverlap = selectedWords.filter((word: string) => 
        titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
      ).length;
      relevance += wordOverlap * 0.15;
    }

    return Math.min(relevance, 1.0);
  }

  private generateRelevanceReason(entry: KnowledgeEntry, context: any): string {
    const reasons = [];

    if (entry.tags.includes(context.language)) {
      reasons.push(`matches ${context.language} language`);
    }

    const patternOverlap = context.patterns.filter((pattern: string) => 
      entry.id.includes(pattern) || entry.tags.includes(pattern)
    );
    if (patternOverlap.length > 0) {
      reasons.push(`relevant to detected patterns: ${patternOverlap.join(', ')}`);
    }

    const frameworkOverlap = entry.tags.filter(tag => context.frameworks.includes(tag));
    if (frameworkOverlap.length > 0) {
      reasons.push(`applicable to ${frameworkOverlap.join(', ')}`);
    }

    if (reasons.length === 0) {
      return 'general best practice';
    }

    return reasons.join('; ');
  }

  private async generateApplicationExample(entry: KnowledgeEntry, context: any): Promise<string> {
    if (entry.examples.length > 0) {
      // Return the most relevant example
      return entry.examples[0];
    }

    // Generate a contextual example using LLM
    try {
      const prompt = `Generate a practical code example for "${entry.title}" in ${context.language || 'JavaScript'} context. 
Focus on: ${entry.content}
Current context: ${JSON.stringify(context.keywords.slice(0, 5))}
Keep it concise and practical.`;

      const example = await this.getLLMCompletion(prompt);
      return example.trim();
    } catch (error) {
      return `Apply ${entry.title} principles in your current ${context.language || ''} code`;
    }
  }

  async searchKnowledge(query: string): Promise<KnowledgeEntry[]> {
    const results = this.knowledgeBase.filter(entry => {
      const searchText = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
      const queryWords = query.toLowerCase().split(/\s+/);
      return queryWords.some(word => searchText.includes(word));
    });

    return results.sort((a, b) => {
      const aScore = this.calculateSearchScore(a, query);
      const bScore = this.calculateSearchScore(b, query);
      return bScore - aScore;
    });
  }

  private calculateSearchScore(entry: KnowledgeEntry, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    if (entry.title.toLowerCase().includes(queryLower)) {
      score += 10;
    }
    if (entry.content.toLowerCase().includes(queryLower)) {
      score += 5;
    }
    entry.tags.forEach(tag => {
      if (tag.toLowerCase().includes(queryLower)) {
        score += 3;
      }
    });

    return score;
  }

  private generateId(): string {
    return `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getLLMCompletion(prompt: string): Promise<string> {
    // Use the same LLM function as other parts of the extension
    try {
      // @ts-ignore - getLLMCompletion should be available in the extension context
      return await (global as any).getLLMCompletion?.(prompt) || 'Example code would be generated here';
    } catch (error) {
      return 'Example code generation unavailable';
    }
  }

  // Provider class for webview
  static createProvider(context: vscode.ExtensionContext): KnowledgeAssistantProvider {
    return new KnowledgeAssistantProvider(context);
  }
}

class KnowledgeAssistantProvider implements vscode.WebviewViewProvider {
  private webview?: vscode.WebviewView;
  private assistant: KnowledgeAwareAssistant;

  constructor(private context: vscode.ExtensionContext) {
    this.assistant = new KnowledgeAwareAssistant(context);
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
        case 'getSuggestions':
          await this.handleGetSuggestions();
          break;
        case 'searchKnowledge':
          await this.handleSearchKnowledge(message.query);
          break;
        case 'addKnowledge':
          await this.handleAddKnowledge(message.entry);
          break;
      }
    });
  }

  private async handleGetSuggestions() {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      const activeFile = activeEditor?.document.fileName;
      const selectedText = activeEditor?.document.getText(activeEditor.selection);

      const suggestions = await this.assistant.getContextualSuggestions(activeFile, selectedText);
      
      this.webview?.webview.postMessage({
        type: 'suggestions',
        data: suggestions.slice(0, 5) // Top 5 suggestions
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get suggestions: ${error}`);
    }
  }

  private async handleSearchKnowledge(query: string) {
    try {
      const results = await this.assistant.searchKnowledge(query);
      this.webview?.webview.postMessage({
        type: 'searchResults',
        data: results.slice(0, 10)
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`);
    }
  }

  private async handleAddKnowledge(entry: any) {
    try {
      const id = await this.assistant.addKnowledgeEntry(entry);
      this.webview?.webview.postMessage({
        type: 'knowledgeAdded',
        data: { id, success: true }
      });
      vscode.window.showInformationMessage('Knowledge entry added successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add knowledge: ${error}`);
    }
  }

  private getWebviewContent(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge Assistant</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 10px; 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .section { margin-bottom: 20px; }
        .section h3 { 
            margin: 0 0 10px 0; 
            color: var(--vscode-textLink-foreground); 
        }
        .suggestion-item {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 8px;
            cursor: pointer;
        }
        .suggestion-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .suggestion-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .suggestion-reason {
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .suggestion-example {
            background: var(--vscode-textCodeBlock-background);
            border-radius: 3px;
            padding: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.85em;
            white-space: pre-wrap;
            overflow-x: auto;
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
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .loading { text-align: center; padding: 20px; }
        .no-results { 
            text-align: center; 
            color: var(--vscode-descriptionForeground); 
            padding: 20px; 
        }
        .relevance-score {
            float: right;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.8em;
        }
    </style>
</head>
<body>
    <div class="section">
        <h3>🧠 Knowledge Assistant</h3>
        <button class="btn" onclick="getSuggestions()">Get Contextual Suggestions</button>
        <button class="btn btn-secondary" onclick="showAddForm()">Add Knowledge</button>
    </div>

    <div class="section">
        <h3>🔍 Search Knowledge Base</h3>
        <input type="text" class="search-box" id="searchInput" placeholder="Search patterns, frameworks, best practices..." onkeyup="handleSearch(event)">
    </div>

    <div id="suggestions" class="section">
        <h3>💡 Contextual Suggestions</h3>
        <div class="no-results">Click "Get Contextual Suggestions" to see relevant knowledge for your current code</div>
    </div>

    <div id="searchResults" class="section" style="display: none;">
        <h3>🔍 Search Results</h3>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function getSuggestions() {
            document.getElementById('suggestions').innerHTML = '<h3>💡 Contextual Suggestions</h3><div class="loading">Analyzing context...</div>';
            vscode.postMessage({ type: 'getSuggestions' });
        }

        function handleSearch(event) {
            const query = event.target.value.trim();
            if (query.length > 2) {
                vscode.postMessage({ type: 'searchKnowledge', query });
            } else {
                document.getElementById('searchResults').style.display = 'none';
            }
        }

        function showAddForm() {
            const title = prompt('Knowledge Title:');
            if (!title) return;
            
            const content = prompt('Description/Content:');
            if (!content) return;
            
            const tags = prompt('Tags (comma-separated):') || '';
            const type = prompt('Type (pattern/framework/api/concept/best-practice):', 'concept');
            
            const entry = {
                title,
                content,
                type,
                tags: tags.split(',').map(t => t.trim()).filter(t => t)
            };
            
            vscode.postMessage({ type: 'addKnowledge', entry });
        }

        function renderSuggestions(suggestions) {
            const container = document.getElementById('suggestions');
            if (suggestions.length === 0) {
                container.innerHTML = '<h3>💡 Contextual Suggestions</h3><div class="no-results">No relevant suggestions found for current context</div>';
                return;
            }

            let html = '<h3>💡 Contextual Suggestions</h3>';
            suggestions.forEach(suggestion => {
                const relevancePercent = Math.round(suggestion.relevance * 100);
                html += \`
                    <div class="suggestion-item" onclick="applySuggestion('\${suggestion.entry.id}')">
                        <div class="suggestion-title">
                            \${suggestion.entry.title}
                            <span class="relevance-score">\${relevancePercent}%</span>
                        </div>
                        <div class="suggestion-reason">\${suggestion.reason}</div>
                        <div class="suggestion-example">\${suggestion.applicationExample}</div>
                    </div>
                \`;
            });
            container.innerHTML = html;
        }

        function renderSearchResults(results) {
            const container = document.getElementById('searchResults');
            container.style.display = 'block';
            
            if (results.length === 0) {
                container.innerHTML = '<h3>🔍 Search Results</h3><div class="no-results">No results found</div>';
                return;
            }

            let html = '<h3>🔍 Search Results</h3>';
            results.forEach(entry => {
                html += \`
                    <div class="suggestion-item">
                        <div class="suggestion-title">\${entry.title}</div>
                        <div class="suggestion-reason">Type: \${entry.type} • Tags: \${entry.tags.join(', ')}</div>
                        <div class="suggestion-example">\${entry.content}</div>
                    </div>
                \`;
            });
            container.innerHTML = html;
        }

        function applySuggestion(entryId) {
            // Could trigger insertion of example code or open documentation
            vscode.postMessage({ type: 'applySuggestion', entryId });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'suggestions':
                    renderSuggestions(message.data);
                    break;
                case 'searchResults':
                    renderSearchResults(message.data);
                    break;
                case 'knowledgeAdded':
                    if (message.data.success) {
                        getSuggestions(); // Refresh suggestions
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

export function registerKnowledgeAssistantCommands(context: vscode.ExtensionContext) {
  const assistant = new KnowledgeAwareAssistant(context);
  const provider = KnowledgeAwareAssistant.createProvider(context);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('knowledgeAssistant', provider)
  );

  // Register commands
  const getSuggestionsCommand = vscode.commands.registerCommand('coding.getKnowledgeSuggestions', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const activeFile = activeEditor.document.fileName;
    const selectedText = activeEditor.document.getText(activeEditor.selection);

    const suggestions = await assistant.getContextualSuggestions(activeFile, selectedText);
    
    if (suggestions.length === 0) {
      vscode.window.showInformationMessage('No relevant knowledge suggestions found for current context');
      return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.items = suggestions.map(suggestion => ({
      label: `$(lightbulb) ${suggestion.entry.title}`,
      description: `${Math.round(suggestion.relevance * 100)}% relevance`,
      detail: suggestion.reason,
      suggestion: suggestion
    }));
    
    quickPick.placeholder = 'Select knowledge to apply';
    quickPick.title = '🧠 Knowledge Suggestions';
    
    quickPick.onDidChangeSelection(async (selection) => {
      if (selection[0]) {
        const item = selection[0] as any;
        const suggestion = item.suggestion;
        
        // Show detailed information
        const panel = vscode.window.createWebviewPanel(
          'knowledgeDetail',
          `Knowledge: ${suggestion.entry.title}`,
          vscode.ViewColumn.Beside,
          { enableScripts: true }
        );

        panel.webview.html = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="UTF-8">
              <style>
                  body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
                  .header { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 15px; margin-bottom: 20px; }
                  .title { font-size: 1.4em; font-weight: bold; margin-bottom: 10px; }
                  .meta { color: var(--vscode-descriptionForeground); }
                  .section { margin-bottom: 25px; }
                  .section h3 { color: var(--vscode-textLink-foreground); }
                  .code { background: var(--vscode-textCodeBlock-background); padding: 15px; border-radius: 5px; font-family: var(--vscode-editor-font-family); white-space: pre-wrap; }
                  .tags { margin-top: 10px; }
                  .tag { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 3px 8px; border-radius: 12px; font-size: 0.8em; margin-right: 5px; }
              </style>
          </head>
          <body>
              <div class="header">
                  <div class="title">${suggestion.entry.title}</div>
                  <div class="meta">Type: ${suggestion.entry.type} • Relevance: ${Math.round(suggestion.relevance * 100)}%</div>
                  <div class="meta">Reason: ${suggestion.reason}</div>
                  <div class="tags">
                      ${suggestion.entry.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}
                  </div>
              </div>
              
              <div class="section">
                  <h3>📋 Description</h3>
                  <p>${suggestion.entry.content}</p>
              </div>
              
              <div class="section">
                  <h3>💡 Application Example</h3>
                  <div class="code">${suggestion.applicationExample}</div>
              </div>
              
              ${suggestion.entry.examples.length > 0 ? `
              <div class="section">
                  <h3>🔧 Additional Examples</h3>
                  ${suggestion.entry.examples.map((example: string) => `<div class="code">${example}</div>`).join('<br>')}
              </div>
              ` : ''}
          </body>
          </html>
        `;
        
        quickPick.hide();
      }
    });
    
    quickPick.show();
  });

  const searchKnowledgeCommand = vscode.commands.registerCommand('coding.searchKnowledge', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Search knowledge base',
      placeHolder: 'Enter patterns, frameworks, concepts, or keywords...'
    });

    if (!query) {
      return;
    }

    const results = await assistant.searchKnowledge(query);
    
    if (results.length === 0) {
      vscode.window.showInformationMessage('No knowledge entries found for your search');
      return;
    }

    // Show results in a new document
    const resultText = results.map((entry, index) => {
      return `## ${index + 1}. ${entry.title}

**Type:** ${entry.type}
**Tags:** ${entry.tags.join(', ')}

**Description:** ${entry.content}

**Examples:**
${entry.examples.map(ex => `\`\`\`\n${ex}\n\`\`\``).join('\n\n')}

---
`;
    }).join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content: `# Knowledge Search Results for "${query}"\n\n${resultText}`,
      language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(getSuggestionsCommand, searchKnowledgeCommand);
}