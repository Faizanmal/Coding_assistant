import * as vscode from 'vscode';
import { getFixFromLLM } from './codegenerator';

/**
 * Integrates with popular linting, style checking, and security tools.
 * This function will serve as the main entry point for our static analysis.
 * @param document The document to analyze.
 * @returns A promise that resolves with an array of diagnostics.
 */
async function runStaticAnalysis(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Example: Check for "any" type
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('any')) {
            const range = new vscode.Range(i, line.indexOf('any'), i, line.indexOf('any') + 3);
            const diagnostic = new vscode.Diagnostic(range, 'Avoid using the "any" type.', vscode.DiagnosticSeverity.Warning);
            diagnostics.push(diagnostic);
        }
    }

    // Example: Check for long lines
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 120) {
            const range = new vscode.Range(i, 0, i, lines[i].length);
            const diagnostic = new vscode.Diagnostic(range, 'Line is too long.', vscode.DiagnosticSeverity.Warning);
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

/**
 * Provides AI-powered actionable suggestions and fixes on pull requests or code commits.
 * This function will take the code and provide AI-powered suggestions.
 * @param code The code to analyze.
 * @returns A promise that resolves with an array of AI-powered suggestions.
 */
async function getAISuggestions(code: string): Promise<string> {
    const prompt = `
        You are an expert code reviewer. Please review the following code and provide suggestions for improvement.
        Focus on identifying potential bugs, security risks, and areas where the code can be made more readable and maintainable.
        Provide your feedback in a clear and concise manner.

        
        ${code}
        
    `;

    try {
        const suggestions = await getFixFromLLM(prompt);
        return suggestions;
    } catch (error) {
        console.error('Error getting AI suggestions:', error);
        return 'Error getting AI suggestions.';
    }
}

/**
 * Highlights potential bugs or security risks inline with explanations.
 * This function will be responsible for creating the inline decorations.
 * @param editor The active text editor.
 * @param diagnostics The diagnostics to highlight.
 */
function highlightIssues(editor: vscode.TextEditor, diagnostics: vscode.Diagnostic[]) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)',
        isWholeLine: true,
    });

    editor.setDecorations(decorationType, diagnostics.map(d => d.range));
}

/**
 * Activates the auto code review assistant.
 * This is the main entry point for the extension.
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('extension.autoCodeReview', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const code = document.getText();

        const diagnostics = await runStaticAnalysis(document);
        highlightIssues(editor, diagnostics);

        const suggestions = await getAISuggestions(code);
        vscode.window.showInformationMessage(suggestions);
    });

    context.subscriptions.push(disposable);
}
