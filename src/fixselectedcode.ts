import * as vscode from 'vscode';
import { getLLMFixForCode } from './extension';
import { getFixFromLLM } from './codegenerator';
import { createHighlighter, Highlighter } from 'shiki';
import { marked } from 'marked';



export async function getCodeHighlighter(): Promise<Highlighter> {
  let highlighter: Highlighter | null = null;
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['ts', 'js', 'python', 'cpp', 'json', 'markdown'] // add more as needed
    });
  }
  return highlighter;
}

export function getHtmlForExplanation(content: any, isDark: boolean): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: sans-serif;
      padding: 1rem;
      background: ${isDark ? '#1e1e1e' : '#ffffff'};
      color: ${isDark ? '#ddd' : '#333'};
    }
    pre {
      background: ${isDark ? '#2d2d2d' : '#f4f4f4'};
      padding: 1rem;
      overflow-x: auto;
      border-radius: 6px;
    }
    code {
      font-family: monospace;
    }
    h1, h2, h3 {
      color: ${isDark ? '#66ccff' : '#007acc'};
    }
    a {
      color: ${isDark ? '#9cdcfe' : '#0066cc'};
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}



export async function getLLMExplanationForCode(code: string, theme: 'github-dark' | 'github-light'): Promise<string | null> {
  const prompt = `Explain the following code in detail:\n\n${code}`;
  const markdown = await getFixFromLLM(prompt);
  if (!markdown) {return null;}

  const highlighter = await getCodeHighlighter();

  // Hook to highlight code blocks
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

  return marked.parse(markdown);
}



export function fixselectedcodeCommand(context: vscode.ExtensionContext) {

    const fixCodeCommand = vscode.commands.registerCommand('coding.fixselectedcode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
      vscode.window.showInformationMessage('Please select some code to fix.');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Fixing selected code with LLM...",
      cancellable: false
    }, async () => {
      try {
        const fixedCode = await getLLMFixForCode(selectedText);

        if (!fixedCode) {
          vscode.window.showWarningMessage('LLM did not return any code.');
          return;
        }

        editor.edit(editBuilder => {
          editBuilder.replace(selection, fixedCode);
        });

        vscode.window.showInformationMessage('Code fixed successfully!');
      } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage('Failed to fix code.');
      }
    });
  });

  context.subscriptions.push(fixCodeCommand);
}

export function explainselectedcodeCommand(context: vscode.ExtensionContext) {
  const explainCodeCommand = vscode.commands.registerCommand('coding.explainselectedcode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
      vscode.window.showInformationMessage('Please select some code to explain.');
      return;
    }

    const themeKind = vscode.window.activeColorTheme.kind;
    const theme = themeKind === vscode.ColorThemeKind.Dark ? 'github-dark' : 'github-light';


    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Explaining selected code with LLM...",
      cancellable: false
    }, async () => {
      try {
        const explanation = await getLLMExplanationForCode(selectedText,theme);

        if (!explanation) {
          vscode.window.showWarningMessage('LLM did not return an explanation.');
          return;
        }

        const panel = vscode.window.createWebviewPanel(
              'codeExplanation',
              'Code Explanation',
              vscode.ViewColumn.Beside,
              { enableScripts: true }
            );
            const isDark = theme === 'github-dark';
            panel.webview.html = getHtmlForExplanation(explanation, isDark);


        vscode.window.showInformationMessage('Code explained successfully!');
      } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage('Failed to explain code.');
      }
    });
  });

  context.subscriptions.push(explainCodeCommand);
}
