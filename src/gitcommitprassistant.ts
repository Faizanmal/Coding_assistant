import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CommitInfo {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking?: boolean;
  issues?: string[];
}

interface PRInfo {
  title: string;
  description: string;
  type: 'feature' | 'bugfix' | 'hotfix' | 'chore';
  changes: string[];
  testing: string;
  breaking: boolean;
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    features: string[];
    bugfixes: string[];
    breaking: string[];
    chores: string[];
  };
}

export class GitCommitPRAssistant {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Git Commit & PR Assistant');
  }

  async generateConventionalCommit(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('📝 Generating Conventional Commit Message...');

    try {
      const stagedFiles = await this.getStagedFiles();
      if (stagedFiles.length === 0) {
        vscode.window.showWarningMessage('No staged files found. Please stage your changes first.');
        return;
      }

      const diff = await this.getStagedDiff();
      const commitInfo = await this.collectCommitInfo(stagedFiles, diff);
      
      if (!commitInfo) {
        return;
      }

      const commitMessage = this.formatConventionalCommit(commitInfo);
      await this.applyCommitMessage(commitMessage);

      vscode.window.showInformationMessage('Conventional commit message generated!');

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate commit: ${error}`);
    }
  }

  async generatePRDescription(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🔀 Generating PR Description...');

    try {
      const branch = await this.getCurrentBranch();
      const commits = await this.getCommitsSinceBranch('main');
      const diff = await this.getDiffSinceBranch('main');
      
      const prInfo = await this.collectPRInfo(branch, commits, diff);
      if (!prInfo) {
        return;
      }

      const prDescription = this.formatPRDescription(prInfo);
      await this.savePRTemplate(prDescription);

      vscode.window.showInformationMessage('PR description generated and saved!');

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate PR description: ${error}`);
    }
  }

  async generateChangelog(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('📋 Generating Changelog...');

    try {
      const tags = await this.getGitTags();
      const lastTag = tags[0];
      
      let commits;
      if (lastTag) {
        commits = await this.getCommitsSinceTag(lastTag);
      } else {
        commits = await this.getAllCommits();
      }

      const changelogEntry = this.parseCommitsForChangelog(commits);
      await this.updateChangelog(changelogEntry);

      vscode.window.showInformationMessage('Changelog updated!');

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate changelog: ${error}`);
    }
  }

  async summarizeDiff(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('📊 Summarizing Git Diff...');

    try {
      const diffType = await vscode.window.showQuickPick([
        { label: 'Staged Changes', value: 'staged' },
        { label: 'Working Directory', value: 'working' },
        { label: 'Since Last Commit', value: 'last' },
        { label: 'Between Branches', value: 'branches' }
      ], { placeHolder: 'Select diff type to summarize' });

      if (!diffType) {
        return;
      }

      let diff = '';
      switch (diffType.value) {
        case 'staged':
          diff = await this.getStagedDiff();
          break;
        case 'working':
          diff = await this.getWorkingDiff();
          break;
        case 'last':
          diff = await this.getDiffSinceCommit('HEAD~1');
          break;
        case 'branches':
          const branch = await vscode.window.showInputBox({
            prompt: 'Enter branch to compare against',
            placeHolder: 'main'
          });
          if (branch) {
            diff = await this.getDiffSinceBranch(branch);
          }
          break;
      }

      if (!diff) {
        vscode.window.showInformationMessage('No changes found.');
        return;
      }

      const summary = this.analyzeDiff(diff);
      await this.showDiffSummary(summary, diffType.label);

    } catch (error) {
      vscode.window.showErrorMessage(`Failed to summarize diff: ${error}`);
    }
  }

  private async getStagedFiles(): Promise<string[]> {
    const { stdout } = await execAsync('git diff --cached --name-only', { cwd: this.getWorkspaceRoot() });
    return stdout.trim().split('\n').filter(file => file.length > 0);
  }

  private async getStagedDiff(): Promise<string> {
    const { stdout } = await execAsync('git diff --cached', { cwd: this.getWorkspaceRoot() });
    return stdout;
  }

  private async getWorkingDiff(): Promise<string> {
    const { stdout } = await execAsync('git diff', { cwd: this.getWorkspaceRoot() });
    return stdout;
  }

  private async getDiffSinceCommit(commit: string): Promise<string> {
    const { stdout } = await execAsync(`git diff ${commit}`, { cwd: this.getWorkspaceRoot() });
    return stdout;
  }

  private async getDiffSinceBranch(branch: string): Promise<string> {
    const { stdout } = await execAsync(`git diff ${branch}...HEAD`, { cwd: this.getWorkspaceRoot() });
    return stdout;
  }

  private async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git branch --show-current', { cwd: this.getWorkspaceRoot() });
    return stdout.trim();
  }

  private async getCommitsSinceBranch(branch: string): Promise<string[]> {
    const { stdout } = await execAsync(`git log ${branch}..HEAD --oneline`, { cwd: this.getWorkspaceRoot() });
    return stdout.trim().split('\n').filter(line => line.length > 0);
  }

  private async getCommitsSinceTag(tag: string): Promise<string[]> {
    const { stdout } = await execAsync(`git log ${tag}..HEAD --oneline`, { cwd: this.getWorkspaceRoot() });
    return stdout.trim().split('\n').filter(line => line.length > 0);
  }

  private async getAllCommits(): Promise<string[]> {
    const { stdout } = await execAsync('git log --oneline', { cwd: this.getWorkspaceRoot() });
    return stdout.trim().split('\n').filter(line => line.length > 0);
  }

  private async getGitTags(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git tag --sort=-version:refname', { cwd: this.getWorkspaceRoot() });
      return stdout.trim().split('\n').filter(tag => tag.length > 0);
    } catch {
      return [];
    }
  }

  private async collectCommitInfo(stagedFiles: string[], diff: string): Promise<CommitInfo | undefined> {
    // Analyze staged files and diff to suggest commit type
    const suggestedType = this.suggestCommitType(stagedFiles, diff);
    
    const type = await vscode.window.showQuickPick([
      { label: 'feat: A new feature', value: 'feat' },
      { label: 'fix: A bug fix', value: 'fix' },
      { label: 'docs: Documentation only changes', value: 'docs' },
      { label: 'style: Code style changes (formatting, etc)', value: 'style' },
      { label: 'refactor: Code refactoring', value: 'refactor' },
      { label: 'perf: Performance improvements', value: 'perf' },
      { label: 'test: Adding or updating tests', value: 'test' },
      { label: 'build: Build system or dependency changes', value: 'build' },
      { label: 'ci: CI configuration changes', value: 'ci' },
      { label: 'chore: Other changes', value: 'chore' }
    ], { 
      placeHolder: `Select commit type (suggested: ${suggestedType})`,
      matchOnDescription: true 
    });

    if (!type) {
      return undefined;
    }

    const scope = await vscode.window.showInputBox({
      prompt: 'Enter scope (optional)',
      placeHolder: 'e.g., auth, api, ui'
    });

    const description = await vscode.window.showInputBox({
      prompt: 'Enter commit description',
      placeHolder: 'Brief description of changes',
      value: this.suggestCommitDescription(stagedFiles, diff)
    });

    if (!description) {
      return undefined;
    }

    const bodyInput = await vscode.window.showInputBox({
      prompt: 'Enter detailed description (optional)',
      placeHolder: 'Explain the what and why of your changes'
    });

    const isBreaking = await vscode.window.showQuickPick([
      { label: 'No breaking changes', value: false },
      { label: 'Contains breaking changes', value: true }
    ], { placeHolder: 'Are there any breaking changes?' });

    const issuesInput = await vscode.window.showInputBox({
      prompt: 'Related issues (optional)',
      placeHolder: 'e.g., #123, #456'
    });

    const issues = issuesInput?.split(/[,\s]+/).map(issue => issue.trim()).filter(issue => issue.startsWith('#')) || [];

    return {
      type: type.value,
      scope,
      description,
      body: bodyInput,
      breaking: isBreaking?.value || false,
      issues
    };
  }

  private suggestCommitType(stagedFiles: string[], diff: string): string {
    // Analyze files and content to suggest commit type
    const hasTests = stagedFiles.some(file => file.includes('test') || file.includes('spec'));
    const hasDocs = stagedFiles.some(file => file.includes('README') || file.includes('.md'));
    const hasConfig = stagedFiles.some(file => file.includes('config') || file.includes('.json') || file.includes('.yml'));
    
    if (diff.includes('function ') || diff.includes('class ') || diff.includes('export ')) {
      return 'feat';
    } else if (diff.includes('bug') || diff.includes('fix') || diff.includes('error')) {
      return 'fix';
    } else if (hasDocs) {
      return 'docs';
    } else if (hasTests) {
      return 'test';
    } else if (hasConfig) {
      return 'build';
    }
    
    return 'chore';
  }

  private suggestCommitDescription(stagedFiles: string[], diff: string): string {
    if (stagedFiles.length === 1) {
      const fileName = path.basename(stagedFiles[0]);
      return `update ${fileName}`;
    } else if (stagedFiles.length <= 3) {
      return `update ${stagedFiles.map(f => path.basename(f)).join(', ')}`;
    } else {
      const directories = [...new Set(stagedFiles.map(f => path.dirname(f)))];
      if (directories.length === 1 && directories[0] !== '.') {
        return `update ${directories[0]} module`;
      }
    }
    
    return `update ${stagedFiles.length} files`;
  }

  private formatConventionalCommit(commitInfo: CommitInfo): string {
    let message = commitInfo.type;
    
    if (commitInfo.scope) {
      message += `(${commitInfo.scope})`;
    }
    
    if (commitInfo.breaking) {
      message += '!';
    }
    
    message += `: ${commitInfo.description}`;
    
    if (commitInfo.body) {
      message += `\n\n${commitInfo.body}`;
    }
    
    if (commitInfo.breaking) {
      message += `\n\nBREAKING CHANGE: ${commitInfo.body || 'Breaking change introduced'}`;
    }
    
    if (commitInfo.issues && commitInfo.issues.length > 0) {
      message += `\n\nCloses: ${commitInfo.issues.join(', ')}`;
    }
    
    return message;
  }

  private async applyCommitMessage(message: string): Promise<void> {
    // Try to use VS Code's built-in Git extension
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension && gitExtension.isActive) {
      const git = gitExtension.exports.getAPI(1);
      if (git && git.repositories.length > 0) {
        const repo = git.repositories[0];
        repo.inputBox.value = message;
        vscode.window.showInformationMessage('Commit message set in Git panel');
        return;
      }
    }
    
    // Fallback: create a temporary commit file
    const workspaceRoot = this.getWorkspaceRoot();
    const commitMsgPath = path.join(workspaceRoot, '.git', 'COMMIT_EDITMSG');
    await fs.promises.writeFile(commitMsgPath, message);
    
    // Show the message for user to copy
    const doc = await vscode.workspace.openTextDocument({ content: message, language: 'gitcommit' });
    await vscode.window.showTextDocument(doc);
  }

  private async collectPRInfo(branch: string, commits: string[], diff: string): Promise<PRInfo | undefined> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter PR title',
      placeHolder: 'Brief description of the changes',
      value: this.generatePRTitle(branch, commits)
    });

    if (!title) {
      return undefined;
    }

    const type = await vscode.window.showQuickPick([
      { label: 'Feature: New functionality', value: 'feature' as const },
      { label: 'Bug Fix: Fixes a bug', value: 'bugfix' as const },
      { label: 'Hotfix: Critical bug fix', value: 'hotfix' as const },
      { label: 'Chore: Maintenance work', value: 'chore' as const }
    ], { placeHolder: 'Select PR type' });

    if (!type) {
      return undefined;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter PR description',
      placeHolder: 'Detailed description of changes and motivation'
    });

    const testing = await vscode.window.showInputBox({
      prompt: 'Describe testing performed',
      placeHolder: 'How were these changes tested?'
    });

    const breaking = await vscode.window.showQuickPick([
      { label: 'No breaking changes', value: false },
      { label: 'Contains breaking changes', value: true }
    ], { placeHolder: 'Are there any breaking changes?' });

    const changes = this.extractChangesFromCommits(commits);

    return {
      title,
      description: description || 'No description provided.',
      type: type.value,
      changes,
      testing: testing || 'Manual testing performed.',
      breaking: breaking?.value || false
    };
  }

  private generatePRTitle(branch: string, commits: string[]): string {
    // Extract meaningful title from branch name or commits
    if (branch.includes('/')) {
      const parts = branch.split('/');
      const type = parts[0];
      const description = parts.slice(1).join(' ').replace(/-/g, ' ');
      return `${type}: ${description}`;
    }
    
    if (commits.length === 1) {
      // Use the single commit message (after the hash)
      return commits[0].substring(8);
    }
    
    return branch.replace(/-/g, ' ');
  }

  private extractChangesFromCommits(commits: string[]): string[] {
    return commits.map(commit => {
      // Extract the commit message part (after the hash)
      const message = commit.substring(8);
      return `- ${message}`;
    });
  }

  private formatPRDescription(prInfo: PRInfo): string {
    let description = `# ${prInfo.title}

## Description
${prInfo.description}

## Type of Change
- [${prInfo.type === 'feature' ? 'x' : ' '}] New feature
- [${prInfo.type === 'bugfix' ? 'x' : ' '}] Bug fix
- [${prInfo.type === 'hotfix' ? 'x' : ' '}] Hotfix
- [${prInfo.type === 'chore' ? 'x' : ' '}] Chore/maintenance
- [${prInfo.breaking ? 'x' : ' '}] Breaking change

## Changes Made
${prInfo.changes.join('\n')}

## Testing
${prInfo.testing}

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review of code completed
- [ ] Code is commented where necessary
- [ ] Tests added/updated for changes
- [ ] All tests pass
- [ ] Documentation updated if needed`;

    if (prInfo.breaking) {
      description += `

## Breaking Changes
⚠️ This PR contains breaking changes that may require updates to existing code.`;
    }

    return description;
  }

  private async savePRTemplate(description: string): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    const prTemplatePath = path.join(workspaceRoot, 'pr-template.md');
    
    await fs.promises.writeFile(prTemplatePath, description);
    
    // Also try to copy to clipboard
    try {
      await vscode.env.clipboard.writeText(description);
      this.outputChannel.appendLine('PR description copied to clipboard');
    } catch (error) {
      this.outputChannel.appendLine('Could not copy to clipboard');
    }
    
    // Open the template file
    const doc = await vscode.workspace.openTextDocument(prTemplatePath);
    await vscode.window.showTextDocument(doc);
  }

  private parseCommitsForChangelog(commits: string[]): ChangelogEntry {
    const today = new Date().toISOString().split('T')[0];
    const version = this.getNextVersion(); // Could be enhanced to read package.json
    
    const changes = {
      features: [] as string[],
      bugfixes: [] as string[],
      breaking: [] as string[],
      chores: [] as string[]
    };

    commits.forEach(commit => {
      const message = commit.substring(8); // Remove commit hash
      
      if (message.startsWith('feat')) {
        changes.features.push(message);
      } else if (message.startsWith('fix')) {
        changes.bugfixes.push(message);
      } else if (message.includes('BREAKING') || message.includes('!:')) {
        changes.breaking.push(message);
      } else {
        changes.chores.push(message);
      }
    });

    return {
      version,
      date: today,
      changes
    };
  }

  private getNextVersion(): string {
    // Simple version incrementing - could be enhanced
    return '1.0.0'; // Default version
  }

  private async updateChangelog(entry: ChangelogEntry): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    const changelogPath = path.join(workspaceRoot, 'CHANGELOG.md');
    
    let existingContent = '';
    try {
      existingContent = await fs.promises.readFile(changelogPath, 'utf8');
    } catch {
      // File doesn't exist, will create new
    }

    const newEntry = this.formatChangelogEntry(entry);
    
    let updatedContent;
    if (existingContent.includes('# Changelog')) {
      // Insert after the header
      updatedContent = existingContent.replace(
        '# Changelog\n',
        `# Changelog\n\n${newEntry}\n`
      );
    } else {
      // Create new changelog
      updatedContent = `# Changelog\n\n${newEntry}\n\n${existingContent}`;
    }

    await fs.promises.writeFile(changelogPath, updatedContent);
    
    // Open the changelog file
    const doc = await vscode.workspace.openTextDocument(changelogPath);
    await vscode.window.showTextDocument(doc);
    
    this.outputChannel.appendLine(`✅ Changelog updated: ${changelogPath}`);
  }

  private formatChangelogEntry(entry: ChangelogEntry): string {
    let content = `## [${entry.version}] - ${entry.date}\n`;
    
    if (entry.changes.breaking.length > 0) {
      content += '\n### ⚠️ Breaking Changes\n';
      entry.changes.breaking.forEach(change => {
        content += `- ${change}\n`;
      });
    }
    
    if (entry.changes.features.length > 0) {
      content += '\n### ✨ Features\n';
      entry.changes.features.forEach(change => {
        content += `- ${change}\n`;
      });
    }
    
    if (entry.changes.bugfixes.length > 0) {
      content += '\n### 🐛 Bug Fixes\n';
      entry.changes.bugfixes.forEach(change => {
        content += `- ${change}\n`;
      });
    }
    
    if (entry.changes.chores.length > 0) {
      content += '\n### 🔧 Chores\n';
      entry.changes.chores.forEach(change => {
        content += `- ${change}\n`;
      });
    }
    
    return content;
  }

  private analyzeDiff(diff: string): any {
    const lines = diff.split('\n');
    
    let addedLines = 0;
    let removedLines = 0;
    const changedFiles = new Set<string>();
    const languages = new Set<string>();
    
    lines.forEach(line => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        const filePath = line.substring(4);
        if (filePath !== '/dev/null') {
          changedFiles.add(filePath);
          const ext = path.extname(filePath);
          if (ext) {
            languages.add(ext);
          }
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines++;
      }
    });

    return {
      filesChanged: changedFiles.size,
      linesAdded: addedLines,
      linesRemoved: removedLines,
      netLines: addedLines - removedLines,
      languages: Array.from(languages),
      files: Array.from(changedFiles)
    };
  }

  private async showDiffSummary(summary: any, diffType: string): Promise<void> {
    const content = `# Diff Summary: ${diffType}

## Statistics
- **Files Changed**: ${summary.filesChanged}
- **Lines Added**: ${summary.linesAdded}
- **Lines Removed**: ${summary.linesRemoved}
- **Net Change**: ${summary.netLines > 0 ? '+' : ''}${summary.netLines}

## Languages Involved
${summary.languages.length > 0 ? summary.languages.map((lang: string) => `- ${lang}`).join('\n') : 'No specific languages detected'}

## Files Modified
${summary.files.length > 0 ? summary.files.map((file: string) => `- ${file}`).join('\n') : 'No files detected'}

## Change Density
${summary.filesChanged > 0 ? `Average ${Math.round((summary.linesAdded + summary.linesRemoved) / summary.filesChanged)} lines changed per file` : 'No changes detected'}
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
    this.outputChannel.appendLine('📊 Diff summary generated');
  }

  private getWorkspaceRoot(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }
    return workspaceFolder.uri.fsPath;
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerGitCommitPRAssistantCommands(context: vscode.ExtensionContext) {
  const assistant = new GitCommitPRAssistant();

  const generateCommitCommand = vscode.commands.registerCommand('coding.generateConventionalCommit', async () => {
    await assistant.generateConventionalCommit();
  });

  const generatePRCommand = vscode.commands.registerCommand('coding.generatePRDescription', async () => {
    await assistant.generatePRDescription();
  });

  const generateChangelogCommand = vscode.commands.registerCommand('coding.generateChangelog', async () => {
    await assistant.generateChangelog();
  });

  const summarizeDiffCommand = vscode.commands.registerCommand('coding.summarizeDiff', async () => {
    await assistant.summarizeDiff();
  });

  context.subscriptions.push(generateCommitCommand, generatePRCommand, generateChangelogCommand, summarizeDiffCommand);
  context.subscriptions.push(assistant);
}