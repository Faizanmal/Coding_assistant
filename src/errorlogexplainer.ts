import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

/**
 * Explain Error Logs feature
 * Analyzes error logs, stack traces, and debugging information using LLM
 */
export function registerExplainErrorLogsCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.explainErrorLogs', async () => {
    const editor = vscode.window.activeTextEditor;
    let errorText = '';

    if (editor) {
      const selection = editor.selection;
      if (!selection.isEmpty) {
        errorText = editor.document.getText(selection);
      }
    }

    if (!errorText) {
      errorText = await vscode.window.showInputBox({
        prompt: 'Paste error log or stack trace to analyze',
        placeHolder: 'Error: Cannot find module \'xyz\'...'
      }) || '';
    }

    if (!errorText.trim()) {
      vscode.window.showErrorMessage('No error text provided.');
      return;
    }

    vscode.window.withProgress({ 
      location: vscode.ProgressLocation.Notification, 
      title: 'Analyzing error logs...' 
    }, async () => {
      try {
        const prompt = `Analyze this error log and provide:
1. Root cause explanation
2. Possible solutions
3. Prevention strategies
4. Common fixes for this type of error

Error log:
${errorText}`;

        const explanation = await getLLMCompletion(prompt);
        
        if (explanation) {
          const doc = await vscode.workspace.openTextDocument({
            content: `# Error Log Analysis\n\n## Original Error\n\`\`\`\n${errorText}\n\`\`\`\n\n## Analysis\n${explanation}`,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showWarningMessage('Could not analyze error log.');
        }
      } catch (err) {
        vscode.window.showErrorMessage('Error analysis failed: ' + err);
      }
    });
  });

  context.subscriptions.push(disposable);
}

/**
 * Auto-detect errors in terminal output and offer explanation
 */
export function registerAutoErrorDetection(context: vscode.ExtensionContext) {
  const terminal = vscode.window.activeTerminal;
  
  if (terminal) {
    // Monitor terminal output for error patterns
    const errorPatterns = [
      /Error:/i,
      /Exception:/i,
      /Failed:/i,
      /SyntaxError:/i,
      /TypeError:/i,
      /ReferenceError:/i,
      /ModuleNotFoundError:/i,
      /ImportError:/i
    ];

    // This would require terminal API access which is limited
    // For now, provide manual command
  }
}