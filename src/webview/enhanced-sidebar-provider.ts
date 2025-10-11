// Enhanced sidebar provider with modular architecture
import * as vscode from 'vscode';
import { marked } from 'marked';
import { createHighlighter, Highlighter } from 'shiki';
import {
    EnhancedWebviewViewProvider,
    ChatHistory,
    AllWebviewMessageType,
    TerminalStatus,
    AgentOperation,
    BatchOperation
} from './types';
import { WebviewHtmlGenerator } from './html-generator';
import { WebviewMessageHandlers } from './message-handlers';
import { getprojectcontext } from '../extension';

// Import coordination and tracking systems
import { SmartAgentCoordinator } from '../smartagentcoordinator';
import { ConflictPreventionSystem } from '../conflictprevention';
import { NLPHandler } from '../nlphandler_fixed';
import { MultiAgentFileEditor } from '../multiagentfileeditor';
import { LiveTerminal } from '../liveterminal';
import { EditTracker } from '../edittracker';
import { fileExtensionRegistry } from '../fileextensionagentregistry';

export class EnhancedSidebarProvider implements EnhancedWebviewViewProvider {
    public static readonly viewType = 'coding.sidebarView';
    private _view?: vscode.WebviewView;
    private readonly _context: vscode.ExtensionContext;
    private readonly _highlighter: Highlighter;
    private readonly _projectcontext: string;
    private messageHandlers: WebviewMessageHandlers;
    
    // Enhanced coordination systems
    private agentCoordinator: SmartAgentCoordinator;
    private conflictPrevention: ConflictPreventionSystem;
    private nlpHandler: NLPHandler;
    private activeOperations: Set<string> = new Set();

    constructor(context: vscode.ExtensionContext, highlighter: Highlighter, globalProjectContext: string) {
        this._context = context;
        this._highlighter = highlighter;
        this._projectcontext = globalProjectContext;
        
        // Initialize coordination systems
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
        this.conflictPrevention = ConflictPreventionSystem.getInstance();
        this.nlpHandler = new NLPHandler();
        
        // Initialize message handlers (will be set up after view resolution)
        this.messageHandlers = new WebviewMessageHandlers(context, this._view!);
        
        // Initialize extension agents registry
        this.initializeExtensionAgents();
    }

    private async initializeExtensionAgents() {
        try {
            await fileExtensionRegistry.analyzeWorkspace();
            console.log('✅ Extension agents initialized successfully');
        } catch (error) {
            console.warn('⚠️ Failed to initialize extension agents:', error);
        }
    }

    public async resolveWebviewView(
        view: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ) {
        try {
            this._view = view;
            view.webview.options = { enableScripts: true };
            
            // Initialize message handlers with the actual view
            this.messageHandlers = new WebviewMessageHandlers(this._context, view);
            await this.messageHandlers.initialize();
            
            // Set up message handling
            view.webview.onDidReceiveMessage(this.handleMessage.bind(this));
            
            // Set webview for live updates and coordination
            this.setupCoordinationSystems(view);
            
            // Initialize chat history
            let history = this.getChatHistory();
            if (history.length === 0) {
                history.push({
                    role: 'assistant',
                    content: "👋 Hi there! How can I help you today?"
                });
                this.saveChatHistory(history);
            }
            
            console.log('Enhanced sidebar history:', JSON.stringify(history));
            await this.updateWebview(history);
        } catch (e: any) {
            console.error("❌ Failed to load enhanced sidebar view:", e.message);
        }
    }

    private setupCoordinationSystems(view: vscode.WebviewView): void {
        // Set webview for live updates
        MultiAgentFileEditor.setWebviewView(view);
        LiveTerminal.setWebviewView(view);
        EditTracker.setWebviewView(view);
        
        // Initialize coordination systems
        this.agentCoordinator.setWebviewView(view);
        this.conflictPrevention.setWebviewView(view);
        this.nlpHandler.setWebviewView(view);
    }

    private async handleMessage(message: AllWebviewMessageType): Promise<void> {
        if (!this._view) {return;}

        // Special handling for debug and error messages
        if (message.command === 'debugLog') {
            console.log('🔍 WEBVIEW DEBUG:', (message as any).message);
            return;
        }
        
        if (message.command === 'webviewError') {
            console.error('❌ WEBVIEW ERROR:', (message as any).error);
            console.error('❌ WEBVIEW STACK:', (message as any).stack);
            return;
        }
        
        if (message.command === 'webviewReady') {
            console.log('🎆 WEBVIEW JAVASCRIPT IS RUNNING! Timestamp:', (message as any).timestamp);
            return;
        }

        // Route message to appropriate handler
        const handlerRegistry = this.messageHandlers.getHandlerRegistry();
        const handler = handlerRegistry[message.command];
        
        if (handler) {
            try {
                await handler(message, this._view, this._context);
            } catch (error: any) {
                console.error(`❌ Error handling message ${message.command}:`, error);
                vscode.window.showErrorMessage(`Error: ${error.message}`);
            }
        } else {
            console.warn(`⚠️ No handler found for command: ${message.command}`);
        }
    }

