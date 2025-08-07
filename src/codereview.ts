import * as vscode from 'vscode';
import { callAI, getFixFromLLM } from './codegenerator';
import marked from 'marked';
import { createHighlighter, Highlighter } from 'shiki';
import { getHtmlForExplanation } from './fixselectedcode';

export async function getCodeHighlighter(): Promise<Highlighter> {
  return await createHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: ['ts', 'js', 'python', 'cpp', 'json', 'markdown']
  });
}

export function codereviewcommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.reviewCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return vscode.window.showErrorMessage('No active editor.');
    }

    const selection = editor.selection;
    const code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    const prompt = buildReviewPrompt(code);
    const response = await getFixFromLLM(prompt);

    const themeKind = vscode.window.activeColorTheme.kind;
    const theme = themeKind === vscode.ColorThemeKind.Dark ? 'github-dark' : 'github-light';
    const isDark = theme === 'github-dark';

    const highlighter = await getCodeHighlighter();

    marked.setOptions({
      highlight: (code: string, lang: string) => {
        try {
          return highlighter.codeToHtml(code, {
            lang: lang || 'ts',
            theme: theme
          });
        } catch {
          return code;
        }
      }
    } as any);

    const htmlContent = marked.parse(response);

    const panel = vscode.window.createWebviewPanel(
      'codeExplanation',
      'Code Explanation',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = getHtmlForExplanation(htmlContent, isDark);

    vscode.window.showInformationMessage('Code reviewed successfully!');
  });

  context.subscriptions.push(disposable);
}

function buildReviewPrompt(code: string): string {
  return `
You're an expert reviewer. Here's the code to review:

${code}

Review for:
- Bugs or logic flaws
- Performance concerns
- Code style issues
- Best practices

Respond with concise bullet points in Markdown.
`;
}

function buildSuggestionPrompt(code: string): string {
  return `
You are a code refactoring assistant.

Given the following code, suggest an improved version with:
- Bug fixes
- Performance or readability improvements
- Best practices

ONLY return the full updated code in a Markdown code block, no explanation.

Code:
\`\`\`ts
${code}
\`\`\`
`;
}

function extractSuggestedCodeBlock(response: string): string {
  const match = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1] : response;
}

export function suggestreviewcodecommand(context: vscode.ExtensionContext) {

 const disposable = vscode.commands.registerCommand('coding.suggestCodeImprovements', async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {return;}

  const code = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
  const prompt = buildSuggestionPrompt(code);
  const response = await callAI(prompt);

    const themeKind = vscode.window.activeColorTheme.kind;
    const theme = themeKind === vscode.ColorThemeKind.Dark ? 'github-dark' : 'github-light';
    const isDark = theme === 'github-dark';


  const improvedCode = extractSuggestedCodeBlock(response);

    const panel = vscode.window.createWebviewPanel(
      'codesuggestion',
      'Code Suggestion',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = getHtmlForExplanation(improvedCode, isDark);

    vscode.window.showInformationMessage('Code Suggest Successfully');


  const doc = await vscode.workspace.openTextDocument({
    content: improvedCode,
    language: editor.document.languageId,
  });

  vscode.window.showTextDocument(doc, { preview: false });
});
    context.subscriptions.push(disposable);
}