import * as vscode from 'vscode';

export class SimpleSidebarViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'coding.sidebarView';

    public resolveWebviewView(
        view: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext<unknown>,
        _token: vscode.CancellationToken
    ) {
        view.webview.options = { enableScripts: true };

        view.webview.html = this._getHtmlForWebview();

        view.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'sendMessage':
                    vscode.window.showInformationMessage(message.text);
                    return;
            }
        });
    }

    private _getHtmlForWebview(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Simple Sidebar</title>
            </head>
            <body>
                <textarea id="prompt" placeholder="Ask something..."></textarea>
                <button id="send-button">Send</button>

                <script>
                    const vscode = acquireVsCodeApi();

                    document.getElementById('send-button').addEventListener('click', () => {
                        const textArea = document.getElementById('prompt');
                        const text = textArea.value;
                        vscode.postMessage({ command: 'sendMessage', text });
                    });
                </script>
            </body>
            </html>
        `;
    }
}
