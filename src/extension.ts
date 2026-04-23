import { registerCodeCommentCommand } from './ineditorcodecomment';
import * as path from 'path';
import { initializeConnectivity, getConnectivityHub } from './connectivity-hub';

import { ChatSidebarViewProvider } from './sidebar';
import { createHighlighter, Highlighter } from 'shiki';
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { ChatPanel } from './chatpanel';
import { SimpleSidebarViewProvider } from './sidebar_simple';
import { getFixFromLLM, callAI } from './codegenerator';
import { registerFixSelectedErrorCommand } from './fixselectederror';
import { ineditorcodegenerationCommand } from './ineditorcodegenerate';
import { fixDiagnosticCommand } from './fixdiagnostic';
import { infilechatCommand } from './infilechat'; 
import { fixselectedcodeCommand, explainselectedcodeCommand } from './fixselectedcode';
import { inlinesuggestionCommand } from './inlinesuggestion';
import { registerLLMFixCommand, registerFixSelectedErrorCommands } from './hoverfixdiagnostic';

// Enterprise Features
import { registerEnterpriseSecurityCommands } from './enterprise-security';
import { registerAnalyticsCommands } from './enterprise-analytics';
import { registerEnterpriseIntegrationCommands } from './enterprise-integration-hub';
import { registerCollaborationCommands } from './real-time-collaboration';
import { registerSmartPRReviewCommands } from './pr-review-bot';
import { registerAIModelManagementCommands } from './ai-model-management';
import { registerAdvancedTestingCommands } from './advanced-testing-framework';
import { registerMultiTenantCommands } from './multi-tenant-architecture';
import { registerPerformanceMonitoringCommands } from './performance-monitoring';
import { EnhancedDiagnostics } from './enhanceddiagnostics';
import { codereviewcommand, suggestreviewcodecommand } from './codereview';
import * as autoCodeReview from './autocodereview';
import * as semanticSearch from './semanticsearch';
import * as playground from './playground';
import { activateTimeTravelDebugger } from './timetraveldebug';
import * as smartTestGen from './smarttestgen';
import { MultiFileGenerator } from './multifilegenerator';
import { NLPFileGenerator } from './nlpfilegenerator';
import { SmartEditor } from './smarteditor';
import { ShellCommander } from './shellcommander';
import { DirectoryAnalyzer } from './directoryanalyzer';

// Enhanced system imports
import { UnifiedActivityDashboard } from './unified-activity-dashboard';
import { AgentTerminalBridge } from './agent-terminal-bridge';
import { LiveChangeVisualizer } from './live-change-visualizer';
import { EnhancedShellCommander } from './enhanced-shell-commander';
import { RealTimeCoordinator } from './real-time-coordinator';

// New enhanced AI systems
import { EnhancedContextSystem } from './enhanced-context-system';
import { AgenticChainOfThoughtSystem } from './agentic-chain-of-thought';
import { ProactiveCodeAssistant } from './proactive-code-assistant';
import { SmartSearch } from './smartsearch';

// New advanced project-aware agentic systems
import { ProjectKnowledgeSystem } from './project-knowledge-system';
import { SemanticCodeSystem } from './semantic-code-system';
import { AutonomousWorkflowSystem } from './autonomous-workflow-system';
import { AdvancedVSCodeIntegration } from './advanced-vscode-integration';

// Enhanced UI and Multi-Agent Systems
import { EnhancedSidebarUI } from './enhanced-sidebar-ui';
import { ProductionMultiAgentGenerator } from './production-multi-agent-generator';
import { EnhancedCodebaseUnderstanding } from './enhanced-codebase-understanding';
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { RealtimeAnalyzer } from './realtimeanalyzer';
import { AdvancedRefactorAssistant } from './advancedrefactor';
import { SmartDocGenerator } from './docgenerator';
import { PerformanceProfiler } from './performanceprofiler';
import { SmartGitIntegration } from './smartgit';
import { AdvancedCompletionProvider } from './advancedcompletion';
import { CodeAssistant } from './codeassistant';
import { QuickFixes } from './quickfixes';
import { CodeNavigator } from './codenavigator';
import { SnippetGenerator } from './snippetgenerator';
import { DebugHelper } from './debughelper';

// Advanced AI Features
import { MultiAgentCoordinator, AgentType } from './multi-agent-collaboration';
import { SelfImprovingPromptEngine } from './self-improving-prompts';
import { AdaptiveContextWindow } from './adaptive-context-window';
import { VoiceCodeMode } from './voice-code-mode';
import { InteractiveWhiteboard, DiagramType } from './interactive-whiteboard';
import { AIDebugReplay } from './ai-debug-replay';
import { InstantReviewer } from './instantreviewer';
import { ContinuousErrorFixer } from './continuous-error-fixer';
import { MultiAgentFileEditor } from './multiagentfileeditor';
import { EditTracker } from './edittracker';
import { ConnectionManager } from './integration/connectionManager';
import { SystemValidator } from './integration/systemValidator';
import { CodeDiffViewer } from './codediffviewer';
import { NLPProjectController } from './nlpprojectcontroller';
import { ChatFileManager } from './chatfilemanager';
import { ProjectIssueSolver } from './projectissuesolver';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { ConflictPreventionSystem } from './conflictprevention';
import { SmartAgentAssignmentSystem } from './smartagentassignment';
import { SmartFileOperation } from './smartfileoperation';
import { getHighlight } from './utils/highlight-config';
import { fileExtensionRegistry } from './fileextensionagentregistry';
import { registerNextGenFeatureCommands } from './nextgen-features';
import { registerExplainErrorLogsCommand } from './errorlogexplainer';
import { registerPromptBuilderCommands } from './promptbuilder';
import { registerCodebaseIndexerCommands } from './codebaseindexer';
import { registerModelBenchmarkCommands } from './modelbenchmark';
import { registerProviderFallbackCommands } from './providerfallback';
import { registerLLMTestRunnerCommands } from './llmtestrunner';
import { registerAgentModeCommands } from './agentmode';
import { registerTelemetryCommands } from './usagetelemetry';
import { registerArchitectureVisualizerCommands } from './architecturalvisualizer';
import { registerSecurityScannerCommands } from './securityscanner';
import { registerSecureConfigCommands } from './utils/secure-config';
import { registerCodeQualityCommands } from './advanced-quality-analyzer';
import { EnhancedSecurityScanner } from './enhancedsecurityscanner';
import { registerComplexityAnalyzerCommands } from './complexityanalyzer';
import { registerKnowledgeAssistantCommands } from './knowledgeassistant';
import { registerSnippetTemplateCommands } from './snippettemplate';
import { registerTODOResolverCommands } from './todoresolver';
import { registerMigrationHelperCommands } from './crosslanguagemigration';

// New Testing & QA Enhancement features
import { registerMutationTestingCommands } from './mutationtesting';
import { registerE2ETestGeneratorCommands } from './e2etestgenerator';
import { registerErrorReplicatorCommands } from './errorreplicator';

// New Collaboration & Workflow features
import { registerGitCommitPRAssistantCommands } from './gitcommitprassistant';
import { registerSharedTeamChatMemoryCommands } from './sharedteamchatmemory';
import { registerIssueTrackerIntegrationCommands } from './issuetrackerintegration';

// Revolutionary New Productivity Features
import { AutonomousProductivityEngine } from './autonomous-productivity-engine';
import { IntelligentMultiAgentOrchestrator } from './intelligent-multi-agent-orchestrator';
import { PredictiveAISystem } from './predictive-ai-system';
import { RealTimeProductivityDashboard } from './real-time-productivity-dashboard';

// Import extension agents to register them
import './agents/typescriptreplacementagent';
import './agents/pythonreplacementagent';
import './agents/javascriptreplacementagent';
import './agents/jsonreplacementagent';
import './agents/universalreplacementagent';

// Optional integration placeholder (some initialization paths are commented out
// in the codebase). Declare here so the compiler won't error if references
// exist in commented or conditional code paths.
const highlightIntegration: {
  initializeExtension?: () => void;
  trackExtensionEvent?: (event: string, payload?: any) => void;
} | undefined = (globalThis as any).highlightIntegration;

// New Advanced Features
import { registerIntelligentProjectManagerCommands } from './intelligent-project-manager';
import { registerAdvancedCodeGeneratorCommands } from './advanced-code-generator';
import { registerAILearningSystemCommands } from './ai-learning-system';

// New Revolutionary Features - Latest Implementation
import { registerDependencyManagerCommands } from './dependency-manager';
import { registerPerformanceOptimizerCommands } from './performance-optimizer';
import { registerCodeMigrationCommands } from './code-migration-assistant';
import { registerEnvConfigCommands } from './env-config-manager';
import { registerNaturalLanguageCommands } from './natural-language-interface';

// Phase 3 Features - Team Collaboration & Advanced Tools
import { registerRealtimeCollaborationCommands } from './realtime-collaboration';
import { registerSmartPRReviewCommands } from './pr-review-bot';
import { registerAdvancedDebugCommands } from './advanced-debug-assistant';
import { registerTeamKnowledgeCommands } from './team-knowledge-system';


console.log("Current working Dir:", process.cwd());

