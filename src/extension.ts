import * as path from 'path';
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
import { SmartSearch } from './smartsearch';
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
import { InstantReviewer } from './instantreviewer';


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
						context += `\n--- ${fileName} ---\n[Directory or non-regular file]`
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


const terminal = vscode.window.createTerminal("Terminal");
terminal.sendText("cd C:\\Users\\atoz\\OneDrive\\Documents\\extensions\\coding\\backend-server");
terminal.show();
terminal.sendText('node server.js');

export async function getLLMCompletion(prompt: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:5000/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),

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
	await initHighlighter();
	
 	const globalProjectContext = await getprojectcontext();
	const provider = new SimpleSidebarViewProvider();
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SimpleSidebarViewProvider.viewType, provider));

	// Initialize advanced features
	const realtimeAnalyzer = new RealtimeAnalyzer();
	realtimeAnalyzer.activate(context);

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

  registerFixSelectedErrorCommand(context); // For Broken code Replacer

  ineditorcodegenerationCommand(context); // In Editor Code Generator

  fixDiagnosticCommand(context);  // Work in Redline error

  infilechatCommand(context); // Infile chat

  fixselectedcodeCommand(context); // Fix selected Code in editor

  inlinesuggestionCommand(context); // inline suggestion provider

  explainselectedcodeCommand(context); // Explain selected Code

  registerFixSelectedErrorCommands(context);
  registerLLMFixCommand(context);

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
  
  const generateTestsCmd = vscode.commands.registerCommand('coding.generateTestsCmd', () => {
    CodeAssistant.generateTests();
  });
  
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

  context.subscriptions.push(
    explainCode, generateTestsCmd, optimizeCode,
    addLogging, addErrorHandling, convertToAsync,
    findSimilarCode, generateCodeMap,
    generateSnippet, createBoilerplate, generateRegex,
    analyzeError, addDebugLogs, generateBreakpoints,
    reviewCurrentFile, quickScan
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

};

export function deactivate() {}

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
