// import * as vscode from 'vscode';
// import * as marked from 'marked';
// import { callAI, getFixFromLLM, generateCodeUnified } from './codegenerator';
// import { LiveTerminal } from './liveterminal';
// import { NLPFileGenerator } from './nlpfilegenerator';
// import { MultiFileGenerator } from './multifilegenerator';
// import { CodeDiffViewer } from './codediffviewer';
// import { NLPProjectController } from './nlpprojectcontroller';
// import { ChatFileManager } from './chatfilemanager';
// import { ProjectIssueSolver } from './projectissuesolver';
// import { SmartFileOperation } from './smartfileoperation';
// import { TerminalHistory } from './terminalhistory';
// import { ProductivityDashboard } from './productivitydashboard';
// import { CodeSmellDetector } from './codesmelldetector';

// export class SimpleSidebarViewProvider implements vscode.WebviewViewProvider {
//     static viewType = 'simpleSidebarView';
//     private _view?: vscode.WebviewView;
//     private _projectcontext: string = '';

//     constructor(private readonly _context: vscode.ExtensionContext) {}

//     public async resolveWebviewView(
//         webviewView: vscode.WebviewView,
//         context: vscode.WebviewViewResolveContext,
//         _token: vscode.CancellationToken,
//     ) {
//         this._view = webviewView;

//         webviewView.webview.options = {
//             enableScripts: true,
//             localResourceRoots: [
//                 this._context.extensionUri
//             ],
//         };

//         try {
//             const { getprojectcontext } = await import('./extension');
//             this._projectcontext = await getprojectcontext();
//             console.log('Project context loaded, length:', this._projectcontext?.length || 0);
//         } catch (error) {
//             console.warn('Could not load project context:', error);
//             this._projectcontext = '';
//         }

//         const initialHistory = this._getChatHistory();
//         await this._updateWebview(initialHistory);

//         webviewView.webview.onDidReceiveMessage(async (message) => {
//             console.log('📨 Received message:', message.command);
            
//             if (message.command === 'sendPrompt') {
//                 await this._handleSendPrompt(message);
//             } else if (message.command === 'clearChatHistory') {
//                 this._saveChatHistory([]);
//                 await this._updateWebview([]);
//             } else if (message.command === 'deleteMessage') {
//                 this._handleDeleteMessage(message.index);
//             } else if (message.command === 'refreshCodebase') {
//                 try {
//                     const { getprojectcontext } = await import('./extension');
//                     this._projectcontext = await getprojectcontext();
//                     vscode.window.showInformationMessage('📄 Codebase context refreshed!');
//                 } catch (error: any) {
//                     vscode.window.showErrorMessage(`Failed to refresh: ${error.message}`);
//                 }
//             } else if (message.command === 'showProjectInfo') {
//                 this._handleProjectInfo();
//             } else if (message.command === 'suggestFiles') {
//                 this._handleSuggestFiles();
//             }
//         });
//     }

//     private async _handleSendPrompt(message: any) {
//         const history = this._getChatHistory();
//         const { text, provider, model, useWeb, codeOnly } = message;
        
//         history.push({ role: 'user', content: text });
//         this._saveChatHistory(history);
//         await this._updateWebview(history);

//         try {
//             let fullPrompt = text;
//             if (this._projectcontext && this._projectcontext.length > 100) {
//                 fullPrompt = `**Current Project Context:**
// ${this._projectcontext}

// **User Request:** ${text}

// Please consider the current project structure and files when responding.`;
//             }

//             const response = await generateCodeUnified(provider, model, fullPrompt, useWeb);
            
//             history.push({ 
//                 role: 'assistant', 
//                 content: codeOnly ? response.replace(/```[^\\n]*\\n?|```$/g, '').trim() : response 
//             });
            
//             this._saveChatHistory(history);
//             await this._updateWebview(history);

//         } catch (error: any) {
//             console.error('Generate error:', error);
//             history.push({ 
//                 role: 'assistant', 
//                 content: `❌ Error: ${error.message}` 
//             });
//             this._saveChatHistory(history);
//             await this._updateWebview(history);
//         }
//     }

//     private _handleDeleteMessage(index: number) {
//         const history = this._getChatHistory();
//         if (index >= 0 && index < history.length) {
//             history.splice(index, 1);
//             this._saveChatHistory(history);
//             this._updateWebview(history);
//         }
//     }

//     private async _handleProjectInfo() {
//         const history = this._getChatHistory();
        
//         try {
//             const { getprojectcontext } = await import('./extension');
//             const context = await getprojectcontext();
            
