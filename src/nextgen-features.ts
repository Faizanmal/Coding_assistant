import * as vscode from 'vscode';
import { AugmentedIntelligenceSystem, registerAugmentedIntelligenceCommands } from './augmented-intelligence-system';
import { QuickDevSystem, registerQuickDevCommands } from './quick-dev-system';
import { AdvancedProjectAwarenessSystem, registerAdvancedProjectAwarenessCommands } from './advanced-project-awareness';
import { getprojectcontext } from './extension';

/**
 * NextGenExtensionFeatures - A unified control system for advanced extension capabilities,
 * enabling seamless integration of all enhanced features and providing centralized
 * management of advanced extension functionality.
 */
export class NextGenExtensionFeatures {
    private static instance: NextGenExtensionFeatures;
    private readonly augmentedIntelligence: AugmentedIntelligenceSystem;
    private readonly quickDev: QuickDevSystem;
    private readonly projectAwareness: AdvancedProjectAwarenessSystem;
    private featureStatus: Map<string, boolean> = new Map();
    private statusBarItem: vscode.StatusBarItem;
    
    private constructor() {
        // Get all subsystem singletons
        this.augmentedIntelligence = AugmentedIntelligenceSystem.getInstance();
        this.quickDev = QuickDevSystem.getInstance();
        this.projectAwareness = AdvancedProjectAwarenessSystem.getInstance();
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            1000
        );
        this.statusBarItem.text = "$(rocket) NextGen";
        this.statusBarItem.tooltip = "NextGen Extension Features";
        this.statusBarItem.command = "coding.showNextGenFeatures";
        
        // Initialize feature status
        this.initializeFeatureStatus();
        this.updateStatusBar();
        this.statusBarItem.show();
        