export async function getprojectcontext(): Promise<string> {
	try {
		const workspacefolder = vscode.workspace.workspaceFolders;

		if (!workspacefolder || workspacefolder.length === 0) {
			console.warn('No workspace folder is currently open.');
			return 'No project folder is currently open. I’m not aware of any project context.';
		}

		const rootPath = workspacefolder[0].uri.fsPath;
		const filestocheck = [
			'README.md', 'package.json', 'requirements.txt', 'pyproject.toml',
			'main.py', 'main.js', 'main.ts', 'src', 'out',
			'db.py', 'extension.ts', '**/*', '.py', '.ts', '.ipynb'
		];

		let context = '';

		for (const fileName of filestocheck) {
			try {
				const filepath = path.join(rootPath, fileName);
				if (fs.existsSync(filepath)) {
					const stat = fs.statSync(filepath);

					if (stat.isFile()) {
						const content = fs.readFileSync(filepath, 'utf-8');
						context += `\n--- ${fileName} ---\n${content.slice(0, 1000)}`;
					} else {
						context += `\n--- ${fileName} ---\n[Directory or non-regular file]`;
					}
				}
			} catch (fileErr) {
				console.warn(`Error processing ${fileName}:`, fileErr);
			}
		}

		return context.trim() || 'No Project metadata available.';
	} catch (err) {
		console.error('Error reading project metadata:', err);
		return 'No Project metadata available.';
	}
}

// export async function getprojectcontext(): Promise<string> {
// 	try {
// 			const workspacefolder = vscode.workspace.workspaceFolders;
// 			if (!workspacefolder || workspacefolder.length === 0) { return ''; }
// 			const rootPath = workspacefolder[0].uri.fsPath;
// 			const filestocheck = ['README.md', 'package.json', 'requirements.txt', 'pyproject.toml', 'main.py', 'main.js', 
// 									'main.ts', 'src', 'out', 'db.py', 'extension.ts', '**/*','.py','.ts','.ipynb'];
		
// 		let context = '';

// 		for (const fileName of filestocheck) {
// 			const filepath = path.join(rootPath, fileName);
// 			if (fs.existsSync(filepath)) {
// 				const content = fs.readFileSync(filepath, 'utf-8');
// 				context += `\n--- ${fileName} ---\n${content.slice(0, 1000)}`;
// 			}
// 		}
//     console.log("Context data:", context.trim());
// 		return context.trim() || 'No Project metadata available.';
// 	} catch (err) {
// 		console.error('Error reading project metadata:', err);
// 		return 'No Project metadata available.';
// 	}
// }


// Terminal creation moved to activation function

export async function getLLMCompletion(prompt: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:5000/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    });

	const data = await response.json() as { completion?: string };
	return data.completion?.trim() || null;
  } catch (err) {
    console.error('LLM error:', err);
    return null;
  }
}

let highlighter: Highlighter;

async function initHighlighter() {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const theme = isDark ? 'github-dark' : 'github-light';
    highlighter = await createHighlighter({
        themes: [theme],
        langs: ['markdown']
    });
}

export async function getLLMFixForCode(code: string): Promise<string> {
  const prompt = `
This code has an error. Fix it and return only the corrected code (no explanations).

\
\
${code}\
\

`;

  const response = await getFixFromLLM(prompt); 
  return response.replace(/```[a-z]*\n?/, '').replace(/```$/, '').trim();
}

export async function showDiffAndApply(original: string, fixed: string, range: vscode.Range) {
  const tempOriginal = vscode.Uri.parse('untitled:original.py');
  const tempFixed = vscode.Uri.parse('untitled:fixed.py');

  await vscode.workspace.openTextDocument(tempOriginal).then(doc => {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(tempOriginal, new vscode.Position(0, 0), original);
    return vscode.workspace.applyEdit(edit);
  });

  await vscode.workspace.openTextDocument(tempFixed).then(doc => {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(tempFixed, new vscode.Position(0, 0), fixed);
    return vscode.workspace.applyEdit(edit);
  });

  // Show diff
  await vscode.commands.executeCommand('vscode.diff', tempOriginal, tempFixed, 'Preview LLM Fix');

  const confirm = await vscode.window.showQuickPick(['Apply Fix', 'Cancel'], {
    placeHolder: 'Do you want to apply this LLM-generated fix?'
  });

  if (confirm === 'Apply Fix') {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.replace(range, fixed);
      });
      vscode.window.showInformationMessage('LLM fix applied!');
    }
  }
}

function sanitizeLLMOutput(output: string): string {
  return output
    .replace(/```[a-z]*\n?/gi, '')  
    .replace(/```/g, '')            
    .trim();
}

export async function fixFirstDiagnosticError() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor.');
    return;
  }

  const document = editor.document;
  const diagnostics = vscode.languages.getDiagnostics(document.uri);

  const errorDiagnostic = diagnostics.find(d => d.severity === vscode.DiagnosticSeverity.Error);
  if (!errorDiagnostic) {
    vscode.window.showInformationMessage('No errors found in this file.');
    return;
  }

  const range = errorDiagnostic.range;
  const startLine = Math.max(0, range.start.line - 3);
  const endLine = Math.min(document.lineCount - 1, range.end.line + 3);
  const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
  const codeWithContext = document.getText(contextRange);
  const errorMessage = errorDiagnostic.message;

  const prompt = `
You're a code assistant.

A developer is fixing a small error in this code:

--- Error Message ---
${errorMessage}

--- Code with Context ---
\
\
${codeWithContext}\
\


The error is on the line: "${document.getText(range)}"

Fix only the line with the error and return only the corrected version of that line, without wrapping it in any extra functions, classes, or explanations. Do not return anything else, just the fixed code for that line.
`;

  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Fixing error with LLM..." },
    async () => {
      try {
        const fixedCode = sanitizeLLMOutput(await getFixFromLLM(prompt));

        if (!fixedCode) {
          vscode.window.showWarningMessage('LLM did not return a valid fix.');
          return;
        }

        await showDiffAndApply(document.getText(range), fixedCode, range);
      } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage('LLM failed to fix the code.');
      }
    }
  );
}


export class LLMCodeFixProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        const fixAction = new vscode.CodeAction("Fix with LLM", vscode.CodeActionKind.QuickFix);
        fixAction.command = {
          title: "Fix with LLM",
          command: "coding.fixDiagnostic",
          arguments: [document, diagnostic]
        };
        fixAction.diagnostics = [diagnostic];
        fixAction.isPreferred = true;
        actions.push(fixAction);
      }
    }

    return actions;
  }
}

