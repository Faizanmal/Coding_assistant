import * as vscode from 'vscode';
import { MultiAgentGenerator } from './multiagentgenerator';
import { NLPFileGenerator } from './nlpfilegenerator';

interface FileEditTask {
    fileName: string;
    operation: 'create' | 'edit';
    prompt: string;
    language: string;
    agent?: any;
}

interface LiveProgress {
    fileName: string;
    operation: 'create' | 'edit';
    linesProcessed: number;
    totalLines: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    agent?: string;
}

export class MultiAgentFileEditor {
    private static webviewView: vscode.WebviewView | null = null;
    private static activeOperations: Map<string, LiveProgress> = new Map();

    static setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
    }

    static async processMultiAgentRequest(prompt: string): Promise<string> {
        try {
            // Parse the request to determine files to create/edit
            const tasks = await this.parseFileEditRequest(prompt);
            
            if (tasks.length === 0) {
                return "❌ No valid file operations found in request";
            }

            // Initialize progress tracking
            this.initializeProgress(tasks);
            
            // Start processing with live updates
            await this.processTasksWithLiveUpdates(tasks);
            
            return `✅ Multi-agent operation completed for ${tasks.length} files`;
            
        } catch (error: any) {
            return `❌ Multi-agent operation failed: ${error.message}`;
        }
    }

    private static async parseFileEditRequest(prompt: string): Promise<FileEditTask[]> {
        const tasks: FileEditTask[] = [];
        
        // Check for multi-file generation patterns
        const multiFileRequests = this.parseMultiFilePrompt(prompt);
        if (multiFileRequests) {
            tasks.push(...multiFileRequests.map(req => ({
                fileName: req.fileName,
                operation: 'create' as const,
                prompt: req.prompt,
                language: this.detectLanguage(req.fileName)
            })));
        }
        
        // Check for NLP file requests
        if (NLPFileGenerator.isNLPFileRequest(prompt)) {
            const nlpRequests = await NLPFileGenerator.parseNaturalLanguage(prompt);
            if (nlpRequests) {
                tasks.push(...nlpRequests.map((req: any) => ({
                    fileName: req.fileName,
                    operation: 'create' as const,
                    prompt: req.prompt,
                    language: this.detectLanguage(req.fileName)
                })));
            }
        }
        
        // Check for edit operations on existing files
        const editMatches = prompt.match(/edit\s+(?:file\s+)?([^\s,]+)(?:\s*:\s*(.+?))?(?:,|$)/gi);
        if (editMatches) {
            for (const match of editMatches) {
                const parts = match.match(/edit\s+(?:file\s+)?([^\s,]+)(?:\s*:\s*(.+?))?/i);
                if (parts) {
                    const fileName = parts[1];
                    const editPrompt = parts[2] || 'Improve this file';
                    tasks.push({
                        fileName,
                        operation: 'edit',
                        prompt: editPrompt,
                        language: this.detectLanguage(fileName)
                    });
                }
            }
        }
        
        return tasks;
    }

    private static parseMultiFilePrompt(prompt: string): any[] | null {
        const patterns = [
            /generate\s+files?\s*:\s*(.+)/i,
            /create\s+files?\s*:\s*(.+)/i,
            /make\s+files?\s*:\s*(.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match) {
                const fileSpecs = match[1].split(',').map(spec => {
                    const [fileName, ...promptParts] = spec.split(':');
                    return {
                        fileName: fileName.trim(),
                        prompt: promptParts.join(':').trim() || 'Generate appropriate content'
                    };
                });
                return fileSpecs;
            }
        }
        return null;
    }

    private static detectLanguage(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const langMap: { [key: string]: string } = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python',
            'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
            'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust',
            'html': 'html', 'css': 'css', 'json': 'json', 'xml': 'xml',
            'yml': 'yaml', 'yaml': 'yaml', 'md': 'markdown'
        };
        return langMap[ext || ''] || 'text';
    }

    private static initializeProgress(tasks: FileEditTask[]) {
        this.activeOperations.clear();
        
        for (const task of tasks) {
            this.activeOperations.set(task.fileName, {
                fileName: task.fileName,
                operation: task.operation,
                linesProcessed: 0,
                totalLines: task.operation === 'edit' ? this.getFileLineCount(task.fileName) : 0,
                status: 'pending'
            });
        }
        
        this.sendProgressUpdate();
    }

    private static getFileLineCount(fileName: string): number {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {return 0;}
            
            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
            // This is a simplified version - in practice you'd read the file
            return 50; // Default estimate
        } catch {
            return 0;
        }
    }

    private static async processTasksWithLiveUpdates(tasks: FileEditTask[]) {
        // Assign agents to tasks - convert to compatible type
        const assignedTasks = MultiAgentGenerator.assignAgents(tasks.map(task => ({
            fileName: task.fileName,
            prompt: task.prompt,
            language: task.language
        })));
        
        // Process tasks with live progress updates
        await Promise.allSettled(
            tasks.map(async (task: FileEditTask, index: number) => {
                // Add agent info from assigned tasks if available
                if (assignedTasks[index]) {
                    task.agent = assignedTasks[index].agent;
                }
                await this.processTaskWithProgress(task, index);
            })
        );
    }

    private static async processTaskWithProgress(task: FileEditTask, index: number) {
        const progress = this.activeOperations.get(task.fileName);
        if (!progress) {return;}
        
        try {
            // Update status to processing
            progress.status = 'processing';
            progress.agent = task.agent?.name || 'General Agent';
            this.sendProgressUpdate();
            
            if (task.operation === 'create') {
                await this.createFileWithProgress(task, progress);
            } else {
                await this.editFileWithProgress(task, progress);
            }
            
            progress.status = 'completed';
            this.sendProgressUpdate();
            
        } catch (error) {
            progress.status = 'error';
            this.sendProgressUpdate();
            throw error;
        }
    }

    private static async createFileWithProgress(task: FileEditTask, progress: LiveProgress) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {throw new Error('No workspace');}

        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, task.fileName);
        
        // Send generating status
        this.sendFileStatus(task.fileName, 'generating');
        
        const content = await this.generateContentWithProgress(task, progress);
        
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));
        
        const lines = content.split('\n');
        progress.totalLines = lines.length;
        progress.linesProcessed = lines.length;
        
        // Send applied status
        this.sendFileStatus(task.fileName, 'applied', lines.length);
        this.sendProgressUpdate();
    }

    private static async editFileWithProgress(task: FileEditTask, progress: LiveProgress) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {throw new Error('No workspace');}

        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, task.fileName);
        
        try {
            const existingContent = await vscode.workspace.fs.readFile(filePath);
            const existingText = existingContent.toString();
            const existingLines = existingText.split('\n');
            
            progress.totalLines = existingLines.length;
            
            // Send generating status
            this.sendFileStatus(task.fileName, 'generating');
            
            const editedContent = await this.generateEditedContentWithProgress(task, existingText, progress);
            
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(editedContent, 'utf8'));
            
            const newLines = editedContent.split('\n');
            const linesChanged = Math.abs(newLines.length - existingLines.length);
            progress.totalLines = newLines.length;
            progress.linesProcessed = newLines.length;
            
            // Send applied status
            this.sendFileStatus(task.fileName, 'applied', linesChanged);
            this.sendProgressUpdate();
            
        } catch (error) {
            await this.createFileWithProgress(task, progress);
        }
    }

    private static async generateContentWithProgress(task: FileEditTask, progress: LiveProgress): Promise<string> {
        // Simulate content generation with progress updates
        const { generateCode } = await import('./codegenerator');
        
        // const enhancedPrompt = `Generate ${task.language} code for ${task.fileName}:\n${task.prompt}\n\nProvide clean, well-structured code with appropriate comments.`;
        const enhancedPrompt = `Generate ${task.language} code for ${task.fileName} with operation ${task.operation}:\n${task.prompt}\n\nProvide clean, well-structured code with appropriate comments.`;
        // Simulate progressive generation
        for (let i = 0; i <= 100; i += 20) {
            progress.linesProcessed = Math.floor((progress.totalLines || 50) * (i / 100));
            this.sendProgressUpdate();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const content = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
        return content;
    }

    private static async generateEditedContentWithProgress(task: FileEditTask, existingContent: string, progress: LiveProgress): Promise<string> {
        const { generateCode } = await import('./codegenerator');
        
        // const enhancedPrompt = `Edit this ${task.language} code according to the request: "${task.prompt}"\n\nExisting code:\n${existingContent}\n\nReturn the complete edited file.`;
            const enhancedPrompt = `Edit this ${task.language} code for ${task.fileName} with operation ${task.operation} according to the request: "${task.prompt}"

Existing code:
${existingContent}

Return the complete edited file.`;    
        // Simulate progressive editing
        const totalLines = progress.totalLines;
        for (let i = 0; i <= 100; i += 25) {
            progress.linesProcessed = Math.floor(totalLines * (i / 100));
            this.sendProgressUpdate();
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const editedContent = await generateCode(enhancedPrompt,'llama-3.3-70b-versatile');
        return editedContent;
    }

    private static sendProgressUpdate() {
        if (!this.webviewView) {return;}
        
        const progressData = Array.from(this.activeOperations.values());
        
        this.webviewView.webview.postMessage({
            type: 'multiAgentProgress',
            data: progressData
        });
    }

    private static sendToWebview(message: any) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }

    static sendFileStatus(fileName: string, status: 'generating' | 'applied', linesChanged?: number) {
        let message = status === 'generating' 
            ? `${fileName} Generating`
            : `${fileName} +${linesChanged || 0} M Applied`;
        
        this.sendToWebview({
            type: 'fileStatus',
            message
        });
    }

    static isMultiAgentRequest(prompt: string): boolean {
        const patterns = [
            /multi.?agent.*(?:create|edit|generate)/i,
            /(?:create|edit|generate).*multi.?agent/i,
            /agents?.*(?:create|edit|generate).*files?/i,
            /(?:create|edit|generate).*files?.*agents?/i,
            /specialized.*agents?/i,
            /multi.?file.*edit/i,
            /edit.*multiple.*files?/i
        ];
        
        return patterns.some(pattern => pattern.test(prompt));
    }

    static getProgressSummary(): string {
        const operations = Array.from(this.activeOperations.values());
        if (operations.length === 0) {return '';}
        
        const completed = operations.filter(op => op.status === 'completed').length;
        const processing = operations.filter(op => op.status === 'processing').length;
        const errors = operations.filter(op => op.status === 'error').length;
        
        let summary = `📊 **Multi-Agent Progress:** ${completed}/${operations.length} completed`;
        
        if (processing > 0) {
            summary += `, ${processing} processing`;
        }
        
        if (errors > 0) {
            summary += `, ${errors} errors`;
        }
        
        // Add line count details
        const totalLinesProcessed = operations.reduce((sum, op) => sum + op.linesProcessed, 0);
        const totalLines = operations.reduce((sum, op) => sum + op.totalLines, 0);
        
        if (totalLines > 0) {
            summary += `\n📝 **Lines:** ${totalLinesProcessed}/${totalLines} processed`;
        }
        
        return summary;
    }
}