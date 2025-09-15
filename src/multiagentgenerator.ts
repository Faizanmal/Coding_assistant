import * as vscode from 'vscode';
import { callAI } from './cli-api';
import { generateCodeTogether, generateCodeOpenRouter, generateCodeMistral, generateCodeCerebras } from './codegenerator';

interface Agent {
    name: string;
    specialization: string[];
    provider: string;
    model: string;
}

interface FileTask {
    fileName: string;
    prompt: string;
    language: string;
    agent?: Agent;
}

export class MultiAgentGenerator {
    private static agents: Agent[] = [
        {
            name: 'Frontend Specialist',
            specialization: ['javascript', 'typescript', 'html', 'css', 'react', 'vue', 'angular'],
            provider: 'groq',
            model: 'llama3-70b-8192'
        },
        {
            name: 'Backend Specialist', 
            specialization: ['python', 'java', 'go', 'rust', 'php', 'node', 'express'],
            provider: 'together',
            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
        },
        {
            name: 'Database Specialist',
            specialization: ['sql', 'mongodb', 'database', 'schema', 'migration'],
            provider: 'cerebras',
            model: 'llama3.1-8b'
        },
        {
            name: 'DevOps Specialist',
            specialization: ['docker', 'kubernetes', 'yaml', 'json', 'config', 'deployment'],
            provider: 'mistral',
            model: 'mistral-small-latest'
        },
        {
            name: 'Code Review Agent',
            specialization: ['review', 'quality', 'security', 'performance', 'best-practices'],
            provider: 'openrouter',
            model: 'openrouter/mistral-7b'
        },
        {
            name: 'Debug Agent',
            specialization: ['debug', 'error', 'fix', 'troubleshoot', 'test'],
            provider: 'cerebras',
            model: 'llama-4-maverick-17b-128e'
        }
    ];

    static assignAgents(tasks: FileTask[]): FileTask[] {
        return tasks.map(task => {
            const agent = this.findBestAgent(task);
            return { ...task, agent };
        });
    }

    private static findBestAgent(task: FileTask): Agent {
        const content = `${task.fileName} ${task.prompt} ${task.language}`.toLowerCase();
        
        for (const agent of this.agents) {
            if (agent.specialization.some(spec => content.includes(spec))) {
                return agent;
            }
        }
        
        return this.agents[0]; // Default to frontend specialist
    }

