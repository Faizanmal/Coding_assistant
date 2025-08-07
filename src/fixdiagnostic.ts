import * as vscode from 'vscode';
import { getLLMFixForCode } from './extension';

export function fixDiagnosticCommand(context: vscode.ExtensionContext) {

 const disposable = vscode.commands.registerCommand("coding.fixDiagnostic", async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}

  const range = diagnostic.range;
  const brokenCode = document.getText(range);
  const errorMessage = diagnostic.message;

  const prompt = `
This code has an error: "${errorMessage}"
Please fix it and return only the corrected version.

\`\`\`ts
${brokenCode}
\`\`\`
`;

  const fixedCode = await getLLMFixForCode(prompt);
  if (fixedCode) {
    editor.edit(editBuilder => {
      editBuilder.replace(range, fixedCode);
    });
    vscode.window.showInformationMessage('Fixed error using LLM!');
  } else {
    vscode.window.showWarningMessage('LLM did not return a fix.');
  }
});
    context.subscriptions.push(disposable);
}