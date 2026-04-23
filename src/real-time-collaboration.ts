import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import * as crypto from 'crypto';

/**
 * Real-time Collaboration System
 * Live coding sessions, shared workspaces, conflict resolution, and presence indicators
 */

export interface CollaborationUser {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: 'owner' | 'editor' | 'viewer';
    cursor?: {
        file: string;
        line: number;
        column: number;
    };
    selection?: {
        file: string;
        start: { line: number; column: number };
        end: { line: number; column: number };
    };
    lastSeen: Date;
    isOnline: boolean;
}

export interface CollaborationSession {
    id: string;
    name: string;
    workspaceId: string;
    owner: string;
    participants: CollaborationUser[];
    startTime: Date;
    endTime?: Date;
    settings: {
        allowEditing: boolean;
        allowFileCreation: boolean;
        allowFileDeletion: boolean;
        requireApproval: boolean;
        maxParticipants: number;
    };
    sharedFiles: string[];
    chatHistory: ChatMessage[];
}

export interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
    type: 'text' | 'system' | 'code_snippet' | 'file_reference';
    metadata?: {
        file?: string;
        line?: number;
        code?: string;
        language?: string;
    };
}

export interface OperationalTransform {
    id: string;
    userId: string;
    sessionId: string;
    timestamp: Date;
    operation: {
        type: 'insert' | 'delete' | 'retain';
        position: number;
        content?: string;
        length?: number;
    };
    file: string;
    version: number;
}

export interface ConflictResolution {
    id: string;
    file: string;
    conflicts: {
        base: string;
        ours: string;
        theirs: string;
        resolved?: string;
        strategy: 'manual' | 'auto_ours' | 'auto_theirs' | 'auto_merge';
    }[];
    participants: string[];
    status: 'pending' | 'resolved' | 'escalated';
    createdAt: Date;
    resolvedAt?: Date;
}

