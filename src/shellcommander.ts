import * as vscode from 'vscode';
import { callAI } from './cli-api';
import { UnifiedActivityDashboard, ActivityData } from './unified-activity-dashboard';
import { AgentTerminalBridge, AgentTerminalRequest } from './agent-terminal-bridge';

// --- INTERFACES ---

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

interface MultiCommand {
    cmd: string;
    priority: number;
    canParallel: boolean;
}

interface ParsedMultiCommandResponse {
    commands: MultiCommand[];
    execution: 'parallel' | 'sequential';
}


// --- MAIN CLASS ---

export class ShellCommander {
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

    // --- PRIMARY NLP COMMAND EXECUTION (ENHANCED SINGLE COMMAND) ---

    /**
     * Processes a natural language prompt to generate and execute a single, context-aware command.
     * This is the main entry point for smart command suggestions.
     * @param prompt The user's natural language request.
     * @param context Optional initial context about the user's workspace.
     * @returns A string with the result of the execution.
     */
    static async executeEnhancedNLPCommand(prompt: string, context?: EnhancedCommandContext): Promise<string> {
        const activity: ActivityData = {
            timestamp: Date.now(),
            type: 'terminal',
            source: 'ShellCommander',
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
                throw new Error('No valid commands could be generated from the prompt.');
            }

            const selectedCommand = await this.selectOptimalCommand(suggestions);
            const result = await this.executeWithEnhancedMonitoring(selectedCommand, enhancedContext);

            this.activityDashboard.logActivity({
                ...activity,
                status: 'completed',
                details: `Successfully executed: ${selectedCommand.command}`,
                metadata: { ...activity.metadata, result }
            });

            return result;
        } catch (error: any) {
            this.activityDashboard.logActivity({
                ...activity,
                status: 'error',
                details: `Failed: ${error.message}`,
                metadata: { ...activity.metadata, error }
            });
            throw error;
        }
    }

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

        try {
            enhancedContext.gitStatus = await this.getGitStatus();
        } catch {
            enhancedContext.gitStatus = 'not_a_git_repo';
        }
        return enhancedContext;
    }

    private static async generateSmartCommands(prompt: string, context: EnhancedCommandContext): Promise<SmartCommandSuggestion[]> {
        const enhancedPrompt = `You are an expert terminal command assistant. Generate Windows-compatible shell commands for the following request.

PROMPT: "${prompt}"

CONTEXT:
- Project Type: ${context.projectType}
- Directory: ${context.currentDirectory}
- Package Manager: ${context.packageManager}
- Git Status: ${context.gitStatus}
- Open Files: ${context.openFiles?.slice(0, 5).join(', ') || 'none'}
- User Intent: ${context.userIntent}

REQUIREMENTS:
- Use Windows command syntax (e.g., use ';' or '&' for chaining, not '&&').
- Convert common Unix commands to their Windows equivalents (e.g., ls -> dir, cat -> type, rm -> del).
- Provide 2-3 command options with varying approaches or risk levels if applicable.
- Include detailed, practical reasoning for each suggestion.
- The response MUST be a valid JSON object matching the specified format.

RESPONSE FORMAT (JSON only):
{
  "suggestions": [
    {
      "command": "npm install express",
      "description": "Installs the Express.js framework using npm.",
      "risk": "low",
      "confidence": 0.95,
      "reasoning": "The project is identified as Node.js, and the prompt asks to add a web server, for which Express is a standard choice.",
      "alternatives": ["yarn add express", "pnpm add express"]
    }
  ]
}

Generate thoughtful, context-aware commands:`;

        try {
            const response = await callAI(enhancedPrompt);
            const parsed = this.parseSmartCommandResponse(response);
            return parsed.suggestions || [];
        } catch (error) {
            console.error("AI command generation failed, falling back to basic methods.", error);
            return this.generateFallbackCommands(prompt, context);
        }
    }

    private static parseSmartCommandResponse(response: string): { suggestions: SmartCommandSuggestion[] } {
        try {
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("Failed to parse smart command JSON response:", error);
            return { suggestions: [] };
        }
    }

    private static generateFallbackCommands(prompt: string, context: EnhancedCommandContext): SmartCommandSuggestion[] {
        const suggestions: SmartCommandSuggestion[] = [];
        if (/install|add dependency/i.test(prompt)) {
            suggestions.push({
                command: `${context.packageManager || 'npm'} install`,
                description: 'Install packages using the detected package manager',
                risk: 'low',
                confidence: 0.7,
                reasoning: 'Fallback based on keyword "install".'
            });
        }
        if (/start|run dev|serve/i.test(prompt)) {
            suggestions.push({
                command: `${context.packageManager || 'npm'} start`,
                description: 'Start the development server',
                risk: 'low',
                confidence: 0.8,
                reasoning: 'Fallback based on keyword "start" or "run".'
            });
        }
        if (/git status/i.test(prompt)) {
            suggestions.push({
                command: 'git status',
                description: 'Check Git repository status',
                risk: 'low',
                confidence: 0.9,
                reasoning: 'Direct match for "git status".'
            });
        }
        return suggestions;
    }

    private static async selectOptimalCommand(suggestions: SmartCommandSuggestion[]): Promise<SmartCommandSuggestion> {
        const sortedSuggestions = suggestions.sort((a, b) => {
            const riskWeight = { 'low': 3, 'medium': 2, 'high': 1 };
            if (a.risk !== b.risk) {
                return riskWeight[a.risk] - riskWeight[b.risk];
            }
            return b.confidence - a.confidence;
        });

        const bestSuggestion = sortedSuggestions[0];

        if (bestSuggestion.risk === 'high') {
            const choice = await vscode.window.showWarningMessage(
                `High-risk command detected: "${bestSuggestion.command}"\n\nReasoning: ${bestSuggestion.reasoning}`,
                { modal: true },
                'Execute', 'Show Alternatives', 'Cancel'
            );

            if (choice === 'Cancel' || !choice) {
                throw new Error('Command execution cancelled by user.');
            }

            if (choice === 'Show Alternatives') {
                const alternativeOptions = (bestSuggestion.alternatives || []).concat(
                    sortedSuggestions.slice(1).map(s => s.command)
                );
                const selected = await vscode.window.showQuickPick(alternativeOptions, {
                    placeHolder: 'Select an alternative command to execute'
                });
                if (selected) {
                    return { ...bestSuggestion, command: selected };
                }
                throw new Error('No alternative selected.');
            }
        }
        return bestSuggestion;
    }

    private static async executeWithEnhancedMonitoring(suggestion: SmartCommandSuggestion, context: EnhancedCommandContext): Promise<string> {
        const commandId = `cmd_${Date.now()}`;
        const windowsCommand = this.convertToWindowsCommand(suggestion.command);
        const terminalSessionId = this.createEnhancedTerminalSession(commandId, suggestion);
        const terminal = this.activeTerminals.get(terminalSessionId);

        if (!terminal) {
            throw new Error(`Failed to create terminal session: ${terminalSessionId}`);
        }

        this.commandQueue.push({
            id: commandId,
            command: windowsCommand,
            status: 'running',
            context,
            startTime: Date.now(),
            sessionId: terminalSessionId
        });

        try {
            terminal.sendText(windowsCommand, true);
            const queueItem = this.commandQueue.find(item => item.id === commandId);
            if (queueItem) {
                queueItem.status = 'completed';
            }
            return `✅ Command sent to terminal.\n\n` +
                   `Command: ${windowsCommand}\n` +
                   `Session ID: ${terminalSessionId}\n\n` +
                   `💡 Use 'show terminal status' for detailed monitoring.`;
        } catch (error) {
            const queueItem = this.commandQueue.find(item => item.id === commandId);
            if (queueItem) {
                queueItem.status = 'failed';
            }
            throw error;
        }
    }

    // --- MULTI-COMMAND EXECUTION (PARALLEL & SEQUENTIAL) ---

    /**
     * Parses a prompt into multiple commands and executes them either sequentially or in parallel.
     * @param prompt The user's request, e.g., "install dependencies and then start the server".
     * @returns A string summarizing the execution plan.
     */
    static async executeMultiCommandFromPrompt(prompt: string): Promise<string> {
        const commandPrompt = `Parse the following user request into a sequence of executable shell commands.
User Request: "${prompt}"

Determine if the commands should be run in "sequential" or "parallel" order.
Provide a priority for sequential execution (lower runs first). Mark if a command is safe for parallel execution.

Return JSON format only:
{
  "commands": [
    {"cmd": "npm install", "priority": 1, "canParallel": false},
    {"cmd": "npm run build", "priority": 2, "canParallel": false},
    {"cmd": "npm start", "priority": 3, "canParallel": false}
  ],
  "execution": "sequential"
}`;
        const response = await callAI(commandPrompt);
        const parsed = this.parseMultiCommandResponse(response);

        if (!parsed.commands || parsed.commands.length === 0) {
            throw new Error('No valid commands found in the prompt.');
        }

        if (parsed.execution === 'parallel') {
            return this.executeEnhancedParallel(parsed.commands);
        } else {
            return this.executeEnhancedSequential(parsed.commands);
        }
    }

    private static parseMultiCommandResponse(responseString: string): ParsedMultiCommandResponse {
        try {
            const cleaned = responseString.replace(/```json\n?/, '').replace(/```$/, '').trim();
            return JSON.parse(cleaned);
        } catch {
            // Fallback for simple "&&" chained commands
            const commands = responseString.split('&&').map((cmd, i) => ({
                cmd: cmd.trim(),
                priority: i + 1,
                canParallel: false
            }));
            return { commands, execution: 'sequential' };
        }
    }

    private static async executeEnhancedSequential(commands: MultiCommand[]): Promise<string> {
        const sortedCommands = commands.sort((a, b) => a.priority - b.priority);
        const sessionId = `sequential_${Date.now()}`;
        const terminal = this.getOrCreateTerminal(sessionId, 'Sequential Pipeline');
        
        for (const { cmd } of sortedCommands) {
            const windowsCommand = this.convertToWindowsCommand(cmd);
            terminal.sendText(windowsCommand, true);
            await this.delay(500); // Brief delay for command to start
        }

        return `⚡ Sequential pipeline started: ${sortedCommands.length} commands sent to one terminal.`;
    }

    private static async executeEnhancedParallel(commands: MultiCommand[]): Promise<string> {
        const parallelCommands = commands.filter(c => c.canParallel);
        const sequentialCommands = commands.filter(c => !c.canParallel);

        // Execute parallel commands in separate terminals
        await Promise.allSettled(
            parallelCommands.map(async ({ cmd }, index) => {
                const terminalName = `Parallel-${this.getCommandType(cmd)}-${index + 1}`;
                const terminal = this.getOrCreateTerminal(`${Date.now()}-${index}`, terminalName);
                const windowsCommand = this.convertToWindowsCommand(cmd);
                terminal.sendText(windowsCommand, true);
            })
        );

        // Execute sequential commands after parallel ones
        if (sequentialCommands.length > 0) {
            await this.delay(1000);
            await this.executeEnhancedSequential(sequentialCommands);
        }

        return `🚀 Enhanced Parallel Execution Started:\n` +
               `├─ ${parallelCommands.length} parallel commands sent to separate terminals.\n` +
               `└─ ${sequentialCommands.length} sequential commands sent to a single terminal.`;
    }

    // --- AGENT & BACKWARD COMPATIBILITY ---

    static async processAgentCommand(agentId: string, agentName: string, command: string, context: any): Promise<string> {
        const request: AgentTerminalRequest = {
            agentId, agentName, command,
            context: { ...context, purpose: 'Agent-requested operation' },
            executionOptions: { async: false, captureOutput: true, timeout: 30000 }
        };
        try {
            const result = await this.agentBridge.processAgentRequest(request);
            return result.success ?
                `Agent ${agentName} executed successfully: ${result.output}` :
                `Agent ${agentName} failed: ${result.error}`;
        } catch (error: any) {
            return `Agent command failed: ${error.message}`;
        }
    }

    static async executeNLPCommand(prompt: string): Promise<string> {
        return this.executeEnhancedNLPCommand(prompt, { userIntent: 'legacy_call' });
    }

    // --- UTILITY & HELPER METHODS ---

    private static convertToWindowsCommand(command: string): string {
        return command
            .replace(/&&/g, '&')
            .replace(/\bls\b/g, 'dir')
            .replace(/\bcat\b/g, 'type')
            .replace(/\bgrep\b/g, 'findstr')
            .replace(/\bmv\b/g, 'move')
            .replace(/\bcp\b/g, 'copy')
            .replace(/\brm\b/g, 'del')
            .replace(/\btouch\b/g, 'echo. > ');
    }
    
    private static createEnhancedTerminalSession(sessionId: string, suggestion: SmartCommandSuggestion): string {
        const terminalName = `Enhanced-${suggestion.risk.toUpperCase()}-${sessionId.slice(-4)}`;
        return this.getOrCreateTerminal(sessionId, terminalName).name;
    }

    private static getOrCreateTerminal(sessionId: string, terminalName: string): vscode.Terminal {
        if (this.activeTerminals.has(sessionId)) {
            const existingTerminal = this.activeTerminals.get(sessionId)!;
            // Check if terminal is disposed
            if ((existingTerminal as any)._isDisposed) {
                this.activeTerminals.delete(sessionId);
            } else {
                return existingTerminal;
            }
        }
        
        const terminal = vscode.window.createTerminal(terminalName);
        this.activeTerminals.set(sessionId, terminal);
        terminal.show();

        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                this.activeTerminals.delete(sessionId);
            }
        });
        return terminal;
    }
    
    private static async detectProjectType(): Promise<string> {
        if ((await vscode.workspace.findFiles('package.json', null, 1)).length > 0) {return 'nodejs';}
        if ((await vscode.workspace.findFiles('requirements.txt', null, 1)).length > 0) {return 'python';}
        if ((await vscode.workspace.findFiles('pom.xml', null, 1)).length > 0) {return 'java_maven';}
        if ((await vscode.workspace.findFiles('*.csproj', null, 1)).length > 0) {return 'dotnet';}
        return 'general';
    }

    private static async detectPackageManager(): Promise<'npm' | 'yarn' | 'pnpm'> {
        if ((await vscode.workspace.findFiles('pnpm-lock.yaml', null, 1)).length > 0) {return 'pnpm';}
        if ((await vscode.workspace.findFiles('yarn.lock', null, 1)).length > 0) {return 'yarn';}
        return 'npm';
    }

    private static async getGitStatus(): Promise<string> {
        // In a real scenario, this would involve executing `git status --porcelain`
        // and parsing the output. This is a simplified placeholder.
        return 'clean';
    }

    private static getCommandType(command: string): string {
        if (command.includes('npm')) {return 'NPM';}
        if (command.includes('git')) {return 'GIT';}
        if (command.includes('docker')) {return 'DOCKER';}
        if (command.includes('build')) {return 'BUILD';}
        return 'CMD';
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- STATUS & REQUEST HANDLING ---

    static getTerminalStatus(): string {
        const activeCount = this.activeTerminals.size;
        const runningCount = this.commandQueue.filter(c => c.status === 'running').length;
        const queuedCount = this.commandQueue.filter(c => c.status === 'pending').length;
        return `📊 Terminal Status:\n` +
               `├─ Active Terminals: ${activeCount}\n` +
               `├─ Running Commands: ${runningCount}\n` +
               `└─ Queued Commands: ${queuedCount}`;
    }

    static isShellRequest(prompt: string): boolean {
        const keywords = /run|execute|install|start|stop|build|deploy|git|npm|yarn|docker|list|create|delete|parallel|terminal|status/i;
        return keywords.test(prompt);
    }

    static async handleStatusRequest(prompt: string): Promise<string> {
        if (/terminal status|show status/i.test(prompt)) {
            return this.getTerminalStatus();
        }
        // By default, use the enhanced NLP command for other shell-like requests
        return this.executeEnhancedNLPCommand(prompt);
    }
}