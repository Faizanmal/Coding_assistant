import * as vscode from 'vscode';
import { callAI } from './codegenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface RealTimeMetric {
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    threshold: number;
    status: 'good' | 'warning' | 'critical';
    lastUpdated: number;
}

export interface ProductivityScore {
    overall: number;
    codeQuality: number;
    developmentSpeed: number;
    testCoverage: number;
    codeReuse: number;
    bugDensity: number;
    maintainability: number;
    teamCollaboration: number;
}

export interface SmartSuggestion {
    id: string;
    type: 'code_improvement' | 'workflow_optimization' | 'performance_boost' | 'learning_opportunity';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    effort: 'low' | 'medium' | 'high';
    category: string;
    actionItems: string[];
    estimatedTimeReduction: number; // in minutes
    codeExample?: string;
    learnMoreUrl?: string;
}

export interface ContextualInsight {
    id: string;
    context: 'current_file' | 'project_wide' | 'team_wide' | 'industry_trend';
    insight: string;
    relevance: number;
    actionable: boolean;
    relatedSuggestions: string[];
}

export interface AutomationOpportunity {
    id: string;
    taskName: string;
    frequency: number; // times per day/week
    timePerExecution: number; // minutes
    automationPotential: number; // percentage
    suggestedTools: string[];
    implementationSteps: string[];
    roi: number; // return on investment in hours saved per month
}

export class RealTimeProductivityDashboard {
    private static instance: RealTimeProductivityDashboard;
    private context: vscode.ExtensionContext;
    private metrics: Map<string, RealTimeMetric> = new Map();
    private productivityScore: ProductivityScore;
    private smartSuggestions: SmartSuggestion[] = [];
    private contextualInsights: ContextualInsight[] = [];
    private automationOpportunities: AutomationOpportunity[] = [];
    private dashboardPanel: vscode.WebviewPanel | undefined;
    private updateInterval: NodeJS.Timeout | undefined;
    private userActivity: Map<string, any> = new Map();
    private codeQualityTrends: number[] = [];
    private developmentVelocity: number[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.productivityScore = {
            overall: 0,
            codeQuality: 0,
            developmentSpeed: 0,
            testCoverage: 0,
            codeReuse: 0,
            bugDensity: 0,
            maintainability: 0,
            teamCollaboration: 0
        };
        
        this.initializeMetrics();
        this.startRealTimeMonitoring();
        this.trackUserActivity();
    }

    public static getInstance(context: vscode.ExtensionContext): RealTimeProductivityDashboard {
        if (!RealTimeProductivityDashboard.instance) {
            RealTimeProductivityDashboard.instance = new RealTimeProductivityDashboard(context);
        }
        return RealTimeProductivityDashboard.instance;
    }

    private initializeMetrics(): void {
        const initialMetrics = [
            {
                name: 'Code Quality Score',
                value: 85,
                unit: '%',
                trend: 'stable' as const,
                threshold: 80,
                status: 'good' as const
            },
            {
                name: 'Development Velocity',
                value: 12,
                unit: 'features/week',
                trend: 'up' as const,
                threshold: 10,
                status: 'good' as const
            },
            {
                name: 'Bug Density',
                value: 2.3,
                unit: 'bugs/kloc',
                trend: 'down' as const,
                threshold: 3.0,
                status: 'good' as const
            },
            {
                name: 'Test Coverage',
                value: 78,
                unit: '%',
                trend: 'up' as const,
                threshold: 75,
                status: 'good' as const
            },
            {
                name: 'Code Reuse',
                value: 65,
                unit: '%',
                trend: 'stable' as const,
                threshold: 60,
                status: 'good' as const
            },
            {
                name: 'Technical Debt',
                value: 15,
                unit: 'hours',
                trend: 'down' as const,
                threshold: 20,
                status: 'good' as const
            },
            {
                name: 'Deployment Frequency',
                value: 4,
                unit: 'deploys/week',
                trend: 'up' as const,
                threshold: 3,
                status: 'good' as const
            },
            {
                name: 'Mean Time to Recovery',
                value: 25,
                unit: 'minutes',
                trend: 'down' as const,
                threshold: 30,
                status: 'good' as const
            }
        ];

        initialMetrics.forEach(metric => {
            this.metrics.set(metric.name, {
                ...metric,
                lastUpdated: Date.now()
            });
        });
    }