//             const analysisPrompt = `Analyze this project structure and provide insights:

// ${context}

// Please provide:
// 1. 📊 **Project Type**: What kind of project this is
// 2. 🏗️ **Architecture**: Key architectural patterns
// 3. 🛠️ **Technologies**: Main technologies used
// 4. 📁 **Structure**: Organization and file structure
// 5. ⚡ **Quick Actions**: Suggested next steps or improvements

// Keep it concise but informative.`;

//             history.push({ 
//                 role: 'assistant', 
//                 content: '🔍 **Analyzing Project Structure...**\\n\\nScanning workspace and generating insights...' 
//             });
//             this._saveChatHistory(history);
//             await this._updateWebview(history);

//             const analysis = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', analysisPrompt);
            
//             history[history.length - 1].content = `📊 **Project Analysis Complete**\\n\\n${analysis}`;
//             this._saveChatHistory(history);
//             await this._updateWebview(history);

//         } catch (error: any) {
//             history[history.length - 1].content = `❌ **Analysis Failed**\\n\\nError: ${error.message}`;
//             this._saveChatHistory(history);
//             await this._updateWebview(history);
//         }
//     }

//     private async _handleSuggestFiles() {
//         const history = this._getChatHistory();
        
//         try {
//             const suggestionPrompt = `Based on this project structure, suggest 5-8 important files that seem to be missing:

// ${this._projectcontext}

// Format as:
// - filename.ext: description of what it should contain

// For each suggestion, provide the exact command to generate it:
// \`create filename.ext with [description]\`

// Focus on:
// - Configuration files
// - Documentation files  
// - Security files
// - Testing files
// - Deployment files
// - Missing core functionality files`;

//             const suggestions = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', suggestionPrompt);
//             history.push({ 
//                 role: 'assistant', 
//                 content: `💡 **File Suggestions for Your Project**\\n\\n${suggestions}` 
//             });
//         } catch (error: any) {
//             history.push({ 
//                 role: 'assistant', 
//                 content: `❌ Failed to generate suggestions: ${error.message}` 
//             });
//         }
        
//         this._saveChatHistory(history);
//         await this._updateWebview(history);
//     }

//     private async _updateWebview(history: { role: string; content: string; sessionId?: string }[]) {
//         if (!this._view) {return;}

//         const chatHtml = (await Promise.all(history.map(async (msg, index) => {
//             let content: string;

//             if (msg.role === 'assistant') {
//                 const raw = typeof msg.content === 'string'
//                     ? msg.content
//                     : JSON.stringify(msg.content, null, 2);
//                 content = await marked.parse(raw);
//             } else {
//                 const escapedContent = msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
//                 content = `<p>${escapedContent}</p>`;
//             }
//             return `
//                 <div class="msg ${msg.role}" data-index="${index}">
//                     <strong>${msg.role}:</strong>
//                     <button class="delete-btn" data-index="${index}" title="Delete message">🗑️</button>
//                     <div class="content">${content ?? '<pre><code>[No content]</code></pre>'}</div>
//                 </div>`;
//         })));
        
//         this._view.webview.html = this._getHtmlForWebview(chatHtml.join(''));
//     }

//     private _getHtmlForWebview(chatBody?: string): string {
//         return this._generateWebviewHtml(chatBody || '');
//     }
    
