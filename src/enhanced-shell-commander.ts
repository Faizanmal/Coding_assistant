import * as vscode from 'vscode';
import { callAI } from './cli-api';
import { UnifiedActivityDashboard, ActivityData } from './unified-activity-dashboard';
import { AgentTerminalBridge, AgentTerminalRequest } from './agent-terminal-bridge';

export interface EnhancedCommandContext {
    projectType?: string;
    currentDirectory?: string;
    openFiles?: string[];
    gitStatus?: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    userIntent?: string;
    urgency?: 'low' | 'medium' | 'high';
}

export interface SmartCommandSuggestion {
    command: string;
    description: string;
    risk: 'low' | 'medium' | 'high';
    confidence: number;
    reasoning: string;
    alternatives?: string[];
}

export class EnhancedShellCommander {
    private static activeTerminals: Map<string, vscode.Terminal> = new Map();
    private static commandQueue: Array<{
        id: string, 
        command: string, 
        status: 'pending' | 'running' | 'completed' | 'failed',
        agent?: string,
        context?: EnhancedCommandContext,
        startTime?: number,
        sessionId?: string
    }> = [];
    private static activityDashboard: UnifiedActivityDashboard = UnifiedActivityDashboard.getInstance();
    private static agentBridge: AgentTerminalBridge = AgentTerminalBridge.getInstance();

    /**
     * Enhanced NLP command processing with advanced context understanding
     */
    static async executeEnhancedNLPCommand(prompt: string, context?: EnhancedCommandContext): Promise<string> {
        // Log activity start
        const activity: ActivityData = {
            timestamp: Date.now(),
            type: 'terminal',
            source: 'EnhancedShellCommander',
            action: 'nlp_processing',
            details: `Processing: ${prompt}`,
            status: 'pending',
            metadata: { prompt, context }
        };
        this.activityDashboard.logActivity(activity);

        try {
            const enhancedContext = await this.gatherEnhancedContext(context);
            const suggestions = await this.generateSmartCommands(prompt, enhancedContext);
            
            if (suggestions.length === 0) {
                throw new Error('No valid commands could be generated');
            }

            // Select best command or ask user for high-risk operations
            const selectedCommand = await this.selectOptimalCommand(suggestions, prompt);
            
            // Execute with enhanced monitoring
            const result = await this.executeWithEnhancedMonitoring(selectedCommand, enhancedContext, prompt);
            
            // Log success
            this.activityDashboard.logActivity({
                ...activity,
                action: 'nlp_completed',
                status: 'completed',
                details: `Successfully executed: ${selectedCommand.command}`,
                metadata: { ...activity.metadata, result }
            });

            return result;

        } catch (error) {
            // Log error
            this.activityDashboard.logActivity({
                ...activity,
                action: 'nlp_failed',
                status: 'error',
                details: `Failed: ${error}`,
                metadata: { ...activity.metadata, error }
            });
            throw error;
        }
    }

    /**
     * Gather enhanced context from the workspace and environment
     */
    private static async gatherEnhancedContext(userContext?: EnhancedCommandContext): Promise<EnhancedCommandContext> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        const enhancedContext: EnhancedCommandContext = {
            ...userContext,
            currentDirectory: workspaceFolder?.uri.fsPath || process.cwd(),
            openFiles: vscode.workspace.textDocuments.map(doc => doc.fileName),
            projectType: await this.detectProjectType(),
            packageManager: await this.detectPackageManager(),
            userIntent: userContext?.userIntent || 'unknown'
        };

        // Try to get git status
        try {
            enhancedContext.gitStatus = await this.getGitStatus();
        } catch {
            enhancedContext.gitStatus = 'not_a_git_repo';
        }

