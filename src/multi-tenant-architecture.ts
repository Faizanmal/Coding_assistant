import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Multi-tenant Architecture System
 * Comprehensive system for managing team workspaces, organizations, permissions, and resource isolation
 */

export interface Tenant {
    id: string;
    name: string;
    type: 'individual' | 'team' | 'organization' | 'enterprise';
    status: 'active' | 'suspended' | 'trial' | 'expired';
    plan: 'free' | 'pro' | 'team' | 'enterprise';
    metadata: {
        created_at: Date;
        updated_at: Date;
        owner_id: string;
        billing_email: string;
        subscription_id?: string;
        trial_end_date?: Date;
        last_activity: Date;
    };
    settings: {
        max_users: number;
        max_projects: number;
        max_storage_gb: number;
        max_ai_requests_per_month: number;
        features_enabled: string[];
        custom_branding: boolean;
        sso_enabled: boolean;
        audit_log_retention_days: number;
    };
    usage: {
        active_users: number;
        total_projects: number;
        storage_used_gb: number;
        ai_requests_this_month: number;
        bandwidth_used_gb: number;
    };
    billing: {
        current_period_start: Date;
        current_period_end: Date;
        amount_due: number;
        currency: string;
        payment_method?: string;
        last_payment_date?: Date;
        next_billing_date: Date;
    };
}

export interface Workspace {
    id: string;
    tenant_id: string;
    name: string;
    description: string;
    type: 'personal' | 'team' | 'project' | 'department';
    status: 'active' | 'archived' | 'deleted';
    metadata: {
        created_at: Date;
        updated_at: Date;
        created_by: string;
        last_accessed: Date;
        access_count: number;
    };
    settings: {
        visibility: 'private' | 'team' | 'organization' | 'public';
        collaboration_enabled: boolean;
        ai_features_enabled: boolean;
        version_control: boolean;
        backup_enabled: boolean;
        auto_save_interval: number;
    };
    resources: {
        file_count: number;
        total_size_bytes: number;
        ai_usage_minutes: number;
        collaboration_sessions: number;
        last_backup: Date;
    };
    permissions: WorkspacePermission[];
    integrations: {
        git_repositories: string[];
        external_tools: string[];
        webhooks: string[];
    };
}

export interface WorkspacePermission {
    user_id: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer' | 'guest';
    permissions: {
        read: boolean;
        write: boolean;
        delete: boolean;
        share: boolean;
        admin: boolean;
        ai_access: boolean;
        export: boolean;
    };
    granted_at: Date;
    granted_by: string;
    expires_at?: Date;
}

export interface User {
    id: string;
    email: string;
    name: string;
    tenant_id: string;
    status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
    role: 'super_admin' | 'tenant_admin' | 'user' | 'guest';
    metadata: {
        created_at: Date;
        updated_at: Date;
        last_login: Date;
        login_count: number;
        email_verified: boolean;
        mfa_enabled: boolean;
    };
    preferences: {
        theme: 'light' | 'dark' | 'auto';
        language: string;
        timezone: string;
        notifications_enabled: boolean;
        ai_suggestions_enabled: boolean;
        collaboration_notifications: boolean;
    };
    usage_stats: {
        ai_requests_count: number;
        files_created: number;
        files_edited: number;
        collaboration_time_minutes: number;
        last_activity: Date;
    };
    permissions: string[];
    workspaces: string[];
}

export interface ResourceQuota {
    tenant_id: string;
    resource_type: 'storage' | 'ai_requests' | 'users' | 'projects' | 'bandwidth';
    limit: number;
    used: number;
    period: 'daily' | 'monthly' | 'yearly';
    reset_date: Date;
    warning_threshold: number;
    alert_threshold: number;
}

export interface AuditLog {
    id: string;
    tenant_id: string;
    user_id: string;
    action: string;
    resource_type: 'workspace' | 'user' | 'file' | 'permission' | 'billing';
    resource_id: string;
    timestamp: Date;
    ip_address: string;
    user_agent: string;
    details: {
        old_value?: any;
        new_value?: any;
        affected_users?: string[];
        metadata?: Record<string, any>;
    };
    severity: 'info' | 'warning' | 'error' | 'critical';
    success: boolean;
    error_message?: string;
}

