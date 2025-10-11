import * as vscode from 'vscode';
import { generateCode } from './codegenerator';


export class SmartMultiAgent {
    private static agents = {
        'frontend': 'Frontend Developer - React, Vue, Angular, HTML, CSS, JavaScript',
        'backend': 'Backend Developer - Node.js, Python, APIs, databases, server logic',
        'testing': 'QA Engineer - Unit tests, integration tests, test automation',
        'security': 'Security Expert - Authentication, authorization, data protection',
        'database': 'Database Architect - Schema design, queries, optimization',
        'devops': 'DevOps Engineer - CI/CD, deployment, infrastructure, Docker',
        'mobile': 'Mobile Developer - React Native, Flutter, iOS, Android',
        'api': 'API Developer - REST, GraphQL, endpoints, documentation'
    };

    static async processMultiAgentCommand(command: string, projectContext: string): Promise<string> {
        const selectedAgents = this.selectAgents(command);
        const tasks = this.breakDownTasks(command, selectedAgents);
        
        const results: string[] = [];
        
        for (const task of tasks) {
            const agentPrompt = this.buildAgentPrompt(task, projectContext);
            const result = await generateCode(agentPrompt, 'llama-3.3-70b-versatile');
            results.push(`**${task.agent} Agent:**\n${result}`);
        }
        
        return `🤖 **Multi-Agent Results:**\n\n${results.join('\n\n---\n\n')}`;
    }

    private static selectAgents(command: string): string[] {
        const cmd = command.toLowerCase();
        const selected: string[] = [];
        
        if (cmd.includes('frontend') || cmd.includes('ui') || cmd.includes('component') || cmd.includes('react') || cmd.includes('vue')) {
            selected.push('frontend');
        }
        if (cmd.includes('backend') || cmd.includes('api') || cmd.includes('server') || cmd.includes('database')) {
            selected.push('backend');
        }
        if (cmd.includes('test') || cmd.includes('testing') || cmd.includes('spec')) {
            selected.push('testing');
        }
        if (cmd.includes('security') || cmd.includes('auth') || cmd.includes('login') || cmd.includes('permission')) {
            selected.push('security');
        }
        if (cmd.includes('database') || cmd.includes('db') || cmd.includes('schema') || cmd.includes('query')) {
            selected.push('database');
        }
        if (cmd.includes('deploy') || cmd.includes('docker') || cmd.includes('ci/cd') || cmd.includes('devops')) {
            selected.push('devops');
        }
        if (cmd.includes('mobile') || cmd.includes('app') || cmd.includes('native')) {
            selected.push('mobile');
        }
        if (cmd.includes('api') || cmd.includes('endpoint') || cmd.includes('rest') || cmd.includes('graphql')) {
            selected.push('api');
        }
        
        // Default agents if none selected
        if (selected.length === 0) {
            if (cmd.includes('full') || cmd.includes('complete') || cmd.includes('system')) {
                selected.push('frontend', 'backend', 'testing');
            } else {
                selected.push('backend'); // Default
            }
        }
        
        return selected;
    }

    private static breakDownTasks(command: string, agents: string[]): Array<{agent: string, task: string}> {
        const tasks: Array<{agent: string, task: string}> = [];
        
        agents.forEach(agent => {
            let task = '';
            
            switch (agent) {
                case 'frontend':
                    task = `Create frontend components and UI elements for: ${command}`;
                    break;
                case 'backend':
                    task = `Develop backend logic, APIs, and server-side functionality for: ${command}`;
                    break;
                case 'testing':
                    task = `Create comprehensive tests and test suites for: ${command}`;
                    break;
                case 'security':
                    task = `Implement security measures and authentication for: ${command}`;
                    break;
                case 'database':
                    task = `Design database schema and queries for: ${command}`;
                    break;
                case 'devops':
                    task = `Create deployment and infrastructure setup for: ${command}`;
                    break;
                case 'mobile':
                    task = `Develop mobile app components for: ${command}`;
                    break;
                case 'api':
                    task = `Design and implement API endpoints for: ${command}`;
                    break;
            }
            
            tasks.push({ agent, task });
        });
        
        return tasks;
    }

    private static buildAgentPrompt(task: {agent: string, task: string}, projectContext: string): string {
        const agentRole = this.agents[task.agent as keyof typeof this.agents];
        
        return `You are a ${agentRole}.

Project Context:
${projectContext}

Task: ${task.task}

Instructions:
1. Analyze the current project structure and requirements
2. Generate appropriate code/configuration for your specialization
3. Ensure compatibility with existing project files
4. Follow best practices for your domain
5. Include necessary imports, dependencies, and setup

Provide only the code/configuration needed, with brief comments explaining key decisions.`;
    }
}