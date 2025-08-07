import * as vscode from 'vscode';
import { marked } from 'marked';
import { getprojectcontext } from './extension';
import { createHighlighter, Highlighter } from 'shiki';
import { generateCode,generateCodeTogether, generateCodeOpenRouter, 
    generateCodeMistral, generateCodeCerebras, tavilySearch } from './codegenerator';


async function generateCodeUnified(provider: string, model: string, prompt: string): Promise<string> {
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

export class ChatSidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'coding.sidebarView';
	private _view?: vscode.WebviewView;
	private readonly _context: vscode.ExtensionContext;
	private readonly _highlighter: Highlighter;
	private readonly _projectcontext: string;


	constructor(context: vscode.ExtensionContext, highlighter: Highlighter, globalProjectContext: string) {
		this._context = context;
		this._highlighter = highlighter;
		this._projectcontext = globalProjectContext;
	}	

	public async resolveWebviewView(
		view: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		_token: vscode.CancellationToken
	) {
		try {
			this._view = view;
			view.webview.options = { enableScripts: true };
			view.webview.onDidReceiveMessage(this._handleMessage.bind(this));

			let history = this._getChatHistory();
			if (history.length === 0) {
				history.push({
					role: 'assistant',
					content: "👋 Hi there! How can I help you today?"
				});
				this._saveChatHistory(history);
			}

			await this._updateWebview(history);
		} catch (e: any) {
			console.error("❌ Failed to load sidebar view:", e.message);
		}
	}

	private async _createFolderInRoot(folderName: string) {
	const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
	if (!wsPath) {throw new Error("No workspace open");}
		  
	const folderUri = vscode.Uri.joinPath(vscode.Uri.file(wsPath), folderName);
	await vscode.workspace.fs.createDirectory(folderUri);
}

	private async _handleCLICommand(prompt: string): Promise<string | null> {
	// Basic pattern matching (expand this or use LLM later)
	const folderMatch = prompt.match(/create\s+(?:a\s+)?folder\s+(?:named\s+)?['"]?([\w\-\/\\]+)['"]?\s+in\s+(?:the\s+)?root/i);
	if (folderMatch) {
		const folderName = folderMatch[1];
		try {
			await this._createFolderInRoot(folderName);
			return `📁 Folder '${folderName}' created in root directory.`;
		} catch (err: any) {
			return `❌ Failed to create folder '${folderName}': ${err.message}`;
		}
	}

	// Add more CLI-style prompts here...
	// if (/generate\s+test\s+for/i.test(prompt)) { ... }

	return null; // Not a CLI-style command
}

	private async _handleMessage(message: any) {
		if (!this._view) {return;}

		if (message.command === 'sendPrompt') {

			const { text: prompt, provider, model, useWeb } = message;


			const history = this._getChatHistory();

			history.push({ role: 'user', content: prompt });
			await this._updateWebview(history);

			const cliResult = await this._handleCLICommand(prompt.trim());
				if (cliResult) {
					history.push({ role: 'assistant', content: cliResult });
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}

				let fullPrompt = prompt;

				if (/file|current file|context|proj|project/i.test(prompt)) {
					const workspacefolder = vscode.workspace.workspaceFolders;
					if (!workspacefolder || workspacefolder.length === 0) {
					const warn_erg = 'No workspace folder is currently open.';
					// fullPrompt = `${warn_erg}\n\n${prompt}`;
					history.push({ role: 'assistant', content: warn_erg });
					await this._updateWebview(history);
					fullPrompt = `${warn_erg}`;
					console.log(warn_erg);
					// return 'No project folder is currently open. I’m not aware of any project context.';
				} 
					fullPrompt = `${this._projectcontext}\n\n${prompt}`;
				}

				if (useWeb || /web|search|web search|latest|news|new/i.test(prompt)) {
					try {
						const result = await tavilySearch(prompt);
						// console.log(result);
						const sources = result.results?.map((r) =>
							`- [${r.title}](${r.url})\n  ${r.content?.slice(0, 200) || ''}`
						).join('\n\n') || 'No sources found.';

						const images = result.images?.map((img) =>
							`![Image](${img})`
						).join('\n') || '';

						const formatted = `📡 **Web Search Result:**\n\n${result.answer || "No summary found."}\n\n---\n**Sources:**\n${sources}\n\n${images}`;
						// ✅ Add Tavily result directly as assistant message
						history.push({ role: 'assistant', content: formatted });
						await this._updateWebview(history);

						// ✅ Then inject into LLM prompt as context
						fullPrompt = `${formatted}\n\n${prompt}`;
						console.log('[Tavily] Injected web search into prompt:', prompt);
					} catch (error: any) {
						const errorMsg = `⚠️ Web search failed. Proceeding with original prompt.\n\n${prompt}`;
						vscode.window.showErrorMessage(`Tavily error: ${error.message}`);
						fullPrompt = errorMsg;

						// Show failure as assistant message
						history.push({ role: 'assistant', content: `⚠️ Web search failed: ${error.message}` });
						await this._updateWebview(history);
					}
				}

			const chatHistory = this._getChatHistory();

				// const conversationContext = chatHistory
				// 	.slice(-1) // optional: limit to last 10 messages
				// 	.map((msg) => {
				// 		const role = msg.role === 'user' ? 'User' : 'Assistant';
				// 		return `${role}: ${msg.content}`;
				// 	}).join('\n');

				// const fullPromptWithContext = `${conversationContext}\nUser: ${prompt}\nAssistant:`;

				const reply = await generateCodeUnified(provider, model, fullPrompt);

			history.push({ role: 'assistant', content: reply });

			this._saveChatHistory(history);
			await this._updateWebview(history);}

			else if (message.command === 'clearChatHistory') {
				const confirm = await vscode.window.showWarningMessage(
					"Are you sure you want to clear your chat history?",
					{ modal: true },
					"Yes", "No"
					);
			if (confirm === "Yes") {
				await this.clearChatHistory();
				vscode.window.showInformationMessage('Chat history cleared!');
				}
			}

			else if (message.command === 'deleteMessage') {
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

			}

			else if (message.command === 'showContext')  {
			vscode.workspace.openTextDocument({ content: this._projectcontext, language: 'markdown' }).then(doc => {
				vscode.window.showTextDocument(doc, { preview: false });
			});
		}
		}
	public async clearChatHistory() {
	await this._context.globalState.update('AIChatHistory', []);
	await this._updateWebview([]);
	}


	private _getChatHistory(): { role: string; content: string }[] {
		return this._context.globalState.get('AIChatHistory', []);
	}

	private _saveChatHistory(history: { role: string; content: string }[]): void {
		this._context.globalState.update('AIChatHistory', history);
	}

	private async _updateWebview(history: { role: string; content: string }[]) {
		if (!this._view) {return;}

		const chatHtml = (await Promise.all(history.map(async (msg, index) => {
			let content: string;

			try {
				if (msg.role === 'assistant') {
					const raw = typeof msg.content === 'string'
						? msg.content
						: JSON.stringify(msg.content, null, 2);
					content = await marked.parse(raw);
				} else {
					content = `<p>${msg.content}</p>`;
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
		}))).join('');

		this._view.webview.html = this._getHtmlForWebview(chatHtml);
	}

	private _getHtmlForWebview(chatBody: string): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<style>
		body {
			font-family: sans-serif;
			display: flex;
			flex-direction: column;
			height: 100vh;
			margin: 0;
		}
		#chat {
			flex: 1;
			padding: 1rem;
			overflow-y: auto;
			background: #f9f9f9;
		}
		.msg {
			margin-bottom: 1rem;
		}
		.user strong { color: #007acc; font-size: 1.2rem;}
		.assistant strong { color: green; font-size: 1.2rem; }
		textarea {
			width: 100%;
			height: 60px;
			font-size: 1rem;
			resize: none;
		}
		button {
			margin-top: 0.5rem;
			padding: 0.5rem;
			font-size: 1rem;
		}

		.delete-btn {
			float: right;
  			background: transparent;
  			border: none;
  			color: red;
  			font-size: 1rem;
  			cursor: pointer;
			}
		.delete-btn:hover {
  			color: darkred;
			}

		pre {
			position: relative;
			background: #ADD8E6;
			color: white;
			padding: 1rem;
			border-radius: 4px;
			overflow-x: auto;
		}
		.copy-btn {
			position: absolute;
			right: 10px;
			top: 10px;
			z-index: 2;
			padding: 2px 8px;
			font-size: 0.9em;
			cursor: pointer;
		}
	</style>
</head>
<body>
	<div id="chat">${chatBody}</div>
	<div style="padding: 1rem;">
		<textarea id="prompt" placeholder="Ask something..."></textarea>
		<div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">

		<label for="provider-select">Agent:</label>
			
		<select id="provider-select" aria-label="select chat agent">
		    <option value="groq">Groq</option>
		    <option value="together">Together.ai</option>
		    <option value="openrouter">OpenRouter</option>
            <option value="mistral">Mistral</option>
            <option value="cerebras">Cerebras</option>
	    </select>

		<label for="model-select">Model:</label>
		<select id="model-select" aria-label="Select model"></select>

		<label><input type="checkbox" id="use-web" />Use Web Search</label>

		<select id="model-select"></select>

		<button onclick="sendPrompt()">Send</button>
		</div>
		<button onclick="vscode.postMessage({ command: 'clearChatHistory' })">
		Clear History
		</button>	
	</div>
	<script>
		const vscode = acquireVsCodeApi();

        window.addEventListener('DOMContentLoaded', () => {
            const state = vscode.getState();
            if (state?.selectedProvider) {
                document.getElementById('provider-select').value = state.selectedProvider;
                document.getElementById('provider-select').dispatchEvent(new Event('change'));

                if (state?.selectedModel) {
                    setTimeout(() => {
                        document.getElementById('model-select').value = state.selectedModel;
                    }, 100); // slight delay to ensure model options are populated
                }}
            });

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
                "llama-4-scout-17b-16e-instruct": "LLaMA‑4 Scout 17B",
                "llama3.1-8b": "LLaMA 3.1‑8B",
                "llama-3.3-70b": "LLaMA 3.3‑70B",
                "llama-4-maverick-17b-128e": "LLaMA 4 Maverick",
                "qwen-3-32b": "QWEN‑3 32B",
                "qwen-3-235b-a22b": "QWEN‑3 235B",
                "deepseek-r1-distill-llama-70b": "DeepSeek R1 (preview)"
                }

            };

        document.getElementById('provider-select').addEventListener('change', function () {
                const provider = this.value;
                const modelSelect = document.getElementById('model-select');

                modelSelect.innerHTML = ''; // Clear existing options

                const models = providerModelMap[provider];
                for (const modelValue in models) {
                    const option = document.createElement('option');
                    option.value = modelValue;
                    option.textContent = models[modelValue];
                    modelSelect.appendChild(option);
                }
            });
            document.getElementById('provider-select').dispatchEvent(new Event('change'));

		window.addEventListener('DOMContentLoaded', () => {
			document.querySelectorAll('pre > code').forEach((codeBlock) => {
				const button = document.createElement('button');
				button.innerText = 'Copy';
				button.className = 'copy-btn';
				button.addEventListener('click', () => {
					navigator.clipboard.writeText(codeBlock.innerText);
					button.innerText = 'Copied!';
					setTimeout(() => button.innerText = 'Copy', 1000);
				});
				codeBlock.parentNode.insertBefore(button, codeBlock);
			});
		});


		function sendPrompt() {
			const textArea = document.getElementById('prompt');
            const providerSelect = document.getElementById('provider-select');
            const modelSelect = document.getElementById('model-select');
            const useWebCheckbox = document.getElementById('use-web');

			const text = textArea.value;
            const provider = providerSelect.value;
            const model = modelSelect.value;
            const useWeb = useWebCheckbox.checked;

            // console.log("Sending prompt with web search:", useWeb);

			if (text.trim()) {
                vscode.setState({ selectedProvider: provider, selectedModel: model });
				vscode.postMessage({ command: 'sendPrompt', text, provider,model, useWeb });
				textArea.value = '';
			}
		}



		window.addEventListener('message', event => {
        const message = event.data;

        if (message.command === 'showContext') {
            const markdown = message.context;
            showContext(markdown);
        }
    });

    function showContext(markdown) {
        const container = document.getElementById('context');
        container.innerHTML = ''; // Clear previous context

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = markdown;
        pre.appendChild(code);
        container.appendChild(pre);
    }

		document.getElementById('prompt').addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendPrompt();
			}
		});

		document.addEventListener('DOMContentLoaded', () => {
  			document.querySelectorAll('.delete-btn').forEach(btn => {
    			btn.addEventListener('click', (e) => {
      				const index = e.target.getAttribute('data-index');
      				vscode.postMessage({ command: 'deleteMessage', index: parseInt(index) });
    			});
  			});
		});

		function scrollToBottom() {
			const chat = document.getElementById('chat');
			if (chat) {
			chat.scrollTop = chat.scrollHeight;
			}}
			window.addEventListener('load', scrollToBottom);
			window.addEventListener('message', scrollToBottom);

	</script>
</body>
</html>
		`;
	}
}
