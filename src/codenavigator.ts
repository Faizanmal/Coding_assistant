import * as vscode from 'vscode';
import { callLLM } from './cli-api';

export class CodeNavigator {
    
    public static async findSimilarCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const code = editor.document.getText(selection);
        
        if (!code) {
            vscode.window.showErrorMessage('Select code to find similar patterns');
            return;
        }

        const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cpp}', '**/node_modules/**', 50);
        let results = '';

        for (const file of files.slice(0, 10)) {
            const content = await vscode.workspace.fs.readFile(file);
            const fileContent = content.toString();
            
            if (fileContent.includes(code.substring(0, 50))) {
                results += `\n## ${file.path}\n\`\`\`\n${fileContent.substring(0, 200)}...\n\`\`\`\n`;
            }
        }

        const doc = await vscode.workspace.openTextDocument({
            content: results || 'No similar code patterns found',
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }

    public static async generateCodeMap() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java}', '**/node_modules/**', 20);
        let codeMap = '# Code Map\n\n';

        for (const file of files) {
            const content = await vscode.workspace.fs.readFile(file);
            const lines = content.toString().split('\n');
            
            codeMap += `## ${file.path}\n`;
            
            for (let i = 0; i < Math.min(lines.length, 10); i++) {
                const line = lines[i].trim();
                if (line.startsWith('function') || line.startsWith('class') || line.startsWith('def')) {
                    codeMap += `- ${line}\n`;
                }
            }
            codeMap += '\n';
        }

        const doc = await vscode.workspace.openTextDocument({
            content: codeMap,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }
}