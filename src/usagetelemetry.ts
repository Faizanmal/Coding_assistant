import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface UsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  commandUsage: { [command: string]: number };
  modelUsage: { [model: string]: number };
  tokenUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
  dailyUsage: { [date: string]: number };
  costEstimate: number;
  lastUpdated: number;
}

/**
 * Usage Telemetry System (Opt-in)
 */
export class TelemetryManager {
  private metrics!: UsageMetrics;
  private metricsPath: string;
  private isEnabled: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.metricsPath = path.join(context.globalStoragePath, 'usage-metrics.json');
    this.loadMetrics();
    this.checkTelemetryConsent();
  }

  /**
   * Check if user has consented to telemetry
   */
  private async checkTelemetryConsent() {
    const consent = this.context.globalState.get<boolean>('telemetryConsent');
    
    if (consent === undefined) {
      const response = await vscode.window.showInformationMessage(
        'Would you like to enable usage analytics to help improve the AI Assistant? All data stays local and is used only for insights.',
        'Enable Analytics', 'Keep Disabled', 'Learn More'
      );

      if (response === 'Enable Analytics') {
        this.isEnabled = true;
        await this.context.globalState.update('telemetryConsent', true);
        vscode.window.showInformationMessage('Usage analytics enabled. You can disable this anytime in settings.');
      } else if (response === 'Keep Disabled') {
        this.isEnabled = false;
        await this.context.globalState.update('telemetryConsent', false);
      } else if (response === 'Learn More') {
        this.showTelemetryInfo();
      }
    } else {
      this.isEnabled = consent;
    }
  }

  /**
   * Show telemetry information
   */
  private async showTelemetryInfo() {
    const content = `# AI Assistant Usage Analytics

## What We Track
- Command usage frequency
- Model performance metrics
- Response times and success rates
- Token usage and cost estimates
- Error patterns for improvement

## What We DON'T Track
- Your code content
- Personal information
- File names or paths
- Sensitive data

## Data Storage
- All data stays on your local machine
- No data is sent to external servers
- You can view, export, or delete data anytime
- Data is used only to show you insights

## Benefits
- See your usage patterns
- Track costs and optimize model usage
- Identify most useful features
- Get personalized recommendations

## Privacy
- Completely optional and opt-in
- Can be disabled anytime
- Data never leaves your machine
- Full transparency on what's collected
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Track command usage
   */
  public trackCommand(command: string, success: boolean = true, responseTime: number = 0, model?: string, tokens?: { prompt: number; completion: number }) {
    if (!this.isEnabled) {
      return;
    }

    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / this.metrics.totalRequests;

    // Track command usage
    this.metrics.commandUsage[command] = (this.metrics.commandUsage[command] || 0) + 1;

    // Track model usage
    if (model) {
      this.metrics.modelUsage[model] = (this.metrics.modelUsage[model] || 0) + 1;
    }

    // Track token usage
    if (tokens) {
      this.metrics.tokenUsage.promptTokens += tokens.prompt;
      this.metrics.tokenUsage.completionTokens += tokens.completion;
      this.metrics.tokenUsage.totalTokens += tokens.prompt + tokens.completion;
    }

    // Track daily usage
    const today = new Date().toISOString().split('T')[0];
    this.metrics.dailyUsage[today] = (this.metrics.dailyUsage[today] || 0) + 1;

    // Update cost estimate (rough calculation)
    this.updateCostEstimate();

    this.metrics.lastUpdated = Date.now();
    this.saveMetrics();
  }

  /**
   * Update cost estimate based on usage
   */
  private updateCostEstimate() {
    // Rough cost estimates per 1K tokens (as of 2024)
    const modelCosts: { [key: string]: number } = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'llama-3.3-70b-versatile': 0.001,
      'claude-3-opus': 0.015,
      'mistral-large': 0.008
    };

    let totalCost = 0;
    for (const [model, usage] of Object.entries(this.metrics.modelUsage)) {
      const costPerK = modelCosts[model] || 0.005; // Default estimate
      const tokensUsed = this.metrics.tokenUsage.totalTokens * (usage / this.metrics.totalRequests);
      totalCost += (tokensUsed / 1000) * costPerK;
    }

    this.metrics.costEstimate = totalCost;
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): any {
    if (!this.isEnabled) {
      return { message: 'Telemetry is disabled. Enable in settings to see usage statistics.' };
    }

    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(1)
      : '0';

    const topCommands = Object.entries(this.metrics.commandUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    const topModels = Object.entries(this.metrics.modelUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const recentDays = Object.entries(this.metrics.dailyUsage)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7);

    return {
      overview: {
        totalRequests: this.metrics.totalRequests,
        successRate: `${successRate}%`,
        averageResponseTime: `${this.metrics.averageResponseTime.toFixed(0)}ms`,
        estimatedCost: `$${this.metrics.costEstimate.toFixed(4)}`,
        totalTokens: this.metrics.tokenUsage.totalTokens.toLocaleString()
      },
      topCommands,
      topModels,
      recentDays,
      tokenBreakdown: this.metrics.tokenUsage
    };
  }

  /**
   * Generate insights and recommendations
   */
  public async generateInsights(): Promise<string> {
    if (!this.isEnabled) {
      return 'Telemetry is disabled. Enable to get personalized insights.';
    }

    const stats = this.getUsageStats();
    
    let insights = ['# 📊 AI Assistant Usage Insights\n'];

    // Overview insights
    insights.push('## 📈 Usage Overview');
    insights.push(`- You've made **${stats.overview.totalRequests}** AI requests`);
    insights.push(`- Success rate: **${stats.overview.successRate}**`);
    insights.push(`- Average response time: **${stats.overview.averageResponseTime}**`);
    insights.push(`- Estimated cost: **${stats.overview.estimatedCost}**`);
    insights.push(`- Total tokens used: **${stats.overview.totalTokens}**\n`);

    // Command insights
    if (stats.topCommands.length > 0) {
      insights.push('## 🎯 Most Used Features');
      stats.topCommands.forEach(([command, count]: [string, number]) => {
        const percentage = ((count / this.metrics.totalRequests) * 100).toFixed(1);
        insights.push(`- **${this.formatCommandName(command)}**: ${count} times (${percentage}%)`);
      });
      insights.push('');
    }

    // Model insights
    if (stats.topModels.length > 0) {
      insights.push('## 🤖 Model Usage');
      stats.topModels.forEach(([model, count]: [string, number]) => {
        const percentage = ((count / this.metrics.totalRequests) * 100).toFixed(1);
        insights.push(`- **${model}**: ${count} requests (${percentage}%)`);
      });
      insights.push('');
    }

    // Daily usage pattern
    if (stats.recentDays.length > 0) {
      insights.push('## 📅 Recent Activity');
      stats.recentDays.forEach(([date, count]: [string, number]) => {
        insights.push(`- **${date}**: ${count} requests`);
      });
      insights.push('');
    }

    // Recommendations
    insights.push('## 💡 Recommendations');
    
    if (this.metrics.averageResponseTime > 5000) {
      insights.push('- Consider switching to a faster model for better responsiveness');
    }
    
    if (this.metrics.costEstimate > 1) {
      insights.push('- Your usage suggests considering a subscription plan for better rates');
    }
    
    if (stats.topCommands[0] && stats.topCommands[0][0].includes('fix')) {
      insights.push('- You frequently use fixing commands - consider learning about error prevention techniques');
    }
    
    insights.push('- Try exploring underused features for enhanced productivity');

    return insights.join('\n');
  }

  /**
   * Format command name for display
   */
  private formatCommandName(command: string): string {
    return command
      .replace('coding.', '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Export usage data
   */
  public async exportUsageData(): Promise<void> {
    if (!this.isEnabled) {
      vscode.window.showWarningMessage('Telemetry is disabled.');
      return;
    }

    const data = {
      metrics: this.metrics,
      insights: await this.generateInsights(),
      exportedAt: new Date().toISOString()
    };

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder available for export.');
      return;
    }

    const exportPath = path.join(workspaceFolder.uri.fsPath, 'ai-usage-report.json');
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    
    vscode.window.showInformationMessage(`Usage data exported to ${exportPath}`);
  }

  /**
   * Clear all usage data
   */
  public async clearUsageData(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'This will permanently delete all usage analytics data. Continue?',
      { modal: true },
      'Delete Data', 'Cancel'
    );

    if (confirm === 'Delete Data') {
      this.initializeMetrics();
      this.saveMetrics();
      vscode.window.showInformationMessage('Usage data cleared.');
    }
  }

  /**
   * Toggle telemetry on/off
   */
  public async toggleTelemetry(): Promise<void> {
    this.isEnabled = !this.isEnabled;
    await this.context.globalState.update('telemetryConsent', this.isEnabled);
    
    const status = this.isEnabled ? 'enabled' : 'disabled';
    vscode.window.showInformationMessage(`Usage analytics ${status}.`);
  }

  private initializeMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      commandUsage: {},
      modelUsage: {},
      tokenUsage: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0
      },
      dailyUsage: {},
      costEstimate: 0,
      lastUpdated: Date.now()
    };
  }

  private loadMetrics() {
    if (fs.existsSync(this.metricsPath)) {
      try {
        const data = fs.readFileSync(this.metricsPath, 'utf-8');
        this.metrics = JSON.parse(data);
      } catch (error) {
        console.error('Error loading metrics:', error);
        this.initializeMetrics();
      }
    } else {
      this.initializeMetrics();
    }
  }

  private saveMetrics() {
    if (!fs.existsSync(this.context.globalStoragePath)) {
      fs.mkdirSync(this.context.globalStoragePath, { recursive: true });
    }
    fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
  }
}

