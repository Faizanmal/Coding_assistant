import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class InlineShell {
    static async executeCommand(command: string, onUpdate?: (output: string) => void): Promise<string> {
        const parsedCommand = this.parseNLPCommand(command);
        
        return new Promise((resolve) => {
            const isWindows = process.platform === 'win32';
            const shell = isWindows ? 'cmd' : 'bash';
            const shellFlag = isWindows ? '/c' : '-c';
            
            const child = spawn(shell, [shellFlag, parsedCommand], {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });

            let output = '';
            let hasOutput = false;
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'C:\\';
            const prompt = `${cwd}> `;
            
            // Show terminal prompt and command
            let terminalOutput = `\`\`\`\n${prompt}${parsedCommand}\n`;
            if (onUpdate) {onUpdate(terminalOutput + '\n\`\`\`');}

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                hasOutput = true;
                
                // Stream output in real-time like terminal
                if (onUpdate) {
                    onUpdate(terminalOutput + output + '\n\`\`\`');
                }
            });

            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                hasOutput = true;
                
                // Stream error output in real-time
                if (onUpdate) {
                    onUpdate(terminalOutput + output + '\n\`\`\`');
                }
            });

            child.on('close', (code) => {
                const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'C:\\';
                const prompt = `${cwd}> `;
                let result = `\`\`\`\n${prompt}${parsedCommand}\n${output || ''}\n${prompt}echo $? # Exit code: ${code ?? 'unknown'}\n${code ?? 'unknown'}\n${prompt}\n\`\`\``;
                
                // Add helpful suggestions for common errors
                if (code !== null && code !== 0) {
                    result += InlineShell.getErrorSuggestion(parsedCommand, output, code);
                }
                
                resolve(result);
            });

            child.on('error', (error) => {
                const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'C:\\';
                const prompt = `${cwd}> `;
                resolve(`\`\`\`\n${prompt}${parsedCommand}\nError: ${error.message}\n${prompt}\n\`\`\``);
            });

            setTimeout(() => {
                if (!hasOutput) {
                    child.kill();
                    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'C:\\';
                    const prompt = `${cwd}> `;
                    resolve(`\`\`\`\n${prompt}${parsedCommand}\nCommand timed out after 30 seconds\n${prompt}\n\`\`\``);
                }
            }, 30000);
        });
    }

    static parseNLPCommand(prompt: string): string {
        const clean = prompt.replace(/^(run|execute|cmd|terminal)\s+/i, '').trim();
        const projectType = this.detectProjectType();
        
        // NLP to command mapping with codebase awareness
        const nlpMappings = {
            // Install commands
            'install dependencies': projectType === 'node' ? 'npm install' : projectType === 'python' ? 'pip install -r requirements.txt' : 'npm install',
            'install packages': projectType === 'node' ? 'npm install' : 'pip install -r requirements.txt',
            'setup project': projectType === 'node' ? 'npm install' : 'pip install -r requirements.txt',
            
            // Start commands
            'start server': projectType === 'node' ? 'npm start' : 'python main.py',
            'run server': projectType === 'node' ? 'npm start' : 'python app.py',
            'start app': projectType === 'node' ? 'npm start' : 'python main.py',
            
            // Test commands
            'run tests': projectType === 'node' ? 'npm test' : 'python -m pytest',
            'test': projectType === 'node' ? 'npm test' : 'pytest',
            
            // Build commands
            'build project': projectType === 'node' ? 'npm run build' : 'python setup.py build',
            'compile': projectType === 'node' ? 'npm run build' : 'tsc',
            
            // Git commands
            'check status': 'git status',
            'git status': 'git status',
            'show changes': 'git diff',
            'commit changes': 'git add . && git commit -m "Auto commit"',
            
            // File operations
            'list files': process.platform === 'win32' ? 'dir' : 'ls -la',
            'show directory': process.platform === 'win32' ? 'dir' : 'ls -la',
            'current directory': 'pwd',
            'where am i': 'pwd'
        };
        
        // Check for exact matches first
        for (const [nlp, cmd] of Object.entries(nlpMappings)) {
            if (clean.toLowerCase().includes(nlp)) {
                return cmd;
            }
        }
        
        return clean;
    }
    
    static detectProjectType(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return 'unknown';}
        
        const rootPath = workspaceFolder.uri.fsPath;
        
        if (fs.existsSync(path.join(rootPath, 'package.json'))) {return 'node';}
        if (fs.existsSync(path.join(rootPath, 'requirements.txt')) || fs.existsSync(path.join(rootPath, 'pyproject.toml'))) {return 'python';}
        if (fs.existsSync(path.join(rootPath, 'Cargo.toml'))) {return 'rust';}
        if (fs.existsSync(path.join(rootPath, 'go.mod'))) {return 'go';}
        
        return 'unknown';
    }

    static getErrorSuggestion(command: string, output: string, exitCode: number): string {
        let suggestion = '\n\n💡 **Suggestions:**\n';
        
        if (command.includes('npm install') && output.includes('must provide string spec')) {
            suggestion += '• No package.json found. Try: `npm init -y` first\n';
            suggestion += '• Or specify a package: `npm install express`\n';
        } else if (command.includes('npm') && output.includes('ENOENT')) {
            suggestion += '• npm not found. Install Node.js first\n';
        } else if (command.includes('python') && output.includes('not found')) {
            suggestion += '• Python not installed or not in PATH\n';
        } else if (command.includes('git') && output.includes('not a git repository')) {
            suggestion += '• Initialize git first: `git init`\n';
        } else if (exitCode === 127) {
            suggestion += '• Command not found. Check if it\'s installed\n';
        } else if (exitCode === 1 && command.includes('npm')) {
            suggestion += '• Check if you\'re in the right directory\n';
            suggestion += '• Try: `npm init` to create package.json\n';
        }
        
        return suggestion;
    }

    static isShellCommand(prompt: string): boolean {
        const directCommands = /^(run|execute|cmd|terminal)\s+/i.test(prompt);
        const nlpCommands = /(install|start|build|test|compile|setup|check status|list files|show directory|current directory|where am i|git|npm|pip|python|node)/i.test(prompt);
        
        return directCommands || nlpCommands;
    }
}