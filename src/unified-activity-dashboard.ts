import * as vscode from 'vscode';
import { LiveTerminal } from './liveterminal';
import { EditTracker } from './edittracker';
import { SmartAgentCoordinator } from './smartagentcoordinator';

export interface ActivityData {
    timestamp: number;
    type: 'terminal' | 'agent' | 'file' | 'system';
    source: string;
    action: string;
    details: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    metadata?: any;
}

export interface DashboardState {
    terminal: {
        status: 'idle' | 'running' | 'error';
        activeCommands: number;
        sessions: Array<{
            id: string;
            name: string;
            status: string;
            lastCommand?: string;
        }>;
    };
    agents: {
        active: number;
        working: Array<{
            id: string;
            name: string;
            task: string;
            progress: number;
        }>;
        idle: number;
    };
    files: {
        modified: number;
        created: number;
        linesAdded: number;
        linesRemoved: number;
        recentChanges: Array<{
            fileName: string;
            action: 'added' | 'removed' | 'modified' | 'created';
            linesChanged: number;
            timestamp: number;
        }>;
    };
    system: {
        uptime: number;
        totalOperations: number;
        errorCount: number;
        performance: number;
    };
}

export class UnifiedActivityDashboard {
    private static instance: UnifiedActivityDashboard;
    private webviewView: vscode.WebviewView | null = null;
    private activityLog: ActivityData[] = [];
    private dashboardState: DashboardState;
    private updateInterval: NodeJS.Timeout | null = null;
    private readonly MAX_LOG_ENTRIES = 1000;
    private readonly UPDATE_FREQUENCY = 500; // 500ms for smooth updates

    private constructor() {
        this.dashboardState = this.getInitialState();
        this.startPeriodicUpdates();
    }

    public static getInstance(): UnifiedActivityDashboard {
        if (!UnifiedActivityDashboard.instance) {
            UnifiedActivityDashboard.instance = new UnifiedActivityDashboard();
        }
        return UnifiedActivityDashboard.instance;
    }

