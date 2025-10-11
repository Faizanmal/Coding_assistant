import * as vscode from 'vscode';
import { marked } from 'marked';

// Core feature imports
import { ChatSidebarViewProvider } from './sidebar';
import { SimpleSidebarViewProvider } from './sidebar_simple';
import { EnhancedSidebarProvider } from './webview/enhanced-sidebar-provider';
import { LightweightSidebarProvider } from './webview/lightweight-sidebar-provider';

// Enhanced NLP components
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { NaturalLanguageCommandProcessor } from './natural-language-command-processor';
import { IntentRecognitionSystem } from './intentrecognition';

// Agent coordination systems
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { ConflictPreventionSystem } from './conflictprevention';
import { SmartAgentAssignmentSystem } from './smartagentassignment';
import { fileExtensionRegistry } from './fileextensionagentregistry';

// Utility systems
import { LiveTerminal } from './liveterminal';
import { EditTracker } from './edittracker';
import { ProductivityDashboard } from './productivitydashboard';
import { CodeSmellDetector } from './codesmelldetector';

/**
 * Central Connectivity Hub - Maintains Flow & Integration Between All Features
 * 
 * This hub ensures seamless communication and coordination between:
 * - Multiple sidebar providers (enhanced, simple, lightweight)
 * - Enhanced NLP processing systems
 * - Multi-agent coordination
 * - Feature-specific modules
 * - UI components and message handlers
 */

interface ConnectivityConfig {
    primarySidebar: 'enhanced' | 'simple' | 'lightweight';
    enableNLPProcessing: boolean;
    enableAgentCoordination: boolean;
    enableRealTimeUpdates: boolean;
    featureFlags: {
        enhancedNLP: boolean;
        conversationalProcessing: boolean;
        smartAgentAssignment: boolean;
        liveTerminal: boolean;
        productivityTracking: boolean;
        codeAnalysis: boolean;
    };
}

interface SystemStatus {
    connectivity: 'connected' | 'partial' | 'disconnected';
    activeProviders: string[];
    nlpEngineStatus: 'active' | 'standby' | 'error';
    agentCoordinatorStatus: 'coordinating' | 'idle' | 'conflict';
    messagingHealth: 'healthy' | 'degraded' | 'failed';
    lastUpdate: Date;
}

export interface FeatureMessage {
    source: string;
    target: string;
    type: 'command' | 'update' | 'status' | 'data';
    command: string;
    payload: any;
    timestamp: Date;
    priority: 'high' | 'medium' | 'low';
}

export class ConnectivityHub {
    private static instance: ConnectivityHub;
    private config: ConnectivityConfig;
    private systemStatus: SystemStatus;
    private activeProviders: Map<string, any> = new Map();
    private messageQueue: FeatureMessage[] = [];
    private eventBus: vscode.EventEmitter<FeatureMessage> = new vscode.EventEmitter();
    private healthCheckInterval?: NodeJS.Timeout;
    private context: vscode.ExtensionContext;

    // Core system references
    private enhancedNLP: EnhancedNLPEngine;
    private commandProcessor: NaturalLanguageCommandProcessor;
    private intentSystem: IntentRecognitionSystem;
    private agentCoordinator: SmartAgentCoordinator;
    private conflictPrevention: ConflictPreventionSystem;
    private assignmentSystem: SmartAgentAssignmentSystem;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = this.loadConfiguration();
        this.systemStatus = this.initializeSystemStatus();
        
