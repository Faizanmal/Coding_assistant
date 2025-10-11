import * as vscode from 'vscode';

export class DiagnosticStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private diagnosticWatcher: vscode.Disposable | undefined;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'coding.fixFirstDiagnostic';
        this.updateStatusBar();
        this.startWatching();
    }

    private startWatching() {
        // Watch for diagnostic changes
        this.diagnosticWatcher = vscode.languages.onDidChangeDiagnostics(() => {
            this.updateStatusBar();
        });

        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateStatusBar();
        });
    }

    private updateStatusBar() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.statusBarItem.hide();
            return;
        }

        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);

        if (errors.length > 0) {
            this.statusBarItem.text = `🔴 ${errors.length} error(s)`;
            this.statusBarItem.tooltip = `Click to fix first error. Total: ${errors.length} errors, ${warnings.length} warnings`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.show();
        } else if (warnings.length > 0) {
            this.statusBarItem.text = `🟡 ${warnings.length} warning(s)`;
            this.statusBarItem.tooltip = `${warnings.length} warnings in current file`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.show();
        } else {
            this.statusBarItem.text = `✅ No issues`;
            this.statusBarItem.tooltip = 'No diagnostic issues found';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.show();
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
        this.diagnosticWatcher?.dispose();
    }
}