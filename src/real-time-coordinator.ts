import * as vscode from 'vscode';
import { UnifiedActivityDashboard, ActivityData } from './unified-activity-dashboard';
import { AgentTerminalBridge } from './agent-terminal-bridge';
import { LiveChangeVisualizer } from './live-change-visualizer';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { EnhancedShellCommander } from './enhanced-shell-commander';
import { LiveTerminal } from './liveterminal';
import { EditTracker } from './edittracker';

export interface SystemMessage {
    id: string;
    timestamp: number;
    type: 'terminal' | 'agent' | 'file' | 'system' | 'user';
    source: string;
    target?: string;
    action: string;
    payload: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface CoordinatorState {
    isActive: boolean;
    totalSystems: number;
    activeSystems: number;
    messageQueue: SystemMessage[];
    performanceMetrics: {
        messagesPerSecond: number;
        averageResponseTime: number;
        errorRate: number;
        systemLoad: number;
    };
}

export class RealTimeCoordinator {
    private static instance: RealTimeCoordinator;
    private webviewView: vscode.WebviewView | null = null;
    
    // Core system references
    private activityDashboard: UnifiedActivityDashboard;
    private agentBridge: AgentTerminalBridge;
    private changeVisualizer: LiveChangeVisualizer;
    private agentCoordinator: SmartAgentCoordinator;
    
    // Coordination state
    private coordinatorState: CoordinatorState;
    private messageQueue: SystemMessage[] = [];
    private messageHandlers: Map<string, (message: SystemMessage) => Promise<void>> = new Map();
    private broadcastChannels: Map<string, Set<string>> = new Map();
    
    // Performance monitoring
    private performanceInterval: NodeJS.Timeout | null = null;
    private messageStats: {
        processed: number;
        errors: number;
        startTime: number;
    } = {
        processed: 0,
        errors: 0,
        startTime: Date.now()
    };

    private readonly MAX_MESSAGE_QUEUE = 1000;
    private readonly PERFORMANCE_UPDATE_INTERVAL = 2000; // 2 seconds

    private constructor() {
        // Initialize systems first
        this.activityDashboard = UnifiedActivityDashboard.getInstance();
        this.agentBridge = AgentTerminalBridge.getInstance();
        this.changeVisualizer = LiveChangeVisualizer.getInstance();
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
        
        // Then initialize other components  
        this.coordinatorState = this.getInitialState();
        this.setupMessageHandlers();
        this.startPerformanceMonitoring();
    }

    public static getInstance(): RealTimeCoordinator {
        if (!RealTimeCoordinator.instance) {
            RealTimeCoordinator.instance = new RealTimeCoordinator();
        }
        return RealTimeCoordinator.instance;
    }

    public setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
        this.sendInitialState();
        
        // Set webview for all subsystems
        this.activityDashboard.setWebviewView(view);
        this.agentBridge.setWebviewView(view);
        this.changeVisualizer.setWebviewView(view);
        this.agentCoordinator.setWebviewView(view);
    }

    private setupMessageHandlers(): void {
        // Terminal-Agent communication
        this.registerMessageHandler('terminal_request', this.handleTerminalRequest.bind(this));
        this.registerMessageHandler('agent_command', this.handleAgentCommand.bind(this));
        
        // File change notifications
        this.registerMessageHandler('file_changed', this.handleFileChange.bind(this));
        this.registerMessageHandler('agent_file_operation', this.handleAgentFileOperation.bind(this));
        
        // System coordination
        this.registerMessageHandler('system_status', this.handleSystemStatus.bind(this));
        this.registerMessageHandler('broadcast', this.handleBroadcast.bind(this));
        
        // User interactions
        this.registerMessageHandler('user_request', this.handleUserRequest.bind(this));
        this.registerMessageHandler('ui_update', this.handleUIUpdate.bind(this));

        // Setup broadcast channels
        this.setupBroadcastChannels();
    }

