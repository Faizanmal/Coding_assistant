import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface EnvConfig {
    file: string;
    variables: EnvVariable[];
    issues: EnvIssue[];
}

interface EnvVariable {
    key: string;
    value: string;
    isSecret: boolean;
    hasDefault: boolean;
    used: boolean;
    usedIn: string[];
}

interface EnvIssue {
    type: 'missing' | 'exposed' | 'unused' | 'invalid' | 'drift';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    variable?: string;
    fix?: string;
}

export class EnvConfigManager {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private watcher?: vscode.FileSystemWatcher;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Env Config Manager');
        this.setupFileWatcher();
    }

    /**
     * Setup file watcher for .env files
     */
    private setupFileWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/.env*');
        
        this.watcher.onDidChange(uri => {
            this.outputChannel.appendLine(`Environment file changed: ${uri.fsPath}`);
            this.validateEnvFile(uri.fsPath);
        });

        this.watcher.onDidCreate(uri => {
            this.outputChannel.appendLine(`New environment file created: ${uri.fsPath}`);
        });
    }

    /**
     * Scan workspace for environment files
     */
    async scanEnvironmentFiles(): Promise<EnvConfig[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const envFiles = await vscode.workspace.findFiles(
            '**/.env*',
            '**/node_modules/**'
        );

        const configs: EnvConfig[] = [];

        for (const file of envFiles) {
            const config = await this.analyzeEnvFile(file.fsPath);
            if (config) {
                configs.push(config);
            }
        }

        return configs;
    }

    /**
     * Analyze a single .env file
     */
    private async analyzeEnvFile(filePath: string): Promise<EnvConfig | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const variables: EnvVariable[] = [];
            const issues: EnvIssue[] = [];

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    continue;
                }

                const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
                if (match) {
                    const [, key, value] = match;
                    const isSecret = this.isSecretKey(key);
                    
                    // Check if value is exposed
                    if (isSecret && value && !value.startsWith('$')) {
                        issues.push({
                            type: 'exposed',
                            severity: 'critical',
                            message: `Secret "${key}" is hardcoded in file`,
                            variable: key,
                            fix: 'Use environment variable or secret manager'
                        });
                    }

                    variables.push({
                        key,
                        value: value || '',
                        isSecret,
                        hasDefault: value.includes(':-'),
                        used: false,
                        usedIn: []
                    });
                }
            }

            // Check for missing required variables
            const requiredVars = await this.findRequiredVariables();
            for (const required of requiredVars) {
                if (!variables.find(v => v.key === required)) {
                    issues.push({
                        type: 'missing',
                        severity: 'high',
                        message: `Required variable "${required}" is not defined`,
                        variable: required,
                        fix: `Add ${required}=value to .env file`
                    });
                }
            }

            return {
                file: filePath,
                variables,
                issues
            };
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing ${filePath}: ${error}`);
            return null;
        }
    }

    /**
     * Detect if a key is a secret
     */
    private isSecretKey(key: string): boolean {
        const secretPatterns = [
            'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'API_KEY',
            'PRIVATE', 'CREDENTIAL', 'AUTH', 'CERTIFICATE'
        ];
        
        const upperKey = key.toUpperCase();
        return secretPatterns.some(pattern => upperKey.includes(pattern));
    }

    /**
     * Find required environment variables in code
     */
    private async findRequiredVariables(): Promise<string[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const files = await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,java,go,rb,php}',
            '**/node_modules/**'
        );

        const required = new Set<string>();
        const patterns = [
            /process\.env\.([A-Z_][A-Z0-9_]*)/g,
            /os\.environ\.get\(['"]([A-Z_][A-Z0-9_]*)['"]?\)/g,
            /System\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]?\)/g,
            /ENV\[['"]([A-Z_][A-Z0-9_]*)['"]?\]/g
        ];

        for (const file of files.slice(0, 50)) { // Limit to 50 files
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const content = document.getText();

                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        required.add(match[1]);
                    }
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }

        return Array.from(required);
    }

    /**
     * Validate environment file
     */
    async validateEnvFile(filePath: string) {
        const config = await this.analyzeEnvFile(filePath);
        if (!config) {
            return;
        }

        if (config.issues.length > 0) {
            const critical = config.issues.filter(i => i.severity === 'critical');
            if (critical.length > 0) {
                vscode.window.showErrorMessage(
                    `${critical.length} critical issues in ${path.basename(filePath)}`,
                    'View Issues'
                ).then(selection => {
                    if (selection === 'View Issues') {
                        this.showEnvReport([config]);
                    }
                });
            }
        }
    }

    /**
     * Generate .env template from code usage
     */
    async generateEnvTemplate() {
        const required = await this.findRequiredVariables();
        
        if (required.length === 0) {
            vscode.window.showInformationMessage('No environment variables found in code');
            return;
        }

        let template = '# Environment Variables\n';
        template += '# Generated automatically - please fill in the values\n\n';

        // Use AI to categorize and document variables
        const prompt = `For these environment variables, provide:
1. Category/group (Database, API, Security, etc.)
2. Description
3. Example value (fake/placeholder)
4. Whether it's required

Variables: ${required.join(', ')}

