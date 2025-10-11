import * as vscode from 'vscode';
import { marked } from 'marked';
import { getprojectcontext } from './extension';
import { generateCode, generateCodeTogether, generateCodeOpenRouter, 
    generateCodeMistral, generateCodeCerebras, tavilySearch } from './codegenerator';
import { MultiFileGenerator } from './multifilegenerator';
import { NLPFileGenerator } from './nlpfilegenerator';
import { LiveTerminal } from './liveterminal';
import { NLPProjectController } from './nlpprojectcontroller';
import { ChatFileManager } from './chatfilemanager';
import { ProjectIssueSolver } from './projectissuesolver';
import { CodeDiffViewer } from './codediffviewer';
import { TerminalHistory } from './terminalhistory';
import { ProductivityDashboard } from './productivitydashboard';
import { CodeSmellDetector } from './codesmelldetector';
import { getHighlight } from './utils/highlight-config';
import { ProjectAwareness } from './projectawareness';
import { InlineShell } from './inlineshell';

// Import enhanced systems
import { UnifiedActivityDashboard } from './unified-activity-dashboard';
import { AgentTerminalBridge } from './agent-terminal-bridge';
import { LiveChangeVisualizer } from './live-change-visualizer';
import { EnhancedShellCommander } from './enhanced-shell-commander';
import { RealTimeCoordinator } from './real-time-coordinator';

// Import enhanced NLP components
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { NaturalLanguageCommandProcessor } from './natural-language-command-processor';

// Import agent coordination systems
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { ConflictPreventionSystem } from './conflictprevention';
import { NLPHandler } from './nlphandler_fixed';
import { MultiAgentFileEditor } from './multiagentfileeditor';
import { EditTracker } from './edittracker';
import { SecurityUtils } from './utils/sanitizer';

// Import advanced project-aware systems
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { SemanticCodeSystem } from './semantic-code-system';
import { AutonomousWorkflowSystem } from './autonomous-workflow-system';
import { EnhancedContextSystem } from './enhanced-context-system';
import { AgenticChainOfThoughtSystem } from './agentic-chain-of-thought';
import { ProactiveCodeAssistant } from './proactive-code-assistant';

// Import sidebar features configuration
import { SIMPLE_SIDEBAR_FEATURES, getFeaturesByCategory, QUICK_COMMANDS } from './sidebar-simple-features';

export async function generateCodeUnified(provider: string, model: string, prompt: string): Promise<string> {
    switch (provider) {
        case 'together':
            return generateCodeTogether(prompt, model.replace('together/', ''));
        case 'openrouter':
            return generateCodeOpenRouter(prompt, model.replace('openrouter/', ''));
        case 'mistral':
            return generateCodeMistral(prompt, model);
        case 'cerebras':
            return await generateCodeCerebras(prompt, model);
        case 'groq':
        default:
            return generateCode(prompt, model);
    }
}

