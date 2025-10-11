import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { TerminalHistory } from './terminalhistory';

export class LiveTerminal {
    private static activeProcesses: Map<string, ChildProcess> = new Map();
    private static processTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private static webviewView: vscode.WebviewView | null = null;
    private static readonly COMMAND_TIMEOUT = 30000; // 30 seconds
    private static readonly SHELL_COMMAND_REGEX = /^(run|execute|cmd|terminal|\$)\s+/;
    private static terminalStatus: 'idle' | 'running' | 'error' = 'idle';
    private static runningCommands: number = 0;
    private static activeSessions: Map<string, {
        name: string;
        created: Date;
        lastCommand: string;
        status: 'idle' | 'running' | 'completed' | 'error';
        workingDirectory: string;
    }> = new Map();
    private static sessionCounter: number = 1;
    
    private static getWorkingDirectory(): string {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    
    private static sanitizeCommand(command: string): string {
        // Remove dangerous characters and patterns
        const sanitized = command
            .replace(/[;&|`$(){}\[\]<>]/g, '') // Remove shell metacharacters
            .replace(/\..[\/\\]/g, '') // Remove path traversal
            .trim();
        
        if (sanitized.length === 0) {
            throw new Error('Invalid command after sanitization');
        }
        
        return sanitized;
    }
    
    private static isAllowedCommand(command: string): boolean {
        const allowedCommands = [
            'npm', 'git', 'node', 'python', 'pip', 'ls', 'dir', 'pwd', 'echo',
            'cat', 'touch', 'mkdir', 'rm', 'df', 'ps', 'grep', 'awk', 'sed',
            'curl', 'wget', 'ping'
        ];
        const firstWord = command.trim().split(' ')[0].toLowerCase();
        return allowedCommands.includes(firstWord);
    }

    static setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
        this.updateTerminalStatus();
    }

    static getTerminalStatus(): {
        status: 'idle' | 'running' | 'error',
        runningCommands: number,
        activeSessions: Array<{
            id: string;
            name: string;
            status: string;
            lastCommand: string;
            created: string;
        }>
    } {
        const sessions = Array.from(this.activeSessions.entries()).map(([id, session]) => ({
            id,
            name: session.name,
            status: session.status,
            lastCommand: session.lastCommand,
            created: session.created.toISOString()
        }));
        
        return {
            status: this.terminalStatus,
            runningCommands: this.runningCommands,
            activeSessions: sessions
        };
    }
    
    static createNewSession(name?: string): string {
        const sessionId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const sessionName = name || `Terminal ${this.sessionCounter++}`;
        
        this.activeSessions.set(sessionId, {
            name: sessionName,
            created: new Date(),
            lastCommand: '',
            status: 'idle',
            workingDirectory: this.getWorkingDirectory()
        });
        
        // Notify webview of new session
        this.sendToWebview({
            type: 'sessionCreated',
            sessionId,
            sessionName,
            workingDirectory: this.getWorkingDirectory()
        });
        
        return sessionId;
    }
    
    static closeSession(sessionId: string): boolean {
        // Kill any running process in this session first
        this.killCommand(sessionId);
        
        const session = this.activeSessions.get(sessionId);
        if (session) {
            this.activeSessions.delete(sessionId);
            
            // Notify webview
            this.sendToWebview({
                type: 'sessionClosed',
                sessionId
            });
            
            return true;
        }
        return false;
    }
    
    static getAllSessions(): Array<{id: string, name: string, status: string}> {
        return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
            id,
            name: session.name,
            status: session.status
        }));
    }

    private static updateTerminalStatus() {
        const wasRunning = this.terminalStatus === 'running';
        this.runningCommands = this.activeProcesses.size;
        
        if (this.runningCommands > 0) {
            this.terminalStatus = 'running';
        } else {
            this.terminalStatus = 'idle';
        }

        // Send status update to webview
        this.sendToWebview({
            type: 'statusUpdate',
            status: this.terminalStatus,
            runningCommands: this.runningCommands
        });
    }

    static async executeCommand(command: string, sessionId: string): Promise<void> {
        try {
            // Create session if it doesn't exist
            let session: {
                name: string;
                created: Date;
                lastCommand: string;
                status: 'idle' | 'running' | 'completed' | 'error';
                workingDirectory: string;
            };
            
            if (!this.activeSessions.has(sessionId)) {
                const sessionName = `Terminal ${this.sessionCounter++}`;
                session = {
                    name: sessionName,
                    created: new Date(),
                    lastCommand: command,
                    status: 'running',
                    workingDirectory: this.getWorkingDirectory()
                };
                this.activeSessions.set(sessionId, session);
            } else {
                // Update existing session
                session = this.activeSessions.get(sessionId)!;
                session.lastCommand = command;
                session.status = 'running';
            }
            
            // Add command to history
            TerminalHistory.addCommand(command, sessionId, session.name, session.workingDirectory);
            
            // Sanitize and validate command
            const sanitizedCommand = this.sanitizeCommand(command);
            
            if (!this.isAllowedCommand(sanitizedCommand)) {
                throw new Error('Command not allowed');
            }
            
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd' : 'bash';
            const shellFlag = isWindows ? '/c' : '-c';
            
            // Use session-specific working directory if available
            const workingSession = this.activeSessions.get(sessionId);
            const workingDir = workingSession?.workingDirectory || this.getWorkingDirectory();
            
            const child = spawn(shell, [shellFlag, sanitizedCommand], {
                cwd: workingDir,
                timeout: this.COMMAND_TIMEOUT
            });

            this.activeProcesses.set(sessionId, child);
            this.updateTerminalStatus();
            
            // Set timeout for the process
            const timeout = setTimeout(() => {
                if (this.activeProcesses.has(sessionId)) {
                    child.kill();
                    this.sendToWebview({
                        type: 'error',
                        sessionId,
                        error: 'Command timed out after 30 seconds'
                    });
                }
            }, this.COMMAND_TIMEOUT);
            
            this.processTimeouts.set(sessionId, timeout);

            // Send initial command display
            this.sendToWebview({
                type: 'commandStart',
                sessionId,
                command: sanitizedCommand,
                cwd: workingDir
            });

            child.stdout?.on('data', (data) => {
                this.sendToWebview({
                    type: 'output',
                    sessionId,
                    data: data.toString(),
                    stream: 'stdout'
                });
            });

            child.stderr?.on('data', (data) => {
                this.sendToWebview({
                    type: 'output',
                    sessionId,
                    data: data.toString(),
                    stream: 'stderr'
                });
            });

            child.on('close', (code) => {
                // Update session status
                const currentSession = this.activeSessions.get(sessionId);
                if (currentSession) {
                    currentSession.status = code === 0 ? 'completed' : 'error';
                }
                
                // Update command result in history
                TerminalHistory.updateCommandResult(sessionId, code || 0);
                
                this.sendToWebview({
                    type: 'commandEnd',
                    sessionId,
                    exitCode: code
                });
                this.cleanupProcess(sessionId);
            });

            child.on('error', (error) => {
                // Update session status
                const currentSession = this.activeSessions.get(sessionId);
                if (currentSession) {
                    currentSession.status = 'error';
                }
                
                // Update command result in history
                TerminalHistory.updateCommandResult(sessionId, -1, error.message);
                
                this.sendToWebview({
                    type: 'error',
                    sessionId,
                    error: error.message
                });
                this.cleanupProcess(sessionId);
            });
        } catch (error: any) {
            // Update session status
            const errorSession = this.activeSessions.get(sessionId);
            if (errorSession) {
                errorSession.status = 'error';
            }
            
            this.sendToWebview({
                type: 'error',
                sessionId,
                error: `Failed to start command: ${error.message}`
            });
        }
    }

    static killCommand(sessionId: string): boolean {
        const childProcess = this.activeProcesses.get(sessionId);
        if (childProcess) {
            const isWindows = process.platform === 'win32';
            if (isWindows) {
                childProcess.kill(); // Windows doesn't support POSIX signals
            } else {
                childProcess.kill('SIGTERM');
            }
            this.cleanupProcess(sessionId);
            return true;
        }
        return false;
    }
    
    private static cleanupProcess(sessionId: string) {
        this.activeProcesses.delete(sessionId);
        const timeout = this.processTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.processTimeouts.delete(sessionId);
        }
        this.updateTerminalStatus();
    }

    private static sendToWebview(message: any) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }

    static isShellCommand(text: string): boolean {
        // Direct shell command prefixes
        if (this.SHELL_COMMAND_REGEX.test(text)) {
            return true;
        }
        // Common shell commands without prefix
        const shellCommands = ['npm', 'git', 'node', 'python', 'pip', 'ls', 'dir', 'pwd', 'echo'];
        const firstWord = text.trim().split(' ')[0].toLowerCase();
        return shellCommands.includes(firstWord);
    }

    static parseCommand(text: string): string {
        return text.replace(this.SHELL_COMMAND_REGEX, '').trim();
    }
}