export class RealTimeCollaborationSystem {
    private sessions: Map<string, CollaborationSession> = new Map();
    private activeSession?: CollaborationSession;
    private websocket?: WebSocket;
    private context: vscode.ExtensionContext;
    private currentUser?: CollaborationUser;
    private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private conflictResolver?: ConflictResolutionManager;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.conflictResolver = new ConflictResolutionManager();
        this.initializeDecorations();
        this.setupEventHandlers();
    }

    /**
     * Start a new collaboration session
     */
    async startCollaborationSession(
        name: string,
        settings: CollaborationSession['settings']
    ): Promise<CollaborationSession> {
        const sessionId = crypto.randomUUID();
        const workspaceId = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'unknown';
        
        if (!this.currentUser) {
            await this.initializeCurrentUser();
        }

        const session: CollaborationSession = {
            id: sessionId,
            name,
            workspaceId,
            owner: this.currentUser!.id,
            participants: [this.currentUser!],
            startTime: new Date(),
            settings,
            sharedFiles: [],
            chatHistory: []
        };

        this.sessions.set(sessionId, session);
        this.activeSession = session;

        // Connect to collaboration server
        await this.connectToCollaborationServer(sessionId);

        // Show collaboration panel
        await this.showCollaborationPanel();

        vscode.window.showInformationMessage(`🎯 Collaboration session "${name}" started!`);
        
        return session;
    }

    /**
     * Join an existing collaboration session
     */
    async joinCollaborationSession(sessionId: string, inviteCode?: string): Promise<void> {
        if (!this.currentUser) {
            await this.initializeCurrentUser();
        }

        try {
            // Connect to collaboration server
            await this.connectToCollaborationServer(sessionId);

            // Request to join session
            this.sendMessage({
                type: 'join_session',
                sessionId,
                user: this.currentUser,
                inviteCode
            });

            vscode.window.showInformationMessage(`🎯 Joining collaboration session...`);
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to join session: ${error.message}`);
        }
    }

    /**
     * Share current file with collaborators
     */
    async shareFile(filePath: string): Promise<void> {
        if (!this.activeSession) {
            vscode.window.showErrorMessage('No active collaboration session');
            return;
        }

        if (!this.activeSession.sharedFiles.includes(filePath)) {
            this.activeSession.sharedFiles.push(filePath);
        }

        // Send file content to collaborators
        const document = await vscode.workspace.openTextDocument(filePath);
        this.sendMessage({
            type: 'share_file',
            sessionId: this.activeSession.id,
            file: {
                path: filePath,
                content: document.getText(),
                version: 1
            }
        });

        vscode.window.showInformationMessage(`📄 File shared: ${filePath}`);
    }

    /**
     * Send chat message
     */
    async sendChatMessage(message: string, type: ChatMessage['type'] = 'text', metadata?: ChatMessage['metadata']): Promise<void> {
        if (!this.activeSession || !this.currentUser) {
            return;
        }

        const chatMessage: ChatMessage = {
            id: crypto.randomUUID(),
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            message,
            timestamp: new Date(),
            type,
            metadata
        };

        this.activeSession.chatHistory.push(chatMessage);

        this.sendMessage({
            type: 'chat_message',
            sessionId: this.activeSession.id,
            message: chatMessage
        });
    }

    /**
     * Handle document changes for operational transformation
     */
    private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
        if (!this.activeSession || !this.isSharedFile(event.document.uri.fsPath)) {
            return;
        }

        for (const change of event.contentChanges) {
            const operation: OperationalTransform = {
                id: crypto.randomUUID(),
                userId: this.currentUser!.id,
                sessionId: this.activeSession.id,
                timestamp: new Date(),
                operation: {
                    type: change.text ? 'insert' : 'delete',
                    position: event.document.offsetAt(change.range.start),
                    content: change.text,
                    length: change.rangeLength
                },
                file: event.document.uri.fsPath,
                version: 1 // Would increment with each change
            };

            this.sendMessage({
                type: 'operation',
                sessionId: this.activeSession.id,
                operation
            });
        }
    }

    /**
     * Handle cursor position changes
     */
    private async handleCursorChange(editor: vscode.TextEditor): Promise<void> {
        if (!this.activeSession || !this.currentUser) {
            return;
        }

        const position = editor.selection.active;
        this.currentUser.cursor = {
            file: editor.document.uri.fsPath,
            line: position.line,
            column: position.character
        };

        if (editor.selection.isEmpty) {
            delete this.currentUser.selection;
        } else {
            this.currentUser.selection = {
                file: editor.document.uri.fsPath,
                start: {
                    line: editor.selection.start.line,
                    column: editor.selection.start.character
                },
                end: {
                    line: editor.selection.end.line,
                    column: editor.selection.end.character
                }
            };
        }

        this.sendMessage({
            type: 'cursor_update',
            sessionId: this.activeSession.id,
            user: this.currentUser
        });
    }

    /**
     * Apply remote operation using operational transformation
     */
    private async applyRemoteOperation(operation: OperationalTransform): Promise<void> {
        const document = vscode.workspace.textDocuments.find(doc => 
            doc.uri.fsPath === operation.file
        );

        if (!document) {
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        
        switch (operation.operation.type) {
            case 'insert':
                const insertPosition = document.positionAt(operation.operation.position);
                edit.insert(document.uri, insertPosition, operation.operation.content || '');
                break;
            
            case 'delete':
                const deleteStart = document.positionAt(operation.operation.position);
                const deleteEnd = document.positionAt(
                    operation.operation.position + (operation.operation.length || 0)
                );
                edit.delete(document.uri, new vscode.Range(deleteStart, deleteEnd));
                break;
        }

        await vscode.workspace.applyEdit(edit);
    }

    /**
     * Update presence indicators for collaborators
     */
    private updatePresenceIndicators(users: CollaborationUser[]): void {
        // Clear existing decorations
        this.decorationTypes.forEach(decoration => decoration.dispose());
        this.decorationTypes.clear();

        // Create new decorations for each user
        users.forEach(user => {
            if (user.id === this.currentUser?.id || !user.cursor) {
                return;
            }

            const decoration = vscode.window.createTextEditorDecorationType({
                backgroundColor: this.getUserColor(user.id),
                borderRadius: '2px',
                after: {
                    contentText: ` ${user.name}`,
                    color: 'white',
                    backgroundColor: this.getUserColor(user.id),
                    margin: '0 0 0 4px'
                }
            });

            this.decorationTypes.set(user.id, decoration);

            // Apply decoration to active editor
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.fsPath === user.cursor.file) {
                const position = new vscode.Position(user.cursor.line, user.cursor.column);
                const range = new vscode.Range(position, position);
                editor.setDecorations(decoration, [range]);
            }
        });
    }

    /**
     * Show collaboration panel
     */
    async showCollaborationPanel(): Promise<void> {
        if (!this.activeSession) {
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'collaborationPanel',
            `Collaboration: ${this.activeSession.name}`,
            vscode.ViewColumn.Beside,
            { 
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateCollaborationPanelHTML();

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.sendChatMessage(message.text);
                    panel.webview.postMessage({
                        command: 'updateChat',
                        messages: this.activeSession?.chatHistory || []
                    });
                    break;
                case 'inviteUser':
                    await this.inviteUser(message.email);
                    break;
                case 'shareCurrentFile':
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        await this.shareFile(activeEditor.document.uri.fsPath);
                    }
                    break;
                case 'endSession':
                    await this.endCollaborationSession();
                    panel.dispose();
                    break;
            }
        });

        // Update panel with real-time data
        setInterval(() => {
            if (this.activeSession) {
                panel.webview.postMessage({
                    command: 'updatePresence',
                    users: this.activeSession.participants
                });
            }
        }, 2000);
    }

    /**
     * Generate collaboration panel HTML
     */
    private generateCollaborationPanelHTML(): string {
        if (!this.activeSession) {
            return '<html><body>No active session</body></html>';
        }

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            background: #252526;
            padding: 15px;
            border-bottom: 1px solid #3c3c3c;
        }
        .session-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .participants {
            background: #252526;
            padding: 15px;
            border-bottom: 1px solid #3c3c3c;
        }
        .participant {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 4px;
        }
        .participant.online {
            background: #2d4a3e;
        }
        .participant.offline {
            background: #4a2d2d;
            opacity: 0.7;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-online { background: #4CAF50; }
        .status-offline { background: #ff6b6b; }
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .chat-messages {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
        }
        .message {
            margin-bottom: 10px;
            padding: 8px;
            border-radius: 4px;
        }
        .message.own {
            background: #0078d4;
            margin-left: 20px;
        }
        .message.other {
            background: #252526;
            margin-right: 20px;
        }
        .message.system {
            background: #333;
            font-style: italic;
            text-align: center;
        }
        .message-header {
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
        }
        .chat-input {
            background: #252526;
            border-top: 1px solid #3c3c3c;
            padding: 15px;
            display: flex;
            gap: 10px;
        }
        .chat-input input {
            flex: 1;
            background: #1e1e1e;
            border: 1px solid #3c3c3c;
            color: #d4d4d4;
            padding: 8px;
            border-radius: 4px;
        }
        .btn {
            background: #0078d4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn:hover {
            background: #106ebe;
        }
        .btn.secondary {
            background: #333;
        }
        .btn.danger {
            background: #ff6b6b;
        }
        .shared-files {
            background: #252526;
            padding: 15px;
            border-bottom: 1px solid #3c3c3c;
        }
        .file-item {
            padding: 4px 8px;
            background: #1e1e1e;
            margin-bottom: 4px;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="session-info">
            <h3>🎯 ${this.activeSession.name}</h3>
            <div>
                <button class="btn secondary" onclick="inviteUser()">Invite</button>
                <button class="btn secondary" onclick="shareCurrentFile()">Share File</button>
                <button class="btn danger" onclick="endSession()">End Session</button>
            </div>
        </div>
    </div>

    <div class="participants">
        <h4>👥 Participants (${this.activeSession.participants.length})</h4>
        <div id="participantsList">
            ${this.activeSession.participants.map(user => `
                <div class="participant ${user.isOnline ? 'online' : 'offline'}">
                    <div class="status-dot ${user.isOnline ? 'status-online' : 'status-offline'}"></div>
                    <span>${user.name} ${user.role === 'owner' ? '(Owner)' : ''}</span>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="shared-files">
        <h4>📁 Shared Files</h4>
        <div id="sharedFilesList">
            ${this.activeSession.sharedFiles.map(file => `
                <div class="file-item">${file.split('/').pop()}</div>
            `).join('')}
        </div>
    </div>

    <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
            ${this.activeSession.chatHistory.map(msg => `
                <div class="message ${msg.userId === this.currentUser?.id ? 'own' : 'other'}">
                    <div class="message-header">${msg.userName} - ${msg.timestamp.toLocaleTimeString()}</div>
                    <div>${msg.message}</div>
                </div>
            `).join('')}
        </div>
        
        <div class="chat-input">
            <input type="text" id="messageInput" placeholder="Type a message..." onkeypress="handleKeyPress(event)">
            <button class="btn" onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function sendMessage() {
            const input = document.getElementById('messageInput');
            if (input.value.trim()) {
                vscode.postMessage({
                    command: 'sendMessage',
                    text: input.value
                });
                input.value = '';
            }
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        }

        function inviteUser() {
            const email = prompt('Enter email address to invite:');
            if (email) {
                vscode.postMessage({
                    command: 'inviteUser',
                    email: email
                });
            }
        }

        function shareCurrentFile() {
            vscode.postMessage({
                command: 'shareCurrentFile'
            });
        }

        function endSession() {
            if (confirm('Are you sure you want to end this collaboration session?')) {
                vscode.postMessage({
                    command: 'endSession'
                });
            }
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateChat':
                    updateChatMessages(message.messages);
                    break;
                case 'updatePresence':
                    updateParticipantsList(message.users);
                    break;
            }
        });

        function updateChatMessages(messages) {
            const chatContainer = document.getElementById('chatMessages');
            chatContainer.innerHTML = messages.map(msg => \`
                <div class="message \${msg.userId === '${this.currentUser?.id}' ? 'own' : 'other'}">
                    <div class="message-header">\${msg.userName} - \${new Date(msg.timestamp).toLocaleTimeString()}</div>
                    <div>\${msg.message}</div>
                </div>
            \`).join('');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function updateParticipantsList(users) {
            const participantsList = document.getElementById('participantsList');
            participantsList.innerHTML = users.map(user => \`
                <div class="participant \${user.isOnline ? 'online' : 'offline'}">
                    <div class="status-dot \${user.isOnline ? 'status-online' : 'status-offline'}"></div>
                    <span>\${user.name} \${user.role === 'owner' ? '(Owner)' : ''}</span>
                </div>
            \`).join('');
        }
    </script>
</body>
</html>`;
    }

    /**
     * Initialize WebSocket event handlers
     */
    private setupEventHandlers(): void {
        // Document change handler
        vscode.workspace.onDidChangeTextDocument(this.handleDocumentChange.bind(this));

        // Cursor change handler
        vscode.window.onDidChangeTextEditorSelection((event) => {
            this.handleCursorChange(event.textEditor);
        });

        // File open/close handlers
        vscode.workspace.onDidOpenTextDocument((document) => {
            if (this.activeSession && this.isSharedFile(document.uri.fsPath)) {
                this.sendMessage({
                    type: 'file_opened',
                    sessionId: this.activeSession.id,
                    file: document.uri.fsPath,
                    userId: this.currentUser?.id
                });
            }
        });
    }

    /**
     * Initialize decorations for presence indicators
     */
    private initializeDecorations(): void {
        // Create base decoration types
    }

    /**
     * Connect to collaboration server
     */
    private async connectToCollaborationServer(sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // In production, this would connect to a real WebSocket server
            // For now, simulate connection
            setTimeout(() => {
                this.websocket = {
                    send: (data) => console.log('Sending:', data),
                    close: () => console.log('Connection closed')
                } as any;
                resolve();
            }, 1000);
        });
    }

    /**
     * Send message to collaboration server
     */
    private sendMessage(message: any): void {
        if (this.websocket) {
            this.websocket.send(JSON.stringify(message));
        }
    }

    /**
     * Helper methods
     */
    private async initializeCurrentUser(): Promise<void> {
        const name = await vscode.window.showInputBox({ prompt: 'Enter your name' });
        const email = await vscode.window.showInputBox({ prompt: 'Enter your email' });
        
        if (name && email) {
            this.currentUser = {
                id: crypto.randomUUID(),
                name,
                email,
                role: 'owner',
                lastSeen: new Date(),
                isOnline: true
            };
        }
    }

    private isSharedFile(filePath: string): boolean {
        return this.activeSession?.sharedFiles.includes(filePath) || false;
    }

    private getUserColor(userId: string): string {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'];
        const hash = userId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }

    private async inviteUser(email: string): Promise<void> {
        // Generate invite link
        const inviteCode = crypto.randomUUID();
        const inviteLink = `vscode://coding.collaboration.join?session=${this.activeSession?.id}&code=${inviteCode}`;
        
        vscode.env.clipboard.writeText(inviteLink);
        vscode.window.showInformationMessage(`📋 Invite link copied to clipboard! Share with: ${email}`);
    }

    private async endCollaborationSession(): Promise<void> {
        if (this.activeSession) {
            this.sendMessage({
                type: 'end_session',
                sessionId: this.activeSession.id
            });

            this.activeSession = undefined;
            
            if (this.websocket) {
                this.websocket.close();
                this.websocket = undefined;
            }

            // Clear decorations
            this.decorationTypes.forEach(decoration => decoration.dispose());
            this.decorationTypes.clear();
        }
    }

    dispose(): void {
        this.endCollaborationSession();
        this.decorationTypes.forEach(decoration => decoration.dispose());
    }
}

