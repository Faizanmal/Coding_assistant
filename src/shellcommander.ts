import * as vscode from 'vscode';
import { callAI } from './cli-api';

export class ShellCommander {
    private static activeTerminals: Map<string, vscode.Terminal> = new Map();
    private static commandQueue: Array<{id: string, command: string, status: 'pending' | 'running' | 'completed' | 'failed'}> = [];

    static async executeNLPCommand(prompt: string): Promise<string> {
        const commandPrompt = `Parse this request into executable commands with priorities:

"${prompt}"

Return JSON format:
{
  "commands": [
    {"cmd": "npm install", "priority": 1, "canParallel": true},
    {"cmd": "npm start", "priority": 2, "canParallel": false}
  ],
  "execution": "parallel" or "sequential"
}`;

        const response = await callAI(commandPrompt);
        const parsed = this.parseCommandResponse(response);
        
        if (!parsed.commands.length) {
            throw new Error('No valid commands found');
        }

        const isParallel = /parallel|simultaneously|together/i.test(prompt) || parsed.execution === 'parallel';
        
        if (isParallel) {
            return await this.executeEnhancedParallel(parsed.commands, prompt);
        } else {
            return await this.executeEnhancedSequential(parsed.commands);
        }
    }

    private static parseCommandResponse(response: string): {commands: Array<{cmd: string, priority: number, canParallel: boolean}>, execution: string} {
        try {
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            return JSON.parse(cleaned);
        } catch {
            // Fallback parsing
            const commands = response.split('&&').map((cmd, i) => ({
                cmd: cmd.trim(),
                priority: i + 1,
                canParallel: true
            }));
            return { commands, execution: 'sequential' };
        }
    }

    private static async executeEnhancedSequential(commands: Array<{cmd: string, priority: number}>): Promise<string> {
        const sortedCommands = commands.sort((a, b) => a.priority - b.priority);
        const terminal = vscode.window.createTerminal('Sequential Pipeline');
        terminal.show();
        
        for (const {cmd} of sortedCommands) {
            terminal.sendText(cmd);
            await this.delay(500); // Brief delay between commands
        }
        
        return `⚡ Sequential pipeline: ${sortedCommands.length} commands executed in priority order`;
    }

    private static async executeEnhancedParallel(commands: Array<{cmd: string, priority: number, canParallel: boolean}>, originalPrompt: string): Promise<string> {
        const parallelCommands = commands.filter(c => c.canParallel);
        const sequentialCommands = commands.filter(c => !c.canParallel);
        
        // Execute parallel commands
        const parallelResults = await Promise.allSettled(
            parallelCommands.map(async ({cmd}, index) => {
                const terminalName = `Parallel-${this.getCommandType(cmd)}-${index + 1}`;
                const terminal = this.getOrCreateTerminal(terminalName);
                terminal.show();
                terminal.sendText(cmd);
                
                this.commandQueue.push({
                    id: `${Date.now()}-${index}`,
                    command: cmd,
                    status: 'running'
                });
                
                return { terminal: terminalName, command: cmd };
            })
        );

        // Execute sequential commands after parallel ones
        if (sequentialCommands.length > 0) {
            await this.delay(1000);
            await this.executeEnhancedSequential(sequentialCommands);
        }

        const successCount = parallelResults.filter(r => r.status === 'fulfilled').length;
        
        return `🚀 Enhanced Parallel Execution:\n` +
               `├─ ${successCount}/${parallelCommands.length} parallel commands started\n` +
               `├─ ${sequentialCommands.length} sequential commands queued\n` +
               `└─ Active terminals: ${this.activeTerminals.size}\n\n` +
               `💡 Use 'show terminal status' to monitor progress`;
    }

    private static getOrCreateTerminal(name: string): vscode.Terminal {
        if (this.activeTerminals.has(name)) {
            return this.activeTerminals.get(name)!;
        }
        
        const terminal = vscode.window.createTerminal(name);
        this.activeTerminals.set(name, terminal);
        
        // Clean up on terminal close
        vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                this.activeTerminals.delete(name);
            }
        });
        
        return terminal;
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

    static getTerminalStatus(): string {
        const activeCount = this.activeTerminals.size;
        const queuedCount = this.commandQueue.filter(c => c.status === 'pending').length;
        const runningCount = this.commandQueue.filter(c => c.status === 'running').length;
        
        return `📊 Terminal Status:\n` +
               `├─ Active terminals: ${activeCount}\n` +
               `├─ Running commands: ${runningCount}\n` +
               `└─ Queued commands: ${queuedCount}`;
    }

    static isShellRequest(prompt: string): boolean {
        return /run|execute|install|start|stop|build|deploy|git|npm|yarn|docker|list|create.*folder|delete.*file|parallel|simultaneously|terminal.*status|show.*status/i.test(prompt);
    }

    static async handleStatusRequest(prompt: string): Promise<string> {
        if (/terminal.*status|show.*status/i.test(prompt)) {
            return this.getTerminalStatus();
        }
        return this.executeNLPCommand(prompt);
    }
}