import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface ChatMessage {
  id: string;
  timestamp: number;
  author: string;
  content: string;
  type: 'question' | 'answer' | 'discussion' | 'code';
  tags: string[];
  projectPath: string;
  relatedFiles?: string[];
  context?: string;
  responses?: ChatMessage[];
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  lastSeen: number;
}

interface ProjectChatHistory {
  projectId: string;
  projectName: string;
  messages: ChatMessage[];
  members: TeamMember[];
  createdAt: number;
  updatedAt: number;
}

export class SharedTeamChatMemory {
  private outputChannel: vscode.OutputChannel;
  private chatHistoryPath: string;
  private currentProject: ProjectChatHistory | null = null;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Team Chat Memory');
    this.chatHistoryPath = this.initializeChatHistoryPath();
    this.initializeProject();
  }

  async openTeamChat(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('💬 Opening Team Chat Memory...');

    const panel = vscode.window.createWebviewPanel(
      'teamChatMemory',
      'Team Chat Memory',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = await this.getWebviewContent();
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sendMessage':
          await this.handleNewMessage(message);
          break;
        case 'searchMessages':
          await this.handleSearchMessages(message.query, panel.webview);
          break;
        case 'loadHistory':
          await this.loadChatHistory(panel.webview);
          break;
        case 'exportChat':
          await this.exportChatHistory();
          break;
      }
    });

    // Load initial chat history
    await this.loadChatHistory(panel.webview);
  }

  async searchTeamDiscussions(): Promise<void> {
    const searchQuery = await vscode.window.showInputBox({
      prompt: 'Search team discussions',
      placeHolder: 'Enter keywords, tags, or file names to search...'
    });

    if (!searchQuery) {
      return;
    }

    const results = await this.searchMessages(searchQuery);
    await this.showSearchResults(results, searchQuery);
  }

  async addQuickNote(): Promise<void> {
    const note = await vscode.window.showInputBox({
      prompt: 'Add a quick note for your team',
      placeHolder: 'Share knowledge, tips, or important information...'
    });

    if (!note) {
      return;
    }

    const tags = await this.collectTags();
    const relatedFiles = await this.getRelatedFiles();

    const message: ChatMessage = {
      id: this.generateId(),
      timestamp: Date.now(),
      author: await this.getCurrentUser(),
      content: note,
      type: 'discussion',
      tags,
      projectPath: this.getProjectPath(),
      relatedFiles,
      context: await this.getWorkspaceContext(),
      responses: []
    };

    await this.saveMessage(message);
    vscode.window.showInformationMessage('Note added to team chat memory!');
  }

  async askTeamQuestion(): Promise<void> {
    const question = await vscode.window.showInputBox({
      prompt: 'Ask your team a question',
      placeHolder: 'Describe your problem or what you need help with...'
    });

    if (!question) {
      return;
    }

    const context = await this.gatherQuestionContext();
    const tags = await this.collectTags();

    const message: ChatMessage = {
      id: this.generateId(),
      timestamp: Date.now(),
      author: await this.getCurrentUser(),
      content: question,
      type: 'question',
      tags,
      projectPath: this.getProjectPath(),
      relatedFiles: context.relatedFiles,
      context: context.codeContext,
      responses: []
    };

    await this.saveMessage(message);
    
    // Suggest similar past discussions
    const similarQuestions = await this.findSimilarQuestions(question);
    if (similarQuestions.length > 0) {
      await this.showSimilarQuestions(similarQuestions);
    }

    vscode.window.showInformationMessage('Question posted to team chat!');
  }

  async viewProjectKnowledge(): Promise<void> {
    if (!this.currentProject) {
      vscode.window.showErrorMessage('No project chat history found');
      return;
    }

    const knowledgeBase = this.generateKnowledgeBase();
    await this.showKnowledgeBase(knowledgeBase);
  }

  private initializeChatHistoryPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const chatDir = path.join(workspaceFolder.uri.fsPath, '.team-chat');
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }

    return chatDir;
  }

  private async initializeProject(): Promise<void> {
    const projectId = this.getProjectId();
    const projectName = this.getProjectName();
    const historyFile = path.join(this.chatHistoryPath, `${projectId}.json`);

    try {
      if (fs.existsSync(historyFile)) {
        const content = await fs.promises.readFile(historyFile, 'utf8');
        this.currentProject = JSON.parse(content);
      } else {
        this.currentProject = {
          projectId,
          projectName,
          messages: [],
          members: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await this.saveProject();
      }
    } catch (error) {
      this.outputChannel.appendLine(`Error initializing project: ${error}`);
    }
  }

  private async saveProject(): Promise<void> {
    if (!this.currentProject) {
      return;
    }

    this.currentProject.updatedAt = Date.now();
    const historyFile = path.join(this.chatHistoryPath, `${this.currentProject.projectId}.json`);
    
    try {
      await fs.promises.writeFile(historyFile, JSON.stringify(this.currentProject, null, 2));
    } catch (error) {
      this.outputChannel.appendLine(`Error saving project: ${error}`);
    }
  }

  private async saveMessage(message: ChatMessage): Promise<void> {
    if (!this.currentProject) {
      return;
    }

    this.currentProject.messages.push(message);
    await this.saveProject();
  }

  private async handleNewMessage(messageData: any): Promise<void> {
    const message: ChatMessage = {
      id: this.generateId(),
      timestamp: Date.now(),
      author: await this.getCurrentUser(),
      content: messageData.content,
      type: messageData.type || 'discussion',
      tags: messageData.tags || [],
      projectPath: this.getProjectPath(),
      responses: []
    };

    await this.saveMessage(message);
    
    // Broadcast to webview (in a real implementation, this would sync across team members)
    // For now, we'll just acknowledge the message
  }

  private async handleSearchMessages(query: string, webview: vscode.Webview): Promise<void> {
    const results = await this.searchMessages(query);
    
    webview.postMessage({
      command: 'searchResults',
      results: results.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp).toLocaleString()
      }))
    });
  }

  private async loadChatHistory(webview: vscode.Webview): Promise<void> {
    if (!this.currentProject) {
      return;
    }

    const messages = this.currentProject.messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50) // Load recent 50 messages
      .map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp).toLocaleString()
      }));

    webview.postMessage({
      command: 'loadMessages',
      messages,
      projectName: this.currentProject.projectName
    });
  }

  private async searchMessages(query: string): Promise<ChatMessage[]> {
    if (!this.currentProject) {
      return [];
    }

    const searchTerms = query.toLowerCase().split(' ');
    
    return this.currentProject.messages.filter(message => {
      const searchableText = `${message.content} ${message.tags.join(' ')} ${message.context || ''}`.toLowerCase();
      
      return searchTerms.every(term => 
        searchableText.includes(term) || 
        message.relatedFiles?.some(file => file.toLowerCase().includes(term))
      );
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  private async findSimilarQuestions(question: string): Promise<ChatMessage[]> {
    if (!this.currentProject) {
      return [];
    }

    const questionKeywords = this.extractKeywords(question);
    
    return this.currentProject.messages
      .filter(msg => msg.type === 'question')
      .filter(msg => {
        const msgKeywords = this.extractKeywords(msg.content);
        const commonKeywords = questionKeywords.filter(keyword => msgKeywords.includes(keyword));
        return commonKeywords.length >= 2; // At least 2 common keywords
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'have', 'will', 'been', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were'].includes(word));
  }

  private async showSearchResults(results: ChatMessage[], query: string): Promise<void> {
    const content = `# Team Chat Search Results

**Query:** "${query}"
**Found:** ${results.length} messages

${results.map(msg => `
## ${this.getTypeIcon(msg.type)} ${msg.author} - ${new Date(msg.timestamp).toLocaleString()}

**Tags:** ${msg.tags.join(', ') || 'None'}

${msg.content}

${msg.relatedFiles?.length ? `**Related Files:** ${msg.relatedFiles.join(', ')}` : ''}

---
`).join('\n')}

${results.length === 0 ? 'No messages found matching your search criteria.' : ''}
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private async showSimilarQuestions(questions: ChatMessage[]): Promise<void> {
    const items = questions.map(q => ({
      label: `${q.author}: ${q.content.substring(0, 60)}...`,
      description: `${new Date(q.timestamp).toLocaleDateString()} • ${q.responses?.length || 0} responses`,
      detail: q.tags.join(', '),
      message: q
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Similar questions found. Select one to view details:',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await this.showMessageDetails(selected.message);
    }
  }

  private async showMessageDetails(message: ChatMessage): Promise<void> {
    const content = `# ${this.getTypeIcon(message.type)} Team Discussion

**Author:** ${message.author}  
**Date:** ${new Date(message.timestamp).toLocaleString()}  
**Type:** ${message.type}  
**Tags:** ${message.tags.join(', ') || 'None'}  

## Content
${message.content}

${message.context ? `## Context\n\`\`\`\n${message.context}\n\`\`\`` : ''}

${message.relatedFiles?.length ? `## Related Files\n${message.relatedFiles.map(f => `- ${f}`).join('\n')}` : ''}

${message.responses?.length ? `## Responses (${message.responses.length})\n${message.responses.map(r => `
### ${r.author} - ${new Date(r.timestamp).toLocaleString()}
${r.content}
`).join('\n')}` : '## No responses yet'}
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private generateKnowledgeBase(): any {
    if (!this.currentProject) {
      return { topics: [], files: [], authors: [] };
    }

    const topics = new Map<string, number>();
    const files = new Map<string, number>();
    const authors = new Map<string, number>();

    this.currentProject.messages.forEach(msg => {
      // Count topics (tags)
      msg.tags.forEach(tag => {
        topics.set(tag, (topics.get(tag) || 0) + 1);
      });

      // Count file references
      msg.relatedFiles?.forEach(file => {
        files.set(file, (files.get(file) || 0) + 1);
      });

      // Count authors
      authors.set(msg.author, (authors.get(msg.author) || 0) + 1);
    });

    return {
      totalMessages: this.currentProject.messages.length,
      topics: Array.from(topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20),
      files: Array.from(files.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20),
      authors: Array.from(authors.entries()).sort((a, b) => b[1] - a[1])
    };
  }

  private async showKnowledgeBase(knowledgeBase: any): Promise<void> {
    const content = `# 📚 Project Knowledge Base

**Total Discussions:** ${knowledgeBase.totalMessages}

## 🏷️ Most Discussed Topics
${knowledgeBase.topics.map(([topic, count]: [string, number]) => `- **${topic}** (${count} mentions)`).join('\n') || 'No topics yet'}

## 📁 Most Referenced Files
${knowledgeBase.files.map(([file, count]: [string, number]) => `- **${file}** (${count} references)`).join('\n') || 'No files referenced yet'}

## 👥 Team Participation
${knowledgeBase.authors.map(([author, count]: [string, number]) => `- **${author}** (${count} messages)`).join('\n') || 'No messages yet'}

---

*This knowledge base is automatically generated from your team's chat history and helps identify key topics, frequently discussed files, and team participation patterns.*
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private async collectTags(): Promise<string[]> {
    const tagsInput = await vscode.window.showInputBox({
      prompt: 'Add tags (comma-separated, optional)',
      placeHolder: 'e.g., authentication, api, bug, question'
    });

    return tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  }

  private async getRelatedFiles(): Promise<string[]> {
    const activeEditor = vscode.window.activeTextEditor;
    const files: string[] = [];

    if (activeEditor) {
      files.push(vscode.workspace.asRelativePath(activeEditor.document.uri));
    }

    return files;
  }

  private async gatherQuestionContext(): Promise<{ relatedFiles: string[], codeContext?: string }> {
    const activeEditor = vscode.window.activeTextEditor;
    const relatedFiles: string[] = [];
    let codeContext: string | undefined;

    if (activeEditor) {
      relatedFiles.push(vscode.workspace.asRelativePath(activeEditor.document.uri));

      // Get selected text or current function context
      const selection = activeEditor.selection;
      if (!selection.isEmpty) {
        codeContext = activeEditor.document.getText(selection);
      } else {
        // Try to get current function/method context
        const position = activeEditor.selection.active;
        const line = activeEditor.document.lineAt(position.line);
        codeContext = line.text;
      }
    }

    return { relatedFiles, codeContext };
  }

  private async getWorkspaceContext(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 'No workspace context';
    }

    return `Workspace: ${workspaceFolder.name}`;
  }

  private async getCurrentUser(): Promise<string> {
    // Try to get Git user name
    try {
      const gitConfigName = await vscode.workspace.getConfiguration('git').get<string>('user.name');
      if (gitConfigName) {
        return gitConfigName;
      }
    } catch (error) {
      // Fall back to system user
    }

    return process.env.USERNAME || process.env.USER || 'Unknown User';
  }

  private getProjectId(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return 'unknown-project';
    }

    // Generate stable ID from workspace path
    return crypto.createHash('md5').update(workspaceFolder.uri.fsPath).digest('hex').substring(0, 8);
  }

  private getProjectName(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.name || 'Unknown Project';
  }

  private getProjectPath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath || '';
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'question': return '❓';
      case 'answer': return '💡';
      case 'discussion': return '💬';
      case 'code': return '🔧';
      default: return '📝';
    }
  }

  private async exportChatHistory(): Promise<void> {
    if (!this.currentProject) {
      return;
    }

    const exportContent = {
      project: this.currentProject.projectName,
      exported: new Date().toISOString(),
      messages: this.currentProject.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp).toISOString()
      }))
    };

    const exportPath = path.join(this.chatHistoryPath, `export_${Date.now()}.json`);
    await fs.promises.writeFile(exportPath, JSON.stringify(exportContent, null, 2));

    vscode.window.showInformationMessage(`Chat history exported to: ${exportPath}`);
  }

  private async getWebviewContent(): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Chat Memory</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .search-box {
            flex: 1;
            max-width: 400px;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            margin-right: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            margin: 0 5px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .message {
            margin-bottom: 20px;
            padding: 15px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            background: var(--vscode-editor-background);
        }
        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        .message-content {
            line-height: 1.6;
        }
        .message-tags {
            margin-top: 10px;
        }
        .tag {
            display: inline-block;
            padding: 2px 6px;
            margin: 2px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-size: 0.8em;
        }
        .message-input {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--vscode-editor-background);
            border-top: 1px solid var(--vscode-panel-border);
            padding: 15px;
        }
        .input-row {
            display: flex;
            gap: 10px;
        }
        .message-text {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            resize: vertical;
            min-height: 60px;
        }
        .messages-container {
            max-height: calc(100vh - 200px);
            overflow-y: auto;
            padding-bottom: 120px;
        }
        .type-icon {
            margin-right: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2 id="projectTitle">Team Chat Memory</h2>
        <div>
            <input type="text" id="searchInput" class="search-box" placeholder="Search discussions...">
            <button class="btn" onclick="searchMessages()">Search</button>
            <button class="btn" onclick="exportChat()">Export</button>
        </div>
    </div>
    
    <div id="messagesContainer" class="messages-container">
        <div id="loading">Loading chat history...</div>
    </div>

    <div class="message-input">
        <div class="input-row">
            <textarea id="messageText" class="message-text" placeholder="Share knowledge, ask questions, or discuss with your team..."></textarea>
            <div>
                <select id="messageType" style="margin-bottom: 10px; width: 100px; padding: 5px;">
                    <option value="discussion">Discussion</option>
                    <option value="question">Question</option>
                    <option value="answer">Answer</option>
                    <option value="code">Code</option>
                </select>
                <button class="btn" onclick="sendMessage()" style="width: 100px;">Send</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'loadMessages':
                    loadMessages(message.messages);
                    document.getElementById('projectTitle').textContent = 'Team Chat: ' + message.projectName;
                    break;
                case 'searchResults':
                    displaySearchResults(message.results);
                    break;
            }
        });

        function loadMessages(messages) {
            const container = document.getElementById('messagesContainer');
            container.innerHTML = '';
            
            if (messages.length === 0) {
                container.innerHTML = '<div style="text-align: center; opacity: 0.6; margin-top: 50px;">No messages yet. Start the conversation!</div>';
                return;
            }
            
            messages.forEach(msg => {
                const messageEl = document.createElement('div');
                messageEl.className = 'message';
                messageEl.innerHTML = \`
                    <div class="message-header">
                        <span><span class="type-icon">\${getTypeIcon(msg.type)}</span><strong>\${msg.author}</strong></span>
                        <span>\${msg.timestamp}</span>
                    </div>
                    <div class="message-content">\${msg.content.replace(/\\n/g, '<br>')}</div>
                    <div class="message-tags">
                        \${msg.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                    </div>
                \`;
                container.appendChild(messageEl);
            });
        }

        function displaySearchResults(results) {
            const container = document.getElementById('messagesContainer');
            container.innerHTML = \`<h3>Search Results (\${results.length} found)</h3>\`;
            
            results.forEach(msg => {
                const messageEl = document.createElement('div');
                messageEl.className = 'message';
                messageEl.innerHTML = \`
                    <div class="message-header">
                        <span><span class="type-icon">\${getTypeIcon(msg.type)}</span><strong>\${msg.author}</strong></span>
                        <span>\${msg.timestamp}</span>
                    </div>
                    <div class="message-content">\${msg.content.replace(/\\n/g, '<br>')}</div>
                    <div class="message-tags">
                        \${msg.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                    </div>
                \`;
                container.appendChild(messageEl);
            });
        }

        function getTypeIcon(type) {
            switch(type) {
                case 'question': return '❓';
                case 'answer': return '💡';
                case 'discussion': return '💬';
                case 'code': return '🔧';
                default: return '📝';
            }
        }

        function sendMessage() {
            const text = document.getElementById('messageText').value.trim();
            const type = document.getElementById('messageType').value;
            
            if (!text) return;
            
            vscode.postMessage({
                command: 'sendMessage',
                content: text,
                type: type
            });
            
            document.getElementById('messageText').value = '';
            
            // Reload messages after sending
            setTimeout(() => {
                vscode.postMessage({ command: 'loadHistory' });
            }, 500);
        }

        function searchMessages() {
            const query = document.getElementById('searchInput').value.trim();
            if (!query) return;
            
            vscode.postMessage({
                command: 'searchMessages',
                query: query
            });
        }

        function exportChat() {
            vscode.postMessage({ command: 'exportChat' });
        }

        // Load initial history
        vscode.postMessage({ command: 'loadHistory' });
        
        // Allow Enter to send message (Shift+Enter for new line)
        document.getElementById('messageText').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    </script>
</body>
</html>`;
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerSharedTeamChatMemoryCommands(context: vscode.ExtensionContext) {
  const teamChat = new SharedTeamChatMemory();

  const openChatCommand = vscode.commands.registerCommand('coding.openTeamChat', async () => {
    await teamChat.openTeamChat();
  });

  const searchDiscussionsCommand = vscode.commands.registerCommand('coding.searchTeamDiscussions', async () => {
    await teamChat.searchTeamDiscussions();
  });

  const addQuickNoteCommand = vscode.commands.registerCommand('coding.addTeamNote', async () => {
    await teamChat.addQuickNote();
  });

  const askQuestionCommand = vscode.commands.registerCommand('coding.askTeamQuestion', async () => {
    await teamChat.askTeamQuestion();
  });

  const viewKnowledgeCommand = vscode.commands.registerCommand('coding.viewProjectKnowledge', async () => {
    await teamChat.viewProjectKnowledge();
  });

  context.subscriptions.push(
    openChatCommand,
    searchDiscussionsCommand,
    addQuickNoteCommand,
    askQuestionCommand,
    viewKnowledgeCommand
  );
  context.subscriptions.push(teamChat);
}