Format as JSON array:
[{"key": "VAR_NAME", "category": "Database", "description": "...", "example": "...", "required": true}]`;

        try {
            const response = await callAI(prompt);
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                const vars = JSON.parse(jsonMatch[0]);
                const grouped = this.groupByCategory(vars);

                for (const [category, items] of Object.entries(grouped)) {
                    template += `\n# ${category}\n`;
                    for (const item of items as any[]) {
                        template += `# ${item.description}\n`;
                        template += `${item.key}=${item.example}\n`;
                    }
                }
            } else {
                // Fallback: simple template
                for (const key of required) {
                    template += `${key}=\n`;
                }
            }
        } catch (error) {
            // Fallback
            for (const key of required) {
                template += `${key}=\n`;
            }
        }

        // Create .env.template file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const templatePath = path.join(workspaceFolder.uri.fsPath, '.env.template');
            fs.writeFileSync(templatePath, template);
            
            const doc = await vscode.workspace.openTextDocument(templatePath);
            await vscode.window.showTextDocument(doc);
            
            vscode.window.showInformationMessage('✅ Generated .env.template with all required variables');
        }
    }

    /**
     * Check for config drift between environments
     */
    async checkConfigDrift() {
        const configs = await this.scanEnvironmentFiles();
        
        if (configs.length < 2) {
            vscode.window.showInformationMessage('Need at least 2 env files to check drift');
            return;
        }

        const drifts: string[] = [];
        const baseConfig = configs[0];
        const baseKeys = new Set(baseConfig.variables.map(v => v.key));

        for (let i = 1; i < configs.length; i++) {
            const config = configs[i];
            const keys = new Set(config.variables.map(v => v.key));

            // Keys in base but not in current
            for (const key of baseKeys) {
                if (!keys.has(key)) {
                    drifts.push(`❌ ${path.basename(config.file)} missing: ${key}`);
                }
            }

            // Keys in current but not in base
            for (const key of keys) {
                if (!baseKeys.has(key)) {
                    drifts.push(`➕ ${path.basename(config.file)} has extra: ${key}`);
                }
            }
        }

        if (drifts.length > 0) {
            vscode.window.showWarningMessage(
                `Found ${drifts.length} configuration drifts`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    this.outputChannel.clear();
                    this.outputChannel.appendLine('Configuration Drift Report\n');
                    drifts.forEach(drift => this.outputChannel.appendLine(drift));
                    this.outputChannel.show();
                }
            });
        } else {
            vscode.window.showInformationMessage('✅ All environment files are in sync');
        }
    }

    /**
     * Show environment configuration report
     */
    async showEnvReport(configs: EnvConfig[]) {
        const panel = vscode.window.createWebviewPanel(
            'envReport',
            'Environment Configuration Report',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateReportHTML(configs);
    }

    /**
     * Generate HTML report
     */
    private generateReportHTML(configs: EnvConfig[]): string {
        const totalIssues = configs.reduce((sum, c) => sum + c.issues.length, 0);
        const totalVars = configs.reduce((sum, c) => sum + c.variables.length, 0);
        const secrets = configs.reduce((sum, c) => 
            sum + c.variables.filter(v => v.isSecret).length, 0
        );

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            color: white;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        .stat {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 32px;
            font-weight: bold;
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .issue {
            background: #1e1e1e;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        .issue.critical { border-left-color: #f48771; }
        .issue.high { border-left-color: #ff6b6b; }
        .issue.medium { border-left-color: #cca700; }
        .issue.low { border-left-color: #4a9eff; }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        }
        .badge.critical { background: #f48771; }
        .badge.high { background: #ff6b6b; }
        .badge.secret { background: #764ba2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Environment Configuration Report</h1>
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${configs.length}</div>
                <div>Config Files</div>
            </div>
            <div class="stat">
                <div class="stat-number">${totalVars}</div>
                <div>Variables</div>
            </div>
            <div class="stat">
                <div class="stat-number">${totalIssues}</div>
                <div>Issues</div>
            </div>
        </div>
    </div>

    ${configs.map(config => `
        <div class="section">
            <h2>📁 ${path.basename(config.file)}</h2>
            
            ${config.issues.length > 0 ? `
                <h3>⚠️ Issues (${config.issues.length})</h3>
                ${config.issues.map(issue => `
                    <div class="issue ${issue.severity}">
                        <span class="badge ${issue.severity}">${issue.severity}</span>
                        <strong>${issue.message}</strong>
                        ${issue.fix ? `<div style="margin-top: 8px;">💡 Fix: ${issue.fix}</div>` : ''}
                    </div>
                `).join('')}
            ` : '<p style="color: #89d185;">✅ No issues found</p>'}

            <h3 style="margin-top: 20px;">Variables (${config.variables.length})</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                ${config.variables.map(v => `
                    <div style="padding: 8px; border-bottom: 1px solid #3c3c3c;">
                        ${v.key} ${v.isSecret ? '<span class="badge secret">SECRET</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('')}
</body>
</html>`;
    }

    /**
     * Group variables by category
     */
    private groupByCategory(vars: any[]): Record<string, any[]> {
        return vars.reduce((acc, v) => {
            const cat = v.category || 'Other';
            if (!acc[cat]) {
                acc[cat] = [];
            }
            acc[cat].push(v);
            return acc;
        }, {});
    }

    dispose() {
        this.outputChannel.dispose();
        this.watcher?.dispose();
    }
}

/**
 * Register environment config commands
 */
export function registerEnvConfigCommands(context: vscode.ExtensionContext) {
    const manager = new EnvConfigManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.env.scan', async () => {
            const configs = await manager.scanEnvironmentFiles();
            await manager.showEnvReport(configs);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.env.generateTemplate', async () => {
            await manager.generateEnvTemplate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.env.checkDrift', async () => {
            await manager.checkConfigDrift();
        })
    );
}