//     private _generateWebviewHtml(chatBody: string): string {
//         return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
//     <title>AI Coding Assistant</title>
//     <style>
//         * {
//             margin: 0;
//             padding: 0;
//             box-sizing: border-box;
//         }
//         body {
//             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
//             background: var(--vscode-editor-background);
//             color: var(--vscode-editor-foreground);
//             display: flex;
//             flex-direction: column;
//             height: 100vh;
//             overflow: hidden;
//         }
//         .header {
//             background: var(--vscode-titleBar-activeBackground);
//             padding: 12px 16px;
//             border-bottom: 1px solid var(--vscode-panel-border);
//             display: flex;
//             align-items: center;
//             gap: 8px;
//             justify-content: space-between;
//         }
//         .header-left {
//             display: flex;
//             align-items: center;
//             gap: 8px;
//         }
//         .header-right {
//             display: flex;
//             align-items: center;
//             gap: 12px;
//         }
//         .theme-toggle-btn {
//             background: var(--vscode-button-secondaryBackground);
//             color: var(--vscode-button-secondaryForeground);
//             border: none;
//             border-radius: 4px;
//             padding: 6px 8px;
//             cursor: pointer;
//             font-size: 14px;
//             transition: all 0.2s;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             min-width: 32px;
//             height: 28px;
//         }
//         .theme-toggle-btn:hover {
//             background: var(--vscode-button-secondaryHoverBackground);
//             transform: scale(1.05);
//         }
//         body.light-theme {
//             --vscode-editor-background: #ffffff;
//             --vscode-editor-foreground: #000000;
//             --vscode-titleBar-activeBackground: #f3f3f3;
//             --vscode-titleBar-activeForeground: #000000;
//             --vscode-panel-background: #f8f8f8;
//             --vscode-panel-border: #e0e0e0;
//             --vscode-input-background: #ffffff;
//             --vscode-input-foreground: #000000;
//             --vscode-input-border: #cccccc;
//             --vscode-button-background: #0078d4;
//             --vscode-button-foreground: #ffffff;
//             --vscode-button-secondaryBackground: #e1e1e1;
//             --vscode-button-secondaryForeground: #000000;
//             --vscode-textBlockQuote-background: #f0f0f0;
//             --vscode-inputValidation-infoBorder: #e3f2fd;
//         }
//         body.dark-theme {
//             --vscode-editor-background: #1e1e1e;
//             --vscode-editor-foreground: #d4d4d4;
//             --vscode-titleBar-activeBackground: #2d2d30;
//             --vscode-titleBar-activeForeground: #cccccc;
//             --vscode-panel-background: #252526;
//             --vscode-panel-border: #3e3e42;
//             --vscode-input-background: #3c3c3c;
//             --vscode-input-foreground: #cccccc;
//             --vscode-input-border: #3e3e42;
//             --vscode-button-background: #0e639c;
//             --vscode-button-foreground: #ffffff;
//             --vscode-button-secondaryBackground: #3c3c3c;
//             --vscode-button-secondaryForeground: #cccccc;
//             --vscode-textBlockQuote-background: #2d2d30;
//             --vscode-inputValidation-infoBorder: #007acc;
//         }
//         .header h3 {
//             font-size: 14px;
//             font-weight: 600;
//             color: var(--vscode-titleBar-activeForeground);
//         }
//         .status-dot {
//             width: 8px;
//             height: 8px;
//             border-radius: 50%;
//             background: #00ff00;
//             animation: pulse 2s infinite;
//         }
//         @keyframes pulse {
//             0% { opacity: 1; }
//             50% { opacity: 0.5; }
//             100% { opacity: 1; }
//         }
//         #chat {
//             flex: 1;
//             overflow-y: auto;
//             padding: 16px;
//             scroll-behavior: smooth;
//         }
//         .msg {
//             margin-bottom: 16px;
//             padding: 12px;
//             border-radius: 8px;
//             position: relative;
//         }
//         .msg.user {
//             background: var(--vscode-inputValidation-infoBorder);
//             margin-left: 20%;
//         }
//         .msg.assistant {
//             background: var(--vscode-textBlockQuote-background);
//             margin-right: 20%;
//         }
//         .delete-btn {
//             position: absolute;
//             top: 8px;
//             right: 8px;
//             background: transparent;
//             border: none;
//             cursor: pointer;
//             font-size: 12px;
//             opacity: 0.6;
//             transition: opacity 0.2s;
//         }
//         .delete-btn:hover {
//             opacity: 1;
//         }
//         .input-section {
//             padding: 16px;
//             border-top: 1px solid var(--vscode-panel-border);
//             background: var(--vscode-panel-background);
//         }
//         textarea {
//             width: 100%;
//             min-height: 80px;
//             padding: 12px;
//             border: 1px solid var(--vscode-input-border);
//             border-radius: 4px;
//             background: var(--vscode-input-background);
//             color: var(--vscode-input-foreground);
//             font-family: inherit;
//             font-size: 14px;
//             resize: vertical;
//             margin-bottom: 12px;
//         }
//         .input-row {
//             display: flex;
//             gap: 8px;
//             align-items: center;
//             margin-bottom: 12px;
//             flex-wrap: wrap;
//         }
//         select, .btn {
//             padding: 8px 12px;
//             border: 1px solid var(--vscode-input-border);
//             border-radius: 4px;
//             background: var(--vscode-input-background);
//             color: var(--vscode-input-foreground);
//             font-size: 14px;
//             cursor: pointer;
//         }
//         .btn-primary {
//             background: var(--vscode-button-background);
//             color: var(--vscode-button-foreground);
//             border: none;
//         }
//         .btn-secondary {
//             background: var(--vscode-button-secondaryBackground);
//             color: var(--vscode-button-secondaryForeground);
//         }
//         .checkbox-label {
//             display: flex;
//             align-items: center;
//             gap: 4px;
//             font-size: 12px;
//         }
//         .action-buttons {
//             display: flex;
//             gap: 8px;
//             flex-wrap: wrap;
//         }
//         .btn {
//             padding: 6px 12px;
//             font-size: 12px;
//             border-radius: 4px;
//             border: none;
//             cursor: pointer;
//             transition: opacity 0.2s;
//         }
//         .btn:hover {
//             opacity: 0.8;
//         }
//         .copy-btn {
//             position: absolute;
//             top: 8px;
//             right: 8px;
//             background: var(--vscode-button-secondaryBackground);
//             color: var(--vscode-button-secondaryForeground);
//             border: none;
//             padding: 4px 8px;
//             border-radius: 4px;
//             font-size: 11px;
//             cursor: pointer;
//         }
//         pre {
//             position: relative;
//             background: var(--vscode-textBlockQuote-background);
//             padding: 12px;
//             border-radius: 4px;
//             overflow-x: auto;
//         }
//     </style>
// </head>
// <body>
//     <div class="header">
//         <div class="header-left">
//             <div class="status-dot"></div>
//             <h3>🤖 AI Coding Assistant</h3>
//         </div>
//         <div class="header-right">
//             <button id="theme-toggle-btn" class="theme-toggle-btn" title="Toggle Dark/Light Theme">
//                 <span id="theme-icon">🌙</span>
//             </button>
//         </div>
//     </div>
    
