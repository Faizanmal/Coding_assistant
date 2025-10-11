import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

interface ProviderConfig {
  name: string;
  endpoint: string;
  apiKey: string;
  models: string[];
  priority: number;
  active: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  currentUsage: {
    requestsThisMinute: number;
    requestsToday: number;
    lastRequest: number;
    successRate: number;
    averageLatency: number;
    totalRequests: number;
    totalSuccesses: number;
  };
  capabilities?: {
    streaming: boolean;
    functions: boolean;
    vision: boolean;
    longContext: boolean;
    maxContextLength?: number;
  };
  costPerToken?: {
    input: number;
    output: number;
  };
}

/**
 * Automatic Provider Fallback System
 */
export class ProviderFallbackManager {
  private providers: ProviderConfig[] = [];
  private fallbackQueue: string[] = [];

  private statusBarItem!: vscode.StatusBarItem;
  private telemetryData: Map<string, any> = new Map();
  private optimizationInterval: NodeJS.Timeout | null = null;
  
  constructor(private context: vscode.ExtensionContext) {
    this.initializeProviders();
    this.loadConfiguration();
    this.setupStatusBar();
    this.startOptimizationRoutine();
    
    // Register event listeners for provider health monitoring
    this.setupHealthMonitoring();
  }

  private setupStatusBar() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'coding.providerStatus';
    this.statusBarItem.tooltip = 'AI Provider Status';
    this.updateStatusBar();
    this.statusBarItem.show();
    this.context.subscriptions.push(this.statusBarItem);
  }
  
  private updateStatusBar() {
    const activeProvider = this.providers.find(p => p.active && p.priority === Math.min(...this.providers.filter(p => p.active).map(p => p.priority)));
    if (activeProvider) {
      this.statusBarItem.text = `$(sparkle) ${activeProvider.name}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.text = '$(alert) No AI Provider';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  }
  
  private setupHealthMonitoring() {
    // Setup periodic ping to all providers
    const pingInterval = setInterval(async () => {
      for (const provider of this.providers) {
        if (provider.active) {
          try {
            const available = await this.isProviderAvailable(provider);
            // Update telemetry data
            this.telemetryData.set(`${provider.name}_available`, available);
            this.telemetryData.set(`${provider.name}_last_check`, new Date().toISOString());
          } catch (error) {
            // Provider health check failed
          }
        }
      }
      this.updateStatusBar();
    }, 60000); // Check every minute
    
    this.context.subscriptions.push({ dispose: () => clearInterval(pingInterval) });
  }
  
  private startOptimizationRoutine() {
    // Dynamically optimize provider selection based on performance metrics
    this.optimizationInterval = setInterval(() => {
      this.optimizeProviderPriorities();
    }, 300000); // Every 5 minutes
    
    this.context.subscriptions.push({ dispose: () => {
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
      }
    }});
  }
  
  private optimizeProviderPriorities() {
    // Sort providers based on success rate, latency and cost efficiency
    const activeProviders = this.providers.filter(p => p.active && p.currentUsage.totalRequests > 0);
    
    if (activeProviders.length < 2) { return; } // Nothing to optimize if fewer than 2 active providers
    
    // Calculate score for each provider based on multiple factors
    const providerScores = activeProviders.map(provider => {
      const successRate = provider.currentUsage.successRate || 0.5;
      const latencyScore = provider.currentUsage.averageLatency ? (1000 / provider.currentUsage.averageLatency) : 0.5;
      const usageScore = (provider.rateLimits.requestsPerMinute - provider.currentUsage.requestsThisMinute) / provider.rateLimits.requestsPerMinute;
      
      // Combined score with weightings
      const score = (successRate * 0.5) + (latencyScore * 0.3) + (usageScore * 0.2);
      
      return { provider, score };
    });
    
    // Sort by score descending
    providerScores.sort((a, b) => b.score - a.score);
    
    // Reassign priorities based on score
    providerScores.forEach((item, index) => {
      item.provider.priority = index + 1;
    });
    
    // Save the optimized configuration
    this.saveConfiguration();
    this.updateStatusBar();
  }
  
  private initializeProviders() {
    this.providers = [
      {
        name: 'groq',
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: '',
        models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
        priority: 1,
        active: true,
        rateLimits: { requestsPerMinute: 30, requestsPerDay: 14400 },
        currentUsage: { 
          requestsThisMinute: 0, 
          requestsToday: 0, 
          lastRequest: 0,
          successRate: 1.0,
          averageLatency: 0,
          totalRequests: 0,
          totalSuccesses: 0
        },
        capabilities: {
          streaming: true,
          functions: true,
          vision: false,
          longContext: true,
          maxContextLength: 32768
        },
        costPerToken: {
          input: 0.0000005,
          output: 0.0000015
        }
      },
      {
        name: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'],
        priority: 2,
        active: true,
        rateLimits: { requestsPerMinute: 60, requestsPerDay: 10000 },
        currentUsage: { 
          requestsThisMinute: 0, 
          requestsToday: 0, 
          lastRequest: 0,
          successRate: 1.0,
          averageLatency: 0,
          totalRequests: 0,
          totalSuccesses: 0
        },
        capabilities: {
          streaming: true,
          functions: true,
          vision: true,
          longContext: true,
          maxContextLength: 128000
        },
        costPerToken: {
          input: 0.00001,
          output: 0.00003
        }
      },
      {
        name: 'mistral',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        apiKey: '',
        models: ['mistral-large', 'mistral-medium'],
        priority: 3,
        active: true,
        rateLimits: { requestsPerMinute: 20, requestsPerDay: 1000 },
        currentUsage: { 
          requestsThisMinute: 0, 
          requestsToday: 0, 
          lastRequest: 0,
          successRate: 1.0,
          averageLatency: 0,
          totalRequests: 0,
          totalSuccesses: 0
        },
        capabilities: {
          streaming: true,
          functions: true,
          vision: false,
          longContext: true,
          maxContextLength: 32768
        },
        costPerToken: {
          input: 0.000007,
          output: 0.000021
        }
      },
      {
        name: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: '',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        priority: 4,
        active: false,
        rateLimits: { requestsPerMinute: 50, requestsPerDay: 1000 },
        currentUsage: { 
          requestsThisMinute: 0, 
          requestsToday: 0, 
          lastRequest: 0,
          successRate: 1.0,
          averageLatency: 0,
          totalRequests: 0,
          totalSuccesses: 0
        },
        capabilities: {
          streaming: true,
          functions: true,
          vision: true,
          longContext: true,
          maxContextLength: 200000
        },
        costPerToken: {
          input: 0.000015,
          output: 0.000075
        }
      }
    ];
  }

  /**
   * Get the best available provider based on priority and availability
   */
  public async getBestProvider(): Promise<ProviderConfig | null> {
    // Sort by priority and filter active providers
    const availableProviders = this.providers
      .filter(p => p.active)
      .sort((a, b) => a.priority - b.priority);

    for (const provider of availableProviders) {
      if (await this.isProviderAvailable(provider)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Execute request with automatic fallback
   */
  public async executeWithFallback(prompt: string, options: any = {}): Promise<string | null> {
    const maxAttempts = this.providers.filter(p => p.active).length;
    let attempt = 0;

    while (attempt < maxAttempts) {
      const provider = await this.getBestProvider();
      
      if (!provider) {
        vscode.window.showErrorMessage('No available providers');
        return null;
      }

      try {
        const result = await this.executeRequest(provider, prompt, options);
        this.recordSuccess(provider);
        return result;
      } catch (error) {
        attempt++;
        this.recordFailure(provider, error as Error);
        
        if (attempt < maxAttempts) {
          vscode.window.showWarningMessage(`Provider ${provider.name} failed, trying fallback...`);
          // Move failed provider to end of queue temporarily
          this.temporaryDowngrade(provider);
        }
      }
    }

    vscode.window.showErrorMessage('All providers failed');
    return null;
  }

  /**
   * Check if provider is available and within rate limits
   */
  private async isProviderAvailable(provider: ProviderConfig): Promise<boolean> {
    const now = Date.now();
    
    // Reset minute counter if needed
    if (now - provider.currentUsage.lastRequest > 60000) {
      provider.currentUsage.requestsThisMinute = 0;
    }

    // Reset daily counter if needed
    const dayStart = new Date().setHours(0, 0, 0, 0);
    if (provider.currentUsage.lastRequest < dayStart) {
      provider.currentUsage.requestsToday = 0;
    }

    // Check rate limits
    if (provider.currentUsage.requestsThisMinute >= provider.rateLimits.requestsPerMinute) {
      return false;
    }

    if (provider.currentUsage.requestsToday >= provider.rateLimits.requestsPerDay) {
      return false;
    }

    // Test provider connectivity (simple ping)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(provider.endpoint, {
        method: 'OPTIONS',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok || response.status === 405; // 405 is acceptable for OPTIONS
    } catch {
      return false;
    }
  }

  /**
   * Execute request against specific provider
   */
  private async executeRequest(provider: ProviderConfig, prompt: string, options: any): Promise<string> {
    this.recordUsage(provider);

    const requestBody = {
      model: provider.models[0], // Use first available model
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    };

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (provider.name === 'anthropic') {
      return data.content?.[0]?.text || '';
    } else {
      return data.choices?.[0]?.message?.content || '';
    }
  }

  private recordUsage(provider: ProviderConfig) {
    const now = Date.now();
    provider.currentUsage.requestsThisMinute++;
    provider.currentUsage.requestsToday++;
    provider.currentUsage.lastRequest = now;
  }

  private recordSuccess(provider: ProviderConfig) {
    // Could implement success tracking here
    console.log(`Provider ${provider.name} succeeded`);
  }

  private recordFailure(provider: ProviderConfig, error: Error) {
    console.error(`Provider ${provider.name} failed:`, error.message);
    
    // Temporarily reduce priority for failing provider
    provider.priority += 10;
    
    // Reset priority after some time
    setTimeout(() => {
      provider.priority = Math.max(1, provider.priority - 10);
    }, 300000); // 5 minutes
  }

  private temporaryDowngrade(provider: ProviderConfig) {
    provider.priority += 100;
    
    // Reset after 1 minute
    setTimeout(() => {
      provider.priority = Math.max(1, provider.priority - 100);
    }, 60000);
  }

  /**
   * Get provider status for UI
   */
  public getProviderStatus(): any[] {
    return this.providers.map(provider => ({
      name: provider.name,
      active: provider.active,
      priority: provider.priority,
      models: provider.models,
      successRate: provider.currentUsage.successRate,
      averageLatency: provider.currentUsage.averageLatency,
      capabilities: provider.capabilities,
      costPerToken: provider.costPerToken,
      usage: {
        minuteUsage: `${provider.currentUsage.requestsThisMinute}/${provider.rateLimits.requestsPerMinute}`,
        dailyUsage: `${provider.currentUsage.requestsToday}/${provider.rateLimits.requestsPerDay}`
      }
    }));
  }

  /**
   * Configure provider settings
   */
  public async configureProvider(providerName: string, config: Partial<ProviderConfig>) {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      Object.assign(provider, config);
      await this.saveConfiguration();
    }
  }

  private async saveConfiguration() {
    await this.context.globalState.update('providerConfigs', this.providers);
  }

  private async loadConfiguration() {
    const saved = this.context.globalState.get<ProviderConfig[]>('providerConfigs');
    if (saved) {
      this.providers = saved;
    }
  }
}

export function registerProviderFallbackCommands(context: vscode.ExtensionContext) {
  const fallbackManager = new ProviderFallbackManager(context);

  const configureProvidersCommand = vscode.commands.registerCommand('coding.configureProviders', async () => {
    const providerStatus = fallbackManager.getProviderStatus();
    
    const content = `# Provider Configuration

${providerStatus.map(provider => `
## ${provider.name.toUpperCase()}
- **Status**: ${provider.active ? '🟢 Active' : '🔴 Inactive'}
- **Priority**: ${provider.priority}
- **Models**: ${provider.models.join(', ')}
- **Usage**: ${provider.usage.minuteUsage} per minute, ${provider.usage.dailyUsage} per day
`).join('')}

## How to Configure
1. Set API keys in VS Code settings
2. Enable/disable providers as needed
3. Adjust priority orders
4. Configure rate limits per provider
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  const testFallbackCommand = vscode.commands.registerCommand('coding.testProviderFallback', async () => {
    const testPrompt = 'Hello, this is a test message. Please respond briefly.';
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Testing provider fallback...',
      cancellable: false
    }, async () => {
      try {
        const result = await fallbackManager.executeWithFallback(testPrompt);
        if (result) {
          vscode.window.showInformationMessage(`Fallback test successful: ${result.slice(0, 50)}...`);
        } else {
          vscode.window.showErrorMessage('Fallback test failed - no providers available');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Fallback test error: ${error}`);
      }
    });
  });

  const providerStatusCommand = vscode.commands.registerCommand('coding.providerStatus', async () => {
    const status = fallbackManager.getProviderStatus();
    const content = `# Provider Status Dashboard

${status.map(provider => `
## ${provider.name}
- Active: ${provider.active ? '✅' : '❌'}
- Priority: ${provider.priority}
- Models: ${provider.models.join(', ')}
- Usage: ${provider.usage.minuteUsage} requests this minute
- Daily: ${provider.usage.dailyUsage} requests today
`).join('')}
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(configureProvidersCommand, testFallbackCommand, providerStatusCommand);
  
  // Export fallback manager for use by other components
  (context as any).providerFallbackManager = fallbackManager;
}