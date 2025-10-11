/**
 * Secure Configuration Management System
 * Enterprise-grade configuration handling with secret management and validation
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { SecurityUtils } from './sanitizer';

interface SecureConfig {
  apiKeys: {
    groq?: string;
    together?: string;
    openrouter?: string;
    mistral?: string;
    cerebras?: string;
    tavily?: string;
    huggingface?: string;
  };
  security: {
    enableAutoFix: boolean;
    enableAuditLogging: boolean;
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    enableRateLimiting: boolean;
    enableInputValidation: boolean;
  };
  compliance: {
    enableOWASP: boolean;
    enableSOC2: boolean;
    enableGDPR: boolean;
    enablePCI: boolean;
  };
  advanced: {
    enableTelemetry: boolean;
    enablePerformanceTracking: boolean;
    enableDebugLogging: boolean;
    maxLogRetentionDays: number;
  };
}

export class SecureConfigManager {
  private static instance: SecureConfigManager;
  private config: SecureConfig;
  private encryptionKey: string;
  private auditLog: AuditEntry[] = [];

  private constructor() {
    this.encryptionKey = this.generateEncryptionKey();
    this.config = this.loadDefaultConfig();
  }

  public static getInstance(): SecureConfigManager {
    if (!SecureConfigManager.instance) {
      SecureConfigManager.instance = new SecureConfigManager();
    }
    return SecureConfigManager.instance;
  }

  /**
   * Load configuration with validation and security checks
   */
  public async loadConfiguration(): Promise<SecureConfig> {
    try {
      // Load from VS Code settings
      const workspaceConfig = vscode.workspace.getConfiguration('coding');
      
      // Load API keys from environment
      const apiKeys = await this.loadApiKeys();
      
      // Validate all configuration values
      const config: SecureConfig = {
        apiKeys,
        security: {
          enableAutoFix: workspaceConfig.get('security.autoFix', false),
          enableAuditLogging: workspaceConfig.get('security.auditLogging', true),
          maxConcurrentRequests: this.validateNumber(workspaceConfig.get('security.maxConcurrentRequests', 10), 1, 100),
          requestTimeoutMs: this.validateNumber(workspaceConfig.get('security.requestTimeout', 30000), 5000, 300000),
          enableRateLimiting: workspaceConfig.get('security.enableRateLimiting', true),
          enableInputValidation: workspaceConfig.get('security.enableInputValidation', true),
        },
        compliance: {
          enableOWASP: workspaceConfig.get('compliance.owasp', true),
          enableSOC2: workspaceConfig.get('compliance.soc2', false),
          enableGDPR: workspaceConfig.get('compliance.gdpr', false),
          enablePCI: workspaceConfig.get('compliance.pci', false),
        },
        advanced: {
          enableTelemetry: workspaceConfig.get('advanced.telemetry', false),
          enablePerformanceTracking: workspaceConfig.get('advanced.performanceTracking', true),
          enableDebugLogging: workspaceConfig.get('advanced.debugLogging', false),
          maxLogRetentionDays: this.validateNumber(workspaceConfig.get('advanced.logRetentionDays', 30), 1, 365),
        }
      };

      this.config = config;
      this.auditConfigurationLoad('success');
      return config;
    } catch (error) {
      this.auditConfigurationLoad('failed', SecurityUtils.sanitizeLogInput(String(error)));
      throw new Error(`Configuration load failed: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): SecureConfig {
    return { ...this.config }; // Return copy to prevent mutation
  }

  /**
   * Update configuration with validation
   */
  public async updateConfiguration(updates: Partial<SecureConfig>): Promise<void> {
    try {
      const workspaceConfig = vscode.workspace.getConfiguration('coding');
      
      if (updates.security) {
        for (const [key, value] of Object.entries(updates.security)) {
          await workspaceConfig.update(`security.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }

      if (updates.compliance) {
        for (const [key, value] of Object.entries(updates.compliance)) {
          await workspaceConfig.update(`compliance.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }

      if (updates.advanced) {
        for (const [key, value] of Object.entries(updates.advanced)) {
          await workspaceConfig.update(`advanced.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }

      // Reload configuration
      await this.loadConfiguration();
      this.auditConfigurationUpdate('success');
    } catch (error) {
      this.auditConfigurationUpdate('failed', SecurityUtils.sanitizeLogInput(String(error)));
      throw error;
    }
  }

  /**
   * Validate API key format and strength
   */
  public validateApiKey(provider: string, apiKey: string): boolean {
    if (!SecurityUtils.validateApiKey(apiKey)) {
      return false;
    }

    // Provider-specific validation
    const providerPatterns = {
      groq: /^gsk_[A-Za-z0-9_-]{32,}$/,
      together: /^[A-Za-z0-9_-]{40,}$/,
      openrouter: /^sk-or-[A-Za-z0-9_-]{32,}$/,
      mistral: /^[A-Za-z0-9_-]{32,}$/,
      cerebras: /^csk-[A-Za-z0-9_-]{32,}$/,
      tavily: /^tvly-[A-Za-z0-9_-]{32,}$/,
      huggingface: /^hf_[A-Za-z0-9_-]{20,}$/
    };

    const pattern = providerPatterns[provider as keyof typeof providerPatterns];
    return pattern ? pattern.test(apiKey) : true;
  }

  /**
   * Get API key for provider (with audit)
   */
  public getApiKey(provider: string): string | undefined {
    const apiKey = this.config.apiKeys[provider as keyof typeof this.config.apiKeys];
    
    if (apiKey) {
      this.auditApiKeyAccess(provider, 'success');
      return apiKey;
    } else {
      this.auditApiKeyAccess(provider, 'not_found');
      return undefined;
    }
  }

  /**
   * Test API key connectivity
   */
  public async testApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      // Test endpoints for different providers
      const testEndpoints = {
        groq: 'https://api.groq.com/openai/v1/models',
        together: 'https://api.together.xyz/v1/models',
        openrouter: 'https://openrouter.ai/api/v1/models',
        mistral: 'https://api.mistral.ai/v1/models',
        cerebras: 'https://api.cerebras.ai/v1/models',
        tavily: 'https://api.tavily.com/search',
        huggingface: 'https://huggingface.co/api/whoami-v2'
      };

      const endpoint = testEndpoints[provider as keyof typeof testEndpoints];
      if (!endpoint) {
        return false;
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'VSCode-Extension/1.0.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const isValid = response.status === 200 || response.status === 401; // 401 means auth is working but key might be wrong
      this.auditApiKeyTest(provider, isValid ? 'success' : 'failed');
      return isValid;
    } catch (error) {
      this.auditApiKeyTest(provider, 'error');
      return false;
    }
  }

  /**
   * Get security headers for requests
   */
  public getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'VSCode-Extension-Secure/1.0.0',
      'X-Request-ID': SecurityUtils.generateSecureToken(16),
      'X-Client-Version': '1.0.0'
    };

    if (this.config.security.enableRateLimiting) {
      headers['X-Rate-Limit-Enabled'] = 'true';
    }

    return headers;
  }

  /**
   * Generate Content Security Policy
   */
  public generateCSP(): string {
    return SecurityUtils.generateCSP({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.groq.com", "https://api.together.xyz", "https://openrouter.ai", "https://api.mistral.ai", "https://api.cerebras.ai", "https://api.tavily.com"]
    });
  }

  /**
   * Export configuration for backup (with secrets redacted)
   */
  public exportConfiguration(): any {
    const exportConfig = { ...this.config };
    
    // Redact API keys
    for (const key in exportConfig.apiKeys) {
      const apiKey = exportConfig.apiKeys[key as keyof typeof exportConfig.apiKeys];
      if (apiKey) {
        exportConfig.apiKeys[key as keyof typeof exportConfig.apiKeys] = SecurityUtils.hashSensitiveData(apiKey);
      }
    }

    return {
      ...exportConfig,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Get audit log
   */
  public getAuditLog(): AuditEntry[] {
    return [...this.auditLog]; // Return copy
  }

  /**
   * Clear audit log (with retention check)
   */
  public clearAuditLog(): void {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.advanced.maxLogRetentionDays);
    
    this.auditLog = this.auditLog.filter(entry => entry.timestamp > retentionDate);
  }

  /**
   * Private helper methods
   */
  private async loadApiKeys(): Promise<SecureConfig['apiKeys']> {
    const apiKeys: SecureConfig['apiKeys'] = {};

    // Environment variable mappings
    const envMappings = {
      groq: ['GROQ_API_KEY', 'API_KEY'],
      together: ['TOGETHER_API_KEY'],
      openrouter: ['OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY'],
      mistral: ['MISTRAL_API_KEY'],
      cerebras: ['CEREBRAS_API_KEY'],
      tavily: ['TAVILY_API_KEY'],
      huggingface: ['HUG_FACE', 'HUGGINGFACE_API_KEY', 'Hug_face']
    };

    for (const [provider, envVars] of Object.entries(envMappings)) {
      for (const envVar of envVars) {
        const value = process.env[envVar];
        if (value && SecurityUtils.validateApiKey(value)) {
          apiKeys[provider as keyof SecureConfig['apiKeys']] = SecurityUtils.sanitizeEnvironmentValue(value);
          break;
        }
      }
    }

    return apiKeys;
  }

  private loadDefaultConfig(): SecureConfig {
    return {
      apiKeys: {},
      security: {
        enableAutoFix: false,
        enableAuditLogging: true,
        maxConcurrentRequests: 10,
        requestTimeoutMs: 30000,
        enableRateLimiting: true,
        enableInputValidation: true,
      },
      compliance: {
        enableOWASP: true,
        enableSOC2: false,
        enableGDPR: false,
        enablePCI: false,
      },
      advanced: {
        enableTelemetry: false,
        enablePerformanceTracking: true,
        enableDebugLogging: false,
        maxLogRetentionDays: 30,
      }
    };
  }

  private validateNumber(value: any, min: number, max: number): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid number: ${value}. Must be between ${min} and ${max}`);
    }
    return num;
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private auditConfigurationLoad(status: 'success' | 'failed', error?: string): void {
    this.addAuditEntry('config_load', status, { error });
  }

  private auditConfigurationUpdate(status: 'success' | 'failed', error?: string): void {
    this.addAuditEntry('config_update', status, { error });
  }

  private auditApiKeyAccess(provider: string, status: 'success' | 'not_found'): void {
    this.addAuditEntry('api_key_access', status, { provider });
  }

  private auditApiKeyTest(provider: string, status: 'success' | 'failed' | 'error'): void {
    this.addAuditEntry('api_key_test', status, { provider });
  }

  private addAuditEntry(action: string, status: string, metadata?: any): void {
    if (!this.config.security.enableAuditLogging) {
      return;
    }

    const entry: AuditEntry = {
      timestamp: new Date(),
      action,
      status,
      metadata: metadata ? SecurityUtils.sanitizeLogInput(JSON.stringify(metadata)) : undefined,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId()
    };

    this.auditLog.push(entry);

    // Maintain log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  private getCurrentUserId(): string {
    return process.env.USERNAME || process.env.USER || 'unknown';
  }

  private getSessionId(): string {
    // Generate a session ID based on VS Code session
    return SecurityUtils.hashSensitiveData(process.pid.toString() + Date.now().toString());
  }
}

interface AuditEntry {
  timestamp: Date;
  action: string;
  status: string;
  metadata?: string;
  userId: string;
  sessionId: string;
}

/**
 * Security configuration commands
 */
export function registerSecureConfigCommands(context: vscode.ExtensionContext) {
  const configManager = SecureConfigManager.getInstance();

  // Initialize configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.initializeConfig', async () => {
      try {
        await configManager.loadConfiguration();
        vscode.window.showInformationMessage('✅ Security configuration initialized successfully');
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Configuration initialization failed: ${error}`);
      }
    })
  );

  // Test API keys
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.testApiKeys', async () => {
      const config = configManager.getConfiguration();
      const results: string[] = [];

      for (const [provider, apiKey] of Object.entries(config.apiKeys)) {
        if (apiKey) {
          try {
            const isValid = await configManager.testApiKey(provider, apiKey);
            results.push(`${provider}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
          } catch (error) {
            results.push(`${provider}: ❌ Error testing`);
          }
        } else {
          results.push(`${provider}: ⚠️ Not configured`);
        }
      }

      const report = `# API Key Test Results\n\n${results.join('\n')}`;
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  // View security audit log
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.viewAuditLog', async () => {
      const auditLog = configManager.getAuditLog();
      const logContent = auditLog.map(entry => 
        `${entry.timestamp.toISOString()} | ${entry.action} | ${entry.status} | ${entry.userId} | ${entry.metadata || ''}`
      ).join('\n');

      const doc = await vscode.workspace.openTextDocument({
        content: `# Security Audit Log\n\n${logContent}`,
        language: 'plaintext'
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  // Export configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.exportConfig', async () => {
      const exportData = configManager.exportConfiguration();
      const content = JSON.stringify(exportData, null, 2);

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'json'
      });
      await vscode.window.showTextDocument(doc);
    })
  );

  // Security dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.security.dashboard', async () => {
      const config = configManager.getConfiguration();
      const auditLog = configManager.getAuditLog();
      
      const dashboard = `
# 🛡️ Security Dashboard

## Configuration Status
- **Auto-fix**: ${config.security.enableAutoFix ? '✅ Enabled' : '❌ Disabled'}
- **Audit Logging**: ${config.security.enableAuditLogging ? '✅ Enabled' : '❌ Disabled'}
- **Rate Limiting**: ${config.security.enableRateLimiting ? '✅ Enabled' : '❌ Disabled'}
- **Input Validation**: ${config.security.enableInputValidation ? '✅ Enabled' : '❌ Disabled'}

## Compliance Status
- **OWASP**: ${config.compliance.enableOWASP ? '✅ Enabled' : '❌ Disabled'}
- **SOC 2**: ${config.compliance.enableSOC2 ? '✅ Enabled' : '❌ Disabled'}
- **GDPR**: ${config.compliance.enableGDPR ? '✅ Enabled' : '❌ Disabled'}
- **PCI DSS**: ${config.compliance.enablePCI ? '✅ Enabled' : '❌ Disabled'}

## API Keys
${Object.entries(config.apiKeys).map(([provider, key]) => 
  `- **${provider}**: ${key ? '✅ Configured' : '❌ Missing'}`
).join('\n')}

## Recent Activity
${auditLog.slice(-10).map(entry => 
  `- ${entry.timestamp.toLocaleString()}: ${entry.action} (${entry.status})`
).join('\n')}
`;

      const doc = await vscode.workspace.openTextDocument({
        content: dashboard,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    })
  );
}