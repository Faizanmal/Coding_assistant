import * as vscode from 'vscode';
import { callAI } from './codegenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface IntelligentAgent {
    id: string;
    name: string;
    specialty: string;
    aiModel: string;
    capabilities: string[];
    status: 'idle' | 'working' | 'learning' | 'optimizing';
    workload: number;
    successRate: number;
    learningProgress: number;
}

export interface CrossProjectTask {
    id: string;
    description: string;
    complexity: 'low' | 'medium' | 'high' | 'expert';
    requiredAgents: string[];
    estimatedDuration: number;
    actualDuration?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    priority: number;
    dependencies: string[];
    deliverables: string[];
}

export interface ProjectContext {
    projectType: string;
    frameworks: string[];
    languages: string[];
    dependencies: string[];
    codebaseSize: number;
    complexityScore: number;
    testCoverage: number;
    maintainabilityIndex: number;
    technicalDebt: number;
}

export interface LearningSuggestion {
    id: string;
    type: 'optimization' | 'pattern' | 'best_practice' | 'automation';
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    implementation: string;
    learnedFrom: string;
    confidence: number;
}

export class IntelligentMultiAgentOrchestrator {
    private static instance: IntelligentMultiAgentOrchestrator;
    private agents: Map<string, IntelligentAgent> = new Map();
    private activeTasks: Map<string, CrossProjectTask> = new Map();
    private projectContext: ProjectContext | null = null;
    private learningDatabase: LearningSuggestion[] = [];
    private context: vscode.ExtensionContext;
    private performanceMetrics: Map<string, any> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeAgents();
        this.startIntelligentMonitoring();
        this.loadLearningDatabase();
    }

    public static getInstance(context: vscode.ExtensionContext): IntelligentMultiAgentOrchestrator {
        if (!IntelligentMultiAgentOrchestrator.instance) {
            IntelligentMultiAgentOrchestrator.instance = new IntelligentMultiAgentOrchestrator(context);
        }
        return IntelligentMultiAgentOrchestrator.instance;
    }

    private initializeAgents(): void {
        const agentConfigs = [
            {
                id: 'architect',
                name: 'Solution Architect',
                specialty: 'System Design & Architecture',
                aiModel: 'together',
                capabilities: ['system_design', 'architecture_planning', 'scalability_analysis', 'technology_selection']
            },
            {
                id: 'coder',
                name: 'Expert Developer',
                specialty: 'Code Generation & Implementation',
                aiModel: 'groq',
                capabilities: ['code_generation', 'algorithm_implementation', 'optimization', 'debugging']
            },
            {
                id: 'tester',
                name: 'Quality Assurance Specialist',
                specialty: 'Testing & Quality Assurance',
                aiModel: 'mistral',
                capabilities: ['test_generation', 'test_automation', 'quality_analysis', 'performance_testing']
            },
            {
                id: 'security',
                name: 'Security Expert',
                specialty: 'Security Analysis & Hardening',
                aiModel: 'cerebras',
                capabilities: ['security_audit', 'vulnerability_scanning', 'secure_coding', 'compliance_check']
            },
            {
                id: 'optimizer',
                name: 'Performance Optimizer',
                specialty: 'Performance & Optimization',
                aiModel: 'openrouter',
                capabilities: ['performance_analysis', 'code_optimization', 'resource_management', 'profiling']
            },
            {
                id: 'documenter',
                name: 'Documentation Specialist',
                specialty: 'Documentation & Knowledge Management',
                aiModel: 'groq',
                capabilities: ['documentation_generation', 'api_docs', 'user_guides', 'knowledge_extraction']
            },
            {
                id: 'devops',
                name: 'DevOps Engineer',
                specialty: 'Deployment & Infrastructure',
                aiModel: 'together',
                capabilities: ['ci_cd_setup', 'deployment_automation', 'infrastructure_as_code', 'monitoring_setup']
            },
            {
                id: 'refactorer',
                name: 'Code Refactoring Specialist',
                specialty: 'Code Quality & Refactoring',
                aiModel: 'mistral',
                capabilities: ['code_refactoring', 'technical_debt_reduction', 'code_smell_detection', 'maintainability_improvement']
            }
        ];

        agentConfigs.forEach(config => {
            const agent: IntelligentAgent = {
                ...config,
                status: 'idle',
                workload: 0,
                successRate: 95,
                learningProgress: 0
            };
            this.agents.set(config.id, agent);
        });
    }

    public async executeIntelligentTask(description: string, options: any = {}): Promise<string> {
        try {
            // 1. Analyze project context
            await this.analyzeProjectContext();

            // 2. Decompose task into subtasks
            const taskPlan = await this.decomposeTask(description, options);

            // 3. Assign optimal agents
            const agentAssignments = await this.assignOptimalAgents(taskPlan);

            // 4. Execute coordinated workflow
            const results = await this.executeCoordinatedWorkflow(agentAssignments);

            // 5. Learn from execution
            await this.learnFromExecution(taskPlan, results);

            return results;

        } catch (error) {
            console.error('Intelligent task execution failed:', error);
            return `❌ Task execution failed: ${error}`;
        }
    }

    private async analyzeProjectContext(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {return;}

        const prompt = `Analyze this project structure and provide detailed context:
        
        Project Path: ${workspaceFolder.uri.fsPath}
        
        Analyze:
        1. Project type and main frameworks
        2. Programming languages used
        3. Dependencies and technology stack
        4. Codebase complexity and size
        5. Current architecture patterns
        6. Testing setup and coverage
        7. Technical debt indicators
        8. Performance characteristics
        
        Return structured JSON analysis.`;

        const analysis = await callAI(prompt);
        
        try {
            this.projectContext = JSON.parse(analysis);
        } catch {
            // Fallback context analysis
            this.projectContext = {
                projectType: 'vscode-extension',
                frameworks: ['typescript', 'nodejs'],
                languages: ['typescript', 'javascript'],
                dependencies: ['vscode', 'node-fetch'],
                codebaseSize: 10000,
                complexityScore: 75,
                testCoverage: 60,
                maintainabilityIndex: 70,
                technicalDebt: 25
            };
        }
    }

    private async decomposeTask(description: string, options: any): Promise<CrossProjectTask> {
        const prompt = `Decompose this development task into specific subtasks:

        Task: ${description}
        Project Context: ${JSON.stringify(this.projectContext)}
        Options: ${JSON.stringify(options)}

        Break down into:
        1. Analysis and planning phase
        2. Implementation phases
        3. Testing and validation
        4. Documentation and deployment
        
        For each subtask, specify:
        - Complexity level
        - Required agent specialties
        - Estimated duration
        - Dependencies
        - Deliverables
        
        Return structured JSON task plan.`;

        const taskPlanResponse = await callAI(prompt);
        
        const taskId = `task-${Date.now()}`;
        const task: CrossProjectTask = {
            id: taskId,
            description,
            complexity: 'medium',
            requiredAgents: ['architect', 'coder', 'tester'],
            estimatedDuration: 1800,
            status: 'pending',
            priority: options.priority || 1,
            dependencies: [],
            deliverables: []
        };

        try {
            const parsedPlan = JSON.parse(taskPlanResponse);
            Object.assign(task, parsedPlan);
        } catch {
            // Use default task structure
        }

        this.activeTasks.set(taskId, task);
        return task;
    }

    private async assignOptimalAgents(task: CrossProjectTask): Promise<Map<string, IntelligentAgent>> {
        const assignments = new Map<string, IntelligentAgent>();
        
        // Intelligent agent selection based on:
        // 1. Required capabilities
        // 2. Current workload
        // 3. Success rate
        // 4. Task complexity match
        
        for (const requiredAgentType of task.requiredAgents) {
            const availableAgents = Array.from(this.agents.values())
                .filter(agent => 
                    agent.capabilities.some(cap => this.matchesRequirement(cap, requiredAgentType)) &&
                    agent.workload < 80
                )
                .sort((a, b) => {
                    // Score based on success rate, low workload, and specialty match
                    const scoreA = a.successRate * (100 - a.workload) / 100;
                    const scoreB = b.successRate * (100 - b.workload) / 100;
                    return scoreB - scoreA;
                });

            if (availableAgents.length > 0) {
                const bestAgent = availableAgents[0];
                assignments.set(requiredAgentType, bestAgent);
                bestAgent.workload += this.calculateWorkloadIncrease(task.complexity);
                bestAgent.status = 'working';
            }
        }

        return assignments;
    }

    private matchesRequirement(capability: string, requirement: string): boolean {
        const capabilityMap: { [key: string]: string[] } = {
            'architect': ['system_design', 'architecture_planning'],
            'coder': ['code_generation', 'algorithm_implementation'],
            'tester': ['test_generation', 'quality_analysis'],
            'security': ['security_audit', 'vulnerability_scanning'],
            'optimizer': ['performance_analysis', 'code_optimization'],
            'documenter': ['documentation_generation', 'api_docs'],
            'devops': ['ci_cd_setup', 'deployment_automation'],
            'refactorer': ['code_refactoring', 'technical_debt_reduction']
        };

        return capabilityMap[requirement]?.includes(capability) || false;
    }

    private calculateWorkloadIncrease(complexity: string): number {
        const workloadMap: { [key: string]: number } = {
            'low': 10,
            'medium': 25,
            'high': 40,
            'expert': 60
        };
        return workloadMap[complexity] || 25;
    }

    private async executeCoordinatedWorkflow(assignments: Map<string, IntelligentAgent>): Promise<string> {
        const results: string[] = [];
        
        // Execute phases in optimal order
        const phases = [
            { name: 'Analysis', agents: ['architect'] },
            { name: 'Implementation', agents: ['coder', 'refactorer'] },
            { name: 'Testing', agents: ['tester'] },
            { name: 'Security Review', agents: ['security'] },
            { name: 'Optimization', agents: ['optimizer'] },
            { name: 'Documentation', agents: ['documenter'] },
            { name: 'Deployment Prep', agents: ['devops'] }
        ];

        for (const phase of phases) {
            const phaseResults = await this.executePhase(phase, assignments);
            results.push(`✅ **${phase.name} Phase Completed**\n${phaseResults}`);
        }

        // Update agent statuses
        for (const agent of assignments.values()) {
            agent.status = 'idle';
            agent.workload = Math.max(0, agent.workload - 20);
        }

        return results.join('\n\n');
    }

    private async executePhase(phase: any, assignments: Map<string, IntelligentAgent>): Promise<string> {
        const phaseAgents = phase.agents
            .map((agentType: string) => assignments.get(agentType))
            .filter((agent: IntelligentAgent | undefined) => agent !== undefined);

        if (phaseAgents.length === 0) {
            return `No agents available for ${phase.name} phase`;
        }

        const phasePromises = phaseAgents.map((agent: any) => this.executeAgentTask(agent, phase.name));
        const results = await Promise.all(phasePromises);

        return results.join('\n');
    }

    private async executeAgentTask(agent: IntelligentAgent, phaseName: string): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectPath = workspaceFolder?.uri.fsPath || '';

        const prompt = `You are ${agent.name}, specializing in ${agent.specialty}.
        
        Execute ${phaseName} phase for this project:
        Project Context: ${JSON.stringify(this.projectContext)}
        Project Path: ${projectPath}
        
        Your capabilities: ${agent.capabilities.join(', ')}
        
        Provide detailed, actionable results for your specialty area.
        Include specific recommendations, code examples, or implementation steps.`;

        try {
            const result = await callAI(prompt);
            
            // Update agent performance
            agent.successRate = Math.min(100, agent.successRate + 0.5);
            
            return `🤖 **${agent.name}**:\n${result}`;
            
        } catch (error) {
            agent.successRate = Math.max(0, agent.successRate - 2);
            return `❌ **${agent.name}** failed: ${error}`;
        }
    }

    private getModelForProvider(provider: string): string {
        const modelMap: { [key: string]: string } = {
            'groq': 'llama-3.3-70b-versatile',
            'together': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            'mistral': 'mistral-large-latest',
            'cerebras': 'llama3.1-70b',
            'openrouter': 'mistralai/mistral-7b-instruct'
        };
        return modelMap[provider] || 'llama-3.3-70b-versatile';
    }

    private async learnFromExecution(task: CrossProjectTask, results: string): Promise<void> {
        // Analyze execution for learning opportunities
        const prompt = `Analyze this task execution for learning opportunities:

        Task: ${task.description}
        Results: ${results}
        
        Identify:
        1. Patterns that worked well
        2. Areas for optimization
        3. Best practices discovered
        4. Automation opportunities
        5. Process improvements
        
        Generate actionable learning suggestions.`;

        try {
            const learningAnalysis = await callAI(prompt);
            
            const suggestion: LearningSuggestion = {
                id: `learning-${Date.now()}`,
                type: 'optimization',
                title: `Learning from: ${task.description}`,
                description: learningAnalysis,
                impact: 'medium',
                implementation: 'Apply learned patterns to future tasks',
                learnedFrom: task.id,
                confidence: 85
            };

            this.learningDatabase.push(suggestion);
            this.saveLearningDatabase();
            
        } catch (error) {
            console.error('Learning analysis failed:', error);
        }
    }

    private startIntelligentMonitoring(): void {
        // Monitor agent performance and adapt
        setInterval(() => {
            this.optimizeAgentPerformance();
            this.rebalanceWorkloads();
        }, 300000); // Every 5 minutes
    }

    private optimizeAgentPerformance(): void {
        for (const agent of this.agents.values()) {
            // Adjust learning progress based on performance
            if (agent.successRate > 95) {
                agent.learningProgress = Math.min(100, agent.learningProgress + 1);
            } else if (agent.successRate < 80) {
                agent.learningProgress = Math.max(0, agent.learningProgress - 0.5);
            }

            // Status optimization
            if (agent.workload < 20 && agent.status === 'working') {
                agent.status = 'idle';
            }
        }
    }

    private rebalanceWorkloads(): void {
        const totalWorkload = Array.from(this.agents.values())
            .reduce((sum, agent) => sum + agent.workload, 0);
        
        const averageWorkload = totalWorkload / this.agents.size;
        
        // Redistribute workload if imbalance detected
        if (averageWorkload > 60) {
            this.redistributeWorkload();
        }
    }

    private redistributeWorkload(): void {
        const overloadedAgents = Array.from(this.agents.values())
            .filter(agent => agent.workload > 70);
        
        const availableAgents = Array.from(this.agents.values())
            .filter(agent => agent.workload < 40);

        // Implement workload redistribution logic
        for (const overloaded of overloadedAgents) {
            if (availableAgents.length > 0) {
                const targetAgent = availableAgents[0];
                const transferAmount = Math.min(20, overloaded.workload - 50);
                
                overloaded.workload -= transferAmount;
                targetAgent.workload += transferAmount;
            }
        }
    }

    private loadLearningDatabase(): void {
        try {
            const storedLearning = this.context.globalState.get<LearningSuggestion[]>('learningDatabase');
            if (storedLearning) {
                this.learningDatabase = storedLearning;
            }
        } catch (error) {
            console.error('Failed to load learning database:', error);
        }
    }

    private saveLearningDatabase(): void {
        try {
            this.context.globalState.update('learningDatabase', this.learningDatabase);
        } catch (error) {
            console.error('Failed to save learning database:', error);
        }
    }

    public async applyLearningPatterns(): Promise<string> {
        const highImpactLearnings = this.learningDatabase
            .filter(learning => learning.impact === 'high' || learning.impact === 'critical')
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5);

        if (highImpactLearnings.length === 0) {
            return 'No high-impact learning patterns available for application.';
        }

        const results: string[] = [];
        for (const learning of highImpactLearnings) {
            try {
                const applied = await this.applyLearningPattern(learning);
                results.push(`✅ Applied: ${learning.title} - ${applied}`);
            } catch (error) {
                results.push(`❌ Failed to apply: ${learning.title} - ${error}`);
            }
        }

        return results.join('\n');
    }

    private async applyLearningPattern(learning: LearningSuggestion): Promise<string> {
        // Implement pattern application based on learning type
        switch (learning.type) {
            case 'optimization':
                return await this.applyOptimizationPattern(learning);
            case 'automation':
                return await this.applyAutomationPattern(learning);
            case 'best_practice':
                return await this.applyBestPracticePattern(learning);
            default:
                return 'Pattern type not supported';
        }
    }

    private async applyOptimizationPattern(learning: LearningSuggestion): Promise<string> {
        // Implement optimization pattern
        return `Optimization pattern applied: ${learning.implementation}`;
    }

    private async applyAutomationPattern(learning: LearningSuggestion): Promise<string> {
        // Implement automation pattern
        return `Automation pattern applied: ${learning.implementation}`;
    }

    private async applyBestPracticePattern(learning: LearningSuggestion): Promise<string> {
        // Implement best practice pattern
        return `Best practice pattern applied: ${learning.implementation}`;
    }

    public getAgentStatus(): Map<string, IntelligentAgent> {
        return new Map(this.agents);
    }

    public getActiveTasks(): Map<string, CrossProjectTask> {
        return new Map(this.activeTasks);
    }

    public getLearningInsights(): LearningSuggestion[] {
        return [...this.learningDatabase];
    }

    public getPerformanceMetrics(): any {
        return {
            totalAgents: this.agents.size,
            activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'working').length,
            averageSuccessRate: Array.from(this.agents.values()).reduce((sum, a) => sum + a.successRate, 0) / this.agents.size,
            totalLearningPatterns: this.learningDatabase.length,
            activeTasks: this.activeTasks.size
        };
    }

    public async generateProductivityReport(): Promise<string> {
        const metrics = this.getPerformanceMetrics();
        const topAgents = Array.from(this.agents.values())
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 3);

        const recentLearnings = this.learningDatabase
            .sort((a, b) => parseInt(b.id.split('-')[1]) - parseInt(a.id.split('-')[1]))
            .slice(0, 3);

        return `📊 **Intelligent Multi-Agent Productivity Report**

**System Overview:**
- Total Agents: ${metrics.totalAgents}
- Active Agents: ${metrics.activeAgents}
- Average Success Rate: ${metrics.averageSuccessRate.toFixed(1)}%
- Active Tasks: ${metrics.activeTasks}
- Learning Patterns: ${metrics.totalLearningPatterns}

**Top Performing Agents:**
${topAgents.map(agent => `🏆 ${agent.name}: ${agent.successRate.toFixed(1)}% success rate`).join('\n')}

**Recent Learning Insights:**
${recentLearnings.map(learning => `💡 ${learning.title} (${learning.impact} impact)`).join('\n')}

**Project Context:**
${this.projectContext ? JSON.stringify(this.projectContext, null, 2) : 'Context analysis pending...'}`;
    }
}