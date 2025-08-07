import * as vscode from 'vscode';
import { callAI } from './codegenerator';

export function ineditorcodegenerationCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.generateCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {return;}

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    const prompt = selectedText || await vscode.window.showInputBox({
      prompt: "Enter a prompt for code generation"
    });

    if (!prompt) {return;}

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Generating code...",
      cancellable: false
    }, async () => {
      try {
        const response = await callAI(prompt);
        const code = response || '';

        const languageId = editor.document.languageId;
        const { startComment, endComment } = getCommentDelimiters(languageId);

        const wrappedCode = response
          ? `${startComment} START CODE ${endComment}\n${code}\n${startComment} END CODE ${endComment}`
          : `${startComment} Failed to generate code. ${endComment}`;

        editor.edit(editBuilder => {
          if (selection.isEmpty) {
            editBuilder.insert(selection.start, wrappedCode);
          } else {
            editBuilder.replace(selection, wrappedCode);
          }
        });
      } catch (err) {
        vscode.window.showErrorMessage("Code generation failed: " + err);
      }
    });
  });

  context.subscriptions.push(disposable);
}

function getCommentDelimiters(languageId: string): { startComment: string; endComment: string } {
  const commentMap: Record<string, { startComment: string; endComment: string }> = {
    javascript: { startComment: '//', endComment: '' },
    typescript: { startComment: '//', endComment: '' },
    python: { startComment: '#', endComment: '' },
    ruby: { startComment: '#', endComment: '' },
    csharp: { startComment: '//', endComment: '' },
    java: { startComment: '//', endComment: '' },
    cpp: { startComment: '//', endComment: '' },
    c: { startComment: '//', endComment: '' },
    html: { startComment: '<!--', endComment: '-->' },
    css: { startComment: '/*', endComment: '*/' },
    xml: { startComment: '<!--', endComment: '-->' },
    php: { startComment: '//', endComment: '' },
    shellscript: { startComment: '#', endComment: '' },
    go: { startComment: '//', endComment: '' },
    rust: { startComment: '//', endComment: '' },
    json: { startComment: '//', endComment: '' },
  };

  const fallback = { startComment: '//', endComment: '' };
  return commentMap[languageId] || fallback;
}