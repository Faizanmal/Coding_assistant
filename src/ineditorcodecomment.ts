import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

/**
 * Command: coding.generateCodeComments
 * Adds or improves code comments for the selected code using LLM.
 */
export function registerCodeCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.generateCodeComments', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }
    const selection = editor.selection;
    const code = editor.document.getText(selection.isEmpty ? undefined : selection);
    if (!code.trim()) {
      vscode.window.showErrorMessage('No code selected or found.');
      return;
    }
    vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Generating code comments...' }, async () => {
      try {
        const prompt = `Add or improve comments for the following code. Use JSDoc style for JS/TS, and appropriate style for other languages.\n\n${code}`;
  const commentedCode = await getLLMCompletion(prompt);
        if (commentedCode && commentedCode.trim()) {
          editor.edit(editBuilder => {
            editBuilder.replace(selection.isEmpty ? new vscode.Range(0,0,editor.document.lineCount,0) : selection, commentedCode);
          });
          vscode.window.showInformationMessage('Code comments generated!');
        } else {
          vscode.window.showWarningMessage('No comments generated.');
        }
      } catch (err) {
        vscode.window.showErrorMessage('Failed to generate comments: ' + err);
      }
    });
  });
  context.subscriptions.push(disposable);
}