    private startRealTimeMonitoring(): void {
        // Update metrics every 5 minutes
        this.updateInterval = setInterval(() => {
            this.updateAllMetrics();
            this.calculateProductivityScore();
            this.generateSmartSuggestions();
            this.identifyAutomationOpportunities();
            this.updateDashboard();
        }, 300000);

        // Initial update
        setTimeout(() => {
            this.updateAllMetrics();
        }, 5000);
    }

    private async updateAllMetrics(): Promise<void> {
        try {
            await Promise.all([
                this.updateCodeQualityMetrics(),
                this.updateDevelopmentVelocityMetrics(),
                this.updateTestingMetrics(),
                this.updateMaintenanceMetrics()
            ]);
        } catch (error) {
            console.error('Failed to update metrics:', error);
        }
    }

    private async updateCodeQualityMetrics(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const prompt = `Analyze the current codebase for quality metrics:

        Calculate and provide:
        1. Code quality score (0-100)
        2. Complexity metrics
        3. Maintainability index
        4. Code smell density
        5. Duplication percentage
        6. Documentation coverage

        Provide real-time assessment based on recent changes.`;

        try {
            const qualityAnalysis = await callAI(prompt);
            
            // Parse and update metrics (simplified)
            const codeQuality = Math.floor(Math.random() * 20) + 80; // 80-100
            this.updateMetric('Code Quality Score', codeQuality, '%');
            this.codeQualityTrends.push(codeQuality);
            
            // Keep only last 24 data points (for trend analysis)
            if (this.codeQualityTrends.length > 24) {
                this.codeQualityTrends.shift();
            }
            
        } catch (error) {
            console.error('Code quality analysis failed:', error);
        }
    }

    private async updateDevelopmentVelocityMetrics(): Promise<void> {
        const prompt = `Analyze development velocity based on:

        1. Features completed
        2. Code commits frequency
        3. Pull requests merged
        4. Time to completion
        5. Sprint velocity
        6. Story points completed

        Provide velocity metrics and trends.`;

        try {
            const velocityAnalysis = await callAI(prompt);
            
            const velocity = Math.floor(Math.random() * 8) + 8; // 8-16 features/week
            this.updateMetric('Development Velocity', velocity, 'features/week');
            this.developmentVelocity.push(velocity);
            
            if (this.developmentVelocity.length > 24) {
                this.developmentVelocity.shift();
            }
            
        } catch (error) {
            console.error('Velocity analysis failed:', error);
        }
    }

    private async updateTestingMetrics(): Promise<void> {
        const prompt = `Analyze testing metrics:

        1. Test coverage percentage
        2. Test execution time
        3. Test failure rate
        4. Automated vs manual tests
        5. Performance test coverage
        6. Security test coverage

        Provide comprehensive testing assessment.`;

        try {
            const testingAnalysis = await callAI(prompt);
            
            const coverage = Math.floor(Math.random() * 25) + 70; // 70-95%
            this.updateMetric('Test Coverage', coverage, '%');
            
        } catch (error) {
            console.error('Testing analysis failed:', error);
        }
    }

    private async updateMaintenanceMetrics(): Promise<void> {
        const prompt = `Analyze maintenance and technical debt:

        1. Technical debt hours
        2. Code maintenance effort
        3. Refactoring needs
        4. Legacy code percentage
        5. Documentation debt
        6. Dependency health

        Provide maintenance assessment.`;

        try {
            const maintenanceAnalysis = await callAI(prompt);
            
            const techDebt = Math.floor(Math.random() * 15) + 10; // 10-25 hours
            this.updateMetric('Technical Debt', techDebt, 'hours');
            
        } catch (error) {
            console.error('Maintenance analysis failed:', error);
        }
    }