        console.log('🚀 NextGen Extension Features initialized');
    }
    
    public static getInstance(): NextGenExtensionFeatures {
        if (!NextGenExtensionFeatures.instance) {
            NextGenExtensionFeatures.instance = new NextGenExtensionFeatures();
        }
        return NextGenExtensionFeatures.instance;
    }
    
    /**
     * Initialize feature status
     */
    private initializeFeatureStatus(): void {
        this.featureStatus.set('augmentedIntelligence', true);
        this.featureStatus.set('quickDev', true);
        this.featureStatus.set('projectAwareness', true);
        this.featureStatus.set('enhancedUI', true);
    }
    
    /**
     * Update status bar appearance
     */
    private updateStatusBar(): void {
        const enabledCount = Array.from(this.featureStatus.values())
            .filter(status => status).length;
        
        const totalFeatures = this.featureStatus.size;
        
        if (enabledCount === totalFeatures) {
            this.statusBarItem.text = "$(rocket) NextGen";
            this.statusBarItem.backgroundColor = undefined;
        } else if (enabledCount > 0) {
            this.statusBarItem.text = `$(rocket) NextGen (${enabledCount}/${totalFeatures})`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = "$(rocket) NextGen (Off)";
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }
    
    /**
     * Toggle feature status
     */
    public toggleFeature(featureKey: string, enabled: boolean): void {
        if (this.featureStatus.has(featureKey)) {
            this.featureStatus.set(featureKey, enabled);
            this.updateStatusBar();
            
            // Log feature toggle
            console.log(`Feature ${featureKey} ${enabled ? 'enabled' : 'disabled'}`);
        }
    }
    
    /**
     * Get feature status
     */
    public getFeatureStatus(): Record<string, boolean> {
        return Object.fromEntries(this.featureStatus);
    }
    
    /**
     * Get system health data
     */
    public async getSystemHealth(): Promise<Record<string, any>> {
        // Collect health data from all subsystems
        const projectSummary = this.projectAwareness.getProjectSummary();
        const aiMetrics = this.augmentedIntelligence.getMetrics();
        
        return {
            timestamp: new Date().toISOString(),
            augmentedIntelligence: {
                status: this.featureStatus.get('augmentedIntelligence'),
                metrics: aiMetrics
            },
            quickDev: {
                status: this.featureStatus.get('quickDev')
            },
            projectAwareness: {
                status: this.featureStatus.get('projectAwareness'),
                projectType: projectSummary.projectType,
                languages: projectSummary.languages,
                securityIssuesCount: projectSummary.securityIssuesCount,
                performanceIssuesCount: projectSummary.performanceIssuesCount
            },
            enhancedUI: {
                status: this.featureStatus.get('enhancedUI')
            }
        };
    }
    
    /**
     * Initialize the NextGen features dashboard UI
     */
    public async showFeaturesDashboard(): Promise<void> {
        const health = await this.getSystemHealth();
        
        // Create HTML content for webview
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NextGen Features Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0 0 0 10px;
            font-size: 24px;
        }
        .card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .card h2 {
            margin-top: 0;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .feature-toggle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
        }
        .toggle-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
        }
        .toggle-btn.off {
            background-color: var(--vscode-button-secondaryBackground);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric-item {
            background-color: var(--vscode-editorWidget-background);
            padding: 10px;
            border-radius: 4px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin: 5px 0;
            color: var(--vscode-symbolIcon-numberForeground);
        }
        .action-row {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        .action-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            flex: 1;
            text-align: center;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <svg width="24" height="24" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M14.5 2h-4.53l1.28-1.29.53-.3-.81-.8-2 2-2-2-.8.8.52.3L8.03 2H3.5l-3 3v7l3 3h11l3-3V5l-3-3zm2 9.5l-2 2h-11l-2-2v-7l2-2h11l2 2v7z"/>
            <path d="M13.85 4.85l-2.99 3-1.86-1.83-.85.85L10 8.73 13.85 5l1 .85z"/>
        </svg>
        <h1>NextGen Features Dashboard</h1>
    </div>
    
    <div class="card">
        <h2>🧠 Augmented Intelligence System</h2>
        <div class="feature-toggle">
            <div>Enhanced AI reasoning with specialized models</div>
            <button class="toggle-btn ${health.augmentedIntelligence.status ? '' : 'off'}" 
                    data-feature="augmentedIntelligence">
                ${health.augmentedIntelligence.status ? 'Enabled' : 'Disabled'}
            </button>
        </div>
        <div class="metrics-grid">
            ${Object.entries(health.augmentedIntelligence.metrics).map(([task, data]: [string, any]) => `
                <div class="metric-item">
                    <div>${task}</div>
                    <div class="metric-value">${(data.average * 100).toFixed(0)}%</div>
                    <div>Requests: ${data.count}</div>
                </div>
            `).join('')}
        </div>
        <div class="action-row">
            <a class="action-btn" data-command="coding.augmentedIntelligenceProcess">Process Request</a>
            <a class="action-btn" data-command="coding.setAugmentedIntelligenceModel">Configure Models</a>
            <a class="action-btn" data-command="coding.viewAugmentedIntelligenceMetrics">View All Metrics</a>
        </div>
    </div>
    
    <div class="card">
        <h2>🛠️ Quick Dev System</h2>
        <div class="feature-toggle">
            <div>Intelligent development automation</div>
            <button class="toggle-btn ${health.quickDev.status ? '' : 'off'}" 
                    data-feature="quickDev">
                ${health.quickDev.status ? 'Enabled' : 'Disabled'}
            </button>
        </div>
        <div class="action-row">
            <a class="action-btn" data-command="coding.createFileFromTemplate">Create From Template</a>
            <a class="action-btn" data-command="coding.generateCommitMessage">Generate Commit Message</a>
            <a class="action-btn" data-command="coding.analyzeFile">Analyze Current File</a>
        </div>
    </div>
    
    <div class="card">
        <h2>📊 Project Awareness System</h2>
        <div class="feature-toggle">
            <div>Deep project structure analysis</div>
            <button class="toggle-btn ${health.projectAwareness.status ? '' : 'off'}" 
                    data-feature="projectAwareness">
                ${health.projectAwareness.status ? 'Enabled' : 'Disabled'}
            </button>
        </div>
        <div class="metrics-grid">
            <div class="metric-item">
                <div>Project Type</div>
                <div class="metric-value">${health.projectAwareness.projectType || 'Unknown'}</div>
            </div>
            <div class="metric-item">
                <div>Security Issues</div>
                <div class="metric-value">${health.projectAwareness.securityIssuesCount || 0}</div>
            </div>
            <div class="metric-item">
                <div>Performance Issues</div>
                <div class="metric-value">${health.projectAwareness.performanceIssuesCount || 0}</div>
            </div>
        </div>
        <div class="action-row">
            <a class="action-btn" data-command="coding.runProjectAnalysis">Run Analysis</a>
            <a class="action-btn" data-command="coding.showSecurityIssues">Security Issues</a>
            <a class="action-btn" data-command="coding.showPerformanceIssues">Performance Issues</a>
            <a class="action-btn" data-command="coding.visualizeProjectStructure">Visualize Structure</a>
        </div>
    </div>
    
    <div class="card">
        <h2>🎨 Enhanced UI System</h2>
        <div class="feature-toggle">
            <div>Advanced UI enhancements and visualizations</div>
            <button class="toggle-btn ${health.enhancedUI.status ? '' : 'off'}" 
                    data-feature="enhancedUI">
                ${health.enhancedUI.status ? 'Enabled' : 'Disabled'}
            </button>
        </div>
    </div>
    
    <script>
        (function() {
            // Toggle feature buttons
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const feature = btn.dataset.feature;
                    const isCurrentlyEnabled = !btn.classList.contains('off');
                    
                    // Toggle UI state immediately for responsiveness
                    if (isCurrentlyEnabled) {
                        btn.classList.add('off');
                        btn.textContent = 'Disabled';
                    } else {
                        btn.classList.remove('off');
                        btn.textContent = 'Enabled';
                    }
                    
                    // Send message to extension
                    vscode.postMessage({
                        command: 'toggleFeature',
                        feature: feature,
                        enabled: !isCurrentlyEnabled
                    });
                });
            });
            
            // Action buttons
            document.querySelectorAll('.action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const command = btn.dataset.command;
                    if (command) {
                        vscode.postMessage({
                            command: 'executeCommand',
                            vsCommand: command
                        });
                    }
                });
            });
            
            // Acquire VS Code API
            const vscode = acquireVsCodeApi();
        })();
    </script>
