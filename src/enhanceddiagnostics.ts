import * as vscode from 'vscode';
import { callLLM } from './cli-api';
import { DiagnosticStatusBar } from './diagnosticstatusbar';
import { DiagnosticConfigManager } from './diagnosticconfig';

export class EnhancedDiagnostics {
    private static diagnosticCollection: vscode.DiagnosticCollection;
    private static statusBar: DiagnosticStatusBar;

    public static activate(context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-fixes');
        this.statusBar = new DiagnosticStatusBar();
        context.subscriptions.push(this.diagnosticCollection, this.statusBar);

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('coding.fixDiagnostic1', this.fixSingleDiagnostic),
            vscode.commands.registerCommand('coding.fixFirstDiagnostic', this.fixFirstDiagnostic),
            vscode.commands.registerCommand('coding.fixAllDiagnostics', this.fixAllDiagnostics),
            vscode.commands.registerCommand('coding.applyAIFix', this.applyAIFix)
        );

        // Register code action provider
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider('*', new AIFixCodeActionProvider(), {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            })
        );
    }

    private static async fixSingleDiagnostic() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const position = editor.selection.active;
        
        // Find diagnostic at cursor position
        const diagnostic = diagnostics.find(d => d.range.contains(position));
        if (!diagnostic) {
            vscode.window.showInformationMessage('No diagnostic found at cursor position');
            return;
        }

        await this.fixDiagnosticWithAI(editor.document, diagnostic);
    }

    private static async fixFirstDiagnostic() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
            .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
            .sort((a, b) => a.range.start.line - b.range.start.line);

        if (diagnostics.length === 0) {
            vscode.window.showInformationMessage('No errors found in current file');
            return;
        }

        await this.fixDiagnosticWithAI(editor.document, diagnostics[0]);
    }

    private static async fixAllDiagnostics() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {return;}

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
            .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
            .sort((a, b) => b.range.start.line - a.range.start.line); // Fix from bottom to top

        if (diagnostics.length === 0) {
            vscode.window.showInformationMessage('No errors found in current file');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Fix ${diagnostics.length} error(s) with AI?`,
            'Yes', 'No'
        );

        if (confirm !== 'Yes') {return;}

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fixing ${diagnostics.length} errors...`,
            cancellable: true
        }, async (progress, token) => {
            let fixed = 0;
            for (const diagnostic of diagnostics) {
                if (token.isCancellationRequested) {break;}
                
                progress.report({ 
                    increment: (100 / diagnostics.length),
                    message: `Fixing error ${fixed + 1}/${diagnostics.length}` 
                });

                await this.fixDiagnosticWithAI(editor.document, diagnostic);
                fixed++;
            }
            
            vscode.window.showInformationMessage(`Fixed ${fixed} error(s)`);
        });
    }

    private static async fixDiagnosticWithAI(document: vscode.TextDocument, diagnostic: vscode.Diagnostic) {
        const config = DiagnosticConfigManager.getConfig();
        
        if (!DiagnosticConfigManager.shouldProcessDiagnostic(diagnostic, document)) {
            vscode.window.showInformationMessage('Diagnostic excluded by configuration');
            return;
        }

        const range = diagnostic.range;
        const errorCode = document.getText(range);
        const errorMessage = diagnostic.message;
        
        // Get surrounding context based on config
        const startLine = Math.max(0, range.start.line - config.maxContextLines);
        const endLine = Math.min(document.lineCount - 1, range.end.line + config.maxContextLines);
        const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
        const context = document.getText(contextRange);

        const prompt = `Fix this ${document.languageId} code error:

Error: ${errorMessage}
Line with error: ${errorCode}

Context:
\`\`\`${document.languageId}
${context}
\`\`\`

Return only the fixed line of code, no explanations.`;

        try {
            const fixedCode = await callLLM(prompt, config.preferredProvider, config.preferredModel);
            if (!fixedCode) {throw new Error('No fix returned');}

            const cleanedFix = this.cleanLLMOutput(fixedCode);
            
            // Show diff and apply based on config
            if (config.autoApplyFixes) {
                await this.applyFixDirectly(document, range, cleanedFix);
            } else {
                await this.showDiffAndApply(document, range, errorCode, cleanedFix);
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fix error: ${error}`);
        }
    }

    private static async applyAIFix(document: vscode.TextDocument, range: vscode.Range, diagnostic: vscode.Diagnostic) {
        await this.fixDiagnosticWithAI(document, diagnostic);
    }

    private static cleanLLMOutput(output: string): string {
        return output
            .replace(/```[\w]*\n?/g, '')
            .replace(/```/g, '')
            .trim();
    }

    private static async applyFixDirectly(document: vscode.TextDocument, range: vscode.Range, fixed: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.toString() === document.uri.toString()) {
            await editor.edit(editBuilder => {
                editBuilder.replace(range, fixed);
            });
            vscode.window.showInformationMessage('✅ Fix applied automatically');
        }
    }

    private static async showDiffAndApply(document: vscode.TextDocument, range: vscode.Range, original: string, fixed: string) {
        const config = DiagnosticConfigManager.getConfig();
        
        if (config.showDiffPreview) {
            const choice = await vscode.window.showInformationMessage(
                `Apply AI fix?\nOriginal: ${original}\nFixed: ${fixed}`,
                'Apply', 'Cancel'
            );

            if (choice === 'Apply') {
                await this.applyFixDirectly(document, range, fixed);
            }
        } else {
            await this.applyFixDirectly(document, range, fixed);
        }
    }
}

class AIFixCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
                const fixAction = new vscode.CodeAction('🤖 Fix with AI', vscode.CodeActionKind.QuickFix);
                fixAction.command = {
                    title: 'Fix with AI',
                    command: 'coding.applyAIFix',
                    arguments: [document, diagnostic.range, diagnostic]
                };
                fixAction.diagnostics = [diagnostic];
                fixAction.isPreferred = true;
                actions.push(fixAction);
            }
        }

        // Add bulk fix action if multiple errors
        const errors = context.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        if (errors.length > 1) {
            const fixAllAction = new vscode.CodeAction(`🤖 Fix all ${errors.length} errors`, vscode.CodeActionKind.QuickFix);
            fixAllAction.command = {
                title: 'Fix all errors',
                command: 'coding.fixAllDiagnostics'
            };
            actions.push(fixAllAction);
        }

        return actions;
    }
}