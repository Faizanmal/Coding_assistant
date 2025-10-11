import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface AgentCapability {
    languages: string[];
    frameworks: string[];
    patterns: string[];
    specialties: string[];
    priority: number;
    efficiency: number;
    workload: number;
}

interface ProjectContext {
    mainLanguage: string;
    frameworks: string[];
    fileTypes: Map<string, number>;
    dependencies: string[];
    structure: {
        frontend?: boolean;
        backend?: boolean;
        database?: boolean;
        testing?: boolean;
        mobile?: boolean;
    };
}

interface AssignmentScore {
    agentId: string;
    score: number;
    reasons: string[];
    confidence: number;
}

export class SmartAgentAssignmentSystem {
    private static instance: SmartAgentAssignmentSystem;
    private agentCapabilities: Map<string, AgentCapability> = new Map();
    private projectContext: ProjectContext | null = null;
    private assignmentHistory: Map<string, string[]> = new Map(); // fileType -> agentIds
    private performanceMetrics: Map<string, {success: number, total: number, avgTime: number}> = new Map();
    private webviewView: vscode.WebviewView | null = null;

    constructor() {
        this.initializeAgentCapabilities();
        this.loadProjectContext();
    }

    static getInstance(): SmartAgentAssignmentSystem {
        if (!this.instance) {
            this.instance = new SmartAgentAssignmentSystem();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
    }

    private initializeAgentCapabilities() {
        const capabilities: Array<[string, AgentCapability]> = [
            ['frontend-specialist', {
                languages: ['javascript', 'typescript', 'html', 'css', 'scss', 'less'],
                frameworks: ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt.js'],
                patterns: ['component', 'ui', 'interface', 'view', 'style', 'layout'],
                specialties: ['responsive-design', 'accessibility', 'performance', 'seo'],
                priority: 9,
                efficiency: 0.85,
                workload: 0
            }],
            ['backend-specialist', {
                languages: ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'php'],
                frameworks: ['express', 'fastapi', 'django', 'spring', 'gin', 'laravel'],
                patterns: ['server', 'api', 'route', 'controller', 'service', 'middleware'],
                specialties: ['rest-api', 'graphql', 'microservices', 'authentication'],
                priority: 10,
                efficiency: 0.90,
                workload: 0
            }],
            ['database-architect', {
                languages: ['sql', 'nosql', 'typescript', 'python', 'javascript'],
                frameworks: ['mongoose', 'sequelize', 'prisma', 'typeorm', 'sqlalchemy'], 
                patterns: ['schema', 'model', 'migration', 'query', 'database', 'db'],
                specialties: ['optimization', 'indexing', 'relationships', 'transactions'],
                priority: 8,
                efficiency: 0.88,
                workload: 0
            }],
            ['devops-engineer', {
                languages: ['yaml', 'json', 'bash', 'dockerfile', 'terraform'],
                frameworks: ['docker', 'kubernetes', 'ansible', 'jenkins', 'github-actions'],
                patterns: ['config', 'deploy', 'ci-cd', 'infra', 'pipeline', 'workflow'],
                specialties: ['containerization', 'orchestration', 'monitoring', 'scaling'],
                priority: 7,
                efficiency: 0.82,
                workload: 0
            }],
            ['testing-expert', {
                languages: ['javascript', 'typescript', 'python', 'java', 'go'],
                frameworks: ['jest', 'mocha', 'pytest', 'junit', 'cypress', 'playwright'],
                patterns: ['test', 'spec', 'mock', 'fixture', 'e2e', 'integration'],
                specialties: ['unit-testing', 'integration-testing', 'e2e-testing', 'tdd'],
                priority: 7,
                efficiency: 0.80,
                workload: 0
            }],
            ['security-expert', {
                languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
                frameworks: ['passport', 'oauth', 'jwt', 'bcrypt', 'helmet', 'cors'],
                patterns: ['auth', 'security', 'encrypt', 'token', 'permission', 'role'],
                specialties: ['authentication', 'authorization', 'encryption', 'vulnerabilities'],
                priority: 9,
                efficiency: 0.87,
                workload: 0
            }],
            ['mobile-specialist', {
                languages: ['javascript', 'typescript', 'swift', 'kotlin', 'dart'],
                frameworks: ['react-native', 'flutter', 'ionic', 'cordova', 'expo'],
                patterns: ['mobile', 'app', 'native', 'ios', 'android', 'hybrid'],
                specialties: ['cross-platform', 'native-modules', 'performance', 'ui-ux'],
                priority: 6,
                efficiency: 0.75,
                workload: 0
            }],
            ['code-reviewer', {
                languages: ['*'], // Universal
                frameworks: ['*'], // Universal
                patterns: ['review', 'refactor', 'optimize', 'clean', 'best-practices'],
                specialties: ['code-quality', 'performance', 'maintainability', 'patterns'],
                priority: 5,
                efficiency: 0.78,
                workload: 0
            }]
        ];

        capabilities.forEach(([id, capability]) => {
            this.agentCapabilities.set(id, capability);
        });
    }