    private setupBroadcastChannels(): void {
        // Define which systems should receive which types of messages
        this.broadcastChannels.set('terminal_events', new Set([
            'activity_dashboard', 'change_visualizer', 'agent_coordinator'
        ]));
        
        this.broadcastChannels.set('agent_events', new Set([
            'activity_dashboard', 'terminal_bridge', 'change_visualizer'
        ]));
        
        this.broadcastChannels.set('file_events', new Set([
            'activity_dashboard', 'agent_coordinator', 'terminal_bridge'
        ]));
        
        this.broadcastChannels.set('system_events', new Set([
            'activity_dashboard', 'change_visualizer', 'webview'
        ]));
    }

    private registerMessageHandler(type: string, handler: (message: SystemMessage) => Promise<void>): void {
        this.messageHandlers.set(type, handler);
    }

    /**
     * Core message processing system
     */
    public async sendMessage(message: Omit<SystemMessage, 'id' | 'timestamp' | 'status'>): Promise<string> {
        const fullMessage: SystemMessage = {
            ...message,
            id: this.generateMessageId(),
            timestamp: Date.now(),
            status: 'pending'
        };

        // Add to queue with size limit
        this.messageQueue.unshift(fullMessage);
        if (this.messageQueue.length > this.MAX_MESSAGE_QUEUE) {
            this.messageQueue = this.messageQueue.slice(0, this.MAX_MESSAGE_QUEUE);
        }

        // Process message immediately
        this.processMessage(fullMessage);
        
        return fullMessage.id;
    }

