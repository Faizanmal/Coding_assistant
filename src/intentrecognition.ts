import * as vscode from 'vscode';
import { generateCode } from './codegenerator';

// Enhanced pattern matching for better NLP understanding
interface ConversationalPattern {
    patterns: RegExp[];
    intent: string;
    confidence: number;
    context?: string;
}

interface UserContext {
    previousRequests: string[];
    currentWorkspace: string;
    userPreferences: {
        preferredTech: string[];
        experienceLevel: 'beginner' | 'intermediate' | 'advanced';
        projectStyle: 'minimal' | 'standard' | 'comprehensive';
    };
    sessionGoals: string[];
}

export interface ProjectIntent {
    type: 'website' | 'webapp' | 'mobile' | 'api' | 'desktop' | 'fullstack' | 'component' | 'feature';
    domain: string; // portfolio, ecommerce, blog, social, etc.
    technologies: {
        frontend?: string[];
        backend?: string[];
        database?: string[];
        mobile?: string[];
        deployment?: string[];
        testing?: string[];
    };
    features: string[];
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
    files: Array<{
        fileName: string;
        type: 'component' | 'page' | 'api' | 'config' | 'style' | 'test' | 'util';
        priority: number;
        dependencies: string[];
        description: string;
    }>;
}

export interface AgentTask {
    agentType: 'frontend' | 'backend' | 'database' | 'mobile' | 'testing' | 'devops';
    files: string[];
    description: string;
    priority: number;
    parallelGroup: number; // Files in same group can be created in parallel
}

export class IntentRecognitionSystem {
    private static instance: IntentRecognitionSystem;
    private projectTemplates: Map<string, any> = new Map();
    private technologyPatterns: Map<string, string[]> = new Map();
    private conversationalPatterns: ConversationalPattern[] = [];
    private userContext: UserContext = {
        previousRequests: [],
        currentWorkspace: '',
        userPreferences: {
            preferredTech: [],
            experienceLevel: 'intermediate',
            projectStyle: 'standard'
        },
        sessionGoals: []
    };
    private enhancedParsingEnabled = true;
    
    constructor() {
        this.initializeTemplates();
        this.initializeTechnologyPatterns();
        // Initialize conversational patterns and user context
        this.conversationalPatterns = [];
        this.userContext = {
            previousRequests: [],
            currentWorkspace: '',
            userPreferences: {
                preferredTech: [],
                experienceLevel: 'intermediate',
                projectStyle: 'standard'
            },
            sessionGoals: []
        };
        // Initialize patterns immediately
        this.initializeConversationalPatternsInline();
        this.initializeUserContextInline();
    }
    
    private initializeConversationalPatternsInline() {
        this.conversationalPatterns = [
            {
                patterns: [/i want to create/i, /i need to build/i, /help me make/i],
                intent: 'create_project',
                confidence: 0.9,
                context: 'user_request'
            },
            {
                patterns: [/portfolio website/i, /portfolio site/i, /personal website/i],
                intent: 'create_portfolio',
                confidence: 0.95,
                context: 'portfolio'
            },
            {
                patterns: [/ecommerce/i, /online store/i, /shopping site/i, /shop website/i],
                intent: 'create_ecommerce',
                confidence: 0.95,
                context: 'ecommerce'
            },
            {
                patterns: [/blog/i, /blogging platform/i, /content management/i],
                intent: 'create_blog',
                confidence: 0.95,
                context: 'blog'
            },
            {
                patterns: [/with react/i, /using react/i, /react app/i],
                intent: 'use_react',
                confidence: 0.8,
                context: 'technology'
            },
            {
                patterns: [/with authentication/i, /login system/i, /user auth/i],
                intent: 'add_authentication',
                confidence: 0.85,
                context: 'feature'
            },
            {
                patterns: [/responsive/i, /mobile.?friendly/i, /mobile.?first/i],
                intent: 'make_responsive',
                confidence: 0.8,
                context: 'feature'
            },
            {
                patterns: [/full.?stack/i, /frontend.*backend/i, /complete app/i],
                intent: 'create_fullstack',
                confidence: 0.9,
                context: 'architecture'
            },
            {
                patterns: [/simple/i, /basic/i, /minimal/i, /easy/i],
                intent: 'prefer_simple',
                confidence: 0.7,
                context: 'complexity'
            },
            {
                patterns: [/advanced/i, /complex/i, /enterprise/i, /professional/i],
                intent: 'prefer_advanced',
                confidence: 0.8,
                context: 'complexity'
            }
        ];
    }

