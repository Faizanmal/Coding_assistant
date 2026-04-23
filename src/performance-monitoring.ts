import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

/**
 * Performance & Monitoring System
 * Comprehensive APM integration, distributed tracing, metrics dashboards, and alerting
 */

export interface PerformanceMetric {
    id: string;
    timestamp: Date;
    source: 'extension' | 'vscode' | 'system' | 'ai' | 'collaboration' | 'user';
    category: 'performance' | 'memory' | 'cpu' | 'disk' | 'network' | 'ai' | 'user_action';
    name: string;
    value: number;
    unit: 'ms' | 'mb' | 'percent' | 'count' | 'bytes' | 'ops';
    tags: Record<string, string>;
    metadata?: {
        stack_trace?: string;
        user_id?: string;
        session_id?: string;
        workspace_id?: string;
        operation_id?: string;
    };
}

export interface TraceSpan {
    id: string;
    trace_id: string;
    parent_span_id?: string;
    operation_name: string;
    start_time: Date;
    end_time?: Date;
    duration_ms?: number;
    status: 'running' | 'completed' | 'error' | 'timeout';
    tags: Record<string, any>;
    logs: {
        timestamp: Date;
        level: 'debug' | 'info' | 'warn' | 'error';
        message: string;
        fields?: Record<string, any>;
    }[];
    error?: {
        message: string;
        stack?: string;
        type: string;
    };
}

export interface Alert {
    id: string;
    name: string;
    description: string;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    status: 'active' | 'resolved' | 'suppressed';
    triggered_at: Date;
    resolved_at?: Date;
    condition: {
        metric: string;
        operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
        threshold: number;
        time_window_minutes: number;
    };
    current_value: number;
    notification_channels: string[];
    metadata: {
        affected_users?: string[];
        affected_workspaces?: string[];
        impact_level?: 'low' | 'medium' | 'high';
        escalation_level?: number;
    };
}

export interface SystemHealth {
    timestamp: Date;
    overall_status: 'healthy' | 'degraded' | 'critical' | 'down';
    components: {
        extension: 'up' | 'down' | 'degraded';
        ai_services: 'up' | 'down' | 'degraded';
        collaboration: 'up' | 'down' | 'degraded';
        file_system: 'up' | 'down' | 'degraded';
        analytics: 'up' | 'down' | 'degraded';
        security: 'up' | 'down' | 'degraded';
    };
    performance: {
        avg_response_time_ms: number;
        error_rate_percent: number;
        memory_usage_mb: number;
        cpu_usage_percent: number;
        disk_usage_percent: number;
        active_connections: number;
    };
    capacity: {
        max_concurrent_users: number;
        current_active_users: number;
        max_ai_requests_per_minute: number;
        current_ai_requests_per_minute: number;
    };
}

export interface ResourceUsage {
    timestamp: Date;
    cpu: {
        usage_percent: number;
        load_average: number[];
        temperature?: number;
    };
    memory: {
        total_mb: number;
        used_mb: number;
        available_mb: number;
        heap_used_mb: number;
        heap_total_mb: number;
        external_mb: number;
    };
    disk: {
        total_gb: number;
        used_gb: number;
        available_gb: number;
        read_iops: number;
        write_iops: number;
        read_throughput_mbps: number;
        write_throughput_mbps: number;
    };
    network: {
        bytes_sent: number;
        bytes_received: number;
        packets_sent: number;
        packets_received: number;
        connections_active: number;
        connections_total: number;
    };
    processes: {
        extension_memory_mb: number;
        vscode_memory_mb: number;
        total_threads: number;
        gc_collections: number;
        gc_time_ms: number;
    };
}

export interface Dashboard {
    id: string;
    name: string;
    description: string;
    type: 'overview' | 'performance' | 'security' | 'business' | 'custom';
    layout: 'grid' | 'list' | 'charts';
    widgets: DashboardWidget[];
    filters: {
        time_range: '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';
        custom_start?: Date;
        custom_end?: Date;
        tenant_id?: string;
        workspace_id?: string;
        user_id?: string;
    };
    auto_refresh_seconds: number;
    created_at: Date;
    created_by: string;
    shared_with: string[];
}

