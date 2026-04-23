import * as vscode from 'vscode';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Enterprise Analytics and Telemetry System
 * Comprehensive usage tracking, performance monitoring, and business intelligence
 */

export interface AnalyticsEvent {
    id: string;
    timestamp: Date;
    userId: string;
    sessionId: string;
    eventType: string;
    category: 'user_action' | 'system_performance' | 'error' | 'feature_usage' | 'business_metric';
    data: Record<string, any>;
    context: {
        workspace: string;
        extension_version: string;
        vscode_version: string;
        platform: string;
        language: string;
        project_type?: string;
    };
    metadata: {
        duration_ms?: number;
        error_code?: string;
        feature_flags?: string[];
        user_cohort?: string;
        experiment_id?: string;
    };
}

export interface PerformanceMetric {
    id: string;
    timestamp: Date;
    metric_name: string;
    value: number;
    unit: string;
    tags: Record<string, string>;
    threshold?: {
        warning: number;
        critical: number;
    };
}

export interface UserBehavior {
    userId: string;
    sessionStart: Date;
    sessionEnd?: Date;
    actions: AnalyticsEvent[];
    features_used: string[];
    errors_encountered: number;
    productivity_score: number;
    engagement_score: number;
}

export interface ABTestExperiment {
    id: string;
    name: string;
    description: string;
    start_date: Date;
    end_date: Date;
    variants: {
        id: string;
        name: string;
        percentage: number;
        config: Record<string, any>;
    }[];
    metrics: string[];
    status: 'draft' | 'running' | 'completed' | 'paused';
}

export interface BusinessMetrics {
    daily_active_users: number;
    monthly_active_users: number;
    feature_adoption_rate: Record<string, number>;
    user_retention: {
        day_1: number;
        day_7: number;
        day_30: number;
    };
    performance_scores: {
        average_response_time: number;
        error_rate: number;
        user_satisfaction: number;
    };
    revenue_metrics?: {
        conversion_rate: number;
        average_revenue_per_user: number;
        churn_rate: number;
    };
}

