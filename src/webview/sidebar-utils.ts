// Shared utility functions for sidebar operations
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { ChatHistory } from './types';

export class SidebarUtils {
    /**
     * Execute shell command with timeout and proper error handling
     */
    public static async executeShellCommand(command: string): Promise<{output: string, exitCode: number}> {
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd' : 'bash';
            const shellFlag = isWindows ? '/c' : '-c';
            
            const child = spawn(shell, [shellFlag, command], {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                shell: true
            });
            
            let output = '';
            let errorOutput = '';
            
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            child.on('close', (code) => {
                const finalOutput = output + (errorOutput ? `\n\nErrors:\n${errorOutput}` : '');
                resolve({ output: finalOutput || 'Command completed with no output', exitCode: code || 0 });
            });
            
            child.on('error', (error) => {
                reject(new Error(`Failed to execute command: ${error.message}`));
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                child.kill();
                reject(new Error('Command timed out after 30 seconds'));
            }, 30000);
        });
    }

    /**
     * Create folder in workspace root
     */
    public static async createFolderInRoot(folderName: string): Promise<void> {
        const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!wsPath) {
            throw new Error("No workspace open");
        }
        
        const folderUri = vscode.Uri.joinPath(vscode.Uri.file(wsPath), folderName);
        await vscode.workspace.fs.createDirectory(folderUri);
    }

    /**
     * Handle CLI-style commands
     */
    public static async handleCLICommand(prompt: string): Promise<string | null> {
        // Basic pattern matching for folder creation
        const folderMatch = prompt.match(/create\s+(?:a\s+)?folder\s+(?:named\s+)?['"]?([\w\-\/\\]+)['"]?\s+in\s+(?:the\s+)?root/i);
        if (folderMatch) {
            const folderName = folderMatch[1];
            try {
                await this.createFolderInRoot(folderName);
                return `📁 Folder '${folderName}' created in root directory.`;
            } catch (err: any) {
                return `❌ Failed to create folder '${folderName}': ${err.message}`;
            }
        }

        return null; // Not a CLI-style command
    }

    /**
     * Sanitize content for safe display in webview
     */
    public static sanitizeContent(content: string): string {
        return content.replace(/`/g, '\u0060');
    }

    /**
     * Format duration in milliseconds to human readable format
     */
    public static formatDuration(milliseconds: number): string {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Check if prompt is a project-related command
     */
    public static isProjectCommand(prompt: string): boolean {
        const projectKeywords = [
            'show', 'open', 'display', 'find', 'search', 'locate',
            'edit', 'modify', 'change', 'update', 'create', 'make',
            'generate', 'add', 'delete', 'remove', 'analyze',
            'summary', 'overview', 'structure', 'file', 'project'
        ];
        
        const lowerPrompt = prompt.toLowerCase();
        return projectKeywords.some(keyword => lowerPrompt.includes(keyword)) &&
               (lowerPrompt.includes('file') || lowerPrompt.includes('project') || 
                Boolean(lowerPrompt.match(/\.[a-zA-Z0-9]+\b/))); // Contains file extension
    }

    /**
     * Check if prompt is a shell command
     */
    public static isShellCommand(prompt: string): boolean {
        return /^(run|execute|cmd|command|terminal)\s+/i.test(prompt);
    }

    /**
     * Extract command from shell prompt
     */
    public static extractShellCommand(prompt: string): string {
        return prompt.replace(/^(run|execute|cmd|command|terminal)\s+/i, '').trim();
    }

    /**
     * Generate project analysis prompt
     */
    public static generateProjectAnalysisPrompt(projectContext: string): string {
        return `Analyze this project structure and provide insights:

${projectContext}

Provide:
1. 📊 **Project Type**: What kind of project this is
2. 🛠️ **Tech Stack**: Technologies and frameworks used
3. 📁 **File Structure**: Current organization
4. ✅ **Strengths**: What's well implemented
5. ⚠️ **Issues**: Potential problems or missing elements
6. 💡 **Recommendations**: Suggested improvements

Format as markdown with clear sections.`;
    }

    /**
     * Generate file suggestions prompt
     */
    public static generateFileSuggestionsPrompt(projectContext: string): string {
        return `Based on this project structure, suggest missing files that should be added:

${projectContext}

Analyze what's missing and suggest files in this format:

**Essential Missing Files:**
- filename.ext: description of what it should contain

**Recommended Files:**
- filename.ext: description of what it should contain

**Optional Enhancements:**
- filename.ext: description of what it should contain

For each suggestion, provide the exact command to generate it:
'generate files: filename.ext:detailed description'

Focus on:
- Configuration files
- Documentation files
- Security files
- Testing files
- Deployment files
- Missing core functionality files`;
    }

    /**
     * Validate chat history structure
     */
    public static validateChatHistory(history: any): history is ChatHistory {
        if (!Array.isArray(history)) {return false;}
        
        return history.every(message => 
            typeof message === 'object' &&
            typeof message.role === 'string' &&
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string'
        );
    }

    /**
     * Get default chat history
     */
    public static getDefaultChatHistory(): ChatHistory {
        return [{
            role: 'assistant',
            content: "👋 Hi there! How can I help you today?"
        }];
    }

    /**
     * Check if string contains markdown code blocks
     */
    public static hasCodeBlocks(content: string): boolean {
        return /```[\s\S]*?```/.test(content);
    }

    /**
     * Extract file extensions from text
     */
    public static extractFileExtensions(text: string): string[] {
        const extensionRegex = /\.([a-zA-Z0-9]+)\b/g;
        const matches = text.match(extensionRegex);
        return matches ? [...new Set(matches.map(match => match.toLowerCase()))] : [];
    }

    /**
     * Truncate text to specified length with ellipsis
     */
    public static truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {return text;}
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Generate timestamp string
     */
    public static getTimestamp(): string {
        return new Date().toISOString();
    }

    /**
     * Check if workspace is available
     */
    public static hasWorkspace(): boolean {
        return Boolean(vscode.workspace.workspaceFolders?.[0]);
    }

    /**
     * Get workspace path
     */
    public static getWorkspacePath(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Show error message with optional action
     */
    public static async showError(message: string, action?: string): Promise<string | undefined> {
        if (action) {
            return await vscode.window.showErrorMessage(message, action);
        } else {
            vscode.window.showErrorMessage(message);
            return undefined;
        }
    }

    /**
     * Show success message
     */
    public static showSuccess(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    /**
     * Show warning message with confirmation
     */
    public static async showWarning(message: string, confirmText: string = 'Yes'): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            confirmText, 'No'
        );
        return result === confirmText;
    }

    /**
     * Deep clone object
     */
    public static deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Debounce function calls
     */
    public static debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let timeout: NodeJS.Timeout;
        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    /**
     * Get file size in human readable format
     */
    public static formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) {return '0 Bytes';}
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}