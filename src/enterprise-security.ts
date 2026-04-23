import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

/**
 * Enterprise-grade Security and Compliance Management System
 * Provides RBAC, audit logging, compliance scanning, encrypted storage, and API security
 */

export interface User {
    id: string;
    email: string;
    name: string;
    roles: string[];
    permissions: string[];
    organizationId: string;
    lastLogin?: Date;
    isActive: boolean;
}

export interface SecurityEvent {
    id: string;
    userId: string;
    action: string;
    resource: string;
    timestamp: Date;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: any;
    ipAddress?: string;
    userAgent?: string;
}

export interface ComplianceRule {
    id: string;
    name: string;
    standard: 'SOX' | 'GDPR' | 'PCI' | 'HIPAA' | 'ISO27001';
    description: string;
    checkFunction: (codeContent: string, filePath: string) => Promise<ComplianceViolation[]>;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ComplianceViolation {
    ruleId: string;
    filePath: string;
    line?: number;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    remediation: string;
    evidenceHash: string;
}

export interface AuditLog {
    id: string;
    timestamp: Date;
    userId: string;
    action: string;
    resource: string;
    before?: any;
    after?: any;
    metadata: Record<string, any>;
    success: boolean;
    errorMessage?: string;
}

export class EnterpriseSecurityManager {
    private users: Map<string, User> = new Map();
    private auditLogs: AuditLog[] = [];
    private securityEvents: SecurityEvent[] = [];
    private complianceRules: Map<string, ComplianceRule> = new Map();
    private encryptionKey: Buffer;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.encryptionKey = crypto.randomBytes(32);
        this.initializeDefaultRoles();
        this.initializeComplianceRules();
        this.setupSecurityMonitoring();
    }

    /**
     * Initialize default roles and permissions
     */
    private initializeDefaultRoles(): void {
        // Define enterprise role hierarchy
        const roles = {
            'super-admin': ['*'],
            'admin': ['user:*', 'project:*', 'security:read', 'audit:read'],
            'team-lead': ['project:read', 'project:write', 'user:read', 'security:read'],
            'developer': ['project:read', 'code:read', 'code:write'],
            'viewer': ['project:read', 'code:read'],
            'guest': ['project:read']
        };

        // Store in encrypted format
        this.storeSecureData('roles', roles);
    }

    /**
     * Initialize compliance rules for major standards
     */
    private initializeComplianceRules(): void {
        // GDPR Compliance Rules
        this.complianceRules.set('gdpr-001', {
            id: 'gdpr-001',
            name: 'Personal Data Processing',
            standard: 'GDPR',
            description: 'Detect personal data processing without proper consent mechanisms',
            severity: 'HIGH',
            checkFunction: async (code: string, filePath: string) => {
                const violations: ComplianceViolation[] = [];
                const personalDataPatterns = [
                    /email.*=.*req\.|email.*=.*input/gi,
                    /phone.*=.*req\.|phone.*=.*input/gi,
                    /address.*=.*req\.|address.*=.*input/gi,
                    /ssn|social.*security/gi
                ];

                personalDataPatterns.forEach((pattern, index) => {
                    const matches = Array.from(code.matchAll(pattern));
                    matches.forEach(match => {
                        const lineNumber = code.substring(0, match.index).split('\n').length;
                        violations.push({
                            ruleId: 'gdpr-001',
                            filePath,
                            line: lineNumber,
                            message: 'Personal data collection detected without explicit consent handling',
                            severity: 'HIGH',
                            remediation: 'Implement proper consent mechanisms and data protection measures',
                            evidenceHash: crypto.createHash('sha256').update(match[0]).digest('hex')
                        });
                    });
                });

                return violations;
            }
        });

        // SOX Compliance Rules
        this.complianceRules.set('sox-001', {
            id: 'sox-001',
            name: 'Financial Data Access Control',
            standard: 'SOX',
            description: 'Ensure financial data access is properly controlled and audited',
            severity: 'CRITICAL',
            checkFunction: async (code: string, filePath: string) => {
                const violations: ComplianceViolation[] = [];
                const financialPatterns = [
                    /revenue|income|profit|loss|financial/gi,
                    /transaction.*amount|payment.*amount/gi,
                    /bank.*account|credit.*card/gi
                ];

                if (filePath.includes('financial') || filePath.includes('billing')) {
                    const hasAccessControl = /auth|permission|role|access.*control/gi.test(code);
                    const hasAuditLog = /audit|log.*action|track.*change/gi.test(code);

                    if (!hasAccessControl || !hasAuditLog) {
                        violations.push({
                            ruleId: 'sox-001',
                            filePath,
                            message: 'Financial data access requires proper authorization and audit logging',
                            severity: 'CRITICAL',
                            remediation: 'Implement role-based access control and comprehensive audit logging',
                            evidenceHash: crypto.createHash('sha256').update(filePath).digest('hex')
                        });
                    }
                }

                return violations;
            }
        });

        // PCI DSS Compliance Rules
        this.complianceRules.set('pci-001', {
            id: 'pci-001',
            name: 'Credit Card Data Protection',
            standard: 'PCI',
            description: 'Ensure credit card data is properly encrypted and not stored inappropriately',
            severity: 'CRITICAL',
            checkFunction: async (code: string, filePath: string) => {
                const violations: ComplianceViolation[] = [];
                const cardPatterns = [
                    /\b4[0-9]{12}(?:[0-9]{3})?\b/g, // Visa
                    /\b5[1-5][0-9]{14}\b/g, // MasterCard
                    /\b3[47][0-9]{13}\b/g, // American Express
                    /card.*number|credit.*card|cvv|security.*code/gi
                ];

                cardPatterns.forEach(pattern => {
                    const matches = Array.from(code.matchAll(pattern));
                    matches.forEach(match => {
                        const lineNumber = code.substring(0, match.index).split('\n').length;
                        violations.push({
                            ruleId: 'pci-001',
                            filePath,
                            line: lineNumber,
                            message: 'Potential credit card data found in code',
                            severity: 'CRITICAL',
                            remediation: 'Remove credit card data from code and implement proper encryption',
                            evidenceHash: crypto.createHash('sha256').update(match[0]).digest('hex')
                        });
                    });
                });

                return violations;
            }
        });
    }

