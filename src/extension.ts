import * as path from 'path';
import { createHighlighter, Highlighter } from 'shiki';
import * as vscode from 'vscode';
import fetch from 'node-fetch';
import * as fs from 'fs';
import { ChatPanel } from './chatpanel';
import { ChatSidebarViewProvider } from './sidebar';
import { getFixFromLLM, callAI } from './codegenerator';
import { registerFixSelectedErrorCommand } from './fixselectederror';
import { ineditorcodegenerationCommand } from './ineditorcodegenerate';
import { fixDiagnosticCommand } from './fixdiagnostic';
import { infilechatCommand } from './infilechat'; 
import { fixselectedcodeCommand, explainselectedcodeCommand } from './fixselectedcode';
import { inlinesuggestionCommand } from './inlinesuggestion';
import { registerLLMFixCommand, registerFixSelectedErrorCommands } from './hoverfixdiagnostic';
import { codereviewcommand, suggestreviewcodecommand } from './codereview';

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

\`\`\`
${code}
\`\`\`
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
  const errorCode = document.getText(range);
  const errorMessage = errorDiagnostic.message;

  const prompt = `
You're a code assistant.

A developer is fixing a small error in this python code:

--- Error Message ---
${errorMessage}

--- Code to Fix ---
\`\`\`
${errorCode}
\`\`\`

Fix only this code and return only the corrected version, without wrapping it in any extra functions, classes, or explanations. Do not return anything else, just the fixed code block.
`;

  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Fixing error with LLM..." },
    async () => {
      try {
      		const fixedCode = sanitizeLLMOutput(await getLLMFixForCode(prompt));

        if (!fixedCode) {
          vscode.window.showWarningMessage('LLM did not return a valid fix.');
          return;
        }

		await showDiffAndApply(errorCode, fixedCode, range);
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
	const provider = new ChatSidebarViewProvider(context,highlighter, globalProjectContext);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ChatSidebarViewProvider.viewType, provider));

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

	context.subscriptions.push(
  vscode.commands.registerCommand("coding.fixFirstError", fixFirstDiagnosticError)
);

// 	vscode.languages.registerCodeActionsProvider(
//   { scheme: 'file', language: 'python' },
//   new LLMCodeFixProvider(),
//   { providedCodeActionKinds: LLMCodeFixProvider.providedCodeActionKinds }
// );

  // context.subscriptions.push(
  //   vscode.languages.registerHoverProvider({ scheme: 'file', language: '*' }, {
  //     provideHover(document, position, token) {
  //       const diagnostics = vscode.languages.getDiagnostics(document.uri);
  //       const related = diagnostics.filter(d => d.range.contains(position));
  //       if (!related.length) {return;}

  //       const markdown = new vscode.MarkdownString(`[🛠 Fix this with LLM](command:coding.fixError)`);
  //       markdown.isTrusted = true; // Allows the command link to be clickable

  //       return new vscode.Hover(markdown);
  //     }
  //   })
  // );

    // context.subscriptions.push(
    //     vscode.commands.registerCommand('coding.askAI', async () => {
    //         await vscode.window.showInformationMessage('Ask command executed!');
    //     }));

	context.subscriptions.push(
		vscode.commands.registerCommand("coding.clearChatHistory", async () => {
			const confirm = await vscode.window.showWarningMessage(
				"Are you sure you want to clear your chat history?",
				{ modal: true },
				"Yes", "No"
			);

			if (confirm === "Yes") {
			await provider.clearChatHistory();
			await vscode.commands.executeCommand("workbench.action.closePanel");
			await context.globalState.update('AIChatHistory', []);
			vscode.window.showInformationMessage('Chat history cleared!');
		}})
	);

	vscode.languages.registerInlineCompletionItemProvider(
		{ scheme: 'file', language: 'python'}, {	
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