</body>
</html>
        `;
        
        // Create and show webview
        const panel = vscode.window.createWebviewPanel(
            'nextGenFeaturesDashboard',
            'NextGen Features Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );
        
        panel.webview.html = htmlContent;
        
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'toggleFeature':
                        this.toggleFeature(message.feature, message.enabled);
                        break;
                    case 'executeCommand':
                        vscode.commands.executeCommand(message.vsCommand);
                        break;
                }
            },
            undefined,
            []
        );
    }
    
    /**
     * Create feature configuration file
     */
    public async createFeatureConfig(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'nextgen-features.json');
        
        // Get current feature status
        const config = {
            features: this.getFeatureStatus(),
            aiModels: {
                codeGeneration: 'llama-3.3-70b-versatile',
                codeExplanation: 'claude-3.5-sonnet',
                errorAnalysis: 'gpt-4-turbo'
            },
            projectAnalysis: {
                runOnStartup: true,
                securityScanEnabled: true,
                performanceScanEnabled: true
            }
        };
        
        // Write config file
        const configContent = JSON.stringify(config, null, 2);
        await vscode.workspace.fs.writeFile(configPath, Buffer.from(configContent));
        
        vscode.window.showInformationMessage('Created NextGen features configuration file');
    }
    
    /**
     * Dispose resources
     */
    public dispose(): void {
        this.statusBarItem.dispose();
    }
}

/**
 * Register commands for NextGen features
 */
export function registerNextGenFeatureCommands(context: vscode.ExtensionContext): void {
    // Register all subsystem commands
    registerAugmentedIntelligenceCommands(context);
    registerQuickDevCommands(context);
    registerAdvancedProjectAwarenessCommands(context);
    
    // Get NextGen features singleton
    const nextGen = NextGenExtensionFeatures.getInstance();
    
    // Show features dashboard
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.showNextGenFeatures', async () => {
            await nextGen.showFeaturesDashboard();
        })
    );
    
    // Create feature configuration
    context.subscriptions.push(
        vscode.commands.registerCommand('coding.createNextGenConfig', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                await nextGen.createFeatureConfig(workspaceFolder);
            } else {
                vscode.window.showErrorMessage('No workspace folder is open');
            }
        })
    );
    
    // Add status bar item to context for disposal
    context.subscriptions.push(nextGen);
}