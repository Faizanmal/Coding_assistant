import * as vscode from 'vscode';
import { marked } from 'marked';
import { getprojectcontext } from './extension';
import { createHighlighter, Highlighter } from 'shiki';
import { generateCode } from './codegenerator';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { EditTracker } from './edittracker';
import { SecurityUtils } from './utils/sanitizer';

interface AgentStatus {
    id: string;
    name: string;
    status: 'idle' | 'processing' | 'waiting' | 'error';
    currentTask?: string;
    progress: number;
    priority: number;
    workingOn: string[];
}

interface SidebarState {
    activeAgents: Map<string, AgentStatus>;
    currentOperations: string[];
    nlpHistory: Array<{
        prompt: string;
        understanding: string;
        timestamp: number;
    }>;
    codebaseInsights: {
        totalFiles: number;
        languages: string[];
        complexityScore: number;
        lastAnalyzed: number;
    };
}

export class EnhancedSidebarUI implements vscode.WebviewViewProvider {
    public static readonly viewType = 'enhancedSidebar';
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _highlighter?: Highlighter;
    private _projectContext: string;
    private _sidebarState: SidebarState;
    private _agentCoordinator: SmartAgentCoordinator;
    private _nlpEngine: EnhancedNLPEngine;
    private _knowledgeSystem: ProjectKnowledgeSystem;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._projectContext = '';
        this._agentCoordinator = SmartAgentCoordinator.getInstance();
        this._nlpEngine = EnhancedNLPEngine.getInstance();
        this._knowledgeSystem = ProjectKnowledgeSystem.getInstance();
        
        this._sidebarState = {
            activeAgents: new Map(),
            currentOperations: [],
            nlpHistory: [],
            codebaseInsights: {
                totalFiles: 0,
                languages: [],
                complexityScore: 0,
                lastAnalyzed: 0
            }
        };

