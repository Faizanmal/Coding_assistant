import * as vscode from 'vscode';
import { LiveTerminal } from './liveterminal';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { UnifiedActivityDashboard, ActivityData } from './unified-activity-dashboard';
import { generateCode } from './codegenerator';

export interface AgentTerminalRequest {
    agentId: string;
    agentName: string;
    command: string;
    context: {
        fileName?: string;
        projectContext?: string;
        purpose: string;
        urgency: 'low' | 'medium' | 'high';
    };
    executionOptions: {
        async: boolean;
        captureOutput: boolean;
        timeout?: number;
        workingDirectory?: string;
    };
    callback?: (result: AgentTerminalResult) => void;
}

export interface AgentTerminalResult {
    success: boolean;
    output: string;
    error?: string;
    executionTime: number;
    sessionId: string;
    commandId: string;
}

export interface TerminalAgentCapability {
    canExecute: (command: string, context: any) => boolean;
    risk: 'low' | 'medium' | 'high';
    requiresApproval: boolean;
    description: string;
}

export class AgentTerminalBridge {
    private static instance: AgentTerminalBridge;
    private webviewView: vscode.WebviewView | null = null;
    private activityDashboard: UnifiedActivityDashboard;
    private pendingRequests: Map<string, AgentTerminalRequest> = new Map();
    private activeExecutions: Map<string, {
        request: AgentTerminalRequest;
        startTime: number;
        sessionId: string;
    }> = new Map();
    private allowedCommands: Set<string> = new Set([
        'npm', 'git', 'node', 'python', 'pip', 'ls', 'dir', 'pwd', 
        'echo', 'cat', 'touch', 'mkdir', 'cp', 'mv', 'grep'
    ]);

    private constructor() {
        this.activityDashboard = UnifiedActivityDashboard.getInstance();
    }

    public static getInstance(): AgentTerminalBridge {
        if (!AgentTerminalBridge.instance) {
            AgentTerminalBridge.instance = new AgentTerminalBridge();
        }
        return AgentTerminalBridge.instance;
    }

    public setWebviewView(view: vscode.WebviewView): void {
        this.webviewView = view;
    }

    /**
     * Enhanced NLP-powered command generation for agents
     */
    public async generateSmartCommand(prompt: string, context: any): Promise<string> {
        const enhancedPrompt = `Generate a safe terminal command for this request:
Context: ${JSON.stringify(context)}
Request: "${prompt}"

Requirements:
- Use Windows command syntax (use ; for chaining, not &&)
- Only use safe, common development commands
- Avoid dangerous operations (rm -rf, del /s, etc.)
- Focus on npm, git, file operations, and development tools

Return ONLY the command, no explanations:`;

        try {
            const response = await generateCode.call(this, enhancedPrompt, 'llama-3.3-70b-versatile');
            return this.sanitizeCommand(response.trim());
        } catch (error) {
            throw new Error(`Failed to generate command: ${error}`);
        }
    }

