import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

async function generateFixWithLLM(code: string, diagnostics: vscode.Diagnostic[]) {
  const errorMsg = diagnostics.map(d => `- ${d.message}`).join('\n');
  const prompt = `The following code has errors:\n\n${code}\n\nErrors:\n${errorMsg}\n\nFix the code and return only the corrected version.`;

  const fixedCode = await getLLMCompletion(prompt);
  return fixedCode;
}

async function applyFix(document: vscode.TextDocument, range: vscode.Range, diagnostics: vscode.Diagnostic[]) {
  const code = document.getText(range);
  const fixed = await generateFixWithLLM(code, diagnostics);
  if (!fixed) {
    vscode.window.showErrorMessage("LLM did not return a fix.");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.toString() === document.uri.toString()) {
    editor.edit(editBuilder => {
      editBuilder.replace(range, fixed);
    });
    vscode.window.showInformationMessage("Code fixed by LLM.");
  }
}

export function registerFixSelectedErrorCommands(context: vscode.ExtensionContext) {
  // This is still useful if you want manual fix by command
  const disposable = vscode.commands.registerCommand('coding.fixSelectedErrors', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const selection = editor.selection;
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
      .filter(d => d.range.intersection(selection));

    if (diagnostics.length === 0) {
      vscode.window.showInformationMessage("No diagnostics in selected range.");
      return;
    }

    await applyFix(editor.document, selection, diagnostics);
  });

  context.subscriptions.push(disposable);

  // ✅ Register inline hover code action provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('*', new LLMDiagnosticFixProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    })
  );
}

// ✅ LLM CodeActionProvider implementation
class LLMDiagnosticFixProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      // Provide quick fix only for error-level diagnostics
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error && diagnostic.range.intersection(range)) {
        const fixAction = new vscode.CodeAction('💡 Fix with LLM', vscode.CodeActionKind.QuickFix);
        fixAction.command = {
          title: 'Fix with LLM',
          command: 'coding.applyLLMFix',
          arguments: [document, diagnostic.range, [diagnostic]]
        };
        fixAction.diagnostics = [diagnostic];
        fixAction.isPreferred = true;
        actions.push(fixAction);
      }
    }

    return actions;
  }
}

// ✅ Register the inline command to run the fix
export function registerLLMFixCommand(context: vscode.ExtensionContext) {
  const fixCommand = vscode.commands.registerCommand('coding.applyLLMFix', async (document: vscode.TextDocument, range: vscode.Range, diagnostics: vscode.Diagnostic[]) => {
    await applyFix(document, range, diagnostics);
  });

  context.subscriptions.push(fixCommand);
}
