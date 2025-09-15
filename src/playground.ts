import * as vscode from 'vscode';
import { callAI } from './codegenerator';

/**
 * Opens the selected code in a new, isolated "playground" environment.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('coding.openPlayground', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor.');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showErrorMessage('No code selected.');
            return;
        }

        const playgroundDocument = await vscode.workspace.openTextDocument({
            content: selectedText,
            language: editor.document.languageId,
        });

        await vscode.window.showTextDocument(playgroundDocument, vscode.ViewColumn.Beside);

        vscode.window.showInformationMessage('Opened code in playground. You can now experiment with it.');

        // Add a command to get AI suggestions for the code in the playground
        const suggestionsDisposable = vscode.commands.registerCommand('coding.getPlaygroundSuggestions', async () => {
            const playgroundEditor = vscode.window.activeTextEditor;
            if (playgroundEditor && playgroundEditor.document === playgroundDocument) {
                const playgroundText = playgroundEditor.document.getText();
                const prompt = 'You are an expert code reviewer. Please review the following code and provide suggestions for improvement.\n' +
                    'Focus on identifying potential bugs, security risks, and areas where the code can be made more readable and maintainable.\n' +
                    'Provide your feedback in a clear and concise manner.\n\n' +
                    '```\n' +
                    playgroundText +
                    '\n```';
                const suggestions = await callAI(prompt);
                vscode.window.showInformationMessage(suggestions);
            }
        });

        context.subscriptions.push(suggestionsDisposable);
    });

    context.subscriptions.push(disposable);
}