export class EnterpriseAnalyticsSystem {
    private events: AnalyticsEvent[] = [];
    private performanceMetrics: PerformanceMetric[] = [];
    private userBehaviors: Map<string, UserBehavior> = new Map();
    private experiments: Map<string, ABTestExperiment> = new Map();
    private sessionId: string;
    private userId: string;
    private context: vscode.ExtensionContext;
    private performanceObserver?: any;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sessionId = crypto.randomUUID();
        this.userId = this.getUserId();
        this.initializePerformanceMonitoring();
        this.initializeABTesting();
        this.startSessionTracking();
    }

    /**
     * Get or create user ID
     */
    private getUserId(): string {
        let userId = this.context.globalState.get('analytics_user_id') as string;
        if (!userId) {
            userId = crypto.randomUUID();
            this.context.globalState.update('analytics_user_id', userId);
        }
        return userId;
    }

    /**
     * Track user event
     */
    async trackEvent(
        eventType: string,
        category: AnalyticsEvent['category'],
        data: Record<string, any> = {},
        metadata: AnalyticsEvent['metadata'] = {}
    ): Promise<void> {
        const event: AnalyticsEvent = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            userId: this.userId,
            sessionId: this.sessionId,
            eventType,
            category,
            data,
            context: {
                workspace: vscode.workspace.workspaceFolders?.[0]?.name || 'unknown',
                extension_version: this.context.extension.packageJSON.version,
                vscode_version: vscode.version,
                platform: os.platform(),
                language: vscode.window.activeTextEditor?.document.languageId || 'unknown',
                project_type: await this.detectProjectType()
            },
            metadata
        };

        this.events.push(event);
        await this.storeEvent(event);

        // Update user behavior
        this.updateUserBehavior(event);

        // Real-time alerting for critical events
        if (category === 'error' && data.severity === 'critical') {
            await this.sendAlert(event);
        }
    }

    /**
     * Track performance metric
     */
    async trackPerformance(
        metricName: string,
        value: number,
        unit: string,
        tags: Record<string, string> = {},
        threshold?: { warning: number; critical: number }
    ): Promise<void> {
        const metric: PerformanceMetric = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            metric_name: metricName,
            value,
            unit,
            tags,
            threshold
        };

        this.performanceMetrics.push(metric);

        // Check thresholds
        if (threshold) {
            if (value >= threshold.critical) {
                await this.trackEvent('performance_threshold_critical', 'system_performance', {
                    metric: metricName,
                    value,
                    threshold: threshold.critical
                });
            } else if (value >= threshold.warning) {
                await this.trackEvent('performance_threshold_warning', 'system_performance', {
                    metric: metricName,
                    value,
                    threshold: threshold.warning
                });
            }
        }
    }

    /**
     * Initialize performance monitoring
     */
    private initializePerformanceMonitoring(): void {
        // Monitor VS Code performance
        const startTime = Date.now();

        // Track extension activation time
        this.trackPerformance('extension_activation_time', Date.now() - startTime, 'ms', {
            type: 'activation'
        }, { warning: 1000, critical: 3000 });

        // Monitor memory usage
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.trackPerformance('memory_heap_used', memUsage.heapUsed / 1024 / 1024, 'MB', {
                type: 'memory'
            }, { warning: 100, critical: 200 });

            this.trackPerformance('memory_heap_total', memUsage.heapTotal / 1024 / 1024, 'MB', {
                type: 'memory'
            });
        }, 30000); // Every 30 seconds

        // Track command execution times
        vscode.commands.registerCommand = ((originalRegister) => {
            return (command: string, callback: (...args: any[]) => any) => {
                const wrappedCallback = async (...args: any[]) => {
                    const start = Date.now();
                    try {
                        const result = await callback(...args);
                        const duration = Date.now() - start;
                        
                        await this.trackPerformance('command_execution_time', duration, 'ms', {
                            command,
                            success: 'true'
                        }, { warning: 5000, critical: 10000 });

                        await this.trackEvent('command_executed', 'user_action', {
                            command,
                            duration,
                            args_count: args.length
                        });

                        return result;
                    } catch (error) {
                        const duration = Date.now() - start;
                        
                        await this.trackPerformance('command_execution_time', duration, 'ms', {
                            command,
                            success: 'false'
                        });

                        await this.trackEvent('command_error', 'error', {
                            command,
                            error: error.message,
                            duration
                        });

                        throw error;
                    }
                };

                return originalRegister.call(vscode.commands, command, wrappedCallback);
            };
        })(vscode.commands.registerCommand);
    }

    /**
     * Initialize A/B testing framework
     */
    private initializeABTesting(): void {
        // Sample experiments
        const experiments: ABTestExperiment[] = [
            {
                id: 'ui_theme_test',
                name: 'UI Theme Optimization',
                description: 'Test different UI themes for better user experience',
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                variants: [
                    { id: 'control', name: 'Current Theme', percentage: 50, config: { theme: 'current' } },
                    { id: 'variant_a', name: 'Enhanced Theme', percentage: 50, config: { theme: 'enhanced' } }
                ],
                metrics: ['user_engagement', 'feature_usage', 'error_rate'],
                status: 'running'
            },
            {
                id: 'ai_suggestions_test',
                name: 'AI Suggestions Algorithm',
                description: 'Test different AI suggestion algorithms',
                start_date: new Date(),
                end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                variants: [
                    { id: 'control', name: 'Current Algorithm', percentage: 70, config: { algorithm: 'v1' } },
                    { id: 'variant_a', name: 'Enhanced Algorithm', percentage: 30, config: { algorithm: 'v2' } }
                ],
                metrics: ['suggestion_acceptance_rate', 'user_satisfaction', 'productivity_score'],
                status: 'running'
            }
        ];

        experiments.forEach(exp => this.experiments.set(exp.id, exp));
    }

    /**
     * Get user's experiment variant
     */
    getUserVariant(experimentId: string): string | null {
        const experiment = this.experiments.get(experimentId);
        if (!experiment || experiment.status !== 'running') {
            return null;
        }

        // Use consistent hashing based on user ID
        const hash = crypto.createHash('md5').update(this.userId + experimentId).digest('hex');
        const hashValue = parseInt(hash.substring(0, 8), 16) % 100;

        let cumulative = 0;
        for (const variant of experiment.variants) {
            cumulative += variant.percentage;
            if (hashValue < cumulative) {
                return variant.id;
            }
        }

        return 'control';
    }

    /**
     * Track experiment metric
     */
    async trackExperimentMetric(
        experimentId: string,
        metricName: string,
        value: number,
        additionalData: Record<string, any> = {}
    ): Promise<void> {
        const variant = this.getUserVariant(experimentId);
        if (!variant) {
            return;
        }

        await this.trackEvent('experiment_metric', 'business_metric', {
            experiment_id: experimentId,
            variant,
            metric_name: metricName,
            value,
            ...additionalData
        }, {
            experiment_id: experimentId
        });
    }

    /**
     * Update user behavior tracking
     */
    private updateUserBehavior(event: AnalyticsEvent): void {
        let behavior = this.userBehaviors.get(this.userId);
        
        if (!behavior) {
            behavior = {
                userId: this.userId,
                sessionStart: new Date(),
                actions: [],
                features_used: [],
                errors_encountered: 0,
                productivity_score: 100,
                engagement_score: 0
            };
            this.userBehaviors.set(this.userId, behavior);
        }

        behavior.actions.push(event);

        // Track feature usage
        if (event.category === 'user_action' && !behavior.features_used.includes(event.eventType)) {
            behavior.features_used.push(event.eventType);
        }

        // Track errors
        if (event.category === 'error') {
            behavior.errors_encountered++;
            behavior.productivity_score -= 5;
        }

        // Update engagement score
        behavior.engagement_score = this.calculateEngagementScore(behavior);
    }

    /**
     * Calculate user engagement score
     */
    private calculateEngagementScore(behavior: UserBehavior): number {
        const sessionDuration = behavior.sessionEnd 
            ? behavior.sessionEnd.getTime() - behavior.sessionStart.getTime()
            : Date.now() - behavior.sessionStart.getTime();

        const minutesActive = sessionDuration / (1000 * 60);
        const actionsPerMinute = behavior.actions.length / Math.max(minutesActive, 1);
        const uniqueFeatures = behavior.features_used.length;
        const errorPenalty = behavior.errors_encountered * 5;

        // Engagement formula (0-100 scale)
        return Math.min(100, Math.max(0, 
            (actionsPerMinute * 10) + 
            (uniqueFeatures * 5) + 
            (minutesActive > 30 ? 20 : minutesActive / 1.5) - 
            errorPenalty
        ));
    }

    /**
     * Generate business metrics
     */
    async generateBusinessMetrics(): Promise<BusinessMetrics> {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Daily and monthly active users
        const dailyActiveUsers = new Set(
            this.events
                .filter(e => e.timestamp >= dayAgo)
                .map(e => e.userId)
        ).size;

        const monthlyActiveUsers = new Set(
            this.events
                .filter(e => e.timestamp >= monthAgo)
                .map(e => e.userId)
        ).size;

        // Feature adoption rates
        const featureEvents = this.events.filter(e => e.category === 'feature_usage');
        const totalUsers = this.userBehaviors.size;
        const featureAdoption: Record<string, number> = {};

        featureEvents.forEach(event => {
            const feature = event.eventType;
            if (!featureAdoption[feature]) {
                featureAdoption[feature] = 0;
            }
        });

        // Calculate adoption rates
        Object.keys(featureAdoption).forEach(feature => {
            const usersUsingFeature = new Set(
                featureEvents
                    .filter(e => e.eventType === feature)
                    .map(e => e.userId)
            ).size;
            featureAdoption[feature] = totalUsers > 0 ? (usersUsingFeature / totalUsers) * 100 : 0;
        });

        // Performance scores
        const responseTimeMetrics = this.performanceMetrics.filter(m => m.metric_name === 'command_execution_time');
        const avgResponseTime = responseTimeMetrics.length > 0
            ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
            : 0;

        const errorEvents = this.events.filter(e => e.category === 'error');
        const errorRate = this.events.length > 0 ? (errorEvents.length / this.events.length) * 100 : 0;

        // User satisfaction (based on engagement scores)
        const userSatisfaction = Array.from(this.userBehaviors.values())
            .reduce((sum, behavior) => sum + behavior.engagement_score, 0) / Math.max(totalUsers, 1);

        return {
            daily_active_users: dailyActiveUsers,
            monthly_active_users: monthlyActiveUsers,
            feature_adoption_rate: featureAdoption,
            user_retention: {
                day_1: 85, // Mock data - would need proper retention calculation
                day_7: 60,
                day_30: 40
            },
            performance_scores: {
                average_response_time: avgResponseTime,
                error_rate: errorRate,
                user_satisfaction: userSatisfaction
            }
        };
    }

    /**
     * Show analytics dashboard
     */
    async showAnalyticsDashboard(): Promise<void> {
        const metrics = await this.generateBusinessMetrics();
        const recentEvents = this.events.slice(-100);
        const topFeatures = Object.entries(metrics.feature_adoption_rate)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        const panel = vscode.window.createWebviewPanel(
            'analyticsDashboard',
            'Enterprise Analytics Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateAnalyticsDashboardHTML(metrics, recentEvents, topFeatures);
    }

    /**
     * Generate analytics dashboard HTML
     */
    private generateAnalyticsDashboardHTML(
        metrics: BusinessMetrics,
        recentEvents: AnalyticsEvent[],
        topFeatures: [string, number][]
    ): string {
        return `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #4CAF50;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #4CAF50;
        }
        .metric-label {
            font-size: 14px;
            color: #cccccc;
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #4CAF50;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #4CAF50;
        }
        .chart-placeholder {
            height: 200px;
            background: #1e1e1e;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            margin: 20px 0;
        }
        .feature-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
        }
        .feature-item {
            background: #2d2d30;
            padding: 15px;
            border-radius: 4px;
            border-left: 3px solid #4CAF50;
        }
        .adoption-rate {
            font-size: 18px;
            font-weight: bold;
            color: #4CAF50;
        }
        .event-item {
            background: #2d2d30;
            padding: 10px;
            margin-bottom: 5px;
            border-radius: 4px;
            font-size: 12px;
        }
        .event-timestamp {
            color: #888;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Enterprise Analytics Dashboard</h1>
        <p>Real-time insights and business intelligence</p>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-value">${metrics.daily_active_users}</div>
            <div class="metric-label">Daily Active Users</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.monthly_active_users}</div>
            <div class="metric-label">Monthly Active Users</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.performance_scores.average_response_time.toFixed(0)}ms</div>
            <div class="metric-label">Avg Response Time</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.performance_scores.error_rate.toFixed(1)}%</div>
            <div class="metric-label">Error Rate</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.performance_scores.user_satisfaction.toFixed(0)}</div>
            <div class="metric-label">User Satisfaction</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${metrics.user_retention.day_1}%</div>
            <div class="metric-label">Day 1 Retention</div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Usage Trends</h2>
        <div class="chart-placeholder">
            [Interactive Chart: User Activity Over Time]
        </div>
    </div>

    <div class="section">
        <h2>🚀 Feature Adoption</h2>
        <div class="feature-list">
            ${topFeatures.map(([feature, rate]) => `
                <div class="feature-item">
                    <div style="font-weight: bold;">${feature.replace(/_/g, ' ')}</div>
                    <div class="adoption-rate">${rate.toFixed(1)}%</div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>🎯 A/B Test Results</h2>
        <div class="chart-placeholder">
            [Interactive Chart: Experiment Performance]
        </div>
    </div>

    <div class="section">
        <h2>📋 Recent Events</h2>
        ${recentEvents.slice(0, 20).map(event => `
            <div class="event-item">
                <strong>${event.eventType}</strong> - ${event.category}
                <div class="event-timestamp">${event.timestamp.toLocaleString()}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }

    /**
     * Start session tracking
     */
    private startSessionTracking(): void {
        this.trackEvent('session_start', 'user_action', {
            platform: os.platform(),
            vscode_version: vscode.version
        });

        // Track session end on extension deactivation
        this.context.subscriptions.push({
            dispose: () => {
                this.trackEvent('session_end', 'user_action', {
                    session_duration: Date.now() - new Date(this.sessionId).getTime()
                });
            }
        });
    }

    /**
     * Detect project type
     */
    private async detectProjectType(): Promise<string | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return undefined;
        }

        try {
            const files = await vscode.workspace.findFiles('package.json');
            if (files.length > 0) {
                return 'nodejs';
            }

            const pythonFiles = await vscode.workspace.findFiles('requirements.txt');
            if (pythonFiles.length > 0) {
                return 'python';
            }

            const javaFiles = await vscode.workspace.findFiles('pom.xml');
            if (javaFiles.length > 0) {
                return 'java';
            }

            return 'unknown';
        } catch {
            return undefined;
        }
    }

    /**
     * Store event (in production, this would send to analytics service)
     */
    private async storeEvent(event: AnalyticsEvent): Promise<void> {
        // In production, send to analytics service (e.g., Mixpanel, Amplitude, custom backend)
        // For now, store locally
        const events = this.context.globalState.get('analytics_events', []) as AnalyticsEvent[];
        events.push(event);
        
        // Keep only last 1000 events locally
        if (events.length > 1000) {
            events.splice(0, events.length - 1000);
        }
        
        await this.context.globalState.update('analytics_events', events);
    }

    /**
     * Send alert for critical events
     */
    private async sendAlert(event: AnalyticsEvent): Promise<void> {
        // In production, send to alerting system (e.g., PagerDuty, Slack, email)
        console.warn('CRITICAL EVENT:', event);
        
        vscode.window.showErrorMessage(
            `Critical Issue Detected: ${event.eventType}`,
            'View Details'
        ).then(selection => {
            if (selection === 'View Details') {
                this.showAnalyticsDashboard();
            }
        });
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
    }
}

/**
 * Register analytics commands
 */
export function registerAnalyticsCommands(context: vscode.ExtensionContext): void {
    const analytics = new EnterpriseAnalyticsSystem(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.analytics.dashboard', async () => {
            await analytics.showAnalyticsDashboard();
        }),

        vscode.commands.registerCommand('coding.analytics.trackCustomEvent', async () => {
            const eventType = await vscode.window.showInputBox({
                prompt: 'Enter event type',
                placeHolder: 'custom_action'
            });

            if (eventType) {
                await analytics.trackEvent(eventType, 'user_action', { custom: true });
                vscode.window.showInformationMessage('Custom event tracked!');
            }
        }),

        vscode.commands.registerCommand('coding.analytics.testAB', async () => {
            const variant = analytics.getUserVariant('ui_theme_test');
            vscode.window.showInformationMessage(`You are in A/B test variant: ${variant}`);
        })
    );

    context.subscriptions.push(analytics);
}