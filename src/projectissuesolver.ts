import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { ChatFileManager } from './chatfilemanager';
import { SmartMultiAgent } from './smartmultiagent';

export class ProjectIssueSolver {
    private static workspaceRoot: string = '';
    private static projectFiles: Map<string, string> = new Map();

    static initialize() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            this.workspaceRoot = workspace.uri.fsPath;
            this.scanProject();
        }
    }

    static async solveProjectIssue(issue: string): Promise<string> {
        try {
            // Analyze the issue
            const analysis = await this.analyzeIssue(issue);
            
            // Get project context
            const projectContext = this.getProjectContext();
            
            // Generate solution
            const solution = await this.generateSolution(issue, analysis, projectContext);
            
            // Apply solution if requested
            if (this.shouldAutoApply(issue)) {
                return await this.applySolution(solution, issue);
            }
            
            return solution;
        } catch (error: any) {
            return `❌ Error solving issue: ${error.message}`;
        }
    }

    static isIssueRequest(command: string): boolean {
        const issueKeywords = [
            'solve', 'fix', 'issue', 'problem', 'error', 'bug', 'broken',
            'not working', 'help with', 'troubleshoot', 'debug', 'resolve'
        ];
        
        const lowerCommand = command.toLowerCase();
        return issueKeywords.some(keyword => lowerCommand.includes(keyword));
    }

    private static async analyzeIssue(issue: string): Promise<string> {
        const diagnostics = this.getCurrentDiagnostics();
        const recentErrors = this.getRecentErrors();
        
        const analysisPrompt = `Analyze this project issue: "${issue}"

Project diagnostics: ${diagnostics}
Recent errors: ${recentErrors}
Project type: ${this.detectProjectType()}

Provide:
1. Issue category (build, runtime, dependency, configuration, etc.)
2. Likely causes
3. Required actions
4. Files that may need changes

Keep analysis concise and actionable.`;

        return await generateCode(analysisPrompt, 'llama-3.3-70b-versatile');
    }

    private static async generateSolution(issue: string, analysis: string, projectContext: string): Promise<string> {
        const solutionPrompt = `Generate a complete solution for this project issue:

Issue: ${issue}
Analysis: ${analysis}
Project Context: ${projectContext}

Provide:
1. Step-by-step solution
2. Code changes needed (with file names)
3. Commands to run
4. Configuration updates
5. Dependencies to install/update

Format as actionable steps with code examples.`;

        const solution = await generateCode(solutionPrompt, 'llama-3.3-70b-versatile');
        
        return `🔧 **Project Issue Solution:**\n\n${solution}\n\n💡 **Quick Actions:**\n• Type "apply solution" to auto-implement\n• Type "create fix files" to generate needed files\n• Type "run fix commands" to execute required commands`;
    }

    private static async applySolution(solution: string, originalIssue: string): Promise<string> {
        const results: string[] = [];
        
        // Extract and create files
        const fileChanges = this.extractFileChanges(solution);
        for (const change of fileChanges) {
            try {
                const result = await ChatFileManager.processFileCommand(
                    `create ${change.fileName} with ${change.content}`
                );
                if (result) {results.push(result);}
            } catch (error: any) {
                results.push(`❌ Failed to create ${change.fileName}: ${error.message}`);
            }
        }
        
        // Extract and run commands
        const commands = this.extractCommands(solution);
        for (const command of commands) {
            try {
                // Use terminal execution for commands
                results.push(`🔄 Running: ${command}`);
            } catch (error: any) {
                results.push(`❌ Command failed: ${command}`);
            }
        }
        
        return `✅ **Solution Applied:**\n\n${results.join('\n\n')}\n\n🎯 **Issue Status:** Attempted automatic fix for "${originalIssue}"`;
    }

    private static shouldAutoApply(issue: string): boolean {
        const autoApplyKeywords = ['apply', 'implement', 'fix now', 'auto fix'];
        const lowerIssue = issue.toLowerCase();
        return autoApplyKeywords.some(keyword => lowerIssue.includes(keyword));
    }

    private static getCurrentDiagnostics(): string {
        const diagnostics: string[] = [];
        
        for (const [fileName, filePath] of this.projectFiles) {
            try {
                const uri = vscode.Uri.file(filePath);
                const fileDiagnostics = vscode.languages.getDiagnostics(uri);
                
                if (fileDiagnostics.length > 0) {
                    const errors = fileDiagnostics
                        .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                        .slice(0, 3)
                        .map(d => `${fileName}:${d.range.start.line + 1} - ${d.message}`)
                        .join('\n');
                    
                    if (errors) {diagnostics.push(errors);}
                }
            } catch (error) {
                // Skip files we can't read
            }
        }
        
        return diagnostics.slice(0, 5).join('\n') || 'No current diagnostics';
    }

    private static getRecentErrors(): string {
        // Get recent terminal/console errors if available
        return 'No recent errors captured';
    }

    private static getProjectContext(): string {
        const packageJson = this.getFileContent('package.json');
        const tsConfig = this.getFileContent('tsconfig.json');
        const readme = this.getFileContent('README.md');
        
        return `Package.json: ${packageJson ? 'Present' : 'Missing'}
TypeScript: ${tsConfig ? 'Present' : 'Missing'}
README: ${readme ? 'Present' : 'Missing'}
Project Type: ${this.detectProjectType()}
Total Files: ${this.projectFiles.size}`;
    }

    private static extractFileChanges(solution: string): Array<{fileName: string, content: string}> {
        const changes: Array<{fileName: string, content: string}> = [];
        
        // Extract file creation patterns
        const filePatterns = [
            /create\s+([^\s]+)\s+with\s+(.+?)(?=\n|$)/gi,
            /file:\s*([^\s]+)\s*\n([\s\S]*?)(?=\n\n|\nfile:|$)/gi
        ];
        
        for (const pattern of filePatterns) {
            let match;
            while ((match = pattern.exec(solution)) !== null) {
                changes.push({
                    fileName: match[1],
                    content: match[2].trim()
                });
            }
        }
        
        return changes;
    }

    private static extractCommands(solution: string): string[] {
        const commands: string[] = [];
        
        // Extract command patterns
        const commandPatterns = [
            /npm\s+[^\n]+/gi,
            /yarn\s+[^\n]+/gi,
            /npx\s+[^\n]+/gi,
            /run\s+([^\n]+)/gi
        ];
        
        for (const pattern of commandPatterns) {
            let match;
            while ((match = pattern.exec(solution)) !== null) {
                commands.push(match[0]);
            }
        }
        
        return commands;
    }

    private static scanProject() {
        this.projectFiles.clear();
        if (!this.workspaceRoot) {return;}
        
        const scanDir = (dir: string) => {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                        scanDir(fullPath);
                    } else if (stat.isFile()) {
                        this.projectFiles.set(item, fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };
        
        scanDir(this.workspaceRoot);
    }

    private static getFileContent(fileName: string): string | null {
        const filePath = this.projectFiles.get(fileName);
        if (!filePath) {return null;}
        
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            return null;
        }
    }

    private static detectProjectType(): string {
        if (this.projectFiles.has('package.json')) {return 'Node.js/JavaScript';}
        if (this.projectFiles.has('requirements.txt')) {return 'Python';}
        if (this.projectFiles.has('Cargo.toml')) {return 'Rust';}
        if (this.projectFiles.has('go.mod')) {return 'Go';}
        return 'Generic';
    }
}