    public async clearChatHistory(): Promise<void> {
        await this._context.globalState.update('AIChatHistory', []);
        await this.updateWebview([]);
    }

    public updateTerminalStatus(status: TerminalStatus): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'statusUpdate',
                status: status.status,
                runningCommands: status.runningCommands
            });
        }
    }

    public showProgressUpdate(operation: AgentOperation): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'operationUpdate',
                operation
            });
        }
    }

    public showBatchSummary(operation: BatchOperation, fileSummaries: any[]): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'batchSummary',
                operation,
                fileSummaries
            });
        }
    }

    private getChatHistory(): ChatHistory {
        return this._context.globalState.get('AIChatHistory', []);
    }

    private saveChatHistory(history: ChatHistory): void {
        this._context.globalState.update('AIChatHistory', history);
    }

    private async updateWebview(history: ChatHistory): Promise<void> {
        if (!this._view) {
            console.log('No view available for update');
            return;
        }

        console.log('Updating enhanced webview with history:', history.length, 'messages');

        // Generate chat HTML from history
        const chatHtml = await this.generateChatHtml(history);
        
        // Generate complete HTML using the modular generator
        const fullHtml = WebviewHtmlGenerator.generateHtml({
            chatBody: chatHtml,
            theme: 'dark', // TODO: Get from state
            enableHighlight: true
        });

        console.log('Generated enhanced HTML length:', fullHtml.length);
        this._view.webview.html = fullHtml;
        this._view.webview.postMessage({ command: 'setupEventListeners' });
    }

    private async generateChatHtml(history: ChatHistory): Promise<string> {
        const chatMessages = await Promise.all(history.map(async (msg, index) => {
            let content: string;

            try {
                if (msg.role === 'assistant') {
                    const raw = typeof msg.content === 'string'
                        ? msg.content
                        : JSON.stringify(msg.content, null, 2);
                    content = await marked.parse(raw);
                } else {
                    const escapedContent = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    content = `<p>${escapedContent}</p>`;
                }
            } catch (err) {
                content = `<pre><code>[Render error]</code></pre>`;
            }

            return `
                <div class="msg ${msg.role}" data-index="${index}">
                    <strong>${msg.role}:</strong>
                    <button class="delete-btn" data-index="${index}" title="Delete message">🗑️</button>
                    <div class="content">${content ?? '<pre><code>[No content]</code></pre>'}</div>
                </div>`;
        }));

        return chatMessages.join('');
    }

    // Enhanced methods for smart multi-agent coordination
    private isSmartMultiAgentRequest(prompt: string): boolean {
        const smartPatterns = [
            /smart\s+multi.?agent/i,
            /intelligent\s+agents?/i,
            /coordinated?\s+agents?/i,
            /multi.?agent.*(?:create|edit|generate).*(?:smart|intelligent|coordinated)/i,
            /(?:create|edit|generate).*multiple.*files?.*(?:smart|conflict.?free|coordinated)/i,
            /agents?.*(?:prevent|avoid).*conflicts?/i
        ];
        
        return smartPatterns.some(pattern => pattern.test(prompt)) || 
               MultiAgentFileEditor.isMultiAgentRequest(prompt);
    }

    // Create folder utility (from original implementation)
    private async createFolderInRoot(folderName: string): Promise<void> {
        const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!wsPath) {
            throw new Error("No workspace open");
        }
        
        const folderUri = vscode.Uri.joinPath(vscode.Uri.file(wsPath), folderName);
        await vscode.workspace.fs.createDirectory(folderUri);
    }

    // Shell command execution utility (from original implementation)
    private async executeShellCommand(command: string): Promise<{output: string, exitCode: number}> {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd' : 'bash';
            const shellFlag = isWindows ? '/c' : '-c';
            
            const child = spawn(shell, [shellFlag, command], {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                shell: true
            });
            
            let output = '';
            let errorOutput = '';
            
            child.stdout?.on('data', (data: any) => {
                output += data.toString();
            });
            
            child.stderr?.on('data', (data: any) => {
                errorOutput += data.toString();
            });
            
            child.on('close', (code: number) => {
                const finalOutput = output + (errorOutput ? `\n\nErrors:\n${errorOutput}` : '');
                resolve({ output: finalOutput || 'Command completed with no output', exitCode: code || 0 });
            });
            
            child.on('error', (error: any) => {
                reject(new Error(`Failed to execute command: ${error.message}`));
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                child.kill();
                reject(new Error('Command timed out after 30 seconds'));
            }, 30000);
        });
    }
}