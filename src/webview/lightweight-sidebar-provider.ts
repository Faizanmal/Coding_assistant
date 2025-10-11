// Lightweight sidebar provider for simple operations
import * as vscode from 'vscode';
import { marked } from 'marked';
import { EnhancedWebviewViewProvider, ChatHistory, WebviewMessageType, SendPromptMessage } from './types';
import { WebviewHtmlGenerator } from './html-generator';
import { generateCodeUnified } from './code-generation';
import { getprojectcontext } from '../extension';
import { MultiFileGenerator } from '../multifilegenerator';
import { NLPFileGenerator } from '../nlpfilegenerator';
import { LiveTerminal } from '../liveterminal';

import { ChatFileManager } from '../chatfilemanager';
import { ProjectIssueSolver } from '../projectissuesolver';
import { tavilySearch } from '../codegenerator';

export class LightweightSidebarProvider implements EnhancedWebviewViewProvider {
    public static readonly viewType = 'coding.sidebarView';
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _projectcontext: string = '';

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public async resolveWebviewView(view: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, _token: vscode.CancellationToken) {
        this._view = view;
        view.webview.options = { enableScripts: true, localResourceRoots: [] };
        
        // Initialize services
        LiveTerminal.setWebviewView(view);

        ChatFileManager.initialize();
        ProjectIssueSolver.initialize();
        
        this._projectcontext = await getprojectcontext();
        
        let history = this.getChatHistory();
        if (history.length === 0) {
            history.push({ role: 'assistant', content: "👋 Hi there! How can I help you today?" });
            this.saveChatHistory(history);
        }
        
        await this.updateWebview(history);
        view.webview.onDidReceiveMessage(this.handleMessage.bind(this));
    }

    private async handleMessage(message: WebviewMessageType): Promise<void> {
        if (!this._view) {return;}

        switch (message.command) {
            case 'sendPrompt':
                await this.handleSendPrompt(message as SendPromptMessage);
                break;
            case 'clearChatHistory':
                await this.handleClearChatHistory();
                break;
            case 'deleteMessage':
                await this.handleDeleteMessage(message as any);
                break;
            case 'refreshCodebase':
                await this.handleRefreshCodebase();
                break;
        }
    }

    private async handleSendPrompt(message: SendPromptMessage): Promise<void> {
        const { text: prompt, provider, model, useWeb } = message;
        const history = this.getChatHistory();
        history.push({ role: 'user', content: prompt });
        await this.updateWebview(history);

        try {
            // Multi-file generation
            const multiFileRequests = MultiFileGenerator.parseMultiFilePrompt(prompt);
            if (multiFileRequests) {
                history.push({ role: 'assistant', content: `🔄 Generating ${multiFileRequests.length} files...` });
                await this.updateWebview(history);
                await MultiFileGenerator.generateMultipleFiles(multiFileRequests, false);
                history[history.length - 1].content = `✅ Generated ${multiFileRequests.length} files successfully`;
                this.saveChatHistory(history);
                await this.updateWebview(history);
                return;
            }

            // File management
            const fileResult = await ChatFileManager.processFileCommand(prompt);
            if (fileResult) {
                history.push({ role: 'assistant', content: fileResult });
                this.saveChatHistory(history);
                await this.updateWebview(history);
                return;
            }

            // Project issue solving
            if (ProjectIssueSolver.isIssueRequest(prompt)) {
                history.push({ role: 'assistant', content: '🔍 Analyzing project issue...' });
                await this.updateWebview(history);
                const solution = await ProjectIssueSolver.solveProjectIssue(prompt);
                history[history.length - 1].content = solution;
                this.saveChatHistory(history);
                await this.updateWebview(history);
                return;
            }

            // Regular AI response
            await this.handleRegularAIResponse(prompt, provider, model, useWeb, history);

        } catch (error: any) {
            history.push({ role: 'assistant', content: `❌ Error: ${error.message}` });
            this.saveChatHistory(history);
            await this.updateWebview(history);
        }
    }