    private async loadProjectContext() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        try {
            const context = await this.analyzeProjectStructure(workspaceFolder.uri.fsPath);
            this.projectContext = context;
            this.sendContextUpdate();
        } catch (error) {
            console.error('Failed to load project context:', error);
        }
    }

    private async analyzeProjectStructure(rootPath: string): Promise<ProjectContext> {
        const context: ProjectContext = {
            mainLanguage: '',
            frameworks: [],
            fileTypes: new Map(),
            dependencies: [],
            structure: {}
        };

        // Analyze package.json if exists
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                context.dependencies.push(...Object.keys(packageJson.dependencies || {}));
                context.dependencies.push(...Object.keys(packageJson.devDependencies || {}));
                
                // Detect frameworks
                if (context.dependencies.includes('react')) {
                    context.frameworks.push('react');
                    context.structure.frontend = true;
                }
                if (context.dependencies.includes('vue')) {
                    context.frameworks.push('vue');
                    context.structure.frontend = true;
                }
                if (context.dependencies.includes('express')) {
                    context.frameworks.push('express');
                    context.structure.backend = true;
                }
                if (context.dependencies.includes('fastapi')) {
                    context.frameworks.push('fastapi');
                    context.structure.backend = true;
                }
            } catch (error) {
                console.error('Error reading package.json:', error);
            }
        }

        // Analyze requirements.txt if exists
        const requirementsPath = path.join(rootPath, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            try {
                const requirements = fs.readFileSync(requirementsPath, 'utf8');
                const deps = requirements.split('\n').map(line => line.split('==')[0].trim());
                context.dependencies.push(...deps);
                
                if (deps.includes('fastapi') || deps.includes('django')) {
                    context.structure.backend = true;
                }
                if (deps.includes('pytest')) {
                    context.structure.testing = true;
                }
            } catch (error) {
                console.error('Error reading requirements.txt:', error);
            }
        }

        // Scan file types
        await this.scanFileTypes(rootPath, context.fileTypes);
        
        // Determine main language
        context.mainLanguage = this.determineMainLanguage(context.fileTypes);
        
        return context;
    }

    private async scanFileTypes(dirPath: string, fileTypes: Map<string, number>, depth = 0) {
        if (depth > 3) {return;} // Limit recursion depth

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }
                
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    await this.scanFileTypes(fullPath, fileTypes, depth + 1);
                } else {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (ext) {
                        fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
                    }
                }
            }
        } catch (error) {
            // Ignore permission errors
        }
    }

    private determineMainLanguage(fileTypes: Map<string, number>): string {
        const langMap: { [ext: string]: string } = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp'
        };

        let maxCount = 0;
        let mainLang = 'javascript'; // default

        for (const [ext, count] of fileTypes) {
            const lang = langMap[ext];
            if (lang && count > maxCount) {
                maxCount = count;
                mainLang = lang;
            }
        }

        return mainLang;
    }

    assignOptimalAgent(fileName: string, operation: string, prompt: string, context?: any): AssignmentScore[] {
        const scores: AssignmentScore[] = [];
        
        const fileExt = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, fileExt).toLowerCase();
        const promptLower = prompt.toLowerCase();
        
        for (const [agentId, capability] of this.agentCapabilities) {
            let score = 0;
            const reasons: string[] = [];
            
            // Language match
            if (capability.languages.includes('*') || capability.languages.some(lang => 
                fileExt.includes(lang) || this.projectContext?.mainLanguage === lang)) {
                score += 30;
                reasons.push('Language compatibility');
            }
            
            // Framework match
            if (this.projectContext?.frameworks.some(fw => 
                capability.frameworks.includes(fw) || capability.frameworks.includes('*'))) {
                score += 25;
                reasons.push('Framework expertise');
            }
            
            // Pattern match
            const patternMatches = capability.patterns.filter(pattern => 
                baseName.includes(pattern) || promptLower.includes(pattern));
            if (patternMatches.length > 0) {
                score += patternMatches.length * 15;
                reasons.push(`Pattern matches: ${patternMatches.join(', ')}`);
            }
            
            // Specialty match
            const specialtyMatches = capability.specialties.filter(specialty =>
                promptLower.includes(specialty.replace('-', ' ')));
            if (specialtyMatches.length > 0) {
                score += specialtyMatches.length * 20;
                reasons.push(`Specialty matches: ${specialtyMatches.join(', ')}`);
            }
            
            // File extension specific bonuses
            if (fileExt === '.js' && agentId === 'frontend-specialist') {score += 15;}
            if (fileExt === '.ts' && agentId === 'backend-specialist') {score += 15;}
            if (fileExt === '.py' && agentId === 'backend-specialist') {score += 20;}
            if (baseName.includes('test') && agentId === 'testing-expert') {score += 25;}
            if (baseName.includes('config') && agentId === 'devops-engineer') {score += 20;}
            
            // Priority and efficiency bonuses
            score += capability.priority * 2;
            score += capability.efficiency * 10;
            
            // Workload penalty
            score -= capability.workload * 5;
            
            // Performance history bonus
            const perf = this.performanceMetrics.get(agentId);
            if (perf && perf.total > 0) {
                const successRate = perf.success / perf.total;
                score += successRate * 15;
                reasons.push(`Success rate: ${(successRate * 100).toFixed(1)}%`);
            }
            
            // Assignment history - prefer agents that haven't worked on similar files recently
            const history = this.assignmentHistory.get(fileExt) || [];
            if (history.includes(agentId)) {
                score -= 10; // Small penalty for recent similar work
            }
            
            // Confidence calculation
            const confidence = Math.min(100, Math.max(0, 
                (score / 100) * 100 * (reasons.length / 4)
            ));
            
            scores.push({
                agentId,
                score: Math.max(0, score),
                reasons,
                confidence
            });
        }
        
        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);
        
        // Update assignment history
        if (scores.length > 0) {
            const topAgent = scores[0].agentId;
            const history = this.assignmentHistory.get(fileExt) || [];
            history.unshift(topAgent);
            this.assignmentHistory.set(fileExt, history.slice(0, 5)); // Keep last 5
        }
        
        return scores;
    }

    assignAgentsToOperations(operations: Array<{fileName: string, operation: string, prompt: string}>): Array<{
        fileName: string;
        operation: string;
        prompt: string;
        assignedAgent: string;
        alternativeAgents: string[];
        confidence: number;
        reasoning: string[];
    }> {
        const assignments = [];
        const agentWorkload = new Map<string, number>();
        
        for (const op of operations) {
            const scores = this.assignOptimalAgent(op.fileName, op.operation, op.prompt);
            
            // Find the best available agent (considering workload)
            let selectedAgent = scores[0];
            for (const score of scores) {
                const currentWorkload = agentWorkload.get(score.agentId) || 0;
                if (currentWorkload < 2) { // Max 2 concurrent operations per agent
                    selectedAgent = score;
                    break;
                }
            }
            
            // Update workload
            agentWorkload.set(selectedAgent.agentId, (agentWorkload.get(selectedAgent.agentId) || 0) + 1);
            
            // Update capability workload
            const capability = this.agentCapabilities.get(selectedAgent.agentId);
            if (capability) {
                capability.workload++;
            }
            
            assignments.push({
                fileName: op.fileName,
                operation: op.operation,
                prompt: op.prompt,
                assignedAgent: selectedAgent.agentId,
                alternativeAgents: scores.slice(1, 4).map(s => s.agentId),
                confidence: selectedAgent.confidence,
                reasoning: selectedAgent.reasons
            });
        }
        
        this.sendAssignmentUpdate(assignments);
        return assignments;
    }

    updatePerformanceMetrics(agentId: string, success: boolean, executionTime: number) {
        const current = this.performanceMetrics.get(agentId) || {success: 0, total: 0, avgTime: 0};
        
        current.total++;
        if (success) {
            current.success++;
        }
        
        // Update average time
        current.avgTime = (current.avgTime * (current.total - 1) + executionTime) / current.total;
        
        this.performanceMetrics.set(agentId, current);
        
        // Adjust efficiency based on performance
        const capability = this.agentCapabilities.get(agentId);
        if (capability) {
            const successRate = current.success / current.total;
            capability.efficiency = Math.max(0.5, Math.min(1.0, 
                capability.efficiency * 0.95 + successRate * 0.05
            ));
        }
    }

    releaseAgent(agentId: string) {
        const capability = this.agentCapabilities.get(agentId);
        if (capability && capability.workload > 0) {
            capability.workload--;
        }
    }

    getAgentRecommendations(fileName: string, prompt: string): {
        primary: string;
        alternatives: Array<{agent: string, reason: string, confidence: number}>;
        projectFit: number;
    } {
        const scores = this.assignOptimalAgent(fileName, 'create', prompt);
        
        if (scores.length === 0) {
            return {
                primary: 'backend-specialist',
                alternatives: [],
                projectFit: 50
            };
        }
        
        const primary = scores[0];
        const alternatives = scores.slice(1, 4).map(score => ({
            agent: score.agentId,
            reason: score.reasons[0] || 'General capability',
            confidence: score.confidence
        }));
        
        // Calculate project fit based on context alignment
        const projectFit = this.calculateProjectFit(primary.agentId);
        
        return {
            primary: primary.agentId,
            alternatives,
            projectFit
        };
    }

    private calculateProjectFit(agentId: string): number {
        if (!this.projectContext) {return 50;}
        
        const capability = this.agentCapabilities.get(agentId);
        if (!capability) {return 50;}
        
        let fit = 0;
        
        // Language alignment
        if (capability.languages.includes(this.projectContext.mainLanguage)) {
            fit += 30;
        }
        
        // Framework alignment
        const frameworkMatches = this.projectContext.frameworks.filter(fw =>
            capability.frameworks.includes(fw)).length;
        fit += frameworkMatches * 20;
        
        // Structure alignment
        if (agentId === 'frontend-specialist' && this.projectContext.structure.frontend) {fit += 25;}
        if (agentId === 'backend-specialist' && this.projectContext.structure.backend) {fit += 25;}
        if (agentId === 'database-architect' && this.projectContext.structure.database) {fit += 25;}
        if (agentId === 'testing-expert' && this.projectContext.structure.testing) {fit += 25;}
        
        return Math.min(100, fit);
    }

    getSystemStatus(): {
        agents: Array<{id: string, workload: number, efficiency: number, specialties: string[]}>;
        projectContext: ProjectContext | null;
        totalAssignments: number;
        performanceOverview: {avgSuccessRate: number, totalOperations: number};
    } {
        const agents = Array.from(this.agentCapabilities.entries()).map(([id, capability]) => ({
            id,
            workload: capability.workload,
            efficiency: capability.efficiency,
            specialties: capability.specialties
        }));
        
        const totalOps = Array.from(this.performanceMetrics.values())
            .reduce((sum, metric) => sum + metric.total, 0);
        const totalSuccess = Array.from(this.performanceMetrics.values())
            .reduce((sum, metric) => sum + metric.success, 0);
        
        return {
            agents,
            projectContext: this.projectContext,
            totalAssignments: Array.from(this.assignmentHistory.values())
                .reduce((sum, history) => sum + history.length, 0),
            performanceOverview: {
                avgSuccessRate: totalOps > 0 ? totalSuccess / totalOps : 0,
                totalOperations: totalOps
            }
        };
    }

    private sendContextUpdate() {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'projectContextUpdate',
                data: this.projectContext
            });
        }
    }

    private sendAssignmentUpdate(assignments: any[]) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'agentAssignmentUpdate',
                data: assignments
            });
        }
    }

    // Method for manual agent preference override
    setAgentPreference(filePattern: string, preferredAgent: string) {
        // Allow users to override automatic assignments for specific patterns
        const history = this.assignmentHistory.get(filePattern) || [];
        history.unshift(preferredAgent);
        this.assignmentHistory.set(filePattern, history.slice(0, 10));
    }

    clearPerformanceHistory() {
        this.performanceMetrics.clear();
        this.assignmentHistory.clear();
        
        // Reset workload and efficiency
        for (const capability of this.agentCapabilities.values()) {
            capability.workload = 0;
            capability.efficiency = Math.max(0.75, capability.efficiency); // Reset to at least 75%
        }
    }
}