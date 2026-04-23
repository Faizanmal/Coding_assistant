import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface DependencyInfo {
    name: string;
    currentVersion: string;
    latestVersion?: string;
    isOutdated: boolean;
    hasSecurityIssue: boolean;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    recommendation?: string;
    alternativeSuggestions?: string[];
}

interface DependencyAnalysisResult {
    totalDependencies: number;
    outdatedCount: number;
    vulnerableCount: number;
    dependencies: DependencyInfo[];
    suggestions: string[];
    migrationGuide?: string;
}

export class DependencyManager {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Dependency Manager');
    }

    /**
     * Analyze project dependencies across different package managers
     */
    async analyzeDependencies(): Promise<DependencyAnalysisResult | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return null;
            }

            const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
            const requirementsPath = path.join(workspaceFolder.uri.fsPath, 'requirements.txt');
            const composerPath = path.join(workspaceFolder.uri.fsPath, 'composer.json');
            const gemfilePath = path.join(workspaceFolder.uri.fsPath, 'Gemfile');

            let analysisResult: DependencyAnalysisResult | null = null;

            // Check for Node.js projects
            if (fs.existsSync(packageJsonPath)) {
                analysisResult = await this.analyzeNodeDependencies(packageJsonPath);
            }
            // Check for Python projects
            else if (fs.existsSync(requirementsPath)) {
                analysisResult = await this.analyzePythonDependencies(requirementsPath);
            }
            // Check for PHP projects
            else if (fs.existsSync(composerPath)) {
                analysisResult = await this.analyzeComposerDependencies(composerPath);
            }
            // Check for Ruby projects
            else if (fs.existsSync(gemfilePath)) {
                analysisResult = await this.analyzeGemDependencies(gemfilePath);
            }
            else {
                vscode.window.showWarningMessage('No supported dependency file found (package.json, requirements.txt, composer.json, Gemfile)');
                return null;
            }

            return analysisResult;
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing dependencies: ${error}`);
            throw error;
        }
    }

    /**
     * Analyze Node.js dependencies from package.json
     */
    private async analyzeNodeDependencies(packageJsonPath: string): Promise<DependencyAnalysisResult> {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const dependencyList: DependencyInfo[] = [];
        
        for (const [name, version] of Object.entries(dependencies)) {
            const info: DependencyInfo = {
                name,
                currentVersion: version as string,
                isOutdated: false,
                hasSecurityIssue: false
            };

            // Check for security vulnerabilities and outdated versions using AI
            const vulnerabilityCheck = await this.checkDependencySecurity(name, version as string);
            if (vulnerabilityCheck) {
                info.hasSecurityIssue = vulnerabilityCheck.hasVulnerability;
                info.severity = vulnerabilityCheck.severity;
                info.latestVersion = vulnerabilityCheck.latestVersion;
                info.isOutdated = vulnerabilityCheck.isOutdated;
                info.recommendation = vulnerabilityCheck.recommendation;
                info.alternativeSuggestions = vulnerabilityCheck.alternatives;
            }

            dependencyList.push(info);
        }

        const outdatedCount = dependencyList.filter(d => d.isOutdated).length;
        const vulnerableCount = dependencyList.filter(d => d.hasSecurityIssue).length;

        // Generate AI-powered suggestions
        const suggestions = await this.generateDependencySuggestions(dependencyList);

        return {
            totalDependencies: dependencyList.length,
            outdatedCount,
            vulnerableCount,
            dependencies: dependencyList,
            suggestions
        };
    }

    /**
     * Analyze Python dependencies from requirements.txt
     */
    private async analyzePythonDependencies(requirementsPath: string): Promise<DependencyAnalysisResult> {
        const content = fs.readFileSync(requirementsPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        const dependencyList: DependencyInfo[] = [];
        
        for (const line of lines) {
            const match = line.match(/^([a-zA-Z0-9\-_]+)([>=<~!]=?)(.+)$/);
            if (match) {
                const [, name, , version] = match;
                const info: DependencyInfo = {
                    name,
                    currentVersion: version.trim(),
                    isOutdated: false,
                    hasSecurityIssue: false
                };

                const vulnerabilityCheck = await this.checkDependencySecurity(name, version.trim(), 'python');
                if (vulnerabilityCheck) {
                    info.hasSecurityIssue = vulnerabilityCheck.hasVulnerability;
                    info.severity = vulnerabilityCheck.severity;
                    info.latestVersion = vulnerabilityCheck.latestVersion;
                    info.isOutdated = vulnerabilityCheck.isOutdated;
                    info.recommendation = vulnerabilityCheck.recommendation;
                }

                dependencyList.push(info);
            }
        }

        const outdatedCount = dependencyList.filter(d => d.isOutdated).length;
        const vulnerableCount = dependencyList.filter(d => d.hasSecurityIssue).length;
        const suggestions = await this.generateDependencySuggestions(dependencyList);

        return {
            totalDependencies: dependencyList.length,
            outdatedCount,
            vulnerableCount,
            dependencies: dependencyList,
            suggestions
        };
    }

    /**
     * Analyze PHP dependencies from composer.json
     */
    private async analyzeComposerDependencies(composerPath: string): Promise<DependencyAnalysisResult> {
        const composerJson = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
        const dependencies = { ...composerJson.require, ...composerJson['require-dev'] };
        
        const dependencyList: DependencyInfo[] = [];
        
        for (const [name, version] of Object.entries(dependencies)) {
            if (name === 'php') {continue;} // Skip PHP version requirement
            
            const info: DependencyInfo = {
                name,
                currentVersion: version as string,
                isOutdated: false,
                hasSecurityIssue: false
            };

            const vulnerabilityCheck = await this.checkDependencySecurity(name, version as string, 'php');
            if (vulnerabilityCheck) {
                info.hasSecurityIssue = vulnerabilityCheck.hasVulnerability;
                info.severity = vulnerabilityCheck.severity;
                info.latestVersion = vulnerabilityCheck.latestVersion;
                info.isOutdated = vulnerabilityCheck.isOutdated;
                info.recommendation = vulnerabilityCheck.recommendation;
            }

            dependencyList.push(info);
        }

        const outdatedCount = dependencyList.filter(d => d.isOutdated).length;
        const vulnerableCount = dependencyList.filter(d => d.hasSecurityIssue).length;
        const suggestions = await this.generateDependencySuggestions(dependencyList);

        return {
            totalDependencies: dependencyList.length,
            outdatedCount,
            vulnerableCount,
            dependencies: dependencyList,
            suggestions
        };
    }

    /**
     * Analyze Ruby dependencies from Gemfile
     */
    private async analyzeGemDependencies(gemfilePath: string): Promise<DependencyAnalysisResult> {
        const content = fs.readFileSync(gemfilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        const dependencyList: DependencyInfo[] = [];
        
        for (const line of lines) {
            const match = line.match(/gem\s+['"]([^'"]+)['"]\s*,?\s*['"]?([^'"]+)?['"]?/);
            if (match) {
                const [, name, version] = match;
                const info: DependencyInfo = {
                    name,
                    currentVersion: version || 'latest',
                    isOutdated: false,
                    hasSecurityIssue: false
                };

                const vulnerabilityCheck = await this.checkDependencySecurity(name, version || 'latest', 'ruby');
                if (vulnerabilityCheck) {
                    info.hasSecurityIssue = vulnerabilityCheck.hasVulnerability;
                    info.severity = vulnerabilityCheck.severity;
                    info.latestVersion = vulnerabilityCheck.latestVersion;
                    info.isOutdated = vulnerabilityCheck.isOutdated;
                    info.recommendation = vulnerabilityCheck.recommendation;
                }

                dependencyList.push(info);
            }
        }

        const outdatedCount = dependencyList.filter(d => d.isOutdated).length;
        const vulnerableCount = dependencyList.filter(d => d.hasSecurityIssue).length;
        const suggestions = await this.generateDependencySuggestions(dependencyList);

        return {
            totalDependencies: dependencyList.length,
            outdatedCount,
            vulnerableCount,
            dependencies: dependencyList,
            suggestions
        };
    }

    /**
     * Check dependency for security vulnerabilities and version updates using AI
     */
    private async checkDependencySecurity(
        packageName: string, 
        version: string, 
        ecosystem: 'node' | 'python' | 'php' | 'ruby' = 'node'
    ): Promise<{
        hasVulnerability: boolean;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        latestVersion?: string;
        isOutdated: boolean;
        recommendation?: string;
        alternatives?: string[];
    } | null> {
        try {
            const prompt = `Analyze the following ${ecosystem} package for security vulnerabilities and version status:

Package: ${packageName}
Current Version: ${version}
Ecosystem: ${ecosystem}

Please provide:
1. Whether this version has known security vulnerabilities (yes/no)
2. Severity level if vulnerable (low/medium/high/critical)
3. Latest stable version available
4. Whether the current version is outdated (yes/no)
5. Recommendation for upgrade or action
6. Alternative packages if this package is deprecated or has better alternatives

Format your response as JSON:
{
    "hasVulnerability": boolean,
    "severity": "low|medium|high|critical",
    "latestVersion": "x.x.x",
    "isOutdated": boolean,
    "recommendation": "string",
    "alternatives": ["package1", "package2"]
}`;

            const response = await callAI(prompt);
            
            // Parse AI response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return result;
            }

            return null;
        } catch (error) {
            this.outputChannel.appendLine(`Error checking ${packageName}: ${error}`);
            return null;
        }
    }

    /**
     * Generate AI-powered suggestions for dependency management
     */
    private async generateDependencySuggestions(dependencies: DependencyInfo[]): Promise<string[]> {
        const vulnerableDeps = dependencies.filter(d => d.hasSecurityIssue);
        const outdatedDeps = dependencies.filter(d => d.isOutdated);

        const suggestions: string[] = [];

        if (vulnerableDeps.length > 0) {
            const critical = vulnerableDeps.filter(d => d.severity === 'critical');
            if (critical.length > 0) {
                suggestions.push(`🚨 CRITICAL: ${critical.length} dependencies have critical security vulnerabilities. Update immediately!`);
            }
            suggestions.push(`🔒 Security: ${vulnerableDeps.length} packages have known vulnerabilities`);
        }

        if (outdatedDeps.length > 0) {
            suggestions.push(`📦 Updates: ${outdatedDeps.length} packages have newer versions available`);
        }

        // Add AI-powered specific recommendations
        try {
            const prompt = `Based on this dependency analysis, provide 3-5 specific actionable recommendations:

