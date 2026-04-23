import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'developer' | 'reviewer' | 'lead';
    currentFile?: string;
    currentTask?: string;
    lastActive: Date;
}

interface SharedContext {
    projectName: string;
    teamMembers: TeamMember[];
    sharedNotes: string[];
    activeConflicts: ConflictResolution[];
    decisionLog: ArchitecturalDecision[];
}

interface ConflictResolution {
    fileA: string;
    fileB: string;
    conflict: string;
    aiSuggestion?: string;
    resolution?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
}

interface ArchitecturalDecision {
    title: string;
    description: string;
    rationale: string;
    alternatives?: string[];
    decidedBy: string;
    decidedAt: Date;
    status: 'active' | 'deprecated' | 'archived';
}

interface ProductivityMetric {
    developer: string;
    date: Date;
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    commitsCount: number;
    pullRequests: number;
    codeReviews: number;
    timeSpent: number; // in minutes
}

export class RealtimeCollaborationSystem {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private sharedContext: SharedContext;
    private productivityMetrics: ProductivityMetric[] = [];
    private watchers: vscode.FileSystemWatcher[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Team Collaboration');
        this.sharedContext = this.initializeSharedContext();
        this.setupCollaborationWatchers();
    }

    /**
     * Initialize shared context from team config
     */
    private initializeSharedContext(): SharedContext {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return this.getEmptyContext();
        }