    static async generateWithAgents(tasks: FileTask[]): Promise<void> {
        const assignedTasks = this.assignAgents(tasks);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Multi-Agent File Generation",
            cancellable: false
        }, async (progress) => {
            const total = assignedTasks.length + 4; // +4 for review, debug, fix, re-validate phases
            
            // Phase 1: Generate files
            const results = await Promise.allSettled(
                assignedTasks.map(async (task, index) => {
                    progress.report({ 
                        increment: (70 / assignedTasks.length),
                        message: `${task.agent?.name} generating ${task.fileName}` 
                    });
                    
                    return this.generateFile(task);
                })
            );

            const successful = results.filter(r => r.status === 'fulfilled').length;
            
            if (successful > 0) {
                // Phase 2: Code Review
                progress.report({ 
                    increment: 15,
                    message: "Code Review Agent analyzing files..." 
                });
                
                const reviewResults = await this.reviewGeneratedFiles(assignedTasks);
                
                // Phase 3: Debug Analysis
                progress.report({ 
                    increment: 15,
                    message: "Debug Agent checking for errors..." 
                });
                
                const debugResults = await this.debugGeneratedFiles(assignedTasks);
                
                // Phase 4: Auto-fix if issues found
                let finalReviewResults = reviewResults;
                let finalDebugResults = debugResults;
                let iteration = 1;
                
                while ((finalReviewResults.length > 0 || finalDebugResults.length > 0) && iteration <= 2) {
                    iteration++;
                    
                    progress.report({ 
                        message: `Auto-fixing issues (iteration ${iteration})...` 
                    });
                    
                    await this.fixAndRevalidate(assignedTasks, finalReviewResults, finalDebugResults);
                    
                    // Re-validate
                    finalReviewResults = await this.reviewGeneratedFiles(assignedTasks);
                    finalDebugResults = await this.debugGeneratedFiles(assignedTasks);
                }
                
                // Show final results
                this.showFinalResults(successful, results.length - successful, finalReviewResults, finalDebugResults, iteration);
            }
        });
    }

    private static async generateFile(task: FileTask): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {throw new Error('No workspace');}

        const filePath = vscode.Uri.joinPath(workspaceFolder.uri, task.fileName);
        
        let enhancedPrompt: string;
        
        if (task.agent?.name === 'Code Review Agent') {
            enhancedPrompt = `As a Code Review Agent, analyze and improve this code:
${task.prompt}

Provide clean, secure, and optimized ${task.language} code with:
- Security best practices
- Performance optimizations
- Code quality improvements
- Proper error handling`;
        } else if (task.agent?.name === 'Debug Agent') {
            enhancedPrompt = `As a Debug Agent, create robust ${task.language} code for ${task.fileName}:
${task.prompt}

Include:
- Comprehensive error handling
- Debug logging
- Input validation
- Edge case handling
- Testing utilities`;
        } else {
            enhancedPrompt = `As a ${task.agent?.name}, generate ${task.language} code for ${task.fileName}:
${task.prompt}

Focus on best practices for ${task.language} development.`;
        }

        let code: string;
        
        switch (task.agent?.provider) {
            case 'together':
                code = await generateCodeTogether(enhancedPrompt, task.agent.model);
                break;
            case 'cerebras':
                code = await generateCodeCerebras(enhancedPrompt, task.agent.model);
                break;
            case 'mistral':
                code = await generateCodeMistral(enhancedPrompt, task.agent.model);
                break;
            case 'openrouter':
                code = await generateCodeOpenRouter(enhancedPrompt, task.agent.model);
                break;
            default:
                code = await callAI(enhancedPrompt);
        }

        await vscode.workspace.fs.writeFile(filePath, Buffer.from(code, 'utf8'));
    }

    private static async reviewGeneratedFiles(tasks: FileTask[]): Promise<string[]> {
        const issues: string[] = [];
        
        for (const task of tasks) {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {continue;}
                
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, task.fileName);
                const content = await vscode.workspace.fs.readFile(filePath);
                const code = content.toString();
                
                const reviewPrompt = `Review this ${task.language} code for security, performance, and quality issues:

${code}

Return only critical issues found, or "No issues" if clean.`;
                
                const review = await generateCodeOpenRouter(reviewPrompt, 'openrouter/mistral-7b');
                
                if (!review.toLowerCase().includes('no issues')) {
                    issues.push(`${task.fileName}: ${review}`);
                }
            } catch (error) {
                issues.push(`${task.fileName}: Review failed`);
            }
        }
        
        return issues;
    }

    private static async debugGeneratedFiles(tasks: FileTask[]): Promise<string[]> {
        const errors: string[] = [];
        
        for (const task of tasks) {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {continue;}
                
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, task.fileName);
                const content = await vscode.workspace.fs.readFile(filePath);
                const code = content.toString();
                
                const debugPrompt = `Analyze this ${task.language} code for potential runtime errors, bugs, and missing error handling:

${code}

Return only actual errors/bugs found, or "No errors" if clean.`;
                
                const debug = await generateCodeCerebras(debugPrompt, 'llama-4-maverick-17b-128e');
                
                if (!debug.toLowerCase().includes('no errors')) {
                    errors.push(`${task.fileName}: ${debug}`);
                }
            } catch (error) {
                errors.push(`${task.fileName}: Debug analysis failed`);
            }
        }
        
        return errors;
    }

    private static async fixAndRevalidate(tasks: FileTask[], reviewIssues: string[], debugErrors: string[]): Promise<void> {
        const allIssues = [...reviewIssues, ...debugErrors];
        const filesToFix = new Set(allIssues.map(issue => issue.split(':')[0]));
        
        for (const fileName of filesToFix) {
            const task = tasks.find(t => t.fileName === fileName);
            if (!task) {continue;}
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {continue;}
            
            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
            const content = await vscode.workspace.fs.readFile(filePath);
            const code = content.toString();
            
            const issues = allIssues.filter(issue => issue.startsWith(fileName)).map(issue => issue.split(': ')[1]).join('\n');
            
            const fixPrompt = `Fix these issues in the ${task.language} code:

ISSUES:
${issues}

CURRENT CODE:
${code}

Return only the corrected code, no explanations.`;
            
            let fixedCode: string;
            switch (task.agent?.provider) {
                case 'together':
                    fixedCode = await generateCodeTogether(fixPrompt, task.agent.model);
                    break;
                case 'cerebras':
                    fixedCode = await generateCodeCerebras(fixPrompt, task.agent.model);
                    break;
                case 'mistral':
                    fixedCode = await generateCodeMistral(fixPrompt, task.agent.model);
                    break;
                case 'openrouter':
                    fixedCode = await generateCodeOpenRouter(fixPrompt, task.agent.model);
                    break;
                default:
                    fixedCode = await callAI(fixPrompt);
            }
            
            await vscode.workspace.fs.writeFile(filePath, Buffer.from(fixedCode, 'utf8'));
        }
    }

    private static showFinalResults(successful: number, failed: number, reviewIssues: string[], debugErrors: string[], iteration: number = 1): void {
        let message = `✅ Generated ${successful} files`;
        
        if (failed > 0) {
            message += `, ${failed} failed`;
        }
        
        if (iteration > 1) {
            message += ` (Fixed in ${iteration} iterations)`;
        }
        
        if (reviewIssues.length > 0 || debugErrors.length > 0) {
            message += `\n\n⚠️ Remaining Issues:`;
            
            if (reviewIssues.length > 0) {
                message += `\n\n🔍 Code Review Issues:\n${reviewIssues.join('\n')}`;
            }
            
            if (debugErrors.length > 0) {
                message += `\n\n🐛 Debug Errors:\n${debugErrors.join('\n')}`;
            }
            
            vscode.window.showWarningMessage(message);
        } else {
            message += '\n\n✅ All issues resolved by multi-agent system';
            vscode.window.showInformationMessage(message);
        }
    }
}