    private initializeUserContextInline() {
        // Initialize user context based on workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.userContext.currentWorkspace = workspaceFolders[0].name;
        }
    }

    static getInstance(): IntentRecognitionSystem {
        if (!this.instance) {
            this.instance = new IntentRecognitionSystem();
        }
        return this.instance;
    }
    
    private initializeTemplates() {
        // Portfolio Website Templates
        this.projectTemplates.set('portfolio', {
            type: 'website',
            defaultTech: {
                frontend: ['html', 'css', 'javascript'],
                backend: ['node.js'],
                database: ['json']
            },
            files: [
                { fileName: 'index.html', type: 'page', priority: 1, dependencies: [], description: 'Main landing page' },
                { fileName: 'about.html', type: 'page', priority: 2, dependencies: [], description: 'About page' },
                { fileName: 'portfolio.html', type: 'page', priority: 2, dependencies: [], description: 'Portfolio showcase' },
                { fileName: 'contact.html', type: 'page', priority: 2, dependencies: [], description: 'Contact form' },
                { fileName: 'styles.css', type: 'style', priority: 1, dependencies: [], description: 'Main stylesheet' },
                { fileName: 'script.js', type: 'component', priority: 3, dependencies: ['index.html'], description: 'Interactive functionality' },
                { fileName: 'README.md', type: 'config', priority: 4, dependencies: [], description: 'Project documentation' }
            ]
        });
        
        // E-commerce Templates
        this.projectTemplates.set('ecommerce', {
            type: 'fullstack',
            defaultTech: {
                frontend: ['react', 'css'],
                backend: ['express', 'node.js'],
                database: ['mongodb']
            },
            files: [
                { fileName: 'App.jsx', type: 'component', priority: 1, dependencies: [], description: 'Main React application' },
                { fileName: 'ProductList.jsx', type: 'component', priority: 2, dependencies: ['App.jsx'], description: 'Product listing component' },
                { fileName: 'ProductDetail.jsx', type: 'component', priority: 2, dependencies: ['App.jsx'], description: 'Product detail view' },
                { fileName: 'Cart.jsx', type: 'component', priority: 2, dependencies: ['App.jsx'], description: 'Shopping cart component' },
                { fileName: 'server.js', type: 'api', priority: 1, dependencies: [], description: 'Express server setup' },
                { fileName: 'routes/products.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'Product API routes' },
                { fileName: 'routes/cart.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'Cart API routes' },
                { fileName: 'models/Product.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'Product database model' },
                { fileName: 'package.json', type: 'config', priority: 1, dependencies: [], description: 'Project dependencies' }
            ]
        });
        
        // Blog Templates
        this.projectTemplates.set('blog', {
            type: 'webapp',
            defaultTech: {
                frontend: ['react', 'css'],
                backend: ['express'],
                database: ['mongodb']
            },
            files: [
                { fileName: 'App.jsx', type: 'component', priority: 1, dependencies: [], description: 'Main blog application' },
                { fileName: 'BlogList.jsx', type: 'component', priority: 2, dependencies: ['App.jsx'], description: 'Blog post listing' },
                { fileName: 'BlogPost.jsx', type: 'component', priority: 2, dependencies: ['App.jsx'], description: 'Individual blog post' },
                { fileName: 'Editor.jsx', type: 'component', priority: 3, dependencies: ['App.jsx'], description: 'Blog post editor' },
                { fileName: 'server.js', type: 'api', priority: 1, dependencies: [], description: 'Blog API server' },
                { fileName: 'routes/posts.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'Blog post API' },
                { fileName: 'models/Post.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'Blog post model' }
            ]
        });
    }
    
    private initializeTechnologyPatterns() {
        // Frontend Technologies
        this.technologyPatterns.set('react', ['jsx', 'react', 'component', 'hook']);
        this.technologyPatterns.set('vue', ['vue', 'component', 'template']);
        this.technologyPatterns.set('angular', ['angular', 'component', 'service', 'module']);
        this.technologyPatterns.set('next.js', ['nextjs', 'next js', 'next', 'ssr']);
        this.technologyPatterns.set('nuxt', ['nuxt', 'nuxtjs']);
        this.technologyPatterns.set('svelte', ['svelte', 'sveltekit']);
        
        // Backend Technologies
        this.technologyPatterns.set('express', ['express', 'node.js', 'nodejs']);
        this.technologyPatterns.set('fastapi', ['fastapi', 'python api', 'python backend']);
        this.technologyPatterns.set('django', ['django', 'python web']);
        this.technologyPatterns.set('spring', ['spring', 'java api', 'java backend']);
        this.technologyPatterns.set('gin', ['gin', 'go api', 'golang']);
        
        // Databases
        this.technologyPatterns.set('mongodb', ['mongodb', 'mongo', 'nosql']);
        this.technologyPatterns.set('postgresql', ['postgresql', 'postgres', 'sql']);
        this.technologyPatterns.set('mysql', ['mysql', 'sql']);
        this.technologyPatterns.set('redis', ['redis', 'cache']);
        this.technologyPatterns.set('firebase', ['firebase', 'firestore']);
        
        // Mobile
        this.technologyPatterns.set('react-native', ['react native', 'mobile app', 'ios android']);
        this.technologyPatterns.set('flutter', ['flutter', 'dart']);
        this.technologyPatterns.set('ionic', ['ionic', 'hybrid']);
    }
    
    // Enhanced intent parsing with conversational understanding
    async parseUserIntent(userInput: string): Promise<ProjectIntent> {
        // Add current input to context
        this.userContext.previousRequests.push(userInput);
        
        // Analyze conversational patterns first
        const conversationalContext = this.analyzeConversationalPatterns(userInput);
        
        // Use AI to enhance intent parsing with conversation context
        const enhancedIntent = await this.enhanceIntentWithConversation(userInput, conversationalContext);
        
        // Continue with existing logic but merge with conversational insights
        const baseIntent = await this.parseUserIntentBase(userInput);
        
        // Merge conversational insights with base intent
        return this.mergeIntentWithConversation(baseIntent, enhancedIntent, conversationalContext);
    }

    private analyzeConversationalPatterns(userInput: string): any {
        const matches = [];
        const inputLower = userInput.toLowerCase();
        
        for (const pattern of this.conversationalPatterns) {
            for (const regex of pattern.patterns) {
                if (regex.test(inputLower)) {
                    matches.push({
                        intent: pattern.intent,
                        confidence: pattern.confidence,
                        context: pattern.context
                    });
                }
            }
        }
        
        return {
            matches,
            primaryIntent: matches.length > 0 ? matches[0].intent : null,
            conversationFlow: this.analyzeConversationFlow(inputLower)
        };
    }

    private analyzeConversationFlow(input: string): string {
        // Analyze the conversational flow and user's communication style
        if (input.includes('please') || input.includes('help me') || input.includes('can you')) {
            return 'polite_request';
        }
        if (input.includes('i want') || input.includes('i need') || input.includes('i would like')) {
            return 'direct_need';
        }
        if (input.includes('create') || input.includes('build') || input.includes('make')) {
            return 'action_oriented';
        }
        return 'general';
    }

    private async enhanceIntentWithConversation(userInput: string, conversationalContext: any): Promise<any> {
        const conversationHistory = this.userContext.previousRequests.slice(-3).join(' ');
        
        const prompt = `Analyze this development request with conversational context:

User Input: "${userInput}"
Recent History: "${conversationHistory}"
Detected Patterns: ${JSON.stringify(conversationalContext.matches)}
User Preferences: ${JSON.stringify(this.userContext.userPreferences)}

Provide enhanced analysis in JSON:
{
  "inferredProjectType": "portfolio|ecommerce|blog|api|mobile|fullstack",
  "suggestedTechnologies": {"frontend": [], "backend": [], "database": []},
  "conversationalTone": "professional|casual|urgent|exploratory",
  "userExpertiseLevel": "beginner|intermediate|advanced",
  "projectScope": "small|medium|large|enterprise",
  "immediateActions": ["action1", "action2"],
  "clarificationsNeeded": ["question1", "question2"]
}`;
        
        try {
            const response = await generateCode(prompt, 'llama-3.3-70b-versatile');
            return JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
        } catch (error) {
            console.warn('Conversational enhancement failed:', error);
            return null;
        }
    }

    private mergeIntentWithConversation(baseIntent: ProjectIntent, enhancedIntent: any, conversationalContext: any): ProjectIntent {
        if (!enhancedIntent) {return baseIntent;}
        
        // Update user context based on conversation
        if (enhancedIntent.userExpertiseLevel) {
            this.userContext.userPreferences.experienceLevel = enhancedIntent.userExpertiseLevel;
        }
        
        // Merge technologies
        if (enhancedIntent.suggestedTechnologies) {
            Object.keys(enhancedIntent.suggestedTechnologies).forEach(key => {
                if (enhancedIntent.suggestedTechnologies[key].length > 0) {
                    baseIntent.technologies[key as keyof typeof baseIntent.technologies] = 
                        [...(baseIntent.technologies[key as keyof typeof baseIntent.technologies] || []), 
                         ...enhancedIntent.suggestedTechnologies[key]];
                }
            });
        }
        
        // Update project type if conversation provides clearer intent
        if (enhancedIntent.inferredProjectType && 
            ['portfolio', 'ecommerce', 'blog'].includes(enhancedIntent.inferredProjectType)) {
            baseIntent.domain = enhancedIntent.inferredProjectType;
        }
        
        // Adjust complexity based on user expertise and conversation tone
        if (enhancedIntent.userExpertiseLevel === 'beginner' && baseIntent.complexity === 'complex') {
            baseIntent.complexity = 'medium';
        }
        
        return baseIntent;
    }

    // Keep original method but rename for internal use
    private async parseUserIntentBase(userInput: string): Promise<ProjectIntent> {
        // Use AI to enhance intent parsing
        const enhancedIntent = await this.enhanceIntentWithAI(userInput);
        
        // Extract project type and domain
        const projectType = this.detectProjectType(userInput);
        const domain = this.detectDomain(userInput);
        
        // Extract technologies mentioned
        const technologies = this.extractTechnologies(userInput);
        
        // Get base template and customize
        const template = this.projectTemplates.get(domain) || this.createGenericTemplate(projectType);
        
        // Merge detected technologies with template defaults
        const mergedTech = this.mergeTechnologies(template.defaultTech, technologies);
        
        // Generate file structure based on intent
        const files = await this.generateFileStructure(enhancedIntent, mergedTech, template);
        
        // Determine complexity
        const complexity = this.determineComplexity(userInput, files.length);
        
        return {
            type: projectType,
            domain,
            technologies: mergedTech,
            features: this.extractFeatures(userInput),
            complexity,
            files
        };
    }
    
    private async enhanceIntentWithAI(userInput: string): Promise<string> {
        const prompt = `Analyze this project request and extract key details:
"${userInput}"

Return a structured analysis with:
1. Project type (website, webapp, mobile app, API, etc.)
2. Domain/purpose (portfolio, ecommerce, blog, social media, etc.)
3. Technologies mentioned or implied
4. Key features requested
5. Complexity level
6. File structure suggestions

Format as clear, structured text.`;

        try {
            const analysis = await generateCode(prompt, 'llama-3.3-70b-versatile');
            return analysis;
        } catch (error) {
            return userInput; // Fallback to original input
        }
    }
    
    private detectProjectType(input: string): ProjectIntent['type'] {
        const inputLower = input.toLowerCase();
        
        if (inputLower.includes('mobile') || inputLower.includes('app') && (inputLower.includes('ios') || inputLower.includes('android'))) {
            return 'mobile';
        }
        if (inputLower.includes('api') || inputLower.includes('backend') || inputLower.includes('server')) {
            return 'api';
        }
        if (inputLower.includes('fullstack') || inputLower.includes('full stack') || 
            (inputLower.includes('frontend') && inputLower.includes('backend'))) {
            return 'fullstack';
        }
        if (inputLower.includes('website') || inputLower.includes('site')) {
            return 'website';
        }
        if (inputLower.includes('component') || inputLower.includes('feature')) {
            return 'component';
        }
        
        return 'webapp'; // Default
    }
    
    private detectDomain(input: string): string {
        const inputLower = input.toLowerCase();
        
        const domains = ['portfolio', 'ecommerce', 'blog', 'social', 'dashboard', 'landing', 'admin'];
        
        for (const domain of domains) {
            if (inputLower.includes(domain) || 
                (domain === 'ecommerce' && (inputLower.includes('shop') || inputLower.includes('store'))) ||
                (domain === 'social' && inputLower.includes('social media')) ||
                (domain === 'landing' && inputLower.includes('landing page'))) {
                return domain;
            }
        }
        
        return 'generic';
    }
    
    private extractTechnologies(input: string): ProjectIntent['technologies'] {
        const inputLower = input.toLowerCase();
        const technologies: ProjectIntent['technologies'] = {};
        
        // Check each technology pattern
        for (const [tech, patterns] of this.technologyPatterns) {
            const found = patterns.some(pattern => inputLower.includes(pattern));
            
            if (found) {
                // Categorize technology
                if (['react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte'].includes(tech)) {
                    technologies.frontend = technologies.frontend || [];
                    technologies.frontend.push(tech);
                } else if (['express', 'fastapi', 'django', 'spring', 'gin'].includes(tech)) {
                    technologies.backend = technologies.backend || [];
                    technologies.backend.push(tech);
                } else if (['mongodb', 'postgresql', 'mysql', 'redis', 'firebase'].includes(tech)) {
                    technologies.database = technologies.database || [];
                    technologies.database.push(tech);
                } else if (['react-native', 'flutter', 'ionic'].includes(tech)) {
                    technologies.mobile = technologies.mobile || [];
                    technologies.mobile.push(tech);
                }
            }
        }
        
        return technologies;
    }
    
    private extractFeatures(input: string): string[] {
        const inputLower = input.toLowerCase();
        const features: string[] = [];
        
        const featurePatterns = [
            'authentication', 'auth', 'login', 'register',
            'payment', 'checkout', 'stripe',
            'search', 'filter', 'sort',
            'comments', 'reviews', 'rating',
            'admin', 'dashboard', 'analytics',
            'responsive', 'mobile-friendly',
            'dark mode', 'theme',
            'notification', 'email',
            'file upload', 'image upload',
            'real-time', 'websocket', 'live',
            'api integration', 'third-party'
        ];
        
        featurePatterns.forEach(pattern => {
            if (inputLower.includes(pattern)) {
                features.push(pattern);
            }
        });
        
        return features;
    }
    
    private mergeTechnologies(defaultTech: any, extractedTech: ProjectIntent['technologies']): ProjectIntent['technologies'] {
        const merged = { ...defaultTech };
        
        // Override with extracted technologies
        if (extractedTech.frontend?.length) {merged.frontend = extractedTech.frontend;}
        if (extractedTech.backend?.length) {merged.backend = extractedTech.backend;}
        if (extractedTech.database?.length) {merged.database = extractedTech.database;}
        if (extractedTech.mobile?.length) {merged.mobile = extractedTech.mobile;}
        
        return merged;
    }
    
    private async generateFileStructure(enhancedIntent: string, technologies: ProjectIntent['technologies'], template: any): Promise<ProjectIntent['files']> {
        const prompt = `Based on this project analysis and technologies, generate a detailed file structure:

Project Analysis:
${enhancedIntent}

Technologies:
Frontend: ${technologies.frontend?.join(', ') || 'None'}
Backend: ${technologies.backend?.join(', ') || 'None'}  
Database: ${technologies.database?.join(', ') || 'None'}
Mobile: ${technologies.mobile?.join(', ') || 'None'}

Generate a JSON array of files with this structure:
[
  {
    "fileName": "example.js",
    "type": "component|page|api|config|style|test|util",
    "priority": 1-5,
    "dependencies": ["other-file.js"],
    "description": "Brief description"
  }
]

Consider:
- Proper file organization
- Technology-specific conventions
- Dependencies between files
- Priority order for creation

Return only the JSON array:`;

        try {
            const response = await generateCode(prompt, 'llama-3.3-70b-versatile');
            const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
            const files = JSON.parse(cleanJson);
            
            // Validate and enhance files
            return files.map((file: any, index: number) => ({
                fileName: file.fileName || `file${index}.js`,
                type: file.type || 'component',
                priority: file.priority || 3,
                dependencies: file.dependencies || [],
                description: file.description || 'Generated file'
            }));
        } catch (error) {
            console.error('Error generating file structure:', error);
            // Fallback to template files
            return template.files || [];
        }
    }
    
    private createGenericTemplate(projectType: ProjectIntent['type']): any {
        switch (projectType) {
            case 'api':
                return {
                    defaultTech: { backend: ['express'], database: ['mongodb'] },
                    files: [
                        { fileName: 'server.js', type: 'api', priority: 1, dependencies: [], description: 'Main server file' },
                        { fileName: 'routes/index.js', type: 'api', priority: 2, dependencies: ['server.js'], description: 'API routes' },
                        { fileName: 'package.json', type: 'config', priority: 1, dependencies: [], description: 'Dependencies' }
                    ]
                };
            case 'mobile':
                return {
                    defaultTech: { mobile: ['react-native'] },
                    files: [
                        { fileName: 'App.jsx', type: 'component', priority: 1, dependencies: [], description: 'Main app component' },
                        { fileName: 'package.json', type: 'config', priority: 1, dependencies: [], description: 'Dependencies' }
                    ]
                };
            default:
                return {
                    defaultTech: { frontend: ['react'], backend: ['express'] },
                    files: [
                        { fileName: 'App.jsx', type: 'component', priority: 1, dependencies: [], description: 'Main component' },
                        { fileName: 'index.js', type: 'component', priority: 1, dependencies: [], description: 'Entry point' }
                    ]
                };
        }
    }
    
    private determineComplexity(input: string, fileCount: number): ProjectIntent['complexity'] {
        const inputLower = input.toLowerCase();
        
        if (inputLower.includes('enterprise') || inputLower.includes('large scale') || fileCount > 15) {
            return 'enterprise';
        }
        if (inputLower.includes('complex') || inputLower.includes('advanced') || fileCount > 8) {
            return 'complex';
        }
        if (fileCount > 4) {
            return 'medium';
        }
        
        return 'simple';
    }
    
    async generateAgentTasks(intent: ProjectIntent): Promise<AgentTask[]> {
        const tasks: AgentTask[] = [];
        let parallelGroup = 1;
        
        // Group files by agent type
        const filesByAgent = new Map<string, string[]>();
        
        intent.files.forEach(file => {
            let agentType: AgentTask['agentType'];
            
            // Determine agent based on file type and technologies
            if (file.type === 'component' || file.type === 'page' || file.type === 'style') {
                agentType = 'frontend';
            } else if (file.type === 'api') {
                agentType = 'backend';
            } else if (file.fileName.includes('test') || file.fileName.includes('spec')) {
                agentType = 'testing';
            } else if (file.type === 'config' && (file.fileName.includes('docker') || file.fileName.includes('deploy'))) {
                agentType = 'devops';
            } else if (intent.technologies.database && file.fileName.includes('model')) {
                agentType = 'database';
            } else if (intent.technologies.mobile) {
                agentType = 'mobile';
            } else {
                agentType = 'backend'; // Default
            }
            
            if (!filesByAgent.has(agentType)) {
                filesByAgent.set(agentType, []);
            }
            filesByAgent.get(agentType)!.push(file.fileName);
        });
        
        // Create tasks for each agent
        filesByAgent.forEach((files, agentType) => {
            // Group files by priority for parallel processing
            const priorityGroups = new Map<number, string[]>();
            
            files.forEach(fileName => {
                const file = intent.files.find(f => f.fileName === fileName);
                const priority = file?.priority || 3;
                
                if (!priorityGroups.has(priority)) {
                    priorityGroups.set(priority, []);
                }
                priorityGroups.get(priority)!.push(fileName);
            });
            
            // Create tasks for each priority group
            Array.from(priorityGroups.entries())
                .sort(([a], [b]) => a - b) // Sort by priority
                .forEach(([priority, groupFiles]) => {
                    tasks.push({
                        agentType: agentType as AgentTask['agentType'],
                        files: groupFiles,
                        description: `${agentType} development for ${intent.domain} ${intent.type}`,
                        priority,
                        parallelGroup: parallelGroup++
                    });
                });
        });
        
        return tasks.sort((a, b) => a.priority - b.priority);
    }
    
    async createProjectFromIntent(intent: ProjectIntent): Promise<string> {
        const tasks = await this.generateAgentTasks(intent);
        
        let result = `🧠 **Intelligent Project Generation Complete!**\n\n`;
        result += `**Project:** ${intent.domain} ${intent.type}\n`;
        result += `**Complexity:** ${intent.complexity}\n`;
        result += `**Technologies:** ${JSON.stringify(intent.technologies, null, 2)}\n`;
        result += `**Features:** ${intent.features.join(', ')}\n\n`;
        
        result += `**Generated Files (${intent.files.length}):**\n`;
        intent.files.forEach(file => {
            result += `📄 ${file.fileName} - ${file.description}\n`;
        });
        
        result += `\n**Agent Tasks (${tasks.length}):**\n`;
        tasks.forEach((task, index) => {
            result += `${index + 1}. **${task.agentType}** (Priority ${task.priority}): ${task.files.join(', ')}\n`;
        });
        
        // TODO: Execute actual file creation with SmartAgentCoordinator
        return result;
    }
    // Enhanced workflow routing based on intent analysis
    async routeWorkflowAutomatically(userInput: string): Promise<{
        shouldUseEnhancedNLP: boolean;
        routingDecision: 'enhanced_nlp' | 'smart_coordinator' | 'basic_handler' | 'clarification_needed';
        confidence: number;
        reasoning: string[];
        suggestedActions: string[];
    }> {
        const conversationalContext = this.analyzeConversationalPatterns(userInput);
        const complexity = this.assessRequestComplexity(userInput);
        const ambiguity = this.detectAmbiguity(userInput);
        
        let routingDecision: 'enhanced_nlp' | 'smart_coordinator' | 'basic_handler' | 'clarification_needed';
        let confidence = 0;
        const reasoning: string[] = [];
        const suggestedActions: string[] = [];
        
        // Decision logic
        if (ambiguity.score > 0.7) {
            routingDecision = 'clarification_needed';
            confidence = 0.9;
            reasoning.push('High ambiguity detected');
            suggestedActions.push('Ask clarifying questions');
        } else if (complexity.isComplex && conversationalContext.matches.length > 2) {
            routingDecision = 'enhanced_nlp';
            confidence = 0.85;
            reasoning.push('Complex project with clear conversational intent');
            suggestedActions.push('Use enhanced NLP engine for full automation');
        } else if (this.isMultiFileRequest(userInput) || this.isAgentCoordinationNeeded(userInput)) {
            routingDecision = 'smart_coordinator';
            confidence = 0.8;
            reasoning.push('Multi-file or coordination required');
            suggestedActions.push('Use smart agent coordinator');
        } else {
            routingDecision = 'basic_handler';
            confidence = 0.7;
            reasoning.push('Simple request suitable for basic handling');
            suggestedActions.push('Use existing handlers');
        }
        
        return {
            shouldUseEnhancedNLP: routingDecision === 'enhanced_nlp',
            routingDecision,
            confidence,
            reasoning,
            suggestedActions
        };
    }

    private assessRequestComplexity(userInput: string): { isComplex: boolean; score: number; factors: string[] } {
        const input = userInput.toLowerCase();
        let score = 0;
        const factors: string[] = [];
        
        // Technology complexity
        const complexTech = ['full stack', 'microservices', 'kubernetes', 'docker', 'aws', 'azure'];
        complexTech.forEach(tech => {
            if (input.includes(tech)) {
                score += 0.3;
                factors.push(`Complex technology: ${tech}`);
            }
        });
        
        // Feature complexity
        const complexFeatures = ['authentication', 'payment', 'real-time', 'analytics', 'ai', 'machine learning'];
        complexFeatures.forEach(feature => {
            if (input.includes(feature)) {
                score += 0.2;
                factors.push(`Complex feature: ${feature}`);
            }
        });
        
        // Scale indicators
        const scaleIndicators = ['enterprise', 'large scale', 'production', 'commercial'];
        scaleIndicators.forEach(indicator => {
            if (input.includes(indicator)) {
                score += 0.4;
                factors.push(`Scale indicator: ${indicator}`);
            }
        });
        
        // Multiple file types
        const fileExtensions = input.match(/\.[a-z]{2,4}\b/g);
        if (fileExtensions && fileExtensions.length > 3) {
            score += 0.3;
            factors.push('Multiple file types mentioned');
        }
        
        return {
            isComplex: score > 0.5,
            score: Math.min(1, score),
            factors
        };
    }

    private detectAmbiguity(userInput: string): { score: number; ambiguities: string[] } {
        const ambiguities: string[] = [];
        let score = 0;
        
        // Vague language
        const vaguePhrases = ['something like', 'kind of', 'maybe', 'perhaps', 'not sure'];
        vaguePhrases.forEach(phrase => {
            if (userInput.toLowerCase().includes(phrase)) {
                score += 0.2;
                ambiguities.push(`Vague language: ${phrase}`);
            }
        });
        
        // Missing specifics
        if (!this.hasTechSpecs(userInput)) {
            score += 0.3;
            ambiguities.push('No specific technologies mentioned');
        }
        
        if (!this.hasProjectType(userInput)) {
            score += 0.3;
            ambiguities.push('Project type unclear');
        }
        
        // Conflicting requirements
        if (userInput.toLowerCase().includes('simple') && userInput.toLowerCase().includes('advanced')) {
            score += 0.4;
            ambiguities.push('Conflicting complexity requirements');
        }
        
        return {
            score: Math.min(1, score),
            ambiguities
        };
    }

    private hasTechSpecs(input: string): boolean {
        const techKeywords = ['react', 'vue', 'angular', 'express', 'django', 'mongodb', 'postgresql'];
        return techKeywords.some(tech => input.toLowerCase().includes(tech));
    }

    private hasProjectType(input: string): boolean {
        const projectTypes = ['website', 'app', 'api', 'blog', 'portfolio', 'ecommerce'];
        return projectTypes.some(type => input.toLowerCase().includes(type));
    }

    private isMultiFileRequest(input: string): boolean {
        const indicators = ['multiple files', 'several files', 'create files', 'generate project'];
        return indicators.some(indicator => input.toLowerCase().includes(indicator)) ||
               (input.match(/\.[a-z]{2,4}\b/g) || []).length > 2;
    }

    private isAgentCoordinationNeeded(input: string): boolean {
        const coordinationKeywords = ['agents', 'coordination', 'parallel', 'multiple tasks', 'conflict-free'];
        return coordinationKeywords.some(keyword => input.toLowerCase().includes(keyword));
    }
}