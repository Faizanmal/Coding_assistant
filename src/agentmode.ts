import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

interface AgentTask {
  id: string;
  description: string;
  steps: string[];
  currentStep: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  dependencies: string[];
  agent: string;
  startTime: number;
  estimatedDuration: number;
}

/**
 * Agent Mode with Multi-step Planning System
 */
export class AgentModeCoordinator {
  private activeTasks: Map<string, AgentTask> = new Map();
  private taskQueue: AgentTask[] = [];
  private availableAgents = [
    'Frontend Developer',
    'Backend Developer',
    'Database Designer',
    'DevOps Engineer',
    'Testing Specialist',
    'Security Analyst',
    'UI/UX Designer',
    'Code Reviewer'
  ];

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Plan and execute complex multi-step tasks using agent coordination
   */
  public async planAndExecuteTask(userRequest: string): Promise<string> {
    try {
      // Step 1: Break down the request into subtasks
      const taskPlan = await this.planTask(userRequest);
      
      // Step 2: Create execution plan with agent assignments
      const executionPlan = await this.createExecutionPlan(taskPlan);
      
      // Step 3: Execute tasks with coordination
      const results = await this.executeTaskPlan(executionPlan);
      
      return this.formatResults(results);
      
    } catch (error) {
      return `Agent coordination failed: ${error}`;
    }
  }

  /**
   * Break down complex request into manageable tasks
   */
  private async planTask(userRequest: string): Promise<any> {
    const prompt = `You are a project manager AI. Break down this complex development request into specific, actionable tasks:

Request: "${userRequest}"

Create a detailed task breakdown including:
1. Main tasks and subtasks
2. Task dependencies (which tasks must be completed before others)
3. Estimated effort for each task (1-5 scale)
4. Required skills/expertise
5. Expected deliverables

Format as JSON with this structure:
{
  "mainGoal": "description",
  "tasks": [
    {
      "id": "task_1",
      "name": "Task name",
      "description": "Detailed description",
      "dependencies": ["task_id_1", "task_id_2"],
      "effort": 3,
      "skills": ["Frontend", "API"],
      "deliverables": ["file1.js", "file2.css"],
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}`;

    const response = await getLLMCompletion(prompt);
    
    try {
      return JSON.parse(response || '{}');
    } catch {
      // Fallback to simple parsing if JSON fails
      return this.parseTaskPlanFromText(response || '');
    }
  }