    private async handleRegularAIResponse(prompt: string, provider: string, model: string, useWeb: boolean, history: ChatHistory): Promise<void> {
        let fullPrompt = prompt;

        if (this._projectcontext && this._projectcontext.length > 100) {
            fullPrompt = `**Project Context:**\n${this._projectcontext}\n\n**Request:** ${prompt}`;
        }

        if (useWeb) {
            try {
                const result = await tavilySearch(prompt);
                const formatted = `📡 **Web Search Result:**\n${result.answer || "No summary found."}`;
                history.push({ role: 'assistant', content: formatted });
                await this.updateWebview(history);
                fullPrompt = `${formatted}\n\n${prompt}`;
            } catch (error: any) {
                history.push({ role: 'assistant', content: `⚠️ Web search failed: ${error.message}` });
                await this.updateWebview(history);
            }
        }

        const reply = await generateCodeUnified(provider, model, fullPrompt);
        history.push({ role: 'assistant', content: reply });
        this.saveChatHistory(history);
        await this.updateWebview(history);
    }

    private async handleClearChatHistory(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage("Clear chat history?", { modal: true }, "Yes", "No");
        if (confirm === "Yes") {
            await this._context.globalState.update('AIChatHistory', []);
            await this.updateWebview([]);
            vscode.window.showInformationMessage('Chat history cleared!');
        }
    }

    private async handleDeleteMessage(message: any): Promise<void> {
        const history = this.getChatHistory();
        const confirm = await vscode.window.showWarningMessage("Delete message?", { modal: true }, "Yes", "No");
        if (confirm === "Yes") {
            const isUser = history[message.index]?.role === 'user';
            if (isUser) {
                history.splice(message.index, 2);
            } else {
                history.splice(message.index - 1, 2);
            }
            this.saveChatHistory(history);
            await this.updateWebview(history);
        }
    }

    private async handleRefreshCodebase(): Promise<void> {
        this._projectcontext = await getprojectcontext();
        vscode.window.showInformationMessage('Codebase refreshed!');
        await this.updateWebview(this.getChatHistory());
    }

    public async clearChatHistory(): Promise<void> {
        await this._context.globalState.update('AIChatHistory', []);
        await this.updateWebview([]);
    }

    private getChatHistory(): ChatHistory {
        return this._context.globalState.get('AIChatHistory', []);
    }

    private saveChatHistory(history: ChatHistory): void {
        this._context.globalState.update('AIChatHistory', history);
    }

    private async updateWebview(history: ChatHistory): Promise<void> {
        if (!this._view) {return;}

        const chatHtml = await this.generateChatHtml(history);
        const fullHtml = WebviewHtmlGenerator.generateHtml({
            chatBody: chatHtml,
            theme: 'dark',
            enableHighlight: true
        });

        this._view.webview.html = fullHtml;
        this._view.webview.postMessage({ command: 'setupEventListeners' });
    }

    private async generateChatHtml(history: ChatHistory): Promise<string> {
        const chatMessages = await Promise.all(history.map(async (msg, index) => {
            let content: string;
            if (msg.role === 'assistant') {
                const raw = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2);
                content = await marked.parse(raw);
            } else {
                const escapedContent = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                content = `<p>${escapedContent}</p>`;
            }
            return `<div class="msg ${msg.role}" data-index="${index}">
                    <strong>${msg.role}:</strong>
                    <button class="delete-btn" data-index="${index}" title="Delete">🗑️</button>
                    <div class="content">${content}</div>
                </div>`;
        }));
        return chatMessages.join('');
    }

    private isProjectCommand(prompt: string): boolean {
        const keywords = ['show', 'open', 'display', 'find', 'search', 'edit', 'create', 'file', 'project'];
        const lowerPrompt = prompt.toLowerCase();
        return keywords.some(keyword => lowerPrompt.includes(keyword)) &&
               (lowerPrompt.includes('file') || lowerPrompt.includes('project'));
    }
}