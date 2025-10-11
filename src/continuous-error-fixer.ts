import * as vscode from 'vscode';
import { LoopingAgent } from './looping-agent';
import { ReplacingAgent } from './replacing-agent';
import { AgentCoordinator } from './agent-coordinator';
import { SidebarChatMessenger } from './sidebar-chat-messenger';

/**
 * Continuous Error Fixer System
 * 
 * This system continuously monitors the workspace for coding issues and automatically fixes them.
 * It uses VS Code's diagnostic API to detect errors and coordinates between Looping and Replacing agents.
 */
export class ContinuousErrorFixer {
    private isRunning: boolean = false;
    private loopingAgents: Map<string, LoopingAgent> = new Map();
    private replacingAgents: Map<string, ReplacingAgent> = new Map();
    private coordinator: AgentCoordinator;
    private messenger: SidebarChatMessenger;
    private diagnosticsListener: vscode.Disposable | null = null;
    private loopInterval: NodeJS.Timeout | null = null;
    private statusBarItem: vscode.StatusBarItem;
    private errorQueue: Map<string, vscode.Diagnostic[]> = new Map();

    constructor(
        private context: vscode.ExtensionContext,
        private chatPanel?: any
    ) {
        this.coordinator = new AgentCoordinator();
        this.messenger = new SidebarChatMessenger(chatPanel);
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'coding-assistant.toggleContinuousFixer';
        this.updateStatusBar();
    }

    /**
     * Start the continuous error fixing loop
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            vscode.window.showWarningMessage('Continuous Error Fixer is already running');
            return;
        }

        this.isRunning = true;
        this.updateStatusBar();
        this.statusBarItem.show();

        await this.messenger.sendMessage('🚀 **Continuous Error Fixer Started**', 'system');
        await this.messenger.sendMessage('Scanning workspace for errors...', 'info');

        // Listen to diagnostic changes
        this.setupDiagnosticsListener();

        // Initial scan
        await this.scanWorkspace();

        // Start the main loop
        this.startMainLoop();

        vscode.window.showInformationMessage('Continuous Error Fixer is now active');
    }

    /**
     * Stop the continuous error fixing loop
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) {
            vscode.window.showWarningMessage('Continuous Error Fixer is not running');
            return;
        }

        this.isRunning = false;
        this.updateStatusBar();

        // Clean up listeners and intervals
        if (this.diagnosticsListener) {
            this.diagnosticsListener.dispose();
            this.diagnosticsListener = null;
        }

        if (this.loopInterval) {
            clearInterval(this.loopInterval);
            this.loopInterval = null;
        }

        // Stop all agents
        await this.stopAllAgents();

        await this.messenger.sendMessage('🛑 **Continuous Error Fixer Stopped**', 'system');
        vscode.window.showInformationMessage('Continuous Error Fixer has been stopped');
    }

    /**
     * Toggle the continuous error fixer on/off
     */
    public async toggle(): Promise<void> {
        if (this.isRunning) {
            await this.stop();
        } else {
            await this.start();
        }
    }

    /**
     * Setup diagnostics listener for real-time error detection
     */
    private setupDiagnosticsListener(): void {
        this.diagnosticsListener = vscode.languages.onDidChangeDiagnostics(async (event) => {
            if (!this.isRunning) {
                return;
            }

            for (const uri of event.uris) {
                const diagnostics = vscode.languages.getDiagnostics(uri);
                const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                
                if (errors.length > 0) {
                    this.errorQueue.set(uri.fsPath, errors);
                    await this.messenger.sendMessage(
                        `🔍 Detected ${errors.length} error(s) in \`${vscode.workspace.asRelativePath(uri)}\``,
                        'info'
                    );
                }
            }
        });
    }

    /**
     * Scan the entire workspace for errors using VS Code diagnostics
     */
    private async scanWorkspace(): Promise<void> {
        const allDiagnostics = vscode.languages.getDiagnostics();
        let totalErrors = 0;

        for (const [uri, diagnostics] of allDiagnostics) {
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            
            if (errors.length > 0) {
                this.errorQueue.set(uri.fsPath, errors);
                totalErrors += errors.length;
            }
        }

        if (totalErrors > 0) {
            await this.messenger.sendMessage(
                `📊 Found ${totalErrors} total error(s) across ${this.errorQueue.size} file(s)`,
                'info'
            );
        } else {
            await this.messenger.sendMessage('✅ No errors detected in workspace', 'success');
        }
    }