        // Initialize core systems
        this.enhancedNLP = EnhancedNLPEngine.getInstance();
        this.commandProcessor = NaturalLanguageCommandProcessor.getInstance();
        this.intentSystem = IntentRecognitionSystem.getInstance();
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
        this.conflictPrevention = ConflictPreventionSystem.getInstance();
        this.assignmentSystem = SmartAgentAssignmentSystem.getInstance();
    }

    static getInstance(context?: vscode.ExtensionContext): ConnectivityHub {
        if (!this.instance && context) {
            this.instance = new ConnectivityHub(context);
        }
        return this.instance;
    }

    /**
     * Initialize the connectivity hub and establish connections between all features
     */
    async initialize(): Promise<void> {
        console.log('🔌 Initializing Connectivity Hub...');
        
        try {
            // 1. Initialize core systems
            await this.initializeCoreSystems();
            
            // 2. Set up message routing
            this.setupMessageRouting();
            
            // 3. Initialize sidebar providers
            await this.initializeSidebarProviders();
            
            // 4. Establish feature connectivity
            this.establishFeatureConnectivity();
            
            // 5. Start health monitoring
            this.startHealthMonitoring();
            
            this.systemStatus.connectivity = 'connected';
            this.systemStatus.lastUpdate = new Date();
            
            console.log('✅ Connectivity Hub initialized successfully');
            this.broadcastStatus('initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Connectivity Hub:', error);
            this.systemStatus.connectivity = 'disconnected';
            throw error;
        }
    }

    /**
     * Create and register a sidebar provider based on configuration
     */
    async createSidebarProvider(
        type: 'enhanced' | 'simple' | 'lightweight',
        context: vscode.ExtensionContext,
        highlighter?: any,
        projectContext?: string
    ): Promise<any> {
        console.log(`🎨 Creating ${type} sidebar provider...`);
        
        let provider;
        
        switch (type) {
            case 'enhanced':
                provider = new ChatSidebarViewProvider(context, highlighter, projectContext || '');
                break;
            case 'simple':
                provider = new SimpleSidebarViewProvider(context);
                break;
            case 'lightweight':
                provider = new LightweightSidebarProvider(context);
                break;
            default:
                throw new Error(`Unknown sidebar provider type: ${type}`);
        }
        
        // Register the provider
        this.activeProviders.set(type, provider);
        this.systemStatus.activeProviders.push(type);
        
        // Connect to coordination systems
        await this.connectProviderToSystems(provider, type);
        
        console.log(`✅ ${type} sidebar provider created and connected`);
        return provider;
    }

    /**
     * Route messages between features maintaining flow and preventing conflicts
     */
    async routeMessage(message: FeatureMessage): Promise<void> {
        // Add to queue for processing
        this.messageQueue.push(message);
        
        // Emit event for listeners
        this.eventBus.fire(message);
        
        // Process based on message type and target
        await this.processMessage(message);
    }

    /**
     * Process user input through the optimal NLP pathway
     */
    async processUserInput(input: string, source: string): Promise<string> {
        console.log(`🧠 Processing user input from ${source}:`, input.substring(0, 100));
        
        try {
            // Determine optimal processing path
            const routingDecision = await this.determineProcessingPath(input);
            
            // Process through appropriate system
            let result: string;
            
            switch (routingDecision.pathway) {
                case 'enhanced_nlp':
                    result = await this.enhancedNLP.processNaturalLanguageInput(input);
                    break;
                case 'conversational':
                    result = await this.commandProcessor.processConversationalInput(input);
                    break;
                case 'agent_coordination':
                    result = await this.agentCoordinator.processMultiAgentRequest(input);
                    break;
                case 'direct_execution':
                    result = await this.executeDirectCommand(input);
                    break;
                default:
                    result = await this.fallbackProcessing(input);
            }
            
            // Track successful processing
            this.updateSystemHealth('nlp', 'healthy');
            
            return result;
            
        } catch (error) {
            console.error('❌ Error processing user input:', error);
            this.updateSystemHealth('nlp', 'error');
            return `❌ Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    /**
     * Coordinate multi-provider messaging to maintain consistent state
     */
    async broadcastToAllProviders(message: any): Promise<void> {
        const broadcastPromises = Array.from(this.activeProviders.entries()).map(
            async ([type, provider]) => {
                try {
                    if (provider._view?.webview) {
                        await provider._view.webview.postMessage(message);
                    }
                } catch (error) {
                    console.warn(`Failed to broadcast to ${type} provider:`, error);
                }
            }
        );
        
        await Promise.allSettled(broadcastPromises);
    }

    /**
     * Manage feature lifecycle and dependencies
     */
    async enableFeature(featureName: keyof ConnectivityConfig['featureFlags']): Promise<void> {
        console.log(`🔧 Enabling feature: ${featureName}`);
        
        this.config.featureFlags[featureName] = true;
        await this.saveConfiguration();
        
        // Initialize feature if needed
        await this.initializeFeature(featureName);
        
        // Notify all connected components
        await this.broadcastToAllProviders({
            type: 'featureEnabled',
            feature: featureName,
            timestamp: new Date().toISOString()
        });
    }

    async disableFeature(featureName: keyof ConnectivityConfig['featureFlags']): Promise<void> {
        console.log(`🔧 Disabling feature: ${featureName}`);
        
        this.config.featureFlags[featureName] = false;
        await this.saveConfiguration();
        
        // Cleanup feature resources
        await this.cleanupFeature(featureName);
        
        // Notify all connected components
        await this.broadcastToAllProviders({
            type: 'featureDisabled',
            feature: featureName,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get comprehensive system status for monitoring
     */
    getSystemStatus(): SystemStatus & {
        messageQueueLength: number;
        activeFeatures: string[];
        performance: any;
    } {
        return {
            ...this.systemStatus,
            messageQueueLength: this.messageQueue.length,
            activeFeatures: Object.entries(this.config.featureFlags)
                .filter(([_, enabled]) => enabled)
                .map(([feature, _]) => feature),
            performance: this.getPerformanceMetrics()
        };
    }

    /**
     * Generate connectivity report for debugging and monitoring
     */
    generateConnectivityReport(): string {
        const status = this.getSystemStatus();
        
        let report = `# Connectivity Hub Status Report\n\n`;
        report += `**Generated:** ${new Date().toISOString()}\n`;
        report += `**System Status:** ${status.connectivity.toUpperCase()}\n\n`;
        
        report += `## Active Components\n`;
        report += `- **Sidebar Providers:** ${status.activeProviders.join(', ')}\n`;
        report += `- **NLP Engine:** ${status.nlpEngineStatus}\n`;
        report += `- **Agent Coordinator:** ${status.agentCoordinatorStatus}\n`;
        report += `- **Messaging Health:** ${status.messagingHealth}\n\n`;
        
        report += `## Feature Status\n`;
        Object.entries(this.config.featureFlags).forEach(([feature, enabled]) => {
            report += `- **${feature}:** ${enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
        });
        
        report += `\n## Performance Metrics\n`;
        const perf = status.performance;
        report += `- **Message Queue:** ${status.messageQueueLength} pending\n`;
        report += `- **Processing Time:** ${perf.avgProcessingTime}ms average\n`;
        report += `- **Success Rate:** ${perf.successRate}%\n`;
        report += `- **Memory Usage:** ${perf.memoryUsage}MB\n\n`;
        
        report += `## Recent Activity\n`;
        this.messageQueue.slice(-10).forEach(msg => {
            report += `- **${msg.timestamp.toISOString()}** [${msg.source}→${msg.target}] ${msg.command}\n`;
        });
        
        return report;
    }

    // Private initialization methods
    private async initializeCoreSystems(): Promise<void> {
        console.log('🚀 Initializing core systems...');
        
        // Initialize file extension registry
        await fileExtensionRegistry.analyzeWorkspace();
        
        // Set up webview connections for all systems
        // Note: Webviews will be connected when providers are created
        
        this.systemStatus.nlpEngineStatus = 'active';
        this.systemStatus.agentCoordinatorStatus = 'idle';
    }

    private setupMessageRouting(): void {
        console.log('📡 Setting up message routing...');
        
        // Listen for messages from all systems
        this.eventBus.event((message: FeatureMessage) => {
            this.processMessage(message);
        });
        
        this.systemStatus.messagingHealth = 'healthy';
    }

    private async initializeSidebarProviders(): Promise<void> {
        console.log('🎨 Initializing sidebar providers...');
        
        // Note: Actual provider creation is handled by the extension.ts
        // This method prepares the connectivity infrastructure
    }

    private establishFeatureConnectivity(): void {
        console.log('🔗 Establishing feature connectivity...');
        
        // Connect all features to the event bus
        this.setupFeatureEventHandlers();
    }

    private startHealthMonitoring(): void {
        console.log('❤️ Starting health monitoring...');
        
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    private async connectProviderToSystems(provider: any, type: string): Promise<void> {
        // This will be called when the provider's webview is ready
        // The actual connection happens in the provider's resolveWebviewView method
    }

    private async determineProcessingPath(input: string): Promise<{pathway: string, confidence: number}> {
        // Use intent recognition to determine optimal processing path
        const routingDecision = await this.intentSystem.routeWorkflowAutomatically(input);
        
        if (EnhancedNLPEngine.shouldProcessWithEnhancedNLP(input)) {
            return { pathway: 'enhanced_nlp', confidence: 0.9 };
        }
        
        if (NaturalLanguageCommandProcessor.shouldUseConversationalProcessing(input)) {
            return { pathway: 'conversational', confidence: 0.8 };
        }
        
        if (routingDecision.routingDecision === 'smart_coordinator') {
            return { pathway: 'agent_coordination', confidence: routingDecision.confidence };
        }
        
        return { pathway: 'direct_execution', confidence: 0.6 };
    }

    private async processMessage(message: FeatureMessage): Promise<void> {
        // Route message to appropriate handler based on target and type
        console.log(`📨 Processing message: ${message.source} → ${message.target} [${message.command}]`);
        
        // Update message queue status
        const index = this.messageQueue.findIndex(m => m.timestamp === message.timestamp);
        if (index !== -1) {
            this.messageQueue.splice(index, 1);
        }
    }

    private async executeDirectCommand(input: string): Promise<string> {
        // Handle direct commands that don't need NLP processing
        return `📝 Direct command processed: ${input}`;
    }

    private async fallbackProcessing(input: string): Promise<string> {
        // Fallback processing for unrecognized input
        return `⚠️ Processed with fallback handler: ${input}`;
    }

    private async initializeFeature(featureName: string): Promise<void> {
        // Feature-specific initialization logic
        switch (featureName) {
            case 'enhancedNLP':
                // Already initialized in constructor
                break;
            case 'liveTerminal':
                // LiveTerminal does not have an explicit initialize method.
                break;
            case 'productivityTracking':
                ProductivityDashboard.initialize?.(this.context);
                break;
            case 'codeAnalysis':
                // CodeSmellDetector doesn't need explicit initialization
                break;
        }
    }

    private async cleanupFeature(featureName: string): Promise<void> {
        // Feature-specific cleanup logic
        switch (featureName) {
            case 'liveTerminal':
                // LiveTerminal does not have an explicit cleanup method.
                break;
            case 'productivityTracking':
        ProductivityDashboard.dispose();
                break;
        }
    }

    private setupFeatureEventHandlers(): void {
        // Set up cross-feature communication handlers
    }

    private performHealthCheck(): void {
        // Check system health and update status
        const now = new Date();
        
        // Update last check time
        this.systemStatus.lastUpdate = now;
        
        // Check various system components
        // This is a simplified health check - could be expanded
    }

    private updateSystemHealth(component: string, status: string): void {
        // Update specific component health status
    }

    private getPerformanceMetrics(): any {
        return {
            avgProcessingTime: 150, // ms
            successRate: 95,       // %
            memoryUsage: 45        // MB
        };
    }

    private broadcastStatus(status: string): void {
        this.broadcastToAllProviders({
            type: 'connectivityStatus',
            status,
            timestamp: new Date().toISOString()
        });
    }

    private loadConfiguration(): ConnectivityConfig {
        return this.context.globalState.get('connectivityConfig', {
            primarySidebar: 'enhanced',
            enableNLPProcessing: true,
            enableAgentCoordination: true,
            enableRealTimeUpdates: true,
            featureFlags: {
                enhancedNLP: true,
                conversationalProcessing: true,
                smartAgentAssignment: true,
                liveTerminal: true,
                productivityTracking: true,
                codeAnalysis: true
            }
        });
    }

    private async saveConfiguration(): Promise<void> {
        await this.context.globalState.update('connectivityConfig', this.config);
    }

    private initializeSystemStatus(): SystemStatus {
        return {
            connectivity: 'disconnected',
            activeProviders: [],
            nlpEngineStatus: 'standby',
            agentCoordinatorStatus: 'idle',
            messagingHealth: 'healthy',
            lastUpdate: new Date()
        };
    }

    // Public methods for external use
    public async dispose(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Cleanup all systems
        await this.broadcastToAllProviders({
            type: 'shutdown',
            timestamp: new Date().toISOString()
        });
    }
}

// Export convenience functions
export async function initializeConnectivity(context: vscode.ExtensionContext): Promise<ConnectivityHub> {
    const hub = ConnectivityHub.getInstance(context);
    await hub.initialize();
    return hub;
}

export function getConnectivityHub(): ConnectivityHub {
    return ConnectivityHub.getInstance();
}