export function registerTelemetryCommands(context: vscode.ExtensionContext) {
  const telemetryManager = new TelemetryManager(context);

  const showUsageStatsCommand = vscode.commands.registerCommand('coding.showUsageStats', async () => {
    const stats = telemetryManager.getUsageStats();
    
    if (stats.message) {
      vscode.window.showInformationMessage(stats.message);
      return;
    }

    const content = `# 📊 AI Assistant Usage Statistics

## Overview
- **Total Requests**: ${stats.overview.totalRequests}
- **Success Rate**: ${stats.overview.successRate}
- **Average Response Time**: ${stats.overview.averageResponseTime}
- **Estimated Cost**: ${stats.overview.estimatedCost}
- **Total Tokens**: ${stats.overview.totalTokens}

## Top Commands
${stats.topCommands.map(([cmd, count]: [string, number]) => 
  `- **${cmd}**: ${count} uses`
).join('\n')}

## Model Usage
${stats.topModels.map(([model, count]: [string, number]) => 
  `- **${model}**: ${count} requests`
).join('\n')}

## Recent Daily Usage
${stats.recentDays.map(([date, count]: [string, number]) => 
  `- **${date}**: ${count} requests`
).join('\n')}

## Token Breakdown
- **Prompt Tokens**: ${stats.tokenBreakdown.promptTokens.toLocaleString()}
- **Completion Tokens**: ${stats.tokenBreakdown.completionTokens.toLocaleString()}
- **Total Tokens**: ${stats.tokenBreakdown.totalTokens.toLocaleString()}
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const showInsightsCommand = vscode.commands.registerCommand('coding.showUsageInsights', async () => {
    const insights = await telemetryManager.generateInsights();
    
    const doc = await vscode.workspace.openTextDocument({
      content: insights,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const exportUsageCommand = vscode.commands.registerCommand('coding.exportUsageData', () => {
    telemetryManager.exportUsageData();
  });

  const clearUsageCommand = vscode.commands.registerCommand('coding.clearUsageData', () => {
    telemetryManager.clearUsageData();
  });

  const toggleTelemetryCommand = vscode.commands.registerCommand('coding.toggleTelemetry', () => {
    telemetryManager.toggleTelemetry();
  });

  context.subscriptions.push(
    showUsageStatsCommand,
    showInsightsCommand,
    exportUsageCommand,
    clearUsageCommand,
    toggleTelemetryCommand
  );

  // Export telemetry manager for use by other components
  (context as any).telemetryManager = telemetryManager;
}