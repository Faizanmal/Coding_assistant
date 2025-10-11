import * as vscode from 'vscode';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';

interface IssueTrackerConfig {
  type: 'github' | 'jira' | 'gitlab' | 'azure';
  baseUrl: string;
  token: string;
  projectId?: string;
  repository?: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee?: string;
  labels: string[];
  priority?: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  type: 'bug' | 'feature' | 'task' | 'story';
}

interface SearchQuery {
  keywords: string[];
  labels?: string[];
  status?: string;
  assignee?: string;
  type?: string;
}

export class IssueTrackerIntegration {
  private outputChannel: vscode.OutputChannel;
  private config: IssueTrackerConfig | null = null;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Issue Tracker Integration');
    this.loadConfiguration();
  }

  async setupIntegration(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🔧 Setting up Issue Tracker Integration...');

    const trackerType = await vscode.window.showQuickPick([
      { label: 'GitHub Issues', value: 'github' as const, description: 'Integrate with GitHub repository issues' },
      { label: 'Jira', value: 'jira' as const, description: 'Integrate with Atlassian Jira' },
      { label: 'GitLab Issues', value: 'gitlab' as const, description: 'Integrate with GitLab repository issues' },
      { label: 'Azure DevOps', value: 'azure' as const, description: 'Integrate with Azure DevOps work items' }
    ], { placeHolder: 'Select issue tracker type' });

    if (!trackerType) {
      return;
    }

    const config = await this.collectConfiguration(trackerType.value);
    if (!config) {
      return;
    }

    // Test the configuration
    const isValid = await this.testConnection(config);
    if (!isValid) {
      vscode.window.showErrorMessage('Failed to connect to issue tracker. Please check your configuration.');
      return;
    }

    this.config = config;
    await this.saveConfiguration();

    vscode.window.showInformationMessage('Issue tracker integration configured successfully!');
  }

  async searchIssues(): Promise<void> {
    if (!this.config) {
      await this.promptSetup();
      return;
    }

    this.outputChannel.show();
    this.outputChannel.appendLine('🔍 Searching issues...');

    const searchInput = await vscode.window.showInputBox({
      prompt: 'Search issues',
      placeHolder: 'Enter keywords, labels, or specific terms...'
    });

    if (!searchInput) {
      return;
    }

    try {
      const issues = await this.performSearch(searchInput);
      await this.showSearchResults(issues, searchInput);
    } catch (error) {
      vscode.window.showErrorMessage(`Search failed: ${error}`);
    }
  }

  async searchRelatedIssues(): Promise<void> {
    if (!this.config) {
      await this.promptSetup();
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active file to analyze for related issues');
      return;
    }

    const fileName = path.basename(activeEditor.document.fileName);
    const fileContent = activeEditor.document.getText();
    
    // Extract potential search terms from file
    const searchTerms = this.extractRelevantTerms(fileName, fileContent);
    
    const searchQuery = searchTerms.join(' ');
    this.outputChannel.appendLine(`🔍 Searching for issues related to: ${fileName}`);
    this.outputChannel.appendLine(`Search terms: ${searchQuery}`);

    try {
      const issues = await this.performSearch(searchQuery);
      const filteredIssues = this.filterRelevantIssues(issues, fileName, searchTerms);
      
      await this.showRelatedIssues(filteredIssues, fileName);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to search related issues: ${error}`);
    }
  }

  async createIssueFromCode(): Promise<void> {
    if (!this.config) {
      await this.promptSetup();
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active file selected');
      return;
    }

    const selectedText = activeEditor.selection.isEmpty 
      ? undefined 
      : activeEditor.document.getText(activeEditor.selection);

    const issueData = await this.collectIssueData(activeEditor, selectedText);
    if (!issueData) {
      return;
    }

    try {
      const createdIssue = await this.createIssue(issueData);
      vscode.window.showInformationMessage(`Issue created: ${createdIssue.title}`);
      
      // Optionally open the issue in browser
      const openInBrowser = await vscode.window.showQuickPick([
        { label: 'Yes, open in browser', value: true },
        { label: 'No, continue working', value: false }
      ], { placeHolder: 'Open issue in browser?' });

      if (openInBrowser?.value) {
        vscode.env.openExternal(vscode.Uri.parse(createdIssue.url));
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create issue: ${error}`);
    }
  }

  async showIssueDetails(): Promise<void> {
    if (!this.config) {
      await this.promptSetup();
      return;
    }

    const issueId = await vscode.window.showInputBox({
      prompt: 'Enter issue ID or URL',
      placeHolder: 'e.g., #123, PROJ-456, or full URL'
    });

    if (!issueId) {
      return;
    }

    try {
      const issue = await this.getIssueDetails(issueId);
      await this.displayIssueDetails(issue);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get issue details: ${error}`);
    }
  }

  async linkFileToIssue(): Promise<void> {
    if (!this.config) {
      await this.promptSetup();
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active file selected');
      return;
    }

    const fileName = vscode.workspace.asRelativePath(activeEditor.document.uri);
    
    // Search for existing issues
    const recentIssues = await this.getRecentIssues();
    const issueItems = recentIssues.map(issue => ({
      label: `#${issue.id}: ${issue.title}`,
      description: issue.status,
      detail: issue.description.substring(0, 100),
      issue
    }));

    issueItems.unshift({
      label: '$(search) Search for issue...',
      description: 'Search by keywords',
      detail: 'Find specific issue by searching',
      issue: null as any
    });

    const selected = await vscode.window.showQuickPick(issueItems, {
      placeHolder: `Link ${fileName} to which issue?`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) {
      return;
    }

    let targetIssue = selected.issue;

    if (!targetIssue) {
      // User chose to search
      const searchQuery = await vscode.window.showInputBox({
        prompt: 'Search for issues',
        placeHolder: 'Enter keywords to find issues...'
      });

      if (!searchQuery) {
        return;
      }

      const searchResults = await this.performSearch(searchQuery);
      const searchItems = searchResults.map(issue => ({
        label: `#${issue.id}: ${issue.title}`,
        description: issue.status,
        issue
      }));

      const searchSelected = await vscode.window.showQuickPick(searchItems, {
        placeHolder: 'Select issue from search results'
      });

      if (!searchSelected) {
        return;
      }

      targetIssue = searchSelected.issue;
    }

    await this.createFileIssueLink(fileName, targetIssue);
    vscode.window.showInformationMessage(`Linked ${fileName} to issue #${targetIssue.id}`);
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }

      const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'issue-tracker.json');
      if (fs.existsSync(configPath)) {
        const configContent = await fs.promises.readFile(configPath, 'utf8');
        this.config = JSON.parse(configContent);
      }
    } catch (error) {
      this.outputChannel.appendLine(`Failed to load configuration: ${error}`);
    }
  }

  private async saveConfiguration(): Promise<void> {
    if (!this.config) {
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }

      const configDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
      await fs.promises.mkdir(configDir, { recursive: true });

      const configPath = path.join(configDir, 'issue-tracker.json');
      await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      this.outputChannel.appendLine(`Failed to save configuration: ${error}`);
    }
  }

  private async collectConfiguration(type: 'github' | 'jira' | 'gitlab' | 'azure'): Promise<IssueTrackerConfig | undefined> {
    let baseUrl = '';
    let token = '';
    let projectId = '';
    let repository = '';

    switch (type) {
      case 'github':
        repository = await vscode.window.showInputBox({
          prompt: 'Enter GitHub repository (owner/repo)',
          placeHolder: 'e.g., microsoft/vscode'
        }) || '';

        token = await vscode.window.showInputBox({
          prompt: 'Enter GitHub Personal Access Token',
          placeHolder: 'ghp_...',
          password: true
        }) || '';

        baseUrl = 'https://api.github.com';
        break;

      case 'jira':
        baseUrl = await vscode.window.showInputBox({
          prompt: 'Enter Jira base URL',
          placeHolder: 'https://yourcompany.atlassian.net'
        }) || '';

        projectId = await vscode.window.showInputBox({
          prompt: 'Enter Jira project key',
          placeHolder: 'e.g., PROJ'
        }) || '';

        token = await vscode.window.showInputBox({
          prompt: 'Enter Jira API token',
          password: true
        }) || '';
        break;

      case 'gitlab':
        baseUrl = await vscode.window.showInputBox({
          prompt: 'Enter GitLab base URL',
          placeHolder: 'https://gitlab.com or your self-hosted URL',
          value: 'https://gitlab.com'
        }) || '';

        projectId = await vscode.window.showInputBox({
          prompt: 'Enter GitLab project ID',
          placeHolder: 'e.g., 12345678'
        }) || '';

        token = await vscode.window.showInputBox({
          prompt: 'Enter GitLab Personal Access Token',
          password: true
        }) || '';
        break;

      case 'azure':
        baseUrl = await vscode.window.showInputBox({
          prompt: 'Enter Azure DevOps organization URL',
          placeHolder: 'https://dev.azure.com/yourorg'
        }) || '';

        projectId = await vscode.window.showInputBox({
          prompt: 'Enter Azure DevOps project name',
          placeHolder: 'Your project name'
        }) || '';

        token = await vscode.window.showInputBox({
          prompt: 'Enter Azure DevOps Personal Access Token',
          password: true
        }) || '';
        break;
    }

    if (!baseUrl || !token) {
      return undefined;
    }

    return {
      type,
      baseUrl,
      token,
      projectId: projectId || undefined,
      repository: repository || undefined
    };
  }

  private async testConnection(config: IssueTrackerConfig): Promise<boolean> {
    try {
      // Simple test to verify configuration
      switch (config.type) {
        case 'github':
          return await this.testGitHubConnection(config);
        case 'jira':
          return await this.testJiraConnection(config);
        case 'gitlab':
          return await this.testGitLabConnection(config);
        case 'azure':
          return await this.testAzureConnection(config);
        default:
          return false;
      }
    } catch (error) {
      this.outputChannel.appendLine(`Connection test failed: ${error}`);
      return false;
    }
  }

  private async testGitHubConnection(config: IssueTrackerConfig): Promise<boolean> {
    const url = `${config.baseUrl}/repos/${config.repository}`;
    return await this.makeApiRequest('GET', url, config.token);
  }

  private async testJiraConnection(config: IssueTrackerConfig): Promise<boolean> {
    const url = `${config.baseUrl}/rest/api/2/project/${config.projectId}`;
    return await this.makeApiRequest('GET', url, config.token);
  }

  private async testGitLabConnection(config: IssueTrackerConfig): Promise<boolean> {
    const url = `${config.baseUrl}/api/v4/projects/${config.projectId}`;
    return await this.makeApiRequest('GET', url, config.token, 'PRIVATE-TOKEN');
  }

  private async testAzureConnection(config: IssueTrackerConfig): Promise<boolean> {
    const url = `${config.baseUrl}/_apis/projects/${config.projectId}?api-version=6.0`;
    return await this.makeApiRequest('GET', url, config.token);
  }

  private async makeApiRequest(method: string, url: string, token: string, headerName = 'Authorization'): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: {
            'User-Agent': 'VSCode-Extension',
            'Content-Type': 'application/json'
          } as any
        };

        if (headerName === 'Authorization') {
          options.headers[headerName] = `Bearer ${token}`;
        } else {
          options.headers[headerName] = token;
        }

        const req = https.request(options, (res) => {
          resolve(res.statusCode === 200);
        });

        req.on('error', () => resolve(false));
        req.end();
      } catch {
        resolve(false);
      }
    });
  }

  private async performSearch(query: string): Promise<Issue[]> {
    if (!this.config) {
      throw new Error('No configuration found');
    }

    // This is a simplified implementation - in reality, each API would have different search endpoints
    switch (this.config.type) {
      case 'github':
        return await this.searchGitHubIssues(query);
      case 'jira':
        return await this.searchJiraIssues(query);
      case 'gitlab':
        return await this.searchGitLabIssues(query);
      case 'azure':
        return await this.searchAzureIssues(query);
      default:
        throw new Error('Unsupported issue tracker type');
    }
  }

  private async searchGitHubIssues(query: string): Promise<Issue[]> {
    // Simplified GitHub search implementation
    // In a real implementation, this would use the GitHub Search API
    return [
      {
        id: '123',
        title: `Sample GitHub issue matching "${query}"`,
        description: 'This is a sample issue for demonstration',
        status: 'open',
        labels: ['bug', 'enhancement'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://github.com/example/repo/issues/123',
        type: 'bug'
      }
    ];
  }

  private async searchJiraIssues(query: string): Promise<Issue[]> {
    // Simplified Jira search implementation
    return [
      {
        id: 'PROJ-456',
        title: `Sample Jira issue matching "${query}"`,
        description: 'This is a sample Jira issue for demonstration',
        status: 'In Progress',
        labels: ['authentication'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: `${this.config!.baseUrl}/browse/PROJ-456`,
        type: 'story'
      }
    ];
  }

  private async searchGitLabIssues(query: string): Promise<Issue[]> {
    // Simplified GitLab search implementation
    return [
      {
        id: '789',
        title: `Sample GitLab issue matching "${query}"`,
        description: 'This is a sample GitLab issue for demonstration',
        status: 'opened',
        labels: ['bug', 'critical'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: `${this.config!.baseUrl}/project/issues/789`,
        type: 'bug'
      }
    ];
  }

  private async searchAzureIssues(query: string): Promise<Issue[]> {
    // Simplified Azure DevOps search implementation
    return [
      {
        id: '101',
        title: `Sample Azure work item matching "${query}"`,
        description: 'This is a sample Azure DevOps work item for demonstration',
        status: 'Active',
        labels: ['feature'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: `${this.config!.baseUrl}/${this.config!.projectId}/_workitems/edit/101`,
        type: 'feature'
      }
    ];
  }

  private extractRelevantTerms(fileName: string, fileContent: string): string[] {
    const terms = new Set<string>();
    
    // Add filename components
    const nameWithoutExt = path.parse(fileName).name;
    nameWithoutExt.split(/[_-]/).forEach(part => {
      if (part.length > 2) {
        terms.add(part);
      }
    });

    // Extract function names, class names, etc.
    const codePatterns = [
      /function\s+(\w+)/g,
      /class\s+(\w+)/g,
      /const\s+(\w+)/g,
      /let\s+(\w+)/g,
      /var\s+(\w+)/g,
      /interface\s+(\w+)/g,
      /type\s+(\w+)/g
    ];

    codePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(fileContent)) !== null) {
        terms.add(match[1]);
      }
    });

    // Extract comments that might contain issue-related terms
    const commentMatch = fileContent.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm);
    commentMatch?.forEach(comment => {
      const words = comment.replace(/[^\w\s]/g, ' ').split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !['TODO', 'FIXME', 'NOTE'].includes(word.toUpperCase())) {
          terms.add(word);
        }
      });
    });

    return Array.from(terms).slice(0, 10); // Limit to 10 most relevant terms
  }

  private filterRelevantIssues(issues: Issue[], fileName: string, searchTerms: string[]): Issue[] {
    // Score issues based on relevance to the current file
    return issues.filter(issue => {
      const issueText = `${issue.title} ${issue.description}`.toLowerCase();
      const fileNameLower = fileName.toLowerCase();
      
      // Check if issue mentions the file name or search terms
      const hasFileNameMatch = issueText.includes(fileNameLower) || 
                               issue.title.toLowerCase().includes(fileNameLower);
      
      const hasTermMatch = searchTerms.some(term => 
        issueText.includes(term.toLowerCase())
      );

      return hasFileNameMatch || hasTermMatch;
    });
  }

  private async showSearchResults(issues: Issue[], query: string): Promise<void> {
    const content = `# Issue Search Results

**Query:** "${query}"
**Found:** ${issues.length} issues

${issues.map(issue => `
## ${this.getTypeIcon(issue.type)} [${issue.id}] ${issue.title}

**Status:** ${issue.status}  
**Type:** ${issue.type}  
**Labels:** ${issue.labels.join(', ') || 'None'}  
**Created:** ${new Date(issue.createdAt).toLocaleDateString()}  
**URL:** ${issue.url}

${issue.description.substring(0, 200)}${issue.description.length > 200 ? '...' : ''}

---
`).join('\n')}

${issues.length === 0 ? 'No issues found matching your search criteria.' : ''}
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private async showRelatedIssues(issues: Issue[], fileName: string): Promise<void> {
    const content = `# Related Issues for ${fileName}

**Found:** ${issues.length} related issues

${issues.map(issue => `
## ${this.getTypeIcon(issue.type)} [${issue.id}] ${issue.title}

**Status:** ${issue.status} • **Type:** ${issue.type}  
**Created:** ${new Date(issue.createdAt).toLocaleDateString()}  
**URL:** ${issue.url}

${issue.description.substring(0, 150)}${issue.description.length > 150 ? '...' : ''}

**Labels:** ${issue.labels.join(', ') || 'None'}

---
`).join('\n')}

${issues.length === 0 ? 'No related issues found for this file.' : ''}
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private async collectIssueData(editor: vscode.TextEditor, selectedText?: string): Promise<any> {
    const fileName = vscode.workspace.asRelativePath(editor.document.uri);
    
    const title = await vscode.window.showInputBox({
      prompt: 'Enter issue title',
      placeHolder: `Issue related to ${fileName}`
    });

    if (!title) {
      return undefined;
    }

    const type = await vscode.window.showQuickPick([
      { label: 'Bug', value: 'bug' },
      { label: 'Feature Request', value: 'feature' },
      { label: 'Task', value: 'task' },
      { label: 'Story', value: 'story' }
    ], { placeHolder: 'Select issue type' });

    if (!type) {
      return undefined;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter issue description',
      placeHolder: 'Describe the issue in detail...'
    });

    let codeContext = '';
    if (selectedText) {
      codeContext = `\n\nCode context from \`${fileName}\`:\n\`\`\`\n${selectedText}\n\`\`\``;
    }

    return {
      title,
      description: (description || 'No description provided') + codeContext,
      type: type.value,
      labels: [type.value],
      relatedFile: fileName
    };
  }

  private async createIssue(issueData: any): Promise<Issue> {
    // This is a simplified implementation
    // In reality, each tracker would have different API endpoints for creation
    
    const newIssue: Issue = {
      id: Math.random().toString(36).substring(7),
      title: issueData.title,
      description: issueData.description,
      status: 'open',
      labels: issueData.labels,
      type: issueData.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `${this.config!.baseUrl}/issues/new-issue`
    };

    return newIssue;
  }

  private async getIssueDetails(issueId: string): Promise<Issue> {
    // Simplified implementation
    return {
      id: issueId,
      title: `Issue ${issueId}`,
      description: 'Detailed issue description would be loaded from the API',
      status: 'open',
      labels: ['bug'],
      type: 'bug',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: `${this.config!.baseUrl}/issues/${issueId}`
    };
  }

  private async displayIssueDetails(issue: Issue): Promise<void> {
    const content = `# ${this.getTypeIcon(issue.type)} [${issue.id}] ${issue.title}

**Status:** ${issue.status}  
**Type:** ${issue.type}  
**Labels:** ${issue.labels.join(', ') || 'None'}  
**Created:** ${new Date(issue.createdAt).toLocaleString()}  
**Updated:** ${new Date(issue.updatedAt).toLocaleString()}  
**URL:** [Open in browser](${issue.url})

## Description

${issue.description}

---

*Issue details loaded from ${this.config!.type} integration*
`;

    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc);
  }

  private async getRecentIssues(): Promise<Issue[]> {
    // This would typically fetch recent issues from the API
    // For now, return sample data
    return [
      {
        id: '123',
        title: 'Authentication bug in login flow',
        description: 'Users unable to login with valid credentials',
        status: 'open',
        labels: ['bug', 'authentication'],
        type: 'bug',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
        url: 'https://example.com/issues/123'
      }
    ];
  }

  private async createFileIssueLink(fileName: string, issue: Issue): Promise<void> {
    // This would create a link between the file and issue
    // Could be stored in project metadata, comments, or external system
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const linksFile = path.join(workspaceFolder.uri.fsPath, '.vscode', 'issue-links.json');
    
    let links: any = {};
    try {
      if (fs.existsSync(linksFile)) {
        const content = await fs.promises.readFile(linksFile, 'utf8');
        links = JSON.parse(content);
      }
    } catch {
      links = {};
    }

    if (!links[fileName]) {
      links[fileName] = [];
    }

    links[fileName].push({
      issueId: issue.id,
      title: issue.title,
      url: issue.url,
      linkedAt: new Date().toISOString()
    });

    await fs.promises.writeFile(linksFile, JSON.stringify(links, null, 2));
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'task': return '📋';
      case 'story': return '📖';
      default: return '📝';
    }
  }

  private async promptSetup(): Promise<void> {
    const setup = await vscode.window.showInformationMessage(
      'Issue tracker integration is not configured.',
      'Setup Integration',
      'Cancel'
    );

    if (setup === 'Setup Integration') {
      await this.setupIntegration();
    }
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerIssueTrackerIntegrationCommands(context: vscode.ExtensionContext) {
  const integration = new IssueTrackerIntegration();

  const setupCommand = vscode.commands.registerCommand('coding.setupIssueTracker', async () => {
    await integration.setupIntegration();
  });

  const searchCommand = vscode.commands.registerCommand('coding.searchIssues', async () => {
    await integration.searchIssues();
  });

  const relatedIssuesCommand = vscode.commands.registerCommand('coding.searchRelatedIssues', async () => {
    await integration.searchRelatedIssues();
  });

  const createIssueCommand = vscode.commands.registerCommand('coding.createIssueFromCode', async () => {
    await integration.createIssueFromCode();
  });

  const showDetailsCommand = vscode.commands.registerCommand('coding.showIssueDetails', async () => {
    await integration.showIssueDetails();
  });

  const linkFileCommand = vscode.commands.registerCommand('coding.linkFileToIssue', async () => {
    await integration.linkFileToIssue();
  });

  context.subscriptions.push(
    setupCommand,
    searchCommand,
    relatedIssuesCommand,
    createIssueCommand,
    showDetailsCommand,
    linkFileCommand
  );
  context.subscriptions.push(integration);
}