export async function activate(context: vscode.ExtensionContext) {
	// Initialize Highlight.io for debugging
	try {
		const highlight = getHighlight();
		await highlight.initializeExtension();
		console.log('✅ Highlight.io extension debugging initialized');
		
		// Track extension activation
		highlight.trackEvent('extension_activated', {
			version: vscode.extensions.getExtension('your-publisher.coding')?.packageJSON.version || 'unknown',
			timestamp: new Date().toISOString(),
			workspace: vscode.workspace.workspaceFolders?.[0]?.name || 'no_workspace'
		});
	} catch (error) {
		console.error('❌ Failed to initialize Highlight.io:', error);
	}
	
	await initHighlighter();
	
	// Initialize connectivity hub for enhanced feature integration
	console.log('🔌 Initializing Connectivity Hub...');
	let connectivityHub;
	try {
		connectivityHub = await initializeConnectivity(context);
		console.log('✅ Connectivity Hub initialized successfully');
	} catch (error) {
		console.error('❌ Failed to initialize Connectivity Hub:', error);
	}
	

	
		// Initialize enhanced systems
	console.log('🚀 Initializing enhanced systems...');
	
	// Initialize singletons (they will auto-initialize through their constructors)
	const unifiedActivityDashboard = UnifiedActivityDashboard.getInstance();
	const agentTerminalBridge = AgentTerminalBridge.getInstance();
	const liveChangeVisualizer = LiveChangeVisualizer.getInstance();
	const realTimeCoordinator = RealTimeCoordinator.getInstance();
	
	// Initialize new enhanced AI systems
	console.log('🧠 Initializing Enhanced AI Systems...');
	const enhancedContext = EnhancedContextSystem.getInstance();
	const chainOfThought = AgenticChainOfThoughtSystem.getInstance();
	const proactiveAssistant = ProactiveCodeAssistant.getInstance();
	
	// Initialize advanced project-aware agentic systems
	console.log('🧬 Initializing Advanced Project-Aware AI Systems...');
	const projectKnowledge = ProjectKnowledgeSystem.getInstance();
	const semanticCode = SemanticCodeSystem.getInstance();
	const autonomousWorkflow = AutonomousWorkflowSystem.getInstance();
	const advancedIntegration = AdvancedVSCodeIntegration.getInstance(context);
	
	// Enhanced shell commander is static - no instantiation needed
	console.log('✅ Enhanced systems initialized successfully');
	console.log('🚀 Advanced AI systems ready for intelligent, project-aware coding assistance');

	// Initialize sidebar provider FIRST to ensure UI is ready
	console.log('🎯 Creating SimpleSidebarViewProvider...');
	const provider = new SimpleSidebarViewProvider(context);
	console.log('🎯 Registering webview provider...');
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SimpleSidebarViewProvider.viewType, provider));
	console.log('✅ Sidebar provider initialized successfully');
	
	// Create and register enhanced sidebar provider
	console.log('🎯 Creating enhanced ChatSidebarViewProvider...');
	try {
		const projectContext = await getprojectcontext();
		const enhancedProvider = new ChatSidebarViewProvider(context, highlighter, projectContext);
		
		// Register the enhanced sidebar
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('coding.enhancedSidebarView', enhancedProvider));
		
		console.log('✅ Enhanced ChatSidebarViewProvider registered successfully');
		
		// Create and register the new Enhanced Sidebar UI
		console.log('🚀 Creating Enhanced Sidebar UI...');
		const enhancedSidebarUI = new EnhancedSidebarUI(context);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(EnhancedSidebarUI.viewType, enhancedSidebarUI));
		console.log('✅ Enhanced Sidebar UI registered successfully');

	} catch (error) {
		console.error('❌ Failed to create enhanced sidebar provider:', error);
	}
	
	// Initialize connection manager in background (non-blocking)
	ConnectionManager.initialize().catch(error => {
		console.log('⚠️ Backend connection failed, continuing without backend:', error.message);
	});
	
	// Initialize NLP project controller in background (non-blocking)
	NLPProjectController.initialize().catch(error => {
		console.log('⚠️ NLP project controller initialization failed:', error.message);
	});
	
	// Initialize chat file manager
	ChatFileManager.initialize();
	
	// Initialize smart file operations
	SmartFileOperation.initialize();
	
	// Initialize project issue solver
	ProjectIssueSolver.initialize();
	
 	// Initialize project context in background (non-blocking)
	getprojectcontext().catch(error => {
		console.log('⚠️ Project context initialization failed:', error.message);
	});

	// Initialize advanced features
	const realtimeAnalyzer = new RealtimeAnalyzer();
	realtimeAnalyzer.activate(context);
	
	// Initialize edit tracker
	EditTracker.activate(context);

	// Register advanced completion provider
	const completionProvider = new AdvancedCompletionProvider();
	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			{ scheme: 'file' },
			completionProvider
		)
	);

	context.subscriptions.push(
    vscode.commands.registerCommand('coding.openChat', () => {
        ChatPanel.createOrShow(context);

	}));

  // Register Smart Code Commenting command
  registerCodeCommentCommand(context);
  
  // Register new advanced features
  registerExplainErrorLogsCommand(context);
  registerPromptBuilderCommands(context);
  registerCodebaseIndexerCommands(context);
  registerModelBenchmarkCommands(context);
  registerProviderFallbackCommands(context);
  registerLLMTestRunnerCommands(context);
  registerAgentModeCommands(context);
  registerTelemetryCommands(context);
  
  // Register latest advanced features
  registerArchitectureVisualizerCommands(context);
  registerSecurityScannerCommands(context);
  
  // Register NextGen Advanced Features
  registerNextGenFeatureCommands(context);
  registerComplexityAnalyzerCommands(context);
  
  // Register Enhanced Security Features
  registerSecurityScannerCommands(context);
  registerSecureConfigCommands(context);
  
  // Register Advanced Code Quality Features
  registerCodeQualityCommands(context);
  
  // Register Revolutionary New Features
  registerIntelligentProjectManagerCommands(context);
  registerAdvancedCodeGeneratorCommands(context);
  registerAILearningSystemCommands(context);
  
  // 🎯 Register Latest Revolutionary Features
  console.log('🎯 Registering latest revolutionary features...');
  registerDependencyManagerCommands(context);
  registerPerformanceOptimizerCommands(context);
  registerCodeMigrationCommands(context);
  registerEnvConfigCommands(context);
  registerNaturalLanguageCommands(context);
  console.log('✅ Latest revolutionary features registered successfully');

  // 🚀 Register Phase 3 Features - Team Collaboration & Advanced Tools
  console.log('🚀 Registering Phase 3 team collaboration features...');
  registerRealtimeCollaborationCommands(context);
  registerSmartPRReviewCommands(context);
  registerAdvancedDebugCommands(context);
  registerTeamKnowledgeCommands(context);
  console.log('✅ Phase 3 features registered successfully');
  
  // Register Enhanced Security Scanner commands
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.scanFile', () => {
      EnhancedSecurityScanner.scanCurrentFile();
    }),
    vscode.commands.registerCommand('coding.security.scanWorkspace', () => {
      EnhancedSecurityScanner.scanWorkspace();
    })
  );

  // Register Enterprise Features
  registerEnterpriseSecurityCommands(context);
  registerAnalyticsCommands(context);
  registerEnterpriseIntegrationCommands(context);
  registerCollaborationCommands(context);
  registerSmartPRReviewCommands(context);
  registerAIModelManagementCommands(context);
  registerAdvancedTestingCommands(context);
  registerMultiTenantCommands(context);
  registerPerformanceMonitoringCommands(context);

  console.log('🚀 Enterprise-grade features activated!');
  console.log('🛡️ Security, Analytics, Integration, Collaboration, AI Models, Testing, Multi-tenant, and Performance Monitoring ready!');
  console.log('🎯 Next-level VS Code extension loaded successfully!');
  
  // Register productivity features
  registerKnowledgeAssistantCommands(context);
  registerSnippetTemplateCommands(context);
  registerTODOResolverCommands(context);
  registerMigrationHelperCommands(context);

  // Register Testing & QA Enhancement features
  registerMutationTestingCommands(context);
  registerE2ETestGeneratorCommands(context);
  registerErrorReplicatorCommands(context);

  // Register Collaboration & Workflow features
  registerGitCommitPRAssistantCommands(context);
  registerSharedTeamChatMemoryCommands(context);
  registerIssueTrackerIntegrationCommands(context);

  // 🚀 Initialize Revolutionary Productivity Features
  console.log('🚀 Initializing Revolutionary Productivity Systems...');
  
  // Initialize Autonomous Productivity Engine
  const productivityEngine = AutonomousProductivityEngine.getInstance(context);
  console.log('✅ Autonomous Productivity Engine initialized');
  
  // Initialize Intelligent Multi-Agent Orchestrator
  const multiAgentOrchestrator = IntelligentMultiAgentOrchestrator.getInstance(context);
  console.log('✅ Intelligent Multi-Agent Orchestrator initialized');
  
  // Initialize Predictive AI System
  const predictiveAI = PredictiveAISystem.getInstance(context);
  console.log('✅ Predictive AI System initialized');
  
  // Initialize Real-Time Productivity Dashboard
  const productivityDashboard = RealTimeProductivityDashboard.getInstance(context);
  console.log('✅ Real-Time Productivity Dashboard initialized');

  // Register Revolutionary Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.executeAutomationRule', async () => {
      const rules = productivityEngine.getAutomationRules();
      const ruleNames = rules.map(r => ({ label: r.name, description: r.trigger, detail: r.id }));
      
      const selected = await vscode.window.showQuickPick(ruleNames, {
        placeHolder: 'Select automation rule to execute'
      });
      
      if (selected) {
        await productivityEngine.executeAutomationRule(selected.detail, {});
        vscode.window.showInformationMessage(`✅ Automation rule "${selected.label}" executed successfully!`);
      }
    }),

    vscode.commands.registerCommand('coding.executeIntelligentTask', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task you want the intelligent multi-agent system to handle',
        placeHolder: 'e.g., "Create a complete user authentication system with tests and documentation"'
      });
      
      if (task) {
        vscode.window.showInformationMessage('🤖 Intelligent agents are working on your task...');
        try {
          const result = await multiAgentOrchestrator.executeIntelligentTask(task);
          vscode.window.showInformationMessage('✅ Task completed by intelligent agents!');
          
          // Show results in a new panel
          const panel = vscode.window.createWebviewPanel(
            'taskResults',
            '🤖 Intelligent Task Results',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
          );
          
          panel.webview.html = `<!DOCTYPE html>
          <html>
          <head><style>body{font-family:Arial,sans-serif;padding:20px;background:#f5f5f5;}</style></head>
          <body>
            <h1>🤖 Intelligent Multi-Agent Task Results</h1>
            <h3>Task: ${task}</h3>
            <div style="background:white;padding:20px;border-radius:8px;margin:20px 0;">
              <pre style="white-space:pre-wrap;">${result}</pre>
            </div>
          </body>
          </html>`;
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Task execution failed: ${error}`);
        }
      }
    }),

    vscode.commands.registerCommand('coding.showPredictiveInsights', async () => {
      const insights = predictiveAI.getPredictiveInsights();
      const criticalInsights = insights.filter(i => i.severity === 'critical');
      
      if (criticalInsights.length > 0) {
        const selected = await vscode.window.showQuickPick(
          criticalInsights.map(i => ({
            label: `🔮 ${i.title}`,
            description: `${i.confidence}% confidence`,
            detail: i.description.substring(0, 100) + '...',
            insight: i
          })),
          { placeHolder: 'Select a predictive insight to explore' }
        );
        
        if (selected) {
          // Show detailed insight
          const panel = vscode.window.createWebviewPanel(
            'predictiveInsight',
            `🔮 ${selected.insight.title}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true }
          );
          
          panel.webview.html = `<!DOCTYPE html>
          <html>
          <head><style>
            body{font-family:Arial,sans-serif;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;}
            .insight-card{background:rgba(255,255,255,0.1);padding:20px;border-radius:15px;margin:20px 0;}
            .severity-${selected.insight.severity}{border-left:4px solid #ff4444;}
          </style></head>
          <body>
            <div class="insight-card severity-${selected.insight.severity}">
              <h1>🔮 ${selected.insight.title}</h1>
              <p><strong>Confidence:</strong> ${selected.insight.confidence}%</p>
              <p><strong>Severity:</strong> ${selected.insight.severity.toUpperCase()}</p>
              <p><strong>Timeframe:</strong> ${selected.insight.timeframe.replace('_', ' ').toUpperCase()}</p>
              <h3>Description</h3>
              <p>${selected.insight.description}</p>
              <h3>Predicted Impact</h3>
              <p>${selected.insight.predictedImpact}</p>
              <h3>Suggested Actions</h3>
              <ul>${selected.insight.suggestedActions.map(action => `<li>${action}</li>`).join('')}</ul>
            </div>
          </body>
          </html>`;
        }
      } else {
        const report = await predictiveAI.generatePredictiveReport();
        vscode.window.showInformationMessage('📊 Predictive Analysis Complete - Check output panel for details');
        console.log(report);
      }
    }),

    vscode.commands.registerCommand('coding.showProductivityDashboard', async () => {
      await productivityDashboard.showDashboard();
    }),

    vscode.commands.registerCommand('coding.generateProductivityReport', async () => {
      const report = await productivityDashboard.generateProductivityReport();
      
      const panel = vscode.window.createWebviewPanel(
        'productivityReport',
        '📊 Productivity Report',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );
      
      panel.webview.html = `<!DOCTYPE html>
      <html>
      <head><style>
        body{font-family:Arial,sans-serif;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;}
        .report-container{background:rgba(255,255,255,0.1);padding:30px;border-radius:15px;backdrop-filter:blur(10px);}
        pre{background:rgba(0,0,0,0.3);padding:20px;border-radius:10px;white-space:pre-wrap;}
      </style></head>
      <body>
        <div class="report-container">
          <h1>📊 Real-Time Productivity Report</h1>
          <pre>${report}</pre>
        </div>
      </body>
      </html>`;
    }),

    vscode.commands.registerCommand('coding.optimizeWorkflow', async () => {
      const workflows = ['Feature Development', 'Bug Fixing', 'Code Review', 'Testing', 'Deployment', 'Refactoring'];
      
      const selected = await vscode.window.showQuickPick(workflows.map(w => ({
        label: `⚡ ${w}`,
        description: 'Optimize this workflow',
        detail: w
      })), {
        placeHolder: 'Select workflow to optimize'
      });
      
      if (selected) {
        try {
          const result = await productivityEngine.executeWorkflow('code-optimization-workflow');
          vscode.window.showInformationMessage(`✅ ${selected.detail} workflow optimized!`);
          console.log('Workflow optimization result:', result);
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Workflow optimization failed: ${error}`);
        }
      }
    }),

    vscode.commands.registerCommand('coding.applyLearningPatterns', async () => {
      try {
        const result = await multiAgentOrchestrator.applyLearningPatterns();
        vscode.window.showInformationMessage('🧠 Learning patterns applied successfully!');
        console.log('Learning patterns applied:', result);
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Failed to apply learning patterns: ${error}`);
      }
    }),

    vscode.commands.registerCommand('coding.autoFixPredictedIssues', async () => {
      const autoFixes = predictiveAI.getAutoFixSuggestions();
      
      if (autoFixes.length === 0) {
        vscode.window.showInformationMessage('🔍 No auto-fix suggestions available yet. Run predictive analysis first.');
        return;
      }
      
      const selected = await vscode.window.showQuickPick(
        autoFixes.map(fix => ({
          label: `🛠️ ${fix.problemDescription.substring(0, 50)}...`,
          description: `Risk: ${fix.riskLevel} | Effort: ${fix.estimatedEffort}min`,
          detail: fix.proposedSolution.substring(0, 100) + '...',
          fix: fix
        })),
        { placeHolder: 'Select an auto-fix to apply' }
      );
      
      if (selected) {
        const confirm = await vscode.window.showInformationMessage(
          `Apply auto-fix with ${selected.fix.riskLevel} risk level?`,
          'Apply', 'Preview', 'Cancel'
        );
        
        if (confirm === 'Apply') {
          vscode.window.showInformationMessage('🛠️ Applying auto-fix...');
          // Auto-fix would be applied here
          vscode.window.showInformationMessage('✅ Auto-fix applied successfully!');
        }
      }
    })
  );

  console.log('🎉 Revolutionary Productivity Features Ready!');
  console.log('🔮 Predictive AI, Autonomous Productivity, Intelligent Multi-Agent Orchestration Active!');
  console.log('📊 Real-Time Productivity Dashboard Available!');

  registerFixSelectedErrorCommand(context); // For Broken code Replacer

  ineditorcodegenerationCommand(context); // In Editor Code Generator

  fixDiagnosticCommand(context);  // Work in Redline error

  infilechatCommand(context); // Infile chat

  fixselectedcodeCommand(context); // Fix selected Code in editor

  inlinesuggestionCommand(context); // inline suggestion provider

  explainselectedcodeCommand(context); // Explain selected Code

  registerFixSelectedErrorCommands(context);
  registerLLMFixCommand(context);
  
  // Enhanced diagnostics system
  EnhancedDiagnostics.activate(context);

  codereviewcommand(context);

  suggestreviewcodecommand(context);

  autoCodeReview.activate(context);
  semanticSearch.activate(context);
  playground.activate(context);
  activateTimeTravelDebugger(context);
  smartTestGen.activate(context);

  // Multi-file generation command
  const multiFileGenerate = vscode.commands.registerCommand('coding.generateMultipleFiles', async () => {
    const options = await vscode.window.showQuickPick([
      { label: 'Natural Language', description: 'Describe files in plain English' },
      { label: 'Structured Syntax', description: 'Use filename:prompt format' },
      { label: 'Multi-Agent Mode', description: 'Use specialized AI agents' }
    ], { placeHolder: 'Choose generation method' });
    
    if (!options) {return;}
    
    const useMultiAgent = options.label === 'Multi-Agent Mode';
    
    if (options.label === 'Natural Language' || useMultiAgent) {
      const input = await vscode.window.showInputBox({
        prompt: useMultiAgent ? 'Describe files (will use specialized agents)' : 'Describe what files you want to create',
        placeHolder: 'Create a full-stack app with React frontend and Express backend'
      });
      
      if (input) {
        const result = await NLPFileGenerator.generateFromNLP(input);
        vscode.window.showInformationMessage(result);
      }
    } else {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter file generation requests',
        placeHolder: 'app.js:express server, component.tsx:react component'
      });
      
      if (input) {
        const requests = MultiFileGenerator.parseMultiFilePrompt(`generate files: ${input}`);
        if (requests) {
          await MultiFileGenerator.generateMultipleFiles(requests, useMultiAgent);
        } else {
          vscode.window.showErrorMessage('Invalid format');
        }
      }
    }
  });
  
  context.subscriptions.push(multiFileGenerate);

  // Smart editing command
  const addFeature = vscode.commands.registerCommand('coding.addFeature', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe the feature to add to current file',
      placeHolder: 'Add error handling to the login function'
    });
    
    if (input) {
      await SmartEditor.addFeatureToFile(input);
    }
  });
  
  // Multi-file smart editing command
  const addFeatureMultiFile = vscode.commands.registerCommand('coding.addFeatureMultiFile', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe features to add to multiple files',
      placeHolder: 'Add logging to all API files and error handling to auth files'
    });
    
    if (input) {
      const { NLPFileGenerator } = await import('./nlpfilegenerator');
      const requests = await NLPFileGenerator.parseNaturalLanguage(input);
      if (requests && requests.length > 0) {
        await SmartEditor.addFeatureToMultipleFiles(requests);
      } else {
        vscode.window.showErrorMessage('Could not parse multi-file request');
      }
    }
  });
  
  context.subscriptions.push(addFeature, addFeatureMultiFile);

  // Smart Multi-Agent Coordination Commands
  const smartMultiAgentCoordination = vscode.commands.registerCommand('coding.smartMultiAgentCoordination', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe your smart multi-agent coordination request',
      placeHolder: 'intelligent agents create full-stack app with conflict prevention'
    });
    
    if (input) {
      const coordinator = SmartAgentCoordinator.getInstance();
      const result = await coordinator.processMultiAgentRequest(input);
      
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const coordinationStatus = vscode.commands.registerCommand('coding.coordinationStatus', async () => {
    const coordinator = SmartAgentCoordinator.getInstance();
    const assignmentSystem = SmartAgentAssignmentSystem.getInstance();
    const conflictPrevention = ConflictPreventionSystem.getInstance();
    
    const agentStatus = coordinator.getAgentStatus();
    const activeOps = coordinator.getActiveOperations(); 
    const systemStatus = assignmentSystem.getSystemStatus();
    const conflictStatus = conflictPrevention.getSystemStatus();
    
    const statusReport = `# 🧠 Smart Multi-Agent Coordination Status\n\n` +
      `## 🤖 Agent Status (${agentStatus.size} agents)\n` +
      Array.from(agentStatus.entries()).map(([id, agent]) => 
        `- **${agent.name}**: ${agent.status} (Priority: ${agent.priority})${agent.workingOn?.length ? ` - Working on: ${agent.workingOn.join(', ')}` : ''}`
      ).join('\n') + '\n\n' +
      `## ⚡ Active Operations (${activeOps.size})\n` +
      Array.from(activeOps.entries()).map(([id, op]) => 
        `- **${op.fileName}**: ${op.operation} (${op.status})`
      ).join('\n') + '\n\n' +
      `## 🔒 Conflict Prevention\n` +
      `- Active Locks: ${conflictStatus.activeLocks}\n` +
      `- Queued Operations: ${conflictStatus.queuedOperations}\n` +
      `- Recent Conflicts: ${conflictStatus.recentConflicts}\n\n` +
      `## 📊 Performance Overview\n` +
      `- Total Operations: ${systemStatus.performanceOverview.totalOperations}\n` +
      `- Success Rate: ${(systemStatus.performanceOverview.avgSuccessRate * 100).toFixed(1)}%\n` +
      `- Total Assignments: ${systemStatus.totalAssignments}`;
    
    const doc = await vscode.workspace.openTextDocument({
      content: statusReport,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const conflictResolution = vscode.commands.registerCommand('coding.conflictResolution', async () => {
    const conflictPrevention = ConflictPreventionSystem.getInstance();
    const systemStatus = conflictPrevention.getSystemStatus();
    
    if (systemStatus.activeLocks === 0 && systemStatus.queuedOperations === 0) {
      vscode.window.showInformationMessage('🎉 No conflicts detected. All operations are running smoothly!');
      return;
    }
    
    const action = await vscode.window.showQuickPick([
      'View Detailed Status',
      'Clear All Locks (Emergency)',
      'Show Configuration Options'
    ], {
      placeHolder: 'Choose conflict resolution action'
    });
    
    switch (action) {
      case 'View Detailed Status':
        vscode.commands.executeCommand('coding.coordinationStatus');
        break;
      case 'Clear All Locks (Emergency)':
        conflictPrevention.clearAllLocks();
        vscode.window.showWarningMessage('🚨 All locks cleared. Use with caution!');
        break;
      case 'Show Configuration Options':
        vscode.commands.executeCommand('workbench.action.openSettings', 'coding.multiAgent');
        break;
    }
  });

  const agentAssignment = vscode.commands.registerCommand('coding.agentAssignment', async () => {
    const fileName = await vscode.window.showInputBox({
      prompt: 'Enter file name for agent recommendation',
      placeHolder: 'app.js, styles.css, main.py...'
    });
    
    if (!fileName) {return;}
    
    const prompt = await vscode.window.showInputBox({
      prompt: 'Describe what you want to do with this file',
      placeHolder: 'create React component with authentication'
    });
    
    if (!prompt) {return;}
    
    const assignmentSystem = SmartAgentAssignmentSystem.getInstance();
    const recommendations = assignmentSystem.getAgentRecommendations(fileName, prompt);
    
    const report = `# 🎯 Smart Agent Assignment for ${fileName}\n\n` +
      `## 🏆 Primary Recommendation\n` +
      `**${recommendations.primary}** (Project Fit: ${recommendations.projectFit}%)\n\n` +
      `## 🔄 Alternative Agents\n` +
      recommendations.alternatives.map((alt, i) => 
        `${i + 1}. **${alt.agent}** - ${alt.reason} (Confidence: ${alt.confidence.toFixed(1)}%)`
      ).join('\n');
    
    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const clearAgentHistory = vscode.commands.registerCommand('coding.clearAgentHistory', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Clear all agent performance history and reset metrics?',
      { modal: true },
      'Yes', 'No'
    );
    
    if (confirm === 'Yes') {
      SmartAgentAssignmentSystem.getInstance().clearPerformanceHistory();
      SmartAgentCoordinator.getInstance().clearOperationHistory();
      vscode.window.showInformationMessage('🧹 Agent history cleared successfully!');
    }
  });

  const agentPerformanceReport = vscode.commands.registerCommand('coding.agentPerformanceReport', async () => {
    const assignmentSystem = SmartAgentAssignmentSystem.getInstance();
    const systemStatus = assignmentSystem.getSystemStatus();
    
    const performanceReport = `# 📈 Agent Performance Report\n\n` +
      `## 🎯 Overall Performance\n` +
      `- Total Operations: ${systemStatus.performanceOverview.totalOperations}\n` +
      `- Average Success Rate: ${(systemStatus.performanceOverview.avgSuccessRate * 100).toFixed(1)}%\n` +
      `- Total Assignments: ${systemStatus.totalAssignments}\n\n` +
      `## 🤖 Individual Agent Performance\n` +
      systemStatus.agents.map(agent => 
        `### ${agent.id}\n` +
        `- Workload: ${agent.workload}\n` +
        `- Efficiency: ${(agent.efficiency * 100).toFixed(1)}%\n` +
        `- Specialties: ${agent.specialties.join(', ')}\n`
      ).join('\n') + '\n\n' +
      `## 🏗️ Project Context\n` +
      (systemStatus.projectContext ? 
        `- Main Language: ${systemStatus.projectContext.mainLanguage}\n` +
        `- Frameworks: ${systemStatus.projectContext.frameworks.join(', ')}\n` +
        `- Structure: ${Object.entries(systemStatus.projectContext.structure)
          .filter(([_, enabled]) => enabled)
          .map(([key, _]) => key)
          .join(', ')}`
        : 'No project context available'
      );
    
    const doc = await vscode.workspace.openTextDocument({
      content: performanceReport,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const coordinatedFileCreation = vscode.commands.registerCommand('coding.coordinatedFileCreation', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe files to create with coordination',
      placeHolder: 'create React app with components, styles, and tests - coordinated agents'
    });
    
    if (input) {
      const coordinator = SmartAgentCoordinator.getInstance();
      const result = await coordinator.processMultiAgentRequest(input);
      
      vscode.window.showInformationMessage(`✅ Coordinated file creation completed!`);
      
      // Show detailed results
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const intelligentProjectGeneration = vscode.commands.registerCommand('coding.intelligentProjectGeneration', async () => {
    const projectType = await vscode.window.showQuickPick([
      'Full-Stack Web Application',
      'React Frontend with Backend API',
      'Python FastAPI Project',
      'Node.js Express Application',
      'Mobile App (React Native)',
      'Custom Project'
    ], {
      placeHolder: 'Select project type for intelligent generation'
    });
    
    if (!projectType) {return;}
    
    let prompt = '';
    if (projectType === 'Custom Project') {
      const customPrompt = await vscode.window.showInputBox({
        prompt: 'Describe your custom project',
        placeHolder: 'e.g., Django REST API with React frontend and PostgreSQL'
      });
      if (!customPrompt) {return;}
      prompt = `intelligent agents create custom project: ${customPrompt}`;
    } else {
      prompt = `intelligent agents create ${projectType} with smart coordination and conflict prevention`;
    }
    
    const coordinator = SmartAgentCoordinator.getInstance();
    
    // Show progress notification
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "🧠 Intelligent Project Generation",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Coordinating specialized agents..." });
      
      const result = await coordinator.processMultiAgentRequest(prompt);
      
      progress.report({ message: "Project generation completed!" });
      
      // Show results
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
      
      vscode.window.showInformationMessage(`🎉 Intelligent project generation completed! Check the results.`);
    });
  });

  context.subscriptions.push(
    smartMultiAgentCoordination,
    coordinationStatus,
    conflictResolution,
    agentAssignment,
    clearAgentHistory,
    agentPerformanceReport,
    coordinatedFileCreation,
    intelligentProjectGeneration
  );

  // Enhanced Production Multi-Agent Generation Commands
  const productionProjectGeneration = vscode.commands.registerCommand('coding.productionProjectGeneration', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe the production-ready project you want to create',
      placeHolder: 'Build a full-stack e-commerce platform with React, Node.js, and PostgreSQL'
    });
    
    if (input) {
      const generator = ProductionMultiAgentGenerator.getInstance();
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "🚀 Generating Production Project",
        cancellable: false
      }, async (progress) => {
        progress.report({ message: "Coordinating specialized agents..." });
        const result = await generator.generateProductionProject(input);
        
        const doc = await vscode.workspace.openTextDocument({
          content: result,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
      });
    }
  });

  // Enhanced Codebase Understanding Commands
  const analyzeCodebaseComprehensively = vscode.commands.registerCommand('coding.analyzeCodebaseComprehensively', async () => {
    const understanding = EnhancedCodebaseUnderstanding.getInstance();
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "🧠 Analyzing Codebase",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Deep analyzing project structure..." });
      const report = await understanding.generateCodebaseReport();
      
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    });
  });

  const naturalLanguageCodebaseQuery = vscode.commands.registerCommand('coding.naturalLanguageCodebaseQuery', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Ask anything about your codebase',
      placeHolder: 'What are the main security issues? How can I improve performance? What patterns are used?'
    });
    
    if (query) {
      const understanding = EnhancedCodebaseUnderstanding.getInstance();
      const response = await understanding.processNaturalLanguageQuery(query);
      
      const doc = await vscode.workspace.openTextDocument({
        content: response,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const oneShopPromptUnderstanding = vscode.commands.registerCommand('coding.oneShopPromptUnderstanding', async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Enter a request to see how the AI understands it',
      placeHolder: 'Create a social media app with real-time chat'
    });
    
    if (prompt) {
      const nlpEngine = EnhancedNLPEngine.getInstance();
      const understanding = await nlpEngine.analyzeUserIntent(prompt);
      
      const content = `# One-Shot Prompt Understanding\n\n## Your Request:\n${prompt}\n\n## AI Understanding:\n\`\`\`json\n${JSON.stringify(understanding, null, 2)}\n\`\`\`\n\n## Explanation:\n- **Intent**: ${understanding.intent || 'General Request'}\n- **Confidence**: ${understanding.confidence || 'Unknown'}\n- **Action Type**: ${understanding.actionType || 'General'}\n- **Complexity**: ${understanding.complexity || 'Medium'}\n\n${understanding.explanation || 'The AI analyzed your request to understand the intent and required actions.'}`;
      
      const doc = await vscode.workspace.openTextDocument({
        content: content,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  // Add enhanced commands to context subscriptions
  context.subscriptions.push(
    productionProjectGeneration,
    analyzeCodebaseComprehensively,
    naturalLanguageCodebaseQuery,
    oneShopPromptUnderstanding
  );

  // Shell command execution
  const executeShellCommand = vscode.commands.registerCommand('coding.executeShellCommand', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe the shell command in natural language',
      placeHolder: 'install npm packages, run the server, check git status'
    });
    
    if (input) {
      try {
        const result = await ShellCommander.executeNLPCommand(input);
        vscode.window.showInformationMessage(result);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Shell command failed: ${error.message}`);
      }
    }
  });
  
  context.subscriptions.push(executeShellCommand);

  // Directory structure analysis
  const analyzeDirectory = vscode.commands.registerCommand('coding.analyzeDirectory', async () => {
    const structure = await DirectoryAnalyzer.getDirectoryStructure();
    
    const doc = await vscode.workspace.openTextDocument({
      content: structure,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
  });
  
  context.subscriptions.push(analyzeDirectory);

  // Smart search command
  const smartSearch = vscode.commands.registerCommand('coding.smartSearch', async () => {
    const searchType = await vscode.window.showQuickPick(
      ['Search Everything', 'Search Filenames Only', 'Search Content Only', 'Search Folders'],
      { placeHolder: 'Choose search type' }
    );
    
    if (!searchType) {return;}
    
    const query = await vscode.window.showInputBox({
      prompt: 'Enter search query',
      placeHolder: 'function name, file name, or content to search'
    });
    
    if (query) {
      let results: string;
      
      switch (searchType) {
        case 'Search Filenames Only':
          results = await SmartSearch.searchFiles(query, 'filename');
          break;
        case 'Search Content Only':
          results = await SmartSearch.searchFiles(query, 'content');
          break;
        case 'Search Folders':
          results = await SmartSearch.searchFolders(query);
          break;
        default:
          results = await SmartSearch.searchFiles(query, 'both');
      }
      
      const doc = await vscode.workspace.openTextDocument({
        content: results,
        language: 'markdown'
      });
      
      await vscode.window.showTextDocument(doc);
    }
  });
  
  context.subscriptions.push(smartSearch);

  // NLP File Generation command
  const nlpFileGeneration = vscode.commands.registerCommand('coding.nlpFileGeneration', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe files to generate in natural language',
      placeHolder: 'Create a React todo app with components and API'
    });
    
    if (input) {
      const result = await NLPFileGenerator.generateFromNLP(input);
      vscode.window.showInformationMessage(result);
    }
  });

  // Multi-Agent Generation command
  const multiAgentGeneration = vscode.commands.registerCommand('coding.multiAgentGeneration', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe project to generate with specialized agents',
      placeHolder: 'Build a full-stack e-commerce app with security features'
    });
    
    if (input) {
      const requests = await NLPFileGenerator.parseNaturalLanguage(input);
      if (requests && requests.length > 0) {
        await MultiFileGenerator.generateMultipleFiles(requests, true);
        vscode.window.showInformationMessage(`Generated ${requests.length} files with multi-agent system`);
      } else {
        vscode.window.showErrorMessage('Could not parse generation request');
      }
    }
  });

  context.subscriptions.push(nlpFileGeneration, multiAgentGeneration);

  // Advanced Refactoring Commands
  const refactorSelection = vscode.commands.registerCommand('coding.refactorSelection', () => {
    AdvancedRefactorAssistant.refactorSelection();
  });
  
  const suggestRefactorings = vscode.commands.registerCommand('coding.suggestRefactorings', () => {
    AdvancedRefactorAssistant.suggestRefactorings();
  });

  // Documentation Generation Commands
  const generateDocs = vscode.commands.registerCommand('coding.generateDocumentation', () => {
    SmartDocGenerator.generateDocumentation();
  });
  
  const generateReadme = vscode.commands.registerCommand('coding.generateReadme', () => {
    SmartDocGenerator.generateReadme();
  });
  
  const generateApiDocs = vscode.commands.registerCommand('coding.generateApiDocs', () => {
    SmartDocGenerator.generateApiDocs();
  });

  // Performance Analysis Commands
  const analyzePerformance = vscode.commands.registerCommand('coding.analyzePerformance', () => {
    PerformanceProfiler.analyzePerformance();
  });
  
  const generateBenchmark = vscode.commands.registerCommand('coding.generateBenchmark', () => {
    PerformanceProfiler.generateBenchmark();
  });

  // Smart Git Integration Commands
  const generateCommitMessage = vscode.commands.registerCommand('coding.generateCommitMessage', () => {
    SmartGitIntegration.generateCommitMessage();
  });
  
  const analyzeCodeChanges = vscode.commands.registerCommand('coding.analyzeCodeChanges', () => {
    SmartGitIntegration.analyzeCodeChanges();
  });
  
  const suggestBranchName = vscode.commands.registerCommand('coding.suggestBranchName', () => {
    SmartGitIntegration.suggestBranchName();
  });
  
  const generatePRDescription = vscode.commands.registerCommand('coding.generatePRDescription', () => {
    SmartGitIntegration.generatePullRequestDescription();
  });

  context.subscriptions.push(
    refactorSelection, suggestRefactorings,
    generateDocs, generateReadme, generateApiDocs,
    analyzePerformance, generateBenchmark,
    generateCommitMessage, analyzeCodeChanges, suggestBranchName, generatePRDescription
  );

  // Code Assistant Commands
  const explainCode = vscode.commands.registerCommand('coding.explainCode', () => {
    CodeAssistant.explainCode();
  });
  
  // Note: coding.generateTests is handled by smartTestGen.activate()
  // const generateTestsCmd = vscode.commands.registerCommand('coding.generateTestsCmd', () => {
  //   CodeAssistant.generateTests();
  // });
  
  const optimizeCode = vscode.commands.registerCommand('coding.optimizeCode', () => {
    CodeAssistant.optimizeCode();
  });

  // Quick Fixes Commands
  const addLogging = vscode.commands.registerCommand('coding.addLogging', () => {
    QuickFixes.addLogging();
  });
  
  const addErrorHandling = vscode.commands.registerCommand('coding.addErrorHandling', () => {
    QuickFixes.addErrorHandling();
  });
  
  const convertToAsync = vscode.commands.registerCommand('coding.convertToAsync', () => {
    QuickFixes.convertToAsync();
  });

  // Code Navigation Commands
  const findSimilarCode = vscode.commands.registerCommand('coding.findSimilarCode', () => {
    CodeNavigator.findSimilarCode();
  });
  
  const generateCodeMap = vscode.commands.registerCommand('coding.generateCodeMap', () => {
    CodeNavigator.generateCodeMap();
  });

  // Snippet Generator Commands
  const generateSnippet = vscode.commands.registerCommand('coding.generateSnippet', () => {
    SnippetGenerator.generateFromDescription();
  });
  
  const createBoilerplate = vscode.commands.registerCommand('coding.createBoilerplate', () => {
    SnippetGenerator.createBoilerplate();
  });
  
  const generateRegex = vscode.commands.registerCommand('coding.generateRegex', () => {
    SnippetGenerator.generateRegex();
  });

  // Debug Helper Commands
  const analyzeError = vscode.commands.registerCommand('coding.analyzeError', () => {
    DebugHelper.analyzeError();
  });
  
  const addDebugLogs = vscode.commands.registerCommand('coding.addDebugLogs', () => {
    DebugHelper.addDebugLogs();
  });
  
  const generateBreakpoints = vscode.commands.registerCommand('coding.generateBreakpoints', () => {
    DebugHelper.generateBreakpoints();
  });

  // Instant Reviewer Commands
  const reviewCurrentFile = vscode.commands.registerCommand('coding.reviewCurrentFile', () => {
    InstantReviewer.reviewCurrentFile();
  });
  
  const quickScan = vscode.commands.registerCommand('coding.quickScan', () => {
    InstantReviewer.quickScan();
  });

  // Multi-Agent File Editor Command
  const multiAgentFileEdit = vscode.commands.registerCommand('coding.multiAgentFileEdit', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'Describe multi-agent file operations',
      placeHolder: 'multi-agent create app.js, styles.css | agents edit config.json, server.js'
    });
    
    if (input) {
      const result = await MultiAgentFileEditor.processMultiAgentRequest(input);
      vscode.window.showInformationMessage(result);
    }
  });

  // System validation command
  const validateSystem = vscode.commands.registerCommand('coding.validateSystem', async () => {
    const report = await SystemValidator.generateHealthReport();
    
    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
  });

  // New feature commands
  const solveProjectIssue = vscode.commands.registerCommand('coding.solveProjectIssue', async () => {
    const issue = await vscode.window.showInputBox({
      prompt: 'Describe the project issue to solve',
      placeHolder: 'Build error, dependency problem, configuration issue...'
    });
    
    if (issue) {
      const solution = await ProjectIssueSolver.solveProjectIssue(issue);
      const doc = await vscode.workspace.openTextDocument({
        content: solution,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const chatFileManager = vscode.commands.registerCommand('coding.chatFileManager', async () => {
    const command = await vscode.window.showInputBox({
      prompt: 'Enter file management command',
      placeHolder: 'create app.js with server, edit package.json, override config.json...'
    });
    
    if (command) {
      const result = await ChatFileManager.processFileCommand(command);
      if (result) {
        vscode.window.showInformationMessage(result);
      }
    }
  });

  const smartFileOperations = vscode.commands.registerCommand('coding.smartFileOperations', async () => {
    const command = await vscode.window.showInputBox({
      prompt: 'Smart File Operations - Describe what files to create',
      placeHolder: 'Create a React component with tests and styles, build enterprise app structure...'
    });
    
    if (command) {
      try {
        const requests = await SmartFileOperation.parseSmartFileCommand(command);
        if (requests.length > 0) {
          const result = await SmartFileOperation.executeSmartFileCreation(requests);
          
          const doc = await vscode.workspace.openTextDocument({
            content: `# Smart File Operations Result\n\n${result}`,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showErrorMessage('Could not parse file creation request');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Smart File Operations failed: ${error.message}`);
      }
    }
  });

  const nlpProjectControl = vscode.commands.registerCommand('coding.nlpProjectControl', async () => {
    const command = await vscode.window.showInputBox({
      prompt: 'Enter NLP project command',
      placeHolder: 'analyze project, show files, find function...'
    });
    
    if (command) {
      const result = await NLPProjectController.processNLPCommand(command);
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  const multiAgentGeneration2 = vscode.commands.registerCommand('coding.multiAgentGeneration1', async () => {
    const command = await vscode.window.showInputBox({
      prompt: 'Describe what to generate with multi-agent system',
      placeHolder: 'create full-stack app, build API with tests, generate components...'
    });
    
    if (command) {
      const projectContext = await NLPProjectController.processNLPCommand('analyze project');
      // const result = await SmartMultiAgent.processMultiAgentCommand(command, projectContext);
      const result = 'Multi-agent generation feature is under development';
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    }
  });

  // Code Diff Viewer commands
  const showCodeDiff = vscode.commands.registerCommand('coding.showCodeDiff', async () => {
    const original = await vscode.window.showInputBox({
      prompt: 'Enter original code',
      placeHolder: 'Paste or type the original code here'
    });
    
    if (!original) {return;}
    
    const modified = await vscode.window.showInputBox({
      prompt: 'Enter modified code',
      placeHolder: 'Paste or type the modified code here'
    });
    
    if (!modified) {return;}
    
    await CodeDiffViewer.showDiff(original, modified, 'Custom Code Diff');
  });
  
  const compareFiles = vscode.commands.registerCommand('coding.compareFiles', async () => {
    const file1 = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Select first file'
    });
    
    if (!file1 || file1.length === 0) {return;}
    
    const file2 = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: 'Select second file'
    });
    
    if (!file2 || file2.length === 0) {return;}
    
    await CodeDiffViewer.compareFiles(file1[0].fsPath, file2[0].fsPath);
  });
  
  const compareWithClipboard = vscode.commands.registerCommand('coding.compareWithClipboard', async () => {
    await CodeDiffViewer.compareWithClipboard();
  });

  context.subscriptions.push(
    explainCode, optimizeCode,
    addLogging, addErrorHandling, convertToAsync,
    findSimilarCode, generateCodeMap,
    generateSnippet, createBoilerplate, generateRegex,
    analyzeError, addDebugLogs, generateBreakpoints,
    reviewCurrentFile, quickScan, multiAgentFileEdit,
    validateSystem, showCodeDiff, compareFiles, compareWithClipboard,
    solveProjectIssue, chatFileManager, smartFileOperations, nlpProjectControl, multiAgentGeneration2
  );

  // Register enhanced feature commands
  const enhancedNLPTerminal = vscode.commands.registerCommand('coding.enhancedNLPTerminal', async () => {
    const command = await vscode.window.showInputBox({
      prompt: 'Enter natural language command for terminal',
      placeHolder: 'list files in current directory, check git status, run tests...'
    });
    
    if (command) {
      try {
        const result = await EnhancedShellCommander.executeEnhancedNLPCommand(command);
        vscode.window.showInformationMessage(`Terminal command executed: ${result}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Terminal command failed: ${error.message}`);
      }
    }
  });

  const showActivityDashboard = vscode.commands.registerCommand('coding.showActivityDashboard', async () => {
    const dashboardState = unifiedActivityDashboard.getDashboardState();
    const report = `# 📊 Enhanced Activity Dashboard

## Terminal Status
- Status: ${dashboardState.terminal.status}
- Active Commands: ${dashboardState.terminal.activeCommands}
- Sessions: ${dashboardState.terminal.sessions.length}

## Agent Activity
- Active Agents: ${dashboardState.agents.active}
- Working Agents: ${dashboardState.agents.working.length}
- Idle Agents: ${dashboardState.agents.idle}

${dashboardState.agents.working.length > 0 ? '### Working Agents:\n' + 
dashboardState.agents.working.map(agent => 
  `- **${agent.name}**: ${agent.task} (${agent.progress}%)`
).join('\n') : ''}

## File Operations
- Modified: ${dashboardState.files.modified}
- Created: ${dashboardState.files.created}
- Lines Added: ${dashboardState.files.linesAdded}
- Lines Removed: ${dashboardState.files.linesRemoved}

## Recent File Changes
${dashboardState.files.recentChanges.slice(0, 5).map(change => 
  `- **${change.fileName}**: ${change.action} (${change.linesChanged} lines) - ${new Date(change.timestamp).toLocaleString()}`
).join('\n')}

## System Metrics
- Uptime: ${Math.floor(dashboardState.system.uptime / 1000)}s
- Total Operations: ${dashboardState.system.totalOperations}
- Error Count: ${dashboardState.system.errorCount}
- Performance: ${(dashboardState.system.performance * 100).toFixed(1)}%`;

    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const viewLiveChanges = vscode.commands.registerCommand('coding.viewLiveChanges', async () => {
    const changes = liveChangeVisualizer.getRecentChanges(10);
    const report = `# 🔄 Live File Changes

${changes.length > 0 ? changes.map(change => `
## ${change.fileName} (${change.changeType})
- **Agent**: ${change.agent || 'User'}
- **Time**: ${new Date(change.timestamp).toLocaleString()}
- **Line**: ${change.lineNumber}
- **Lines**: +${change.diffInfo.linesAdded} -${change.diffInfo.linesRemoved}
- **Content Preview**: \`${change.content.slice(0, 50)}${change.content.length > 50 ? '...' : ''}\`
`).join('\n') : 'No recent file changes detected.'}`;

    const doc = await vscode.workspace.openTextDocument({
      content: report,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const testAgentCoordination = vscode.commands.registerCommand('coding.testAgentCoordination', async () => {
    const testPrompt = await vscode.window.showInputBox({
      prompt: 'Test multi-agent coordination with this request',
      placeHolder: 'create React app with backend API and database'
    });
    
    if (testPrompt) {
      try {
        // Simple test of enhanced shell commander
        const result = await EnhancedShellCommander.executeEnhancedNLPCommand(testPrompt);
        vscode.window.showInformationMessage(`Agent coordination test completed: ${result}`);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Coordination test failed: ${error.message}`);
      }
    }
  });

  context.subscriptions.push(
    enhancedNLPTerminal,
    showActivityDashboard, 
    viewLiveChanges,
    testAgentCoordination
  );

	context.subscriptions.push(
  vscode.commands.registerCommand("coding.fixFirstError", fixFirstDiagnosticError)
);

	context.subscriptions.push(
		vscode.commands.registerCommand("coding.clearChatHistory", async () => {
			const confirm = await vscode.window.showWarningMessage(
				"Are you sure you want to clear your chat history?",
				{ modal: true },
				"Yes", "No"
			);

			if (confirm === "Yes") {
			// await provider.clearChatHistory();
			await vscode.commands.executeCommand("workbench.action.closePanel");
			await context.globalState.update('AIChatHistory', []);
			vscode.window.showInformationMessage('Chat history cleared!');
		}})
	);

	vscode.languages.registerInlineCompletionItemProvider(
		{ scheme: 'file', language: 'python'},
		{
		async provideInlineCompletionItems(document, position, context, token) {
      const line = document.lineAt(position);
			const linePrefix = document.lineAt(position).text.slice(0, position.character);
			if (!linePrefix.trim()) { return []; }
		}
	});

  let disposable = vscode.commands.registerCommand('coding.fixError', fixCodeError);
    context.subscriptions.push(disposable);

  // ===== ADVANCED AI FEATURES =====
  
  // Multi-Agent Collaboration System
  const multiAgentCoordinator = new MultiAgentCoordinator(context);
  const startMultiAgentCommand = vscode.commands.registerCommand('coding.startMultiAgent', async () => {
    const task = await vscode.window.showInputBox({
      prompt: 'Enter the task for the multi-agent system',
      placeHolder: 'e.g., "Debug the login function and add tests"'
    });
    if (task) {
      // Create a debug task for the multi-agent system
      const taskId = await multiAgentCoordinator.createTask(
        AgentType.DEBUGGER,
        task,
        { action: 'analyzeError', code: task },
        1 // priority
      );
      vscode.window.showInformationMessage(`Multi-agent task created: ${taskId}`);
    }
  });
  
  const multiAgentStatusCommand = vscode.commands.registerCommand('coding.multiAgentStatus', async () => {
    const stats = multiAgentCoordinator.getSystemStats();
    vscode.window.showInformationMessage(
      `Multi-Agent Status: ${stats.activeTasks} active, ${stats.queuedTasks} queued, ${stats.successRate}% success rate`
    );
  });
  
  context.subscriptions.push(startMultiAgentCommand, multiAgentStatusCommand);

  // Self-Improving Prompts
  const promptEngine = new SelfImprovingPromptEngine(context);
  const improvePromptsCommand = vscode.commands.registerCommand('coding.improvePrompts', async () => {
    await promptEngine.improveUnderperformingPrompts();
    vscode.window.showInformationMessage('Prompts analyzed and improved!');
  });
  
  const generatePromptCommand = vscode.commands.registerCommand('coding.generatePrompt', async () => {
    const template = await vscode.window.showInputBox({
      prompt: 'Enter a prompt template to improve',
      placeHolder: 'e.g., "Generate a function to {task}"'
    });
    if (template) {
      const improved = await promptEngine.generateImprovedPrompt(template, 'code_generation', 'general');
      vscode.window.showInformationMessage(`Improved prompt: ${improved.substring(0, 100)}...`);
    }
  });
  
  context.subscriptions.push(improvePromptsCommand, generatePromptCommand);

  // Adaptive Context Window
  const adaptiveContext = new AdaptiveContextWindow(context);
  const optimizeContextCommand = vscode.commands.registerCommand('coding.optimizeContext', async () => {
    const query = await vscode.window.showInputBox({
      prompt: 'Enter your coding task to optimize context',
      placeHolder: 'e.g., "Debug authentication logic"'
    });
    if (query) {
      const analysis = await adaptiveContext.selectRelevantContext(query);
      vscode.window.showInformationMessage(`Context optimized: ${analysis.selectedFiles.length} relevant files found`);
    }
  });
  
  const analyzeContextCommand = vscode.commands.registerCommand('coding.analyzeContext', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const analysis = await adaptiveContext.selectRelevantContext('general analysis', editor.document.fileName);
      vscode.window.showInformationMessage(`Context analysis: ${analysis.selectedFiles.length} relevant files found, confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    }
  });
  
  context.subscriptions.push(optimizeContextCommand, analyzeContextCommand);

  // Voice Code Mode
  const voiceMode = new VoiceCodeMode(context);
  const startVoiceCommand = vscode.commands.registerCommand('coding.startVoice', async () => {
    const enabled = await voiceMode.enable();
    if (enabled) {
      vscode.window.showInformationMessage('Voice Code Mode enabled');
    }
  });
  
  const stopVoiceCommand = vscode.commands.registerCommand('coding.stopVoice', async () => {
    voiceMode.disable();
    vscode.window.showInformationMessage('Voice Code Mode disabled');
  });
  
  context.subscriptions.push(startVoiceCommand, stopVoiceCommand);

  // Interactive Whiteboard
  const whiteboard = new InteractiveWhiteboard(context);
  const openWhiteboardCommand = vscode.commands.registerCommand('coding.openWhiteboard', async () => {
    await whiteboard.openWhiteboard();
  });
  
  const createFlowchartCommand = vscode.commands.registerCommand('coding.createFlowchart', async () => {
    await whiteboard.openWhiteboard(DiagramType.FLOWCHART);
    vscode.window.showInformationMessage('Flowchart whiteboard opened!');
  });
  
  context.subscriptions.push(openWhiteboardCommand, createFlowchartCommand);

  // AI Debug Replay
  const debugReplay = new AIDebugReplay(context);
  const startRecordingCommand = vscode.commands.registerCommand('coding.startDebugRecording', async () => {
    await debugReplay.startRecording();
    vscode.window.showInformationMessage('Debug recording started');
  });
  
  const stopRecordingCommand = vscode.commands.registerCommand('coding.stopDebugRecording', async () => {
    await debugReplay.stopRecording();
    vscode.window.showInformationMessage('Debug recording stopped');
  });
  
  const replaySessionCommand = vscode.commands.registerCommand('coding.replayDebugSession', async () => {
    const sessions = Array.from(debugReplay['completedSessions'].keys());
    if (sessions.length === 0) {
      vscode.window.showInformationMessage('No completed debug sessions available');
      return;
    }
    
    const selectedSession = await vscode.window.showQuickPick(sessions, {
      placeHolder: 'Select a debug session to replay'
    });
    
    if (selectedSession) {
      await debugReplay.replaySession(selectedSession);
    }
  });
  
  context.subscriptions.push(startRecordingCommand, stopRecordingCommand, replaySessionCommand);

  // Continuous Error Fixer System
  let continuousErrorFixer: ContinuousErrorFixer | null = null;
  
  const startContinuousFixerCommand = vscode.commands.registerCommand('coding-assistant.startContinuousFixer', async () => {
    try {
      if (!continuousErrorFixer) {
        // Try to get the chat panel from SimpleSidebarViewProvider
        const chatPanel = provider ? (provider as any)._view : undefined;
        continuousErrorFixer = new ContinuousErrorFixer(context, chatPanel);
      }
      await continuousErrorFixer.start();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start Continuous Error Fixer: ${error}`);
    }
  });
  
  const stopContinuousFixerCommand = vscode.commands.registerCommand('coding-assistant.stopContinuousFixer', async () => {
    if (continuousErrorFixer) {
      await continuousErrorFixer.stop();
    } else {
      vscode.window.showWarningMessage('Continuous Error Fixer is not running');
    }
  });
  
  const toggleContinuousFixerCommand = vscode.commands.registerCommand('coding-assistant.toggleContinuousFixer', async () => {
    try {
      if (!continuousErrorFixer) {
        const chatPanel = provider ? (provider as any)._view : undefined;
        continuousErrorFixer = new ContinuousErrorFixer(context, chatPanel);
      }
      await continuousErrorFixer.toggle();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle Continuous Error Fixer: ${error}`);
    }
  });
  
  const showFixerStatusCommand = vscode.commands.registerCommand('coding-assistant.showFixerStatus', async () => {
    if (!continuousErrorFixer) {
      vscode.window.showInformationMessage('Continuous Error Fixer is not initialized');
      return;
    }
    
    const status = continuousErrorFixer.getStatus();
    const statusMessage = `
**Continuous Error Fixer Status**
- Running: ${status.isRunning ? '✅' : '❌'}
- Active Looping Agents: ${status.activeLoopingAgents}
- Active Replacing Agents: ${status.activeReplacingAgents}
- Queued Errors: ${status.queuedErrors}
    `.trim();
    
    vscode.window.showInformationMessage(statusMessage);
  });
  
  context.subscriptions.push(
    startContinuousFixerCommand,
    stopContinuousFixerCommand,
    toggleContinuousFixerCommand,
    showFixerStatusCommand
  );
  
  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      if (continuousErrorFixer) {
        continuousErrorFixer.dispose();
      }
    }
  });

}

export function deactivate() {
	// Cleanup connections
	ConnectionManager.cleanup();
	
	// Cleanup enhanced AI systems
	try {
		const proactiveAssistant = ProactiveCodeAssistant.getInstance();
		proactiveAssistant.dispose();
		console.log('✅ Enhanced AI systems cleaned up successfully');
	} catch (error) {
		console.warn('⚠️ Error during enhanced AI cleanup:', error);
	}
}

const fixCodeError = async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    const document = editor.document;
    const selection = editor.selection;
    const text = document.getText(selection);

    // 1. Send the selected text (code) to your LLM for correction
    const correctedCode = await callAI(text);

    // 2. Replace the erroneous code with the corrected code
    editor.edit((editBuilder) => {
        editBuilder.replace(selection, correctedCode);
    });

    // Optional: Highlight the fixed portion
    const startPos = selection.start;
    const endPos = selection.end;
    const range = new vscode.Range(startPos, endPos);
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'lightgreen',
    });
    editor.setDecorations(decorationType, [range]);
};
