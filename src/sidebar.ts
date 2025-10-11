import * as vscode from 'vscode';
import { marked } from 'marked';
import { spawn } from 'child_process';
import { getprojectcontext } from './extension';
import { createHighlighter, Highlighter } from 'shiki';
import { generateCode,generateCodeTogether, generateCodeOpenRouter, 
    generateCodeMistral, generateCodeCerebras, tavilySearch } from './codegenerator';
import { MultiFileGenerator } from './multifilegenerator';
import { NLPFileGenerator } from './nlpfilegenerator';
import { CodebaseAnalyzer } from './codebaseanalyzer';
import { SmartEditor } from './smarteditor';
import { ShellCommander } from './shellcommander';
import { DirectoryAnalyzer } from './directoryanalyzer';
import { SmartSearch } from './smartsearch';
import { MultiAgentFileEditor } from './multiagentfileeditor';
import { LiveTerminal } from './liveterminal';
import { EditTracker } from './edittracker';
import { SecurityUtils } from './utils/sanitizer';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { ConflictPreventionSystem } from './conflictprevention';
import { NLPHandler } from './nlphandler_fixed';
import { fileExtensionRegistry, FileExtensionAgentRegistry } from './fileextensionagentregistry';

// Import all extension agents to register them
import './agents/typescriptreplacementagent';
import './agents/pythonreplacementagent';
import './agents/javascriptreplacementagent';
import './agents/jsonreplacementagent';
import './agents/universalreplacementagent';

// Import enhanced NLP components
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { NaturalLanguageCommandProcessor } from './natural-language-command-processor';

// Import new enhanced systems
import { EnhancedContextSystem } from './enhanced-context-system';
import { AgenticChainOfThoughtSystem } from './agentic-chain-of-thought';
import { ProactiveCodeAssistant } from './proactive-code-assistant';

// Import advanced project-aware agentic systems
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { SemanticCodeSystem } from './semantic-code-system';
import { AutonomousWorkflowSystem } from './autonomous-workflow-system';

// Import new enhanced systems
import { UnifiedActivityDashboard } from './unified-activity-dashboard';
import { AgentTerminalBridge } from './agent-terminal-bridge';
import { LiveChangeVisualizer } from './live-change-visualizer';
import { EnhancedShellCommander } from './enhanced-shell-commander';
import { RealTimeCoordinator } from './real-time-coordinator';


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

