import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { getLLMCompletion } from './extension';

function getDiagnosticsInSelection(): vscode.Diagnostic[] {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return [];}

  const selection = editor.selection;
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

  const relevantDiagnostics = diagnostics.filter(d => d.range.intersection(selection));
  return relevantDiagnostics;
}

function getSelectedText(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return null;}

  const selection = editor.selection;
  return editor.document.getText(selection);
}

async function generateFixWithLLM(code: string, diagnostics: vscode.Diagnostic[]) {
  const errorMsg = diagnostics.map(d => `- ${d.message}`).join('\n');
  const prompt = `The following code has errors:\n\n${code}\n\nErrors:\n${errorMsg}\n\nFix the code and return only the corrected version.`;

  const fixedCode = await getLLMCompletion(prompt);
  return fixedCode;
}

async function replaceSelectedCode(fixedCode: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}

  const selection = editor.selection;

  await editor.edit(editBuilder => {
    editBuilder.replace(selection, fixedCode);
  });
}

export function registerFixSelectedErrorCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.fixSelectedError', async () => {
    const diagnostics = getDiagnosticsInSelection();
    const code = getSelectedText();

    if (!code || diagnostics.length === 0) {
      vscode.window.showInformationMessage("Please select code with redline (error).");
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fixing code...",
        cancellable: false
      },
      async () => {
        try {
          const fixed = await generateFixWithLLM(code, diagnostics);
          if (fixed) {
            await replaceSelectedCode(fixed);
            vscode.window.showInformationMessage("Code fixed successfully!");
          } else {
            vscode.window.showErrorMessage("LLM did not return a fix.");
          }
        } catch (err) {
          vscode.window.showErrorMessage("Failed to fix code: " + err);
        }
      }
    );
  });

  context.subscriptions.push(disposable);
}
    