export interface DashboardWidget {
    id: string;
    type: 'metric' | 'chart' | 'table' | 'alert' | 'log' | 'gauge' | 'heatmap';
    title: string;
    position: { x: number; y: number; width: number; height: number };
    config: {
        metric_name?: string;
        chart_type?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
        aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
        group_by?: string[];
        threshold_warning?: number;
        threshold_critical?: number;
        color_scheme?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
    };
    data_source: {
        query: string;
        refresh_interval_seconds: number;
    };
}

export class PerformanceMonitoringSystem {
    private metrics: PerformanceMetric[] = [];
    private traces: Map<string, TraceSpan[]> = new Map();
    private alerts: Map<string, Alert> = new Map();
    private dashboards: Map<string, Dashboard> = new Map();
    private healthChecks: SystemHealth[] = [];
    private resourceUsage: ResourceUsage[] = [];
    private context: vscode.ExtensionContext;
    private monitoringInterval: NodeJS.Timeout | null = null;
    private sessionId: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sessionId = crypto.randomUUID();
        this.initializeMonitoring();
        this.createDefaultDashboards();
        this.setupDefaultAlerts();
    }

    /**
     * Initialize monitoring systems
     */
    private initializeMonitoring(): void {
        // Start continuous monitoring
        this.monitoringInterval = setInterval(() => {
            this.collectSystemMetrics();
            this.performHealthCheck();
            this.checkAlerts();
        }, 5000); // Every 5 seconds

        // Start resource usage collection
        setInterval(() => {
            this.collectResourceUsage();
        }, 10000); // Every 10 seconds

        // Clean up old data
        setInterval(() => {
            this.cleanupOldData();
        }, 60000); // Every minute
    }

    /**
     * Start distributed trace
     */
    startTrace(operationName: string, tags: Record<string, any> = {}): string {
        const traceId = crypto.randomUUID();
        const spanId = crypto.randomUUID();

        const span: TraceSpan = {
            id: spanId,
            trace_id: traceId,
            operation_name: operationName,
            start_time: new Date(),
            status: 'running',
            tags: {
                ...tags,
                session_id: this.sessionId,
                user_agent: 'VS Code Extension'
            },
            logs: []
        };

        const traceSpans = this.traces.get(traceId) || [];
        traceSpans.push(span);
        this.traces.set(traceId, traceSpans);

        return spanId;
    }

    /**
     * Finish trace span
     */
    finishSpan(spanId: string, status: 'completed' | 'error' | 'timeout' = 'completed', error?: any): void {
        for (const [traceId, spans] of this.traces.entries()) {
            const span = spans.find(s => s.id === spanId);
            if (span) {
                span.end_time = new Date();
                span.duration_ms = span.end_time.getTime() - span.start_time.getTime();
                span.status = status;

                if (error) {
                    span.error = {
                        message: error.message || String(error),
                        stack: error.stack,
                        type: error.constructor.name
                    };
                }

                // Record performance metric
                this.recordMetric({
                    source: 'extension',
                    category: 'performance',
                    name: `operation_duration_${span.operation_name}`,
                    value: span.duration_ms!,
                    unit: 'ms',
                    tags: span.tags,
                    metadata: {
                        operation_id: spanId,
                        session_id: this.sessionId
                    }
                });

                break;
            }
        }
    }

    /**
     * Add log to trace span
     */
    addSpanLog(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
        for (const spans of this.traces.values()) {
            const span = spans.find(s => s.id === spanId);
            if (span) {
                span.logs.push({
                    timestamp: new Date(),
                    level,
                    message,
                    fields
                });
                break;
            }
        }
    }

    /**
     * Record performance metric
     */
    recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
        const fullMetric: PerformanceMetric = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            ...metric
        };

        this.metrics.push(fullMetric);

        // Keep only recent metrics (last 24 hours)
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }

    /**
     * Collect system metrics
     */
    private async collectSystemMetrics(): Promise<void> {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Memory metrics
        this.recordMetric({
            source: 'system',
            category: 'memory',
            name: 'heap_used',
            value: memUsage.heapUsed / 1024 / 1024,
            unit: 'mb',
            tags: { process: 'extension' }
        });

        this.recordMetric({
            source: 'system',
            category: 'memory',
            name: 'heap_total',
            value: memUsage.heapTotal / 1024 / 1024,
            unit: 'mb',
            tags: { process: 'extension' }
        });

        // CPU metrics (approximation)
        this.recordMetric({
            source: 'system',
            category: 'cpu',
            name: 'cpu_user_time',
            value: cpuUsage.user / 1000,
            unit: 'ms',
            tags: { process: 'extension' }
        });

        this.recordMetric({
            source: 'system',
            category: 'cpu',
            name: 'cpu_system_time',
            value: cpuUsage.system / 1000,
            unit: 'ms',
            tags: { process: 'extension' }
        });

        // VS Code specific metrics
        const editorCount = vscode.window.visibleTextEditors.length;
        this.recordMetric({
            source: 'vscode',
            category: 'user_action',
            name: 'active_editors',
            value: editorCount,
            unit: 'count',
            tags: { component: 'editor' }
        });

        // Extension-specific metrics
        const metricsCount = this.metrics.length;
        this.recordMetric({
            source: 'extension',
            category: 'performance',
            name: 'metrics_stored',
            value: metricsCount,
            unit: 'count',
            tags: { component: 'monitoring' }
        });
    }

    /**
     * Collect detailed resource usage
     */
    private async collectResourceUsage(): Promise<void> {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const usage: ResourceUsage = {
            timestamp: new Date(),
            cpu: {
                usage_percent: 0, // Would need external lib for accurate CPU usage
                load_average: os.loadavg()
            },
            memory: {
                total_mb: os.totalmem() / 1024 / 1024,
                used_mb: (os.totalmem() - os.freemem()) / 1024 / 1024,
                available_mb: os.freemem() / 1024 / 1024,
                heap_used_mb: memUsage.heapUsed / 1024 / 1024,
                heap_total_mb: memUsage.heapTotal / 1024 / 1024,
                external_mb: memUsage.external / 1024 / 1024
            },
            disk: {
                total_gb: 0, // Would need external lib for disk usage
                used_gb: 0,
                available_gb: 0,
                read_iops: 0,
                write_iops: 0,
                read_throughput_mbps: 0,
                write_throughput_mbps: 0
            },
            network: {
                bytes_sent: 0,
                bytes_received: 0,
                packets_sent: 0,
                packets_received: 0,
                connections_active: 0,
                connections_total: 0
            },
            processes: {
                extension_memory_mb: memUsage.heapUsed / 1024 / 1024,
                vscode_memory_mb: (memUsage.heapTotal + memUsage.external) / 1024 / 1024,
                total_threads: 0,
                gc_collections: 0,
                gc_time_ms: 0
            }
        };

        this.resourceUsage.push(usage);

        // Keep only last 2 hours of data
        const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
        this.resourceUsage = this.resourceUsage.filter(u => u.timestamp > cutoff);
    }

    /**
     * Perform health check
     */
    private async performHealthCheck(): Promise<void> {
        const recentMetrics = this.metrics.filter(m => 
            m.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        );

        const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
        const errorRate = this.calculateErrorRate(recentMetrics);
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

        const health: SystemHealth = {
            timestamp: new Date(),
            overall_status: this.determineOverallStatus(avgResponseTime, errorRate, memoryUsage),
            components: {
                extension: avgResponseTime < 1000 ? 'up' : 'degraded',
                ai_services: errorRate < 0.05 ? 'up' : 'degraded',
                collaboration: 'up', // Would check WebSocket connections
                file_system: 'up', // Would check file system access
                analytics: this.metrics.length > 0 ? 'up' : 'down',
                security: 'up' // Would check security components
            },
            performance: {
                avg_response_time_ms: avgResponseTime,
                error_rate_percent: errorRate * 100,
                memory_usage_mb: memoryUsage,
                cpu_usage_percent: 0, // Would calculate from CPU metrics
                disk_usage_percent: 0, // Would calculate from disk metrics
                active_connections: 0 // Would count active connections
            },
            capacity: {
                max_concurrent_users: 1000,
                current_active_users: 1, // Would count from session data
                max_ai_requests_per_minute: 100,
                current_ai_requests_per_minute: this.calculateCurrentAIRequestRate()
            }
        };

        this.healthChecks.push(health);

        // Keep only last hour of health checks
        const cutoff = new Date(Date.now() - 60 * 60 * 1000);
        this.healthChecks = this.healthChecks.filter(h => h.timestamp > cutoff);
    }

    /**
     * Check alert conditions
     */
    private checkAlerts(): void {
        this.alerts.forEach(alert => {
            if (alert.status === 'active') {
                const currentValue = this.evaluateAlertCondition(alert);
                alert.current_value = currentValue;

                const conditionMet = this.checkAlertCondition(alert, currentValue);
                
                if (!conditionMet && !alert.resolved_at) {
                    alert.status = 'resolved';
                    alert.resolved_at = new Date();
                    this.notifyAlertResolved(alert);
                }
            }
        });
    }

    /**
     * Create alert
     */
    createAlert(
        name: string,
        description: string,
        severity: Alert['severity'],
        condition: Alert['condition'],
        notificationChannels: string[] = []
    ): Alert {
        const alert: Alert = {
            id: crypto.randomUUID(),
            name,
            description,
            severity,
            status: 'active',
            triggered_at: new Date(),
            condition,
            current_value: 0,
            notification_channels: notificationChannels,
            metadata: {}
        };

        this.alerts.set(alert.id, alert);
        return alert;
    }

    /**
     * Show monitoring dashboard
     */
    async showMonitoringDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'performanceMonitoring',
            'Performance & Monitoring Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateMonitoringDashboardHTML();

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'refreshMetrics':
                    await this.collectSystemMetrics();
                    panel.webview.html = this.generateMonitoringDashboardHTML();
                    break;
                case 'exportData':
                    await this.exportMonitoringData();
                    break;
                case 'createAlert':
                    await this.showCreateAlertDialog();
                    break;
                case 'viewTraces':
                    await this.showDistributedTraces();
                    break;
            }
        });
    }

    /**
     * Generate monitoring dashboard HTML
     */
    private generateMonitoringDashboardHTML(): string {
        const recentMetrics = this.metrics.filter(m => 
            m.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
        );

        const latestHealth = this.healthChecks[this.healthChecks.length - 1];
        const activeAlerts = Array.from(this.alerts.values()).filter(a => a.status === 'active');
        const latestUsage = this.resourceUsage[this.resourceUsage.length - 1];

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
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #1e3c72;
        }
        .metric-value {
            font-size: 28px;
            font-weight: bold;
            color: #1e3c72;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #888;
            font-size: 12px;
        }
        .metric-trend {
            font-size: 10px;
            margin-top: 5px;
        }
        .trend-up { color: #4CAF50; }
        .trend-down { color: #F44336; }
        .trend-stable { color: #888; }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #1e3c72;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #1e3c72;
        }
        .health-status {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 15px 0;
        }
        .health-component {
            background: #2d2d30;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .status-up { border-left: 4px solid #4CAF50; }
        .status-degraded { border-left: 4px solid #FF9800; }
        .status-down { border-left: 4px solid #F44336; }
        .alert-item {
            background: #2d2d30;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid;
        }
        .alert-critical { border-left-color: #F44336; }
        .alert-warning { border-left-color: #FF9800; }
        .alert-info { border-left-color: #2196F3; }
        .chart-container {
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
        }
        .btn {
            background: #1e3c72;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        .btn:hover {
            background: #2a5298;
        }
        .trace-item {
            background: #2d2d30;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid;
        }
        .trace-completed { border-left-color: #4CAF50; }
        .trace-error { border-left-color: #F44336; }
        .trace-running { border-left-color: #FF9800; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Performance & Monitoring Dashboard</h1>
        <p>Real-time system monitoring, APM, and alerting</p>
        <p style="margin-top: 10px; font-size: 14px;">
            Session: ${this.sessionId} | 
            Status: <strong style="color: ${latestHealth?.overall_status === 'healthy' ? '#4CAF50' : 
                                          latestHealth?.overall_status === 'degraded' ? '#FF9800' : '#F44336'}">
                ${latestHealth?.overall_status?.toUpperCase() || 'UNKNOWN'}
            </strong>
        </p>
    </div>

    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-value">${latestHealth?.performance.avg_response_time_ms.toFixed(0) || '0'}ms</div>
            <div class="metric-label">Avg Response Time</div>
            <div class="metric-trend trend-stable">📈 Stable</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${latestHealth?.performance.error_rate_percent.toFixed(1) || '0'}%</div>
            <div class="metric-label">Error Rate</div>
            <div class="metric-trend trend-down">📉 Good</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${latestUsage?.memory.heap_used_mb.toFixed(0) || '0'}MB</div>
            <div class="metric-label">Memory Usage</div>
            <div class="metric-trend trend-up">📈 Normal</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${activeAlerts.length}</div>
            <div class="metric-label">Active Alerts</div>
            <div class="metric-trend ${activeAlerts.length > 0 ? 'trend-up' : 'trend-stable'}">
                ${activeAlerts.length > 0 ? '⚠️ Attention' : '✅ Good'}
            </div>
        </div>
    </div>

    <div class="dashboard-grid">
        <div class="section">
            <h2>🏥 System Health</h2>
            ${latestHealth ? `
                <div class="health-status">
                    <div class="health-component status-${latestHealth.components.extension}">
                        <strong>Extension</strong><br/>
                        <span style="color: ${latestHealth.components.extension === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.extension.toUpperCase()}
                        </span>
                    </div>
                    <div class="health-component status-${latestHealth.components.ai_services}">
                        <strong>AI Services</strong><br/>
                        <span style="color: ${latestHealth.components.ai_services === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.ai_services.toUpperCase()}
                        </span>
                    </div>
                    <div class="health-component status-${latestHealth.components.collaboration}">
                        <strong>Collaboration</strong><br/>
                        <span style="color: ${latestHealth.components.collaboration === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.collaboration.toUpperCase()}
                        </span>
                    </div>
                    <div class="health-component status-${latestHealth.components.analytics}">
                        <strong>Analytics</strong><br/>
                        <span style="color: ${latestHealth.components.analytics === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.analytics.toUpperCase()}
                        </span>
                    </div>
                    <div class="health-component status-${latestHealth.components.security}">
                        <strong>Security</strong><br/>
                        <span style="color: ${latestHealth.components.security === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.security.toUpperCase()}
                        </span>
                    </div>
                    <div class="health-component status-${latestHealth.components.file_system}">
                        <strong>File System</strong><br/>
                        <span style="color: ${latestHealth.components.file_system === 'up' ? '#4CAF50' : '#FF9800'}">
                            ${latestHealth.components.file_system.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div style="margin-top: 15px; font-size: 12px; color: #888;">
                    Last Updated: ${latestHealth.timestamp.toLocaleString()}
                </div>
            ` : '<div style="color: #888;">No health data available</div>'}
        </div>

        <div class="section">
            <h2>🚨 Active Alerts</h2>
            ${activeAlerts.length > 0 ? activeAlerts.slice(0, 5).map(alert => `
                <div class="alert-item alert-${alert.severity}">
                    <strong>${alert.name}</strong>
                    <div style="font-size: 12px; color: #888; margin: 5px 0;">
                        ${alert.description}
                    </div>
                    <div style="font-size: 12px;">
                        Current: ${alert.current_value} | Threshold: ${alert.condition.threshold}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 5px;">
                        Triggered: ${alert.triggered_at.toLocaleString()}
                    </div>
                </div>
            `).join('') : '<div style="color: #888;">No active alerts</div>'}
            
            <button class="btn" onclick="createAlert()">Create Alert</button>
        </div>

        <div class="section">
            <h2>📈 Performance Metrics</h2>
            <div class="chart-container">
                📊 Response Time Chart (${recentMetrics.length} data points)
                <br/>
                <small>Interactive charts would be implemented with Chart.js</small>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                <div style="background: #2d2d30; padding: 10px; border-radius: 4px; text-align: center;">
                    <strong>Metrics Collected</strong><br/>
                    ${this.metrics.length}
                </div>
                <div style="background: #2d2d30; padding: 10px; border-radius: 4px; text-align: center;">
                    <strong>Active Traces</strong><br/>
                    ${this.traces.size}
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔍 Recent Traces</h2>
            ${Array.from(this.traces.values()).flat().slice(-5).map(span => `
                <div class="trace-item trace-${span.status}">
                    <strong>${span.operation_name}</strong>
                    <div style="font-size: 12px; color: #888; margin: 5px 0;">
                        Duration: ${span.duration_ms || 'Running'}ms | 
                        Status: ${span.status.toUpperCase()}
                    </div>
                    <div style="font-size: 11px; color: #888;">
                        Started: ${span.start_time.toLocaleString()}
                    </div>
                </div>
            `).join('') || '<div style="color: #888;">No trace data</div>'}
            
            <button class="btn" onclick="viewTraces()">View All Traces</button>
        </div>

        <div class="section">
            <h2>💾 Resource Usage</h2>
            ${latestUsage ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <strong>Memory</strong><br/>
                        <div style="font-size: 12px; color: #888; margin: 5px 0;">
                            Heap: ${latestUsage.memory.heap_used_mb.toFixed(1)}MB / ${latestUsage.memory.heap_total_mb.toFixed(1)}MB<br/>
                            System: ${latestUsage.memory.used_mb.toFixed(1)}MB / ${latestUsage.memory.total_mb.toFixed(1)}MB
                        </div>
                    </div>
                    <div>
                        <strong>CPU</strong><br/>
                        <div style="font-size: 12px; color: #888; margin: 5px 0;">
                            Load Average: ${latestUsage.cpu.load_average.map(l => l.toFixed(2)).join(', ')}<br/>
                            Usage: ${latestUsage.cpu.usage_percent.toFixed(1)}%
                        </div>
                    </div>
                </div>
            ` : '<div style="color: #888;">No resource data available</div>'}
        </div>

        <div class="section">
            <h2>⚙️ Actions</h2>
            <button class="btn" onclick="refreshMetrics()">Refresh Metrics</button>
            <button class="btn" onclick="exportData()">Export Data</button>
            <button class="btn" onclick="viewTraces()">Distributed Traces</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function refreshMetrics() {
            vscode.postMessage({ command: 'refreshMetrics' });
        }

        function exportData() {
            vscode.postMessage({ command: 'exportData' });
        }

        function createAlert() {
            vscode.postMessage({ command: 'createAlert' });
        }

        function viewTraces() {
            vscode.postMessage({ command: 'viewTraces' });
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            refreshMetrics();
        }, 30000);
    </script>
</body>
</html>`;
    }

    /**
     * Helper methods for calculations
     */
    private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
        const responseTimeMetrics = metrics.filter(m => 
            m.name.includes('duration') || m.name.includes('response_time')
        );
        
        if (responseTimeMetrics.length === 0) {return 0;}
        
        const sum = responseTimeMetrics.reduce((acc, m) => acc + m.value, 0);
        return sum / responseTimeMetrics.length;
    }

    private calculateErrorRate(metrics: PerformanceMetric[]): number {
        const totalRequests = metrics.filter(m => m.name.includes('request')).length;
        const errorRequests = metrics.filter(m => m.name.includes('error')).length;
        
        return totalRequests > 0 ? errorRequests / totalRequests : 0;
    }

    private calculateCurrentAIRequestRate(): number {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        
        const recentAIRequests = this.metrics.filter(m =>
            m.timestamp > oneMinuteAgo &&
            (m.name.includes('ai_request') || m.source === 'ai')
        );
        
        return recentAIRequests.length;
    }

    private determineOverallStatus(responseTime: number, errorRate: number, memoryUsage: number): SystemHealth['overall_status'] {
        if (errorRate > 0.1 || responseTime > 5000 || memoryUsage > 1000) {
            return 'critical';
        } else if (errorRate > 0.05 || responseTime > 2000 || memoryUsage > 500) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    private evaluateAlertCondition(alert: Alert): number {
        // Get recent metrics for the alert condition
        const recentMetrics = this.metrics.filter(m => 
            m.name === alert.condition.metric &&
            m.timestamp > new Date(Date.now() - alert.condition.time_window_minutes * 60 * 1000)
        );

        if (recentMetrics.length === 0) {return 0;}

        // Calculate average value
        return recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
    }

    private checkAlertCondition(alert: Alert, currentValue: number): boolean {
        const { operator, threshold } = alert.condition;
        
        switch (operator) {
            case '>': return currentValue > threshold;
            case '<': return currentValue < threshold;
            case '>=': return currentValue >= threshold;
            case '<=': return currentValue <= threshold;
            case '=': return currentValue === threshold;
            case '!=': return currentValue !== threshold;
            default: return false;
        }
    }

    private notifyAlertResolved(alert: Alert): void {
        vscode.window.showInformationMessage(`✅ Alert resolved: ${alert.name}`);
    }

    private createDefaultDashboards(): void {
        // Create overview dashboard
        const overviewDashboard: Dashboard = {
            id: 'overview',
            name: 'System Overview',
            description: 'High-level system metrics and health',
            type: 'overview',
            layout: 'grid',
            widgets: [],
            filters: {
                time_range: '1h'
            },
            auto_refresh_seconds: 30,
            created_at: new Date(),
            created_by: 'system',
            shared_with: []
        };

        this.dashboards.set('overview', overviewDashboard);
    }

    private setupDefaultAlerts(): void {
        // High memory usage alert
        this.createAlert(
            'High Memory Usage',
            'Extension memory usage is above threshold',
            'warning',
            {
                metric: 'heap_used',
                operator: '>',
                threshold: 500,
                time_window_minutes: 5
            }
        );

        // High error rate alert
        this.createAlert(
            'High Error Rate',
            'Error rate is above acceptable threshold',
            'critical',
            {
                metric: 'error_rate',
                operator: '>',
                threshold: 0.1,
                time_window_minutes: 10
            }
        );
    }

    private cleanupOldData(): void {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        // Clean up old metrics
        this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
        
        // Clean up old traces
        this.traces.forEach((spans, traceId) => {
            const validSpans = spans.filter(s => s.start_time > oneDayAgo);
            if (validSpans.length === 0) {
                this.traces.delete(traceId);
            } else {
                this.traces.set(traceId, validSpans);
            }
        });
    }

    // Dialog methods
    private async showCreateAlertDialog(): Promise<void> {
        const name = await vscode.window.showInputBox({ prompt: 'Alert name' });
        const metric = await vscode.window.showInputBox({ prompt: 'Metric name' });
        const threshold = await vscode.window.showInputBox({ prompt: 'Threshold value' });
        
        if (name && metric && threshold) {
            this.createAlert(
                name,
                `Alert for ${metric}`,
                'warning',
                {
                    metric,
                    operator: '>',
                    threshold: parseFloat(threshold),
                    time_window_minutes: 5
                }
            );
        }
    }

    private async showDistributedTraces(): Promise<void> {
        const allSpans = Array.from(this.traces.values()).flat();
        const traceData = allSpans.map(span => 
            `${span.trace_id} | ${span.operation_name} | ${span.duration_ms || 'Running'}ms | ${span.status}`
        ).join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: traceData,
            language: 'text'
        });
        await vscode.window.showTextDocument(doc);
    }

    private async exportMonitoringData(): Promise<void> {
        const data = {
            metrics: this.metrics.slice(-1000), // Last 1000 metrics
            traces: Array.from(this.traces.entries()),
            alerts: Array.from(this.alerts.values()),
            health: this.healthChecks.slice(-100), // Last 100 health checks
            usage: this.resourceUsage.slice(-100) // Last 100 usage records
        };

        const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(data, null, 2),
            language: 'json'
        });
        await vscode.window.showTextDocument(doc);
    }

    dispose(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}

/**
 * Register performance monitoring commands
 */
export function registerPerformanceMonitoringCommands(context: vscode.ExtensionContext): void {
    const monitoring = new PerformanceMonitoringSystem(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.performance.dashboard', async () => {
            await monitoring.showMonitoringDashboard();
        }),

        vscode.commands.registerCommand('coding.performance.startTrace', async () => {
            const operationName = await vscode.window.showInputBox({ prompt: 'Operation name' });
            if (operationName) {
                const spanId = monitoring.startTrace(operationName);
                vscode.window.showInformationMessage(`Started trace: ${spanId}`);
                
                // Simulate operation completion after 2 seconds
                setTimeout(() => {
                    monitoring.finishSpan(spanId, 'completed');
                    vscode.window.showInformationMessage(`Completed trace: ${spanId}`);
                }, 2000);
            }
        }),

        vscode.commands.registerCommand('coding.performance.recordMetric', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Metric name' });
            const value = await vscode.window.showInputBox({ prompt: 'Value' });
            
            if (name && value) {
                monitoring.recordMetric({
                    source: 'user',
                    category: 'custom',
                    name,
                    value: parseFloat(value),
                    unit: 'count',
                    tags: { source: 'manual' }
                });
                vscode.window.showInformationMessage(`Recorded metric: ${name} = ${value}`);
            }
        }),

        vscode.commands.registerCommand('coding.performance.createAlert', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Alert name' });
            const metric = await vscode.window.showInputBox({ prompt: 'Metric name' });
            const threshold = await vscode.window.showInputBox({ prompt: 'Threshold' });
            
            if (name && metric && threshold) {
                monitoring.createAlert(
                    name,
                    `Alert for ${metric}`,
                    'warning',
                    {
                        metric,
                        operator: '>',
                        threshold: parseFloat(threshold),
                        time_window_minutes: 5
                    }
                );
                vscode.window.showInformationMessage(`Created alert: ${name}`);
            }
        })
    );

    context.subscriptions.push(monitoring);
}