    /**
     * Setup real-time security monitoring
     */
    private setupSecurityMonitoring(): void {
        // Monitor file changes for security violations
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidChange(async (uri) => {
            await this.scanFileForSecurityIssues(uri.fsPath);
        });

        watcher.onDidCreate(async (uri) => {
            await this.scanFileForSecurityIssues(uri.fsPath);
        });

        this.context.subscriptions.push(watcher);
    }

    /**
     * Authenticate user with enterprise SSO
     */
    async authenticateUser(email: string, token: string): Promise<User | null> {
        try {
            // Simulate SSO authentication
            const user: User = {
                id: crypto.randomUUID(),
                email,
                name: email.split('@')[0],
                roles: ['developer'],
                permissions: ['project:read', 'code:read', 'code:write'],
                organizationId: 'org-1',
                lastLogin: new Date(),
                isActive: true
            };

            this.users.set(user.id, user);
            
            await this.logSecurityEvent({
                id: crypto.randomUUID(),
                userId: user.id,
                action: 'user_login',
                resource: 'authentication',
                timestamp: new Date(),
                severity: 'LOW',
                details: { method: 'sso', email }
            });

            return user;
        } catch (error) {
            await this.logSecurityEvent({
                id: crypto.randomUUID(),
                userId: 'unknown',
                action: 'login_failed',
                resource: 'authentication',
                timestamp: new Date(),
                severity: 'MEDIUM',
                details: { email, error: error.message }
            });
            return null;
        }
    }

    /**
     * Check user permissions for resource access
     */
    hasPermission(userId: string, permission: string, resource?: string): boolean {
        const user = this.users.get(userId);
        if (!user || !user.isActive) {
            return false;
        }

        // Super admin has all permissions
        if (user.permissions.includes('*')) {
            return true;
        }

        // Check specific permission
        if (user.permissions.includes(permission)) {
            return true;
        }

        // Check wildcard permissions
        const permissionParts = permission.split(':');
        const wildcardPermission = `${permissionParts[0]}:*`;
        return user.permissions.includes(wildcardPermission);
    }

    /**
     * Log security event
     */
    async logSecurityEvent(event: SecurityEvent): Promise<void> {
        this.securityEvents.push(event);

        // Store in encrypted format
        await this.storeSecureData('security_events', this.securityEvents);

        // Alert on critical events
        if (event.severity === 'CRITICAL') {
            vscode.window.showErrorMessage(`🚨 Critical Security Event: ${event.action}`);
        }
    }