//     <div id="chat">${chatBody || '<div class="msg assistant"><strong>assistant:</strong><button class="delete-btn" data-index="0" title="Delete message">🗑️</button><div class="content"><p>👋 Hi there! How can I help you today?</p></div></div>'}</div>

//     <div class="input-section">
//         <textarea id="prompt" placeholder="💬 Full project control: 'solve my build error', 'create app.js with server', 'fix dependency issues'..."></textarea>
        
//         <div class="input-row">
//             <select id="provider-select">
//                 <option value="groq">🚀 Groq</option>
//                 <option value="together">🤝 Together.ai</option>
//                 <option value="openrouter">🌐 OpenRouter</option>
//                 <option value="mistral">🔮 Mistral</option>
//                 <option value="cerebras">🧠 Cerebras</option>
//             </select>
            
//             <select id="model-select"></select>
            
//             <label class="checkbox-label">
//                 <input type="checkbox" id="use-web" />🌐 Web Search
//             </label>
            
//             <button id="send-button" class="btn btn-primary">✨ Send</button>
//         </div>
        
//         <div class="action-buttons">
//             <button id="clear-history-button" class="btn btn-secondary">🗑️ Clear</button>
//             <button id="refresh-codebase-button" class="btn btn-secondary">🔄 Refresh</button>
//             <button id="project-info-button" class="btn btn-secondary">📊 Info</button>
//             <button id="suggest-files-button" class="btn btn-secondary">💡 Suggest</button>
//         </div>
//     </div>
//     <script>
//         const vscode = acquireVsCodeApi();
        
//         window.addEventListener('DOMContentLoaded', () => {
//             const state = vscode.getState();
//             if (state?.selectedProvider) {
//                 document.getElementById('provider-select').value = state.selectedProvider;
//                 document.getElementById('provider-select').dispatchEvent(new Event('change'));

//                 if (state?.selectedModel) {
//                     setTimeout(() => {
//                         document.getElementById('model-select').value = state.selectedModel;
//                     }, 100);
//                 }
//             }
            
//             // Add event listeners
//             document.getElementById('send-button').addEventListener('click', sendPrompt);
//             document.getElementById('clear-history-button').addEventListener('click', () => {
//                 vscode.postMessage({ command: 'clearChatHistory' });
//             });
//             document.getElementById('refresh-codebase-button').addEventListener('click', () => {
//                 vscode.postMessage({ command: 'refreshCodebase' });
//             });
//             document.getElementById('project-info-button').addEventListener('click', () => {
//                 vscode.postMessage({ command: 'showProjectInfo' });
//             });
//             document.getElementById('suggest-files-button').addEventListener('click', () => {
//                 vscode.postMessage({ command: 'suggestFiles' });
//             });
//             document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
            
//             // Initialize theme
//             const theme = state?.theme || 'dark';
//             applyTheme(theme);
//         });
        