export class MultiTenantArchitecture {
    private tenants: Map<string, Tenant> = new Map();
    private workspaces: Map<string, Workspace> = new Map();
    private users: Map<string, User> = new Map();
    private quotas: Map<string, ResourceQuota[]> = new Map();
    private auditLogs: AuditLog[] = [];
    private currentTenant: string | null = null;
    private currentUser: string | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeDefaultTenant();
        this.startQuotaMonitoring();
        this.startAuditLogCleanup();
    }

    /**
     * Initialize default tenant for single-user scenarios
     */
    private initializeDefaultTenant(): void {
        const defaultTenant: Tenant = {
            id: 'default-tenant',
            name: 'Personal Workspace',
            type: 'individual',
            status: 'active',
            plan: 'free',
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                owner_id: 'default-user',
                billing_email: 'user@example.com',
                last_activity: new Date()
            },
            settings: {
                max_users: 1,
                max_projects: 10,
                max_storage_gb: 5,
                max_ai_requests_per_month: 1000,
                features_enabled: ['ai_assistance', 'file_management', 'basic_collaboration'],
                custom_branding: false,
                sso_enabled: false,
                audit_log_retention_days: 30
            },
            usage: {
                active_users: 1,
                total_projects: 0,
                storage_used_gb: 0,
                ai_requests_this_month: 0,
                bandwidth_used_gb: 0
            },
            billing: {
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                amount_due: 0,
                currency: 'USD',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        };

        this.tenants.set(defaultTenant.id, defaultTenant);
        this.currentTenant = defaultTenant.id;

        // Create default user
        const defaultUser: User = {
            id: 'default-user',
            email: 'user@example.com',
            name: 'Default User',
            tenant_id: defaultTenant.id,
            status: 'active',
            role: 'tenant_admin',
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                last_login: new Date(),
                login_count: 1,
                email_verified: true,
                mfa_enabled: false
            },
            preferences: {
                theme: 'dark',
                language: 'en',
                timezone: 'UTC',
                notifications_enabled: true,
                ai_suggestions_enabled: true,
                collaboration_notifications: true
            },
            usage_stats: {
                ai_requests_count: 0,
                files_created: 0,
                files_edited: 0,
                collaboration_time_minutes: 0,
                last_activity: new Date()
            },
            permissions: ['*'],
            workspaces: []
        };

        this.users.set(defaultUser.id, defaultUser);
        this.currentUser = defaultUser.id;
    }

    /**
     * Create a new tenant
     */
    async createTenant(
        name: string,
        type: Tenant['type'],
        plan: Tenant['plan'],
        ownerEmail: string
    ): Promise<Tenant> {
        const tenantId = crypto.randomUUID();
        
        const planLimits = this.getPlanLimits(plan);
        
        const tenant: Tenant = {
            id: tenantId,
            name,
            type,
            status: plan === 'free' ? 'active' : 'trial',
            plan,
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                owner_id: crypto.randomUUID(),
                billing_email: ownerEmail,
                trial_end_date: plan !== 'free' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined,
                last_activity: new Date()
            },
            settings: planLimits,
            usage: {
                active_users: 0,
                total_projects: 0,
                storage_used_gb: 0,
                ai_requests_this_month: 0,
                bandwidth_used_gb: 0
            },
            billing: {
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                amount_due: 0,
                currency: 'USD',
                next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        };

        this.tenants.set(tenantId, tenant);
        
        // Initialize resource quotas
        await this.initializeResourceQuotas(tenantId, plan);
        
        // Log tenant creation
        await this.logAuditEvent(
            tenantId,
            tenant.metadata.owner_id,
            'create_tenant',
            'tenant',
            tenantId,
            { tenant_name: name, plan, type }
        );

        vscode.window.showInformationMessage(`✅ Tenant "${name}" created successfully`);
        return tenant;
    }

    /**
     * Create a new workspace within a tenant
     */
    async createWorkspace(
        tenantId: string,
        name: string,
        description: string,
        type: Workspace['type'],
        createdBy: string
    ): Promise<Workspace> {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        // Check workspace limits
        if (tenant.usage.total_projects >= tenant.settings.max_projects) {
            throw new Error('Workspace limit exceeded for this tenant');
        }

        const workspaceId = crypto.randomUUID();
        
        const workspace: Workspace = {
            id: workspaceId,
            tenant_id: tenantId,
            name,
            description,
            type,
            status: 'active',
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                created_by: createdBy,
                last_accessed: new Date(),
                access_count: 0
            },
            settings: {
                visibility: type === 'personal' ? 'private' : 'team',
                collaboration_enabled: true,
                ai_features_enabled: tenant.settings.features_enabled.includes('ai_assistance'),
                version_control: true,
                backup_enabled: true,
                auto_save_interval: 30
            },
            resources: {
                file_count: 0,
                total_size_bytes: 0,
                ai_usage_minutes: 0,
                collaboration_sessions: 0,
                last_backup: new Date()
            },
            permissions: [{
                user_id: createdBy,
                role: 'owner',
                permissions: {
                    read: true,
                    write: true,
                    delete: true,
                    share: true,
                    admin: true,
                    ai_access: true,
                    export: true
                },
                granted_at: new Date(),
                granted_by: createdBy
            }],
            integrations: {
                git_repositories: [],
                external_tools: [],
                webhooks: []
            }
        };

        this.workspaces.set(workspaceId, workspace);
        
        // Update tenant usage
        tenant.usage.total_projects++;
        tenant.metadata.updated_at = new Date();

        // Add workspace to user
        const user = this.users.get(createdBy);
        if (user) {
            user.workspaces.push(workspaceId);
        }

        // Log workspace creation
        await this.logAuditEvent(
            tenantId,
            createdBy,
            'create_workspace',
            'workspace',
            workspaceId,
            { workspace_name: name, workspace_type: type }
        );

        vscode.window.showInformationMessage(`✅ Workspace "${name}" created successfully`);
        return workspace;
    }

    /**
     * Add user to tenant
     */
    async addUserToTenant(
        tenantId: string,
        email: string,
        name: string,
        role: User['role'],
        addedBy: string
    ): Promise<User> {
        const tenant = this.tenants.get(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        // Check user limits
        if (tenant.usage.active_users >= tenant.settings.max_users) {
            throw new Error('User limit exceeded for this tenant');
        }

        const userId = crypto.randomUUID();
        
        const user: User = {
            id: userId,
            email,
            name,
            tenant_id: tenantId,
            status: 'pending_verification',
            role,
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                last_login: new Date(0),
                login_count: 0,
                email_verified: false,
                mfa_enabled: false
            },
            preferences: {
                theme: 'dark',
                language: 'en',
                timezone: 'UTC',
                notifications_enabled: true,
                ai_suggestions_enabled: true,
                collaboration_notifications: true
            },
            usage_stats: {
                ai_requests_count: 0,
                files_created: 0,
                files_edited: 0,
                collaboration_time_minutes: 0,
                last_activity: new Date()
            },
            permissions: this.getRolePermissions(role),
            workspaces: []
        };

        this.users.set(userId, user);
        
        // Update tenant usage
        tenant.usage.active_users++;
        tenant.metadata.updated_at = new Date();

        // Log user addition
        await this.logAuditEvent(
            tenantId,
            addedBy,
            'add_user',
            'user',
            userId,
            { user_email: email, user_role: role }
        );

        vscode.window.showInformationMessage(`✅ User "${name}" added to tenant`);
        return user;
    }

    /**
     * Grant workspace access to user
     */
    async grantWorkspaceAccess(
        workspaceId: string,
        userId: string,
        role: WorkspacePermission['role'],
        grantedBy: string
    ): Promise<void> {
        const workspace = this.workspaces.get(workspaceId);
        const user = this.users.get(userId);
        
        if (!workspace || !user) {
            throw new Error('Workspace or user not found');
        }

        // Check if user is already in workspace
        const existingPermission = workspace.permissions.find(p => p.user_id === userId);
        if (existingPermission) {
            existingPermission.role = role;
            existingPermission.permissions = this.getRolePermissions(role) as any;
            existingPermission.granted_at = new Date();
            existingPermission.granted_by = grantedBy;
        } else {
            const permission: WorkspacePermission = {
                user_id: userId,
                role,
                permissions: this.getRolePermissions(role) as any,
                granted_at: new Date(),
                granted_by: grantedBy
            };
            workspace.permissions.push(permission);
            user.workspaces.push(workspaceId);
        }

        // Log permission grant
        await this.logAuditEvent(
            workspace.tenant_id,
            grantedBy,
            'grant_workspace_access',
            'permission',
            workspaceId,
            { target_user: userId, role }
        );

        vscode.window.showInformationMessage(`✅ Workspace access granted to user`);
    }

    /**
     * Check if user has permission for action
     */
    checkPermission(
        userId: string,
        workspaceId: string,
        action: keyof WorkspacePermission['permissions']
    ): boolean {
        const workspace = this.workspaces.get(workspaceId);
        const user = this.users.get(userId);
        
        if (!workspace || !user) {
            return false;
        }

        // Check if user is in same tenant
        if (user.tenant_id !== workspace.tenant_id) {
            return false;
        }

        // Super admin has all permissions
        if (user.role === 'super_admin') {
            return true;
        }

        // Find user's permission in workspace
        const permission = workspace.permissions.find(p => p.user_id === userId);
        if (!permission) {
            return false;
        }

        // Check if permission is expired
        if (permission.expires_at && permission.expires_at < new Date()) {
            return false;
        }

        return permission.permissions[action];
    }

    /**
     * Track resource usage
     */
    async trackResourceUsage(
        tenantId: string,
        resourceType: ResourceQuota['resource_type'],
        amount: number
    ): Promise<void> {
        const quotas = this.quotas.get(tenantId) || [];
        const quota = quotas.find(q => q.resource_type === resourceType);
        
        if (quota) {
            quota.used += amount;
            
            // Check if quota exceeded
            if (quota.used > quota.limit) {
                await this.handleQuotaExceeded(tenantId, quota);
            }
            
            // Check warning threshold
            if (quota.used > quota.limit * (quota.warning_threshold / 100)) {
                await this.handleQuotaWarning(tenantId, quota);
            }
        }

        // Update tenant usage
        const tenant = this.tenants.get(tenantId);
        if (tenant) {
            switch (resourceType) {
                case 'ai_requests':
                    tenant.usage.ai_requests_this_month += amount;
                    break;
                case 'storage':
                    tenant.usage.storage_used_gb += amount;
                    break;
                case 'bandwidth':
                    tenant.usage.bandwidth_used_gb += amount;
                    break;
            }
        }
    }

    /**
     * Show multi-tenant dashboard
     */
    async showMultiTenantDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'multiTenantDashboard',
            'Multi-Tenant Management Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateDashboardHTML();

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'createTenant':
                    await this.showCreateTenantDialog();
                    break;
                case 'createWorkspace':
                    await this.showCreateWorkspaceDialog();
                    break;
                case 'addUser':
                    await this.showAddUserDialog();
                    break;
                case 'viewAuditLogs':
                    await this.showAuditLogs();
                    break;
                case 'manageQuotas':
                    await this.showQuotaManagement();
                    break;
            }
        });
    }

    /**
     * Generate dashboard HTML
     */
    private generateDashboardHTML(): string {
        const tenantsArray = Array.from(this.tenants.values());
        const workspacesArray = Array.from(this.workspaces.values());
        const usersArray = Array.from(this.users.values());

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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #667eea;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .tenant-card {
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }
        .tenant-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin: 10px 0;
        }
        .stat-item {
            background: #1e1e1e;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
        }
        .stat-value {
            font-size: 16px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            font-size: 11px;
            color: #888;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-active { background: #4CAF50; color: white; }
        .status-trial { background: #FF9800; color: white; }
        .status-suspended { background: #F44336; color: white; }
        .plan-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-left: 10px;
        }
        .plan-free { background: #666; color: white; }
        .plan-pro { background: #2196F3; color: white; }
        .plan-team { background: #9C27B0; color: white; }
        .plan-enterprise { background: #FF5722; color: white; }
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
            font-size: 12px;
        }
        .btn:hover {
            background: #5a6fd8;
        }
        .quota-bar {
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin: 5px 0;
        }
        .quota-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #FF9800, #F44336);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏢 Multi-Tenant Management Dashboard</h1>
        <p>Manage tenants, workspaces, users, and resource quotas</p>
    </div>

    <div class="dashboard-grid">
        <div class="section">
            <h2>🏢 Tenants (${tenantsArray.length})</h2>
            ${tenantsArray.map(tenant => `
                <div class="tenant-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>${tenant.name}</strong>
                        <div>
                            <span class="status-badge status-${tenant.status}">${tenant.status}</span>
                            <span class="plan-badge plan-${tenant.plan}">${tenant.plan}</span>
                        </div>
                    </div>
                    <div class="tenant-stats">
                        <div class="stat-item">
                            <div class="stat-value">${tenant.usage.active_users}/${tenant.settings.max_users}</div>
                            <div class="stat-label">Users</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${tenant.usage.total_projects}/${tenant.settings.max_projects}</div>
                            <div class="stat-label">Projects</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${tenant.usage.storage_used_gb.toFixed(1)}/${tenant.settings.max_storage_gb}</div>
                            <div class="stat-label">Storage (GB)</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${tenant.usage.ai_requests_this_month}/${tenant.settings.max_ai_requests_per_month}</div>
                            <div class="stat-label">AI Requests</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px;">
                        Storage Usage:
                        <div class="quota-bar">
                            <div class="quota-fill" style="width: ${(tenant.usage.storage_used_gb / tenant.settings.max_storage_gb) * 100}%"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <button class="btn" onclick="createTenant()">Create New Tenant</button>
        </div>

        <div class="section">
            <h2>💼 Workspaces (${workspacesArray.length})</h2>
            ${workspacesArray.slice(0, 5).map(workspace => `
                <div style="background: #2d2d30; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>${workspace.name}</strong>
                    <div style="color: #888; font-size: 12px; margin: 5px 0;">${workspace.description}</div>
                    <div style="font-size: 12px;">
                        Type: ${workspace.type} | Files: ${workspace.resources.file_count} | 
                        Users: ${workspace.permissions.length}
                    </div>
                </div>
            `).join('')}
            
            <button class="btn" onclick="createWorkspace()">Create Workspace</button>
        </div>

        <div class="section">
            <h2>👥 Users (${usersArray.length})</h2>
            ${usersArray.slice(0, 5).map(user => `
                <div style="background: #2d2d30; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>${user.name}</strong>
                    <div style="color: #888; font-size: 12px; margin: 5px 0;">${user.email}</div>
                    <div style="font-size: 12px;">
                        Role: ${user.role} | Status: ${user.status} | 
                        Workspaces: ${user.workspaces.length}
                    </div>
                </div>
            `).join('')}
            
            <button class="btn" onclick="addUser()">Add User</button>
        </div>

        <div class="section">
            <h2>📊 Resource Usage</h2>
            <div style="margin-bottom: 15px;">
                <strong>Total Storage:</strong> ${tenantsArray.reduce((sum, t) => sum + t.usage.storage_used_gb, 0).toFixed(1)} GB
            </div>
            <div style="margin-bottom: 15px;">
                <strong>AI Requests This Month:</strong> ${tenantsArray.reduce((sum, t) => sum + t.usage.ai_requests_this_month, 0)}
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Active Users:</strong> ${tenantsArray.reduce((sum, t) => sum + t.usage.active_users, 0)}
            </div>
            
            <button class="btn" onclick="manageQuotas()">Manage Quotas</button>
        </div>

        <div class="section">
            <h2>📋 Recent Activity</h2>
            ${this.auditLogs.slice(-5).map(log => `
                <div style="background: #2d2d30; padding: 10px; border-radius: 4px; margin-bottom: 8px;">
                    <div style="font-size: 12px; color: #888;">${log.timestamp.toLocaleString()}</div>
                    <strong>${log.action}</strong> by ${log.user_id}
                    <div style="font-size: 12px; color: #888;">${log.resource_type}: ${log.resource_id}</div>
                </div>
            `).join('')}
            
            <button class="btn" onclick="viewAuditLogs()">View All Logs</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function createTenant() {
            vscode.postMessage({ command: 'createTenant' });
        }

        function createWorkspace() {
            vscode.postMessage({ command: 'createWorkspace' });
        }

        function addUser() {
            vscode.postMessage({ command: 'addUser' });
        }

        function viewAuditLogs() {
            vscode.postMessage({ command: 'viewAuditLogs' });
        }

        function manageQuotas() {
            vscode.postMessage({ command: 'manageQuotas' });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Helper methods
     */
    private getPlanLimits(plan: Tenant['plan']): Tenant['settings'] {
        const planConfigs = {
            free: {
                max_users: 1,
                max_projects: 3,
                max_storage_gb: 1,
                max_ai_requests_per_month: 100,
                features_enabled: ['basic_ai', 'file_management'],
                custom_branding: false,
                sso_enabled: false,
                audit_log_retention_days: 7
            },
            pro: {
                max_users: 5,
                max_projects: 25,
                max_storage_gb: 10,
                max_ai_requests_per_month: 1000,
                features_enabled: ['advanced_ai', 'file_management', 'collaboration', 'analytics'],
                custom_branding: false,
                sso_enabled: false,
                audit_log_retention_days: 30
            },
            team: {
                max_users: 50,
                max_projects: 100,
                max_storage_gb: 100,
                max_ai_requests_per_month: 10000,
                features_enabled: ['advanced_ai', 'file_management', 'collaboration', 'analytics', 'integrations'],
                custom_branding: true,
                sso_enabled: true,
                audit_log_retention_days: 90
            },
            enterprise: {
                max_users: 1000,
                max_projects: 1000,
                max_storage_gb: 1000,
                max_ai_requests_per_month: 100000,
                features_enabled: ['*'],
                custom_branding: true,
                sso_enabled: true,
                audit_log_retention_days: 365
            }
        };

        return planConfigs[plan];
    }

    private getRolePermissions(role: string): string[] {
        const rolePermissions = {
            super_admin: ['*'],
            tenant_admin: ['manage_users', 'manage_workspaces', 'view_analytics', 'manage_billing'],
            user: ['create_workspace', 'join_workspace', 'use_ai'],
            guest: ['view_workspace'],
            owner: ['*'],
            admin: ['read', 'write', 'delete', 'share', 'admin', 'ai_access', 'export'],
            editor: ['read', 'write', 'share', 'ai_access'],
            viewer: ['read'],
        };

        return rolePermissions[role] || ['read'];
    }

    private async initializeResourceQuotas(tenantId: string, plan: string): Promise<void> {
        const limits = this.getPlanLimits(plan as any);
        const quotas: ResourceQuota[] = [
            {
                tenant_id: tenantId,
                resource_type: 'storage',
                limit: limits.max_storage_gb,
                used: 0,
                period: 'monthly',
                reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                warning_threshold: 80,
                alert_threshold: 95
            },
            {
                tenant_id: tenantId,
                resource_type: 'ai_requests',
                limit: limits.max_ai_requests_per_month,
                used: 0,
                period: 'monthly',
                reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                warning_threshold: 80,
                alert_threshold: 95
            }
        ];

        this.quotas.set(tenantId, quotas);
    }

    private async logAuditEvent(
        tenantId: string,
        userId: string,
        action: string,
        resourceType: string,
        resourceId: string,
        details: any
    ): Promise<void> {
        const auditLog: AuditLog = {
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            user_id: userId,
            action,
            resource_type: resourceType as any,
            resource_id: resourceId,
            timestamp: new Date(),
            ip_address: '127.0.0.1', // Mock
            user_agent: 'VS Code Extension',
            details,
            severity: 'info',
            success: true
        };

        this.auditLogs.push(auditLog);

        // Keep only recent logs
        if (this.auditLogs.length > 1000) {
            this.auditLogs = this.auditLogs.slice(-1000);
        }
    }

    private async handleQuotaExceeded(tenantId: string, quota: ResourceQuota): Promise<void> {
        vscode.window.showWarningMessage(
            `⚠️ Quota exceeded for ${quota.resource_type}: ${quota.used}/${quota.limit}`
        );
    }

    private async handleQuotaWarning(tenantId: string, quota: ResourceQuota): Promise<void> {
        const percentage = Math.round((quota.used / quota.limit) * 100);
        vscode.window.showInformationMessage(
            `📊 Quota warning for ${quota.resource_type}: ${percentage}% used`
        );
    }

    private startQuotaMonitoring(): void {
        setInterval(() => {
            // Reset monthly quotas
            const now = new Date();
            this.quotas.forEach(quotaArray => {
                quotaArray.forEach(quota => {
                    if (quota.reset_date <= now) {
                        quota.used = 0;
                        quota.reset_date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    }
                });
            });
        }, 60 * 60 * 1000); // Check every hour
    }

    private startAuditLogCleanup(): void {
        setInterval(() => {
            // Clean up old audit logs based on tenant settings
            this.tenants.forEach(tenant => {
                const cutoffDate = new Date(Date.now() - tenant.settings.audit_log_retention_days * 24 * 60 * 60 * 1000);
                this.auditLogs = this.auditLogs.filter(log => 
                    log.tenant_id !== tenant.id || log.timestamp > cutoffDate
                );
            });
        }, 24 * 60 * 60 * 1000); // Check daily
    }

    // Dialog methods
    private async showCreateTenantDialog(): Promise<void> {
        const name = await vscode.window.showInputBox({ prompt: 'Tenant name' });
        const type = await vscode.window.showQuickPick(['individual', 'team', 'organization', 'enterprise']);
        const plan = await vscode.window.showQuickPick(['free', 'pro', 'team', 'enterprise']);
        const email = await vscode.window.showInputBox({ prompt: 'Owner email' });

        if (name && type && plan && email) {
            await this.createTenant(name, type as any, plan as any, email);
        }
    }

    private async showCreateWorkspaceDialog(): Promise<void> {
        const tenantOptions = Array.from(this.tenants.values()).map(t => ({ label: t.name, description: t.id }));
        const tenant = await vscode.window.showQuickPick(tenantOptions, { placeHolder: 'Select tenant' });
        
        if (tenant) {
            const name = await vscode.window.showInputBox({ prompt: 'Workspace name' });
            const description = await vscode.window.showInputBox({ prompt: 'Description' });
            const type = await vscode.window.showQuickPick(['personal', 'team', 'project', 'department']);
            
            if (name && description && type) {
                await this.createWorkspace(tenant.description!, name, description, type as any, this.currentUser!);
            }
        }
    }

    private async showAddUserDialog(): Promise<void> {
        const tenantOptions = Array.from(this.tenants.values()).map(t => ({ label: t.name, description: t.id }));
        const tenant = await vscode.window.showQuickPick(tenantOptions, { placeHolder: 'Select tenant' });
        
        if (tenant) {
            const email = await vscode.window.showInputBox({ prompt: 'User email' });
            const name = await vscode.window.showInputBox({ prompt: 'User name' });
            const role = await vscode.window.showQuickPick(['user', 'tenant_admin']);
            
            if (email && name && role) {
                await this.addUserToTenant(tenant.description!, email, name, role as any, this.currentUser!);
            }
        }
    }

    private async showAuditLogs(): Promise<void> {
        const logs = this.auditLogs.slice(-50).reverse();
        const logContent = logs.map(log => 
            `${log.timestamp.toISOString()} | ${log.action} | ${log.user_id} | ${log.resource_type}:${log.resource_id}`
        ).join('\n');

        const doc = await vscode.workspace.openTextDocument({
            content: logContent,
            language: 'log'
        });
        await vscode.window.showTextDocument(doc);
    }

    private async showQuotaManagement(): Promise<void> {
        const quotaInfo = Array.from(this.quotas.entries()).map(([tenantId, quotas]) => {
            const tenant = this.tenants.get(tenantId);
            return `Tenant: ${tenant?.name || tenantId}\n${quotas.map(q => 
                `  ${q.resource_type}: ${q.used}/${q.limit} (${Math.round((q.used/q.limit)*100)}%)`
            ).join('\n')}`;
        }).join('\n\n');

        const doc = await vscode.workspace.openTextDocument({
            content: quotaInfo,
            language: 'text'
        });
        await vscode.window.showTextDocument(doc);
    }

    dispose(): void {
        // Clean up resources
    }
}

/**
 * Register multi-tenant architecture commands
 */
export function registerMultiTenantCommands(context: vscode.ExtensionContext): void {
    const multiTenant = new MultiTenantArchitecture(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.multitenant.dashboard', async () => {
            await multiTenant.showMultiTenantDashboard();
        }),

        vscode.commands.registerCommand('coding.multitenant.createTenant', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Tenant name' });
            const email = await vscode.window.showInputBox({ prompt: 'Owner email' });
            
            if (name && email) {
                await multiTenant.createTenant(name, 'team', 'pro', email);
            }
        }),

        vscode.commands.registerCommand('coding.multitenant.createWorkspace', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Workspace name' });
            const description = await vscode.window.showInputBox({ prompt: 'Description' });
            
            if (name && description) {
                await multiTenant.createWorkspace(
                    'default-tenant',
                    name,
                    description,
                    'project',
                    'default-user'
                );
            }
        }),

        vscode.commands.registerCommand('coding.multitenant.addUser', async () => {
            const email = await vscode.window.showInputBox({ prompt: 'User email' });
            const name = await vscode.window.showInputBox({ prompt: 'User name' });
            
            if (email && name) {
                await multiTenant.addUserToTenant(
                    'default-tenant',
                    email,
                    name,
                    'user',
                    'default-user'
                );
            }
        })
    );

    context.subscriptions.push(multiTenant);
}