export class SimpleSidebarViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'coding.sidebarView';
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _projectcontext: string = '';

    // Enhanced systems
    private activityDashboard: UnifiedActivityDashboard;
    private agentBridge: AgentTerminalBridge;
    private changeVisualizer: LiveChangeVisualizer;
    private realTimeCoordinator: RealTimeCoordinator;
    
    // Agent coordination systems
    private agentCoordinator: SmartAgentCoordinator;
    private conflictPrevention: ConflictPreventionSystem;
    private nlpHandler: NLPHandler;
    
    // Enhanced NLP components
    private enhancedNLP: EnhancedNLPEngine;
    private commandProcessor: NaturalLanguageCommandProcessor;
    
    private currentSessionId: string;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        
        // Initialize enhanced systems
        this.activityDashboard = UnifiedActivityDashboard.getInstance();
        this.agentBridge = AgentTerminalBridge.getInstance();
        this.changeVisualizer = LiveChangeVisualizer.getInstance();
        this.realTimeCoordinator = RealTimeCoordinator.getInstance();
        
        // Initialize agent coordination systems
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
        this.conflictPrevention = ConflictPreventionSystem.getInstance();
        this.nlpHandler = new NLPHandler();
        
        // Initialize enhanced NLP components
        this.enhancedNLP = EnhancedNLPEngine.getInstance();
        this.commandProcessor = NaturalLanguageCommandProcessor.getInstance();
        
        this.currentSessionId = this.generateSessionId();
    }
    
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public async resolveWebviewView(
        view: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ) {
        console.log('🎬 resolveWebviewView called - Setting up sidebar...');
        this._view = view;
        
        // Set webview options with more permissive CSP for testing
        view.webview.options = {
            enableScripts: true,
            localResourceRoots: []
        };
        
        // Initialize enhanced systems with webview
        this.activityDashboard.setWebviewView(view);
        this.agentBridge.setWebviewView(view);
        this.changeVisualizer.setWebviewView(view);
        this.realTimeCoordinator.setWebviewView(view);
        
        // Initialize coordination systems
        this.agentCoordinator.setWebviewView(view);
        this.conflictPrevention.setWebviewView(view);
        this.nlpHandler.setWebviewView(view);
        
        // Initialize enhanced NLP components
        this.enhancedNLP.setWebviewView(view);
        this.commandProcessor.setWebviewView(view);
        
        // Set webview for existing systems
        MultiAgentFileEditor.setWebviewView(view);
        LiveTerminal.setWebviewView(view);
        EditTracker.setWebviewView(view);
        
        console.log('✅ Webview scripts enabled');
        console.log('🔧 CSP settings:', view.webview.cspSource);
        console.log('🔧 Webview options:', view.webview.options);
        
        // Initialize Highlight.io for debugging
        const highlight = getHighlight();
        
        // Test if webview can execute any JavaScript at all with Highlight.io integration
        const testHtml = `<html><head>${highlight.getWebviewScript()}</head><body>
            <script>
                console.log("TEST: Basic JS execution works");
                // Track initial webview load
                setTimeout(() => {
                    if (window.highlightTrack) {
                        window.highlightTrack.customEvent('Webview Test Load', {
                            timestamp: new Date().toISOString(),
                            phase: 'testing'
                        });
                    }
                }, 1000);
            </script>
            <h1>Testing with Highlight.io</h1>
            ${highlight.createDebugDashboard()}
        </body></html>`;
        
        view.webview.html = testHtml;
        
        setTimeout(() => {
            console.log('🚨 TESTING PHASE: Basic webview with Highlight.io created, proceeding with full HTML...');
            this._setupFullWebview(view);
        }, 3000);
    }
    
    private async _setupFullWebview(view: vscode.WebviewView) {
        console.log('🔧 Setting up full webview with all functionality...');
        
        LiveTerminal.setWebviewView(view);
        await NLPProjectController.initialize();
        ChatFileManager.initialize();
        ProjectIssueSolver.initialize();
        TerminalHistory.initialize(this._context);
        ProductivityDashboard.initialize(this._context);
        console.log('🔧 Services initialized');

        this._projectcontext = await getprojectcontext();
        console.log('📄 Project context loaded, length:', this._projectcontext.length);

        let history = this._getChatHistory();
        if (history.length === 0) {
            history.push({
                role: 'assistant',
                content: "👋 Hi there! How can I help you today?"
            });
            this._saveChatHistory(history);
        }
        console.log('💬 Chat history prepared, length:', history.length);

        console.log('🎨 About to update webview with HTML...');
        await this._updateWebview(history);
        console.log('✅ Webview HTML updated successfully');

        view.webview.onDidReceiveMessage(async message => {
            if (message.command === 'debugLog') {
                console.log('🔍 WEBVIEW DEBUG:', message.message);
                return;
            }
            
            if (message.command === 'webviewError') {
                console.error('❌ WEBVIEW ERROR:', message.error);
                console.error('❌ WEBVIEW STACK:', message.stack);
                return;
            }
            
            if (message.command === 'webviewReady') {
                console.log('🎆 WEBVIEW JAVASCRIPT IS RUNNING! Timestamp:', message.timestamp);
                return;
            }
            
            if (message.command === 'sendPrompt') {
                const { text: prompt, provider, model, useWeb, codeOnly } = message;

                const history = this._getChatHistory();
                history.push({ role: 'user', content: prompt });
                await this._updateWebview(history);

                // 🧠 Enhanced NLP Processing - Fully automated workflow
                try {
                    // 🤖 PRIORITY: Multi-Agent Coordination for File Operations (FIRST CHECK)
                    if (this.shouldUseMultiAgentCoordination(prompt)) {
                        try {
                            history.push({ role: 'assistant', content: '🤖 **Multi-Agent Coordination...**\n\nAssigning specialized agents for your request...' });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            
                            // Process with SmartAgentCoordinator
                            const result = await this.agentCoordinator.processMultiAgentRequest(prompt);
                            
                            // Show results
                            history[history.length - 1].content = result;
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        } catch (err: any) {
                            history.push({ role: 'assistant', content: `❌ Multi-agent coordination failed: ${err.message}`.replace(/`/g, '\u0060') });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        }
                    }

                    // Check if should use conversational processing
                    if (NaturalLanguageCommandProcessor.shouldUseConversationalProcessing(prompt)) {
                        history.push({ role: 'assistant', content: '🗣️ **Conversational Processing...**\n\nAnalyzing your natural language request...' });
                        this._saveChatHistory(history);
                        await this._updateWebview(history);

                        const conversationalResult = await this.commandProcessor.processConversationalInput(prompt, this.currentSessionId);
                        history[history.length - 1].content = conversationalResult;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }

                    // Check if should use enhanced NLP (LOWER PRIORITY)
                    if (EnhancedNLPEngine.shouldProcessWithEnhancedNLP(prompt)) {
                        history.push({ role: 'assistant', content: '🧠 **Enhanced NLP Processing...**\n\nAnalyzing complex project request with smart agents...' });
                        this._saveChatHistory(history);
                        await this._updateWebview(history);

                        const enhancedResult = await this.enhancedNLP.processNaturalLanguageInput(prompt);
                        history[history.length - 1].content = enhancedResult;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }

                    // Enhanced Shell Command Processing with NLP
                    if (EnhancedShellCommander.isEnhancedShellRequest(prompt)) {
                        try {
                            history.push({ role: 'assistant', content: '⚡ **Enhanced Terminal Processing...**\n\nAnalyzing command with advanced NLP and context awareness...' });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            
                            // Process with enhanced shell commander
                            const result = await EnhancedShellCommander.executeEnhancedNLPCommand(prompt, {
                                userIntent: 'chat_command',
                                urgency: 'medium'
                            });
                            
                            // Show results
                            history[history.length - 1].content = `✅ **Enhanced Command Executed**\n\n${result}`;
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        } catch (err: any) {
                            history.push({ role: 'assistant', content: `❌ Enhanced shell execution failed: ${err.message}`.replace(/`/g, '\u0060') });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        }
                    }

                    // 🤖 Multi-Agent Coordination for File Operations
                    if (this.shouldUseMultiAgentCoordination(prompt)) {
                        try {
                            history.push({ role: 'assistant', content: '🤖 **Multi-Agent Coordination...**\n\nAssigning specialized agents for your request...' });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            
                            // Process with SmartAgentCoordinator
                            const result = await this.agentCoordinator.processMultiAgentRequest(prompt);
                            
                            // Show results
                            history[history.length - 1].content = result;
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        } catch (err: any) {
                            history.push({ role: 'assistant', content: `❌ Multi-agent coordination failed: ${err.message}`.replace(/`/g, '\u0060') });
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        }
                    }

                } catch (nlpError) {
                    console.warn('Enhanced NLP processing failed, falling back to existing handlers:', nlpError);
                    // Continue with existing logic as fallback
                }

                // Check for diff comparison commands
                if (prompt.toLowerCase().includes('compare') && (prompt.toLowerCase().includes('file') || prompt.toLowerCase().includes('clipboard'))) {
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
                            // Extract filename from prompt like "compare current file with filename.js"
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
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    } catch (error: any) {
                        history.push({ role: 'assistant', content: `❌ Failed to open diff viewer: ${error.message}` });
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }
                const multiFileRequests = MultiFileGenerator.parseMultiFilePrompt(prompt);
                if (multiFileRequests) {
                    try {
                        console.log('Multi-file requests found:', multiFileRequests);
                        const useMultiAgent = /multi.?agent|agents|specialized|review|debug/i.test(prompt);
                        
                        // Show processing message
                        history.push({ role: 'assistant', content: `🔄 Generating ${multiFileRequests.length} files...` });
                        await this._updateWebview(history);
                        
                        await MultiFileGenerator.generateMultipleFiles(multiFileRequests, useMultiAgent);
                        
                        // Update with success message
                        history[history.length - 1].content = `✅ Generated ${multiFileRequests.length} files${useMultiAgent ? ' with specialized agents' : ''}:\n\n${multiFileRequests.map(r => `• **${r.fileName}** - ${r.prompt.replace(/\`\`\`/g, '\u0060\u0060\u0060')}`).join('\n')}`;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    } catch (err: any) {
                        console.error('Multi-file generation error:', err);
                        history[history.length - 1].content = `❌ Failed to generate files: ${err.message}\n\nRequests: ${JSON.stringify(multiFileRequests, null, 2)}`;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }

                // Enhanced file creation with smart operations
                if (prompt.includes('smart create') || prompt.includes('intelligent file') || prompt.includes('advanced create') || 
                    prompt.includes('smart file') || prompt.includes('enterprise grade') || prompt.includes('production ready')) {
                    try {
                        const { SmartFileOperation } = await import('./smartfileoperation');
                        
                        history.push({ role: 'assistant', content: '🧠 **Smart File Operations Starting...**\n\nAnalyzing request with enhanced NLP...' });
                        await this._updateWebview(history);
                        
                        const requests = await SmartFileOperation.parseSmartFileCommand(prompt);
                        if (requests.length > 0) {
                            // Show files being created
                            history[history.length - 1].content = `🧠 **Smart File Operations In Progress...**

Creating ${requests.length} intelligent files:
${requests.map(r => `• ${r.fileName} (${r.fileType})`).join('\n')}`;
                            await this._updateWebview(history);
                            
                            const result = await SmartFileOperation.executeSmartFileCreation(requests);
                            
                            // Final success message
                            history[history.length - 1].content = `✅ **Smart File Operations Completed!**\n\n${result}`;
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        } else {
                            history[history.length - 1].content = '❌ Could not parse smart file creation request. Try: "smart create React component with tests and styles"';
                            this._saveChatHistory(history);
                            await this._updateWebview(history);
                            return;
                        }
                    } catch (error: any) {
                        history[history.length - 1].content = `❌ Smart file operations error: ${error.message}`;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }

                // Check for project issue solving first
                if (ProjectIssueSolver.isIssueRequest(prompt)) {
                    try {
                        history.push({ role: 'assistant', content: '🔍 Analyzing project issue...' });
                        await this._updateWebview(history);
                        
                        const solution = await ProjectIssueSolver.solveProjectIssue(prompt);
                        
                        history[history.length - 1].content = solution;
                        history[history.length - 1].content = typeof solution === 'string' ? solution.replace(/`/g, '\u0060') : solution;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    } catch (error: any) {
                        history[history.length - 1].content = `❌ Issue solving failed: ${error.message}`;
                        history[history.length - 1].content = `❌ Issue solving failed: ${error.message}`.replace(/`/g, '\u0060');
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }

                const fileResult = await ChatFileManager.processFileCommand(prompt);
                if (fileResult) {
                    history.push({ role: 'assistant', content: typeof fileResult === 'string' ? fileResult.replace(/`/g, '\u0060') : fileResult });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                    return;
                }

                // Check for NLP project control commands
                if (this._isProjectCommand(prompt)) {
                    try {
                        history.push({ role: 'assistant', content: '🔄 Processing project command...' });
                        await this._updateWebview(history);
                        
                        const result = await NLPProjectController.processNLPCommand(prompt);
                        
                        history[history.length - 1].content = typeof result === 'string' ? result.replace(/`/g, '\u0060') : result;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    } catch (error: any) {
                        history[history.length - 1].content = `❌ Project command failed: ${error.message}`;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }

                // Check for live terminal command execution
                if (LiveTerminal.isShellCommand(prompt)) {
                    const sessionId = Date.now().toString();
                    const command = LiveTerminal.parseCommand(prompt);
                    
                    history.push({
                        role: 'assistant', 
                        content: `<div class="terminal-session" data-session="${sessionId}"></div>`.replace(/`/g, '\u0060'),
                        sessionId 
                    });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                    
                    LiveTerminal.executeCommand(command, sessionId);
                    return;
                }

                // Check for NLP file generation (must come before regular AI response)
                if (NLPFileGenerator.isNLPFileRequest(prompt) && !MultiFileGenerator.parseMultiFilePrompt(prompt)) {
                    try {
                        console.log('NLP file generation request detected:', prompt);
                        
                        // Show processing message
                        history.push({ role: 'assistant', content: `🔄 Analyzing request and generating files...` });
                        await this._updateWebview(history);
                        
                        const result = await NLPFileGenerator.generateFromNLP(prompt);
                        
                        // Update with result
                        history[history.length - 1].content = typeof result === 'string' ? result.replace(/`/g, '\u0060') : result;
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    } catch (err: any) {
                        console.error('NLP file generation error:', err);
                        history[history.length - 1].content = `❌ NLP file generation failed: ${err.message}`.replace(/`/g, '\u0060');
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                        return;
                    }
                }

                let fullPrompt = prompt;

                // Always include project context for better understanding
                if (this._projectcontext && this._projectcontext.length > 100) {
                    fullPrompt = `**Current Project Context:**
${this._projectcontext}

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
                        await this._updateWebview(history);

                        fullPrompt = `${formatted}\n\n${prompt}`;
                    } catch (error: any) {
                        const errorMsg = `⚠️ Web search failed. Proceeding with original prompt.\n\n${prompt}`;
                        vscode.window.showErrorMessage(`Tavily error: ${error.message}`);
                        fullPrompt = errorMsg;

                        history.push({ role: 'assistant', content: `⚠️ Web search failed: ${error.message}`.replace(/`/g, '\u0060') });
                        await this._updateWebview(history);
                    }
                }

                const reply = await generateCodeUnified(provider, model, fullPrompt);
                history.push({ role: 'assistant', content: typeof reply === 'string' ? reply.replace(/`/g, '\u0060') : reply });

                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'clearChatHistory') {
                const confirm = await vscode.window.showWarningMessage(
                    "Are you sure you want to clear chat history?",
                    { modal: true },
                    "Yes", "No"
                );
                if (confirm === "Yes") {
                    await this._context.globalState.update('AIChatHistory', []);
                    await this._updateWebview([]);
                    vscode.window.showInformationMessage('Chat history cleared!');
                }
            } else if (message.command === 'deleteMessage') {
                const index = message.index;
                const history = this._getChatHistory();

                const confirm = await vscode.window.showWarningMessage(
                    "Delete this message?",
                    { modal: true },
                    "Yes", "No"
                );

                if (confirm === "Yes") {
                    const isUser = history[index]?.role === 'user';

                    if (isUser) {
                        history.splice(index, 2);
                    } else {
                        history.splice(index - 1, 2);
                    }
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
            } else if (message.command === 'refreshCodebase') {
                this._projectcontext = await getprojectcontext();
                vscode.window.showInformationMessage('Codebase context refreshed!');
                const history = this._getChatHistory();
                await this._updateWebview(history);
            } else if (message.command === 'showProjectInfo') {
                const projectInfo = await this._analyzeProject();
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: projectInfo });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'suggestFiles') {
                const suggestions = await this._suggestProjectFiles();
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: suggestions });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'killCommand') {
                const killed = LiveTerminal.killCommand(message.sessionId);
                if (killed) {
                    console.log(`Killed command session: ${message.sessionId}`);
                }
            } else if (message.command === 'createTerminalSession') {
                const sessionId = LiveTerminal.createNewSession(message.sessionName);
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: `✅ Created new terminal session: **${message.sessionName}** (ID: ${sessionId})

You can now run commands in this session. Type commands like:
- \`npm install\`
- \`git status\`
- \`run python script.py\``,
                    sessionId 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getTerminalStatus') {
                const status = LiveTerminal.getTerminalStatus();
                const history = this._getChatHistory();
                let statusMessage = `📊 **Terminal Status Report**

`;
                statusMessage += `**Overall Status**: ${status.status.toUpperCase()}
`;
                statusMessage += `**Running Commands**: ${status.runningCommands}
`;
                statusMessage += `**Active Sessions**: ${status.activeSessions.length}

`;
                
                if (status.activeSessions.length > 0) {
                    statusMessage += `**Session Details**:
`;
                    status.activeSessions.forEach((session, index) => {
                        const statusIcon = session.status === 'running' ? '🟢' : 
                                         session.status === 'error' ? '🔴' : '⚪';
                        statusMessage += `${index + 1}. ${statusIcon} **${session.name}** (${session.status})
`;
                        statusMessage += `   - Last Command: \`${session.lastCommand || 'None'}\`
`;
                        statusMessage += `   - Created: ${new Date(session.created).toLocaleString()}

`;
                    });
                } else {
                    statusMessage += `No active terminal sessions. Click "➕ Terminal" to create one.
`;
                }
                
                history.push({ role: 'assistant', content: statusMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getRecentCommands') {
                const recentCommands = TerminalHistory.getRecentCommands(message.limit || 10);
                let historyMessage = `📅 **Recent Terminal Commands**

`;
                
                if (recentCommands.length === 0) {
                    historyMessage += 'No command history found. Start running commands to build history.\n';
                } else {
                    recentCommands.forEach((entry, index) => {
                        const statusIcon = entry.exitCode === 0 ? '✅' : entry.exitCode === undefined ? '🟡' : '❌';
                        historyMessage += `${index + 1}. ${statusIcon} \`${entry.command}\`
`;
                        historyMessage += `   - **Session**: ${entry.sessionName}
`;
                        historyMessage += `   - **Time**: ${entry.timestamp.toLocaleString()}
`;
                        if (entry.workingDirectory) {
                            historyMessage += `   - **Directory**: ${entry.workingDirectory}
`;
                        }
                        historyMessage += `
`;
                    });
                }
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: historyMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'searchHistory') {
                const searchResults = TerminalHistory.searchHistory(message.query, 20);
                let searchMessage = `🔍 **Search Results for "${message.query}"**

`;
                
                if (searchResults.length === 0) {
                    searchMessage += 'No matching commands found in history.\n';
                } else {
                    searchResults.forEach((entry, index) => {
                        const statusIcon = entry.exitCode === 0 ? '✅' : entry.exitCode === undefined ? '🟡' : '❌';
                        searchMessage += `${index + 1}. ${statusIcon} \`${entry.command}\`
`;
                        searchMessage += `   - **Session**: ${entry.sessionName}
`;
                        searchMessage += `   - **Time**: ${entry.timestamp.toLocaleString()}
`;
                        searchMessage += `
`;
                    });
                }
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: searchMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getFrequentCommands') {
                const frequentCommands = TerminalHistory.getFrequentCommands(message.limit || 10);
                let frequentMessage = `📈 **Most Frequently Used Commands**

`;
                
                if (frequentCommands.length === 0) {
                    frequentMessage += 'No command usage data available.\n';
                } else {
                    frequentCommands.forEach((entry, index) => {
                        frequentMessage += `${index + 1}. \`${entry.command}\` (used ${entry.count} times)
`;
                    });
                }
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: frequentMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getHistoryStats') {
                const stats = TerminalHistory.getHistoryStats();
                const statsMessage = `📉 **Terminal History Statistics**

` +
                    `**Total Commands**: ${stats.totalCommands}
` +
                    `**Unique Sessions**: ${stats.sessionsCount}
` +
                    `**Success Rate**: ${stats.successRate}%
` +
                    `**Most Used Command**: \`${stats.mostUsedCommand}\`
` +
                    `**Recent Activity**: ${stats.recentActivity}
`;
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: statsMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'exportHistory') {
                const exportData = TerminalHistory.exportHistory();
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: `💾 **Terminal History Exported**

Your terminal history has been prepared for export. Copy the content below:

\`\`\`markdown
${exportData}
\`\`\`` 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'clearHistory') {
                TerminalHistory.clearHistory();
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: `✅ **Terminal History Cleared**

All terminal command history has been permanently deleted.` 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getTodayStats') {
                const todayStats = ProductivityDashboard.getTodayStats();
                const statsMessage = `🎆 **Today's Coding Statistics**

` +
                    `**Coding Time**: ${this.formatDuration(todayStats.codingTime)}
` +
                    `**Lines Written**: ${todayStats.linesWritten.toLocaleString()}
` +
                    `**Files Modified**: ${todayStats.filesModified}
` +
                    `**Sessions**: ${todayStats.sessionsCount}
` +
                    `**Languages**: ${todayStats.languages.join(', ') || 'None'}

` +
                    `${todayStats.codingTime > 0 ? '🎯 Great work today! Keep it up!' : '💡 Start coding to track your productivity!'}`;
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: statsMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getWeeklyTrend') {
                const weeklyTrend = ProductivityDashboard.getWeeklyTrend();
                let trendMessage = `📈 **Weekly Productivity Trend**

`;
                
                weeklyTrend.forEach((day, index) => {
                    const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                    const durationFormatted = this.formatDuration(day.duration);
                    const productivityIcon = day.productivity > 50 ? '🟢' : day.productivity > 20 ? '🟡' : '🔴';
                    trendMessage += `${productivityIcon} **${dayName} (${day.date})**: ${durationFormatted} | ${day.productivity} lines
`;
                });
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: trendMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'generateProductivityReport') {
                const report = ProductivityDashboard.generateReport();
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: `📄 **Productivity Report Generated**

\`\`\`


\`\`\`` 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'getProductivityMetrics') {
                const metrics = ProductivityDashboard.getProductivityMetrics();
                const metricsMessage = `📉 **Detailed Productivity Metrics**

` +
                    `**Total Sessions**: ${metrics.totalSessions}
` +
                    `**Total Coding Time**: ${this.formatDuration(metrics.totalCodingTime)}
` +
                    `**Lines Written**: ${metrics.totalLinesWritten.toLocaleString()}
` +
                    `**Files Modified**: ${metrics.filesModified}
` +
                    `**Languages Used**: ${Array.from(metrics.languagesUsed).join(', ')}
` +
                    `**Average Session**: ${this.formatDuration(metrics.averageSessionDuration)}
` +
                    `**Most Productive Hour**: ${metrics.mostProductiveHour}:00
` +
                    `**Most Productive Day**: ${metrics.mostProductiveDay || 'Not enough data'}

` +
                    `📊 **Daily Activity**: ${metrics.dailyStats.size} days tracked
` +
                    `📅 **Weekly Activity**: ${metrics.weeklyStats.size} weeks tracked
` +
                    `📆 **Monthly Activity**: ${metrics.monthlyStats.size} months tracked`;
                
                const history = this._getChatHistory();
                history.push({ role: 'assistant', content: metricsMessage });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'clearProductivityData') {
                ProductivityDashboard.clearData();
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: `✅ **Productivity Data Cleared**

All productivity tracking data has been permanently deleted. Tracking will restart with your next coding session.` 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
            } else if (message.command === 'analyzeCurrentFile') {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    const history = this._getChatHistory();
                    history.push({ 
                        role: 'assistant', 
                        content: '❌ **No Active File**\\n\\nPlease open a file to analyze for code smells.' 
                    });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                    return;
                }
                
                try {
                    const result = await CodeSmellDetector.analyzeFile(activeEditor.document);
                    let analysisMessage = `🔍 **Code Smell Analysis: ${activeEditor.document.fileName.split('/').pop()}**\\n\\n`;
                    analysisMessage += `**Quality Score**: ${result.overallScore}/100\\n`;
                    analysisMessage += `**Total Issues**: ${result.totalSmells} (${result.criticalSmells} critical)\\n`;
                    analysisMessage += `**Assessment**: ${result.summary}\\n\\n`;
                    
                    if (result.smells.length === 0) {
                        analysisMessage += '✅ **Excellent!** No code smells detected.\\n';
                    } else {
                        analysisMessage += '**Top Issues Found**:\\n';
                        result.smells.slice(0, 10).forEach((smell, index) => {
                            const severityIcon = {
                                'critical': '🔴',
                                'high': '🟠',
                                'medium': '🟡',
                                'low': '🔵'
                            }[smell.severity];
                            
                            analysisMessage += `${index + 1}. ${severityIcon} **${smell.type.toUpperCase()}** (Line ${smell.line})\\n`;
                            analysisMessage += `   ${smell.message}\\n`;
                            analysisMessage += `   💡 *${smell.suggestion}*\\n\\n`;
                        });
                        
                        if (result.smells.length > 10) {
                            analysisMessage += `... and ${result.smells.length - 10} more issues.\\n`;
                        }
                    }
                    
                    const history = this._getChatHistory();
                    history.push({ role: 'assistant', content: analysisMessage });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    const history = this._getChatHistory();
                    history.push({ 
                        role: 'assistant', 
                        content: `❌ **Analysis Failed**\\n\\nError analyzing file: ${error.message}` 
                    });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
            } else if (message.command === 'analyzeWorkspace') {
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: '🔄 **Analyzing Workspace...**\\n\\nScanning files for code smells. This may take a moment...' 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
                
                try {
                    const results = await CodeSmellDetector.analyzeWorkspace();
                    
                    if (results.length === 0) {
                        history[history.length - 1].content = '❌ **No Files Found**\\n\\nNo supported code files found in workspace.';
                    } else {
                        const totalSmells = results.reduce((sum, result) => sum + result.totalSmells, 0);
                        const totalCritical = results.reduce((sum, result) => sum + result.criticalSmells, 0);
                        const averageScore = results.reduce((sum, result) => sum + result.overallScore, 0) / results.length;
                        
                        let workspaceMessage = `🔍 **Workspace Code Smell Analysis**\\n\\n`;
                        workspaceMessage += `**Files Analyzed**: ${results.length}\\n`;
                        workspaceMessage += `**Average Quality Score**: ${averageScore.toFixed(1)}/100\\n`;
                        workspaceMessage += `**Total Issues**: ${totalSmells} (${totalCritical} critical)\\n\\n`;
                        
                        // Show worst files
                        const worstFiles = results
                            .filter(r => r.totalSmells > 0)
                            .sort((a, b) => a.overallScore - b.overallScore)
                            .slice(0, 5);
                        
                        if (worstFiles.length > 0) {
                            workspaceMessage += '**Files Needing Attention**:\\n';
                            worstFiles.forEach((file, index) => {
                                const fileName = file.file.split('/').pop() || file.file;
                                workspaceMessage += `${index + 1}. **${fileName}** (Score: ${file.overallScore}) - ${file.totalSmells} issues\\n`;
                            });
                            workspaceMessage += '\\n';
                        }
                        
                        workspaceMessage += 'Use "Generate code quality report" for detailed findings.\\n';
                        
                        history[history.length - 1].content = workspaceMessage;
                    }
                    
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    history[history.length - 1].content = `❌ **Workspace Analysis Failed**\\n\\nError: ${error.message}`;
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
            } else if (message.command === 'generateCodeQualityReport') {
                const history = this._getChatHistory();
                history.push({ 
                    role: 'assistant', 
                    content: '📄 **Generating Code Quality Report...**\\n\\nAnalyzing workspace and preparing detailed report...' 
                });
                this._saveChatHistory(history);
                await this._updateWebview(history);
                
                try {
                    const results = await CodeSmellDetector.analyzeWorkspace();
                    const report = CodeSmellDetector.generateReport(results);
                    
                    history[history.length - 1].content = `📄 **Code Quality Report Generated**\\n\\n\`\`\`


\`\`\``;
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    history[history.length - 1].content = `❌ **Report Generation Failed**\\n\\nError: ${error.message}`;
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
            
            // Enhanced command handlers
            } else if (message.command === 'showActivityDashboard') {
                try {
                    const dashboardState = this.activityDashboard.getDashboardState();
                    const history = this._getChatHistory();
                    
                    let report = `📊 **Enhanced Activity Dashboard**\\n\\n`;
                    report += `**Terminal Status**: ${dashboardState.terminal.status}\\n`;
                    report += `**Active Commands**: ${dashboardState.terminal.activeCommands}\\n`;
                    report += `**Sessions**: ${dashboardState.terminal.sessions.length}\\n\\n`;
                    
                    report += `**Agent Activity**\\n`;
                    report += `- Active Agents: ${dashboardState.agents.active}\\n`;
                    report += `- Working Agents: ${dashboardState.agents.working.length}\\n`;
                    report += `- Idle Agents: ${dashboardState.agents.idle}\\n\\n`;
                    
                    report += `**File Operations**\\n`;
                    report += `- Modified: ${dashboardState.files.modified}\\n`;
                    report += `- Created: ${dashboardState.files.created}\\n`;
                    report += `- Lines Added: ${dashboardState.files.linesAdded}\\n`;
                    report += `- Lines Removed: ${dashboardState.files.linesRemoved}\\n\\n`;
                    
                    report += `**System Metrics**\\n`;
                    report += `- Total Operations: ${dashboardState.system.totalOperations}\\n`;
                    report += `- Error Count: ${dashboardState.system.errorCount}\\n`;
                    report += `- Performance: ${(dashboardState.system.performance * 100).toFixed(1)}%`;
                    
                    history.push({ role: 'assistant', content: report });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    const history = this._getChatHistory();
                    history.push({ role: 'assistant', content: `❌ Failed to get activity dashboard: ${error.message}` });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
                
            } else if (message.command === 'showLiveChanges') {
                try {
                    const changes = this.changeVisualizer.getRecentChanges(10);
                    const history = this._getChatHistory();
                    
                    let report = `🔄 **Live File Changes**\\n\\n`;
                    if (changes.length > 0) {
                        changes.forEach((change, index) => {
                            report += `**${index + 1}. ${change.fileName}** (${change.changeType})\\n`;
                            report += `- **Agent**: ${change.agent || 'User'}\\n`;
                            report += `- **Time**: ${new Date(change.timestamp).toLocaleString()}\\n`;
                            report += `- **Line**: ${change.lineNumber}\\n`;
                            report += `- **Changes**: +${change.diffInfo.linesAdded} -${change.diffInfo.linesRemoved}\\n`;
                            if (change.content.length > 0) {
                                report += `- **Content**: \`${change.content.slice(0, 50)}${change.content.length > 50 ? '...' : ''}\`\\n\\n`;
                            }
                        });
                    } else {
                        report += 'No recent file changes detected.';
                    }
                    
                    history.push({ role: 'assistant', content: report });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    const history = this._getChatHistory();
                    history.push({ role: 'assistant', content: `❌ Failed to get live changes: ${error.message}` });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
                
            } else if (message.command === 'testAgentCoordination') {
                try {
                    const testPrompt = message.prompt || 'Test agent coordination';
                    const history = this._getChatHistory();
                    
                    history.push({ role: 'assistant', content: '🧪 **Testing Agent Coordination...**\\n\\nExecuting enhanced shell command test...' });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                    
                    const result = await EnhancedShellCommander.executeEnhancedNLPCommand(testPrompt);
                    
                    history[history.length - 1].content = `✅ **Agent Coordination Test Complete**\\n\\n**Test Prompt**: "${testPrompt}"\\n\\n**Result**: ${result}`;
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    const history = this._getChatHistory();
                    history.push({ role: 'assistant', content: `❌ Agent coordination test failed: ${error.message}` });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
                
            } else if (message.command === 'showCoordinationStatus') {
                try {
                    const agentStatus = this.agentCoordinator.getAgentStatus();
                    const activeOps = this.agentCoordinator.getActiveOperations();
                    const systemStatus = this.conflictPrevention.getSystemStatus();
                    const history = this._getChatHistory();
                    
                    let report = `📊 **Smart Agent Coordination Status**\\n\\n`;
                    report += `**Registered Agents**: ${agentStatus.size}\\n`;
                    report += `**Active Operations**: ${activeOps.size}\\n\\n`;
                    
                    if (agentStatus.size > 0) {
                        report += `**Agent Status**:\\n`;
                        Array.from(agentStatus.entries()).forEach(([id, agent]) => {
                            report += `- **${agent.name}**: ${agent.status} (Priority: ${agent.priority})\\n`;
                            if (agent.workingOn && agent.workingOn.length > 0) {
                                report += `  Working on: ${agent.workingOn.join(', ')}\\n`;
                            }
                        });
                        report += '\\n';
                    }
                    
                    report += `**Conflict Prevention**:\\n`;
                    report += `- Active Locks: ${systemStatus.activeLocks}\\n`;
                    report += `- Queued Operations: ${systemStatus.queuedOperations}\\n`;
                    report += `- Recent Conflicts: ${systemStatus.recentConflicts}`;
                    
                    history.push({ role: 'assistant', content: report });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    const history = this._getChatHistory();
                    history.push({ role: 'assistant', content: `❌ Failed to get coordination status: ${error.message}` });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                }
            }
        });
    }

    private async _updateWebview(history: { role: string; content: string; sessionId?: string }[]) {
        if (!this._view) {return;}

        const chatHtml = (await Promise.all(history.map(async (msg, index) => {
            let content: string;

            if (msg.role === 'assistant') {
                const raw = typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content, null, 2);
                content = await marked.parse(raw);
            } else {
                const escapedContent = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                content = `<p>${escapedContent}</p>`;
            }
            return `
                <div class="msg ${msg.role}" data-index="${index}">
                    <strong>${msg.role}:</strong>
                    <button class="delete-btn" data-index="${index}" title="Delete message">🗑️</button>
                    <div class="content">${content ?? '<pre><code>[No content]</code></pre>'}</div>
                </div>`;
        })));
        console.log('🎨 About to set webview HTML...');
        console.log('📄 HTML preview (first 500 chars):', this._getHtmlForWebview(chatHtml.join('')).substring(0, 500));
        this._view.webview.html = this._getHtmlForWebview(chatHtml.join(''));
        this._view.webview.postMessage({ command: 'setupEventListeners' });
    }

    private _getHtmlForWebview(chatBody?: string): string {
        console.log('🎨 Generating HTML for webview with Highlight.io...');
        console.log('🗺️ Chat body length:', chatBody?.length || 0);
        
        // Generate HTML using string concatenation to avoid template literal issues
        const baseHtml = this._generateWebviewHtml(chatBody || '');
        
        // Enhance with Highlight.io
        const highlight = getHighlight();
        const enhancedHtml = highlight.enhanceWebviewHTML(baseHtml);
        
        console.log('🔍 Enhanced HTML length:', enhancedHtml.length);
        console.log('🔍 HTML contains Highlight.io:', enhancedHtml.includes('highlight.io'));
        console.log('🔍 HTML contains tracking:', enhancedHtml.includes('highlightTrack'));
        
        return enhancedHtml;
    }
    
        private _generateWebviewHtml(chatBody: string): string {
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://static.highlight.io; connect-src 'self' https://pub.highlight.io https://otel.highlight.io; img-src 'self' data: https://static.highlight.io;">
    <title>AI Coding Assistant</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }
        .header {
            background: var(--vscode-titleBar-activeBackground);
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: space-between;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .theme-toggle-btn {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            height: 28px;
        }
        .theme-toggle-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: scale(1.05);
        }
        body.light-theme {
            --vscode-editor-background: #ffffff;
            --vscode-editor-foreground: #000000;
            --vscode-titleBar-activeBackground: #f3f3f3;
            --vscode-titleBar-activeForeground: #000000;
            --vscode-panel-background: #f8f8f8;
            --vscode-panel-border: #e0e0e0;
            --vscode-input-background: #ffffff;
            --vscode-input-foreground: #000000;
            --vscode-input-border: #cccccc;
            --vscode-button-background: #0078d4;
            --vscode-button-foreground: #ffffff;
            --vscode-button-secondaryBackground: #e1e1e1;
            --vscode-button-secondaryForeground: #000000;
            --vscode-textBlockQuote-background: #f0f0f0;
            --vscode-inputValidation-infoBorder: #e3f2fd;
        }
        body.dark-theme {
            --vscode-editor-background: #1e1e1e;
            --vscode-editor-foreground: #d4d4d4;
            --vscode-titleBar-activeBackground: #2d2d30;
            --vscode-titleBar-activeForeground: #cccccc;
            --vscode-panel-background: #252526;
            --vscode-panel-border: #3e3e42;
            --vscode-input-background: #3c3c3c;
            --vscode-input-foreground: #cccccc;
            --vscode-input-border: #3e3e42;
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-secondaryBackground: #3c3c3c;
            --vscode-button-secondaryForeground: #cccccc;
            --vscode-textBlockQuote-background: #2d2d30;
            --vscode-inputValidation-infoBorder: #007acc;
        }
        .header h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-titleBar-activeForeground);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff00;
            animation: pulse 2s infinite;
        }
        .terminal-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            cursor: help;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        .terminal-status:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        .terminal-indicator {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            transition: all 0.3s ease;
        }
        .terminal-idle {
            background: #6c757d;
        }
        .terminal-running {
            background: #28a745;
            animation: pulse 1s infinite;
        }
        .terminal-error {
            background: #dc3545;
            animation: pulse 0.5s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
        }
        #chat {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            scroll-behavior: smooth;
        }
        .msg {
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 8px;
            position: relative;
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .user {
            background: var(--vscode-inputValidation-infoBorder);
            border-left: 4px solid var(--vscode-charts-blue);
        }
        .assistant {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-charts-green);
        }
        .user strong { color: var(--vscode-charts-blue); }
        .assistant strong { color: var(--vscode-charts-green); }
        .input-section {
            background: var(--vscode-panel-background);
            border-top: 1px solid var(--vscode-panel-border);
            padding: 16px;
        }
        .input-row {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            align-items: center;
            flex-wrap: wrap;
        }
        textarea {
            width: 100%;
            min-height: 60px;
            padding: 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            transition: border-color 0.2s;
        }
        textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        select {
            padding: 6px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            font-size: 12px;
            min-width: 100px;
        }
        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            cursor: pointer;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .action-buttons {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 8px;
        }
        .copy-btn {
            position: absolute;
            right: 8px;
            top: 8px;
            padding: 4px 8px;
            font-size: 11px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .copy-btn:hover {
            opacity: 1;
        }
        pre {
            position: relative;
            background: var(--vscode-textCodeBlock-background);
            color: var(--vscode-editor-foreground);
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            line-height: 1.4;
        }
        .delete-btn {
            position: absolute;
            right: 8px;
            top: 8px;
            background: transparent;
            border: none;
            color: var(--vscode-errorForeground);
            font-size: 14px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s;
            padding: 4px;
            border-radius: 3px;
        }
        .delete-btn:hover {
            opacity: 1;
            background: var(--vscode-inputValidation-errorBackground);
        }
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }
        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }
        .terminal-session {
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            padding: 16px;
            border-radius: 6px;
            margin: 8px 0;
            position: relative;
        }
        .terminal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        .terminal-prompt {
            color: #569cd6;
            font-weight: bold;
        }
        .terminal-output {
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.4;
        }
        .terminal-stderr {
            color: #f48771;
        }
        .terminal-stdout {
            color: #d4d4d4;
        }
        .kill-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
        }
        .kill-btn:hover {
            background: #c82333;
        }
        .terminal-status {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #333;
            font-size: 11px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <div class="status-dot"></div>
            <h3>🤖 AI Coding Assistant</h3>
        </div>
        <div class="header-right">
            <button id="theme-toggle" class="theme-toggle-btn" title="Toggle Dark/Light Theme">
                <span id="theme-icon">🌙</span>
            </button>
            <div class="terminal-status" id="terminal-status">
                <div class="terminal-indicator terminal-idle" id="terminal-indicator"></div>
                <span id="terminal-text">Terminal: Idle</span>
            </div>
        </div>
    </div>
    
    <div id="chat">${chatBody || '<div class="msg assistant"><strong>assistant:</strong><button class="delete-btn" data-index="0" title="Delete message">🗑️</button><div class="content"><p>👋 Hi there! How can I help you today?</p></div></div>'}</div>

    <div class="input-section">
        <textarea id="prompt" placeholder="💬 Full project control: 'solve my build error', 'create app.js with server', 'fix dependency issues'..."></textarea>
        
        <div class="input-row">
            <select id="provider-select">
                <option value="groq">🚀 Groq</option>
                <option value="together">🤝 Together.ai</option>
                <option value="openrouter">🌐 OpenRouter</option>
                <option value="mistral">🔮 Mistral</option>
                <option value="cerebras">🧠 Cerebras</option>
            </select>
            
            <select id="model-select"></select>
            
            <label class="checkbox-label">
                <input type="checkbox" id="use-web" />🌐 Web Search
            </label>
            
            <button id="send-button" class="btn btn-primary">✨ Send</button>
        </div>
        
        <div class="action-buttons">
            <button id="clear-history-button" class="btn btn-secondary">🗑️ Clear</button>
            <button id="multi-file-help-button" class="btn btn-secondary">📄 Files</button>
            <button id="shell-help-button" class="btn btn-secondary">💻 Shell</button>
            <button id="run-command-button" class="btn btn-secondary">⚡ Run</button>
            <button id="terminal-status-button" class="btn btn-secondary">📊 Status</button>
            <button id="new-terminal-button" class="btn btn-secondary">➕ Terminal</button>
            <button id="terminal-history-button" class="btn btn-secondary">📅 History</button>
            <button id="productivity-dashboard-button" class="btn btn-secondary">📈 Dashboard</button>
            <button id="code-smell-detector-button" class="btn btn-secondary">🔍 Smell</button>
            <button id="refresh-codebase-button" class="btn btn-secondary">🔄 Refresh</button>
            <button id="project-info-button" class="btn btn-secondary">📊 Info</button>
            <button id="suggest-files-button" class="btn btn-secondary">💡 Suggest</button>
            <button id="diff-viewer-button" class="btn btn-secondary">📊 Diff</button>
            <button id="nlp-help-button" class="btn btn-secondary">🧠 NLP Help</button>
            <button id="file-help-button" class="btn btn-secondary">📁 File Ops</button>
            <button id="issue-help-button" class="btn btn-secondary">🔧 Issues</button>
            
            <!-- Enhanced Feature Buttons -->
            <button id="enhanced-nlp-terminal-button" class="btn btn-secondary">⚡ Enhanced Terminal</button>
            <button id="activity-dashboard-button" class="btn btn-secondary">📊 Activity</button>
            <button id="live-changes-button" class="btn btn-secondary">🔄 Live Changes</button>
            <button id="coordination-test-button" class="btn btn-secondary">🧪 Test Agents</button>
            <button id="multi-agent-help-button" class="btn btn-secondary">🤖 Smart Agents</button>
            <button id="coordination-status-button" class="btn btn-secondary">📊 Coordination</button>
        </div>
    </div>
    <script>
        (function() {
            // ✅ Acquire the VSCode API once at the top of the script.
            const vscode = acquireVsCodeApi();
            vscode.postMessage({ command: 'debugLog', message: '🎆 CRITICAL: WebView JS is executing!' });
            vscode.postMessage({ command: 'webviewReady', timestamp: new Date().toISOString() });

            // Track with Highlight.io if available
            if (typeof window.highlightTrack !== 'undefined') {
                window.highlightTrack.customEvent('webview_js_execution_confirmed', {
                    timestamp: new Date().toISOString(),
                    test_type: 'immediate_execution'
                });
            }

            const providerModelMap = {
                groq: {
                    "meta-llama/llama-4-maverick-17b-128e-instruct": "Meta/Llama",
                    "llama-3.3-70b-versatile": "LLaMA 3.3",
                    "deepseek-r1-distill-llama-70b": "Deepseek R1",
                    "gemma2-9b-it": "Gemma"
                },
                together: {
                    "together/deepseek-ai/DeepSeek-R1-0528":"Deepseek R1",
                    "together/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free":"Meta/Llama-Turbo",
                    "together/lgai/exaone-3-5-32b-instruct":"LGAI x1",
                },
                openrouter: {
                    "openrouter/mistral-7b": "Mistral 7B",
                    "openrouter/codellama-13b": "Code LLaMA"
                },
                mistral: {
                    "mistral-small-latest": "Mistral Small",
                    "mistral-medium-latest": "Mistral Medium",
                    "mistral-large-latest": "Mistral Large"
                },
                cerebras: {
                    "llama-4-scout-17b-16e-instruct": "LLaMA-4 Scout 17B",
                    "llama3.1-8b": "LLaMA 3.1-8B",
                    "llama-3.3-70b": "LLaMA 3.3‑70B",
                    "llama-4-maverick-17b-128e": "LLaMA 4 Maverick",
                    "qwen-3-32b": "QWEN‑3 32B",
                    "qwen-3-235b-a22b": "QWEN‑3 235B",
                    "deepseek-r1-distill-llama-70b": "DeepSeek R1 (preview)"
                }
            };

            function initializeEventListeners() {
                try {
                    vscode.postMessage({ command: 'debugLog', message: 'Event listener init started' });

                    const sendBtn = document.getElementById('send-button');
                    if (sendBtn) sendBtn.addEventListener('click', sendPrompt);

                    const promptArea = document.getElementById('prompt');
                    if (promptArea) {
                        promptArea.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendPrompt();
                            }
                        });
                    }
                    
                    document.getElementById('clear-history-button')?.addEventListener('click', () => vscode.postMessage({ command: 'clearChatHistory' }));
                    document.getElementById('multi-file-help-button')?.addEventListener('click', showMultiFileHelp);
                    document.getElementById('refresh-codebase-button')?.addEventListener('click', () => vscode.postMessage({ command: 'refreshCodebase' }));
                    document.getElementById('shell-help-button')?.addEventListener('click', showShellHelp);
                    document.getElementById('run-command-button')?.addEventListener('click', runCommand);
                    document.getElementById('project-info-button')?.addEventListener('click', () => vscode.postMessage({ command: 'showProjectInfo' }));
                    document.getElementById('suggest-files-button')?.addEventListener('click', () => vscode.postMessage({ command: 'suggestFiles' }));
                    document.getElementById('terminal-status-button')?.addEventListener('click', showTerminalStatus);
                    document.getElementById('nlp-help-button')?.addEventListener('click', showNLPHelp);
                    document.getElementById('file-help-button')?.addEventListener('click', showFileHelp);
                    document.getElementById('issue-help-button')?.addEventListener('click', showIssueHelp);
                    document.getElementById('diff-viewer-button')?.addEventListener('click', showDiffOptions);
                    document.getElementById('new-terminal-button')?.addEventListener('click', createNewTerminal);
                    document.getElementById('terminal-history-button')?.addEventListener('click', showTerminalHistory);
                    document.getElementById('productivity-dashboard-button')?.addEventListener('click', showProductivityDashboard);
                    document.getElementById('code-smell-detector-button')?.addEventListener('click', showCodeSmellOptions);
                    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
                    
                    // Enhanced feature event listeners
                    document.getElementById('enhanced-nlp-terminal-button')?.addEventListener('click', showEnhancedNLPTerminalHelp);
                    document.getElementById('activity-dashboard-button')?.addEventListener('click', showActivityDashboard);
                    document.getElementById('live-changes-button')?.addEventListener('click', showLiveChanges);
                    document.getElementById('coordination-test-button')?.addEventListener('click', testAgentCoordination);
                    document.getElementById('multi-agent-help-button')?.addEventListener('click', showMultiAgentHelp);
                    document.getElementById('coordination-status-button')?.addEventListener('click', showCoordinationStatus);
                    
                    const providerSelect = document.getElementById('provider-select');
                    if (providerSelect) {
                        providerSelect.addEventListener('change', updateModelDropdown);
                        updateModelDropdown(); // Populate models on initial load
                    }
                    
                    // Restore saved state
                    const state = vscode.getState();
                    if (state?.selectedProvider && providerSelect) {
                        providerSelect.value = state.selectedProvider;
                        updateModelDropdown(); // Update models for the restored provider
                        if (state.selectedModel) {
                           setTimeout(() => { // Timeout ensures options are populated
                                const modelSelect = document.getElementById('model-select');
                                if (modelSelect) modelSelect.value = state.selectedModel;
                           }, 50);
                        }
                    }

                    // Apply theme
                    const savedTheme = vscode.getState()?.theme || 'dark';
                    applyTheme(savedTheme);

                    // Initialize copy/delete buttons for existing messages
                    document.querySelectorAll('pre').forEach(pre => {
                        if (pre.querySelector('.copy-btn')) return; // Avoid adding multiple buttons
                        const button = document.createElement('button');
                        button.innerText = 'Copy';
                        button.className = 'copy-btn';
                        button.onclick = () => {
                            navigator.clipboard.writeText(pre.innerText);
                            button.innerText = 'Copied!';
                            setTimeout(() => (button.innerText = 'Copy'), 1500);
                        };
                        pre.prepend(button);
                    });

                    document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const index = e.currentTarget.getAttribute('data-index');
                            vscode.postMessage({ command: 'deleteMessage', index: parseInt(index, 10) });
                        });
                    });
                    
                    vscode.postMessage({ command: 'debugLog', message: 'All event listeners attached' });
                } catch (error) {
                    console.error('❌ Event listener initialization failed:', error);
                    vscode.postMessage({ command: 'webviewError', error: error.message, stack: error.stack });
                }
            }
            
            function updateModelDropdown() {
                const providerSelect = document.getElementById('provider-select');
                const modelSelect = document.getElementById('model-select');
                const provider = providerSelect.value;
                
                if (!modelSelect) return;
                
                modelSelect.innerHTML = '';
                const models = providerModelMap[provider] || {};
                
                for (const modelValue in models) {
                    const option = document.createElement('option');
                    option.value = modelValue;
                    option.textContent = models[modelValue];
                    modelSelect.appendChild(option);
                }
            }

            function sendPrompt() {
                const textArea = document.getElementById('prompt');
                const providerSelect = document.getElementById('provider-select');
                const modelSelect = document.getElementById('model-select');
                const useWebCheckbox = document.getElementById('use-web');

                const text = textArea ? textArea.value : '';
                const provider = providerSelect ? providerSelect.value : 'groq';
                const model = modelSelect ? modelSelect.value : 'llama-3.3-70b-versatile';
                const useWeb = useWebCheckbox ? useWebCheckbox.checked : false;

                if (text.trim()) {
                    vscode.setState({ selectedProvider: provider, selectedModel: model, theme: document.body.classList.contains('light-theme') ? 'light' : 'dark' });
                    vscode.postMessage({ command: 'sendPrompt', text, provider, model, useWeb, codeOnly: false });
                    if (textArea) textArea.value = '';
                }
            }

            // --- Helper Functions for Buttons ---
            // ✅ All helper functions are now defined only ONCE.

            function showMultiFileHelp() {
                alert('Multi-File Generation Help:\\n\\nNatural Language:\\n• "Create a React app with components and styles"\\n\\nStructured Syntax:\\ngenerate files: filename1:prompt1, filename2:prompt2');
            }

            function showShellHelp() {
                alert('Enhanced Shell Execution:\\n\\n🎯 Smart NLP Commands:\\n• "install dependencies", "start server", "run tests"\\n\\n⚡ Direct Commands:\\n• "run npm install", "execute git status"');
            }

            function runCommand() {
                const command = prompt('Enter shell command to execute:');
                if (command && command.trim()) {
                    const textArea = document.getElementById('prompt');
                    textArea.value = 'run ' + command.trim();
                    sendPrompt();
                }
            }
            
            function showTerminalStatus() {
                vscode.postMessage({ command: 'getTerminalStatus' });
            }

            function createNewTerminal() {
                const sessionName = prompt('Enter terminal session name (optional):');
                vscode.postMessage({
                    command: 'createTerminalSession',
                    sessionName: sessionName || 'Terminal ' + (Date.now() % 1000)
                });
            }

            function showTerminalHistory() {
                const choice = prompt('Terminal History Options:\\n1. Show recent\\n2. Search history\\n3. Show frequent\\n4. Show stats\\n5. Export\\n6. Clear history\\nEnter number:');
                switch(choice) {
                    case '1': vscode.postMessage({ command: 'getRecentCommands', limit: 10 }); break;
                    case '2': const query = prompt('Enter search query:'); if (query) vscode.postMessage({ command: 'searchHistory', query }); break;
                    case '3': vscode.postMessage({ command: 'getFrequentCommands', limit: 10 }); break;
                    case '4': vscode.postMessage({ command: 'getHistoryStats' }); break;
                    case '5': vscode.postMessage({ command: 'exportHistory' }); break;
                    case '6': if (confirm('Are you sure?')) vscode.postMessage({ command: 'clearHistory' }); break;
                }
            }

            function showProductivityDashboard() {
                const choice = prompt('Productivity Dashboard:\\n1. Today\\'s stats\\n2. Weekly trend\\n3. Full report\\n4. Metrics\\n5. Clear data\\nEnter number:');
                switch(choice) {
                    case '1': vscode.postMessage({ command: 'getTodayStats' }); break;
                    case '2': vscode.postMessage({ command: 'getWeeklyTrend' }); break;
                    case '3': vscode.postMessage({ command: 'generateProductivityReport' }); break;
                    case '4': vscode.postMessage({ command: 'getProductivityMetrics' }); break;
                    case '5': if (confirm('Are you sure?')) vscode.postMessage({ command: 'clearProductivityData' }); break;
                }
            }

            function showCodeSmellOptions() {
                const choice = prompt('Code Smell Detection:\\n1. Analyze current file\\n2. Analyze workspace\\n3. Generate report\\nEnter number:');
                switch(choice) {
                    case '1': vscode.postMessage({ command: 'analyzeCurrentFile' }); break;
                    case '2': vscode.postMessage({ command: 'analyzeWorkspace' }); break;
                    case '3': vscode.postMessage({ command: 'generateCodeQualityReport' }); break;
                }
            }
            
            function showDiffOptions() {
                const choice = prompt('Choose diff option:\\n1. Compare two files\\n2. Compare selection with clipboard\\nEnter number:');
                if (choice === '1') vscode.postMessage({ command: 'sendPrompt', text: 'compare two files' });
                else if (choice === '2') vscode.postMessage({ command: 'sendPrompt', text: 'compare selection with clipboard' });
            }

            function showNLPHelp() {
                alert('🧠 NLP Project Control Help:\\n\\n• "analyze project structure"\\n• "use agents to create API routes"\\n• "generate files: api.js, test.js"');
            }
            
            function showFileHelp() {
                alert('📁 File Management Help:\\n\\n• "create app.js with express server"\\n• "edit package.json to add dependency"\\n• "smart create React component with tests"');
            }

            function showIssueHelp() {
                alert('🔧 Project Issue Solver Help:\\n\\n• "solve my build error"\\n• "fix dependency problem"\\n• "debug runtime error"');
            }
            
            // Enhanced Feature Functions
            function showEnhancedNLPTerminalHelp() {
                alert('⚡ Enhanced NLP Terminal Help:\\n\\n🧠 Smart Commands:\\n• "list files in current directory"\\n• "check git status with details"\\n• "install dependencies for this project"\\n• "run tests and show output"\\n\\n✨ Features:\\n• Context-aware command generation\\n• Risk assessment and confirmation\\n• Real-time output streaming\\n• Agent coordination support');
            }
            
            function showActivityDashboard() {
                vscode.postMessage({ command: 'showActivityDashboard' });
            }
            
            function showLiveChanges() {
                vscode.postMessage({ command: 'showLiveChanges' });
            }
            
            function testAgentCoordination() {
                const testPrompt = prompt('Enter test prompt for agent coordination:', 'create React app with backend API');
                if (testPrompt && testPrompt.trim()) {
                    vscode.postMessage({ command: 'testAgentCoordination', prompt: testPrompt.trim() });
                }
            }
            
            function showMultiAgentHelp() {
                alert('🤖 Smart Multi-Agent Coordination Help:\\n\\n🌟 Enhanced Commands:\\n• "smart multi-agent create app.js, styles.css"\\n• "intelligent agents generate Python project"\\n• "coordinated agents edit config files"\\n\\n✨ Features:\\n• 🔒 Automatic conflict prevention\\n• 🎯 Smart agent assignment\\n• ⏱️ Real-time coordination tracking\\n• 📊 Live progress monitoring\\n• 🔄 Dependency resolution\\n• ⚡ Queue management');
            }
            
            function showCoordinationStatus() {
                vscode.postMessage({ command: 'showCoordinationStatus' });
            }
            
            function toggleTheme() {
                const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
                applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
            }
            
            function applyTheme(theme) {
                document.body.classList.remove('light-theme', 'dark-theme');
                document.body.classList.add(theme + '-theme');
                document.getElementById('theme-icon').textContent = theme === 'dark' ? '🌙' : '☀️';
                const currentState = vscode.getState() || {};
                vscode.setState({ ...currentState, theme });
            }

            function scrollToBottom() {
                const chat = document.getElementById('chat');
                if (chat) chat.scrollTop = chat.scrollHeight;
            }

            // --- Message Handling from Extension ---
            
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command || message.type) {
                    case 'setupEventListeners':
                        initializeEventListeners();
                        scrollToBottom();
                        break;
                    case 'statusUpdate':
                        updateTerminalStatus(message);
                        break;
                    // Additional handlers for live terminal can go here
                }
            });

            function updateTerminalStatus(message) {
                const indicator = document.getElementById('terminal-indicator');
                const text = document.getElementById('terminal-text');
                if (!indicator || !text) return;

                indicator.className = 'terminal-indicator'; // Reset classes
                if (message.status === 'running') {
                    indicator.classList.add('terminal-running');
                    text.textContent = \`💻 \${message.runningCommands} running\`;
                } else if (message.status === 'error') {
                    indicator.classList.add('terminal-error');
                    text.textContent = '⚠️ Terminal Error';
                } else {
                    indicator.classList.add('terminal-idle');
                    text.textContent = '💤 Terminal Idle';
                }
            }

            // Initial setup on script load
            initializeEventListeners();
            scrollToBottom();
            
        })();
    </script>
</body>
</html>
        `;
        
        return html;
    }

    private _getChatHistory(): { role: string; content: string; sessionId?: string }[] {
        return this._context.globalState.get('AIChatHistory', []);
    }

    private _saveChatHistory(history: { role: string; content: string; sessionId?: string }[]) {
        this._context.globalState.update('AIChatHistory', history);
    }

    private async _analyzeProject(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return '❌ No workspace folder open. Please open a project folder to analyze.';
        }

        const analysisPrompt = `Analyze this project structure and provide insights:

${this._projectcontext}

Provide:
1. 📊 **Project Type**: What kind of project this is
2. 🛠️ **Tech Stack**: Technologies and frameworks used
3. 📁 **File Structure**: Current organization
4. ✅ **Strengths**: What's well implemented
5. ⚠️ **Issues**: Potential problems or missing elements
6. 💡 **Recommendations**: Suggested improvements

Format as markdown with clear sections.`;

        try {
            const analysis = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', analysisPrompt);
            return `📊 **Project Analysis**\n\n${analysis}`;
        } catch (error: any) {
            return `❌ Failed to analyze project: ${error.message}`;
        }
    }

    private async _suggestProjectFiles(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return '❌ No workspace folder open. Please open a project folder to get suggestions.';
        }

        const suggestionPrompt = `Based on this project structure, suggest missing files that should be added:

${this._projectcontext}

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

        try {
            const suggestions = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', suggestionPrompt);
            return `💡 **File Suggestions for Your Project**\n\n${suggestions}`;
        } catch (error: any) {
            return `❌ Failed to generate suggestions: ${error.message}`;
        }
    }

    private _isShellCommand(prompt: string): boolean {
        return InlineShell.isShellCommand(prompt);
    }

    private _isProjectCommand(prompt: string): boolean {
        const projectKeywords = [
            'show', 'open', 'display', 'find', 'search', 'locate',
            'list', 'get', 'view', 'delete', 'remove', 'modify',
            'update', 'change', 'set', 'configure', 'install'
        ];
        
        return projectKeywords.some(keyword => 
            prompt.toLowerCase().includes(keyword)
        );
    }

    private shouldUseMultiAgentCoordination(prompt: string): boolean {
        const promptLower = prompt.toLowerCase();
        
        // File creation/editing patterns that should use multi-agent coordination
        const multiAgentPatterns = [
            // Direct file operations without extensions
            promptLower.includes('create') && !prompt.includes('.') && (
                promptLower.includes('server') ||
                promptLower.includes('api') ||
                promptLower.includes('component') ||
                promptLower.includes('config') ||
                promptLower.includes('database') ||
                promptLower.includes('handler') ||
                promptLower.includes('service') ||
                promptLower.includes('utility') ||
                promptLower.includes('project')
            ),
            // Technology-specific creation requests
            promptLower.includes('express') && promptLower.includes('create'),
            promptLower.includes('react') && promptLower.includes('create'),
            promptLower.includes('python') && promptLower.includes('create'),
            promptLower.includes('django') && promptLower.includes('create'),
            promptLower.includes('fastapi') && promptLower.includes('create'),
            promptLower.includes('flask') && promptLower.includes('create'),
            promptLower.includes('vue') && promptLower.includes('create'),
            promptLower.includes('angular') && promptLower.includes('create'),
            // Multi-file operations
            promptLower.includes('generate') && (
                promptLower.includes('project') ||
                promptLower.includes('application') ||
                promptLower.includes('app')
            ),
            promptLower.includes('make') && !prompt.includes('.') && (
                promptLower.includes('server') ||
                promptLower.includes('api') ||
                promptLower.includes('component')
            ),
            promptLower.includes('build') && (
                promptLower.includes('project') ||
                promptLower.includes('application') ||
                promptLower.includes('system')
            )
        ];
        
        return multiAgentPatterns.some(pattern => pattern === true);
    }
    
    private formatDuration(milliseconds: number): string {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}
