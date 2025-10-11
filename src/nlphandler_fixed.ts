import * as vscode from 'vscode';
import { SmartAgentCoordinator } from './smartagentcoordinator';
import { fileExtensionRegistry, FileExtensionAgentRegistry } from './fileextensionagentregistry';
import { EditTracker } from './edittracker';
import { IntentRecognitionSystem, ProjectIntent, AgentTask } from './intentrecognition';
// Enhanced NLP Intent Recognition
interface NLPContext {
    recognizedIntent: any;
    confidence: number;
    suggestions: string[];
    progress: {
        stage: 'analyzing' | 'planning' | 'executing' | 'complete';
        message: string;
        percentage: number;
    };
}

export class NLPHandler {
    private agentCoordinator: SmartAgentCoordinator;
    private webviewView?: vscode.WebviewView;
    private activeContext?: NLPContext;
    private extensionRegistry: FileExtensionAgentRegistry;
    private intentRecognition: IntentRecognitionSystem;

    constructor() {
        this.agentCoordinator = new SmartAgentCoordinator();
        this.extensionRegistry = FileExtensionAgentRegistry.getInstance();
        this.intentRecognition = IntentRecognitionSystem.getInstance();
    }

    setWebviewView(webviewView: vscode.WebviewView) {
        this.webviewView = webviewView;
    }