//         const providerModelMap = {
//             groq: {
//                 "meta-llama/llama-4-maverick-17b-128e-instruct": "Meta/Llama",
//                 "llama-3.3-70b-versatile": "LLaMA 3.3",
//                 "deepseek-r1-distill-llama-70b": "Deepseek R1",
//                 "gemma2-9b-it": "Gemma"
//             },
//             together: {
//                 "together/deepseek-ai/DeepSeek-R1-0528":"Deepseek R1",
//                 "together/meta-llama/Llama-3.3-70B-Instruct-Turbo-Free":"Meta/Llama-Turbo",
//                 "together/lgai/exaone-3-5-32b-instruct":"LGAI x1",
//             },
//             openrouter: {
//                 "openrouter/mistral-7b": "Mistral 7B",
//                 "openrouter/codellama-13b": "Code LLaMA"
//             },
//             mistral: {
//                 "mistral-small-latest": "Mistral Small",
//                 "mistral-medium-latest": "Mistral Medium",
//                 "mistral-large-latest": "Mistral Large"
//             },
//             cerebras: {
//                 "llama-4-scout-17b-16e-instruct": "LLaMA-4 Scout 17B",
//                 "llama3.1-8b": "LLaMA 3.1-8B",
//                 "llama-3.3-70b": "LLaMA 3.3‑70B",
//                 "llama-4-maverick-17b-128e": "LLaMA 4 Maverick",
//                 "qwen-3-32b": "QWEN‑3 32B",
//                 "qwen-3-235b-a22b": "QWEN‑3 235B",
//                 "deepseek-r1-distill-llama-70b": "DeepSeek R1 (preview)"
//             }
//         };
        
//         // Setup provider change listener
//         document.getElementById('provider-select').addEventListener('change', function () {
//             const provider = this.value;
//             const modelSelect = document.getElementById('model-select');
            
//             modelSelect.innerHTML = '';
            
//             const models = providerModelMap[provider];
//             for (const modelValue in models) {
//                 const option = document.createElement('option');
//                 option.value = modelValue;
//                 option.textContent = models[modelValue];
//                 modelSelect.appendChild(option);
//             }
//         });
        
//         // Initialize provider dropdown
//         document.getElementById('provider-select').dispatchEvent(new Event('change'));
        
//         window.addEventListener('DOMContentLoaded', () => {
//             document.querySelectorAll('pre > code').forEach((codeBlock) => {
//                 const button = document.createElement('button');
//                 button.innerText = 'Copy';
//                 button.className = 'copy-btn';
//                 button.addEventListener('click', () => {
//                     navigator.clipboard.writeText(codeBlock.innerText);
//                     button.innerText = 'Copied!';
//                     setTimeout(() => button.innerText = 'Copy', 1000);
//                 });
//                 codeBlock.parentNode.insertBefore(button, codeBlock);
//             });
//         });
        
//         function sendPrompt() {
//             const textArea = document.getElementById('prompt');
//             const providerSelect = document.getElementById('provider-select');
//             const modelSelect = document.getElementById('model-select');
//             const useWebCheckbox = document.getElementById('use-web');

//             const text = textArea.value;
//             const provider = providerSelect.value;
//             const model = modelSelect.value;
//             const useWeb = useWebCheckbox.checked;

//             if (text.trim()) {
//                 vscode.setState({ selectedProvider: provider, selectedModel: model });
//                 vscode.postMessage({ command: 'sendPrompt', text, provider, model, useWeb });
//                 textArea.value = '';
//             }
//         }
        
//         document.getElementById('prompt').addEventListener('keydown', (e) => {
//             if (e.key === 'Enter' && !e.shiftKey) {
//                 e.preventDefault();
//                 sendPrompt();
//             }
//         });
        
//         document.addEventListener('DOMContentLoaded', () => {
//             document.querySelectorAll('.delete-btn').forEach(btn => {
//                 btn.addEventListener('click', (e) => {
//                     const index = e.target.getAttribute('data-index');
//                     vscode.postMessage({ command: 'deleteMessage', index: parseInt(index) });
//                 });
//             });
//         });
        
//         function toggleTheme() {
//             const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
//             const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
//             applyTheme(newTheme);
            
//             const currentState = vscode.getState() || {};
//             currentState.theme = newTheme;
//             vscode.setState(currentState);
//         }
        
//         function applyTheme(theme) {
//             const body = document.body;
//             const themeIcon = document.getElementById('theme-icon');
            
//             body.classList.remove('light-theme', 'dark-theme');
//             body.classList.add(theme + '-theme');
            
//             if (themeIcon) {
//                 themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
//             }
//         }
//     </script>
// </body>
// </html>`;