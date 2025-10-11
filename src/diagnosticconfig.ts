import * as vscode from 'vscode';

export interface DiagnosticConfig {
    maxContextLines: number;
    autoApplyFixes: boolean;
    showDiffPreview: boolean;
    preferredProvider: string;
    preferredModel: string;
    excludePatterns: string[];
}

export class DiagnosticConfigManager {
    private static config: DiagnosticConfig;

    public static getConfig(): DiagnosticConfig {
        if (!this.config) {
            this.loadConfig();
        }
        return this.config;
    }

    private static loadConfig() {
        const vscodeConfig = vscode.workspace.getConfiguration('coding');
        
        this.config = {
            maxContextLines: vscodeConfig.get('diagnostics.maxContextLines', 3),
            autoApplyFixes: vscodeConfig.get('diagnostics.autoApplyFixes', false),
            showDiffPreview: vscodeConfig.get('diagnostics.showDiffPreview', true),
            preferredProvider: vscodeConfig.get('defaultProvider', 'groq'),
            preferredModel: vscodeConfig.get('diagnostics.preferredModel', 'llama-3.3-70b-versatile'),
            excludePatterns: vscodeConfig.get('diagnostics.excludePatterns', ['node_modules/**', '*.min.js'])
        };
    }

    public static shouldProcessDiagnostic(diagnostic: vscode.Diagnostic, document: vscode.TextDocument): boolean {
        const config = this.getConfig();
        
        // Skip if file matches exclude patterns
        for (const pattern of config.excludePatterns) {
            if (document.uri.fsPath.includes(pattern.replace('**', ''))) {
                return false;
            }
        }

        // Only process errors and warnings
        return diagnostic.severity <= vscode.DiagnosticSeverity.Warning;
    }
}