        const configPath = path.join(workspaceFolder.uri.fsPath, '.team-collaboration.json');
        
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                return JSON.parse(content);
            } catch (error) {
                this.outputChannel.appendLine(`Error loading collaboration context: ${error}`);
            }
        }

        return this.getEmptyContext();
    }

    /**
     * Get empty context
     */
    private getEmptyContext(): SharedContext {
        return {
            projectName: vscode.workspace.name || 'Unknown Project',
            teamMembers: [],
            sharedNotes: [],
            activeConflicts: [],
            decisionLog: []
        };
    }

    /**
     * Setup file watchers for collaboration
     */
    private setupCollaborationWatchers() {
        // Watch for merge conflicts
        const conflictWatcher = vscode.workspace.createFileSystemWatcher('**/*.{orig,rej}');
        
        conflictWatcher.onDidCreate(uri => {
            this.handleConflictDetected(uri.fsPath);
        });

        this.watchers.push(conflictWatcher);

        // Watch for .git/MERGE_HEAD to detect merges
        const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/MERGE_HEAD');
        
        gitWatcher.onDidCreate(() => {
            this.notifyTeamOfMerge();
        });

        this.watchers.push(gitWatcher);
    }

    /**
     * Handle conflict detection
     */
    private async handleConflictDetected(filePath: string) {
        const document = await vscode.workspace.openTextDocument(filePath);
        const content = document.getText();

        // Extract conflict markers
        const conflictPattern = /<<<<<<< HEAD\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/g;
        const matches = Array.from(content.matchAll(conflictPattern));

        if (matches.length === 0) {
            return;
        }

        for (const match of matches) {
            const conflictA = match[1];
            const conflictB = match[2];

            const resolution = await this.resolveConflict(filePath, conflictA, conflictB);
            if (resolution) {
                this.sharedContext.activeConflicts.push(resolution);
            }
        }

        vscode.window.showWarningMessage(
            `Found ${matches.length} conflicts! AI is analyzing...`,
            'View Analysis'
        ).then(selection => {
            if (selection === 'View Analysis') {
                this.showConflictResolutionPanel();
            }
        });
    }

    /**
     * Resolve merge conflict using AI
     */
    private async resolveConflict(
        file: string,
        conflictA: string,
        conflictB: string
    ): Promise<ConflictResolution | null> {
        try {
            const prompt = `You are an expert code reviewer. Two developers made conflicting changes:

File: ${file}

Developer 1 changes:
\`\`\`
${conflictA}
\`\`\`

Developer 2 changes:
\`\`\`
${conflictB}
\`\`\`

Analyze both versions and provide:
1. Pros and cons of each approach
2. Recommended resolution (merge both, take one, or create new approach)
3. Reasoning behind your recommendation
4. Suggested final code

Be concise and practical.`;

            const analysis = await callAI(prompt);

            return {
                fileA: file,
                fileB: file,
                conflict: `Between:\n${conflictA}\n\nand:\n${conflictB}`,
                aiSuggestion: analysis
            };
        } catch (error) {
            this.outputChannel.appendLine(`Error resolving conflict: ${error}`);
            return null;
        }
    }

    /**
     * Notify team of ongoing merge
     */
    private async notifyTeamOfMerge() {
        const currentUser = process.env.USER || process.env.USERNAME || 'Unknown';
        const message = `🔄 ${currentUser} is merging branches...`;
        
        this.outputChannel.appendLine(message);
        vscode.window.showInformationMessage(message);
    }

    /**
     * Add team member to collaboration
     */
    async addTeamMember(name: string, email: string, role: 'developer' | 'reviewer' | 'lead') {
        const member: TeamMember = {
            id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
            name,
            email,
            role,
            lastActive: new Date()
        };

        this.sharedContext.teamMembers.push(member);
        this.saveSharedContext();

        vscode.window.showInformationMessage(`✅ Added team member: ${name} (${role})`);
    }

    /**
     * Update team member status
     */
    async updateTeamMemberStatus(name: string, currentFile?: string, currentTask?: string) {
        const member = this.sharedContext.teamMembers.find(m => m.name === name);
        if (member) {
            member.lastActive = new Date();
            member.currentFile = currentFile;
            member.currentTask = currentTask;
            this.saveSharedContext();
        }
    }

    /**
     * Record architectural decision
     */
    async recordArchitecturalDecision(
        title: string,
        description: string,
        rationale: string,
        alternatives?: string[]
    ) {
        const decision: ArchitecturalDecision = {
            title,
            description,
            rationale,
            alternatives,
            decidedBy: process.env.USER || 'Unknown',
            decidedAt: new Date(),
            status: 'active'
        };

        this.sharedContext.decisionLog.push(decision);
        this.saveSharedContext();

        vscode.window.showInformationMessage(`✅ Recorded decision: ${title}`);
    }

    /**
     * Get team productivity insights
     */
    async getTeamProductivityInsights(): Promise<string> {
        if (this.productivityMetrics.length === 0) {
            return 'No productivity data available yet.';
        }

        const prompt = `Analyze these team productivity metrics and provide insights:

${this.productivityMetrics.map(m => 
    `${m.developer} (${m.date.toDateString()}):
    - Files changed: ${m.filesChanged}
    - Lines: +${m.linesAdded}/-${m.linesDeleted}
    - Commits: ${m.commitsCount}
    - PRs: ${m.pullRequests}
    - Code reviews: ${m.codeReviews}
    - Time spent: ${m.timeSpent} minutes`
).join('\n')}

Provide:
1. Team velocity trends
2. Code review effectiveness
3. Areas needing improvement
4. Recommendations for optimization`;

        return await callAI(prompt);
    }

    /**
     * Record productivity metrics
     */
    recordProductivityMetric(metric: ProductivityMetric) {
        this.productivityMetrics.push(metric);
        
        // Keep last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        this.productivityMetrics = this.productivityMetrics.filter(m => m.date > thirtyDaysAgo);
    }

    /**
     * Generate team report
     */
    async generateTeamReport() {
        const insights = await this.getTeamProductivityInsights();
        
        const report = `# Team Collaboration Report
        
## Team Members (${this.sharedContext.teamMembers.length})
${this.sharedContext.teamMembers.map(m => 
    `- **${m.name}** (${m.role})
  - Email: ${m.email}
  - Last Active: ${m.lastActive.toISOString()}
  - Current Task: ${m.currentTask || 'N/A'}`
).join('\n')}

## Architectural Decisions (${this.sharedContext.decisionLog.length})
${this.sharedContext.decisionLog.map(d =>
    `### ${d.title}
- Status: ${d.status}
- Decided by: ${d.decidedBy} on ${d.decidedAt.toDateString()}
- Rationale: ${d.rationale}`
).join('\n\n')}

## Active Conflicts (${this.sharedContext.activeConflicts.length})
${this.sharedContext.activeConflicts.map(c =>
    `### ${c.fileA}
- Status: ${c.resolution ? 'Resolved' : 'Pending'}
- AI Suggestion: ${c.aiSuggestion ? 'Available' : 'Pending'}`
).join('\n')}

## Productivity Insights
${insights}`;

        // Display in new document
        const doc = await vscode.workspace.openTextDocument({
            language: 'markdown',
            content: report
        });
        
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        return report;
    }

    /**
     * Show conflict resolution panel
     */
    private async showConflictResolutionPanel() {
        const panel = vscode.window.createWebviewPanel(
            'conflictResolution',
            'Conflict Resolution',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        const html = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .conflict { background: #2d2d30; padding: 15px; margin: 10px 0; border-left: 4px solid #ff6b6b; }
        .suggestion { background: #264f78; padding: 15px; margin: 10px 0; border-left: 4px solid #3794ff; }
        button { background: #3794ff; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🔄 Merge Conflicts - AI Analysis</h1>
    ${this.sharedContext.activeConflicts.map((c, i) => `
        <div class="conflict">
            <h3>Conflict ${i + 1}: ${c.fileA}</h3>
            <div class="suggestion">
                <strong>AI Recommendation:</strong>
                <p>${c.aiSuggestion || 'Analyzing...'}</p>
            </div>
            <button onclick="resolveConflict(${i})">✓ Apply Recommendation</button>
            <button onclick="ignoreConflict(${i})">✕ Handle Manually</button>
        </div>
    `).join('')}
</body>
</html>`;

        panel.webview.html = html;
    }

    /**
     * Show collaboration dashboard
     */
    async showCollaborationDashboard() {
        const panel = vscode.window.createWebviewPanel(
            'teamDashboard',
            'Team Collaboration Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const teamStatus = this.sharedContext.teamMembers.map(m => `
            <div style="padding: 10px; background: #2d2d30; margin: 5px 0; border-radius: 4px;">
                <strong>${m.name}</strong> <span style="color: #858585;">(${m.role})</span>
                <div style="font-size: 12px; color: #858585;">
                    Last active: ${m.lastActive.toLocaleTimeString()}
                    ${m.currentTask ? `<br/>Task: ${m.currentTask}` : ''}
                </div>
            </div>
        `).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            border-radius: 8px;
            color: white;
            margin-bottom: 20px;
        }
        .section {
            background: #252526;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        h2 {
            color: #3794ff;
            margin-top: 0;
        }
        .card {
            background: #2d2d30;
            padding: 12px;
            margin: 8px 0;
            border-radius: 4px;
            border-left: 3px solid #3794ff;
        }
        .status-active { border-left-color: #89d185; }
        .status-inactive { border-left-color: #858585; }
    </style>
</head>
<body>
    <div class="header">
        <h1>👥 Team Collaboration Dashboard</h1>
        <p>Project: ${this.sharedContext.projectName}</p>
    </div>

    <div class="section">
        <h2>👤 Team Members (${this.sharedContext.teamMembers.length})</h2>
        ${teamStatus || '<p style="color: #858585;">No team members added yet</p>'}
    </div>

    <div class="section">
        <h2>📋 Active Conflicts (${this.sharedContext.activeConflicts.length})</h2>
        ${this.sharedContext.activeConflicts.length > 0 
            ? this.sharedContext.activeConflicts.map((c, i) => `
                <div class="card">
                    <strong>Conflict ${i + 1}</strong>: ${c.fileA}
                    <div style="font-size: 12px; color: #858585; margin-top: 5px;">
                        ${c.resolution ? '✅ Resolved' : '⏳ Pending'}
                    </div>
                </div>
            `).join('')
            : '<p style="color: #858585;">No active conflicts</p>'}
    </div>

    <div class="section">
        <h2>🏗️ Architectural Decisions (${this.sharedContext.decisionLog.length})</h2>
        ${this.sharedContext.decisionLog.slice(-5).map(d => `
            <div class="card">
                <strong>${d.title}</strong>
                <div style="font-size: 12px; color: #858585; margin-top: 5px;">
                    ${d.status} • Decided by ${d.decidedBy}
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        panel.webview.html = html;
    }

    /**
     * Save shared context to file
     */
    private saveSharedContext() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const configPath = path.join(workspaceFolder.uri.fsPath, '.team-collaboration.json');
        fs.writeFileSync(configPath, JSON.stringify(this.sharedContext, null, 2));
    }

    /**
     * Dispose resources
     */
    dispose() {
        this.outputChannel.dispose();
        this.watchers.forEach(w => w.dispose());
    }
}

/**
 * Register collaboration commands
 */
export function registerRealtimeCollaborationCommands(context: vscode.ExtensionContext) {
    const collaboration = new RealtimeCollaborationSystem(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.team.addMember', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Enter team member name' });
            if (!name) {return;}

            const email = await vscode.window.showInputBox({ prompt: 'Enter email' });
            if (!email) {return;}

            const role = await vscode.window.showQuickPick(
                ['developer', 'reviewer', 'lead'],
                { placeHolder: 'Select role' }
            );
            if (!role) {return;}

            await collaboration.addTeamMember(name, email, role as any);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.team.recordDecision', async () => {
            const title = await vscode.window.showInputBox({ prompt: 'Decision title' });
            if (!title) {return;}

            const description = await vscode.window.showInputBox({ prompt: 'Description' });
            if (!description) {return;}

            const rationale = await vscode.window.showInputBox({ prompt: 'Rationale' });
            if (!rationale) {return;}

            await collaboration.recordArchitecturalDecision(title, description, rationale);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.team.dashboard', async () => {
            await collaboration.showCollaborationDashboard();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.team.report', async () => {
            await collaboration.generateTeamReport();
        })
    );
}