        return enhancedContext;
    }

    /**
     * Generate smart command suggestions using enhanced NLP
     */
    private static async generateSmartCommands(prompt: string, context: EnhancedCommandContext): Promise<SmartCommandSuggestion[]> {
        const enhancedPrompt = `You are an advanced terminal command assistant. Generate Windows-compatible commands for this request:

PROMPT: "${prompt}"

CONTEXT:
- Project Type: ${context.projectType}
- Directory: ${context.currentDirectory}
- Package Manager: ${context.packageManager}
- Git Status: ${context.gitStatus}
- Open Files: ${context.openFiles?.slice(0, 5).join(', ') || 'none'}
- User Intent: ${context.userIntent}

REQUIREMENTS:
- Use Windows command syntax (use ; for chaining, not &&)
- Convert Unix commands to Windows equivalents (ls -> dir, cat -> type, etc.)
- Provide 2-3 command options with different risk levels
- Include detailed reasoning for each suggestion
- Consider project context and current state

RESPONSE FORMAT (JSON):
{
  "suggestions": [
    {
      "command": "npm install express",
      "description": "Install Express.js framework",
      "risk": "medium",
      "confidence": 0.9,
      "reasoning": "Based on context, this appears to be a Node.js project needing Express",
      "alternatives": ["yarn add express", "pnpm install express"]
    }
  ]
}

Generate thoughtful, context-aware commands:`;

        try {
            const response = await callAI(enhancedPrompt);
            const parsed = this.parseSmartCommandResponse(response);
            return parsed.suggestions || [];
        } catch (error) {
            // Fallback to basic command generation
            return await this.generateFallbackCommands(prompt, context);
        }
    }

    private static parseSmartCommandResponse(response: string): {suggestions: SmartCommandSuggestion[]} {
        try {
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            return JSON.parse(cleaned);
        } catch {
            return { suggestions: [] };
        }
    }

    private static async generateFallbackCommands(prompt: string, context: EnhancedCommandContext): Promise<SmartCommandSuggestion[]> {
        // Basic pattern matching for common operations
        const suggestions: SmartCommandSuggestion[] = [];

        if (/install.*package|npm.*install|add.*dependency/i.test(prompt)) {
            suggestions.push({
                command: `${context.packageManager || 'npm'} install`,
                description: 'Install packages using detected package manager',
                risk: 'medium',
                confidence: 0.7,
                reasoning: 'Detected package installation request'
            });
        }

        if (/start.*server|run.*dev|serve/i.test(prompt)) {
            suggestions.push({
                command: `${context.packageManager || 'npm'} start`,
                description: 'Start the development server',
                risk: 'low',
                confidence: 0.8,
                reasoning: 'Common development server start command'
            });
        }

        if (/git.*status|check.*git|repo.*status/i.test(prompt)) {
            suggestions.push({
                command: 'git status',
                description: 'Check Git repository status',
                risk: 'low',
                confidence: 0.9,
                reasoning: 'Safe Git status check'
            });
        }

        return suggestions;
    }

    private static async selectOptimalCommand(suggestions: SmartCommandSuggestion[], originalPrompt: string): Promise<SmartCommandSuggestion> {
        // Sort by confidence and risk
        const sortedSuggestions = suggestions.sort((a, b) => {
            if (a.risk !== b.risk) {
                const riskWeight = { 'low': 3, 'medium': 2, 'high': 1 };
                return riskWeight[b.risk] - riskWeight[a.risk];
            }
            return b.confidence - a.confidence;
        });

        const bestSuggestion = sortedSuggestions[0];

        // Ask for confirmation on high-risk operations
        if (bestSuggestion.risk === 'high') {
            const action = await vscode.window.showWarningMessage(
                `High-risk command detected: "${bestSuggestion.command}"\n\n` +
                `Purpose: ${bestSuggestion.description}\n` +
                `Reasoning: ${bestSuggestion.reasoning}`,
                { modal: true },
                'Execute',
                'Show Alternatives',
                'Cancel'
            );

            if (action === 'Cancel') {
                throw new Error('Command execution cancelled by user');
            }
            
            if (action === 'Show Alternatives' && bestSuggestion.alternatives) {
                const selected = await vscode.window.showQuickPick(
                    bestSuggestion.alternatives.map(alt => ({
                        label: alt,
                        description: 'Alternative command'
                    }))
                );
                
                if (selected) {
                    return {
                        ...bestSuggestion,
                        command: selected.label
                    };
                }
                throw new Error('No alternative selected');
            }
        }

        return bestSuggestion;
    }

    private static async executeWithEnhancedMonitoring(
        suggestion: SmartCommandSuggestion, 
        context: EnhancedCommandContext,
        originalPrompt: string
    ): Promise<string> {
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sessionId = `enhanced_${commandId}`;

        // Convert command to Windows format
        const windowsCommand = this.convertToWindowsCommand(suggestion.command);
        
        // Create terminal session
        const terminalSessionId = this.createEnhancedTerminalSession(sessionId, suggestion);
        
        // Queue command with enhanced metadata
        this.commandQueue.push({
            id: commandId,
            command: windowsCommand,
            status: 'running',
            context,
            startTime: Date.now(),
            sessionId: terminalSessionId
        });

        try {
            // Execute command
            await this.executeCommandWithMonitoring(windowsCommand, terminalSessionId, suggestion);
            
            // Update command status
            const queueItem = this.commandQueue.find(item => item.id === commandId);
            if (queueItem) {
                queueItem.status = 'completed';
            }

            return `✅ Enhanced Execution Complete\n\n` +
                   `Command: ${windowsCommand}\n` +
                   `Description: ${suggestion.description}\n` +
                   `Confidence: ${(suggestion.confidence * 100).toFixed(0)}%\n` +
                   `Session ID: ${terminalSessionId}\n\n` +
                   `💡 Use 'show terminal status' for detailed monitoring`;

        } catch (error) {
            const queueItem = this.commandQueue.find(item => item.id === commandId);
            if (queueItem) {
                queueItem.status = 'failed';
            }
            throw error;
        }
    }

    private static convertToWindowsCommand(command: string): string {
        return command
            .replace(/&&/g, ';')  // Convert command chaining
            .replace(/\bls\b/g, 'dir')  // Convert ls to dir
            .replace(/\bcat\b/g, 'type')  // Convert cat to type  
            .replace(/\bgrep\b/g, 'findstr')  // Convert grep to findstr
            .replace(/\bmv\b/g, 'move')  // Convert mv to move
            .replace(/\bcp\b/g, 'copy')  // Convert cp to copy
            .replace(/\brm\b/g, 'del')  // Convert rm to del (be careful)
            .replace(/\btouch\b/g, 'echo. > '); // Convert touch
    }

    private static createEnhancedTerminalSession(sessionId: string, suggestion: SmartCommandSuggestion): string {
        const terminalName = `Enhanced-${suggestion.risk.toUpperCase()}-${Date.now()}`;
        const terminal = vscode.window.createTerminal(terminalName);
        
        this.activeTerminals.set(sessionId, terminal);
        terminal.show();

        // Clean up on close
        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                this.activeTerminals.delete(sessionId);
            }
        });

        return sessionId;
    }

    private static async executeCommandWithMonitoring(
        command: string,
        sessionId: string,
        suggestion: SmartCommandSuggestion
    ): Promise<void> {
        const terminal = this.activeTerminals.get(sessionId);
        if (!terminal) {
            throw new Error('Terminal session not found');
        }

        // Send command to terminal
        terminal.sendText(command);

        // Log execution activity
        this.activityDashboard.logActivity({
            timestamp: Date.now(),
            type: 'terminal',
            source: 'Enhanced ShellCommander',
            action: 'command_executed',
            details: `Executed: ${command}`,
            status: 'running',
            metadata: {
                command,
                sessionId,
                suggestion: suggestion.description,
                risk: suggestion.risk,
                confidence: suggestion.confidence
            }
        });
    }

    // Utility methods for context gathering
    private static async detectProjectType(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return 'unknown';
        }

        const files = await vscode.workspace.findFiles('package.json', null, 1);
        if (files.length > 0) {
            return 'nodejs';
        }

        const pythonFiles = await vscode.workspace.findFiles('requirements.txt', null, 1);
        if (pythonFiles.length > 0) {
            return 'python';
        }

        return 'general';
    }

    private static async detectPackageManager(): Promise<'npm' | 'yarn' | 'pnpm'> {
        const lockFiles = await Promise.all([
            vscode.workspace.findFiles('package-lock.json', null, 1),
            vscode.workspace.findFiles('yarn.lock', null, 1),
            vscode.workspace.findFiles('pnpm-lock.yaml', null, 1)
        ]);

        if (lockFiles[2].length > 0) {
            return 'pnpm';
        }
        if (lockFiles[1].length > 0) {
            return 'yarn';
        }
        return 'npm';
    }

    private static async getGitStatus(): Promise<string> {
        // This is a simplified implementation
        // In production, you might want to use Git APIs
        return 'clean';
    }

    // Enhanced agent integration
    static async processAgentCommand(agentId: string, agentName: string, command: string, context: any): Promise<string> {
        const request: AgentTerminalRequest = {
            agentId,
            agentName,
            command,
            context: {
                ...context,
                purpose: 'Agent-requested operation',
                urgency: context.urgency || 'medium'
            },
            executionOptions: {
                async: false,
                captureOutput: true,
                timeout: 30000
            }
        };

        try {
            const result = await this.agentBridge.processAgentRequest(request);
            return result.success ? 
                `Agent ${agentName} executed successfully: ${result.output}` :
                `Agent ${agentName} failed: ${result.error}`;
        } catch (error) {
            return `Agent command failed: ${error}`;
        }
    }

    // Status and monitoring methods
    static getEnhancedTerminalStatus(): string {
        const activeCount = this.activeTerminals.size;
        const queuedCount = this.commandQueue.filter(c => c.status === 'pending').length;
        const runningCount = this.commandQueue.filter(c => c.status === 'running').length;
        const completedCount = this.commandQueue.filter(c => c.status === 'completed').length;
        
        return `📊 Enhanced Terminal Status:\n` +
               `├─ Active terminals: ${activeCount}\n` +
               `├─ Running commands: ${runningCount}\n` +
               `├─ Queued commands: ${queuedCount}\n` +
               `├─ Completed commands: ${completedCount}\n` +
               `└─ Success rate: ${completedCount > 0 ? ((completedCount / this.commandQueue.length) * 100).toFixed(1) : 0}%`;
    }

    static isEnhancedShellRequest(prompt: string): boolean {
        return /run|execute|install|start|stop|build|deploy|git|npm|yarn|docker|list|create.*folder|delete.*file|parallel|simultaneously|terminal.*status|show.*status|enhanced.*command|smart.*terminal/i.test(prompt);
    }

    static async handleEnhancedStatusRequest(prompt: string): Promise<string> {
        if (/terminal.*status|show.*status/i.test(prompt)) {
            return this.getEnhancedTerminalStatus();
        }
        return this.executeEnhancedNLPCommand(prompt);
    }
}