    async processNaturalLanguageInput(input: string): Promise<string> {
        try {
            // Analyze project context first
            await this.extensionRegistry.analyzeWorkspace();
            
            // Initialize progress tracking
            this.activeContext = {
                recognizedIntent: await this.intentRecognition.parseUserIntent(input) as any,
                confidence: 0.85,
                suggestions: [],
                progress: {
                    stage: 'analyzing',
                    message: 'Analyzing your request with smart agents...',
                    percentage: 10
                }
            };

            this.sendProgressUpdate();

            // Generate execution plan with extension-specific agents
            this.activeContext!.progress = {
                stage: 'planning',
                message: 'Creating optimal execution plan with file extension agents...',
                percentage: 30
            };
            this.sendProgressUpdate();

            const executionPlan = await this.createExecutionPlan(this.activeContext!.recognizedIntent);

            // Execute with smart coordination and extension agents
            this.activeContext!.progress = {
                stage: 'executing',
                message: 'Generating files with specialized extension agents...',
                percentage: 50
            };
            this.sendProgressUpdate();

            const result = await this.executeWithExtensionAgents(executionPlan);

            // Complete
            this.activeContext!.progress = {
                stage: 'complete',
                message: 'Project generation complete with smart agents!',
                percentage: 100
            };
            this.sendProgressUpdate();

            return result;

        } catch (error) {
            return `❌ Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }




    private async createExecutionPlan(intent: ProjectIntent): Promise<{ intent: ProjectIntent; tasks: AgentTask[]; parallelGroups: any[]; estimatedDuration: number }> {
        // normalize intent files to ensure required fields exist
        intent.files = intent.files.map((f) => ({
            ...f,
            dependencies: (f as any).dependencies || [],
            description: (f as any).description || (f as any).fileName || ''
        }));

        const agentTasks = await this.intentRecognition.generateAgentTasks(intent);

        const executionPlan = {
            intent,
            tasks: agentTasks,
            parallelGroups: this.createParallelGroups(agentTasks),
            estimatedDuration: this.estimateExecutionTime(intent.files),
        };

        return executionPlan;
    }

    private createParallelGroups(tasks: any[]): any[] {
        const groups: any[] = [];
        const priorityGroups = new Map<number, any[]>();

        tasks.forEach(task => {
            if (!priorityGroups.has(task.priority)) {
                priorityGroups.set(task.priority, []);
            }
            priorityGroups.get(task.priority)!.push(task);
        });

        Array.from(priorityGroups.entries())
            .sort(([a], [b]) => a - b)
            .forEach(([_, group]) => {
                groups.push(group);
            });

        return groups;
    }

    private async executeWithExtensionAgents(executionPlan: any): Promise<string> {
        let result = `🎯 **Intelligent Project Generation with Extension Agents**\n\n`;
        result += `📋 **Project Overview:**\n`;
        result += `- Type: ${executionPlan.intent.type}\n`;
        result += `- Domain: ${executionPlan.intent.domain}\n`;
        result += `- Complexity: ${executionPlan.intent.complexity}\n`;
        result += `- Files: ${executionPlan.intent.files.length}\n\n`;

        for (const task of executionPlan.tasks) {
            const coordinatorPrompt = this.createCoordinatorPrompt(task, executionPlan.intent);
            await this.agentCoordinator.processMultiAgentRequest(coordinatorPrompt);
        }

        result += `\n🎉 **Generation Complete with Extension Agents!**\n`;
        return result;
    }

    private createCoordinatorPrompt(task: any, intent: any): string {
        const fileList = task.files.join(', ');
        return `smart coordinated creation of ${fileList} for ${intent.domain} ${intent.type} project using ${task.agentType} specialization with conflict prevention`;
    }

    private estimateExecutionTime(files: ProjectIntent['files']): number {
        const baseTimes = {
            'component': 3000,
            'page': 4000,
            'api': 5000,
            'config': 1000,
            'style': 2000,
            'test': 3000,
            'util': 2000
        };

        return files.reduce((total: number, file) => {
            const fileType = (file as any).type as string;
            return total + (baseTimes[fileType as keyof typeof baseTimes] || 2000);
        }, 0);
    }

    private sendProgressUpdate() {
        if (this.webviewView && this.activeContext) {
            this.webviewView.webview.postMessage({
                type: 'nlpProgress',
                data: {
                    stage: this.activeContext.progress.stage,
                    message: this.activeContext.progress.message,
                    percentage: this.activeContext.progress.percentage,
                    intent: this.activeContext.recognizedIntent
                }
            });
        }
    }




    // Static method to check if input should be processed by NLP handler
    static shouldProcessWithNLP(input: string): boolean {
        const nlpIndicators = [
            // Project creation patterns
            'create', 'build', 'make', 'generate', 'develop',
            // Project types
            'website', 'app', 'application', 'project', 'portfolio', 'blog', 'ecommerce',
            // Common tech mentions
            'react', 'vue', 'angular', 'next.js', 'express', 'django', 'fastapi',
            'mongodb', 'postgresql', 'mysql', 'node.js', 'python',
            // Feature requests
            'with', 'using', 'include', 'add', 'implement',
            // Common phrases
            'i want', 'i need', 'can you', 'help me'
        ];

        const inputLower = input.toLowerCase();
        
        // Must contain at least one project creation indicator and one project type/tech
        const hasCreationWord = nlpIndicators.slice(0, 5).some(word => inputLower.includes(word));
        const hasTechOrType = nlpIndicators.slice(5).some(word => inputLower.includes(word));
        
        return hasCreationWord && hasTechOrType;
    }

    // Enhanced method to detect specific request types
    static getRequestType(input: string): 'project' | 'feature' | 'file' | 'component' | 'general' {
        const inputLower = input.toLowerCase();
        
        if (inputLower.includes('project') || inputLower.includes('application') || inputLower.includes('website')) {
            return 'project';
        }
        if (inputLower.includes('component') || inputLower.includes('module')) {
            return 'component';
        }
        if (inputLower.includes('file') || inputLower.includes('class') || inputLower.includes('function')) {
            return 'file';
        }
        if (inputLower.includes('feature') || inputLower.includes('functionality')) {
            return 'feature';
        }
        
        return 'general';
    }

    // Method to provide smart suggestions
    static getSmartSuggestions(input: string): string[] {
        const inputLower = input.toLowerCase();
        const suggestions: string[] = [];

        if (inputLower.includes('portfolio')) {
            suggestions.push(
                'portfolio website with responsive design',
                'portfolio with React and animations',
                'developer portfolio with project showcase'
            );
        }

        if (inputLower.includes('ecommerce') || inputLower.includes('shop')) {
            suggestions.push(
                'ecommerce website with React and Node.js',
                'online store with payment integration',
                'shopping app with cart and checkout'
            );
        }

        if (inputLower.includes('blog')) {
            suggestions.push(
                'blog website with CMS features',
                'blog with Next.js and markdown support',
                'multi-author blog platform'
            );
        }

        return suggestions;
    }
}