/**
 * Conflict Resolution Manager
 */
class ConflictResolutionManager {
    private conflicts: Map<string, ConflictResolution> = new Map();

    async detectConflict(file: string, localContent: string, remoteContent: string): Promise<ConflictResolution | null> {
        // Simple conflict detection - in production, use more sophisticated algorithm
        if (localContent !== remoteContent) {
            const conflictId = crypto.randomUUID();
            const conflict: ConflictResolution = {
                id: conflictId,
                file,
                conflicts: [{
                    base: '', // Would be retrieved from version control
                    ours: localContent,
                    theirs: remoteContent,
                    strategy: 'manual'
                }],
                participants: [],
                status: 'pending',
                createdAt: new Date()
            };

            this.conflicts.set(conflictId, conflict);
            return conflict;
        }

        return null;
    }

    async resolveConflict(conflictId: string, resolution: string, strategy: ConflictResolution['conflicts'][0]['strategy']): Promise<void> {
        const conflict = this.conflicts.get(conflictId);
        if (conflict) {
            conflict.conflicts[0].resolved = resolution;
            conflict.conflicts[0].strategy = strategy;
            conflict.status = 'resolved';
            conflict.resolvedAt = new Date();
        }
    }
}

/**
 * Register collaboration commands
 */
export function registerCollaborationCommands(context: vscode.ExtensionContext): void {
    const collaboration = new RealTimeCollaborationSystem(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.collaboration.start', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Session name' });
            if (name) {
                await collaboration.startCollaborationSession(name, {
                    allowEditing: true,
                    allowFileCreation: true,
                    allowFileDeletion: false,
                    requireApproval: false,
                    maxParticipants: 10
                });
            }
        }),

        vscode.commands.registerCommand('coding.collaboration.join', async () => {
            const sessionId = await vscode.window.showInputBox({ prompt: 'Session ID' });
            if (sessionId) {
                await collaboration.joinCollaborationSession(sessionId);
            }
        }),

        vscode.commands.registerCommand('coding.collaboration.shareFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await collaboration.shareFile(editor.document.uri.fsPath);
            }
        })
    );

    context.subscriptions.push(collaboration);
}