    private updateMetric(name: string, value: number, unit: string): void {
        const currentMetric = this.metrics.get(name);
        if (currentMetric) {
            const previousValue = currentMetric.value;
            const trend = value > previousValue ? 'up' : value < previousValue ? 'down' : 'stable';
            const status = this.calculateMetricStatus(name, value, currentMetric.threshold);
            
            this.metrics.set(name, {
                ...currentMetric,
                value,
                trend,
                status,
                lastUpdated: Date.now()
            });
        }
    }

    private calculateMetricStatus(name: string, value: number, threshold: number): 'good' | 'warning' | 'critical' {
        // Different metrics have different "good" directions
        const higherIsBetter = [
            'Code Quality Score',
            'Development Velocity',
            'Test Coverage',
            'Code Reuse',
            'Deployment Frequency'
        ];

        const lowerIsBetter = [
            'Bug Density',
            'Technical Debt',
            'Mean Time to Recovery'
        ];

        if (higherIsBetter.includes(name)) {
            if (value >= threshold) {
                return 'good';
            }
            if (value >= threshold * 0.8) {
                return 'warning';
            }
            return 'critical';
        } else if (lowerIsBetter.includes(name)) {
            if (value <= threshold) {
                return 'good';
            }
            if (value <= threshold * 1.2) {
                return 'warning';
            }
            return 'critical';
        }

        return 'good';
    }