    /**
     * Start the main processing loop
     */
    private startMainLoop(): void {
        // Process errors every 5 seconds
        this.loopInterval = setInterval(async () => {
            if (!this.isRunning || this.errorQueue.size === 0) {
                return;
            }

            await this.processErrorQueue();
        }, 5000);
    }

    /**
     * Process errors from the queue
     */
    private async processErrorQueue(): Promise<void> {
        const entries = Array.from(this.errorQueue.entries());
        
        for (const [filePath, diagnostics] of entries) {
            if (!this.isRunning) {
                break;
            }

            // Create or get a looping agent for this file
            const agentId = this.getAgentIdForFile(filePath);
            
            if (!this.loopingAgents.has(agentId)) {
                const loopingAgent = new LoopingAgent(agentId, filePath, this.messenger);
                this.loopingAgents.set(agentId, loopingAgent);
                
                await this.messenger.sendMessage(
                    `🤖 Looping Agent activated for \`${vscode.workspace.asRelativePath(filePath)}\``,
                    'info'
                );
            }

            const loopingAgent = this.loopingAgents.get(agentId)!;
            
            // Analyze errors and generate fixes
            const fixes = await loopingAgent.analyzeDiagnostics(diagnostics);
            
            if (fixes.length > 0) {
                // Request replacing agent to apply fixes
                await this.requestReplacingAgent(filePath, fixes);
            }

            // Remove from queue after processing
            this.errorQueue.delete(filePath);
        }
    }

    /**
     * Request a replacing agent to apply fixes
     */
    private async requestReplacingAgent(filePath: string, fixes: any[]): Promise<void> {
        const agentId = this.getAgentIdForFile(filePath);
        
        if (!this.replacingAgents.has(agentId)) {
            const replacingAgent = new ReplacingAgent(agentId, filePath, this.messenger);
            this.replacingAgents.set(agentId, replacingAgent);
            
            await this.messenger.sendMessage(
                `🔧 Replacing Agent activated for \`${vscode.workspace.asRelativePath(filePath)}\``,
                'info'
            );
        }

        const replacingAgent = this.replacingAgents.get(agentId)!;
        
        // Coordinate with the coordinator to ensure no conflicts
        const canProceed = await this.coordinator.requestFileAccess(agentId, filePath);
        
        if (canProceed) {
            try {
                await replacingAgent.applyFixes(fixes);
                await this.coordinator.releaseFileAccess(agentId, filePath);
            } catch (error) {
                await this.coordinator.releaseFileAccess(agentId, filePath);
                throw error;
            }
        } else {
            await this.messenger.sendMessage(
                `⏳ Waiting for file access: \`${vscode.workspace.asRelativePath(filePath)}\``,
                'warning'
            );
        }
    }

    /**
     * Generate a unique agent ID for a file
     */
    private getAgentIdForFile(filePath: string): string {
        return `agent_${Buffer.from(filePath).toString('base64').substring(0, 16)}`;
    }

    /**
     * Stop all running agents
     */
    private async stopAllAgents(): Promise<void> {
        for (const [id, agent] of this.loopingAgents) {
            agent.stop();
        }
        this.loopingAgents.clear();

        for (const [id, agent] of this.replacingAgents) {
            agent.stop();
        }
        this.replacingAgents.clear();

        this.errorQueue.clear();
    }

    /**
     * Update status bar display
     */
    private updateStatusBar(): void {
        if (this.isRunning) {
            this.statusBarItem.text = '$(sync~spin) Error Fixer Active';
            this.statusBarItem.tooltip = 'Continuous Error Fixer is running. Click to stop.';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.text = '$(bug) Error Fixer Off';
            this.statusBarItem.tooltip = 'Continuous Error Fixer is stopped. Click to start.';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    /**
     * Get current status
     */
    public getStatus(): {
        isRunning: boolean;
        activeLoopingAgents: number;
        activeReplacingAgents: number;
        queuedErrors: number;
    } {
        return {
            isRunning: this.isRunning,
            activeLoopingAgents: this.loopingAgents.size,
            activeReplacingAgents: this.replacingAgents.size,
            queuedErrors: this.errorQueue.size
        };
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.isRunning) {
            this.stop();
        }
        this.statusBarItem.dispose();
    }
}
