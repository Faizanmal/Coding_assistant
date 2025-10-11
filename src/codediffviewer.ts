import * as vscode from 'vscode';

export class CodeDiffViewer {
    private static panel: vscode.WebviewPanel | undefined;

    static async showDiff(original: string, modified: string, title: string = 'Code Diff') {
        // Create or show the webview panel
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'codeDiffViewer',
                title,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        // Set the webview content
        this.panel.webview.html = this.getWebviewContent(original, modified, title);
    }

    static async compareFiles(file1Path: string, file2Path: string) {
        try {
            const file1Uri = vscode.Uri.file(file1Path);
            const file2Uri = vscode.Uri.file(file2Path);
            
            const file1Content = await vscode.workspace.fs.readFile(file1Uri);
            const file2Content = await vscode.workspace.fs.readFile(file2Uri);
            
            const original = Buffer.from(file1Content).toString('utf8');
            const modified = Buffer.from(file2Content).toString('utf8');
            
            await this.showDiff(original, modified, `Diff: ${file1Path} vs ${file2Path}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to compare files: ${error.message}`);
        }
    }

    static async compareWithClipboard() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        const clipboardText = await vscode.env.clipboard.readText();
        
        await this.showDiff(selectedText, clipboardText, 'Selection vs Clipboard');
    }

    private static getWebviewContent(original: string, modified: string, title: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Consolas', 'Monaco', monospace;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            overflow: hidden;
        }
        .header {
            background: var(--vscode-titleBar-activeBackground);
            color: var(--vscode-titleBar-activeForeground);
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .diff-container {
            display: flex;
            height: calc(100vh - 60px);
        }
        .diff-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
        }
        .diff-pane:last-child {
            border-right: none;
        }
        .pane-header {
            background: var(--vscode-panel-background);
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: bold;
            font-size: 12px;
        }
        .original-header {
            background: var(--vscode-diffEditor-removedTextBackground);
            color: var(--vscode-diffEditor-removedTextForeground);
        }
        .modified-header {
            background: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }
        .code-content {
            flex: 1;
            overflow: auto;
            padding: 16px;
            white-space: pre-wrap;
            font-size: 13px;
            line-height: 1.4;
        }
        .line-numbers {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 50px;
            background: var(--vscode-editorGutter-background);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 16px 8px;
            font-size: 11px;
            color: var(--vscode-editorLineNumber-foreground);
            user-select: none;
        }
        .code-with-numbers {
            position: relative;
            padding-left: 60px;
        }
        .diff-line {
            display: block;
            padding: 2px 4px;
            margin: 1px 0;
        }
        .added {
            background: var(--vscode-diffEditor-insertedTextBackground);
            color: var(--vscode-diffEditor-insertedTextForeground);
        }
        .removed {
            background: var(--vscode-diffEditor-removedTextBackground);
            color: var(--vscode-diffEditor-removedTextForeground);
        }
        .unchanged {
            background: transparent;
        }
        .controls {
            display: flex;
            gap: 8px;
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 12px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .stats {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }
        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>📊 ${title}</h3>
        <div class="controls">
            <div class="stats" id="stats"></div>
            <button class="btn" onclick="copyDiff()">📋 Copy Diff</button>
            <button class="btn" onclick="exportDiff()">💾 Export</button>
        </div>
    </div>
    
    <div class="diff-container">
        <div class="diff-pane">
            <div class="pane-header original-header">🔴 Original</div>
            <div class="code-content code-with-numbers">
                <div class="line-numbers" id="original-lines"></div>
                <div id="original-content"></div>
            </div>
        </div>
        
        <div class="diff-pane">
            <div class="pane-header modified-header">🟢 Modified</div>
            <div class="code-content code-with-numbers">
                <div class="line-numbers" id="modified-lines"></div>
                <div id="modified-content"></div>
            </div>
        </div>
    </div>

    <script>
        const original = ${JSON.stringify(original)};
        const modified = ${JSON.stringify(modified)};
        
        function generateDiff(text1, text2) {
            const lines1 = text1.split('\\n');
            const lines2 = text2.split('\\n');
            
            const diff = [];
            let i = 0, j = 0;
            
            while (i < lines1.length || j < lines2.length) {
                if (i >= lines1.length) {
                    diff.push({ type: 'added', line: lines2[j], lineNum1: '', lineNum2: j + 1 });
                    j++;
                } else if (j >= lines2.length) {
                    diff.push({ type: 'removed', line: lines1[i], lineNum1: i + 1, lineNum2: '' });
                    i++;
                } else if (lines1[i] === lines2[j]) {
                    diff.push({ type: 'unchanged', line: lines1[i], lineNum1: i + 1, lineNum2: j + 1 });
                    i++;
                    j++;
                } else {
                    // Simple diff - mark as removed and added
                    diff.push({ type: 'removed', line: lines1[i], lineNum1: i + 1, lineNum2: '' });
                    diff.push({ type: 'added', line: lines2[j], lineNum1: '', lineNum2: j + 1 });
                    i++;
                    j++;
                }
            }
            
            return diff;
        }
        
        function renderDiff() {
            const diff = generateDiff(original, modified);
            const originalContent = document.getElementById('original-content');
            const modifiedContent = document.getElementById('modified-content');
            const originalLines = document.getElementById('original-lines');
            const modifiedLines = document.getElementById('modified-lines');
            
            let originalHtml = '';
            let modifiedHtml = '';
            let originalLineNumbers = '';
            let modifiedLineNumbers = '';
            
            let added = 0, removed = 0, unchanged = 0;
            
            diff.forEach(item => {
                const escapedLine = item.line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                if (item.type === 'removed') {
                    originalHtml += \`<span class="diff-line removed">\${escapedLine}</span>\\n\`;
                    originalLineNumbers += \`\${item.lineNum1}\\n\`;
                    removed++;
                } else if (item.type === 'added') {
                    modifiedHtml += \`<span class="diff-line added">\${escapedLine}</span>\\n\`;
                    modifiedLineNumbers += \`\${item.lineNum2}\\n\`;
                    added++;
                } else {
                    originalHtml += \`<span class="diff-line unchanged">\${escapedLine}</span>\\n\`;
                    modifiedHtml += \`<span class="diff-line unchanged">\${escapedLine}</span>\\n\`;
                    originalLineNumbers += \`\${item.lineNum1}\\n\`;
                    modifiedLineNumbers += \`\${item.lineNum2}\\n\`;
                    unchanged++;
                }
            });
            
            originalContent.innerHTML = originalHtml;
            modifiedContent.innerHTML = modifiedHtml;
            originalLines.innerHTML = originalLineNumbers;
            modifiedLines.innerHTML = modifiedLineNumbers;
            
            // Update stats
            document.getElementById('stats').textContent = 
                \`+\${added} -\${removed} ~\${unchanged} lines\`;
        }
        
        function copyDiff() {
            const diff = generateDiff(original, modified);
            let diffText = '--- Original\\n+++ Modified\\n';
            
            diff.forEach(item => {
                if (item.type === 'removed') {
                    diffText += \`-\${item.line}\\n\`;
                } else if (item.type === 'added') {
                    diffText += \`+\${item.line}\\n\`;
                } else {
                    diffText += \` \${item.line}\\n\`;
                }
            });
            
            navigator.clipboard.writeText(diffText).then(() => {
                alert('Diff copied to clipboard!');
            });
        }
        
        function exportDiff() {
            const diff = generateDiff(original, modified);
            let diffText = '# Code Diff\\n\\n';
            diffText += \`Generated on: \${new Date().toISOString()}\\n\\n\`;
            diffText += '## Original\\n\`\`\`\\n' + original + '\\n\`\`\`\\n\\n';
            diffText += '## Modified\\n\`\`\`\\n' + modified + '\\n\`\`\`\\n';
            
            const blob = new Blob([diffText], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'code-diff.md';
            a.click();
            URL.revokeObjectURL(url);
        }
        
        // Initialize diff view
        renderDiff();
        
        // Sync scrolling between panes
        const originalPane = document.querySelector('.diff-pane:first-child .code-content');
        const modifiedPane = document.querySelector('.diff-pane:last-child .code-content');
        
        originalPane.addEventListener('scroll', () => {
            modifiedPane.scrollTop = originalPane.scrollTop;
        });
        
        modifiedPane.addEventListener('scroll', () => {
            originalPane.scrollTop = modifiedPane.scrollTop;
        });
    </script>
</body>
</html>`;
    }
}