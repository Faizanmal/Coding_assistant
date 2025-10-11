import * as vscode from 'vscode';

interface EditInfo {
    fileName: string;
    line: number;
    action: 'added' | 'removed' | 'modified' | 'created';
    content: string;
    timestamp: number;
    color: string;
    linesAdded?: number;
    linesRemoved?: number;
    operationId?: string;
    agent?: string;
}

interface BatchOperation {
    id: string;
    files: string[];
    totalChanges: number;
    agent?: string;
    timestamp: number;
    status: 'pending' | 'completed' | 'accepted' | 'rejected';
    description: string;
}

export class EditTracker {
    private static webviewView: vscode.WebviewView | null = null;
    private static edits: EditInfo[] = [];
    private static batchOperations: Map<string, BatchOperation> = new Map();
    private static fileColors: Map<string, string> = new Map();
    private static colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    private static colorIndex = 0;
    private static pendingFiles: Set<string> = new Set();
    private static trackedOperations: Map<string, { fileName: string; linesAdded: number; linesRemoved: number; isNew: boolean }> = new Map();

    static setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
    }

    static activate(context: vscode.ExtensionContext) {
        vscode.workspace.onDidChangeTextDocument(this.onTextDocumentChange, this, context.subscriptions);
        vscode.workspace.onDidCreateFiles(this.onFilesCreated, this, context.subscriptions);
        vscode.workspace.onDidDeleteFiles(this.onFilesDeleted, this, context.subscriptions);
    }

    private static onTextDocumentChange(event: vscode.TextDocumentChangeEvent) {
        const fileName = event.document.fileName.split(/[\\/]/).pop() || 'unknown';
        
        if (!this.fileColors.has(fileName)) {
            this.fileColors.set(fileName, this.colors[this.colorIndex % this.colors.length]);
            this.colorIndex++;
        }

        event.contentChanges.forEach(change => {
            const line = change.range.start.line + 1;
            let action: 'added' | 'removed' | 'modified';
            let content = '';

            if (change.text && change.rangeLength === 0) {
                action = 'added';
                content = change.text.length > 50 ? change.text.substring(0, 50) + '...' : change.text;
            } else if (!change.text && change.rangeLength > 0) {
                action = 'removed';
                content = `${change.rangeLength} characters`;
            } else {
                action = 'modified';
                content = change.text.length > 50 ? change.text.substring(0, 50) + '...' : change.text;
            }

            const edit: EditInfo = {
                fileName,
                line,
                action,
                content: content.replace(/\n/g, '\\n'),
                timestamp: Date.now(),
                color: this.fileColors.get(fileName)!
            };

            this.edits.push(edit);
            this.sendEditUpdate(edit);
        });
    }

    private static onFilesCreated(event: vscode.FileCreateEvent) {
        event.files.forEach(async file => {
            const fileName = file.fsPath.split(/[\/]/).pop() || 'unknown';
            
            if (!this.fileColors.has(fileName)) {
                this.fileColors.set(fileName, this.colors[this.colorIndex % this.colors.length]);
                this.colorIndex++;
            }

            // Read the file to count lines
            let linesCount = 0;
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                linesCount = text.split('\n').length;
            } catch (error) {
                console.warn('Could not read file for line counting:', error);
            }

            const edit: EditInfo = {
                fileName,
                line: 1,
                action: 'created',
                content: `File created with ${linesCount} lines`,
                timestamp: Date.now(),
                color: this.fileColors.get(fileName)!,
                linesAdded: linesCount
            };

            this.edits.push(edit);
            this.trackedOperations.set(fileName, { fileName, linesAdded: linesCount, linesRemoved: 0, isNew: true });
            this.sendEditUpdate(edit);
        });
    }

    private static onFilesDeleted(event: vscode.FileDeleteEvent) {
        event.files.forEach(file => {
            const fileName = file.fsPath.split(/[\/]/).pop() || 'unknown';
            
            const edit: EditInfo = {
                fileName,
                line: 0,
                action: 'removed',
                content: 'File deleted',
                timestamp: Date.now(),
                color: this.fileColors.get(fileName) || '#dc3545'
            };

            this.edits.push(edit);
            this.trackedOperations.delete(fileName);
            this.sendEditUpdate(edit);
        });
    }

    private static sendEditUpdate(edit: EditInfo) {
        if (!this.webviewView) {return;}

        this.webviewView.webview.postMessage({
            type: 'editUpdate',
            edit,
            totalEdits: this.getFileEditCount(edit.fileName)
        });
    }

    private static sendToWebview(message: any) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }

    static getFileEditCount(fileName: string): number {
        return this.edits.filter(e => e.fileName === fileName).length;
    }

    static getAllEdits(): EditInfo[] {
        return this.edits;
    }

    static clearEdits() {
        this.edits = [];
        this.sendToWebview({ type: 'clearEdits' });
    }

    static navigateToEdit(fileName: string, line: number) {
        vscode.workspace.findFiles(`**/${fileName}`).then(files => {
            if (files.length > 0) {
                vscode.window.showTextDocument(files[0]).then(editor => {
                    const position = new vscode.Position(line - 1, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                });
            }
        });
    }

    // Enhanced methods for batch operations and accept/reject functionality
    static startBatchOperation(description: string, agent?: string): string {
        const operationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const batchOp: BatchOperation = {
            id: operationId,
            files: [],
            totalChanges: 0,
            agent,
            timestamp: Date.now(),
            status: 'pending',
            description
        };
        
        this.batchOperations.set(operationId, batchOp);
        this.sendToWebview({
            type: 'batchOperationStarted',
            operation: batchOp
        });
        
        return operationId;
    }

    static finishBatchOperation(operationId: string) {
        const operation = this.batchOperations.get(operationId);
        if (operation) {
            operation.status = 'completed';
            operation.totalChanges = this.getOperationChanges(operationId);
            
            // Send summary with accept/reject options
            this.sendBatchSummary(operation);
        }
    }

    static acceptBatchOperation(operationId: string) {
        const operation = this.batchOperations.get(operationId);
        if (operation) {
            operation.status = 'accepted';
            this.sendToWebview({
                type: 'batchOperationAccepted',
                operationId
            });
            
            // Clear pending status
            operation.files.forEach(fileName => {
                this.pendingFiles.delete(fileName);
            });
        }
    }

    static rejectBatchOperation(operationId: string) {
        const operation = this.batchOperations.get(operationId);
        if (operation) {
            operation.status = 'rejected';
            this.sendToWebview({
                type: 'batchOperationRejected',
                operationId
            });
            
            // TODO: Implement rollback functionality
            vscode.window.showInformationMessage(
                `Operation "${operation.description}" has been rejected. Use Ctrl+Z to undo changes manually.`
            );
        }
    }

    static trackAgentOperation(fileName: string, operationId: string, agent?: string) {
        const operation = this.batchOperations.get(operationId);
        if (operation && !operation.files.includes(fileName)) {
            operation.files.push(fileName);
        }
        
        // Mark edits with operation and agent info
        this.edits.filter(edit => edit.fileName === fileName && !edit.operationId)
            .forEach(edit => {
                edit.operationId = operationId;
                edit.agent = agent;
            });
    }

    static getFileSummary(): Array<{fileName: string; indicator: string; linesAdded: number; linesRemoved: number; isNew: boolean}> {
        const summaries = Array.from(this.trackedOperations.values()).map(op => {
            const indicator = op.isNew ? `N+${op.linesAdded}` : 
                op.linesAdded > 0 && op.linesRemoved > 0 ? `+${op.linesAdded}-${op.linesRemoved}` :
                op.linesAdded > 0 ? `+${op.linesAdded}` :
                op.linesRemoved > 0 ? `-${op.linesRemoved}` : '~';
            
            return {
                fileName: op.fileName,
                indicator,
                linesAdded: op.linesAdded,
                linesRemoved: op.linesRemoved,
                isNew: op.isNew
            };
        });
        
        return summaries;
    }

    private static sendBatchSummary(operation: BatchOperation) {
        const fileSummaries = this.getFileSummary().filter(summary => 
            operation.files.includes(summary.fileName)
        );
        
        this.sendToWebview({
            type: 'batchSummary',
            operation,
            fileSummaries,
            requiresAcceptance: true
        });
    }

    private static getOperationChanges(operationId: string): number {
        return this.edits.filter(edit => edit.operationId === operationId).length;
    }

    static resetTracking() {
        this.trackedOperations.clear();
        this.pendingFiles.clear();
    }

    static updateFileLineCount(fileName: string, linesAdded: number, isNew = false) {
        if (this.trackedOperations.has(fileName)) {
            const tracked = this.trackedOperations.get(fileName)!;
            tracked.linesAdded = linesAdded;
            tracked.isNew = isNew;
        } else {
            this.trackedOperations.set(fileName, { fileName, linesAdded, linesRemoved: 0, isNew });
        }
    }
}