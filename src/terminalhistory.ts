import * as vscode from 'vscode';

interface TerminalHistoryEntry {
    command: string;
    timestamp: Date;
    sessionId: string;
    sessionName: string;
    exitCode?: number;
    output?: string;
    workingDirectory: string;
}

export class TerminalHistory {
    private static readonly MAX_HISTORY_ENTRIES = 500;
    private static readonly STORAGE_KEY = 'terminalCommandHistory';
    private static context: vscode.ExtensionContext;
    private static history: TerminalHistoryEntry[] = [];

    static initialize(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadHistory();
    }

    private static loadHistory() {
        const storedHistory = this.context.globalState.get(this.STORAGE_KEY, []);
        this.history = storedHistory.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
        }));
    }

    private static saveHistory() {
        // Keep only the most recent entries
        if (this.history.length > this.MAX_HISTORY_ENTRIES) {
            this.history = this.history.slice(-this.MAX_HISTORY_ENTRIES);
        }
        this.context.globalState.update(this.STORAGE_KEY, this.history);
    }

    static addCommand(
        command: string, 
        sessionId: string, 
        sessionName: string, 
        workingDirectory: string
    ) {
        const entry: TerminalHistoryEntry = {
            command,
            timestamp: new Date(),
            sessionId,
            sessionName,
            workingDirectory
        };
        
        this.history.push(entry);
        this.saveHistory();
    }

    static updateCommandResult(sessionId: string, exitCode: number, output?: string) {
        // Find the most recent command for this session
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].sessionId === sessionId && this.history[i].exitCode === undefined) {
                this.history[i].exitCode = exitCode;
                this.history[i].output = output;
                this.saveHistory();
                break;
            }
        }
    }

    static searchHistory(query: string, limit: number = 20): TerminalHistoryEntry[] {
        const lowerQuery = query.toLowerCase();
        
        return this.history
            .filter(entry => 
                entry.command.toLowerCase().includes(lowerQuery) ||
                entry.sessionName.toLowerCase().includes(lowerQuery) ||
                entry.workingDirectory.toLowerCase().includes(lowerQuery)
            )
            .slice(-limit)
            .reverse(); // Most recent first
    }

    static getRecentCommands(limit: number = 10): TerminalHistoryEntry[] {
        return this.history
            .slice(-limit)
            .reverse(); // Most recent first
    }

    static getCommandsBySession(sessionId: string): TerminalHistoryEntry[] {
        return this.history
            .filter(entry => entry.sessionId === sessionId)
            .reverse(); // Most recent first
    }

    static getFrequentCommands(limit: number = 10): Array<{command: string, count: number}> {
        const commandCounts: Map<string, number> = new Map();
        
        this.history.forEach(entry => {
            const count = commandCounts.get(entry.command) || 0;
            commandCounts.set(entry.command, count + 1);
        });
        
        return Array.from(commandCounts.entries())
            .map(([command, count]) => ({command, count}))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    static clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    static getHistoryStats(): {
        totalCommands: number;
        sessionsCount: number;
        successRate: number;
        mostUsedCommand: string;
        recentActivity: string;
    } {
        const uniqueSessions = new Set(this.history.map(entry => entry.sessionId));
        const commandsWithResults = this.history.filter(entry => entry.exitCode !== undefined);
        const successfulCommands = commandsWithResults.filter(entry => entry.exitCode === 0);
        
        const frequentCommands = this.getFrequentCommands(1);
        const mostUsedCommand = frequentCommands.length > 0 ? frequentCommands[0].command : 'None';
        
        const recentEntry = this.history[this.history.length - 1];
        const recentActivity = recentEntry 
            ? `${recentEntry.command} (${recentEntry.timestamp.toLocaleString()})`
            : 'No recent activity';

        return {
            totalCommands: this.history.length,
            sessionsCount: uniqueSessions.size,
            successRate: commandsWithResults.length > 0 
                ? Math.round((successfulCommands.length / commandsWithResults.length) * 100)
                : 0,
            mostUsedCommand,
            recentActivity
        };
    }

    static exportHistory(): string {
        let exportData = '# Terminal Command History\n\n';
        exportData += `Generated: ${new Date().toISOString()}\n`;
        exportData += `Total Commands: ${this.history.length}\n\n`;
        
        exportData += '## Command History\n\n';
        
        this.history.forEach((entry, index) => {
            exportData += `### ${index + 1}. ${entry.command}\n`;
            exportData += `- **Session**: ${entry.sessionName} (${entry.sessionId})\n`;
            exportData += `- **Time**: ${entry.timestamp.toISOString()}\n`;
            exportData += `- **Directory**: ${entry.workingDirectory}\n`;
            if (entry.exitCode !== undefined) {
                exportData += `- **Exit Code**: ${entry.exitCode}\n`;
            }
            if (entry.output) {
                exportData += `- **Output**: \`\`\`\n${entry.output.slice(0, 200)}${entry.output.length > 200 ? '...' : ''}\n\`\`\`\n`;
            }
            exportData += '\n';
        });
        
        return exportData;
    }

    static getAutocompleteSuggestions(partial: string): string[] {
        const lowerPartial = partial.toLowerCase();
        const suggestions = new Set<string>();
        
        // Add matching commands from history
        this.history.forEach(entry => {
            if (entry.command.toLowerCase().startsWith(lowerPartial)) {
                suggestions.add(entry.command);
            }
        });
        
        // Add common command patterns
        const commonCommands = [
            'npm install', 'npm start', 'npm test', 'npm run build',
            'git status', 'git add .', 'git commit -m', 'git push', 'git pull',
            'node index.js', 'python main.py', 'ls -la', 'pwd', 'cd ..'
        ];
        
        commonCommands.forEach(cmd => {
            if (cmd.toLowerCase().startsWith(lowerPartial)) {
                suggestions.add(cmd);
            }
        });
        
        return Array.from(suggestions).slice(0, 10);
    }
}