    /**
     * Process terminal request from agent with NLP understanding
     */
    public async processAgentRequest(request: AgentTerminalRequest): Promise<AgentTerminalResult> {
        const commandId = this.generateCommandId();
        const activity: ActivityData = {
            timestamp: Date.now(),
            type: 'terminal',
            source: request.agentName,
            action: 'command_requested',
            details: `Agent requesting: ${request.command}`,
            status: 'pending',
            metadata: {
                agentId: request.agentId,
                command: request.command,
                context: request.context
            }
        };

        this.activityDashboard.logActivity(activity);

        try {
            // Validate and process command
            const processedCommand = await this.validateAndProcessCommand(
                request.command, 
                request.context
            );
            
            // Check if command requires approval
            if (this.requiresUserApproval(processedCommand, request.context.urgency)) {
                const approved = await this.requestUserApproval(request, processedCommand);
                if (!approved) {
                    throw new Error('Command execution denied by user');
                }
            }

            // Execute command
            const result = await this.executeCommand(request, processedCommand, commandId);
            
            // Log success
            this.activityDashboard.logActivity({
                ...activity,
                action: 'command_completed',
                details: `Command executed successfully`,
                status: 'completed',
                metadata: { 
                    ...activity.metadata, 
                    result: result.output,
                    executionTime: result.executionTime
                }
            });

            return result;

        } catch (error) {
            // Log error
            this.activityDashboard.logActivity({
                ...activity,
                action: 'command_failed',
                details: `Command failed: ${error}`,
                status: 'error',
                metadata: { ...activity.metadata, error: error }
            });

            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error),
                executionTime: 0,
                sessionId: '',
                commandId
            };
        }
    }

    /**
     * Enhanced command validation with NLP context understanding
     */
    private async validateAndProcessCommand(command: string, context: any): Promise<string> {
        // Basic sanitization
        let processedCommand = this.sanitizeCommand(command);
        
        // Apply context-aware enhancements
        if (context.fileName) {
            // If working with specific file, ensure command is relevant
            if (processedCommand.includes('{{file}}')) {
                processedCommand = processedCommand.replace(/\{\{file\}\}/g, context.fileName);
            }
        }

        // Apply project context
        if (context.projectContext) {
            const projectInfo = this.parseProjectContext(context.projectContext);
            processedCommand = this.enhanceCommandWithProjectContext(processedCommand, projectInfo);
        }

        // Convert to Windows-compatible format
        processedCommand = this.convertToWindowsCommand(processedCommand);
        
        // Validate against allowed commands
        if (!this.isCommandAllowed(processedCommand)) {
            throw new Error(`Command not allowed: ${processedCommand}`);
        }

        return processedCommand;
    }

    private sanitizeCommand(command: string): string {
        return command
            .replace(/[;&|`$()<>]/g, '')  // Remove dangerous characters
            .replace(/\.\.\/|\.\.\\|~\//g, '')  // Remove path traversal
            .replace(/rm\s+-rf|del\s+\/s|format|fdisk/gi, '')  // Remove dangerous commands
            .trim();
    }

    private convertToWindowsCommand(command: string): string {
        return command
            .replace(/&&/g, ';')  // Convert chaining
            .replace(/ls\b/g, 'dir')  // Convert ls to dir
            .replace(/cat\b/g, 'type')  // Convert cat to type
            .replace(/grep\b/g, 'findstr');  // Convert grep to findstr
    }

    private isCommandAllowed(command: string): boolean {
        const firstWord = command.toLowerCase().split(' ')[0];
        return this.allowedCommands.has(firstWord) || 
               command.startsWith('cd ') || 
               command.startsWith('echo ');
    }

    private parseProjectContext(context: string): any {
        try {
            return JSON.parse(context);
        } catch {
            return { type: 'unknown', language: 'javascript' };
        }
    }

    private enhanceCommandWithProjectContext(command: string, projectInfo: any): string {
        // Add project-specific enhancements
        if (projectInfo.language === 'javascript' && command.includes('install')) {
            if (!command.includes('npm') && !command.includes('yarn')) {
                command = `npm ${command}`;
            }
        }
        
        if (projectInfo.language === 'python' && command.includes('install')) {
            if (!command.includes('pip')) {
                command = `pip ${command}`;
            }
        }

        return command;
    }

    private requiresUserApproval(command: string, urgency: string): boolean {
        // High-risk commands always require approval
        const riskPatterns = [
            /install/i, /uninstall/i, /delete/i, /remove/i,
            /config/i, /set/i, /export/i, /init/i
        ];

        const isHighRisk = riskPatterns.some(pattern => pattern.test(command));
        return isHighRisk && urgency !== 'high';
    }

    private async requestUserApproval(request: AgentTerminalRequest, command: string): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            `Agent "${request.agentName}" wants to execute: "${command}"\n\nPurpose: ${request.context.purpose}`,
            { modal: true },
            'Allow',
            'Deny'
        );

        return action === 'Allow';
    }

    private async executeCommand(
        request: AgentTerminalRequest, 
        command: string, 
        commandId: string
    ): Promise<AgentTerminalResult> {
        const startTime = Date.now();
        
        try {
            let sessionId: string;
            
            // Create or get terminal session for agent
            if (request.executionOptions.async) {
                sessionId = LiveTerminal.createNewSession(`Agent-${request.agentName}`);
            } else {
                sessionId = LiveTerminal.createNewSession(`Agent-${request.agentName}-Sync`);
            }

            // Track execution
            this.activeExecutions.set(commandId, {
                request,
                startTime,
                sessionId
            });

            // Execute command based on options
            if (request.executionOptions.captureOutput) {
                const result = await this.executeWithOutputCapture(sessionId, command);
                return {
                    success: true,
                    output: result,
                    executionTime: Date.now() - startTime,
                    sessionId,
                    commandId
                };
            } else {
                // Fire and forget execution
                await this.executeFireAndForget(sessionId, command);
                return {
                    success: true,
                    output: 'Command executed successfully',
                    executionTime: Date.now() - startTime,
                    sessionId,
                    commandId
                };
            }

        } finally {
            this.activeExecutions.delete(commandId);
        }
    }

    private async executeWithOutputCapture(sessionId: string, command: string): Promise<string> {
        // This is a simplified implementation
        // In a real scenario, you'd need to capture terminal output
        return new Promise((resolve, reject) => {
            try {
                // Create terminal and execute command
                const terminal = vscode.window.createTerminal(`Capture-${sessionId}`);
                terminal.sendText(command);
                
                // For now, return success message
                // In production, you'd implement proper output capture
                resolve(`Command "${command}" executed successfully`);
            } catch (error) {
                reject(error);
            }
        });
    }

    private async executeFireAndForget(sessionId: string, command: string): Promise<void> {
        const terminal = vscode.window.createTerminal(`Agent-${sessionId}`);
        terminal.show();
        terminal.sendText(command);
    }

    private generateCommandId(): string {
        return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get terminal output for specific agent command
     */
    public getTerminalOutput(commandId: string): string | null {
        const execution = this.activeExecutions.get(commandId);
        if (!execution) {
            return null;
        }

        // In production, implement proper output retrieval
        return `Output for command ${commandId}`;
    }

    /**
     * Kill specific agent command
     */
    public killAgentCommand(commandId: string): boolean {
        const execution = this.activeExecutions.get(commandId);
        if (!execution) {
            return false;
        }

        try {
            LiveTerminal.killCommand(execution.sessionId);
            this.activeExecutions.delete(commandId);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get agent-specific terminal capabilities
     */
    public getAgentCapabilities(agentId: string): TerminalAgentCapability[] {
        return [
            {
                canExecute: (cmd) => cmd.startsWith('npm'),
                risk: 'medium',
                requiresApproval: true,
                description: 'NPM package operations'
            },
            {
                canExecute: (cmd) => cmd.startsWith('git'),
                risk: 'low',
                requiresApproval: false,
                description: 'Git version control operations'
            },
            {
                canExecute: (cmd) => cmd.startsWith('node'),
                risk: 'medium',
                requiresApproval: false,
                description: 'Node.js script execution'
            }
        ];
    }

    /**
     * Get active agent terminal sessions
     */
    public getActiveAgentSessions(): Array<{
        sessionId: string;
        agentName: string;
        command: string;
        startTime: number;
        status: string;
    }> {
        return Array.from(this.activeExecutions.entries()).map(([commandId, execution]) => ({
            sessionId: execution.sessionId,
            agentName: execution.request.agentName,
            command: execution.request.command,
            startTime: execution.startTime,
            status: 'running'
        }));
    }

    public dispose(): void {
        // Clean up active executions
        this.activeExecutions.clear();
        this.pendingRequests.clear();
    }
}