// Message handlers for webview communication
import * as vscode from 'vscode';
import { 
    WebviewMessageType, 
    MessageHandler, 
    MessageHandlerRegistry,
    SendPromptMessage,
    TerminalCommandMessage,
    StatusRequestMessage,
    ProductivityMessage,
    CodeAnalysisMessage,
    CoordinationMessage,
    DeleteMessageMessage,
    ChatHistory 
} from './types';

// Import required modules for message handling
import { generateCodeUnified } from './code-generation';
import { MultiFileGenerator } from '../multifilegenerator';
import { NLPFileGenerator } from '../nlpfilegenerator';
import { LiveTerminal } from '../liveterminal';
import { NLPProjectController } from '../nlpprojectcontroller';
import { ChatFileManager } from '../chatfilemanager';
import { ProjectIssueSolver } from '../projectissuesolver';
import { CodeDiffViewer } from '../codediffviewer';
import { TerminalHistory } from '../terminalhistory';
import { ProductivityDashboard } from '../productivitydashboard';
import { CodeSmellDetector } from '../codesmelldetector';
import { tavilySearch } from '../codegenerator';
import { getprojectcontext } from '../extension';

export class WebviewMessageHandlers {
    private context: vscode.ExtensionContext;
    private view: vscode.WebviewView;
    private projectContext: string = '';

    constructor(context: vscode.ExtensionContext, view: vscode.WebviewView) {
        this.context = context;
        this.view = view;
    }

    public async initialize(): Promise<void> {
        this.projectContext = await getprojectcontext();
    }

    public getHandlerRegistry(): MessageHandlerRegistry {
        return {
            'sendPrompt': (message) => this.handleSendPrompt(message as SendPromptMessage),
            'clearChatHistory': () => this.handleClearChatHistory(),
            'deleteMessage': (message) => this.handleDeleteMessage(message as DeleteMessageMessage),
            'refreshCodebase': () => this.handleRefreshCodebase(),
            'showProjectInfo': () => this.handleShowProjectInfo(),
            'suggestFiles': () => this.handleSuggestFiles(),
            
            // Terminal commands
            'executeShellCommand': (message) => this.handleExecuteShellCommand(message as TerminalCommandMessage),
            'killCommand': (message) => this.handleKillCommand(message as TerminalCommandMessage),
            'createTerminalSession': (message) => this.handleCreateTerminalSession(message as TerminalCommandMessage),
            'getTerminalStatus': () => this.handleGetTerminalStatus(),
            
            // Terminal history
            'getRecentCommands': (message) => this.handleGetRecentCommands(message as StatusRequestMessage),
            'searchHistory': (message) => this.handleSearchHistory(message as StatusRequestMessage),
            'getFrequentCommands': (message) => this.handleGetFrequentCommands(message as StatusRequestMessage),
            'getHistoryStats': () => this.handleGetHistoryStats(),
            'exportHistory': () => this.handleExportHistory(),
            'clearHistory': () => this.handleClearHistory(),
            
            // Productivity
            'getTodayStats': () => this.handleGetTodayStats(),
            'getWeeklyTrend': () => this.handleGetWeeklyTrend(),
            'generateProductivityReport': () => this.handleGenerateProductivityReport(),
            'getProductivityMetrics': () => this.handleGetProductivityMetrics(),
            'clearProductivityData': () => this.handleClearProductivityData(),
            
            // Code analysis
            'analyzeCurrentFile': () => this.handleAnalyzeCurrentFile(),
            'analyzeWorkspace': () => this.handleAnalyzeWorkspace(),
            'generateCodeQualityReport': () => this.handleGenerateCodeQualityReport(),
            
            // Coordination
            'getCoordinationStatus': () => this.handleGetCoordinationStatus(),
            'acceptBatchOperation': (message) => this.handleAcceptBatchOperation(message as CoordinationMessage),
            'rejectBatchOperation': (message) => this.handleRejectBatchOperation(message as CoordinationMessage),
            'navigateToEdit': (message) => this.handleNavigateToEdit(message as any),
            'clearEdits': () => this.handleClearEdits(),
        };
    }

