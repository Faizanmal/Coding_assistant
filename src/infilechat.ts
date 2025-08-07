import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
dotenv.config();

const api = process.env.API_KEY;

export function showLLMWebview(
  context: vscode.ExtensionContext,
  explanation: string,
  originalCode: string,
  suggestedCode: string,
  language: string,
  applyCallback: () => void
) {
  const panel = vscode.window.createWebviewPanel(
    'llmExplainPanel',
    '💡 LLM Code Assistant',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  const escapeHtml = (text: string) =>
    text.replace(/[&<>'"]/g, tag =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );

  panel.webview.html = `
    <html>
    <body style="font-family: sans-serif; padding: 1rem;">
      <h2>🔍 Code Explanation</h2>
      <pre style="white-space: pre-wrap; background: #f9f9f9; padding: 1rem; border-radius: 5px;">${escapeHtml(explanation)}</pre>

      <h3>💡 Suggested Code</h3>
      <pre style="background: #1e1e1e; color: white; padding: 1rem; border-radius: 5px;"><code>${escapeHtml(suggestedCode)}</code></pre>

      <button onclick="apply()" style="margin-top: 1rem; padding: 0.5rem 1rem; font-size: 1rem;">✅ Apply Suggestion</button>

      <script>
        const vscode = acquireVsCodeApi();
        function apply() {
          vscode.postMessage({ command: 'apply' });
        }
      </script>
    </body>
    </html>
  `;

  panel.webview.onDidReceiveMessage(message => {
    if (message.command === 'apply') {
      applyCallback();
      vscode.window.showInformationMessage("✅ LLM suggestion applied to code.");
      panel.dispose();
    }
  });
}

export function infilechatCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('coding.inFileChat', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("🛑 No active editor.");
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage("⚠️ Please select some code.");
      return;
    }

    

    const fullcontext = {
      fileName: editor.document.fileName,
      language: editor.document.languageId,
      fileText: editor.document.getText(),
      selectedText,
      position: selection.active
    };

    vscode.window.setStatusBarMessage("💬 Asking LLM...", 3000);

    let explanation = '';
    let suggested_code = '';

    try {
      const response = await sendToLLM(fullcontext);
      explanation = response.explanation;
      suggested_code = response.suggested_code;
    } catch (error) {
      vscode.window.showErrorMessage("❌ LLM request failed.");
      return;
    }

    const isDifferent = suggested_code.trim() !== selectedText.trim();
    if (!isDifferent) {
      vscode.window.showInformationMessage("ℹ️ LLM didn’t suggest any changes.");
    }

    showLLMWebview(
      context,
      explanation,
      selectedText,
      suggested_code,
      fullcontext.language,
      async () => {
        const selectionRange = new vscode.Range(selection.start, selection.end);
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor) {return;}
             await activeEditor.edit(editBuilder => {
            editBuilder.replace(selectionRange, suggested_code);
        });
         vscode.window.showInformationMessage("✅ Suggestion applied to code.");
      }
    );
  });

  context.subscriptions.push(disposable);
}

export async function sendToLLM(
  fullcontext: {
    fileName: string;
    language: string;
    fileText: string;
    selectedText: string;
    position: vscode.Position;
  }
): Promise<{ explanation: string; suggested_code: string }> {
  const prompt = `
You are a helpful code assistant. The user selected the following code and wants an explanation and improvement.

Selected Code:
\`\`\`${fullcontext.language}
${fullcontext.selectedText}
\`\`\`

Reply in this JSON format:
{
  "explanation": "Explain what this code does.",
  "suggested_code": "Only show modified code, if any."
}
  `.trim();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${api}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: "You are a helpful coding assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API Error: ${err}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const raw = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw);
  } catch {
    return {
      explanation: raw,
      suggested_code: fullcontext.selectedText
    };
  }
}