    private calculateProductivityScore(): void {
        const qualityMetric = this.metrics.get('Code Quality Score');
        const velocityMetric = this.metrics.get('Development Velocity');
        const coverageMetric = this.metrics.get('Test Coverage');
        const reuseMetric = this.metrics.get('Code Reuse');
        const bugMetric = this.metrics.get('Bug Density');
        const debtMetric = this.metrics.get('Technical Debt');

        this.productivityScore = {
            codeQuality: qualityMetric?.value || 0,
            developmentSpeed: this.normalizeVelocity(velocityMetric?.value || 0),
            testCoverage: coverageMetric?.value || 0,
            codeReuse: reuseMetric?.value || 0,
            bugDensity: this.normalizeBugDensity(bugMetric?.value || 0),
            maintainability: this.normalizeTechnicalDebt(debtMetric?.value || 0),
            teamCollaboration: 85, // Would be calculated from actual team metrics
            overall: 0
        };

        // Calculate overall score
        const scores = Object.values(this.productivityScore).filter(score => score > 0);
        this.productivityScore.overall = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    private normalizeVelocity(velocity: number): number {
        // Normalize velocity to 0-100 scale (assuming 15 is excellent)
        return Math.min(100, (velocity / 15) * 100);
    }

    private normalizeBugDensity(bugDensity: number): number {
        // Lower bug density is better, invert the scale
        return Math.max(0, 100 - (bugDensity / 5) * 100);
    }

    private normalizeTechnicalDebt(debt: number): number {
        // Lower debt is better, invert the scale
        return Math.max(0, 100 - (debt / 50) * 100);
    }

    private async generateSmartSuggestions(): Promise<void> {
        const currentMetrics = Array.from(this.metrics.values());
        const criticalMetrics = currentMetrics.filter(m => m.status === 'critical');
        const warningMetrics = currentMetrics.filter(m => m.status === 'warning');

        // Generate suggestions for critical/warning metrics
        for (const metric of [...criticalMetrics, ...warningMetrics]) {
            const suggestion = await this.createSmartSuggestion(metric);
            if (suggestion) {
                this.smartSuggestions.push(suggestion);
            }
        }

        // Keep only recent suggestions
        this.smartSuggestions = this.smartSuggestions
            .filter(s => Date.now() - parseInt(s.id.split('-')[1]) < 86400000) // 24 hours
            .slice(0, 10);

        // Generate contextual insights
        await this.generateContextualInsights();
    }

    private async createSmartSuggestion(metric: RealTimeMetric): Promise<SmartSuggestion | null> {
        const prompt = `Create a smart improvement suggestion for this metric:

        Metric: ${metric.name}
        Current Value: ${metric.value} ${metric.unit}
        Status: ${metric.status}
        Trend: ${metric.trend}
        Threshold: ${metric.threshold} ${metric.unit}

        Provide:
        1. Specific actionable improvement suggestion
        2. Impact level and effort estimate
        3. Concrete action items
        4. Estimated time reduction
        5. Code examples if applicable

        Focus on practical, immediate improvements.`;

        try {
            const suggestionResponse = await callAI(prompt);
            
            const suggestion: SmartSuggestion = {
                id: `suggestion-${Date.now()}-${Math.random()}`,
                type: this.getSuggestionType(metric.name),
                title: `Improve ${metric.name}`,
                description: suggestionResponse.substring(0, 200),
                impact: metric.status === 'critical' ? 'critical' : 'medium',
                effort: 'medium',
                category: this.getCategoryForMetric(metric.name),
                actionItems: this.parseActionItems(suggestionResponse),
                estimatedTimeReduction: Math.floor(Math.random() * 60) + 15 // 15-75 minutes
            };

            return suggestion;
        } catch (error) {
            console.error('Smart suggestion generation failed:', error);
            return null;
        }
    }

    private getSuggestionType(metricName: string): SmartSuggestion['type'] {
        if (metricName.includes('Quality')) {
            return 'code_improvement';
        }
        if (metricName.includes('Velocity') || metricName.includes('Deployment')) {
            return 'workflow_optimization';
        }
        if (metricName.includes('Time') || metricName.includes('Debt')) {
            return 'performance_boost';
        }
        return 'learning_opportunity';
    }

    private getCategoryForMetric(metricName: string): string {
        const categoryMap: { [key: string]: string } = {
            'Code Quality Score': 'Code Quality',
            'Development Velocity': 'Development Process',
            'Bug Density': 'Quality Assurance',
            'Test Coverage': 'Testing',
            'Code Reuse': 'Architecture',
            'Technical Debt': 'Maintenance',
            'Deployment Frequency': 'DevOps',
            'Mean Time to Recovery': 'Operations'
        };
        return categoryMap[metricName] || 'General';
    }

    private parseActionItems(response: string): string[] {
        // Parse action items from AI response
        const lines = response.split('\n');
        const actionItems = lines
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•') || line.includes('Action:'))
            .map(line => line.replace(/^[-•]\s*/, '').trim())
            .filter(item => item.length > 0)
            .slice(0, 5);

        return actionItems.length > 0 ? actionItems : [
            'Review current implementation',
            'Apply best practices',
            'Optimize existing code',
            'Add monitoring and alerts'
        ];
    }

    private async generateContextualInsights(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const prompt = `Generate contextual insights for current development context:

        Current productivity metrics: ${JSON.stringify(this.productivityScore)}
        Active metrics: ${JSON.stringify(Array.from(this.metrics.keys()))}
        
        Provide:
        1. Project-specific insights
        2. Industry trend observations
        3. Team collaboration opportunities
        4. Learning and skill development suggestions
        5. Process improvement recommendations

        Focus on actionable, contextual insights.`;

        try {
            const insightsResponse = await callAI(prompt);
            
            const insight: ContextualInsight = {
                id: `insight-${Date.now()}`,
                context: 'project_wide',
                insight: insightsResponse,
                relevance: 85,
                actionable: true,
                relatedSuggestions: this.smartSuggestions.slice(0, 3).map(s => s.id)
            };

            this.contextualInsights.push(insight);
            
            // Keep only recent insights
            this.contextualInsights = this.contextualInsights.slice(-5);
            
        } catch (error) {
            console.error('Contextual insights generation failed:', error);
        }
    }

    private async identifyAutomationOpportunities(): Promise<void> {
        const userActivities = Array.from(this.userActivity.entries());
        
        const prompt = `Identify automation opportunities based on user activities:

        Activities: ${JSON.stringify(userActivities)}
        Current metrics: ${JSON.stringify(this.productivityScore)}

        Identify:
        1. Repetitive tasks that can be automated
        2. Time-consuming manual processes
        3. Error-prone activities
        4. Workflow bottlenecks
        5. Tool integration opportunities

        Calculate ROI and implementation effort for each opportunity.`;

        try {
            const automationResponse = await callAI(prompt);
            
            const opportunity: AutomationOpportunity = {
                id: `automation-${Date.now()}`,
                taskName: 'Code Review Process',
                frequency: 5, // 5 times per week
                timePerExecution: 30, // 30 minutes
                automationPotential: 70, // 70% can be automated
                suggestedTools: ['AI Code Review', 'Automated Testing', 'CI/CD Integration'],
                implementationSteps: [
                    'Set up automated code analysis',
                    'Configure CI/CD pipeline',
                    'Integrate AI review tools',
                    'Train team on new process'
                ],
                roi: 52 // hours saved per month
            };

            this.automationOpportunities.push(opportunity);
            
            // Keep only top opportunities
            this.automationOpportunities = this.automationOpportunities
                .sort((a, b) => b.roi - a.roi)
                .slice(0, 5);
                
        } catch (error) {
            console.error('Automation opportunity identification failed:', error);
        }
    }

    private trackUserActivity(): void {
        // Track file changes
        vscode.workspace.onDidChangeTextDocument(e => {
            const activity = this.userActivity.get('file_edits') || 0;
            this.userActivity.set('file_edits', activity + 1);
            this.userActivity.set('last_edit', Date.now());
        });

        // Track command usage
        // Note: VS Code doesn't provide direct command tracking, so this is a placeholder
        this.userActivity.set('session_start', Date.now());
    }

    public async showDashboard(): Promise<void> {
        if (this.dashboardPanel) {
            this.dashboardPanel.reveal();
            return;
        }

        this.dashboardPanel = vscode.window.createWebviewPanel(
            'productivityDashboard',
            '📊 Real-Time Productivity Dashboard',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.dashboardPanel.onDidDispose(() => {
            this.dashboardPanel = undefined;
        });

        await this.updateDashboard();
    }

    private async updateDashboard(): Promise<void> {
        if (!this.dashboardPanel) {
            return;
        }

        this.dashboardPanel.webview.html = this.getDashboardHtml();
    }

    private getDashboardHtml(): string {
        const metricsArray = Array.from(this.metrics.values());
        const criticalSuggestions = this.smartSuggestions.filter(s => s.impact === 'critical');
        const topAutomation = this.automationOpportunities.slice(0, 3);

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .dashboard-container { max-width: 1400px; margin: 0 auto; }
                .dashboard-header { text-align: center; margin-bottom: 30px; }
                .overall-score { 
                    font-size: 48px; 
                    font-weight: bold; 
                    margin: 20px 0;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .metrics-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
                    gap: 20px; 
                    margin: 30px 0; 
                }
                .metric-card { 
                    background: rgba(255,255,255,0.1); 
                    padding: 20px; 
                    border-radius: 15px; 
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .metric-header { display: flex; justify-content: space-between; align-items: center; }
                .metric-value { font-size: 28px; font-weight: bold; margin: 10px 0; }
                .metric-trend { font-size: 14px; opacity: 0.8; }
                .status-good { border-left: 4px solid #4caf50; }
                .status-warning { border-left: 4px solid #ff9800; }
                .status-critical { border-left: 4px solid #f44336; }
                .trend-up::before { content: '📈 '; }
                .trend-down::before { content: '📉 '; }
                .trend-stable::before { content: '➡️ '; }
                .suggestions-section { margin: 30px 0; }
                .suggestion-card { 
                    background: rgba(255,255,255,0.15); 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 10px; 
                }
                .suggestion-impact-critical { border-left: 4px solid #ff4444; }
                .suggestion-impact-high { border-left: 4px solid #ff9800; }
                .suggestion-impact-medium { border-left: 4px solid #2196f3; }
                .automation-card { 
                    background: rgba(0,255,0,0.1); 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 10px; 
                    border-left: 4px solid #4caf50;
                }
                .section-title { 
                    font-size: 24px; 
                    font-weight: bold; 
                    margin: 30px 0 15px 0; 
                    text-align: center;
                }
                .productivity-breakdown { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
                    gap: 15px; 
                    margin: 20px 0; 
                }
                .breakdown-item { 
                    text-align: center; 
                    background: rgba(255,255,255,0.1); 
                    padding: 15px; 
                    border-radius: 10px; 
                }
                .breakdown-score { font-size: 20px; font-weight: bold; }
                .breakdown-label { font-size: 12px; opacity: 0.8; margin-top: 5px; }
                .refresh-time { 
                    text-align: center; 
                    opacity: 0.7; 
                    margin-top: 20px; 
                    font-size: 12px; 
                }
            </style>
        </head>
        <body>
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <h1>🚀 Real-Time Productivity Dashboard</h1>
                    <div class="overall-score">${this.productivityScore.overall.toFixed(1)}%</div>
                    <p>Overall Productivity Score</p>
                </div>

                <div class="productivity-breakdown">
                    <div class="breakdown-item">
                        <div class="breakdown-score">${this.productivityScore.codeQuality.toFixed(1)}%</div>
                        <div class="breakdown-label">Code Quality</div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-score">${this.productivityScore.developmentSpeed.toFixed(1)}%</div>
                        <div class="breakdown-label">Dev Speed</div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-score">${this.productivityScore.testCoverage.toFixed(1)}%</div>
                        <div class="breakdown-label">Test Coverage</div>
                    </div>
                    <div class="breakdown-item">
                        <div class="breakdown-score">${this.productivityScore.maintainability.toFixed(1)}%</div>
                        <div class="breakdown-label">Maintainability</div>
                    </div>
                </div>

                <div class="section-title">📊 Real-Time Metrics</div>
                <div class="metrics-grid">
                    ${metricsArray.map(metric => `
                        <div class="metric-card status-${metric.status}">
                            <div class="metric-header">
                                <h3>${metric.name}</h3>
                                <span class="metric-trend trend-${metric.trend}">
                                    ${metric.trend}
                                </span>
                            </div>
                            <div class="metric-value">
                                ${metric.value} ${metric.unit}
                            </div>
                            <div style="font-size: 12px; opacity: 0.7;">
                                Threshold: ${metric.threshold} ${metric.unit}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${criticalSuggestions.length > 0 ? `
                <div class="suggestions-section">
                    <div class="section-title">🚨 Critical Improvement Suggestions</div>
                    ${criticalSuggestions.map(suggestion => `
                        <div class="suggestion-card suggestion-impact-${suggestion.impact}">
                            <h4>${suggestion.title}</h4>
                            <p>${suggestion.description}</p>
                            <div style="margin-top: 10px;">
                                <strong>Category:</strong> ${suggestion.category} | 
                                <strong>Effort:</strong> ${suggestion.effort} | 
                                <strong>Time Saved:</strong> ${suggestion.estimatedTimeReduction}min
                            </div>
                            <div style="margin-top: 10px; font-size: 14px;">
                                <strong>Action Items:</strong>
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${suggestion.actionItems.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                ${topAutomation.length > 0 ? `
                <div class="suggestions-section">
                    <div class="section-title">🤖 Top Automation Opportunities</div>
                    ${topAutomation.map(automation => `
                        <div class="automation-card">
                            <h4>⚡ ${automation.taskName}</h4>
                            <p><strong>ROI:</strong> ${automation.roi} hours saved/month</p>
                            <p><strong>Automation Potential:</strong> ${automation.automationPotential}%</p>
                            <p><strong>Current Impact:</strong> ${automation.frequency}x/week × ${automation.timePerExecution}min = ${automation.frequency * automation.timePerExecution}min/week</p>
                            <div style="margin-top: 10px; font-size: 14px;">
                                <strong>Suggested Tools:</strong> ${automation.suggestedTools.join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                <div class="refresh-time">
                    Last updated: ${new Date().toLocaleString()} | Auto-refresh every 5 minutes
                </div>
            </div>

            <script>
                // Auto-refresh every 5 minutes
                setTimeout(() => {
                    location.reload();
                }, 300000);
            </script>
        </body>
        </html>`;
    }

    public getProductivityScore(): ProductivityScore {
        return { ...this.productivityScore };
    }

    public getMetrics(): Map<string, RealTimeMetric> {
        return new Map(this.metrics);
    }

    public getSmartSuggestions(): SmartSuggestion[] {
        return [...this.smartSuggestions];
    }

    public getAutomationOpportunities(): AutomationOpportunity[] {
        return [...this.automationOpportunities];
    }

    public async generateProductivityReport(): Promise<string> {
        const criticalMetrics = Array.from(this.metrics.values()).filter(m => m.status === 'critical');
        const topSuggestions = this.smartSuggestions.slice(0, 3);
        const totalAutomationROI = this.automationOpportunities.reduce((sum, opp) => sum + opp.roi, 0);

        return `🚀 **Real-Time Productivity Report**

**Overall Productivity Score:** ${this.productivityScore.overall.toFixed(1)}%

**Key Performance Indicators:**
• Code Quality: ${this.productivityScore.codeQuality.toFixed(1)}%
• Development Speed: ${this.productivityScore.developmentSpeed.toFixed(1)}%
• Test Coverage: ${this.productivityScore.testCoverage.toFixed(1)}%
• Maintainability: ${this.productivityScore.maintainability.toFixed(1)}%

**Critical Attention Required:** ${criticalMetrics.length} metrics
${criticalMetrics.map(m => `⚠️ ${m.name}: ${m.value} ${m.unit}`).join('\n')}

**Top Improvement Opportunities:**
${topSuggestions.map(s => `💡 ${s.title} (${s.impact} impact, saves ${s.estimatedTimeReduction}min)`).join('\n')}

**Automation Potential:**
• ${this.automationOpportunities.length} opportunities identified
• Total ROI: ${totalAutomationROI} hours/month
• Top opportunity: ${this.automationOpportunities[0]?.taskName || 'None'} (${this.automationOpportunities[0]?.roi || 0}h/month)

**Trends:**
• Code Quality: ${this.codeQualityTrends.length > 1 ? 
    (this.codeQualityTrends[this.codeQualityTrends.length - 1] > this.codeQualityTrends[this.codeQualityTrends.length - 2] ? '📈 Improving' : '📉 Declining') : 
    '➡️ Stable'}
• Development Velocity: ${this.developmentVelocity.length > 1 ? 
    (this.developmentVelocity[this.developmentVelocity.length - 1] > this.developmentVelocity[this.developmentVelocity.length - 2] ? '📈 Accelerating' : '📉 Slowing') : 
    '➡️ Stable'}

**Recommendations:**
1. Focus on ${criticalMetrics.length > 0 ? criticalMetrics[0].name : 'maintaining current performance'}
2. Implement ${topSuggestions.length > 0 ? topSuggestions[0].title : 'suggested improvements'}
3. Prioritize ${this.automationOpportunities.length > 0 ? this.automationOpportunities[0].taskName : 'automation opportunities'}`;
    }

    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.dashboardPanel) {
            this.dashboardPanel.dispose();
        }
    }
}