Total Dependencies: ${dependencies.length}
Vulnerable: ${vulnerableDeps.length}
Outdated: ${outdatedDeps.length}

Vulnerable packages: ${vulnerableDeps.map(d => `${d.name}@${d.currentVersion} (${d.severity})`).join(', ')}

Provide practical, prioritized recommendations for improving this project's dependencies.`;

            const aiSuggestions = await callAI(prompt);
            const lines = aiSuggestions.split('\n').filter(line => line.trim());
            suggestions.push(...lines.slice(0, 5));
        } catch (error) {
            this.outputChannel.appendLine(`Error generating AI suggestions: ${error}`);
        }

        return suggestions;
    }

    /**
     * Show comprehensive dependency report in webview
     */
    async showDependencyReport() {
        const analysis = await this.analyzeDependencies();
        if (!analysis) {
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'dependencyReport',
            'Dependency Analysis Report',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateReportHTML(analysis);
    }

    /**
     * Generate HTML for dependency report
     */
    private generateReportHTML(analysis: DependencyAnalysisResult): string {
        const vulnerableDeps = analysis.dependencies.filter(d => d.hasSecurityIssue);
        const outdatedDeps = analysis.dependencies.filter(d => d.isOutdated);
        const upToDateDeps = analysis.dependencies.filter(d => !d.isOutdated && !d.hasSecurityIssue);

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Analysis Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 28px;
            margin-bottom: 15px;
            color: white;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .stat-card.total { border-color: #3794ff; }
        .stat-card.vulnerable { border-color: #f48771; }
        .stat-card.outdated { border-color: #cca700; }
        .stat-card.safe { border-color: #89d185; }
        .stat-number {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #858585;
            font-size: 14px;
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        h2 {
            margin-bottom: 20px;
            color: #3794ff;
            font-size: 20px;
            border-bottom: 2px solid #3794ff;
            padding-bottom: 10px;
        }
        .dependency {
            background: #1e1e1e;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 3px solid #3794ff;
        }
        .dependency.vulnerable { border-left-color: #f48771; }
        .dependency.outdated { border-left-color: #cca700; }
        .dependency-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .dependency-name {
            font-weight: bold;
            font-size: 16px;
        }
        .version-info {
            display: flex;
            gap: 10px;
            font-size: 14px;
        }
        .badge {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge.critical { background: #f48771; color: white; }
        .badge.high { background: #ff6b6b; color: white; }
        .badge.medium { background: #cca700; color: white; }
        .badge.low { background: #4a9eff; color: white; }
        .recommendation {
            margin-top: 8px;
            padding: 10px;
            background: #2d2d30;
            border-radius: 4px;
            font-size: 14px;
            color: #cccccc;
        }
        .suggestions {
            list-style: none;
            padding: 0;
        }
        .suggestions li {
            padding: 12px;
            margin-bottom: 8px;
            background: #2d2d30;
            border-radius: 4px;
            border-left: 3px solid #3794ff;
        }
        .alternatives {
            margin-top: 8px;
            font-size: 13px;
            color: #89d185;
        }
        .emoji { margin-right: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Dependency Analysis Report</h1>
        <p>Comprehensive analysis of your project dependencies</p>
    </div>

    <div class="stats">
        <div class="stat-card total">
            <div class="stat-number">${analysis.totalDependencies}</div>
            <div class="stat-label">Total Dependencies</div>
        </div>
        <div class="stat-card vulnerable">
            <div class="stat-number">${analysis.vulnerableCount}</div>
            <div class="stat-label">Vulnerable</div>
        </div>
        <div class="stat-card outdated">
            <div class="stat-number">${analysis.outdatedCount}</div>
            <div class="stat-label">Outdated</div>
        </div>
        <div class="stat-card safe">
            <div class="stat-number">${upToDateDeps.length}</div>
            <div class="stat-label">Up to Date</div>
        </div>
    </div>

    ${vulnerableDeps.length > 0 ? `
    <div class="section">
        <h2>🚨 Vulnerable Dependencies</h2>
        ${vulnerableDeps.map(dep => `
            <div class="dependency vulnerable">
                <div class="dependency-header">
                    <span class="dependency-name">${dep.name}</span>
                    <div class="version-info">
                        <span>Current: ${dep.currentVersion}</span>
                        ${dep.latestVersion ? `<span>→ Latest: ${dep.latestVersion}</span>` : ''}
                        ${dep.severity ? `<span class="badge ${dep.severity}">${dep.severity.toUpperCase()}</span>` : ''}
                    </div>
                </div>
                ${dep.recommendation ? `<div class="recommendation">💡 ${dep.recommendation}</div>` : ''}
                ${dep.alternativeSuggestions && dep.alternativeSuggestions.length > 0 ? 
                    `<div class="alternatives">🔄 Alternatives: ${dep.alternativeSuggestions.join(', ')}</div>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${outdatedDeps.length > 0 ? `
    <div class="section">
        <h2>📦 Outdated Dependencies</h2>
        ${outdatedDeps.filter(d => !d.hasSecurityIssue).map(dep => `
            <div class="dependency outdated">
                <div class="dependency-header">
                    <span class="dependency-name">${dep.name}</span>
                    <div class="version-info">
                        <span>Current: ${dep.currentVersion}</span>
                        ${dep.latestVersion ? `<span>→ Latest: ${dep.latestVersion}</span>` : ''}
                    </div>
                </div>
                ${dep.recommendation ? `<div class="recommendation">💡 ${dep.recommendation}</div>` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${analysis.suggestions.length > 0 ? `
    <div class="section">
        <h2>💡 AI-Powered Recommendations</h2>
        <ul class="suggestions">
            ${analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="section">
        <h2>✅ Up-to-Date Dependencies (${upToDateDeps.length})</h2>
        ${upToDateDeps.length > 0 ? `
            <p style="color: #89d185; padding: 10px;">
                Great job! These dependencies are current and secure.
            </p>
        ` : '<p>No up-to-date dependencies found.</p>'}
    </div>
</body>
</html>`;
    }

    /**
     * Auto-update dependencies based on AI recommendations
     */
    async autoUpdateDependencies(updateType: 'safe' | 'all' = 'safe') {
        const analysis = await this.analyzeDependencies();
        if (!analysis) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const depsToUpdate = updateType === 'safe' 
            ? analysis.dependencies.filter(d => d.isOutdated && !d.hasSecurityIssue)
            : analysis.dependencies.filter(d => d.isOutdated);

        if (depsToUpdate.length === 0) {
            vscode.window.showInformationMessage('All dependencies are up to date!');
            return;
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Update ${depsToUpdate.length} dependencies?`,
            'Yes',
            'No'
        );

        if (confirmation !== 'Yes') {
            return;
        }

        // Generate update commands based on package manager
        const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            const terminal = vscode.window.createTerminal('Dependency Update');
            terminal.show();
            
            for (const dep of depsToUpdate) {
                if (dep.latestVersion) {
                    terminal.sendText(`npm install ${dep.name}@${dep.latestVersion}`);
                }
            }
            
            vscode.window.showInformationMessage(`Updating ${depsToUpdate.length} dependencies...`);
        }
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register dependency management commands
 */
export function registerDependencyManagerCommands(context: vscode.ExtensionContext) {
    const manager = new DependencyManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.dependency.analyze', async () => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing dependencies...',
                cancellable: false
            }, async () => {
                await manager.showDependencyReport();
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.dependency.autoUpdate', async () => {
            const updateType = await vscode.window.showQuickPick(
                [
                    { label: 'Safe Updates Only', value: 'safe', description: 'Update non-vulnerable packages' },
                    { label: 'All Updates', value: 'all', description: 'Update all outdated packages' }
                ],
                { placeHolder: 'Select update type' }
            );

            if (updateType) {
                await manager.autoUpdateDependencies(updateType.value as 'safe' | 'all');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.dependency.checkSecurity', async () => {
            const analysis = await manager.analyzeDependencies();
            if (analysis) {
                const vulnerableCount = analysis.vulnerableCount;
                if (vulnerableCount > 0) {
                    vscode.window.showWarningMessage(
                        `Found ${vulnerableCount} vulnerable dependencies!`,
                        'View Report'
                    ).then(selection => {
                        if (selection === 'View Report') {
                            manager.showDependencyReport();
                        }
                    });
                } else {
                    vscode.window.showInformationMessage('✅ No security vulnerabilities found!');
                }
            }
        })
    );
}
