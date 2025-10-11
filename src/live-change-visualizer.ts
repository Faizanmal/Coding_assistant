import * as vscode from 'vscode';
import { UnifiedActivityDashboard, ActivityData } from './unified-activity-dashboard';

export interface DetailedChangeInfo {
    fileName: string;
    filePath: string;
    changeType: 'addition' | 'deletion' | 'modification' | 'creation' | 'rename';
    lineNumber: number;
    content: string;
    timestamp: number;
    agent?: string;
    operationId?: string;
    diffInfo: {
        before: string;
        after: string;
        linesAdded: number;
        linesRemoved: number;
        context: string[];
    };
    syntaxHighlighting?: {
        language: string;
        highlightedContent: string;
    };
}

export interface FileChangeStats {
    fileName: string;
    totalChanges: number;
    linesAdded: number;
    linesRemoved: number;
    lastModified: number;
    agent?: string;
    changeHistory: DetailedChangeInfo[];
}

export interface LiveVisualizationState {
    activeFiles: Map<string, FileChangeStats>;
    recentChanges: DetailedChangeInfo[];
    changesByAgent: Map<string, DetailedChangeInfo[]>;
    totalStats: {
        totalFiles: number;
        totalChanges: number;
        totalLinesAdded: number;
        totalLinesRemoved: number;
        activeAgents: number;
    };
}

export class LiveChangeVisualizer {
    private static instance: LiveChangeVisualizer;
    private webviewView: vscode.WebviewView | null = null;
    private activityDashboard: UnifiedActivityDashboard;
    private visualizationState: LiveVisualizationState;
    private changeWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private readonly MAX_RECENT_CHANGES = 100;
    private readonly MAX_CHANGE_HISTORY = 50;

    private constructor() {
        this.activityDashboard = UnifiedActivityDashboard.getInstance();
        this.visualizationState = {
            activeFiles: new Map(),
            recentChanges: [],
            changesByAgent: new Map(),
            totalStats: {
                totalFiles: 0,
                totalChanges: 0,
                totalLinesAdded: 0,
                totalLinesRemoved: 0,
                activeAgents: 0
            }
        };
        this.initializeFileWatchers();
    }

    public static getInstance(): LiveChangeVisualizer {
        if (!LiveChangeVisualizer.instance) {
            LiveChangeVisualizer.instance = new LiveChangeVisualizer();
        }
        return LiveChangeVisualizer.instance;
    }

