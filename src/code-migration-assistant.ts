import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface MigrationPlan {
    type: 'framework' | 'language' | 'library' | 'version';
    from: string;
    to: string;
    files: MigrationFile[];
    steps: MigrationStep[];
    risks: string[];
    estimatedTime: string;
    breakingChanges: string[];
}

interface MigrationFile {
    path: string;
    changes: FileChange[];
    priority: 'critical' | 'high' | 'medium' | 'low';
}

interface FileChange {
    lineNumber: number;
    oldCode: string;
    newCode: string;
    reason: string;
    automated: boolean;
}

interface MigrationStep {
    order: number;
    title: string;
    description: string;
    command?: string;
    manualAction?: string;
    dependencies: number[];
}

export class CodeMigrationAssistant {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Code Migration');
    }

    /**
     * Start migration wizard
     */
    async startMigrationWizard() {
        const migrationType = await vscode.window.showQuickPick([
            { label: '🎨 Framework Migration', value: 'framework', description: 'React, Vue, Angular, etc.' },
            { label: '🔤 Language Migration', value: 'language', description: 'JavaScript to TypeScript, Python 2 to 3, etc.' },
            { label: '📚 Library Migration', value: 'library', description: 'Update to new library versions' },
            { label: '🔢 Version Upgrade', value: 'version', description: 'Upgrade to newer versions' }
        ], { placeHolder: 'Select migration type' });

        if (!migrationType) {
            return;
        }

        switch (migrationType.value) {
            case 'framework':
                await this.frameworkMigration();
                break;
            case 'language':
                await this.languageMigration();
                break;
            case 'library':
                await this.libraryMigration();
                break;
            case 'version':
                await this.versionUpgrade();
                break;
        }
    }

    /**
     * Framework migration (e.g., Vue to React)
     */
    private async frameworkMigration() {
        const fromFramework = await vscode.window.showQuickPick([
            { label: 'React', value: 'react' },
            { label: 'Vue', value: 'vue' },
            { label: 'Angular', value: 'angular' },
            { label: 'Svelte', value: 'svelte' },
            { label: 'jQuery', value: 'jquery' },
            { label: 'Other', value: 'other' }
        ], { placeHolder: 'Migrate from?' });

        if (!fromFramework) {
            return;
        }

        const toFramework = await vscode.window.showQuickPick([
            { label: 'React', value: 'react' },
            { label: 'Vue', value: 'vue' },
            { label: 'Angular', value: 'angular' },
            { label: 'Svelte', value: 'svelte' },
            { label: 'Next.js', value: 'nextjs' },
            { label: 'Nuxt.js', value: 'nuxtjs' }
        ], { placeHolder: 'Migrate to?' });

        if (!toFramework) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${fromFramework.label} to ${toFramework.label} migration...`,
            cancellable: false
        }, async () => {
            const plan = await this.generateFrameworkMigrationPlan(
                fromFramework.value,
                toFramework.value
            );

            if (plan) {
                await this.showMigrationPlan(plan);
            }
        });
    }

    /**
     * Language migration (e.g., JavaScript to TypeScript)
     */
    private async languageMigration() {
        const migrations = await vscode.window.showQuickPick([
            { label: 'JavaScript → TypeScript', from: 'javascript', to: 'typescript' },
            { label: 'Python 2 → Python 3', from: 'python2', to: 'python3' },
            { label: 'Java 8 → Java 17', from: 'java8', to: 'java17' },
            { label: 'PHP 7 → PHP 8', from: 'php7', to: 'php8' },
            { label: 'Ruby 2 → Ruby 3', from: 'ruby2', to: 'ruby3' }
        ], { placeHolder: 'Select language migration' });

        if (!migrations) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${migrations.label} migration...`,
            cancellable: false
        }, async () => {
            const plan = await this.generateLanguageMigrationPlan(
                migrations.from,
                migrations.to
            );

            if (plan) {
                await this.showMigrationPlan(plan);
            }
        });
    }

    /**
     * Library migration
     */
    private async libraryMigration() {
        const library = await vscode.window.showInputBox({
            prompt: 'Enter library name (e.g., moment, lodash)',
            placeHolder: 'Library name'
        });

        if (!library) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${library} migration options...`,
            cancellable: false
        }, async () => {
            const plan = await this.generateLibraryMigrationPlan(library);
            if (plan) {
                await this.showMigrationPlan(plan);
            }
        });
    }

    /**
     * Version upgrade
     */
    private async versionUpgrade() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            vscode.window.showErrorMessage('No package.json found');
            return;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = Object.keys(packageJson.dependencies || {});

        const selected = await vscode.window.showQuickPick(
            dependencies.map(dep => ({
                label: dep,
                description: packageJson.dependencies[dep]
            })),
            { placeHolder: 'Select package to upgrade' }
        );

        if (!selected) {
            return;
        }

        const plan = await this.generateVersionUpgradePlan(
            selected.label,
            selected.description || ''
        );

        if (plan) {
            await this.showMigrationPlan(plan);
        }
    }

    /**
     * Generate framework migration plan using AI
     */
    private async generateFrameworkMigrationPlan(
        from: string,
        to: string
    ): Promise<MigrationPlan | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }

            // Find relevant files
            const files = await vscode.workspace.findFiles(
                '**/*.{js,jsx,ts,tsx,vue}',
                '**/node_modules/**'
            );

            const fileContents: { path: string; content: string }[] = [];
            for (const file of files.slice(0, 10)) { // Limit to 10 files for analysis
                const document = await vscode.workspace.openTextDocument(file);
                fileContents.push({
                    path: vscode.workspace.asRelativePath(file),
                    content: document.getText().substring(0, 5000) // Limit content
                });
            }

            const prompt = `Create a comprehensive migration plan from ${from} to ${to}.

Project files sample:
${fileContents.map(f => `\n${f.path}:\n${f.content.substring(0, 500)}`).join('\n')}

Generate a detailed migration plan with:
1. List of files that need changes
2. Specific code transformations for each file
3. Step-by-step migration steps
4. Potential risks and breaking changes
5. Estimated time
6. Dependencies between steps

Format as JSON:
{
    "type": "framework",
    "from": "${from}",
    "to": "${to}",
    "files": [
        {
            "path": "file.js",
            "changes": [
                {
                    "lineNumber": 10,
                    "oldCode": "old code",
                    "newCode": "new code",
                    "reason": "explanation",
                    "automated": true
                }
            ],
            "priority": "critical"
        }
    ],
    "steps": [
        {
            "order": 1,
            "title": "Step title",
            "description": "What to do",
            "command": "npm command",
            "dependencies": []
        }
    ],
    "risks": ["risk 1", "risk 2"],
    "estimatedTime": "2-4 hours",
    "breakingChanges": ["change 1", "change 2"]
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error generating migration plan: ${error}`);
            return null;
        }
    }

    /**
     * Generate language migration plan
     */
    private async generateLanguageMigrationPlan(
        from: string,
        to: string
    ): Promise<MigrationPlan | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }

            const extensions = this.getLanguageExtensions(to);
            const files = await vscode.workspace.findFiles(
                `**/*.{${extensions.join(',')}}`,
                '**/node_modules/**'
            );

            const prompt = `Create a migration plan from ${from} to ${to}.

Analyze common migration patterns and breaking changes.

Provide:
1. Files that need modification
2. Syntax changes required
3. API changes
4. Configuration updates
5. Step-by-step guide
6. Potential issues

Format as JSON migration plan.`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error: ${error}`);
            return null;
        }
    }

    /**
     * Generate library migration plan
     */
    private async generateLibraryMigrationPlan(library: string): Promise<MigrationPlan | null> {
        try {
            const prompt = `Analyze migration options for the library "${library}".

Provide:
1. Modern alternatives to ${library}
2. Migration guide for each alternative
3. Breaking changes
4. Code transformation examples
5. Estimated effort

Recommend the best alternative with reasoning.

Format as JSON migration plan.`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error: ${error}`);
            return null;
        }
    }

    /**
     * Generate version upgrade plan
     */
    private async generateVersionUpgradePlan(
        packageName: string,
        currentVersion: string
    ): Promise<MigrationPlan | null> {
        try {
            const prompt = `Create a version upgrade plan for ${packageName} from ${currentVersion}.

Provide:
1. Latest stable version
2. Breaking changes between versions
3. Required code modifications
4. Configuration changes
5. Migration steps
6. Rollback plan

Format as JSON migration plan.`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error: ${error}`);
            return null;
        }
    }

    /**
     * Show migration plan in webview
     */
    private async showMigrationPlan(plan: MigrationPlan) {
        const panel = vscode.window.createWebviewPanel(
            'migrationPlan',
            `Migration: ${plan.from} → ${plan.to}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateMigrationHTML(plan);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'executeMigration':
                        await this.executeMigration(plan);
                        break;
                    case 'executeStep':
                        await this.executeStep(plan.steps[message.stepIndex]);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    /**
     * Generate migration plan HTML
     */
    private generateMigrationHTML(plan: MigrationPlan): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            color: white;
        }
        h1 { font-size: 28px; margin-bottom: 10px; }
        .migration-info {
            display: flex;
            gap: 30px;
            margin-top: 15px;
            font-size: 14px;
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #3794ff;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3794ff;
        }
        .step {
            background: #1e1e1e;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid #3794ff;
        }
        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .step-number {
            background: #3794ff;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .risk {
            padding: 10px;
            background: #3c2424;
            border-left: 3px solid #f48771;
            margin-bottom: 8px;
            border-radius: 4px;
        }
        .file-change {
            background: #2d2d30;
            padding: 12px;
            margin-bottom: 8px;
            border-radius: 4px;
        }
        .code-block {
            background: #1e1e1e;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            margin: 8px 0;
            font-size: 13px;
        }
        button {
            background: #3794ff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        button:hover { opacity: 0.8; }
        .warning { color: #cca700; }
        .success { color: #89d185; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔄 Migration Plan: ${plan.from} → ${plan.to}</h1>
        <div class="migration-info">
            <div>📁 Files: ${plan.files.length}</div>
            <div>⏱️ Estimated Time: ${plan.estimatedTime}</div>
            <div>⚠️ Risks: ${plan.risks.length}</div>
        </div>
    </div>

    ${plan.risks.length > 0 ? `
    <div class="section">
        <h2>⚠️ Risks & Breaking Changes</h2>
        ${plan.risks.map(risk => `<div class="risk">⚠️ ${risk}</div>`).join('')}
        ${plan.breakingChanges.map(change => 
            `<div class="risk">🔴 Breaking: ${change}</div>`
        ).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>📋 Migration Steps</h2>
        ${plan.steps.map((step, index) => `
            <div class="step">
                <div class="step-header">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div class="step-number">${step.order}</div>
                        <strong>${step.title}</strong>
                    </div>
                    ${step.command ? 
                        `<button onclick="executeStep(${index})">Execute</button>` : ''}
                </div>
                <div>${step.description}</div>
                ${step.command ? 
                    `<div class="code-block">$ ${step.command}</div>` : ''}
                ${step.manualAction ? 
                    `<div class="warning">📝 Manual: ${step.manualAction}</div>` : ''}
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>📁 File Changes (${plan.files.length})</h2>
        ${plan.files.slice(0, 10).map(file => `
            <div class="file-change">
                <strong>📄 ${file.path}</strong>
                <div style="margin-top: 8px; color: #858585;">
                    ${file.changes.length} change(s) | Priority: ${file.priority}
                </div>
            </div>
        `).join('')}
        ${plan.files.length > 10 ? 
            `<div style="margin-top: 10px; color: #858585;">
                ...and ${plan.files.length - 10} more files
            </div>` : ''}
    </div>

    <div class="section">
        <button onclick="executeMigration()" style="width: 100%; padding: 15px;">
            🚀 Start Automated Migration
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function executeMigration() {
            vscode.postMessage({ command: 'executeMigration' });
        }

        function executeStep(index) {
            vscode.postMessage({ command: 'executeStep', stepIndex: index });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Execute migration
     */
    private async executeMigration(plan: MigrationPlan) {
        const confirmation = await vscode.window.showWarningMessage(
            `This will modify ${plan.files.length} files. Create backup first?`,
            'Yes, Continue',
            'Cancel'
        );

        if (confirmation !== 'Yes, Continue') {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Executing migration...',
            cancellable: true
        }, async (progress, token) => {
            for (let i = 0; i < plan.steps.length; i++) {
                if (token.isCancellationRequested) {
                    break;
                }

                const step = plan.steps[i];
                progress.report({
                    message: step.title,
                    increment: (100 / plan.steps.length)
                });

                await this.executeStep(step);
            }
        });

        vscode.window.showInformationMessage('✅ Migration completed!');
    }

    /**
     * Execute single migration step
     */
    private async executeStep(step: MigrationStep) {
        if (step.command) {
            const terminal = vscode.window.createTerminal('Migration');
            terminal.show();
            terminal.sendText(step.command);
        }

        if (step.manualAction) {
            vscode.window.showInformationMessage(`Manual action required: ${step.manualAction}`);
        }
    }

    /**
     * Get file extensions for language
     */
    private getLanguageExtensions(language: string): string[] {
        const extensionMap: { [key: string]: string[] } = {
            'typescript': ['ts', 'tsx'],
            'javascript': ['js', 'jsx'],
            'python3': ['py'],
            'java17': ['java'],
            'php8': ['php'],
            'ruby3': ['rb']
        };

        return extensionMap[language] || [];
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register code migration commands
 */
export function registerCodeMigrationCommands(context: vscode.ExtensionContext) {
    const assistant = new CodeMigrationAssistant(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.migration.start', async () => {
            await assistant.startMigrationWizard();
        })
    );
}