        this._initializeHighlighter();
        this._loadProjectContext();
        this._startRealTimeUpdates();
    }

    private async _initializeHighlighter() {
        try {
            const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark 
                ? 'github-dark' 
                : 'github-light';
            this._highlighter = await createHighlighter({
                themes: [theme],
                langs: ['markdown', 'javascript', 'typescript', 'python', 'json']
            });
        } catch (error) {
            console.error('Failed to initialize highlighter:', error);
        }
    }

    private async _loadProjectContext() {
        try {
            this._projectContext = await getprojectcontext();
        } catch (error) {
            console.error('Failed to load project context:', error);
        }
    }

    private _startRealTimeUpdates() {
        // Update agent status every 2 seconds
        setInterval(() => {
            this._updateAgentStatus();
        }, 2000);

        // Update codebase insights every 30 seconds
        setInterval(() => {
            this._updateCodebaseInsights();
        }, 30000);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this._handleMessage(data);
        });

        // Initial update
        this._updateView();
    }

    private async _handleMessage(message: any) {
        switch (message.command) {
            case 'sendPrompt':
                await this._handlePrompt(message.text, message.options);
                break;
            case 'createFiles':
                await this._handleFileCreation(message.request);
                break;
            case 'analyzeCodebase':
                await this._analyzeCodebase();
                break;
            case 'pauseAgent':
                await this._pauseAgent(message.agentId);
                break;
            case 'resumeAgent':
                await this._resumeAgent(message.agentId);
                break;
            case 'showAgentDetails':
                await this._showAgentDetails(message.agentId);
                break;
            case 'nlpHelp':
                await this._showNLPHelp();
                break;
            case 'clearHistory':
                await this._clearHistory();
                break;
        }
    }

    private async _handlePrompt(prompt: string, options: any = {}) {
        if (!this._view) {
            return;
        }

        try {
            // Enhanced NLP understanding
            const understanding = await this._nlpEngine.analyzeUserIntent(prompt);
            
            // Add to NLP history
            this._sidebarState.nlpHistory.push({
                prompt,
                understanding: understanding.intent,
                timestamp: Date.now()
            });

            // Determine the best approach
            if (understanding.requiresMultiAgent) {
                await this._handleMultiAgentRequest(prompt, understanding);
            } else if (understanding.isFileOperation) {
                await this._handleFileOperation(prompt, understanding);
            } else {
                await this._handleGeneralQuery(prompt, understanding);
            }

            this._updateView();
        } catch (error: any) {
            console.error('Error handling prompt:', error);
            this._postMessage({
                command: 'error',
                message: `Error: ${error.message}`
            });
        }
    }

    private async _handleMultiAgentRequest(prompt: string, understanding: any) {
        const operationId = EditTracker.startBatchOperation(
            `Multi-agent: ${prompt}`,
            'EnhancedSidebarUI'
        );

        this._sidebarState.currentOperations.push(operationId);

        // Coordinate agents
        const result = await this._agentCoordinator.processMultiAgentRequest(prompt);
        
        this._postMessage({
            command: 'multiAgentResult',
            result,
            operationId
        });

        EditTracker.finishBatchOperation(operationId);
        this._sidebarState.currentOperations = this._sidebarState.currentOperations.filter(
            id => id !== operationId
        );
    }

    private async _handleFileCreation(request: string) {
        try {
            // Parse file creation request
            const files = await this._nlpEngine.parseFileCreationRequest(request);
            
            if (files.length === 0) {
                this._postMessage({
                    command: 'error',
                    message: 'No files could be parsed from the request'
                });
                return;
            }

            // Create files with agent coordination
            const results = await Promise.all(
                files.map(async (file: any) => {
                    const agent = await this._agentCoordinator.assignBestAgent(file);
                    return await this._createFileWithAgent(file, agent);
                })
            );

            this._postMessage({
                command: 'fileCreationResult',
                results
            });
        } catch (error: any) {
            this._postMessage({
                command: 'error',
                message: `File creation failed: ${error.message}`
            });
        }
    }

    private async _createFileWithAgent(fileSpec: any, agent: any) {
        const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Update agent status
        this._sidebarState.activeAgents.set(agentId, {
            id: agentId,
            name: agent.name,
            status: 'processing',
            currentTask: `Creating ${fileSpec.fileName}`,
            progress: 0,
            priority: agent.priority,
            workingOn: [fileSpec.fileName]
        });

        try {
            // Generate code with the assigned agent
            const code = await generateCode(
                `${agent.enhancedPrompt}\n\nFile: ${fileSpec.fileName}\nRequirements: ${fileSpec.prompt}`,
                agent.model
            );

            // Update progress
            const agentStatus = this._sidebarState.activeAgents.get(agentId)!;
            agentStatus.progress = 50;
            agentStatus.currentTask = `Writing ${fileSpec.fileName}`;

            // Write file
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileSpec.fileName);
                await vscode.workspace.fs.writeFile(filePath, Buffer.from(code, 'utf8'));
                
                // Complete agent task
                agentStatus.status = 'idle';
                agentStatus.progress = 100;
                agentStatus.currentTask = undefined;
                agentStatus.workingOn = [];

                return {
                    success: true,
                    fileName: fileSpec.fileName,
                    agent: agent.name
                };
            }
        } catch (error: any) {
            // Update agent status on error
            const agentStatus = this._sidebarState.activeAgents.get(agentId);
            if (agentStatus) {
                agentStatus.status = 'error';
                agentStatus.currentTask = `Error: ${error.message}`;
            }
            
            return {
                success: false,
                fileName: fileSpec.fileName,
                error: error.message,
                agent: agent.name
            };
        }
    }

    private async _analyzeCodebase() {
        try {
            const analysis = await this._knowledgeSystem.analyzeProject();
            
            this._sidebarState.codebaseInsights = {
                totalFiles: analysis.totalFiles,
                languages: analysis.languages,
                complexityScore: analysis.complexityScore,
                lastAnalyzed: Date.now()
            };

            this._postMessage({
                command: 'codebaseAnalysis',
                insights: this._sidebarState.codebaseInsights,
                analysis
            });
        } catch (error: any) {
            this._postMessage({
                command: 'error',
                message: `Codebase analysis failed: ${error.message}`
            });
        }
    }

    private async _updateAgentStatus() {
        if (!this._view) {
            return;
        }

        const coordinatorStatus = this._agentCoordinator.getAgentStatus();
        const activeOps = this._agentCoordinator.getActiveOperations();

        this._postMessage({
            command: 'agentStatusUpdate',
            agents: Array.from(this._sidebarState.activeAgents.values()),
            operations: Array.from(activeOps.values())
        });
    }

    private async _updateCodebaseInsights() {
        await this._analyzeCodebase();
    }

    private _updateView() {
        if (!this._view) {
            return;
        }
        this._view.webview.html = this._getHtmlForWebview();
    }

    private _postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced AI Sidebar</title>
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
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: var(--vscode-titleBar-activeBackground);
            padding: 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-titleBar-activeForeground);
        }

        .status-indicators {
            display: flex;
            gap: 12px;
            margin-top: 8px;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        .main-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .section {
            margin-bottom: 24px;
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
        }

        .section-header {
            background: var(--vscode-tab-activeBackground);
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
        }

        .section-content {
            padding: 16px;
        }

        .section.collapsed .section-content {
            display: none;
        }

        .agent-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 12px;
        }

        .agent-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 12px;
            transition: all 0.2s ease;
        }

        .agent-card:hover {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .agent-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .agent-name {
            font-weight: 600;
            font-size: 14px;
        }

        .agent-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        .agent-status.processing {
            background: #ffa500;
            color: white;
        }

        .agent-status.idle {
            background: #28a745;
            color: white;
        }

        .agent-status.error {
            background: #dc3545;
            color: white;
        }

        .agent-progress {
            margin: 8px 0;
        }

        .progress-bar {
            width: 100%;
            height: 6px;
            background: var(--vscode-progressBar-background);
            border-radius: 3px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-foreground);
            transition: width 0.3s ease;
        }

        .agent-task {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .input-section {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .prompt-input {
            width: 100%;
            min-height: 80px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
            color: var(--vscode-input-foreground);
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
        }

        .input-controls {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
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

        .nlp-history {
            max-height: 200px;
            overflow-y: auto;
        }

        .nlp-item {
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }

        .nlp-prompt {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .nlp-understanding {
            color: var(--vscode-descriptionForeground);
        }

        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
        }

        .insight-card {
            text-align: center;
            padding: 12px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
        }

        .insight-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--vscode-charts-blue);
        }

        .insight-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .operations-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .operation-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 12px;
        }

        .expand-toggle {
            background: none;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 16px;
        }

        .loading-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: var(--vscode-progressBar-foreground);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .empty-state {
            text-align: center;
            padding: 32px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .quick-actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            margin-top: 12px;
        }

        .quick-action {
            padding: 8px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .quick-action:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>🚀 Enhanced AI Sidebar</h2>
        <div class="status-indicators">
            <div class="status-indicator">
                <span id="agent-count">0</span> Agents
            </div>
            <div class="status-indicator">
                <span id="operation-count">0</span> Operations
            </div>
            <div class="status-indicator">
                <span id="files-count">0</span> Files
            </div>
        </div>
    </div>

    <div class="main-content">
        <!-- Input Section -->
        <div class="input-section">
            <textarea 
                id="prompt-input" 
                class="prompt-input" 
                placeholder="🧠 Tell me what you want to create... I understand natural language and coordinate multiple agents!

Examples:
• &quot;Create a React todo app with authentication&quot;
• &quot;Build me a Python FastAPI server with database&quot;
• &quot;Set up a full-stack e-commerce project&quot;
• &quot;Analyze my codebase and suggest improvements&quot;"
            ></textarea>
            <div class="input-controls">
                <button class="btn btn-primary" onclick="sendPrompt()">
                    <span>🚀</span> Create with AI
                </button>
                <button class="btn btn-secondary" onclick="analyzeCodebase()">
                    <span>🔍</span> Analyze Project
                </button>
                <button class="btn btn-secondary" onclick="showNLPHelp()">
                    <span>🧠</span> NLP Help
                </button>
            </div>
            <div class="quick-actions">
                <button class="quick-action" onclick="quickPrompt('create React app')">React App</button>
                <button class="quick-action" onclick="quickPrompt('create Python API')">Python API</button>
                <button class="quick-action" onclick="quickPrompt('setup database')">Database</button>
                <button class="quick-action" onclick="quickPrompt('create tests')">Tests</button>
                <button class="quick-action" onclick="quickPrompt('add authentication')">Auth</button>
                <button class="quick-action" onclick="quickPrompt('create documentation')">Docs</button>
            </div>
        </div>

        <!-- Active Agents Section -->
        <div class="section" id="agents-section">
            <div class="section-header" onclick="toggleSection('agents-section')">
                <span>🤖 Active Agents</span>
                <button class="expand-toggle">▼</button>
            </div>
            <div class="section-content">
                <div id="agents-grid" class="agent-grid">
                    <div class="empty-state">
                        <div class="empty-state-icon">🤖</div>
                        <p>No active agents</p>
                        <small>Agents will appear here when processing your requests</small>
                    </div>
                </div>
            </div>
        </div>

        <!-- Current Operations Section -->
        <div class="section" id="operations-section">
            <div class="section-header" onclick="toggleSection('operations-section')">
                <span>⚙️ Current Operations</span>
                <button class="expand-toggle">▼</button>
            </div>
            <div class="section-content">
                <div id="operations-list" class="operations-list">
                    <div class="empty-state">
                        <div class="empty-state-icon">⚙️</div>
                        <p>No active operations</p>
                        <small>File operations and tasks will appear here</small>
                    </div>
                </div>
            </div>
        </div>

        <!-- Codebase Insights Section -->
        <div class="section" id="insights-section">
            <div class="section-header" onclick="toggleSection('insights-section')">
                <span>💡 Codebase Insights</span>
                <button class="expand-toggle">▼</button>
            </div>
            <div class="section-content">
                <div class="insights-grid">
                    <div class="insight-card">
                        <div class="insight-value" id="total-files">0</div>
                        <div class="insight-label">Total Files</div>
                    </div>
                    <div class="insight-card">
                        <div class="insight-value" id="languages-count">0</div>
                        <div class="insight-label">Languages</div>
                    </div>
                    <div class="insight-card">
                        <div class="insight-value" id="complexity-score">0</div>
                        <div class="insight-label">Complexity</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- NLP Understanding History Section -->
        <div class="section" id="nlp-section">
            <div class="section-header" onclick="toggleSection('nlp-section')">
                <span>🧠 NLP Understanding</span>
                <button class="expand-toggle">▼</button>
            </div>
            <div class="section-content">
                <div id="nlp-history" class="nlp-history">
                    <div class="empty-state">
                        <div class="empty-state-icon">🧠</div>
                        <p>No NLP history</p>
                        <small>Your prompts and AI understanding will appear here</small>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function sendPrompt() {
            const input = document.getElementById('prompt-input');
            const text = input.value.trim();
            if (text) {
                vscode.postMessage({
                    command: 'sendPrompt',
                    text: text,
                    options: {}
                });
                input.value = '';
            }
        }

        function quickPrompt(text) {
            document.getElementById('prompt-input').value = text;
            sendPrompt();
        }

        function analyzeCodebase() {
            vscode.postMessage({ command: 'analyzeCodebase' });
        }

        function showNLPHelp() {
            vscode.postMessage({ command: 'nlpHelp' });
        }

        function toggleSection(sectionId) {
            const section = document.getElementById(sectionId);
            section.classList.toggle('collapsed');
            const toggle = section.querySelector('.expand-toggle');
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        }

        function pauseAgent(agentId) {
            vscode.postMessage({ command: 'pauseAgent', agentId });
        }

        function resumeAgent(agentId) {
            vscode.postMessage({ command: 'resumeAgent', agentId });
        }

        function showAgentDetails(agentId) {
            vscode.postMessage({ command: 'showAgentDetails', agentId });
        }

        // Handle Enter key in textarea
        document.getElementById('prompt-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendPrompt();
            }
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'agentStatusUpdate':
                    updateAgentStatus(message.agents, message.operations);
                    break;
                case 'codebaseAnalysis':
                    updateCodebaseInsights(message.insights);
                    break;
                case 'multiAgentResult':
                    showResult(message.result);
                    break;
                case 'error':
                    showError(message.message);
                    break;
            }
        });

        function updateAgentStatus(agents, operations) {
            const agentsGrid = document.getElementById('agents-grid');
            const operationsList = document.getElementById('operations-list');
            
            // Update agent count
            document.getElementById('agent-count').textContent = agents.length;
            document.getElementById('operation-count').textContent = operations.length;

            // Update agents grid
            if (agents.length === 0) {
                agentsGrid.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🤖</div>
                        <p>No active agents</p>
                        <small>Agents will appear here when processing your requests</small>
                    </div>
                \`;
            } else {
                agentsGrid.innerHTML = agents.map(agent => \`
                    <div class="agent-card">
                        <div class="agent-header">
                            <div class="agent-name">\${agent.name}</div>
                            <div class="agent-status \${agent.status}">\${agent.status}</div>
                        </div>
                        <div class="agent-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: \${agent.progress}%"></div>
                            </div>
                        </div>
                        \${agent.currentTask ? \`<div class="agent-task">\${agent.currentTask}</div>\` : ''}
                        <div style="margin-top: 8px; display: flex; gap: 4px;">
                            <button class="btn btn-secondary" style="font-size: 10px; padding: 4px 8px;" onclick="showAgentDetails('\${agent.id}')">Details</button>
                            \${agent.status === 'processing' ? 
                                \`<button class="btn btn-secondary" style="font-size: 10px; padding: 4px 8px;" onclick="pauseAgent('\${agent.id}')">Pause</button>\` :
                                \`<button class="btn btn-secondary" style="font-size: 10px; padding: 4px 8px;" onclick="resumeAgent('\${agent.id}')">Resume</button>\`
                            }
                        </div>
                    </div>
                \`).join('');
            }

            // Update operations list
            if (operations.length === 0) {
                operationsList.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">⚙️</div>
                        <p>No active operations</p>
                        <small>File operations and tasks will appear here</small>
                    </div>
                \`;
            } else {
                operationsList.innerHTML = operations.map(op => \`
                    <div class="operation-item">
                        <span>\${op.description}</span>
                        <span class="loading-spinner"></span>
                    </div>
                \`).join('');
            }
        }

        function updateCodebaseInsights(insights) {
            document.getElementById('total-files').textContent = insights.totalFiles;
            document.getElementById('languages-count').textContent = insights.languages.length;
            document.getElementById('complexity-score').textContent = insights.complexityScore;
            document.getElementById('files-count').textContent = insights.totalFiles;
        }

        function showResult(result) {
            // Show success notification
            const notification = document.createElement('div');
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                padding: 12px 16px;
                border-radius: 6px;
                border-left: 4px solid var(--vscode-charts-green);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: slideIn 0.3s ease;
            \`;
            notification.textContent = '✅ Operation completed successfully!';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }

        function showError(message) {
            const notification = document.createElement('div');
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--vscode-notifications-background);
                color: var(--vscode-notifications-foreground);
                padding: 12px 16px;
                border-radius: 6px;
                border-left: 4px solid var(--vscode-charts-red);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: slideIn 0.3s ease;
            \`;
            notification.textContent = \`❌ \${message}\`;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }

        // Add CSS for animations
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;
    }

    // Additional helper methods
    private async _pauseAgent(agentId: string) {
        const agent = this._sidebarState.activeAgents.get(agentId);
        if (agent) {
            agent.status = 'waiting';
            this._updateView();
        }
    }

    private async _resumeAgent(agentId: string) {
        const agent = this._sidebarState.activeAgents.get(agentId);
        if (agent) {
            agent.status = 'processing';
            this._updateView();
        }
    }

    private async _showAgentDetails(agentId: string) {
        const agent = this._sidebarState.activeAgents.get(agentId);
        if (agent) {
            const doc = await vscode.workspace.openTextDocument({
                content: `# Agent Details: ${agent.name}\n\n**Status:** ${agent.status}\n**Progress:** ${agent.progress}%\n**Current Task:** ${agent.currentTask || 'None'}\n**Working On:** ${agent.workingOn.join(', ') || 'Nothing'}\n**Priority:** ${agent.priority}`,
                language: 'markdown'
            });
            vscode.window.showTextDocument(doc);
        }
    }

    private async _showNLPHelp() {
        const helpContent = `# 🧠 Enhanced NLP Understanding

## Natural Language Processing Capabilities

### File Creation
- "Create a React todo app with authentication"
- "Build me a Python FastAPI server with database"
- "Set up a full-stack e-commerce project"

### Project Analysis
- "Analyze my codebase and suggest improvements"
- "Show me the project structure"
- "Find security vulnerabilities"

### Multi-Agent Coordination
- "Use multiple agents to create a complete web application"
- "Coordinate agents to build backend and frontend simultaneously"
- "Smart agents create production-ready code"

### One-Shot Understanding
The system understands context and intent from single prompts:
- Technology preferences from project context
- Code style from existing files
- Architecture patterns from project structure

### Codebase Integration
- Automatic understanding of existing codebase
- Smart suggestions based on current project
- Context-aware file generation

## Tips for Better Understanding
1. Be specific about what you want to create
2. Mention technology preferences if you have them
3. Describe the purpose and scope of your project
4. The AI will handle the technical details automatically
`;

        const doc = await vscode.workspace.openTextDocument({
            content: helpContent,
            language: 'markdown'
        });
        vscode.window.showTextDocument(doc);
    }

    private async _clearHistory() {
        this._sidebarState.nlpHistory = [];
        this._updateView();
    }

    private async _handleFileOperation(prompt: string, understanding: any) {
        // Handle file operations
        await this._handleFileCreation(prompt);
    }

    private async _handleGeneralQuery(prompt: string, understanding: any) {
        // Handle general queries with enhanced context
        const response = await generateCode(
            `Context: ${this._projectContext}\n\nUser Query: ${prompt}\n\nProvide a helpful response with actionable insights.`,
            'llama-3.3-70b-versatile'
        );

        this._postMessage({
            command: 'generalResponse',
            response
        });
    }
}