    /**
     * Log audit trail
     */
    async logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
        const auditLog: AuditLog = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            ...log
        };

        this.auditLogs.push(auditLog);
        await this.storeSecureData('audit_logs', this.auditLogs);
    }

    /**
     * Scan file for compliance violations
     */
    async scanFileForCompliance(filePath: string): Promise<ComplianceViolation[]> {
        const violations: ComplianceViolation[] = [];

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Run all compliance rules
            for (const rule of this.complianceRules.values()) {
                const ruleViolations = await rule.checkFunction(content, filePath);
                violations.push(...ruleViolations);
            }

            // Log compliance scan
            await this.logAudit({
                userId: 'system',
                action: 'compliance_scan',
                resource: filePath,
                metadata: { violations: violations.length },
                success: true
            });

        } catch (error) {
            await this.logAudit({
                userId: 'system',
                action: 'compliance_scan',
                resource: filePath,
                metadata: {},
                success: false,
                errorMessage: error.message
            });
        }

        return violations;
    }

    /**
     * Scan file for security issues
     */
    async scanFileForSecurityIssues(filePath: string): Promise<void> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const securityIssues = await this.detectSecurityIssues(content, filePath);

            if (securityIssues.length > 0) {
                await this.logSecurityEvent({
                    id: crypto.randomUUID(),
                    userId: 'system',
                    action: 'security_issues_detected',
                    resource: filePath,
                    timestamp: new Date(),
                    severity: 'HIGH',
                    details: { issues: securityIssues }
                });
            }
        } catch (error) {
            // Handle error silently or log
        }
    }

    /**
     * Detect security issues in code
     */
    private async detectSecurityIssues(content: string, filePath: string): Promise<any[]> {
        const issues = [];
        
        // Common security patterns
        const securityPatterns = [
            { pattern: /password.*=.*["'][^"']+["']/gi, type: 'hardcoded_password' },
            { pattern: /api.*key.*=.*["'][^"']+["']/gi, type: 'hardcoded_api_key' },
            { pattern: /eval\s*\(/gi, type: 'code_injection' },
            { pattern: /innerHTML\s*=/gi, type: 'xss_vulnerability' },
            { pattern: /document\.write\s*\(/gi, type: 'xss_vulnerability' },
            { pattern: /exec\s*\(/gi, type: 'command_injection' },
            { pattern: /system\s*\(/gi, type: 'command_injection' }
        ];

        securityPatterns.forEach(({ pattern, type }) => {
            const matches = Array.from(content.matchAll(pattern));
            matches.forEach(match => {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                issues.push({
                    type,
                    line: lineNumber,
                    content: match[0],
                    severity: 'HIGH'
                });
            });
        });

        return issues;
    }

    /**
     * Store data securely with encryption
     */
    private async storeSecureData(key: string, data: any): Promise<void> {
        const serialized = JSON.stringify(data);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        let encrypted = cipher.update(serialized, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        await this.context.globalState.update(`secure_${key}`, encrypted);
    }

    /**
     * Retrieve and decrypt stored data
     */
    private async getSecureData(key: string): Promise<any> {
        const encrypted = this.context.globalState.get(`secure_${key}`) as string;
        if (!encrypted) {
            return null;
        }

        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        const violations: ComplianceViolation[] = [];
        const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java,php,rb}');

        // Scan all files
        for (const file of files) {
            const fileViolations = await this.scanFileForCompliance(file.fsPath);
            violations.push(...fileViolations);
        }

        // Generate report
        const report = await this.createComplianceReport(violations);
        return report;
    }

    /**
     * Create detailed compliance report
     */
    private async createComplianceReport(violations: ComplianceViolation[]): Promise<string> {
        const standards = ['GDPR', 'SOX', 'PCI', 'HIPAA', 'ISO27001'];
        const reportData = {
            timestamp: new Date().toISOString(),
            totalViolations: violations.length,
            byStandard: {},
            bySeverity: {},
            files: violations.length
        };

        // Group by standard and severity
        standards.forEach(standard => {
            reportData.byStandard[standard] = violations.filter(v => {
                const rule = this.complianceRules.get(v.ruleId);
                return rule?.standard === standard;
            }).length;
        });

        ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].forEach(severity => {
            reportData.bySeverity[severity] = violations.filter(v => v.severity === severity).length;
        });

        const prompt = `Generate a comprehensive compliance report based on this data:

${JSON.stringify(reportData, null, 2)}

Violations details:
${violations.map(v => `- ${v.message} (${v.severity}) in ${v.filePath}:${v.line || 'N/A'}`).join('\n')}

Please create an executive summary, detailed findings, risk assessment, and remediation recommendations.`;

        return await callAI(prompt);
    }

    /**
     * Show security dashboard
     */
    async showSecurityDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'securityDashboard',
            'Enterprise Security Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const recentEvents = this.securityEvents.slice(-50);
        const recentAudits = this.auditLogs.slice(-50);

        panel.webview.html = this.generateSecurityDashboardHTML(recentEvents, recentAudits);
    }

    /**
     * Generate security dashboard HTML
     */
    private generateSecurityDashboardHTML(events: SecurityEvent[], audits: AuditLog[]): string {
        const criticalEvents = events.filter(e => e.severity === 'CRITICAL').length;
        const highEvents = events.filter(e => e.severity === 'HIGH').length;
        const failedAudits = audits.filter(a => !a.success).length;

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
            background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .metric-card.critical {
            border-left-color: #ff4444;
        }
        .metric-card.warning {
            border-left-color: #ffaa00;
        }
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .events-section, .audit-section {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .event-item, .audit-item {
            padding: 10px;
            border-bottom: 1px solid #3c3c3c;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .severity-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        }
        .severity-critical { background: #ff4444; }
        .severity-high { background: #ff6600; }
        .severity-medium { background: #ffaa00; }
        .severity-low { background: #00aa00; }
        .timestamp {
            font-size: 12px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Enterprise Security Dashboard</h1>
        <p>Real-time security monitoring and compliance tracking</p>
    </div>

    <div class="dashboard-grid">
        <div class="metric-card critical">
            <div class="metric-value">${criticalEvents}</div>
            <div>Critical Security Events</div>
        </div>
        <div class="metric-card warning">
            <div class="metric-value">${highEvents}</div>
            <div>High Severity Events</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${events.length}</div>
            <div>Total Security Events</div>
        </div>
        <div class="metric-card ${failedAudits > 0 ? 'critical' : ''}">
            <div class="metric-value">${failedAudits}</div>
            <div>Failed Audit Actions</div>
        </div>
    </div>

    <div class="events-section">
        <h2>🚨 Recent Security Events</h2>
        ${events.slice(0, 10).map(event => `
            <div class="event-item">
                <div>
                    <strong>${event.action}</strong> - ${event.resource}
                    <br><span class="timestamp">${event.timestamp.toLocaleString()}</span>
                </div>
                <span class="severity-badge severity-${event.severity.toLowerCase()}">${event.severity}</span>
            </div>
        `).join('')}
    </div>

    <div class="audit-section">
        <h2>📋 Recent Audit Logs</h2>
        ${audits.slice(0, 10).map(audit => `
            <div class="audit-item">
                <div>
                    <strong>${audit.action}</strong> by ${audit.userId}
                    <br><span class="timestamp">${audit.timestamp.toLocaleString()}</span>
                </div>
                <span class="severity-badge ${audit.success ? 'severity-low' : 'severity-critical'}">
                    ${audit.success ? 'SUCCESS' : 'FAILED'}
                </span>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources
    }
}

/**
 * Register enterprise security commands
 */
export function registerEnterpriseSecurityCommands(context: vscode.ExtensionContext): void {
    const securityManager = new EnterpriseSecurityManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.security.dashboard', async () => {
            await securityManager.showSecurityDashboard();
        }),

        vscode.commands.registerCommand('coding.security.scanCompliance', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning for compliance violations...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                const report = await securityManager.generateComplianceReport();
                
                progress.report({ increment: 100 });
                
                const doc = await vscode.workspace.openTextDocument({
                    content: report,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            });
        }),

        vscode.commands.registerCommand('coding.security.authenticate', async () => {
            const email = await vscode.window.showInputBox({
                prompt: 'Enter your enterprise email',
                validateInput: (value) => {
                    if (!value || !value.includes('@')) {
                        return 'Please enter a valid email address';
                    }
                    return null;
                }
            });

            if (email) {
                const user = await securityManager.authenticateUser(email, 'mock-token');
                if (user) {
                    vscode.window.showInformationMessage(`✅ Authenticated as ${user.name}`);
                } else {
                    vscode.window.showErrorMessage('❌ Authentication failed');
                }
            }
        })
    );

    context.subscriptions.push(securityManager);
}