    public setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
        this.sendInitialState();
    }

    public logActivity(activity: ActivityData): void {
        activity.timestamp = Date.now();
        
        // Add to log with size management
        this.activityLog.unshift(activity);
        if (this.activityLog.length > this.MAX_LOG_ENTRIES) {
            this.activityLog = this.activityLog.slice(0, this.MAX_LOG_ENTRIES);
        }

        // Update dashboard state based on activity
        this.updateStateFromActivity(activity);
        
        // Send real-time update to webview
        this.sendActivityUpdate(activity);
    }

    private getInitialState(): DashboardState {
        return {
            terminal: {
                status: 'idle',
                activeCommands: 0,
                sessions: []
            },
            agents: {
                active: 0,
                working: [],
                idle: 0
            },
            files: {
                modified: 0,
                created: 0,
                linesAdded: 0,
                linesRemoved: 0,
                recentChanges: []
            },
            system: {
                uptime: Date.now(),
                totalOperations: 0,
                errorCount: 0,
                performance: 100
            }
        };
    }

    private updateStateFromActivity(activity: ActivityData): void {
        switch (activity.type) {
            case 'terminal':
                this.updateTerminalState(activity);
                break;
            case 'agent':
                this.updateAgentState(activity);
                break;
            case 'file':
                this.updateFileState(activity);
                break;
            case 'system':
                this.updateSystemState(activity);
                break;
        }
        
        this.dashboardState.system.totalOperations++;
        if (activity.status === 'error') {
            this.dashboardState.system.errorCount++;
        }
    }

    private updateTerminalState(activity: ActivityData): void {
        const terminalStatus = LiveTerminal.getTerminalStatus();
        this.dashboardState.terminal = {
            status: terminalStatus.status,
            activeCommands: terminalStatus.runningCommands,
            sessions: terminalStatus.activeSessions.map(session => ({
                id: session.id,
                name: session.name,
                status: session.status,
                lastCommand: session.lastCommand
            }))
        };
    }

    private updateAgentState(activity: ActivityData): void {
        const coordinator = SmartAgentCoordinator.getInstance();
        const agentStatus = coordinator.getAgentStatus();
        const activeOps = coordinator.getActiveOperations();
        
        const workingAgents = Array.from(agentStatus.entries())
            .filter(([_, agent]) => agent.status === 'working')
            .map(([id, agent]) => ({
                id,
                name: agent.name,
                task: agent.currentTask || 'Unknown task',
                progress: this.calculateAgentProgress(id, activeOps)
            }));

        this.dashboardState.agents = {
            active: workingAgents.length,
            working: workingAgents,
            idle: agentStatus.size - workingAgents.length
        };
    }

    private updateFileState(activity: ActivityData): void {
        if (activity.metadata) {
            switch (activity.action) {
                case 'created':
                    this.dashboardState.files.created++;
                    break;
                case 'modified':
                    this.dashboardState.files.modified++;
                    break;
            }

            if (activity.metadata.linesAdded) {
                this.dashboardState.files.linesAdded += activity.metadata.linesAdded;
            }
            if (activity.metadata.linesRemoved) {
                this.dashboardState.files.linesRemoved += activity.metadata.linesRemoved;
            }

            // Update recent changes
            this.dashboardState.files.recentChanges.unshift({
                fileName: activity.metadata.fileName || activity.source,
                action: activity.action as 'added' | 'removed' | 'modified' | 'created',
                linesChanged: (activity.metadata.linesAdded || 0) + (activity.metadata.linesRemoved || 0),
                timestamp: activity.timestamp
            });

            // Keep only recent changes (last 10)
            if (this.dashboardState.files.recentChanges.length > 10) {
                this.dashboardState.files.recentChanges = this.dashboardState.files.recentChanges.slice(0, 10);
            }
        }
    }

    private updateSystemState(activity: ActivityData): void {
        // Calculate performance based on success rate
        const recentActivities = this.activityLog.slice(0, 50); // Last 50 activities
        const errorCount = recentActivities.filter(a => a.status === 'error').length;
        this.dashboardState.system.performance = Math.max(0, 100 - (errorCount * 2));
    }

    private calculateAgentProgress(agentId: string, activeOps: Map<string, any>): number {
        // Simple progress calculation based on active operations
        const agentOps = Array.from(activeOps.values())
            .filter(op => op.assignedAgent === agentId);
        
        if (agentOps.length === 0) {
            return 100;
        }
        
        const completedOps = agentOps.filter(op => op.status === 'completed').length;
        return Math.round((completedOps / agentOps.length) * 100);
    }

    private startPeriodicUpdates(): void {
        this.updateInterval = setInterval(() => {
            this.refreshDashboardState();
        }, this.UPDATE_FREQUENCY);
    }

    private refreshDashboardState(): void {
        if (!this.webviewView) {
            return;
        }

        // Get fresh data from all systems
        const terminalStatus = LiveTerminal.getTerminalStatus();
        const coordinator = SmartAgentCoordinator.getInstance();
        
        // Update state
        this.dashboardState.terminal.status = terminalStatus.status;
        this.dashboardState.terminal.activeCommands = terminalStatus.runningCommands;
        
        // Send updated state to webview
        this.sendStateUpdate();
    }

    private sendInitialState(): void {
        if (!this.webviewView) {
            return;
        }
        
        this.webviewView.webview.postMessage({
            type: 'dashboardInit',
            data: {
                state: this.dashboardState,
                recentActivities: this.activityLog.slice(0, 20)
            }
        });
    }

    private sendActivityUpdate(activity: ActivityData): void {
        if (!this.webviewView) {
            return;
        }
        
        this.webviewView.webview.postMessage({
            type: 'activityUpdate',
            data: {
                activity,
                updatedState: this.dashboardState
            }
        });
    }

    private sendStateUpdate(): void {
        if (!this.webviewView) {
            return;
        }
        
        this.webviewView.webview.postMessage({
            type: 'stateUpdate',
            data: this.dashboardState
        });
    }

    public getActivityLog(): ActivityData[] {
        return this.activityLog.slice();
    }

    public getDashboardState(): DashboardState {
        return { ...this.dashboardState };
    }

    public clearActivityLog(): void {
        this.activityLog = [];
        this.dashboardState = this.getInitialState();
        this.sendStateUpdate();
    }

    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}