  /**
   * Create execution plan with agent assignments
   */
  private async createExecutionPlan(taskPlan: any): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];
    
    for (const task of taskPlan.tasks || []) {
      const agent = this.assignBestAgent(task.skills || []);
      
      tasks.push({
        id: task.id,
        description: task.description,
        steps: task.steps || [],
        currentStep: 0,
        status: 'planning',
        dependencies: task.dependencies || [],
        agent: agent,
        startTime: Date.now(),
        estimatedDuration: (task.effort || 1) * 60000 // Convert to milliseconds
      });
    }

    // Sort tasks by dependencies
    return this.sortTasksByDependencies(tasks);
  }

  /**
   * Execute the task plan with agent coordination
   */
  private async executeTaskPlan(tasks: AgentTask[]): Promise<any[]> {
    const results = [];
    const executingTasks = new Set<string>();

    for (const task of tasks) {
      // Wait for dependencies to complete
      await this.waitForDependencies(task, executingTasks);
      
      // Execute task
      executingTasks.add(task.id);
      task.status = 'executing';
      
      vscode.window.showInformationMessage(`${task.agent} is executing: ${task.description}`);
      
      try {
        const result = await this.executeTask(task);
        task.status = 'completed';
        results.push(result);
      } catch (error) {
        task.status = 'failed';
        results.push({ error: `Task ${task.id} failed: ${error}` });
      }
      
      executingTasks.delete(task.id);
    }

    return results;
  }

  /**
   * Execute individual task step by step
   */
  private async executeTask(task: AgentTask): Promise<any> {
    const results = [];
    
    for (let i = 0; i < task.steps.length; i++) {
      task.currentStep = i;
      const step = task.steps[i];
      
      vscode.window.showInformationMessage(`${task.agent}: ${step}`);
      
      // Generate code or content for this step
      const stepResult = await this.executeStep(step, task.agent);
      results.push({ step: i + 1, description: step, result: stepResult });
      
      // Small delay for user feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      taskId: task.id,
      agent: task.agent,
      description: task.description,
      steps: results,
      completedAt: Date.now()
    };
  }

  /**
   * Execute individual step with specific agent context
   */
  private async executeStep(step: string, agent: string): Promise<string> {
    const prompt = `You are a ${agent}. Execute this specific step:

Step: "${step}"

Provide the actual code, configuration, or implementation needed for this step. Be specific and practical.`;

    return await getLLMCompletion(prompt) || `Step completed by ${agent}`;
  }

  /**
   * Assign best agent based on required skills
   */
  private assignBestAgent(skills: string[]): string {
    const agentSkillMap: { [key: string]: string[] } = {
      'Frontend Developer': ['Frontend', 'UI', 'JavaScript', 'React', 'Vue', 'Angular', 'CSS', 'HTML'],
      'Backend Developer': ['Backend', 'API', 'Server', 'Node.js', 'Python', 'Database', 'Authentication'],
      'Database Designer': ['Database', 'SQL', 'NoSQL', 'Schema', 'Migration', 'Optimization'],
      'DevOps Engineer': ['DevOps', 'Docker', 'CI/CD', 'Deployment', 'AWS', 'Cloud', 'Infrastructure'],
      'Testing Specialist': ['Testing', 'QA', 'Unit Tests', 'Integration Tests', 'Automation'],
      'Security Analyst': ['Security', 'Authentication', 'Authorization', 'Encryption', 'Vulnerability'],
      'UI/UX Designer': ['UI', 'UX', 'Design', 'Wireframe', 'Mockup', 'User Experience'],
      'Code Reviewer': ['Review', 'Quality', 'Best Practices', 'Performance', 'Maintainability']
    };

    let bestAgent = 'Frontend Developer';
    let maxMatch = 0;

    for (const [agent, agentSkills] of Object.entries(agentSkillMap)) {
      const matchCount = skills.filter(skill => 
        agentSkills.some(agentSkill => 
          agentSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(agentSkill.toLowerCase())
        )
      ).length;

      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Sort tasks by dependencies using topological sort
   */
  private sortTasksByDependencies(tasks: AgentTask[]): AgentTask[] {
    const sorted: AgentTask[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: AgentTask) => {
      if (visiting.has(task.id)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(task.id)) {
        return;
      }

      visiting.add(task.id);
      
      for (const depId of task.dependencies) {
        const depTask = tasks.find(t => t.id === depId);
        if (depTask) {
          visit(depTask);
        }
      }

      visiting.delete(task.id);
      visited.add(task.id);
      sorted.push(task);
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task);
      }
    }

    return sorted;
  }

  /**
   * Wait for task dependencies to complete
   */
  private async waitForDependencies(task: AgentTask, executingTasks: Set<string>): Promise<void> {
    while (task.dependencies.some(depId => executingTasks.has(depId))) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Parse task plan from text if JSON parsing fails
   */
  private parseTaskPlanFromText(text: string): any {
    const lines = text.split('\n');
    const tasks = [];
    let currentTask: any = null;

    for (const line of lines) {
      if (line.includes('Task') && line.includes(':')) {
        if (currentTask) {
          tasks.push(currentTask);
        }
        currentTask = {
          id: `task_${tasks.length + 1}`,
          name: line.split(':')[1]?.trim() || '',
          description: '',
          dependencies: [],
          effort: 2,
          skills: ['Frontend'],
          deliverables: [],
          steps: []
        };
      } else if (currentTask && line.trim()) {
        if (line.includes('Step')) {
          currentTask.steps.push(line.trim());
        } else {
          currentTask.description += line.trim() + ' ';
        }
      }
    }

    if (currentTask) {
      tasks.push(currentTask);
    }

    return { mainGoal: 'Parsed from text', tasks };
  }

  /**
   * Format execution results for display
   */
  private formatResults(results: any[]): string {
    const report = [`# Agent Coordination Results\n`];
    
    report.push(`## Summary`);
    report.push(`- Total Tasks: ${results.length}`);
    report.push(`- Completed: ${results.filter(r => !r.error).length}`);
    report.push(`- Failed: ${results.filter(r => r.error).length}\n`);

    report.push(`## Detailed Results\n`);

    for (const result of results) {
      if (result.error) {
        report.push(`### ❌ ${result.error}\n`);
      } else {
        report.push(`### ✅ ${result.description}`);
        report.push(`**Agent**: ${result.agent}`);
        report.push(`**Completed**: ${new Date(result.completedAt).toLocaleString()}\n`);
        
        if (result.steps) {
          report.push(`**Steps Executed**:`);
          for (const step of result.steps) {
            report.push(`${step.step}. ${step.description}`);
            if (step.result) {
              report.push(`   Result: ${step.result.slice(0, 100)}...`);
            }
          }
          report.push('');
        }
      }
    }

    return report.join('\n');
  }

  /**
   * Get current agent status
   */
  public getAgentStatus(): any {
    return {
      activeTasks: Array.from(this.activeTasks.values()),
      queuedTasks: this.taskQueue.length,
      availableAgents: this.availableAgents
    };
  }
}

export function registerAgentModeCommands(context: vscode.ExtensionContext) {
  const agentCoordinator = new AgentModeCoordinator(context);

  const agentModeCommand = vscode.commands.registerCommand('coding.agentMode', async () => {
    const request = await vscode.window.showInputBox({
      prompt: 'Describe what you want to build (Agent Mode will break it down and execute step by step)',
      placeHolder: 'Build a full-stack todo app with authentication, create a REST API with tests, design a microservice architecture...'
    });

    if (request) {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Agent Mode: Planning and executing...',
        cancellable: false
      }, async () => {
        try {
          const results = await agentCoordinator.planAndExecuteTask(request);
          
          const doc = await vscode.workspace.openTextDocument({
            content: results,
            language: 'markdown'
          });
          await vscode.window.showTextDocument(doc);
          
        } catch (error) {
          vscode.window.showErrorMessage(`Agent Mode failed: ${error}`);
        }
      });
    }
  });

  const agentStatusCommand = vscode.commands.registerCommand('coding.agentStatus', async () => {
    const status = agentCoordinator.getAgentStatus();
    
    const content = `# Agent Status Dashboard

## Available Agents
${status.availableAgents.map((agent: string) => `- ${agent}`).join('\n')}

## Active Tasks
${status.activeTasks.length > 0 ? 
  status.activeTasks.map((task: any) => `
### ${task.description}
- **Agent**: ${task.agent}
- **Status**: ${task.status}
- **Progress**: Step ${task.currentStep + 1}/${task.steps.length}
- **Dependencies**: ${task.dependencies.join(', ') || 'None'}
  `).join('\n') : 
  'No active tasks'
}

## Queue
- **Queued Tasks**: ${status.queuedTasks}
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(agentModeCommand, agentStatusCommand);
}