    private async handleSendPrompt(message: SendPromptMessage): Promise<void> {
        const { text: prompt, provider, model, useWeb } = message;

        const history = this.getChatHistory();
        history.push({ role: 'user', content: prompt });
        await this.updateWebview(history);

        try {
            // Check for diff comparison commands
            if (await this.handleDiffCommands(prompt, history)) {return;}

            // Multi-file generation
            if (await this.handleMultiFileGeneration(prompt, history)) {return;}

            // Enhanced file creation
            if (await this.handleEnhancedFileCreation(prompt, history)) {return;}

            // Project issue solving
            if (await this.handleProjectIssueSolving(prompt, history)) {return;}

            // File management
            if (await this.handleFileManagement(prompt, history)) {return;}

            // NLP project control
            if (await this.handleNLPProjectControl(prompt, history)) {return;}

            // Live terminal commands
            if (await this.handleLiveTerminalCommands(prompt, history)) {return;}

            // NLP file generation
            if (await this.handleNLPFileGeneration(prompt, history)) {return;}

            // Regular AI response with optional web search
            await this.handleRegularAIResponse(prompt, provider, model, useWeb, history);

        } catch (error: any) {
            history.push({ role: 'assistant', content: `❌ Error processing request: ${error.message}` });
            this.saveChatHistory(history);
            await this.updateWebview(history);
        }
    }

    private async handleDiffCommands(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!prompt.toLowerCase().includes('compare')) {return false;}

