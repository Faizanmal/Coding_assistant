import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class SmartDocGenerator {
    
    public static async generateDocumentation() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        
        if (!selectedText) {
            vscode.window.showErrorMessage('Please select code to document');
            return;
        }

        const docStyle = await vscode.window.showQuickPick([
            'JSDoc',
            'Sphinx (Python)',
            'XML Documentation',
            'Markdown',
            'Inline Comments'
        ], { placeHolder: 'Choose documentation style' });

        if (!docStyle) return;

        const prompt = `Generate comprehensive ${docStyle} documentation for this ${editor.document.languageId} code. 
        Include parameter descriptions, return values, examples, and any important notes:

        ${selectedText}`;

        try {
            const documentation = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const position = selection.start;
            await editor.edit(editBuilder => {
                editBuilder.insert(position, documentation + '\n');
            });

            vscode.window.showInformationMessage('Documentation generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage('Documentation generation failed: ' + error);
        }
    }

    public static async generateReadme() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cpp,c}', '**/node_modules/**', 20);
        let codebase = '';

        for (const file of files.slice(0, 5)) {
            const content = await vscode.workspace.fs.readFile(file);
            codebase += `\n// ${file.path}\n${content.toString().substring(0, 1000)}...\n`;
        }

        const prompt = `Analyze this codebase and generate a comprehensive README.md file. 
        Include: project description, features, installation, usage examples, API documentation, and contributing guidelines.

        Codebase sample:
        ${codebase}`;

        try {
            const readme = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const readmePath = vscode.Uri.joinPath(workspaceFolder.uri, 'README.md');
            await vscode.workspace.fs.writeFile(readmePath, Buffer.from(readme));
            
            const doc = await vscode.workspace.openTextDocument(readmePath);
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage('README.md generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage('README generation failed: ' + error);
        }
    }

    public static async generateApiDocs() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const code = editor.document.getText();
        const prompt = `Analyze this ${editor.document.languageId} code and generate API documentation in markdown format. 
        Include all public methods, classes, interfaces, and their usage examples:

        ${code}`;

        try {
            const apiDocs = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const panel = vscode.window.createWebviewPanel(
                'apiDocs',
                'API Documentation',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
                    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
                </style>
            </head>
            <body>
                <div id="content">${apiDocs}</div>
            </body>
            </html>`;
        } catch (error) {
            vscode.window.showErrorMessage('API documentation generation failed: ' + error);
        }
    }
}