    public setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
        this.sendInitialState();
    }

    private initializeFileWatchers(): void {
        // Watch for file changes in workspace
        if (vscode.workspace.workspaceFolders) {
            vscode.workspace.workspaceFolders.forEach(folder => {
                const pattern = new vscode.RelativePattern(folder, '**/*');
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);

                watcher.onDidChange(this.handleFileChange.bind(this));
                watcher.onDidCreate(this.handleFileCreate.bind(this));
                watcher.onDidDelete(this.handleFileDelete.bind(this));

                this.changeWatchers.set(folder.uri.fsPath, watcher);
            });
        }

        // Watch for document changes
        vscode.workspace.onDidChangeTextDocument(this.handleTextDocumentChange.bind(this));
    }

    private async handleFileChange(uri: vscode.Uri): Promise<void> {
        const changeInfo = await this.createChangeInfo(uri, 'modification');
        this.processChange(changeInfo);
    }

    private async handleFileCreate(uri: vscode.Uri): Promise<void> {
        const changeInfo = await this.createChangeInfo(uri, 'creation');
        this.processChange(changeInfo);
    }

    private async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const changeInfo = await this.createChangeInfo(uri, 'deletion');
        this.processChange(changeInfo);
        
        // Remove from active files
        const fileName = this.getFileName(uri);
        this.visualizationState.activeFiles.delete(fileName);
    }

    private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        const uri = event.document.uri;
        const fileName = this.getFileName(uri);

        // Process each change in the document
        event.contentChanges.forEach(change => {
            const changeInfo = this.createDetailedChangeFromDocumentChange(
                uri, 
                change, 
                event.document
            );
            this.processChange(changeInfo);
        });
    }

    private async createChangeInfo(
        uri: vscode.Uri, 
        changeType: DetailedChangeInfo['changeType']
    ): Promise<DetailedChangeInfo> {
        const fileName = this.getFileName(uri);
        const filePath = uri.fsPath;
        
        let content = '';
        let linesAdded = 0;
        let linesRemoved = 0;

        try {
            if (changeType !== 'deletion') {
                const document = await vscode.workspace.openTextDocument(uri);
                content = document.getText();
                linesAdded = document.lineCount;
            }
        } catch (error) {
            console.warn('Could not read file content:', error);
        }

        return {
            fileName,
            filePath,
            changeType,
            lineNumber: 1,
            content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            timestamp: Date.now(),
            diffInfo: {
                before: '',
                after: content.substring(0, 200),
                linesAdded,
                linesRemoved,
                context: []
            },
            syntaxHighlighting: {
                language: this.detectLanguage(fileName),
                highlightedContent: content.substring(0, 200)
            }
        };
    }

    private createDetailedChangeFromDocumentChange(
        uri: vscode.Uri,
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): DetailedChangeInfo {
        const fileName = this.getFileName(uri);
        const filePath = uri.fsPath;
        const lineNumber = change.range.start.line + 1;

        let changeType: DetailedChangeInfo['changeType'];
        let linesAdded = 0;
        let linesRemoved = 0;

        if (change.text && change.rangeLength === 0) {
            changeType = 'addition';
            linesAdded = (change.text.match(/\n/g) || []).length;
        } else if (!change.text && change.rangeLength > 0) {
            changeType = 'deletion';
            linesRemoved = change.range.end.line - change.range.start.line + 1;
        } else {
            changeType = 'modification';
            const oldLines = change.range.end.line - change.range.start.line + 1;
            const newLines = (change.text.match(/\n/g) || []).length + 1;
            linesAdded = Math.max(0, newLines - oldLines);
            linesRemoved = Math.max(0, oldLines - newLines);
        }

        // Get context lines
        const contextLines: string[] = [];
        const startLine = Math.max(0, lineNumber - 3);
        const endLine = Math.min(document.lineCount - 1, lineNumber + 3);
        
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            contextLines.push(`${i + 1}: ${line.text}`);
        }

        return {
            fileName,
            filePath,
            changeType,
            lineNumber,
            content: change.text.length > 100 ? 
                change.text.substring(0, 100) + '...' : 
                change.text,
            timestamp: Date.now(),
            diffInfo: {
                before: '', // Could be enhanced to show actual before state
                after: change.text,
                linesAdded,
                linesRemoved,
                context: contextLines
            },
            syntaxHighlighting: {
                language: this.detectLanguage(fileName),
                highlightedContent: change.text
            }
        };
    }

    private processChange(changeInfo: DetailedChangeInfo): void {
        // Update recent changes
        this.visualizationState.recentChanges.unshift(changeInfo);
        if (this.visualizationState.recentChanges.length > this.MAX_RECENT_CHANGES) {
            this.visualizationState.recentChanges = this.visualizationState.recentChanges.slice(0, this.MAX_RECENT_CHANGES);
        }

        // Update or create file stats
        if (!this.visualizationState.activeFiles.has(changeInfo.fileName)) {
            this.visualizationState.activeFiles.set(changeInfo.fileName, {
                fileName: changeInfo.fileName,
                totalChanges: 0,
                linesAdded: 0,
                linesRemoved: 0,
                lastModified: changeInfo.timestamp,
                changeHistory: []
            });
        }

        const fileStats = this.visualizationState.activeFiles.get(changeInfo.fileName)!;
        fileStats.totalChanges++;
        fileStats.linesAdded += changeInfo.diffInfo.linesAdded;
        fileStats.linesRemoved += changeInfo.diffInfo.linesRemoved;
        fileStats.lastModified = changeInfo.timestamp;
        fileStats.agent = changeInfo.agent;

        // Add to change history
        fileStats.changeHistory.unshift(changeInfo);
        if (fileStats.changeHistory.length > this.MAX_CHANGE_HISTORY) {
            fileStats.changeHistory = fileStats.changeHistory.slice(0, this.MAX_CHANGE_HISTORY);
        }

        // Update agent-specific changes
        if (changeInfo.agent) {
            if (!this.visualizationState.changesByAgent.has(changeInfo.agent)) {
                this.visualizationState.changesByAgent.set(changeInfo.agent, []);
            }
            const agentChanges = this.visualizationState.changesByAgent.get(changeInfo.agent)!;
            agentChanges.unshift(changeInfo);
            if (agentChanges.length > this.MAX_RECENT_CHANGES) {
                this.visualizationState.changesByAgent.set(
                    changeInfo.agent, 
                    agentChanges.slice(0, this.MAX_RECENT_CHANGES)
                );
            }
        }

        // Update total stats
        this.updateTotalStats();

        // Log activity
        this.logChangeActivity(changeInfo);

        // Send update to webview
        this.sendChangeUpdate(changeInfo);
    }

    private updateTotalStats(): void {
        this.visualizationState.totalStats = {
            totalFiles: this.visualizationState.activeFiles.size,
            totalChanges: Array.from(this.visualizationState.activeFiles.values())
                .reduce((sum, file) => sum + file.totalChanges, 0),
            totalLinesAdded: Array.from(this.visualizationState.activeFiles.values())
                .reduce((sum, file) => sum + file.linesAdded, 0),
            totalLinesRemoved: Array.from(this.visualizationState.activeFiles.values())
                .reduce((sum, file) => sum + file.linesRemoved, 0),
            activeAgents: this.visualizationState.changesByAgent.size
        };
    }

    private logChangeActivity(changeInfo: DetailedChangeInfo): void {
        const activity: ActivityData = {
            timestamp: changeInfo.timestamp,
            type: 'file',
            source: changeInfo.agent || 'User',
            action: changeInfo.changeType,
            details: this.formatChangeDetails(changeInfo),
            status: 'completed',
            metadata: {
                fileName: changeInfo.fileName,
                linesAdded: changeInfo.diffInfo.linesAdded,
                linesRemoved: changeInfo.diffInfo.linesRemoved,
                lineNumber: changeInfo.lineNumber,
                changeType: changeInfo.changeType
            }
        };

        this.activityDashboard.logActivity(activity);
    }

    private formatChangeDetails(changeInfo: DetailedChangeInfo): string {
        const prefix = changeInfo.diffInfo.linesAdded > 0 ? '+' : 
                      changeInfo.diffInfo.linesRemoved > 0 ? '-' : '~';
        
        return `${prefix} ${changeInfo.fileName}:${changeInfo.lineNumber} (${changeInfo.changeType})`;
    }

    private detectLanguage(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
            'ts': 'typescript',
            'js': 'javascript',
            'jsx': 'jsx',
            'tsx': 'tsx',
            'py': 'python',
            'java': 'java',
            'cs': 'csharp',
            'cpp': 'cpp',
            'c': 'c',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'sql': 'sql'
        };
        return languageMap[ext] || 'plaintext';
    }

    private getFileName(uri: vscode.Uri): string {
        return uri.fsPath.split(/[\\\/]/).pop() || 'unknown';
    }

    private sendInitialState(): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.postMessage({
            type: 'changeVisualizerInit',
            data: {
                state: this.visualizationState,
                recentChanges: this.visualizationState.recentChanges.slice(0, 20)
            }
        });
    }

    private sendChangeUpdate(changeInfo: DetailedChangeInfo): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.postMessage({
            type: 'changeUpdate',
            data: {
                change: changeInfo,
                updatedStats: this.visualizationState.totalStats,
                fileStats: this.visualizationState.activeFiles.get(changeInfo.fileName)
            }
        });
    }

    /**
     * Public API methods
     */
    public getFileChangeStats(fileName: string): FileChangeStats | undefined {
        return this.visualizationState.activeFiles.get(fileName);
    }

    public getRecentChanges(limit: number = 20): DetailedChangeInfo[] {
        return this.visualizationState.recentChanges.slice(0, limit);
    }

    public getAgentChanges(agentId: string): DetailedChangeInfo[] {
        return this.visualizationState.changesByAgent.get(agentId) || [];
    }

    public getTotalStats(): typeof this.visualizationState.totalStats {
        return { ...this.visualizationState.totalStats };
    }

    public clearChangeHistory(): void {
        this.visualizationState = {
            activeFiles: new Map(),
            recentChanges: [],
            changesByAgent: new Map(),
            totalStats: {
                totalFiles: 0,
                totalChanges: 0,
                totalLinesAdded: 0,
                totalLinesRemoved: 0,
                activeAgents: 0
            }
        };
        
        this.sendInitialState();
    }

    public setAgentForChanges(agentId: string, operationId: string): void {
        // Mark recent changes as belonging to specific agent
        const recentChanges = this.visualizationState.recentChanges
            .filter(change => !change.agent && change.operationId === operationId);
        
        recentChanges.forEach(change => {
            change.agent = agentId;
        });
        
        // Update agent-specific changes
        if (recentChanges.length > 0) {
            if (!this.visualizationState.changesByAgent.has(agentId)) {
                this.visualizationState.changesByAgent.set(agentId, []);
            }
            const agentChanges = this.visualizationState.changesByAgent.get(agentId)!;
            agentChanges.unshift(...recentChanges);
        }
    }

    public dispose(): void {
        // Clean up file watchers
        this.changeWatchers.forEach(watcher => watcher.dispose());
        this.changeWatchers.clear();
    }
}