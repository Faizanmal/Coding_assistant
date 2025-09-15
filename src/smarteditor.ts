import * as vscode from 'vscode';
import { callAI } from './cli-api';

export class SmartEditor {
    static async addFeatureToFile(prompt: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const document = editor.document;
        const currentCode = document.getText();
        const fileName = document.fileName;
        const language = document.languageId;

        const enhancedPrompt = `Add the requested feature to this ${language} code. Return ONLY the modified sections with line numbers, not the entire file.

CURRENT CODE:
${currentCode}

REQUEST: ${prompt}

Format your response as:
LINE X-Y:
[modified code block]

LINE Z:
[new code to insert]

Only show the parts that need to be changed or added.`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Adding feature to file...",
            cancellable: false
        }, async () => {
            const response = await callAI(enhancedPrompt);
            await this.applySmartEdits(editor, response, currentCode);
        });
    }

    private static async applySmartEdits(editor: vscode.TextEditor, response: string, originalCode: string): Promise<void> {
        const edits = this.parseEditResponse(response);
        
        if (edits.length === 0) {
            vscode.window.showWarningMessage('No edits detected in AI response');
            return;
        }

        // Show diff before applying
        const modifiedCode = this.applyEditsToCode(originalCode, edits);
        const shouldApply = await this.showDiffPreview(originalCode, modifiedCode, editor.document.fileName);
        
        if (!shouldApply) {
            vscode.window.showInformationMessage('Edits cancelled');
            return;
        }

        const workspaceEdit = new vscode.WorkspaceEdit();
        const document = editor.document;

        for (const edit of edits) {
            if (edit.type === 'replace') {
                const startPos = new vscode.Position(edit.startLine - 1, 0);
                const endPos = new vscode.Position(edit.endLine || edit.startLine, 0);
                const range = new vscode.Range(startPos, endPos);
                workspaceEdit.replace(document.uri, range, edit.code + '\n');
            } else if (edit.type === 'insert') {
                const pos = new vscode.Position(edit.startLine - 1, 0);
                workspaceEdit.insert(document.uri, pos, edit.code + '\n');
            }
        }

        const success = await vscode.workspace.applyEdit(workspaceEdit);
        
        if (success) {
            vscode.window.showInformationMessage(`Applied ${edits.length} smart edits`);
        } else {
            vscode.window.showErrorMessage('Failed to apply edits');
        }
    }

    private static parseEditResponse(response: string): Array<{
        type: 'replace' | 'insert';
        startLine: number;
        endLine?: number;
        code: string;
    }> {
        const edits: Array<{
            type: 'replace' | 'insert';
            startLine: number;
            endLine?: number;
            code: string;
        }> = [];

        const lines = response.split('\n');
        let currentEdit: any = null;
        let codeLines: string[] = [];

        for (const line of lines) {
            const lineMatch = line.match(/^LINE (\d+)(?:-(\d+))?:/);
            
            if (lineMatch) {
                // Save previous edit
                if (currentEdit) {
                    currentEdit.code = codeLines.join('\n');
                    edits.push(currentEdit);
                }

                // Start new edit
                const startLine = parseInt(lineMatch[1]);
                const endLine = lineMatch[2] ? parseInt(lineMatch[2]) : undefined;
                
                currentEdit = {
                    type: endLine ? 'replace' : 'insert',
                    startLine,
                    endLine
                };
                codeLines = [];
            } else if (currentEdit && line.trim()) {
                codeLines.push(line);
            }
        }

        // Save last edit
        if (currentEdit) {
            currentEdit.code = codeLines.join('\n');
            edits.push(currentEdit);
        }

        return edits;
    }

    private static applyEditsToCode(originalCode: string, edits: Array<any>): string {
        const lines = originalCode.split('\n');
        
        // Sort edits by line number (descending to avoid index shifts)
        edits.sort((a, b) => b.startLine - a.startLine);
        
        for (const edit of edits) {
            if (edit.type === 'replace') {
                const endLine = edit.endLine || edit.startLine;
                lines.splice(edit.startLine - 1, endLine - edit.startLine + 1, ...edit.code.split('\n'));
            } else if (edit.type === 'insert') {
                lines.splice(edit.startLine - 1, 0, ...edit.code.split('\n'));
            }
        }
        
        return lines.join('\n');
    }

    private static async showDiffPreview(original: string, modified: string, fileName: string): Promise<boolean> {
        const originalUri = vscode.Uri.parse(`untitled:${fileName}.original`);
        const modifiedUri = vscode.Uri.parse(`untitled:${fileName}.modified`);

        const originalDoc = await vscode.workspace.openTextDocument(originalUri);
        const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);

        const edit = new vscode.WorkspaceEdit();
        edit.insert(originalUri, new vscode.Position(0, 0), original);
        edit.insert(modifiedUri, new vscode.Position(0, 0), modified);
        await vscode.workspace.applyEdit(edit);

        await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, 'Smart Edit Preview');

        const choice = await vscode.window.showQuickPick(
            ['Apply Changes', 'Cancel'],
            { placeHolder: 'Review the changes and decide' }
        );

        return choice === 'Apply Changes';
    }

    static async addFeatureToMultipleFiles(requests: Array<{fileName: string; prompt: string}>): Promise<void> {
        const { MultiAgentGenerator } = await import('./multiagentgenerator');
        
        const tasks = requests.map(req => ({
            fileName: req.fileName,
            prompt: `Add feature to existing file: ${req.prompt}`,
            language: this.getLanguageFromFileName(req.fileName)
        }));
        
        await MultiAgentGenerator.generateWithAgents(tasks);
    }

    private static getLanguageFromFileName(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const langMap: { [key: string]: string } = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python',
            'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp'
        };
        return langMap[ext || ''] || 'text';
    }

    static isFeatureRequest(prompt: string): boolean {
        return /add|insert|implement|create.*function|new.*feature|modify|update|enhance/i.test(prompt);
    }

    static isMultiFileFeatureRequest(prompt: string): boolean {
        return /add.*to.*files|modify.*files|update.*multiple|enhance.*project/i.test(prompt);
    }
}