    private async processMessage(message: SystemMessage): Promise<void> {
        try {
            message.status = 'processing';
            this.updateMessageInQueue(message);

            // Handle message based on type
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                await handler(message);
                message.status = 'completed';
                this.messageStats.processed++;
            } else {
                console.warn(`No handler found for message type: ${message.type}`);
                message.status = 'failed';
                this.messageStats.errors++;
            }

            this.updateMessageInQueue(message);
            this.broadcastToSystems(message);

        } catch (error) {
            console.error('Error processing message:', error);
            message.status = 'failed';
            this.messageStats.errors++;
            this.updateMessageInQueue(message);
        }
    }

    private updateMessageInQueue(message: SystemMessage): void {
        const index = this.messageQueue.findIndex(m => m.id === message.id);
        if (index !== -1) {
            this.messageQueue[index] = message;
        }
    }

    private async broadcastToSystems(message: SystemMessage): Promise<void> {
        // Determine which systems should receive this message
        const channelKey = `${message.type}_events`;
        const targetSystems = this.broadcastChannels.get(channelKey);
        
        if (targetSystems) {
            const broadcastPromises = Array.from(targetSystems).map(system => 
                this.sendToSystem(system, message)
            );
            await Promise.allSettled(broadcastPromises);
        }

        // Always send to webview for live updates
        this.sendToWebview(message);
    }

    private async sendToSystem(systemId: string, message: SystemMessage): Promise<void> {
        try {
            switch (systemId) {
                case 'activity_dashboard':
                    const activity: ActivityData = {
                        timestamp: message.timestamp,
                        type: message.type as any,
                        source: message.source,
                        action: message.action,
                        details: this.formatMessageDetails(message),
                        status: message.status as any,
                        metadata: message.payload
                    };
                    this.activityDashboard.logActivity(activity);
                    break;
                    
                case 'change_visualizer':
                    if (message.type === 'file' && message.payload.changeInfo) {
                        // The change visualizer will pick up file changes automatically
                        // through its file watchers
                    }
                    break;
                    
                case 'agent_coordinator':
                    if (message.type === 'agent' && message.payload.operation) {
                        // Agent coordinator will handle this through its own systems
                    }
                    break;
                    
                case 'terminal_bridge':
                    if (message.type === 'terminal' && message.payload.agentRequest) {
                        await this.agentBridge.processAgentRequest(message.payload.agentRequest);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error sending message to ${systemId}:`, error);
        }
    }

    private sendToWebview(message: SystemMessage): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.postMessage({
            type: 'coordinatorMessage',
            data: {
                message,
                coordinatorState: this.coordinatorState,
                queueStatus: {
                    total: this.messageQueue.length,
                    pending: this.messageQueue.filter(m => m.status === 'pending').length,
                    processing: this.messageQueue.filter(m => m.status === 'processing').length,
                    completed: this.messageQueue.filter(m => m.status === 'completed').length,
                    failed: this.messageQueue.filter(m => m.status === 'failed').length
                }
            }
        });
    }

    /**
     * Message handlers for different types
     */
    private async handleTerminalRequest(message: SystemMessage): Promise<void> {
        const { command, agentId, context } = message.payload;
        
        if (agentId) {
            // This is an agent requesting terminal access
            const result = await EnhancedShellCommander.processAgentCommand(
                agentId,
                message.source,
                command,
                context
            );
            
            // Send result back to agent
            await this.sendMessage({
                type: 'agent',
                source: 'terminal_bridge',
                target: agentId,
                action: 'command_result',
                payload: { result, originalCommand: command },
                priority: message.priority
            });
        }
    }

    private async handleAgentCommand(message: SystemMessage): Promise<void> {
        const { operation, fileName, content } = message.payload;
        
        // Log agent activity
        await this.sendMessage({
            type: 'system',
            source: 'coordinator',
            action: 'agent_activity_logged',
            payload: {
                agentId: message.source,
                operation,
                fileName,
                timestamp: Date.now()
            },
            priority: 'medium'
        });
    }

    private async handleFileChange(message: SystemMessage): Promise<void> {
        const { fileName, changeType, agent } = message.payload;
        
        // Notify all interested systems about the file change
        await this.sendMessage({
            type: 'system',
            source: 'coordinator',
            action: 'file_change_broadcast',
            payload: {
                fileName,
                changeType,
                agent,
                timestamp: Date.now()
            },
            priority: 'low'
        });
    }

    private async handleAgentFileOperation(message: SystemMessage): Promise<void> {
        const { agentId, fileName, operation } = message.payload;
        
        // Coordinate with change visualizer to mark changes as agent-made
        if (operation.operationId) {
            this.changeVisualizer.setAgentForChanges(agentId, operation.operationId);
        }
    }

    private async handleSystemStatus(message: SystemMessage): Promise<void> {
        // Update coordinator state based on system status
        this.updateCoordinatorState();
    }

    private async handleBroadcast(message: SystemMessage): Promise<void> {
        // Handle general broadcast messages
        const { channel, data } = message.payload;
        
        if (this.broadcastChannels.has(channel)) {
            const targetSystems = this.broadcastChannels.get(channel)!;
            const broadcastMessage = {
                ...message,
                action: 'broadcast_received',
                payload: data
            };
            
            for (const system of targetSystems) {
                await this.sendToSystem(system, broadcastMessage);
            }
        }
    }

    private async handleUserRequest(message: SystemMessage): Promise<void> {
        const { requestType, data } = message.payload;
        
        switch (requestType) {
            case 'enhanced_terminal':
                const result = await EnhancedShellCommander.executeEnhancedNLPCommand(
                    data.prompt, 
                    data.context
                );
                
                await this.sendMessage({
                    type: 'user',
                    source: 'coordinator',
                    action: 'request_completed',
                    payload: { result, originalRequest: data },
                    priority: 'high'
                });
                break;
                
            case 'agent_coordination':
                const coordResult = await this.agentCoordinator.processMultiAgentRequest(data.prompt);
                
                await this.sendMessage({
                    type: 'user',
                    source: 'coordinator', 
                    action: 'coordination_completed',
                    payload: { result: coordResult, originalRequest: data },
                    priority: 'high'
                });
                break;
        }
    }

    private async handleUIUpdate(message: SystemMessage): Promise<void> {
        // Handle UI-specific updates
        this.sendToWebview(message);
    }

    /**
     * Public API methods
     */
    public async requestEnhancedTerminalCommand(prompt: string, context?: any): Promise<string> {
        const messageId = await this.sendMessage({
            type: 'terminal',
            source: 'user_interface',
            action: 'enhanced_command_request',
            payload: { prompt, context },
            priority: 'high'
        });

        return messageId;
    }

    public async requestAgentCoordination(prompt: string): Promise<string> {
        const messageId = await this.sendMessage({
            type: 'agent',
            source: 'user_interface',
            action: 'coordination_request',
            payload: { prompt },
            priority: 'high'
        });

        return messageId;
    }

    public async notifyFileChange(fileName: string, changeType: string, agent?: string): Promise<void> {
        await this.sendMessage({
            type: 'file',
            source: agent || 'user',
            action: 'file_changed',
            payload: { fileName, changeType, agent },
            priority: 'medium'
        });
    }

    public async notifyAgentActivity(agentId: string, activity: any): Promise<void> {
        await this.sendMessage({
            type: 'agent',
            source: agentId,
            action: 'agent_activity',
            payload: activity,
            priority: 'medium'
        });
    }

    /**
     * State management and monitoring
     */
    private getInitialState(): CoordinatorState {
        return {
            isActive: true,
            totalSystems: 5, // dashboard, bridge, visualizer, coordinator, shell
            activeSystems: 5,
            messageQueue: [],
            performanceMetrics: {
                messagesPerSecond: 0,
                averageResponseTime: 0,
                errorRate: 0,
                systemLoad: 0
            }
        };
    }

    private updateCoordinatorState(): void {
        const runtime = Date.now() - this.messageStats.startTime;
        const runtimeSeconds = runtime / 1000;
        
        this.coordinatorState.performanceMetrics = {
            messagesPerSecond: runtimeSeconds > 0 ? this.messageStats.processed / runtimeSeconds : 0,
            averageResponseTime: 0, // Would need to implement timing
            errorRate: this.messageStats.processed > 0 ? this.messageStats.errors / this.messageStats.processed : 0,
            systemLoad: this.calculateSystemLoad()
        };
        
        this.coordinatorState.messageQueue = this.messageQueue.slice(0, 20); // Last 20 messages
    }

    private calculateSystemLoad(): number {
        const queueLoad = Math.min(this.messageQueue.length / this.MAX_MESSAGE_QUEUE, 1);
        const errorRate = this.coordinatorState.performanceMetrics.errorRate;
        return Math.min((queueLoad * 0.7 + errorRate * 0.3) * 100, 100);
    }

    private startPerformanceMonitoring(): void {
        this.performanceInterval = setInterval(() => {
            this.updateCoordinatorState();
            this.sendPerformanceUpdate();
        }, this.PERFORMANCE_UPDATE_INTERVAL);
    }

    private sendPerformanceUpdate(): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.postMessage({
            type: 'performanceUpdate',
            data: {
                coordinatorState: this.coordinatorState,
                messageStats: this.messageStats
            }
        });
    }

    private sendInitialState(): void {
        if (!this.webviewView) {
            return;
        }

        this.webviewView.webview.postMessage({
            type: 'coordinatorInit',
            data: {
                coordinatorState: this.coordinatorState,
                recentMessages: this.messageQueue.slice(0, 10)
            }
        });
    }

    private formatMessageDetails(message: SystemMessage): string {
        return `${message.action} from ${message.source}${message.target ? ` to ${message.target}` : ''}`;
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public getCoordinatorState(): CoordinatorState {
        return { ...this.coordinatorState };
    }

    public getMessageQueue(): SystemMessage[] {
        return this.messageQueue.slice();
    }

    public clearMessageQueue(): void {
        this.messageQueue = [];
        this.messageStats = {
            processed: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    public dispose(): void {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
        }
        
        this.messageHandlers.clear();
        this.broadcastChannels.clear();
        this.messageQueue = [];
    }
}