export class ChatSidebarViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'coding.sidebarView';
	private _view?: vscode.WebviewView;
	private readonly _context: vscode.ExtensionContext;
	private readonly _highlighter: Highlighter;
	private readonly _projectcontext: string;
	agentCoordinator: SmartAgentCoordinator;
	private conflictPrevention: ConflictPreventionSystem;
	nlpHandler: NLPHandler;
	enhancedNLP: EnhancedNLPEngine;
	commandProcessor: NaturalLanguageCommandProcessor;
	
	// Enhanced systems
	private activityDashboard: UnifiedActivityDashboard;
	private agentBridge: AgentTerminalBridge;
	private changeVisualizer: LiveChangeVisualizer;
	private realTimeCoordinator: RealTimeCoordinator;
	
	// New enhanced AI systems
	private enhancedContext: EnhancedContextSystem;
	private chainOfThought: AgenticChainOfThoughtSystem;
	private proactiveAssistant: ProactiveCodeAssistant;
	
	// Advanced project-aware agentic systems
	private projectKnowledge: ProjectKnowledgeSystem;
	private semanticCode: SemanticCodeSystem;
	private autonomousWorkflow: AutonomousWorkflowSystem;
	
	private activeOperations: Set<string> = new Set();
	private currentSessionId: string;


	constructor(context: vscode.ExtensionContext, highlighter: Highlighter, globalProjectContext: string) {
		this._context = context;
		this._highlighter = highlighter;
		this._projectcontext = globalProjectContext;
		
		// Initialize agent coordination systems
		this.agentCoordinator = SmartAgentCoordinator.getInstance();
		this.conflictPrevention = ConflictPreventionSystem.getInstance();
		this.nlpHandler = new NLPHandler();
		
		// Initialize enhanced NLP components
		this.enhancedNLP = EnhancedNLPEngine.getInstance();
		this.commandProcessor = NaturalLanguageCommandProcessor.getInstance();
		
		// Initialize enhanced systems
		this.activityDashboard = UnifiedActivityDashboard.getInstance();
		this.agentBridge = AgentTerminalBridge.getInstance();
		this.changeVisualizer = LiveChangeVisualizer.getInstance();
		this.realTimeCoordinator = RealTimeCoordinator.getInstance();
		
		// Initialize new enhanced AI systems
		this.enhancedContext = EnhancedContextSystem.getInstance();
		this.chainOfThought = AgenticChainOfThoughtSystem.getInstance();
		this.proactiveAssistant = ProactiveCodeAssistant.getInstance();
		
		// Initialize advanced project-aware agentic systems
		this.projectKnowledge = ProjectKnowledgeSystem.getInstance();
		this.semanticCode = SemanticCodeSystem.getInstance();
		this.autonomousWorkflow = AutonomousWorkflowSystem.getInstance();
		
		this.currentSessionId = this.generateSessionId();
		
		// Initialize extension agents registry
		this.initializeExtensionAgents();
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Determine if a query requires chain-of-thought reasoning
	 */
	private shouldUseChainOfThought(prompt: string): boolean {
		const cotKeywords = [
			'how to', 'step by step', 'analyze', 'plan', 'design', 'architecture',
			'refactor', 'optimize', 'debug', 'fix', 'implement', 'create project',
			'build app', 'solve problem', 'improve code', 'best practices'
		];
		
		const promptLower = prompt.toLowerCase();
		return cotKeywords.some(keyword => promptLower.includes(keyword)) || 
			   prompt.length > 100; // Complex queries likely need reasoning
	}

	private async initializeExtensionAgents() {
		try {
			// Analyze current workspace
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
			view.webview.onDidReceiveMessage(this._handleMessage.bind(this));
			
			// Set webview for live updates
			MultiAgentFileEditor.setWebviewView(view);
			LiveTerminal.setWebviewView(view);
			EditTracker.setWebviewView(view);
			
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

			let history = this._getChatHistory();
			if (history.length === 0) {
				history.push({
					role: 'assistant',
					content: "👋 Hi there! How can I help you today?"
				});
				this._saveChatHistory(history);
			}
			console.log('Sidebar history:', SecurityUtils.sanitizeLogInput(JSON.stringify(history)));
			await this._updateWebview(history);
		} catch (e: any) {
			console.error("❌ Failed to load sidebar view:", e.message);
		}
	}

	private async _createFolderInRoot(folderName: string) {
		const wsPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!wsPath) {
			throw new Error("No workspace open");
		}
		
		const folderUri = vscode.Uri.joinPath(vscode.Uri.file(wsPath), folderName);
		await vscode.workspace.fs.createDirectory(folderUri);
	}

	private async _handleCLICommand(prompt: string): Promise<string | null> {
		// Basic pattern matching (expand this or use LLM later)
		const folderMatch = prompt.match(/create\s+(?:a\s+)?folder\s+(?:named\s+)?['"]?([a-zA-Z0-9_\-/]+)['"]?\s+in\s+(?:the\s+)?root/i);
		if (folderMatch) {
			const folderName = folderMatch[1];
			try {
				await this._createFolderInRoot(folderName);
				return `📁 Folder '${folderName}' created in root directory.`;
			} catch (err: any) {
				return `❌ Failed to create folder '${folderName}': ${err.message}`;
			}
		}

		// Multi-file generation (structured syntax)
		const multiFileRequests = MultiFileGenerator.parseMultiFilePrompt(prompt);
		if (multiFileRequests) {
			try {
				const useMultiAgent = /multi.?agent|agents|specialized|review|debug/i.test(prompt);
				await MultiFileGenerator.generateMultipleFiles(multiFileRequests, useMultiAgent);
				return `📄 Generated ${multiFileRequests.length} files${useMultiAgent ? ' with specialized agents' : ''}: ${multiFileRequests.map(r => r.fileName).join(', ')}`;
			} catch (err: any) {
				return `❌ Failed to generate files: ${err.message}`;
			}
		}

		// NLP file generation - Only process with old system if it's NOT handled by enhanced NLP
		if (NLPFileGenerator.isNLPFileRequest(prompt) && !NLPHandler.shouldProcessWithNLP(prompt)) {
			const useMultiAgent = /multi.?agent|agents|specialized|review|debug|quality|secure/i.test(prompt);
			if (useMultiAgent) {
				const { NLPFileGenerator } = await import('./nlpfilegenerator');
				const requests = await NLPFileGenerator.parseNaturalLanguage(prompt);
				if (requests && requests.length > 0) {
					await MultiFileGenerator.generateMultipleFiles(requests, true);
					return `🤖 Generated ${requests.length} files with specialized agents`;
				}
			}
			return await NLPFileGenerator.generateFromNLP(prompt);
		}

		return null; // Not a CLI-style command
}

	private async _handleMessage(message: any) {
		if (!this._view) {
			return;
		}

		if (message.command === 'sendPrompt') {

			const { text: prompt, provider, model, useWeb } = message;

			const history = this._getChatHistory();

			history.push({ role: 'user', content: prompt });
			await this._updateWebview(history);

			// 🧠 Enhanced AI Processing with Context and Chain-of-Thought
			try {
				// Add user input to context system
				await this.enhancedContext.addContext(
					this.currentSessionId,
					prompt,
					'conversation',
					[],
					['user-query']
				);

				// Check if this requires chain-of-thought reasoning
				const needsChainOfThought = this.shouldUseChainOfThought(prompt);
				if (needsChainOfThought) {
					history.push({ role: 'assistant', content: '🧠 **Chain-of-Thought Analysis...**\n\nBreaking down your request into logical steps...' });
					this._saveChatHistory(history);
					await this._updateWebview(history);

					const cotResult = await this.chainOfThought.processAgenticQuery(this.currentSessionId, prompt);
					history[history.length - 1].content = cotResult;
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}

				// Check if should use conversational processing
				if (NaturalLanguageCommandProcessor.shouldUseConversationalProcessing(prompt)) {
					history.push({ role: 'assistant', content: '🗣️ **Conversational Processing...**\n\nAnalyzing your natural language request...' });
					this._saveChatHistory(history);
					await this._updateWebview(history);

					const conversationalResult = await this.commandProcessor.processConversationalInput(prompt, this.currentSessionId);
					
					// Add result to context
					await this.enhancedContext.addContext(
						this.currentSessionId,
						conversationalResult,
						'conversation',
						[],
						['ai-response']
					);

					history[history.length - 1].content = conversationalResult;
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}

				// Check if should use enhanced NLP with context
				if (EnhancedNLPEngine.shouldProcessWithEnhancedNLP(prompt)) {
					history.push({ role: 'assistant', content: '🧠 **Enhanced NLP Processing...**\n\nAnalyzing with project context and smart agents...' });
					this._saveChatHistory(history);
					await this._updateWebview(history);

					// Build contextual prompt
					const contextualPrompt = await this.enhancedContext.buildContextualPrompt(this.currentSessionId, prompt);
					const enhancedResult = await this.enhancedNLP.processNaturalLanguageInput(contextualPrompt);
					
					// Add result to context
					await this.enhancedContext.addContext(
						this.currentSessionId,
						enhancedResult,
						'conversation',
						[],
						['ai-response', 'enhanced-nlp']
					);

					history[history.length - 1].content = enhancedResult;
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}

				// Use intent recognition for routing
				const { IntentRecognitionSystem } = await import('./intentrecognition');
				const intentSystem = IntentRecognitionSystem.getInstance();
				const routingDecision = await intentSystem.routeWorkflowAutomatically(prompt);

				if (routingDecision.shouldUseEnhancedNLP) {
					history.push({ role: 'assistant', content: '🎯 **Smart Routing to Enhanced NLP...**\n\nComplex request detected, using advanced processing...' });
					this._saveChatHistory(history);
					await this._updateWebview(history);

					const contextualPrompt = await this.enhancedContext.buildContextualPrompt(this.currentSessionId, prompt);
					const smartResult = await this.enhancedNLP.processNaturalLanguageInput(contextualPrompt);
					
					await this.enhancedContext.addContext(
						this.currentSessionId,
						smartResult,
						'conversation',
						[],
						['ai-response', 'smart-routing']
					);

					history[history.length - 1].content = smartResult;
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}

			} catch (nlpError) {
				console.warn('Enhanced AI processing failed, falling back to existing handlers:', nlpError);
				// Continue with existing logic as fallback
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

			const cliResult = await this._handleCLICommand(prompt.trim());
				if (cliResult) {
					history.push({ role: 'assistant', content: typeof cliResult === 'string' ? cliResult.replace(/`/g, '\u0060') : cliResult });
					this._saveChatHistory(history);
					await this._updateWebview(history);
					return;
				}
			
				// 🧠 Automatic NLP Processing - Handle natural language project requests
				if (NLPHandler.shouldProcessWithNLP(prompt)) {
					try {
						// Show NLP processing message
						history.push({ role: 'assistant', content: '🧠 **Understanding Your Request...**\n\nAnalyzing intent and preparing smart agents...' });
						this._saveChatHistory(history);
						await this._updateWebview(history);
								
						// Process with NLP handler
						const nlpResult = await this.nlpHandler.processNaturalLanguageInput(prompt);
								
						// Show NLP results
						history.push({ role: 'assistant', content: typeof nlpResult === 'string' ? nlpResult.replace(/`/g, '\u0060') : nlpResult });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ NLP processing failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						// Continue to fallback handlers
					}
				}

				let fullPrompt = prompt;

				// Directory structure analysis
				if (DirectoryAnalyzer.isDirectoryRequest(prompt)) {
					try {
						const structure = await DirectoryAnalyzer.getDirectoryStructure();
						history.push({ role: 'assistant', content: typeof structure === 'string' ? structure.replace(/`/g, '\u0060') : structure });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Directory analysis failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Direct shell command execution
				if (/^(run|execute|cmd|command|terminal)\s+/i.test(prompt)) {
					try {
						// Extract command from prompt
						const command = prompt.replace(/^(run|execute|cmd|command|terminal)\s+/i, '').trim();
						
						// Show terminal execution in chat
						history.push({ role: 'assistant', content: `🔄 **Executing Command:**
\u0060\u0060\u0060bash
${command}
\u0060\u0060\u0060

*Running...*`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						
						// Execute command and stream output
						const result = await this._executeShellCommand(command);
						
						// Update with result
						history[history.length - 1].content = `✅ **Command Executed:**
\u0060\u0060\u0060bash
${command}
\u0060\u0060\u0060

**Output:**
\u0060\u0060\u0060
${result.output}
\u0060\u0060\u0060

**Exit Code:** ${result.exitCode}`.replace(/`/g, '\u0060');
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ **Shell execution failed:**\n\u0060\u0060\u0060\n${err.message}\n\u0060\u0060\u0060`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Enhanced shell commands
				if (ShellCommander.isShellRequest(prompt)) {
					try {
						const result = await ShellCommander.handleStatusRequest(prompt);
						history.push({ role: 'assistant', content: typeof result === 'string' ? result.replace(/`/g, '\u0060') : result });
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

				// Advanced Enhanced Shell Commands with Real-time Coordination
				if (EnhancedShellCommander.isEnhancedShellRequest(prompt)) {
					try {
						// Notify real-time coordinator
						const messageId = await this.realTimeCoordinator.requestEnhancedTerminalCommand(prompt, {
							userIntent: 'enhanced_shell_request',
							urgency: 'medium'
						});

						history.push({ role: 'assistant', content: '⚡ **Enhanced Shell Commander Processing...**\n\nAnalyzing command with advanced NLP and context awareness...' });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						
						const result = await EnhancedShellCommander.executeEnhancedNLPCommand(prompt, {
							userIntent: 'chat_interface_request',
							urgency: 'medium'
						});
						
						// Show enhanced results
						history[history.length - 1].content = `✅ **Enhanced Command Processing Complete**\n\n${result}`.replace(/`/g, '\u0060');
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Enhanced shell processing failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Enhanced Multi-Agent Coordination with conflict prevention
				if (this.isSmartMultiAgentRequest(prompt)) {
					try {
						// Show initial coordination message
						history.push({ role: 'assistant', content: '🧠 **Smart Agent Coordinator Starting...**\n\nAnalyzing request and preventing conflicts...' });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						
						// Process with enhanced coordination
						const result = await this.agentCoordinator.processMultiAgentRequest(prompt);
						
						// Show coordination results
						history.push({ role: 'assistant', content: typeof result === 'string' ? result.replace(/`/g, '\u0060') : result });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Smart coordination failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}
				
				// Multi-file smart editing (fallback)
				if (SmartEditor.isMultiFileFeatureRequest(prompt)) {
					try {
						const { NLPFileGenerator } = await import('./nlpfilegenerator');
						const requests = await NLPFileGenerator.parseNaturalLanguage(prompt);
						if (requests && requests.length > 0) {
							await SmartEditor.addFeatureToMultipleFiles(requests);
							history.push({ role: 'assistant', content: `🤖 Enhanced ${requests.length} files with multi-agent smart edits`.replace(/`/g, '\u0060') });
						} else {
							history.push({ role: 'assistant', content: '❌ Could not parse multi-file request'.replace(/`/g, '\u0060') });
						}
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Multi-file edit failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Smart editing for current file
				if (SmartEditor.isFeatureRequest(prompt)) {
					try {
						await SmartEditor.addFeatureToFile(prompt);
						history.push({ role: 'assistant', content: '✅ Feature added to current file with diff preview'.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Failed to add feature: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Enhanced search
				if (SmartSearch.isSearchRequest(prompt)) {
					try {
						const searchResults = await SmartSearch.handleSearchRequest(prompt);
						history.push({ role: 'assistant', content: typeof searchResults === 'string' ? searchResults.replace(/`/g, '\u0060') : searchResults });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					} catch (err: any) {
						history.push({ role: 'assistant', content: `❌ Search failed: ${err.message}`.replace(/`/g, '\u0060') });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				// Codebase chat
				if (/codebase|code|function|class|where|how|what.*does|explain.*code/i.test(prompt)) {
					const workspacefolder = vscode.workspace.workspaceFolders;
					if (!workspacefolder || workspacefolder.length === 0) {
						const warn_erg = 'No workspace folder is currently open.';
						history.push({ role: 'assistant', content: typeof warn_erg === 'string' ? warn_erg.replace(/`/g, '\u0060') : warn_erg });
						await this._updateWebview(history);
						return;
					}
					
					if (/find|search|where.*is|locate/i.test(prompt)) {
						const searchTerm = prompt.replace(/find|search|where.*is|locate/gi, '').trim();
						const searchResults = await CodebaseAnalyzer.searchCodebase(searchTerm);
						fullPrompt = `Search results:

${searchResults}

User: ${prompt}`;
					} else {
						const response = await CodebaseAnalyzer.analyzeWithAI(prompt);
						history.push({ role: 'assistant', content: response });
						this._saveChatHistory(history);
						await this._updateWebview(history);
						return;
					}
				}

				if (/file|current file|context|proj|project/i.test(prompt)) {
					const workspacefolder = vscode.workspace.workspaceFolders;
					if (!workspacefolder || workspacefolder.length === 0) {
					const warn_erg = 'No workspace folder is currently open.';
					// fullPrompt = `${warn_erg}\n\n${prompt}`;
					history.push({ role: 'assistant', content: typeof warn_erg === 'string' ? warn_erg.replace(/`/g, '\u0060') : warn_erg });
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

						const formatted = `📡 **Web Search Result:**

${result.answer || "No summary found."} 

---\n**Sources:**
${sources}

${images}`;
						history.push({ role: 'assistant', content: formatted });
						await this._updateWebview(history);

						fullPrompt = `${formatted}\n\n${prompt}`;
						console.log('[Tavily] Injected web search into prompt:', SecurityUtils.sanitizeLogInput(prompt));
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

				// const fullPromptWithContext = `${conversationContext}\nUser: ${prompt}\nAssistant:`

				const reply = await generateCodeUnified(provider, model, fullPrompt);

			history.push({ role: 'assistant', content: typeof reply === 'string' ? reply.replace(/`/g, '\u0060') : reply });

			this._saveChatHistory(history);
			await this._updateWebview(history);
		} else if (message.command === 'clearChatHistory') {
				const confirm = await vscode.window.showWarningMessage(
					"Are you sure you want to clear your chat history?",
					{ modal: true },
					"Yes", "No"
					);
			if (confirm === "Yes") {
				await this.clearChatHistory();
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

			} else if (message.command === 'showContext')  {
			vscode.workspace.openTextDocument({ content: this._projectcontext, language: 'markdown' }).then(doc => {
				vscode.window.showTextDocument(doc, { preview: false });
			});
			} else if (message.command === 'refreshCodebase') {
				CodebaseAnalyzer.clearCache();
				vscode.window.showInformationMessage('Codebase refreshed!');
			} else if (message.command === 'clearEdits') {
				EditTracker.clearEdits();
			} else if (message.command === 'getCoordinationStatus') {
				// Get coordination status and send to webview
				const agentStatus = this.agentCoordinator.getAgentStatus();
				const activeOps = this.agentCoordinator.getActiveOperations();
				const conflictHistory = this.agentCoordinator.getConflictHistory();
				const systemStatus = this.conflictPrevention.getSystemStatus();
				
				this._view?.webview.postMessage({
					type: 'coordinationStatus',
					data: {
						agents: Array.from(agentStatus.entries()),
						activeOperations: Array.from(activeOps.entries()),
						conflictHistory,
						systemStatus
					}
				});
			} else if (message.command === 'navigateToEdit') {
				EditTracker.navigateToEdit(message.fileName, message.line);
			} else if (message.command === 'acceptBatchOperation') {
				EditTracker.acceptBatchOperation(message.operationId);
			} else if (message.command === 'rejectBatchOperation') {
				EditTracker.rejectBatchOperation(message.operationId);
			} else if (message.command === 'executeShellCommand') {
				const { command } = message;
				try {
					const result = await this._executeShellCommand(command);
					this._view?.webview.postMessage({
						command: 'shellResult',
						result: result
					});
				} catch (error: any) {
					this._view?.webview.postMessage({
						command: 'shellError',
						error: error.message
					});
				}
            } else if (message.command === 'commandConfirmation') {
                const { command, confirmed, commandId } = message;
                if (confirmed) {
                    const sessionId = this.currentSessionId;
                    LiveTerminal.executeCommand(command, sessionId);
                } else {
                    // User cancelled the command
                    this._view?.webview.postMessage({
                        type: 'commandCancelled',
                        commandId: commandId
                    });
                }
            } else if (message.command === 'getProactiveSuggestions') {
                // Get current proactive suggestions
                const suggestions = this.proactiveAssistant.getActiveSuggestions();
                const highPriority = suggestions.filter(s => s.priority === 'high' || s.priority === 'critical').slice(0, 5);
                
                this._view?.webview.postMessage({
                    type: 'proactiveSuggestions',
                    suggestions: highPriority
                });
            } else if (message.command === 'generateProjectHealth') {
                try {
                    const healthReport = await this.proactiveAssistant.generateProjectHealthReport();
                    const history = this._getChatHistory();
                    
                    const healthSummary = `📊 **Project Health Report**

**Overall Score**: ${healthReport.overallScore}/100

**Metrics**:
- 🏗️ Code Quality: ${healthReport.codeQuality}/100
- 🛡️ Security: ${healthReport.security}/100  
- ⚡ Performance: ${healthReport.performance}/100
- 📚 Documentation: ${healthReport.documentation}/100
- 🧪 Test Coverage: ${healthReport.testCoverage}/100

**Trends**:
- ✅ Improving: ${healthReport.trends.improving.join(', ') || 'None'}
- ⚠️ Declining: ${healthReport.trends.declining.join(', ') || 'None'}
- 📊 Stable: ${healthReport.trends.stable.join(', ') || 'None'}

**Top Recommendations**:
${healthReport.recommendations.map(r => `- **${r.title}**: ${r.description}`).join('\n')}

*Last assessment: ${healthReport.lastAssessment.toLocaleString()}*`;

                    history.push({ role: 'assistant', content: healthSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to generate health report: ${error.message}`);
                }
            } else if (message.command === 'analyzeProjectContext') {
                try {
                    const projectContext = await this.enhancedContext.analyzeProjectContext();
                    const history = this._getChatHistory();
                    
                    const contextSummary = `🔍 **Enhanced Project Analysis**

**Project Type**: ${projectContext.projectType}
**Architecture**: ${projectContext.architecture}

**Languages**: ${projectContext.mainLanguages.join(', ')}
**Frameworks**: ${projectContext.frameworks.slice(0, 8).join(', ')}
**Patterns**: ${projectContext.patterns.join(', ')}

**Key Files Identified**: ${projectContext.keyFiles.size} files
**Dependencies**: ${projectContext.dependencies.length} detected

**Insights**:
- Project follows ${projectContext.architecture} architecture pattern
- Uses modern ${projectContext.mainLanguages[0]} development practices
- ${projectContext.patterns.includes('testing') ? '✅ Has testing setup' : '⚠️ Consider adding tests'}
- ${projectContext.patterns.includes('async') ? '✅ Uses async patterns' : 'ℹ️ Synchronous code patterns'}

*Analysis completed: ${projectContext.lastAnalysis.toLocaleString()}*`;

                    history.push({ role: 'assistant', content: contextSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Context analysis failed: ${error.message}`);
                }
            } else if (message.command === 'getContextMemory') {
                try {
                    const relevantContext = await this.enhancedContext.getRelevantContext(
                        this.currentSessionId,
                        message.query || 'recent context',
                        10
                    );
                    
                    const history = this._getChatHistory();
                    const contextSummary = `🧠 **Context Memory (${relevantContext.length} entries)**

${relevantContext.map(entry => 
                        `**[${entry.type}]** ${entry.content.substring(0, 100)}... 
*Relevance: ${(entry.relevanceScore * 100).toFixed(0)}% | ${entry.timestamp.toLocaleString()}*`
                    ).join('\n\n')}`;

                    history.push({ role: 'assistant', content: contextSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to retrieve context: ${error.message}`);
                }
            } else if (message.command === 'semanticSearch') {
                try {
                    const results = await this.semanticCode.semanticSearch(message.query, {
                        maxResults: 10,
                        includeContext: true
                    });
                    
                    const history = this._getChatHistory();
                    const searchSummary = `🔍 **Semantic Search Results for "${message.query}"**

Found ${results.length} relevant items:

${results.map(result => 
                        `**${result.entity.name}** (${result.entity.type})
📍 *${result.entity.filePath}*
🎯 *Relevance: ${(result.relevanceScore * 100).toFixed(0)}%*
📄 ${result.contextualReason}

**Suggested Actions:**
${result.suggestedActions.map(action => `- ${action}`).join('\n')}
`
                    ).join('\n---\n')}`;

                    history.push({ role: 'assistant', content: searchSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Semantic search failed: ${error.message}`);
                }
            } else if (message.command === 'buildKnowledgeGraph') {
                try {
                    const knowledgeGraph = await this.projectKnowledge.buildKnowledgeGraph();
                    const history = this._getChatHistory();
                    
                    const graphSummary = `🕸️ **Project Knowledge Graph Built**

**Entities Discovered**: ${knowledgeGraph.entities.size}
- Functions: ${Array.from(knowledgeGraph.entities.values()).filter(e => e.type === 'function').length}
- Classes: ${Array.from(knowledgeGraph.entities.values()).filter(e => e.type === 'class').length}
- Interfaces: ${Array.from(knowledgeGraph.entities.values()).filter(e => e.type === 'interface').length}

**Modules Analyzed**: ${knowledgeGraph.modules.size}
**Dependencies**: ${Array.from(knowledgeGraph.entities.values()).reduce((sum, e) => sum + e.dependencies.length, 0)}

**Project Conventions Detected**:
- Naming: ${knowledgeGraph.conventions.namingStyle}
- Indentation: ${knowledgeGraph.conventions.indentation} spaces
- Quotes: ${knowledgeGraph.conventions.quotes}
- Async Pattern: ${knowledgeGraph.conventions.asyncPattern}

**Top Complex Functions**:
${Array.from(knowledgeGraph.entities.values())
                        .filter(e => e.type === 'function' && e.complexity === 'high')
                        .slice(0, 5)
                        .map(e => `- ${e.name} (${e.filePath})`)
                        .join('\n') || 'None detected'}`;

                    history.push({ role: 'assistant', content: graphSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Knowledge graph build failed: ${error.message}`);
                }
            } else if (message.command === 'understandCode') {
                try {
                    const editor = vscode.window.activeTextEditor;
                    if (!editor) {
                        vscode.window.showWarningMessage('No active editor found');
                        return;
                    }
                    
                    const selection = editor.selection;
                    const code = selection.isEmpty ? 
                        editor.document.getText() : 
                        editor.document.getText(selection);
                        
                    const understanding = await this.semanticCode.understandCode(
                        code,
                        editor.document.fileName
                    );
                    
                    const history = this._getChatHistory();
                    const understandingSummary = `🧠 **Code Understanding Analysis**

**Summary**: ${understanding.summary}

**Purpose**: ${understanding.purpose}

**Dependencies**: ${understanding.dependencies.join(', ') || 'None detected'}

**Complexity**: ${understanding.complexity.toUpperCase()}
**Maintainability Score**: ${understanding.maintainability}/100

**Improvement Suggestions**:
${understanding.suggestions.map(s => `- ${s}`).join('\n')}

**Refactoring Opportunities**:
${understanding.refactoringOpportunities.map(r => `- ${r}`).join('\n')}

**Testing Suggestions**:
${understanding.testingSuggestions.map(t => `- ${t}`).join('\n')}`;

                    history.push({ role: 'assistant', content: understandingSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Code understanding failed: ${error.message}`);
                }
            } else if (message.command === 'startWorkflow') {
                try {
                    const workflow = await this.autonomousWorkflow.planWorkflow(message.description);
                    const history = this._getChatHistory();
                    
                    const workflowSummary = `⚙️ **Autonomous Workflow Planned**

**Workflow**: ${workflow.name}
**Goal**: ${workflow.goal}
**Complexity**: ${workflow.metadata.complexity.toUpperCase()}
**Estimated Duration**: ${Math.floor(workflow.metadata.estimatedDuration / 60)} minutes

**Steps** (${workflow.steps.length} total):
${workflow.steps.map((step, index) => 
                        `${index + 1}. **${step.name}** (${step.type})
   📝 ${step.description}
   ⏱️ ~${step.estimatedDuration}s`
                    ).join('\n')}

**Risk Level**: ${workflow.metadata.riskLevel.toUpperCase()}
**Required Permissions**: ${workflow.metadata.requiredPermissions.join(', ')}

Would you like me to execute this workflow? It will run autonomously and report progress.`;

                    history.push({ role: 'assistant', content: workflowSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                    
                    // Ask for confirmation and execute if approved
                    const proceed = await vscode.window.showInformationMessage(
                        `Execute autonomous workflow: ${workflow.name}?`,
                        'Yes', 'No'
                    );
                    
                    if (proceed === 'Yes') {
                        // Execute workflow in background
                        this.autonomousWorkflow.executeWorkflow(workflow.id).then(() => {
                            vscode.window.showInformationMessage(`Workflow "${workflow.name}" completed successfully!`);
                        }).catch((error: any) => {
                            vscode.window.showErrorMessage(`Workflow failed: ${error.message}`);
                        });
                        
                        history.push({ role: 'assistant', content: `✅ **Workflow Started**\n\nWorkflow "${workflow.name}" is now running autonomously. I'll notify you when it's complete.` });
                        this._saveChatHistory(history);
                        await this._updateWebview(history);
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Workflow planning failed: ${error.message}`);
                }
            } else if (message.command === 'crossFileAnalysis') {
                try {
                    const analysis = await this.autonomousWorkflow.performCrossFileReasoning(message.goal);
                    const history = this._getChatHistory();
                    
                    const analysisSummary = `🔗 **Cross-File Analysis Results**

**Goal**: ${message.goal}

**Affected Files** (${analysis.analysis.affectedFiles.length}):
${analysis.analysis.affectedFiles.map(file => `- ${file}`).join('\n')}

**Dependencies Found**: ${analysis.analysis.dependencies.length}
**Impact Radius**: ${(analysis.analysis.impactRadius * 100).toFixed(0)}%

**Risk Assessment**:
⚠️ **Potential Breaking Changes**:
${analysis.analysis.riskAssessment.breakingChanges.map(change => `- ${change}`).join('\n')}

🧪 **Testing Needed**:
${analysis.analysis.riskAssessment.testingNeeded.map(test => `- ${test}`).join('\n')}

📋 **Rollback Plan**:
${analysis.analysis.riskAssessment.rollbackPlan.map(step => `- ${step}`).join('\n')}

**Recommendations** (${analysis.recommendations.length}):
${analysis.recommendations.map(rec => 
                        `**${rec.priority.toUpperCase()}**: ${rec.action}
📋 ${rec.reasoning}
🔄 Alternatives: ${rec.alternatives.join(', ')}`
                    ).join('\n\n')}`;

                    history.push({ role: 'assistant', content: analysisSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Cross-file analysis failed: ${error.message}`);
                }
            } else if (message.command === 'getProjectInsights') {
                try {
                    // Get insights from multiple systems
                    const knowledgeGraph = await this.projectKnowledge.buildKnowledgeGraph();
                    const healthReport = await this.proactiveAssistant.generateProjectHealthReport();
                    const projectContext = await this.enhancedContext.analyzeProjectContext();
                    
                    const history = this._getChatHistory();
                    const insightsSummary = `💎 **Comprehensive Project Insights**

## 📊 **Health Overview**
Overall Score: **${healthReport.overallScore}/100**
${healthReport.trends.improving.length > 0 ? `✅ Improving: ${healthReport.trends.improving.join(', ')}` : ''}
${healthReport.trends.declining.length > 0 ? `⚠️ Needs Attention: ${healthReport.trends.declining.join(', ')}` : ''}

## 🏗️ **Architecture Analysis**  
- **Pattern**: ${projectContext.architecture}
- **Languages**: ${projectContext.mainLanguages.join(', ')}
- **Key Frameworks**: ${projectContext.frameworks.slice(0, 5).join(', ')}

## 🧠 **Code Intelligence**
- **Total Entities**: ${knowledgeGraph.entities.size}
- **Complex Functions**: ${Array.from(knowledgeGraph.entities.values()).filter(e => e.complexity === 'high').length}
- **Naming Convention**: ${knowledgeGraph.conventions.namingStyle}
- **Code Style**: ${knowledgeGraph.conventions.indentation} spaces, ${knowledgeGraph.conventions.quotes} quotes

## 🎯 **Top Recommendations**
${healthReport.recommendations.slice(0, 3).map(r => `- **${r.title}**: ${r.description}`).join('\n')}

## 📈 **Smart Insights**
- Module complexity ranges from simple utilities to complex business logic
- Project shows ${projectContext.patterns.includes('testing') ? 'good' : 'limited'} testing coverage patterns
- ${knowledgeGraph.conventions.asyncPattern === 'async-await' ? 'Consistent async/await' : 'Mixed async'} patterns
- Dependency relationships: ${Array.from(knowledgeGraph.entities.values()).reduce((sum, e) => sum + e.dependencies.length, 0)} total connections

*Analysis generated: ${new Date().toLocaleString()}*`;

                    history.push({ role: 'assistant', content: insightsSummary });
                    this._saveChatHistory(history);
                    await this._updateWebview(history);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Failed to generate project insights: ${error.message}`);
                }
            }
		}
	
	private async _executeShellCommand(command: string): Promise<{output: string, exitCode: number}> {
		return new Promise((resolve, reject) => {
			const isWindows = process.platform === 'win32';
			const shell = isWindows ? 'cmd' : 'bash';
			const shellFlag = isWindows ? '/c' : '-c';
			
			const child = spawn(shell, [shellFlag, command], {
				cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
				shell: true
			});
			
			let output = '';
			let errorOutput = '';
			
			child.stdout?.on('data', (data) => {
				output += data.toString();
			});
			
			child.stderr?.on('data', (data) => {
				errorOutput += data.toString();
			});
			
			child.on('close', (code) => {
				const finalOutput = output + (errorOutput ? `\n\nErrors:\n${errorOutput}` : '');
				resolve({ output: finalOutput || 'Command completed with no output', exitCode: code || 0 });
			});
			
			child.on('error', (error) => {
				reject(new Error(`Failed to execute command: ${error.message}`));
			});
			
			// Timeout after 30 seconds
			setTimeout(() => {
				child.kill();
				reject(new Error('Command timed out after 30 seconds'));
			}, 30000);
		});
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
		if (!this._view) {
			console.log('No view available');
			return;
		}
		console.log('Updating webview with history:', history);

		const chatHtml = (await Promise.all(history.map(async (msg, index) => {
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
		}))).join('');
		console.log('Generated chatHtml:', chatHtml);

		const finalHtml = this._getHtmlForWebview(chatHtml);
		console.log('Final HTML length:', finalHtml.length);
		this._view.webview.html = finalHtml;
		this._view.webview.postMessage({ command: 'setupEventListeners' });
	}

	// Helper method to detect smart multi-agent requests
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

// Assuming this 

    private _getHtmlForWebview(chatBody: string): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: sans-serif;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        #chat {
            flex: 1;
            overflow-y: auto;
        }
        .msg {
            margin-bottom: 1rem;
        }
        .user strong { color: #007acc; font-size: 1.0rem; } 
        .assistant strong { color: green; font-size: 1.0rem; } 
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
        .copy-btn {
            position: absolute;
            right: 10px;
            top: 10px;
            z-index: 2;
            padding: 2px 8px;
            font-size: 0.9em;
            cursor: pointer;
        }
        pre {
            position: relative;
            background: #f0f0f0; /* Changed for better contrast */
            color: #333;      /* Changed for better readability */
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
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
        #progress-panel {
            background: #f9f9f9;
            border-left: 4px solid #4CAF50;
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <h3>AI Chat help</h3>
    <div id="chat">${chatBody || `<div class="msg assistant"><strong>assistant:</strong><button class="delete-btn" data-index="0" title="Delete message">🗑️</button><div class="content"><p>👋 Hi there! How can I help you today?</p></div></div>`}</div>
    
    <div style="padding: 1rem;">
        <textarea id="prompt" placeholder="Ask something..."></textarea>
        <div style="margin-top: 0.5rem;">
            <select id="provider-select">
                <option value="groq">Groq</option>
                <option value="together">Together.ai</option>
                <option value="openrouter">OpenRouter</option>
                <option value="mistral">Mistral</option>
                <option value="cerebras">Cerebras</option>
            </select>
            <label><input type="checkbox" id="use-web" />Use Web Search</label>
            <select id="model-select"></select>
            <button id="send-button">Send</button>
        </div>
        <button id="clear-history-button">Clear History</button>
        <button id="multi-file-help-button" style="margin-left: 10px;">📄 Multi-File Help</button>
        <button id="shell-help-button" style="margin-left: 10px;">💻 Shell Help</button>
        <button id="run-command-button" style="margin-left: 10px;">⚡ Run Command</button>
        <button id="refresh-codebase-button" style="margin-left: 10px;">🔄 Refresh</button>
        <button id="multi-agent-help-button" style="margin-left: 10px;">🤖 Smart Agents</button>
        <button id="coordination-status-button" style="margin-left: 10px;">📊 Coordination</button>
        <button id="clear-edits-button" style="margin-left: 10px;">🗑️ Clear Edits</button>
        <button id="nlp-help-button" style="margin-left: 10px;">🧠 Enhanced NLP</button>
        <button id="conversational-help-button" style="margin-left: 10px;">🗣️ Conversational</button>
        <button id="test-nlp-workflow-button" style="margin-left: 10px;">🧪 Test NLP</button>
        
        <!-- Enhanced AI Features -->
        <div style="margin-top: 10px; padding: 10px; border: 1px solid #007ACC; border-radius: 5px; background: #f0f8ff;">
            <h4 style="margin: 0 0 5px 0;">🚀 Enhanced AI Features</h4>
            <button id="project-health-button" style="margin: 2px;">📊 Health Report</button>
            <button id="context-analysis-button" style="margin: 2px;">🔍 Context Analysis</button>
            <button id="proactive-suggestions-button" style="margin: 2px;">💡 Smart Suggestions</button>
            <button id="context-memory-button" style="margin: 2px;">🧠 Context Memory</button>
            <button id="cot-demo-button" style="margin: 2px;">⚡ Chain-of-Thought</button>
        </div>

        <!-- Advanced Project-Aware AI -->
        <div style="margin-top: 10px; padding: 10px; border: 1px solid #28A745; border-radius: 5px; background: #f0fff0;">
            <h4 style="margin: 0 0 5px 0;">🧬 Advanced Project-Aware AI</h4>
            <button id="semantic-search-button" style="margin: 2px;">🔍 Semantic Search</button>
            <button id="build-knowledge-graph-button" style="margin: 2px;">🕸️ Knowledge Graph</button>
            <button id="understand-code-button" style="margin: 2px;">🧠 Understand Code</button>
            <button id="start-workflow-button" style="margin: 2px;">⚙️ Start Workflow</button>
            <button id="cross-file-analysis-button" style="margin: 2px;">🔗 Cross-File Analysis</button>
            <button id="project-insights-button" style="margin: 2px;">💎 Project Insights</button>
        </div>
    </div>

    <div id="progress-panel" style="display: none; margin-top: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
        <h4>🤖 Multi-Agent Progress</h4>
        <div id="progress-content"></div>
    </div>
    
    <div id="coordination-panel" style="display: none; margin-top: 10px; padding: 10px; border: 1px solid #4CAF50; border-radius: 5px; background: #f0f8f0;">
        <h4>🧠 Smart Coordination Status</h4>
        <div id="coordination-content">
            <div id="agent-status"></div>
            <div id="conflict-status"></div>
            <div id="operation-queue"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

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

        function setupEventListeners() {
            // Restore UI state
            const state = vscode.getState();
            if (state?.selectedProvider) {
                document.getElementById('provider-select').value = state.selectedProvider;
                document.getElementById('provider-select').dispatchEvent(new Event('change'));

                if (state?.selectedModel) {
                    setTimeout(() => {
                        document.getElementById('model-select').value = state.selectedModel;
                    }, 100);
                }
            }

            // Setup all event listeners
            document.getElementById('send-button').addEventListener('click', sendPrompt);
            document.getElementById('clear-history-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'clearChatHistory' });
            });
            document.getElementById('multi-file-help-button').addEventListener('click', showMultiFileHelp);
            document.getElementById('refresh-codebase-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'refreshCodebase' });
            });
            document.getElementById('shell-help-button').addEventListener('click', showShellHelp);
            document.getElementById('run-command-button').addEventListener('click', runCommand);
            document.getElementById('multi-agent-help-button').addEventListener('click', showMultiAgentHelp);
            document.getElementById('coordination-status-button').addEventListener('click', showCoordinationStatus);
            document.getElementById('clear-edits-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'clearEdits' });
            });
            document.getElementById('nlp-help-button').addEventListener('click', showEnhancedNLPHelp);
            document.getElementById('conversational-help-button').addEventListener('click', showConversationalHelp);
            document.getElementById('test-nlp-workflow-button').addEventListener('click', testNLPWorkflow);
            
            // Enhanced AI feature buttons
            document.getElementById('project-health-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'generateProjectHealth' });
            });
            document.getElementById('context-analysis-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'analyzeProjectContext' });
            });
            document.getElementById('proactive-suggestions-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'getProactiveSuggestions' });
            });
            document.getElementById('context-memory-button').addEventListener('click', () => {
                const query = prompt('Enter query for context search (or leave empty for recent):');
                vscode.postMessage({ command: 'getContextMemory', query: query || 'recent context' });
            });
            document.getElementById('cot-demo-button').addEventListener('click', () => {
                const query = prompt('Enter a complex task to analyze with Chain-of-Thought reasoning:');
                if (query) {
                    document.getElementById('prompt').value = query;
                    sendPrompt();
                }
            });

            // Advanced Project-Aware AI buttons
            document.getElementById('semantic-search-button').addEventListener('click', () => {
                const query = prompt('Enter semantic search query (e.g., "functions that handle authentication"):');
                if (query) {
                    vscode.postMessage({ command: 'semanticSearch', query });
                }
            });
            document.getElementById('build-knowledge-graph-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'buildKnowledgeGraph' });
            });
            document.getElementById('understand-code-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'understandCode' });
            });
            document.getElementById('start-workflow-button').addEventListener('click', () => {
                const description = prompt('Describe what you want to accomplish (e.g., "Add user authentication system"):');
                if (description) {
                    vscode.postMessage({ command: 'startWorkflow', description });
                }
            });
            document.getElementById('cross-file-analysis-button').addEventListener('click', () => {
                const goal = prompt('Enter your goal for cross-file analysis:') || 'General analysis';
                vscode.postMessage({ command: 'crossFileAnalysis', goal });
            });
            document.getElementById('project-insights-button').addEventListener('click', () => {
                vscode.postMessage({ command: 'getProjectInsights' });
            });

            document.getElementById('provider-select').addEventListener('change', function () {
                const provider = this.value;
                const modelSelect = document.getElementById('model-select');
                modelSelect.innerHTML = '';
                const models = providerModelMap[provider] || {};
                for (const modelValue in models) {
                    const option = document.createElement('option');
                    option.value = modelValue;
                    option.textContent = models[modelValue];
                    modelSelect.appendChild(option);
                }
            });
            
            document.getElementById('provider-select').dispatchEvent(new Event('change'));

            document.getElementById('prompt').addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPrompt();
                }
            });

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

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = e.target.getAttribute('data-index');
                    vscode.postMessage({ command: 'deleteMessage', index: parseInt(index) });
                });
            });
        }

        function sendPrompt() {
            const textArea = document.getElementById('prompt');
            const providerSelect = document.getElementById('provider-select');
            const modelSelect = document.getElementById('model-select');
            const useWebCheckbox = document.getElementById('use-web');

            const text = textArea.value;
            const provider = providerSelect.value;
            const model = modelSelect.value;
            const useWeb = useWebCheckbox.checked;

            if (text.trim()) {
                vscode.setState({ selectedProvider: provider, selectedModel: model });
                vscode.postMessage({ command: 'sendPrompt', text, provider, model, useWeb });
                textArea.value = '';
            }
        }

        function showContext(markdown) {
            const container = document.getElementById('context');
            container.innerHTML = '';
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = markdown;
            pre.appendChild(code);
            container.appendChild(pre);
        }

        function showMultiFileHelp() {
            alert('Multi-File Generation Help:\\n\\nNatural Language:\\n• "Create a React app with components and styles"\\n• "Build an Express server with routes and middleware"\\n\\nStructured Syntax:\\ngenerate files: filename1:prompt1, filename2:prompt2');
        }

        function showShellHelp() {
            alert('Shell Command Execution:\\n\\nDirect Commands:\\n• "run npm install"\\n• "execute git status"\\n\\nFeatures:\\n• Real-time output display\\n• Error handling & exit codes');
        }

        function runCommand() {
            const command = prompt('Enter shell command to execute:');
            if (command && command.trim()) {
                const textArea = document.getElementById('prompt');
                textArea.value = 'run ' + command.trim();
                sendPrompt();
            }
        }
        
        function showMultiAgentHelp() {
            alert('Smart Multi-Agent Coordination Help:\\n\\nUse commands like:\\n• "smart multi-agent create app.js, styles.css"\\n• "intelligent agents generate Python project"\\nFeatures:\\n• Automatic conflict prevention\\n• Smart agent assignment');
        }
        
        function showEnhancedNLPHelp() {
            alert('🧠 Enhanced NLP Engine - Fully Automated Workflow\\n\\nJust Speak Naturally!\\nExamples:\\n• "I want to create a portfolio website with React"\\n• "Build me an ecommerce app with user authentication"\\n\\nThe AI handles technology selection, file structure, and coordination automatically!');
        }

        function showConversationalHelp() {
            alert('🗣️ Conversational Interface - Natural Communication\\n\\nTalk Like a Human!\\nExamples:\\n• "Hey, can you help me create a website?"\\n• "What\\'s the best way to add authentication?"\\n• "Thanks! That looks great, can you add a footer?"\\n\\nThe system remembers context and asks clarifying questions.');
        }

        function testNLPWorkflow() {
            const testInput = prompt('Enter a test phrase to see how the Enhanced NLP system processes it:', 'I want to create a portfolio website with React');
            if (testInput && testInput.trim()) {
                const textArea = document.getElementById('prompt');
                textArea.value = 'Test NLP: ' + testInput.trim();
                sendPrompt();
            }
        }

        function showCommandConfirmation(command, commandId) {
            const chat = document.getElementById('chat');
            const confirmationDiv = document.createElement('div');
            confirmationDiv.className = 'msg assistant';
            confirmationDiv.innerHTML = \`
                <p>Do you want to run the following command?</p>
                <pre><code>\${command}</code></pre>
                <button class="confirm-btn" data-command-id="\${commandId}" data-confirmed="true">Run</button>
                <button class="confirm-btn" data-command-id="\${commandId}" data-confirmed="false">Cancel</button>
            \`;
            chat.appendChild(confirmationDiv);
            scrollToBottom();

            confirmationDiv.querySelectorAll('.confirm-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const confirmed = e.target.getAttribute('data-confirmed') === 'true';
                    vscode.postMessage({ command: 'commandConfirmation', command: command, confirmed, commandId });
                    confirmationDiv.remove();
                });
            });
        }
        
        function showCoordinationStatus() {
            const panel = document.getElementById('coordination-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') {
                vscode.postMessage({ command: 'getCoordinationStatus' });
            }
        }
        
        function updateProgressPanel(progressData) {
            const panel = document.getElementById('progress-panel');
            const content = document.getElementById('progress-content');
            
            if (!progressData || progressData.length === 0) {
                panel.style.display = 'none';
                return;
            }
            
            panel.style.display = 'block';
            
            let html = '';
            progressData.forEach(item => {
                const statusIcon = { 'pending': '⏳', 'processing': '🔄', 'completed': '✅', 'error': '❌' }[item.status] || '❓';
                const percentage = item.totalLines > 0 ? Math.round((item.linesProcessed / item.totalLines) * 100) : 0;
                
                html += \`
                    <div style="margin-bottom: 8px; padding: 5px; background: #f5f5f5; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span><strong>\${statusIcon} \${item.fileName}</strong></span>
                            <span style="font-size: 0.9em; color: #666;">\${item.operation}</span>
                        </div>
                        <div style="font-size: 0.8em; color: #888; margin-top: 2px;">
                            \${item.agent ? 'Agent: ' + item.agent + ' | ' : ''}Lines: \${item.linesProcessed}/\${item.totalLines} (\${percentage}%)
                        </div>
                        <div style="width: 100%; background: #ddd; height: 4px; border-radius: 2px; margin-top: 3px;">
                            <div style="width: \${percentage}%; background: #4CAF50; height: 100%; border-radius: 2px; transition: width 0.3s;"></div>
                        </div>
                    </div>
                \`;
            });
            content.innerHTML = html;
        }
        
        function showFileStatus(message) {
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'padding: 4px 8px; margin: 2px 0; background: #e8f4fd; border-left: 3px solid #0078d4; font-family: monospace; font-size: 0.9em; border-radius: 3px;';
            statusDiv.textContent = message;
            
            const chat = document.getElementById('chat');
            if (chat) {
                chat.appendChild(statusDiv);
                scrollToBottom();
                setTimeout(() => { if (statusDiv.parentNode) { statusDiv.remove(); } }, 3000);
            }
        }
        
        function showEditUpdate(edit, totalEdits) {
            const editDiv = document.createElement('div');
            let actionIcon, actionColor, displayText;
            
            if (edit.action === 'created') {
                actionIcon = edit.linesAdded ? 'N+' + edit.linesAdded : 'N';
                actionColor = '#17a2b8';
                displayText = edit.linesAdded ? \`New file created with \${edit.linesAdded} lines\` : 'New file created';
            } else if (edit.action === 'added') {
                actionIcon = edit.linesAdded ? '+' + edit.linesAdded : '+';
                actionColor = '#28a745';
                displayText = \`Line \${edit.line}: \${edit.content}\`;
            } else if (edit.action === 'removed') {
                actionIcon = edit.linesRemoved ? '-' + edit.linesRemoved : '-';
                actionColor = '#dc3545';
                displayText = \`Line \${edit.line}: \${edit.content}\`;
            } else {
                actionIcon = '~';
                actionColor = '#ffc107';
                displayText = \`Line \${edit.line}: \${edit.content}\`;
            }
            
            editDiv.style.cssText = \`padding: 6px 10px; margin: 3px 0; border-left: 4px solid \${edit.color}; background: #f8f9fa; border-radius: 4px; font-size: 0.85em; cursor: pointer; transition: background 0.2s;\`;
            
            editDiv.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: \${edit.color}; font-weight: bold;">\${edit.fileName}</span>
                    <span style="color: #666; font-size: 0.8em;">\${totalEdits} edits</span>
                </div>
                <div style="margin-top: 2px;">
                    <span style="color: \${actionColor}; font-weight: bold; font-size: 1.1em;">\${actionIcon}</span>
                    <span style="margin-left: 8px;">\${displayText}</span>
                </div>
            \`;
            
            editDiv.onclick = () => vscode.postMessage({ command: 'navigateToEdit', fileName: edit.fileName, line: edit.line });
            editDiv.onmouseenter = () => editDiv.style.background = '#e9ecef';
            editDiv.onmouseleave = () => editDiv.style.background = '#f8f9fa';
            
            document.getElementById('chat').appendChild(editDiv);
            scrollToBottom();
        }
        
        function showBatchSummary(operation, fileSummaries) {
            const summaryDiv = document.createElement('div');
            summaryDiv.id = 'batch-summary-' + operation.id;
            summaryDiv.style.cssText = 'padding: 12px; margin: 8px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; font-size: 0.9em;';
            
            let filesHtml = fileSummaries.map(file => {
                const indicatorColor = file.isNew ? '#17a2b8' : (file.linesAdded > 0 && file.linesRemoved > 0 ? '#ffc107' : (file.linesAdded > 0 ? '#28a745' : '#dc3545'));
                const descriptionText = file.isNew ? (file.linesAdded > 0 ? \` (\${file.linesAdded} lines)\` : ' (new file)') : '';
                
                return \`
                    <div style="margin: 4px 0; padding: 4px 8px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                        <span style="font-weight: bold;">\${file.fileName}</span>
                        <span style="color: \${indicatorColor}; font-weight: bold; margin-left: 8px; font-size: 1.1em;">\${file.indicator}</span>
                        <span style="color: rgba(255,255,255,0.8); font-size: 0.85em;">\${descriptionText}</span>
                    </div>
                \`;
            }).join('');
            
            summaryDiv.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <div style="font-weight: bold; font-size: 1.1em;">🤖 AI Operation Complete</div>
                        <div style="opacity: 0.9;">\${operation.description}</div>
                        \${operation.agent ? \`<div style="font-size: 0.8em; opacity: 0.8;">Agent: \${operation.agent}</div>\` : ''}
                    </div>
                </div>
                <div style="margin: 8px 0;">\${filesHtml}</div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button onclick="acceptBatch('\${operation.id}')" style="flex: 1; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">✓ Accept</button>
                    <button onclick="rejectBatch('\${operation.id}')" style="flex: 1; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">✗ Reject</button>
                </div>
            \`;
            
            document.getElementById('chat').appendChild(summaryDiv);
            scrollToBottom();
        }
        
        function showBatchOperationStart(operation) {
            const startDiv = document.createElement('div');
            startDiv.style.cssText = 'padding: 8px 12px; margin: 4px 0; background: #e3f2fd; border-left: 4px solid #2196F3; border-radius: 4px; font-size: 0.85em;';
            startDiv.innerHTML = \`🔄 <strong>Starting:</strong> \${operation.description} \${operation.agent ? '(Agent: ' + operation.agent + ')' : ''}\`;
            document.getElementById('chat').appendChild(startDiv);
            scrollToBottom();
        }
        
        function showBatchResult(operationId, result) {
            const summaryDiv = document.getElementById('batch-summary-' + operationId);
            if (summaryDiv) {
                const icon = result === 'accepted' ? '✅' : '❌';
                const color = result === 'accepted' ? '#28a745' : '#dc3545';
                const status = result === 'accepted' ? 'Accepted' : 'Rejected';
                const buttonsDiv = summaryDiv.querySelector('div:last-child');
                if (buttonsDiv) {
                    buttonsDiv.innerHTML = \`<div style="text-align: center; padding: 8px; background: \${color}; border-radius: 4px; font-weight: bold;">\${icon} \${status}</div>\`;
                }
            }
        }
        
        function acceptBatch(operationId) {
            vscode.postMessage({ command: 'acceptBatchOperation', operationId: operationId });
        }
        
        function rejectBatch(operationId) {
            vscode.postMessage({ command: 'rejectBatchOperation', operationId: operationId });
        }
        
        function clearEditHistory() {
            document.querySelectorAll('div[style*="border-left: 4px solid"]').forEach(div => div.remove());
        }

        function scrollToBottom() {
            const chat = document.getElementById('chat');
            if (chat) {
                chat.scrollTop = chat.scrollHeight;
            }
        }
        
        function showCoordinationMessage(message, count) {
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = 'padding: 8px; margin: 4px 0; background: linear-gradient(90deg, #4CAF50, #45a049); color: white; border-radius: 5px; font-weight: bold; text-align: center;';
            statusDiv.textContent = \`🧠 \${message} (\${count} operations)\`;
            
            const chat = document.getElementById('chat');
            if (chat) {
                chat.appendChild(statusDiv);
                scrollToBottom();
                setTimeout(() => { if (statusDiv.parentNode) { statusDiv.remove(); } }, 5000);
            }
        }
        
        function showOperationUpdate(operation) {
            const updateDiv = document.createElement('div');
            const statusColor = { 'started': '#2196F3', 'completed': '#4CAF50', 'failed': '#f44336', 'retrying': '#FF9800' }[operation.status] || '#666';
            
            updateDiv.style.cssText = \`padding: 6px 10px; margin: 2px 0; border-left: 4px solid \${statusColor}; background: #f8f9fa; border-radius: 3px; font-size: 0.9em;\`;
            updateDiv.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold;">\${operation.fileName}</span>
                    <span style="color: #666; font-size: 0.8em;">\${operation.agent}</span>
                </div>
                <div style="margin-top: 2px; color: \${statusColor}; font-weight: bold;">
                    \${operation.operation} - \${operation.status}
                </div>
            \`;
            
            document.getElementById('chat').appendChild(updateDiv);
            scrollToBottom();
        }
        
        function showConflictNotification(data) {
            const conflictDiv = document.createElement('div');
            conflictDiv.style.cssText = 'padding: 8px; margin: 4px 0; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; color: #856404;';
            conflictDiv.innerHTML = \`
                <div style="font-weight: bold; display: flex; align-items: center;">
                    ⚠️ Conflict Detected: \${data.fileName}
                </div>
                <div style="margin-top: 4px; font-size: 0.9em;">
                    Existing: \${data.existingOperation} | New: \${data.newOperation}
                    <br>Queue position: \${data.queuePosition + 1}
                </div>
            \`;
            
            document.getElementById('chat').appendChild(conflictDiv);
            scrollToBottom();
            setTimeout(() => { if (conflictDiv.parentNode) { conflictDiv.remove(); } }, 8000);
        }
        
        function showLockUpdate(data) {
            const lockDiv = document.createElement('div');
            const statusIcon = { 'acquired': '🔒', 'released': '🔓', 'expired': '⏰' }[data.status] || '🔄';
            
            lockDiv.style.cssText = 'padding: 4px 8px; margin: 1px 0; background: #e3f2fd; border-left: 3px solid #2196F3; border-radius: 3px; font-size: 0.85em; color: #1976d2;';
            lockDiv.textContent = \`\${statusIcon} \${data.fileName} - \${data.status} by \${data.operation}\`;
            
            document.getElementById('chat').appendChild(lockDiv);
            scrollToBottom();
            setTimeout(() => { if (lockDiv.parentNode) { lockDiv.remove(); } }, 3000);
        }

        // Consolidated message handler
        window.addEventListener('message', (event) => {
            const message = event.data;
            const type = message.type || message.command;

            switch(type) {
                case 'setupEventListeners':
                    setupEventListeners();
                    break;
                case 'showContext':
                    showContext(message.context);
                    break;
                case 'coordinationUpdate':
                    showCoordinationMessage(message.message, message.count);
                    break;
                case 'operationUpdate':
                    showOperationUpdate(message.operation);
                    break;
                case 'conflictDetected':
                    showConflictNotification(message.data);
                    break;
                case 'lockUpdate':
                    showLockUpdate(message.data);
                    break;
                case 'fileStatus':
                    showFileStatus(message.message);
                    break;
                case 'editUpdate':
                    showEditUpdate(message.edit, message.totalEdits);
                    break;
                case 'clearEdits':
                    clearEditHistory();
                    break;
                case 'batchSummary':
                    showBatchSummary(message.operation, message.fileSummaries);
                    break;
                case 'batchOperationStarted':
                    showBatchOperationStart(message.operation);
                    break;
                case 'batchOperationAccepted':
                    showBatchResult(message.operationId, 'accepted');
                    break;
                case 'batchOperationRejected':
                    showBatchResult(message.operationId, 'rejected');
                    break;
                case 'requestCommandConfirmation':
                    showCommandConfirmation(message.command, message.commandId);
                    break;
                case 'commandCancelled':
                    const chat = document.getElementById('chat');
                    const cancelledDiv = document.createElement('div');
                    cancelledDiv.className = 'msg assistant';
                    cancelledDiv.innerHTML = '<p>Command cancelled.</p>';
                    chat.appendChild(cancelledDiv);
                    break;
            }
            scrollToBottom();
        });

        window.addEventListener('load', () => {
            setupEventListeners();
            scrollToBottom();
        });
    </script>
</body>
</html>`;
    }
    // close class
}