        try {
            if (prompt.toLowerCase().includes('clipboard')) {
                await CodeDiffViewer.compareWithClipboard();
                history.push({ role: 'assistant', content: '✅ Opened diff viewer comparing selection with clipboard content.' });
            } else if (prompt.toLowerCase().includes('two files')) {
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: true,
                    filters: { 'All Files': ['*'] }
                });
                if (files && files.length === 2) {
                    await CodeDiffViewer.compareFiles(files[0].fsPath, files[1].fsPath);
                    history.push({ role: 'assistant', content: `✅ Opened diff viewer comparing ${files[0].fsPath} with ${files[1].fsPath}.` });
                } else {
                    history.push({ role: 'assistant', content: '❌ Please select exactly 2 files to compare.' });
                }
            } else {
                const match = prompt.match(/compare.*?with\s+([\w.-]+)/i);
                if (match) {
                    const filename = match[1];
                    const currentFile = vscode.window.activeTextEditor?.document.uri.fsPath;
                    if (currentFile) {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (workspaceFolder) {
                            const otherFile = vscode.Uri.joinPath(workspaceFolder.uri, filename).fsPath;
                            await CodeDiffViewer.compareFiles(currentFile, otherFile);
                            history.push({ role: 'assistant', content: `✅ Opened diff viewer comparing current file with ${filename}.` });
                        } else {
                            history.push({ role: 'assistant', content: '❌ No workspace folder open.' });
                        }
                    } else {
                        history.push({ role: 'assistant', content: '❌ No active file to compare.' });
                    }
                } else {
                    history.push({ role: 'assistant', content: '❌ Could not parse comparison request. Try "compare two files" or "compare selection with clipboard".' });
                }
            }
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        } catch (error: any) {
            history.push({ role: 'assistant', content: `❌ Failed to open diff viewer: ${error.message}` });
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleMultiFileGeneration(prompt: string, history: ChatHistory): Promise<boolean> {
        const multiFileRequests = MultiFileGenerator.parseMultiFilePrompt(prompt);
        if (!multiFileRequests) {return false;}

        try {
            const useMultiAgent = /multi.?agent|agents|specialized|review|debug/i.test(prompt);
            
            history.push({ role: 'assistant', content: `🔄 Generating ${multiFileRequests.length} files...` });
            await this.updateWebview(history);
            
            await MultiFileGenerator.generateMultipleFiles(multiFileRequests, useMultiAgent);
            
            history[history.length - 1].content = `✅ Generated ${multiFileRequests.length} files${useMultiAgent ? ' with specialized agents' : ''}:\n\n${multiFileRequests.map(r => `• **${r.fileName}** - ${r.prompt.replace(/\`\`\`/g, '\u0060\u0060\u0060')}`).join('\n')}`;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        } catch (error: any) {
            history[history.length - 1].content = `❌ Failed to generate files: ${error.message}\n\nRequests: ${JSON.stringify(multiFileRequests, null, 2)}`;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleEnhancedFileCreation(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!(prompt.includes('smart create') || prompt.includes('intelligent file') || 
              prompt.includes('advanced create') || prompt.includes('smart file') || 
              prompt.includes('enterprise grade') || prompt.includes('production ready'))) {
            return false;
        }

        try {
            const { SmartFileOperation } = await import('../smartfileoperation');
            
            history.push({ role: 'assistant', content: '🧠 **Smart File Operations Starting...**\n\nAnalyzing request with enhanced NLP...' });
            await this.updateWebview(history);
            
            const requests = await SmartFileOperation.parseSmartFileCommand(prompt);
            if (requests.length > 0) {
                history[history.length - 1].content = `🧠 **Smart File Operations In Progress...**

Creating ${requests.length} intelligent files:
${requests.map(r => `• ${r.fileName} (${r.fileType})`).join('\n')}`;
                await this.updateWebview(history);
                
                const result = await SmartFileOperation.executeSmartFileCreation(requests);
                
                history[history.length - 1].content = `✅ **Smart File Operations Completed!**\n\n${result}`;
                this.saveChatHistory(history);
                await this.updateWebview(history);
                return true;
            } else {
                history[history.length - 1].content = '❌ Could not parse smart file creation request. Try: "smart create React component with tests and styles"';
                this.saveChatHistory(history);
                await this.updateWebview(history);
                return true;
            }
        } catch (error: any) {
            history[history.length - 1].content = `❌ Smart file operations error: ${error.message}`;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleProjectIssueSolving(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!ProjectIssueSolver.isIssueRequest(prompt)) {return false;}

        try {
            history.push({ role: 'assistant', content: '🔍 Analyzing project issue...' });
            await this.updateWebview(history);
            
            const solution = await ProjectIssueSolver.solveProjectIssue(prompt);
            
            history[history.length - 1].content = typeof solution === 'string' ? solution.replace(/`/g, '\u0060') : solution;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        } catch (error: any) {
            history[history.length - 1].content = `❌ Issue solving failed: ${error.message}`.replace(/`/g, '\u0060');
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleFileManagement(prompt: string, history: ChatHistory): Promise<boolean> {
        const fileResult = await ChatFileManager.processFileCommand(prompt);
        if (!fileResult) {return false;}

        history.push({ role: 'assistant', content: typeof fileResult === 'string' ? fileResult.replace(/`/g, '\u0060') : fileResult });
        this.saveChatHistory(history);
        await this.updateWebview(history);
        return true;
    }

    private async handleNLPProjectControl(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!this.isProjectCommand(prompt)) {return false;}

        try {
            history.push({ role: 'assistant', content: '🔄 Processing project command...' });
            await this.updateWebview(history);
            
            const result = await NLPProjectController.processNLPCommand(prompt);
            
            history[history.length - 1].content = typeof result === 'string' ? result.replace(/`/g, '\u0060') : result;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        } catch (error: any) {
            history[history.length - 1].content = `❌ Project command failed: ${error.message}`;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleLiveTerminalCommands(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!LiveTerminal.isShellCommand(prompt)) {return false;}

        const sessionId = Date.now().toString();
        const command = LiveTerminal.parseCommand(prompt);
        
        history.push({
            role: 'assistant', 
            content: `<div class="terminal-session" data-session="${sessionId}"></div>`.replace(/`/g, '\u0060'),
            sessionId 
        });
        this.saveChatHistory(history);
        await this.updateWebview(history);
        
        LiveTerminal.executeCommand(command, sessionId);
        return true;
    }

    private async handleNLPFileGeneration(prompt: string, history: ChatHistory): Promise<boolean> {
        if (!(NLPFileGenerator.isNLPFileRequest(prompt) && !MultiFileGenerator.parseMultiFilePrompt(prompt))) {
            return false;
        }

        try {
            history.push({ role: 'assistant', content: `🔄 Analyzing request and generating files...` });
            await this.updateWebview(history);
            
            const result = await NLPFileGenerator.generateFromNLP(prompt);
            
            history[history.length - 1].content = typeof result === 'string' ? result.replace(/`/g, '\u0060') : result;
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        } catch (error: any) {
            history[history.length - 1].content = `❌ NLP file generation failed: ${error.message}`.replace(/`/g, '\u0060');
            this.saveChatHistory(history);
            await this.updateWebview(history);
            return true;
        }
    }

    private async handleRegularAIResponse(prompt: string, provider: string, model: string, useWeb: boolean, history: ChatHistory): Promise<void> {
        let fullPrompt = prompt;

        // Include project context
        if (this.projectContext && this.projectContext.length > 100) {
            fullPrompt = `**Current Project Context:**
${this.projectContext}

**User Request:** ${prompt}

Please consider the current project structure and files when responding. If generating code, make it compatible with the existing project.`;
        }

        if (useWeb) {
            try {
                const result = await tavilySearch(prompt);
                const sources = result.results?.map((r) =>
                    `- [${r.title}](${r.url})\n  ${r.content?.slice(0, 200) || ''}`
                ).join('\n\n') || 'No sources found.';

                const images = result.images?.map((img) =>
                    `![Image](${img})`
                ).join('\n') || '';

                const formatted = `📡 **Web Search Result:**

${result.answer || "No summary found."} 

---
**Sources:**
${sources}

${images}`;

                history.push({ role: 'assistant', content: typeof formatted === 'string' ? formatted.replace(/`/g, '\u0060') : formatted });
                await this.updateWebview(history);

                fullPrompt = `${formatted}\n\n${prompt}`;
            } catch (error: any) {
                const errorMsg = `⚠️ Web search failed. Proceeding with original prompt.\n\n${prompt}`;
                vscode.window.showErrorMessage(`Tavily error: ${error.message}`);
                fullPrompt = errorMsg;

                history.push({ role: 'assistant', content: `⚠️ Web search failed: ${error.message}`.replace(/`/g, '\u0060') });
                await this.updateWebview(history);
            }
        }

        const reply = await generateCodeUnified(provider, model, fullPrompt);
        history.push({ role: 'assistant', content: typeof reply === 'string' ? reply.replace(/`/g, '\u0060') : reply });

        this.saveChatHistory(history);
        await this.updateWebview(history);
    }

    // Additional handler methods for other commands...
    private async handleClearChatHistory(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            "Are you sure you want to clear chat history?",
            { modal: true },
            "Yes", "No"
        );
        if (confirm === "Yes") {
            await this.context.globalState.update('AIChatHistory', []);
            await this.updateWebview([]);
            vscode.window.showInformationMessage('Chat history cleared!');
        }
    }

    private async handleDeleteMessage(message: DeleteMessageMessage): Promise<void> {
        const history = this.getChatHistory();
        const confirm = await vscode.window.showWarningMessage(
            "Delete this message?",
            { modal: true },
            "Yes", "No"
        );

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
        this.projectContext = await getprojectcontext();
        vscode.window.showInformationMessage('Codebase context refreshed!');
        const history = this.getChatHistory();
        await this.updateWebview(history);
    }

    // Terminal-related handlers
    private async handleExecuteShellCommand(message: TerminalCommandMessage): Promise<void> {
        // Implementation for shell command execution
    }

    private async handleKillCommand(message: TerminalCommandMessage): Promise<void> {
        if (message.sessionId) {
            const killed = LiveTerminal.killCommand(message.sessionId);
            if (killed) {
                console.log(`Killed command session: ${message.sessionId}`);
            }
        }
    }

    private async handleCreateTerminalSession(message: TerminalCommandMessage): Promise<void> {
        const sessionId = LiveTerminal.createNewSession(message.sessionName || 'Terminal');
        const history = this.getChatHistory();
        history.push({ 
            role: 'assistant', 
            content: `✅ Created new terminal session: **${message.sessionName}** (ID: ${sessionId})

You can now run commands in this session. Type commands like:
- \`npm install\`
- \`git status\`
- \`run python script.py\``,
            sessionId 
        });
        this.saveChatHistory(history);
        await this.updateWebview(history);
    }

    private async handleGetTerminalStatus(): Promise<void> {
        const status = LiveTerminal.getTerminalStatus();
        const history = this.getChatHistory();
        let statusMessage = `📊 **Terminal Status Report**\n\n`;
        statusMessage += `**Overall Status**: ${status.status.toUpperCase()}\n`;
        statusMessage += `**Running Commands**: ${status.runningCommands}\n`;
        statusMessage += `**Active Sessions**: ${status.activeSessions.length}\n\n`;
        
        if (status.activeSessions.length > 0) {
            statusMessage += `**Session Details**:\n`;
            status.activeSessions.forEach((session, index) => {
                const statusIcon = session.status === 'running' ? '🟢' : 
                                 session.status === 'error' ? '🔴' : '⚪';
                statusMessage += `${index + 1}. ${statusIcon} **${session.name}** (${session.status})\n`;
                statusMessage += `   - Last Command: \`${session.lastCommand || 'None'}\`\n`;
                statusMessage += `   - Created: ${new Date(session.created).toLocaleString()}\n\n`;
            });
        } else {
            statusMessage += `No active terminal sessions. Click "➕ Terminal" to create one.\n`;
        }
        
        history.push({ role: 'assistant', content: statusMessage });
        this.saveChatHistory(history);
        await this.updateWebview(history);
    }

    // Utility methods
    private getChatHistory(): ChatHistory {
        return this.context.globalState.get('AIChatHistory', []);
    }

    private saveChatHistory(history: ChatHistory): void {
        this.context.globalState.update('AIChatHistory', history);
    }

    private async updateWebview(history: ChatHistory): Promise<void> {
        // This will be implemented by the main provider
        // The provider will handle HTML generation and webview updates
        this.view.webview.postMessage({ command: 'updateHistory', history });
    }

    private isProjectCommand(prompt: string): boolean {
        const projectKeywords = [
            'show', 'open', 'display', 'find', 'search', 'locate',
            'edit', 'modify', 'change', 'update', 'create', 'make',
            'generate', 'add', 'delete', 'remove', 'analyze',
            'summary', 'overview', 'structure', 'file', 'project'
        ];
        
        const lowerPrompt = prompt.toLowerCase();
        return projectKeywords.some(keyword => lowerPrompt.includes(keyword)) &&
               (lowerPrompt.includes('file') || lowerPrompt.includes('project') || 
                Boolean(lowerPrompt.match(/\.[a-zA-Z0-9]+\b/)));
    }

    // Placeholder implementations for remaining handlers
    private async handleShowProjectInfo(): Promise<void> { /* Implementation */ }
    private async handleSuggestFiles(): Promise<void> { /* Implementation */ }
    private async handleGetRecentCommands(message: StatusRequestMessage): Promise<void> { /* Implementation */ }
    private async handleSearchHistory(message: StatusRequestMessage): Promise<void> { /* Implementation */ }
    private async handleGetFrequentCommands(message: StatusRequestMessage): Promise<void> { /* Implementation */ }
    private async handleGetHistoryStats(): Promise<void> { /* Implementation */ }
    private async handleExportHistory(): Promise<void> { /* Implementation */ }
    private async handleClearHistory(): Promise<void> { /* Implementation */ }
    private async handleGetTodayStats(): Promise<void> { /* Implementation */ }
    private async handleGetWeeklyTrend(): Promise<void> { /* Implementation */ }
    private async handleGenerateProductivityReport(): Promise<void> { /* Implementation */ }
    private async handleGetProductivityMetrics(): Promise<void> { /* Implementation */ }
    private async handleClearProductivityData(): Promise<void> { /* Implementation */ }
    private async handleAnalyzeCurrentFile(): Promise<void> { /* Implementation */ }
    private async handleAnalyzeWorkspace(): Promise<void> { /* Implementation */ }
    private async handleGenerateCodeQualityReport(): Promise<void> { /* Implementation */ }
    private async handleGetCoordinationStatus(): Promise<void> { /* Implementation */ }
    private async handleAcceptBatchOperation(message: CoordinationMessage): Promise<void> { /* Implementation */ }
    private async handleRejectBatchOperation(message: CoordinationMessage): Promise<void> { /* Implementation */ }
    private async handleNavigateToEdit(message: any): Promise<void> { /* Implementation */ }
    private async handleClearEdits(): Promise<void> { /* Implementation */ }
}