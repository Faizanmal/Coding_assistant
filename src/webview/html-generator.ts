// Shared utilities for webview HTML generation and styling
import { WebviewHtmlOptions, ProviderConfig } from './types';
import { getHighlight } from '../utils/highlight-config';

export class WebviewHtmlGenerator {
    private static readonly providerModelMap: ProviderConfig = {
        groq: {
            "meta-llama/llama-4-maverick-17b-128e-instruct": "Meta/Llama",
            "llama-3.3-70b-versatile": "LLaMA 3.3",
            "deepseek-r1-distill-llama-70b": "Deepseek R1",
            "gemma2-9b-it": "Gemma"
        },
        together: {
            "together/deepseek-ai/DeepSeek-R1-0528": "Deepseek R1",
            "together/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free": "Meta/Llama-Turbo",
            "together/lgai/exaone-3-5-32b-instruct": "LGAI x1",
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

    public static generateHtml(options: WebviewHtmlOptions = {}): string {
        const {
            chatBody = '',
            theme = 'dark',
            enableHighlight = true,
            customStyles = '',
            customScripts = ''
        } = options;

        const baseHtml = this.generateBaseHtml(chatBody, theme, customStyles, customScripts);
        
        if (enableHighlight) {
            const highlight = getHighlight();
            return highlight.enhanceWebviewHTML(baseHtml);
        }
        
        return baseHtml;
    }

    private static generateBaseHtml(chatBody: string, theme: string, customStyles: string, customScripts: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://static.highlight.io; connect-src 'self' https://pub.highlight.io https://otel.highlight.io; img-src 'self' data: https://static.highlight.io;">
    <title>AI Coding Assistant</title>
    <style>
        ${this.getBaseStyles()}
        ${customStyles}
    </style>
</head>
<body class="${theme}-theme">
    ${this.generateHeader()}
    ${this.generateChatContainer(chatBody)}
    ${this.generateInputSection()}
    ${this.generateProgressPanels()}
    <script>
        ${this.generateBaseScript()}
        ${customScripts}
    </script>
</body>
</html>`;
    }

    private static getBaseStyles(): string {
        return `
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
        
        /* Theme variables */
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
            --vscode-charts-blue: #0078d4;
            --vscode-charts-green: #107c10;
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
            --vscode-charts-blue: #007acc;
            --vscode-charts-green: #4caf50;
        }
        
        /* Header styles */
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
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff00;
            animation: pulse 2s infinite;
        }
        .header h3 {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        /* Chat container styles */
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
        
        /* Input section styles */
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
        
        /* Button styles */
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
        
        /* Utility styles */
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
        
        /* Animation styles */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        /* Terminal styles */
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
        
        /* Progress panel styles */
        #progress-panel, #coordination-panel {
            margin-top: 10px;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            background: var(--vscode-panel-background);
            display: none;
        }`;
    }

    private static generateHeader(): string {
        return `
    <div class="header">
        <div class="header-left">
            <div class="status-dot"></div>
            <h3>🤖 AI Coding Assistant</h3>
        </div>
        <div class="header-right">
            <button id="theme-toggle" class="btn btn-secondary" title="Toggle Dark/Light Theme">
                <span id="theme-icon">🌙</span>
            </button>
            <div class="terminal-status" id="terminal-status">
                <div class="terminal-indicator terminal-idle" id="terminal-indicator"></div>
                <span id="terminal-text">Terminal: Idle</span>
            </div>
        </div>
    </div>`;
    }

    private static generateChatContainer(chatBody: string): string {
        const defaultMessage = '<div class="msg assistant"><strong>assistant:</strong><button class="delete-btn" data-index="0" title="Delete message">🗑️</button><div class="content"><p>👋 Hi there! How can I help you today?</p></div></div>';
        
        return `<div id="chat">${chatBody || defaultMessage}</div>`;
    }

    private static generateInputSection(): string {
        return `
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
        </div>
    </div>`;
    }

    private static generateProgressPanels(): string {
        return `
    <!-- Live Progress Panel -->
    <div id="progress-panel">
        <h4>🤖 Multi-Agent Progress</h4>
        <div id="progress-content"></div>
    </div>
    
    <!-- Coordination Status Panel -->
    <div id="coordination-panel">
        <h4>🧠 Smart Coordination Status</h4>
        <div id="coordination-content">
            <div id="agent-status"></div>
            <div id="conflict-status"></div>
            <div id="operation-queue"></div>
        </div>
    </div>`;
    }

    private static generateBaseScript(): string {
        return `
        (function() {
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

            const providerModelMap = ${JSON.stringify(this.providerModelMap)};

            // Core initialization
            function initializeEventListeners() {
                try {
                    vscode.postMessage({ command: 'debugLog', message: 'Event listener init started' });

                    // Basic event listeners
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
                    
                    // Button event listeners
                    document.getElementById('clear-history-button')?.addEventListener('click', () => vscode.postMessage({ command: 'clearChatHistory' }));
                    document.getElementById('refresh-codebase-button')?.addEventListener('click', () => vscode.postMessage({ command: 'refreshCodebase' }));
                    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
                    
                    // Provider select handler
                    const providerSelect = document.getElementById('provider-select');
                    if (providerSelect) {
                        providerSelect.addEventListener('change', updateModelDropdown);
                        updateModelDropdown();
                    }
                    
                    // Restore saved state
                    const state = vscode.getState();
                    if (state?.selectedProvider && providerSelect) {
                        providerSelect.value = state.selectedProvider;
                        updateModelDropdown();
                        if (state.selectedModel) {
                           setTimeout(() => {
                                const modelSelect = document.getElementById('model-select');
                                if (modelSelect) modelSelect.value = state.selectedModel;
                           }, 50);
                        }
                    }

                    // Apply theme
                    const savedTheme = vscode.getState()?.theme || 'dark';
                    applyTheme(savedTheme);

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

            // Message handling from extension
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
                }
            });

            function updateTerminalStatus(message) {
                const indicator = document.getElementById('terminal-indicator');
                const text = document.getElementById('terminal-text');
                if (!indicator || !text) return;

                indicator.className = 'terminal-indicator';
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

            // Initial setup
            initializeEventListeners();
            scrollToBottom();
            
        })();`;
    }

    public static getProviderModelMap(): ProviderConfig {
        return this.providerModelMap;
    }
}