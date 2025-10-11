import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { SmartAgentAssignmentSystem } from './smartagentassignment';
import { ConflictPreventionSystem } from './conflictprevention';
import { fileExtensionRegistry, FileExtensionAgentRegistry } from './fileextensionagentregistry';
import { EditTracker } from './edittracker';

interface Agent {
    id: string;
    name: string;
    specialization: string[];
    description: string;
    priority: number;
    status: 'idle' | 'working' | 'reviewing' | 'blocked';
    currentTask?: string;
    workingOn?: string[];
}

interface FileOperation {
    id: string;
    fileName: string;
    operation: 'create' | 'edit' | 'review' | 'analyze';
    assignedAgent: string;
    status: 'queued' | 'in-progress' | 'completed' | 'error' | 'blocked';
    dependencies: string[];
    priority: number;
    prompt: string;
    startTime?: Date;
    completionTime?: Date;
    retryCount: number;
}

interface ConflictResolution {
    conflictType: 'file-lock' | 'dependency' | 'agent-busy' | 'cross-reference';
    files: string[];
    agents: string[];
    resolution: 'queue' | 'parallel' | 'merge' | 'reject';
    strategy: string;
}

export class SmartAgentCoordinator {
    private static instance: SmartAgentCoordinator;
    private agents: Map<string, Agent> = new Map();
    private operations: Map<string, FileOperation> = new Map();
    private fileLocks: Map<string, string> = new Map(); // file -> agentId
    private dependencyGraph: Map<string, string[]> = new Map();
    private webviewView: vscode.WebviewView | null = null;
    private operationQueue: FileOperation[] = [];
    private chatExplanations: Map<string, string> = new Map(); // operationId -> explanation

    /**
     * Extracts clean code content from AI response and separates explanations
     */
    private extractCodeContent(aiResponse: string, fileName: string): { code: string; explanation: string } {
        const lines = aiResponse.split('\n');
        let code = '';
        let explanation = '';
        let inCodeBlock = false;
        let codeBlockLanguage = '';
        let explanationParts: string[] = [];
        
        // Detect file extension to determine expected language
        const ext = path.extname(fileName).toLowerCase();
        const expectedLanguages: { [key: string]: string[] } = {
            '.py': ['python', 'py'],
            '.js': ['javascript', 'js'],
            '.ts': ['typescript', 'ts'],
            '.html': ['html'],
            '.css': ['css'],
            '.json': ['json'],
            '.md': ['markdown', 'md'],
            '.java': ['java'],
            '.cpp': ['cpp', 'c++'],
            '.c': ['c'],
            '.php': ['php'],
            '.rb': ['ruby'],
            '.go': ['go'],
            '.rs': ['rust'],
            '.kt': ['kotlin'],
            '.swift': ['swift']
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check for code block start
            if (line.trim().startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    codeBlockLanguage = line.replace('```', '').trim().toLowerCase();
                    continue;
                } else {
                    inCodeBlock = false;
                    codeBlockLanguage = '';
                    continue;
                }
            }
            
            if (inCodeBlock) {
                // Only collect code if it's in the right language block or no language specified
                const expectedLangs = (expectedLanguages as Record<string, string[]>)[ext] || [];
                if (!codeBlockLanguage || expectedLangs.includes(codeBlockLanguage) || codeBlockLanguage === 'text') {
                    code += line + '\n';
                }
            } else {
                // Collect explanation text (skip markdown headers and formatting)
                const cleanLine = line.trim();
                if (cleanLine && !cleanLine.startsWith('#') && !cleanLine.startsWith('**') && !cleanLine.startsWith('*')) {
                    explanationParts.push(cleanLine);
                }
            }
        }
        
        // If no code blocks found, assume entire response is code (fallback)
        if (!code.trim()) {
            // Check if response looks like code (no markdown formatting)
            const hasMarkdownElements = aiResponse.includes('##') || aiResponse.includes('**') || aiResponse.includes('```');
            if (!hasMarkdownElements) {
                code = aiResponse;
                explanation = `Generated ${fileName} with clean code structure.`;
            } else {
                // Extract everything that doesn't look like markdown
                code = aiResponse.replace(/^#+\s+.*$/gm, '') // Remove headers
                                .replace(/\*\*.*?\*\*/g, '') // Remove bold
                                .replace(/\*.*?\*/g, '') // Remove italic
                                .replace(/```[\s\S]*?```/g, '') // Remove any code blocks
                                .trim();
                explanation = 'Extracted code content from mixed response.';
            }
        } else {
            explanation = explanationParts.join(' ').trim() || `Generated ${fileName} successfully.`;
        }
        
        return {
            code: code.trim(),
            explanation: explanation || `Successfully generated ${fileName}`
        };
    }
    
    /**
     * Sends explanation to chat sidebar
     */
    private async sendExplanationToChat(explanation: string, fileName: string, agent: string): Promise<void> {
        try {
            // Try to send to chat panel if available
            const chatMessage = `🤖 **${agent}** completed: **${fileName}**\n\n${explanation}`;
            
            // Update webview if available
            if (this.webviewView?.webview) {
                this.webviewView.webview.postMessage({
                    type: 'agentUpdate',
                    data: {
                        agent,
                        fileName,
                        explanation,
                        timestamp: new Date().toLocaleTimeString()
                    }
                });
            }
            
            // Also show in status bar briefly
            vscode.window.setStatusBarMessage(`✅ ${agent}: ${fileName} created`, 3000);
            
        } catch (error) {
            console.log('Could not send to chat:', error);
        }
    }
    private maxConcurrentOperations = 3;
    private conflictHistory: ConflictResolution[] = [];
    private assignmentSystem: SmartAgentAssignmentSystem;
    private conflictPrevention: ConflictPreventionSystem;
    private extensionRegistry: FileExtensionAgentRegistry;

    constructor() {
        this.extensionRegistry = FileExtensionAgentRegistry.getInstance();
        this.assignmentSystem = SmartAgentAssignmentSystem.getInstance();
        this.conflictPrevention = ConflictPreventionSystem.getInstance();
        this.initializeAgents();
    }

    static getInstance(): SmartAgentCoordinator {
        if (!this.instance) {
            this.instance = new SmartAgentCoordinator();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
        this.assignmentSystem.setWebviewView(view);
        this.conflictPrevention.setWebviewView(view);
    }

    private initializeAgents() {
        try {
            const registeredAgents = this.extensionRegistry.getAllAgents();

            if (registeredAgents && Array.isArray(registeredAgents)) {
                registeredAgents.forEach(agent => {
                    if (agent && agent.name) {
                        const id = (agent as any).id || agent.name;
                        this.agents.set(id as string, {
                            id: id as string,
                            name: agent.name,
                            specialization: (agent as any).extensions || [],
                            description: agent.description || '',
                            priority: (agent as any).priority || 5,
                            status: 'idle',
                            currentTask: undefined,
                            workingOn: []
                        });
                    }
                });
            }
            
            console.log(`🤖 SmartAgentCoordinator initialized with ${this.agents.size} agents`);
        } catch (error) {
            console.error('Error initializing agents:', error);
        }
    }

    async processMultiAgentRequest(prompt: string): Promise<string> {
        try {
            // Ensure we have agents
            if (this.agents.size === 0) {
                console.log('No agents available, re-initializing...');
                this.initializeAgents();
                if (this.agents.size === 0) {
                    return "❌ No agents available for processing. Please check agent registration.";
                }
            }

            // Start batch operation tracking
            const operationId = EditTracker.startBatchOperation(prompt, 'SmartAgentCoordinator');
            
            // Parse request into file operations
            const operations = await this.parseRequest(prompt);
            
            if (operations.length === 0) {
                EditTracker.rejectBatchOperation(operationId);
                return "❌ No valid file operations found in request. Try being more specific about files to create or edit.";
            }

            // Plan and resolve conflicts
            const executionPlan = await this.createExecutionPlan(operations);
            
            // Track all files in this operation
            operations.forEach(op => {
                EditTracker.trackAgentOperation(op.fileName, operationId, op.assignedAgent);
            });
            
            // Execute with coordination
            const results = await this.executeCoordinatedOperations(executionPlan);
            
            // Finish batch operation
            EditTracker.finishBatchOperation(operationId);
            
            return this.formatResults(results);
            
        } catch (error: any) {
            console.error('SmartAgentCoordinator error:', error);
            return `❌ Multi-agent coordination failed: ${error.message}\n\nTry a simpler request like "create index.js" or "edit package.json: add express dependency"`;
        }
    }

    private async parseRequest(prompt: string): Promise<FileOperation[]> {
        const operations: FileOperation[] = [];
        const operationId = () => Math.random().toString(36).substr(2, 9);

        // Parse different request patterns
        const patterns = [
            // Multi-file creation: "create app.js, styles.css, index.html"
            /(?:create|generate|make)\s+([^.]+\.[a-zA-Z0-9]+(?:\s*,\s*[^.]+\.[a-zA-Z0-9]+)*)/gi,
            // File editing: "edit server.js: add logging, config.json: update settings"
            /edit\s+([^:]+):\s*([^,]+)(?:,|$)/gi,
            // Mixed operations: "create api.js, edit main.py: add routes"
            /(?:create|edit|generate)\s+([^:,]+)(?::\s*([^,]+))?/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                if (pattern.source.includes('edit')) {
                    // Edit operation
                    const fileName = match[1].trim();
                    const editPrompt = match[2]?.trim() || 'Improve this file';
                    operations.push({
                        id: operationId(),
                        fileName,
                        operation: 'edit',
                        assignedAgent: '',
                        status: 'queued',
                        dependencies: [],
                        priority: 5,
                        prompt: editPrompt,
                        retryCount: 0
                    });
                } else {
                    // Create operation
                    const fileList = match[1].split(',').map(f => f.trim());
                    const description = match[2]?.trim() || prompt;
                    
                    fileList.forEach(fileName => {
                        if (fileName.includes('.')) {
                            operations.push({
                                id: operationId(),
                                fileName,
                                operation: 'create',
                                assignedAgent: '',
                                status: 'queued', 
                                dependencies: [],
                                priority: 6,
                                prompt: `Create ${fileName}: ${description}`,
                                retryCount: 0
                            });
                        }
                    });
                }
            }
        }

        // Enhanced: Handle natural language requests ALWAYS (not just when operations.length === 0)
        // This ensures requests like "create server for Express API" are processed
        if (operations.length === 0 || this.shouldUseNLPParsing(prompt)) {
            const nlpOps = await this.parseNaturalLanguageRequest(prompt);
            operations.push(...nlpOps);
        }

        return operations;
    }

    private shouldUseNLPParsing(prompt: string): boolean {
        const promptLower = prompt.toLowerCase();
        
        const nlpIndicators = [
            // No explicit file extensions mentioned
            !prompt.match(/\w+\.[a-zA-Z0-9]+/),
            // Common natural language patterns without extensions
            promptLower.includes('create') && !prompt.includes('.'),
            promptLower.includes('generate') && !prompt.includes('.'),
            promptLower.includes('make') && !prompt.includes('.'),
            promptLower.includes('build') && !prompt.includes('.'),
            // Technology-specific terms that should trigger intelligent inference
            promptLower.includes('express'),
            promptLower.includes('react'),
            promptLower.includes('python'),
            promptLower.includes('server'),
            promptLower.includes('api'),
            promptLower.includes('component'),
            promptLower.includes('database'),
            promptLower.includes('config'),
            promptLower.includes('handler'),
            promptLower.includes('controller'),
            promptLower.includes('utility'),
            promptLower.includes('helper'),
            promptLower.includes('service'),
            promptLower.includes('middleware'),
            // Framework specific terms
            promptLower.includes('fastapi'),
            promptLower.includes('flask'),
            promptLower.includes('django'),
            promptLower.includes('vue'),
            promptLower.includes('angular'),
            promptLower.includes('node'),
            // Project structure terms
            promptLower.includes('project'),
            promptLower.includes('application'),
            promptLower.includes('app'),
            // Action terms that suggest file creation without extensions
            promptLower.includes('setup'),
            promptLower.includes('initialize'),
            promptLower.includes('scaffold')
        ];
        
        return nlpIndicators.some(indicator => indicator === true);
    }

    private async parseNaturalLanguageRequest(prompt: string): Promise<FileOperation[]> {
        const operations: FileOperation[] = [];
        const operationId = () => Math.random().toString(36).substr(2, 9);

        // Enhanced AI parsing with better prompt for extensionless requests
        const parsePrompt = `Parse this development request into specific file operations:
"${prompt}"

IMPORTANT RULES:
1. If this is a "django project" request, return an empty array [] to use built-in Django project structure
2. If this is a "react app" request, return an empty array [] to use built-in React structure  
3. If this is a "express server" request, return an empty array [] to use built-in Express structure
4. Only parse if specific individual files are mentioned (like "create user.py, auth.js")
5. If no file extensions mentioned, infer appropriate extensions:
   - "server" with "express/node" → server.js
   - "server" with "python" → server.py  
   - "api" with "express" → app.js + routes/api.js
   - "react component" → Component.jsx
   - "config" → config.js or config.py
   - "database" → models.js or models.py

Return ONLY a JSON array of operations or empty array []:
[
  {
    "fileName": "example.js",
    "operation": "create", 
    "prompt": "specific task description"
  }
]

For project-level requests (django project, react app, etc.), return: []`;

        try {
            const response = await generateCode(parsePrompt, 'llama-3.3-70b-versatile');
            let parsed;
            
            try {
                // Clean response and parse JSON
                const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
                parsed = JSON.parse(cleanedResponse);
            } catch (parseError) {
                console.log('AI parsing failed, using fallback project structure');
                // For project-level requests, immediately use fallback
                const projectTerms = ['project', 'app', 'application', 'website', 'site'];
                if (projectTerms.some(term => prompt.toLowerCase().includes(term))) {
                    const commonFiles = this.inferCommonFiles(prompt);
                    return this.createOperationsFromFiles(commonFiles, prompt);
                }
                return operations;
            }
            
            // If AI returned empty array, use project structure inference
            if (Array.isArray(parsed) && parsed.length === 0) {
                console.log('AI suggested using built-in project structure');
                const commonFiles = this.inferCommonFiles(prompt);
                return this.createOperationsFromFiles(commonFiles, prompt);
            }
            
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed.forEach(op => {
                    if (op && op.fileName && op.operation && op.prompt) {
                        operations.push({
                            id: operationId(),
                            fileName: op.fileName,
                            operation: op.operation,
                            assignedAgent: '',
                            status: 'queued',
                            dependencies: [],
                            priority: 5,
                            prompt: op.prompt,
                            retryCount: 0
                        });
                    }
                });
            } else {
                console.log('AI response is not a valid array, using fallback');
                const commonFiles = this.inferCommonFiles(prompt);
                return this.createOperationsFromFiles(commonFiles, prompt);
            }
        } catch (error) {
            console.log('AI parsing completely failed, using intelligent fallback');
            // Always use fallback for project-level requests
            const commonFiles = this.inferCommonFiles(prompt);
            return this.createOperationsFromFiles(commonFiles, prompt);
        }

        return operations;
    }

    /**
     * Helper method to create operations from file list
     */
    private createOperationsFromFiles(files: string[], originalPrompt: string): FileOperation[] {
        const operations: FileOperation[] = [];
        const operationId = () => Math.random().toString(36).substr(2, 9);
        
        if (Array.isArray(files) && files.length > 0) {
            files.forEach(fileName => {
                const enhancedPrompt = this.generateEnhancedPrompt(fileName, originalPrompt);
                
                operations.push({
                    id: operationId(),
                    fileName,
                    operation: 'create',
                    assignedAgent: '',
                    status: 'queued',
                    dependencies: [],
                    priority: this.getFilePriority(fileName),
                    prompt: enhancedPrompt,
                    retryCount: 0
                });
            });
        } else {
            console.warn('No files provided, adding default file');
            operations.push({
                id: operationId(),
                fileName: 'index.js',
                operation: 'create',
                assignedAgent: '',
                status: 'queued',
                dependencies: [],
                priority: 5,
                prompt: `Create index.js based on: ${originalPrompt}`,
                retryCount: 0
            });
        }
        
        return operations;
    }

    private inferCommonFiles(prompt: string): string[] {
        const files: string[] = [];
        const promptLower = prompt.toLowerCase();

        // Enhanced inference patterns
        
        // Server patterns (handles "create server for Express API")
        if (promptLower.includes('server')) {
            if (promptLower.includes('express') || promptLower.includes('node')) {
                files.push('server.js', 'package.json');
            } else if (promptLower.includes('python') || promptLower.includes('fastapi') || promptLower.includes('flask')) {
                files.push('server.py', 'requirements.txt');
            } else {
                files.push('server.js', 'package.json'); // Default to Node.js
            }
        }
        
        // API patterns
        if (promptLower.includes('api')) {
            if (promptLower.includes('express') || promptLower.includes('node')) {
                files.push('app.js', 'routes/api.js', 'package.json');
            } else if (promptLower.includes('python') || promptLower.includes('fastapi')) {
                files.push('main.py', 'requirements.txt');
            } else if (promptLower.includes('flask')) {
                files.push('app.py', 'requirements.txt');
            } else {
                files.push('app.js', 'package.json'); // Default
            }
        }

        // Django Project patterns (ENHANCED)
        if (promptLower.includes('django')) {
            files.push(
                'manage.py',
                'requirements.txt',
                'myproject/settings.py',
                'myproject/urls.py',
                'myproject/wsgi.py',
                'myproject/__init__.py',
                'myapp/models.py',
                'myapp/views.py',
                'myapp/urls.py',
                'myapp/admin.py',
                'myapp/apps.py',
                'myapp/__init__.py',
                'static/css/style.css',
                'static/js/script.js',
                'templates/base.html',
                'templates/index.html',
                '.env',
                'README.md'
            );
        }

        // FastAPI Project patterns (ENHANCED)
        if (promptLower.includes('fastapi')) {
            files.push(
                'main.py',
                'requirements.txt',
                'app/models.py',
                'app/schemas.py',
                'app/database.py',
                'app/crud.py',
                'app/routers/users.py',
                'app/routers/items.py',
                'app/__init__.py',
                'app/config.py',
                '.env',
                'README.md',
                'Dockerfile',
                'docker-compose.yml'
            );
        }

        // Flask Project patterns (ENHANCED)
        if (promptLower.includes('flask')) {
            files.push(
                'app.py',
                'requirements.txt',
                'config.py',
                'models.py',
                'routes.py',
                'templates/base.html',
                'templates/index.html',
                'static/css/style.css',
                'static/js/script.js',
                '.env',
                'README.md'
            );
        }

        // Frontend patterns (ENHANCED)
        if (promptLower.includes('react') || (promptLower.includes('component') && promptLower.includes('react'))) {
            files.push(
                'src/App.jsx',
                'src/index.js',
                'src/components/Header.jsx',
                'src/components/Footer.jsx',
                'src/pages/Home.jsx',
                'src/styles/App.css',
                'src/styles/index.css',
                'public/index.html',
                'package.json',
                'README.md',
                '.gitignore',
                '.env'
            );
        } else if (promptLower.includes('component') && !promptLower.includes('react')) {
            files.push('Component.jsx', 'Component.css', 'index.js');
        }
        
        if (promptLower.includes('vue')) {
            files.push(
                'src/App.vue',
                'src/main.js',
                'src/components/HelloWorld.vue',
                'src/components/Header.vue',
                'src/router/index.js',
                'src/store/index.js',
                'package.json',
                'vue.config.js',
                'README.md'
            );
        }
        
        if (promptLower.includes('angular')) {
            files.push(
                'src/app/app.component.ts',
                'src/app/app.module.ts',
                'src/app/app.component.html',
                'src/app/app.component.css',
                'src/main.ts',
                'package.json',
                'angular.json',
                'tsconfig.json',
                'README.md'
            );
        }

        // Backend patterns (ENHANCED - if not already covered by server/api)
        if (!files.length && (promptLower.includes('express') || promptLower.includes('node'))) {
            files.push(
                'server.js',
                'package.json',
                'routes/index.js',
                'routes/users.js',
                'middleware/auth.js',
                'models/User.js',
                'config/database.js',
                'controllers/userController.js',
                '.env',
                'README.md',
                '.gitignore'
            );
        }
        if (!files.length && (promptLower.includes('python') && !promptLower.includes('fastapi') && !promptLower.includes('flask') && !promptLower.includes('django'))) {
            files.push('main.py', 'requirements.txt', 'config.py', 'utils.py', 'README.md');
        }

        // Database patterns
        if (promptLower.includes('database') || promptLower.includes('schema')) {
            if (promptLower.includes('python')) {
                files.push('models.py', 'database.py');
            } else {
                files.push('schema.sql', 'models.js');
            }
        }

        // Configuration patterns
        if (promptLower.includes('config')) {
            if (promptLower.includes('python')) {
                files.push('config.py');
            } else {
                files.push('config.js');
            }
        }

        // Handler/Controller patterns
        if (promptLower.includes('handler') || promptLower.includes('controller')) {
            if (promptLower.includes('python')) {
                files.push('handlers.py');
            } else {
                files.push('handlers.js');
            }
        }

        // Utility patterns
        if (promptLower.includes('utility') || promptLower.includes('utils') || promptLower.includes('helper')) {
            if (promptLower.includes('python')) {
                files.push('utils.py');
            } else {
                files.push('utils.js');
            }
        }

        // Fallback patterns based on technology hints
        if (files.length === 0) {
            if (promptLower.includes('python')) {
                files.push('main.py', 'requirements.txt');
            } else if (promptLower.includes('react')) {
                files.push('App.jsx', 'index.js');
            } else {
                files.push('index.js', 'package.json'); // Default to Node.js
            }
        }

        return files;
    }

    private generateEnhancedPrompt(fileName: string, originalPrompt: string): string {
        const promptLower = originalPrompt.toLowerCase();
        const fileExt = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, fileExt);
        
        // Django-specific prompts
        if (promptLower.includes('django')) {
            if (fileName === 'manage.py') {
                return `Generate ONLY clean Python code for a Django manage.py file with proper Django project setup. Include all necessary imports and standard Django management commands. Make it production-ready with error handling. Return executable Python code without any markdown formatting or explanations.`;
            }
            if (fileName.includes('settings.py')) {
                return `Generate ONLY clean Python code for a comprehensive Django settings.py file with:
- Database configuration (SQLite for development, PostgreSQL for production)  
- Static files configuration
- Security settings (SECRET_KEY, ALLOWED_HOSTS, CSRF, etc.)
- Installed apps including the custom app
- Middleware configuration
- Internationalization settings
- Email configuration
- Logging configuration
Return executable Python code without markdown formatting. Make it production-ready and well-documented with inline comments.`;
            }
            if (fileName.includes('models.py')) {
                return `Generate ONLY clean Python code for Django models.py with sample models demonstrating:
- Proper field types and relationships
- Meta classes with ordering and verbose names
- __str__ methods
- Custom methods and properties
- Proper imports
Follow Django best practices and include comprehensive docstrings. Return executable Python code without markdown formatting.`;
            }
            if (fileName.includes('views.py')) {
                return `Generate ONLY clean Python code for Django views.py with:
- Function-based and class-based views
- Proper imports (render, redirect, HttpResponse)
- Error handling and validation
- Authentication decorators
- RESTful patterns
- Comprehensive docstrings
Follow Django best practices for production code. Return executable Python code without markdown formatting.`;
            }
            if (fileName.includes('urls.py')) {
                return `Generate ONLY clean Python code for Django URLs configuration with:
- Proper URL patterns
- Named URLs for reverse lookup
- Include statements for app URLs
- Namespace configuration
- Error handling views (404, 500)
Follow Django URL naming conventions. Return executable Python code without markdown formatting.`;
            }
            if (fileName.includes('admin.py')) {
                return `Generate ONLY clean Python code for Django admin.py with:
- Model registrations
- Custom admin classes with list_display, list_filter, search_fields
- Inline admin classes
- Custom admin actions
- Proper imports
Make it user-friendly and production-ready. Return executable Python code without markdown formatting.`;
            }
        }

        // FastAPI-specific prompts
        if (promptLower.includes('fastapi')) {
            if (fileName === 'main.py') {
                return `Generate ONLY clean Python code for FastAPI main.py with:
- FastAPI app initialization
- CORS middleware setup
- Router inclusions
- Error handling
- API documentation setup
- Health check endpoint
- Production-ready configuration
Return executable Python code without markdown formatting. Include comprehensive docstrings and type hints.`;
            }
            if (fileName.includes('models.py')) {
                return `Generate ONLY clean Python code for Pydantic models for FastAPI with:
- Base model classes
- Request/Response models
- Data validation
- Proper type hints
- Example models for users, items
- Configuration classes
Follow FastAPI and Pydantic best practices. Return executable Python code without markdown formatting.`;
            }
        }

        // React-specific prompts
        if (promptLower.includes('react')) {
            if (fileName.includes('App.jsx')) {
                return `Generate ONLY clean JavaScript/JSX code for React App.jsx component with:
- Modern functional component using hooks
- Router setup with multiple routes
- State management
- Error boundaries
- Responsive design
- Production-ready structure
- Comprehensive comments
Follow React best practices and modern patterns. Return executable JSX code without markdown formatting.`;
            }
            if (fileName.includes('package.json')) {
                return `Generate ONLY clean JSON for React package.json with:
- All necessary React dependencies
- Development dependencies (testing, linting)
- Build scripts for development and production
- Proper versioning
- ESLint and Prettier configuration
- Security audit scripts
Make it production-ready. Return valid JSON without markdown formatting.`;
            }
        }

        // Express/Node.js prompts
        if (promptLower.includes('express') || promptLower.includes('node')) {
            if (fileName === 'server.js' || fileName === 'app.js') {
                return `Generate ONLY clean JavaScript code for Express.js server with:
- Express app setup with middleware
- CORS configuration
- Body parsing
- Route handling
- Error handling middleware
- Security middleware (helmet, rate limiting)
- Database connection
- Environment configuration
- Graceful shutdown handling
Make it production-ready with comprehensive logging. Return executable JavaScript code without markdown formatting.`;
            }
        }

        // Generic file-based prompts
        if (fileExt === '.py') {
            return `Generate ONLY clean Python code for ${fileName} with:
- Proper imports and dependencies
- Class/function definitions with docstrings
- Type hints where appropriate
- Error handling
- Configuration management
- Logging setup
- Follow PEP 8 standards
Context: ${originalPrompt}
Return executable Python code without markdown formatting.`;
        }
        
        if (fileExt === '.js' || fileExt === '.jsx') {
            return `Generate ONLY clean JavaScript/JSX code for ${fileName} with:
- Modern ES6+ syntax
- Proper imports/exports
- Component/function definitions
- Error handling
- JSDoc comments
- Performance optimizations
- Accessibility considerations
Context: ${originalPrompt}
Return executable JavaScript code without markdown formatting.`;
        }

        if (fileName === 'README.md') {
            return `Generate ONLY clean Markdown for comprehensive README.md for this ${promptLower.includes('django') ? 'Django' : promptLower.includes('react') ? 'React' : promptLower.includes('express') ? 'Express' : ''} project including:
- Project description and features
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Development setup
- Testing instructions
- Deployment guide
- Contributing guidelines
- License information
Make it professional and detailed. Return clean markdown without code blocks.`;
        }

        if (fileName === 'requirements.txt' || fileName === 'package.json') {
            return `Generate ONLY clean ${fileName === 'requirements.txt' ? 'requirements.txt format' : 'JSON'} for ${fileName} with all necessary dependencies for a professional ${promptLower.includes('django') ? 'Django' : promptLower.includes('fastapi') ? 'FastAPI' : promptLower.includes('flask') ? 'Flask' : 'Python'} project including:
- Core framework dependencies
- Database drivers
- Security packages
- Testing frameworks
- Development tools
- Production deployment tools
Include version pinning for production stability. Return clean ${fileName === 'requirements.txt' ? 'text' : 'JSON'} without markdown formatting.`;
        }

        // Default enhanced prompt
        return `Generate ONLY clean, executable code for ${fileName} file for a ${promptLower.includes('django') ? 'Django' : promptLower.includes('react') ? 'React' : promptLower.includes('express') ? 'Express' : promptLower.includes('fastapi') ? 'FastAPI' : 'web'} project. 

Requirements:
- Generate clean code without markdown formatting or explanations
- Follow industry best practices and coding standards
- Include comprehensive inline documentation and comments
- Implement proper error handling and validation
- Ensure security considerations are addressed
- Make it maintainable and scalable
- Include all necessary imports and dependencies
- Return executable code only

Original context: ${originalPrompt}`;
    }

    private getFilePriority(fileName: string): number {
        // Configuration and setup files (highest priority)
        if (fileName.includes('package.json') || fileName.includes('requirements.txt') || 
            fileName.includes('settings.py') || fileName === 'manage.py') {
            return 10;
        }
        
        // Core application files
        if (fileName.includes('main.py') || fileName.includes('app.js') || 
            fileName.includes('server.js') || fileName.includes('App.jsx')) {
            return 9;
        }
        
        // Models and database
        if (fileName.includes('models.py') || fileName.includes('database.py') || 
            fileName.includes('schema.')) {
            return 8;
        }
        
        // Views, routes, and controllers
        if (fileName.includes('views.py') || fileName.includes('routes') || 
            fileName.includes('controller')) {
            return 7;
        }
        
        // Components and pages
        if (fileName.includes('component') || fileName.includes('pages/') || 
            fileName.includes('Component.jsx')) {
            return 6;
        }
        
        // Static files and assets
        if (fileName.includes('static/') || fileName.includes('css') || 
            fileName.includes('js') || fileName.includes('html')) {
            return 4;
        }
        
        // Documentation and config
        if (fileName.includes('README') || fileName.includes('.env') || 
            fileName.includes('config')) {
            return 3;
        }
        
        // Default priority
        return 5;
    }

    private async createExecutionPlan(operations: FileOperation[]): Promise<FileOperation[]> {
        // Assign agents based on specialization
        for (const operation of operations) {
            operation.assignedAgent = this.assignOptimalAgent(operation);
        }

        // Detect dependencies and conflicts
        this.detectDependencies(operations);
        const conflicts = this.detectConflicts(operations);

        // Resolve conflicts
        const resolvedOps = await this.resolveConflicts(operations, conflicts);

        // Sort by priority and dependencies
        return this.optimizeExecutionOrder(resolvedOps);
    }

    private assignOptimalAgent(operation: FileOperation): string {
        // Use the smart assignment system
        const recommendations = this.assignmentSystem.getAgentRecommendations(
            operation.fileName, 
            operation.prompt
        );
        
        // Check if primary agent is available
        const primaryAgent = this.agents.get(recommendations.primary);
        if (primaryAgent && primaryAgent.status === 'idle') {
            return recommendations.primary;
        }
        
        // Try alternatives
        for (const alt of recommendations.alternatives) {
            const altAgent = this.agents.get(alt.agent);
            if (altAgent && altAgent.status === 'idle') {
                return alt.agent;
            }
        }
        
        // Fallback to original logic
        const fileExt = path.extname(operation.fileName).toLowerCase().slice(1);
        const fileName = operation.fileName.toLowerCase();
        const prompt = operation.prompt.toLowerCase();

        let bestAgent = '';
        let bestScore = 0;

        for (const [agentId, agent] of this.agents) {
            let score = 0;

            // Check specialization match
            for (const spec of agent.specialization) {
                if (fileExt === spec || fileName.includes(spec) || prompt.includes(spec)) {
                    score += 10;
                }
            }

            // Priority bonus
            score += agent.priority;

            // Availability bonus
            if (agent.status === 'idle') {
                score += 5;
            }

            // Load balancing - prefer less busy agents
            score -= (agent.workingOn?.length || 0) * 2;

            if (score > bestScore) {
                bestScore = score;
                bestAgent = agentId;
            }
        }

        // Ensure we have a valid fallback agent
        if (!bestAgent && this.agents.size > 0) {
            // Get any available agent as fallback
            const availableAgent = Array.from(this.agents.entries())
                .find(([_, agent]) => agent.status === 'idle');
            if (availableAgent) {
                bestAgent = availableAgent[0];
            } else {
                // Get any agent if none are idle
                bestAgent = Array.from(this.agents.keys())[0];
            }
        }

        return bestAgent || 'node-specialist'; // final fallback
    }

    private detectDependencies(operations: FileOperation[]) {
        for (const op of operations) {
            const deps: string[] = [];
            const fileName = op.fileName.toLowerCase();
            
            // Django-specific dependencies
            if (fileName.includes('django') || operations.some(o => o.fileName === 'manage.py')) {
                if (fileName.includes('models.py')) {
                    // Models depend on settings
                    const settingsFile = operations.find(o => o.fileName.includes('settings.py'));
                    if (settingsFile) {deps.push(settingsFile.fileName);}
                } else if (fileName.includes('views.py')) {
                    // Views depend on models
                    const modelsFile = operations.find(o => o.fileName.includes('models.py'));
                    if (modelsFile) {deps.push(modelsFile.fileName);}
                } else if (fileName.includes('admin.py')) {
                    // Admin depends on models
                    const modelsFile = operations.find(o => o.fileName.includes('models.py'));
                    if (modelsFile) {deps.push(modelsFile.fileName);}
                } else if (fileName.includes('urls.py') && !fileName.includes('myproject')) {
                    // App URLs depend on views
                    const viewsFile = operations.find(o => o.fileName.includes('views.py'));
                    if (viewsFile) {deps.push(viewsFile.fileName);}
                }
            }

            // FastAPI dependencies
            if (fileName.includes('fastapi') || operations.some(o => o.fileName === 'main.py' && o.prompt.toLowerCase().includes('fastapi'))) {
                if (fileName.includes('routers/')) {
                    // Routers depend on models and schemas
                    const modelsFile = operations.find(o => o.fileName.includes('models.py'));
                    const schemasFile = operations.find(o => o.fileName.includes('schemas.py'));
                    if (modelsFile) {deps.push(modelsFile.fileName);}
                    if (schemasFile) {deps.push(schemasFile.fileName);}
                } else if (fileName.includes('crud.py')) {
                    // CRUD depends on models and schemas
                    const modelsFile = operations.find(o => o.fileName.includes('models.py'));
                    const schemasFile = operations.find(o => o.fileName.includes('schemas.py'));
                    if (modelsFile) {deps.push(modelsFile.fileName);}
                    if (schemasFile) {deps.push(schemasFile.fileName);}
                }
            }

            // React dependencies
            if (fileName.includes('react') || operations.some(o => o.fileName.includes('App.jsx'))) {
                if (fileName.includes('components/') && !fileName.includes('App.jsx')) {
                    // Components might depend on shared utilities
                    const utilsFile = operations.find(o => o.fileName.includes('utils') || o.fileName.includes('helpers'));
                    if (utilsFile) {deps.push(utilsFile.fileName);}
                }
            }

            // Express/Node.js dependencies
            if (fileName.includes('routes/') || fileName.includes('controllers/')) {
                // Routes and controllers depend on models
                const modelsFile = operations.find(o => o.fileName.includes('models/') || (o.fileName.includes('model') && !o.fileName.includes('routes')));
                if (modelsFile) {deps.push(modelsFile.fileName);}
            }

            // Common dependency patterns
            if (fileName.includes('test') || fileName.includes('spec')) {
                // Tests depend on main files
                const mainFile = operations.find(o => 
                    !o.fileName.toLowerCase().includes('test') && 
                    !o.fileName.toLowerCase().includes('spec') &&
                    path.extname(o.fileName) === path.extname(op.fileName)
                );
                if (mainFile) {deps.push(mainFile.fileName);}
            }

            // Template dependencies
            if (fileName.includes('templates/') && !fileName.includes('base.html')) {
                // Templates depend on base template
                const baseTemplate = operations.find(o => o.fileName.includes('base.html'));
                if (baseTemplate) {deps.push(baseTemplate.fileName);}
            }

            // Static file dependencies
            if (fileName.includes('static/css') || fileName.includes('static/js')) {
                // Static files should be created after main structure
                const mainFiles = operations.filter(o => 
                    o.fileName.includes('views.py') || 
                    o.fileName.includes('App.jsx') || 
                    o.fileName.includes('main.py')
                );
                mainFiles.forEach(f => deps.push(f.fileName));
            }

            // Priority adjustments
            if (fileName.includes('config') && !fileName.includes('webpack')) {
                op.priority += 2;
            }

            if (fileName === 'package.json' || fileName === 'requirements.txt' || fileName === 'manage.py') {
                op.priority += 5;
            }

            if (fileName.includes('settings.py')) {
                op.priority += 4;
            }

            op.dependencies = [...new Set([...op.dependencies, ...deps])]; // Remove duplicates
        }
    }

    private detectConflicts(operations: FileOperation[]): ConflictResolution[] {
        const conflicts: ConflictResolution[] = [];

        // File lock conflicts
        const fileGroups = new Map<string, FileOperation[]>();
        for (const op of operations) {
            if (!fileGroups.has(op.fileName)) {
                fileGroups.set(op.fileName, []);
            }
            fileGroups.get(op.fileName)!.push(op);
        }

        for (const [fileName, ops] of fileGroups) {
            if (ops.length > 1) {
                conflicts.push({
                    conflictType: 'file-lock',
                    files: [fileName],
                    agents: ops.map(op => op.assignedAgent),
                    resolution: 'queue',
                    strategy: 'Sequential execution on same file'
                });
            }
        }

        // Agent overload conflicts
        const agentLoad = new Map<string, FileOperation[]>();
        for (const op of operations) {
            if (!agentLoad.has(op.assignedAgent)) {
                agentLoad.set(op.assignedAgent, []);
            }
            agentLoad.get(op.assignedAgent)!.push(op);
        }

        for (const [agentId, ops] of agentLoad) {
            if (ops.length > this.maxConcurrentOperations) {
                conflicts.push({
                    conflictType: 'agent-busy',
                    files: ops.map(op => op.fileName),
                    agents: [agentId],
                    resolution: 'queue',
                    strategy: 'Batch operations for overloaded agent'
                });
            }
        }

        return conflicts;
    }

    private async resolveConflicts(operations: FileOperation[], conflicts: ConflictResolution[]): Promise<FileOperation[]> {
        let resolvedOps = [...operations];

        for (const conflict of conflicts) {
            switch (conflict.conflictType) {
                case 'file-lock':
                    // Ensure sequential execution for same file
                    const fileOps = resolvedOps.filter(op => conflict.files.includes(op.fileName));
                    fileOps.sort((a, b) => {
                        // Create operations before edit operations
                        if (a.operation === 'create' && b.operation === 'edit') {return -1;}
                        if (a.operation === 'edit' && b.operation === 'create') {return 1;}
                        return a.priority - b.priority;
                    });
                    
                    // Add dependencies to ensure sequential execution
                    for (let i = 1; i < fileOps.length; i++) {
                        fileOps[i].dependencies.push(fileOps[i-1].fileName);
                    }
                    break;

                case 'agent-busy':
                    // Redistribute operations among available agents
                    const busyAgent = conflict.agents[0];
                    const agentOps = resolvedOps.filter(op => op.assignedAgent === busyAgent);
                    
                    // Keep high priority operations with original agent
                    const highPriorityOps = agentOps.filter(op => op.priority >= 7);
                    const lowPriorityOps = agentOps.filter(op => op.priority < 7);
                    
                    // Reassign low priority operations
                    for (const op of lowPriorityOps) {
                        const altAgent = this.findAlternativeAgent(op, busyAgent);
                        if (altAgent) {
                            op.assignedAgent = altAgent;
                        }
                    }
                    break;
            }
        }

        // Store conflict resolutions for learning
        this.conflictHistory.push(...conflicts);

        return resolvedOps;
    }

    private findAlternativeAgent(operation: FileOperation, excludeAgent: string): string | null {
        const fileExt = path.extname(operation.fileName).toLowerCase().slice(1);
        
        for (const [agentId, agent] of this.agents) {
            if (agentId === excludeAgent) {continue;}
            
            // Check if agent can handle this file type
            if (agent.specialization.some(spec => 
                spec === fileExt || 
                operation.fileName.toLowerCase().includes(spec) || 
                operation.prompt.toLowerCase().includes(spec)
            )) {
                return agentId;
            }
        }
        
        return null;
    }

    private optimizeExecutionOrder(operations: FileOperation[]): FileOperation[] {
        // Topological sort based on dependencies and priorities
        const sorted: FileOperation[] = [];
        const visited = new Set<string>();
        const temp = new Set<string>();

        const visit = (op: FileOperation) => {
            if (temp.has(op.id)) {
                throw new Error(`Circular dependency detected involving ${op.fileName}`);
            }
            if (visited.has(op.id)) {return;}

            temp.add(op.id);
            
            // Visit dependencies first
            for (const depFileName of op.dependencies) {
                const depOp = operations.find(o => o.fileName === depFileName);
                if (depOp) {
                    visit(depOp);
                }
            }
            
            temp.delete(op.id);
            visited.add(op.id);
            sorted.push(op);
        };

        // Sort by priority first
        const prioritySorted = operations.sort((a, b) => b.priority - a.priority);
        
        for (const op of prioritySorted) {
            if (!visited.has(op.id)) {
                visit(op);
            }
        }

        return sorted;
    }

    private async executeCoordinatedOperations(operations: FileOperation[]): Promise<Map<string, any>> {
        const results = new Map<string, any>();
        const activeOperations = new Set<string>();

        // Initialize operation tracking
        for (const op of operations) {
            this.operations.set(op.id, op);
        }

        this.sendCoordinationUpdate('🚀 **Smart Agent Coordination Started**', operations.length);

        for (const operation of operations) {
            // Wait for dependencies
            await this.waitForDependencies(operation, results);
            
            // Check agent availability and file locks
            await this.waitForResources(operation, activeOperations);
            
            // Execute operation
            try {
                operation.status = 'in-progress';
                operation.startTime = new Date();
                activeOperations.add(operation.fileName);
                
                // Update agent status
                const agent = this.agents.get(operation.assignedAgent);
                if (agent) {
                    agent.status = 'working';
                    agent.currentTask = operation.prompt;
                    agent.workingOn = agent.workingOn || [];
                    agent.workingOn.push(operation.fileName);
                }

                this.sendOperationUpdate(operation, 'started');
                
                const result = await this.executeOperation(operation);
                
                operation.status = 'completed';
                operation.completionTime = new Date();
                results.set(operation.fileName, result);
                
                this.sendOperationUpdate(operation, 'completed');
                
            } catch (error: any) {
                operation.status = 'error';
                operation.retryCount++;
                
                // Retry logic
                if (operation.retryCount < 2) {
                    operation.status = 'queued';
                    this.sendOperationUpdate(operation, 'retrying');
                } else {
                    results.set(operation.fileName, { error: error.message });
                    this.sendOperationUpdate(operation, 'failed');
                }
            } finally {
                // Clean up resources
                activeOperations.delete(operation.fileName);
                this.fileLocks.delete(operation.fileName);
                
                const agent = this.agents.get(operation.assignedAgent);
                if (agent) {
                    agent.status = 'idle';
                    agent.currentTask = undefined;
                    agent.workingOn = agent.workingOn?.filter(f => f !== operation.fileName) || [];
                }
            }
        }

        this.sendCoordinationUpdate('✅ **All Operations Completed**', results.size);
        return results;
    }

    private async waitForDependencies(operation: FileOperation, results: Map<string, any>) {
        for (const depFile of operation.dependencies) {
            while (!results.has(depFile)) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    private async waitForResources(operation: FileOperation, activeOperations: Set<string>) {
        // Wait for file lock
        while (this.fileLocks.has(operation.fileName)) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Wait for agent availability
        const agent = this.agents.get(operation.assignedAgent);
        while (agent && agent.status !== 'idle') {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Acquire locks
        this.fileLocks.set(operation.fileName, operation.assignedAgent);
    }

    private async executeOperation(operation: FileOperation): Promise<any> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder');
        }

        const filePath = path.join(workspaceFolder.uri.fsPath, operation.fileName);
        const agent = this.agents.get(operation.assignedAgent);
        
        // Try to use extension-specific agent first
        const extensionAgent = this.extensionRegistry.getAgentForFile(operation.fileName);
        const context = this.extensionRegistry.getProjectContext();
        
        if (extensionAgent && context) {
            try {
                const startTime = Date.now();
                let result;
                
                if (operation.operation === 'create' && typeof extensionAgent.createFile === 'function') {
                    result = await extensionAgent.createFile(operation.fileName, operation.prompt, context);
                    if (result.success && result.content) {
                        // Ensure directory exists
                        const dir = path.dirname(filePath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                        fs.writeFileSync(filePath, result.content);
                        
                        // Open file in editor
                        const uri = vscode.Uri.file(filePath);
                        await vscode.window.showTextDocument(uri);
                        
                        return {
                            fileName: operation.fileName,
                            linesCreated: result.metadata.linesCount,
                            agent: extensionAgent.name,
                            patterns: result.metadata.patterns,
                            dependencies: result.metadata.dependencies
                        };
                    }
                } else if (operation.operation === 'edit'  && typeof extensionAgent.editFile === 'function') {
                    let existingContent = '';
                    try {
                        existingContent = fs.readFileSync(filePath, 'utf8');
                    } catch (error) {
                        // File doesn't exist, treat as create
                        return await this.executeOperation({...operation, operation: 'create'});
                    }
                    
                    result = await extensionAgent.editFile(operation.fileName, existingContent, operation.prompt, context);
                    if (result.success && result.content) {
                        fs.writeFileSync(filePath, result.content);
                        return {
                            fileName: operation.fileName,
                            linesChanged: Math.abs(result.metadata.linesCount - existingContent.split('\n').length),
                            agent: extensionAgent.name,
                            patterns: result.metadata.patterns
                        };
                    }
                }
                
                // Update performance metrics
                const executionTime = Date.now() - startTime;
                this.assignmentSystem.updatePerformanceMetrics(
                    operation.assignedAgent, 
                    result?.success || false, 
                    executionTime
                );
                
                if (result?.success) {
                    return result;
                } else {
                    throw new Error(result?.error || 'Extension agent operation failed');
                }
                
            } catch (error) {
                console.warn(`Extension agent ${extensionAgent.name} failed, falling back to coordinator:`, error);
                // Fall through to original coordinator logic
            }
        }
        
        // Fallback to original coordinator logic
        const operationId = `${operation.assignedAgent}-${Date.now()}`;
        
        return await this.conflictPrevention.safeFileOperation(
            operation.fileName,
            operationId,
            async () => {
                const startTime = Date.now();
                
                try {
                    let result;
                    if (operation.operation === 'create') {
                        result = await this.createFile(filePath, operation, agent);
                    } else if (operation.operation === 'edit') {
                        result = await this.editFile(filePath, operation, agent);
                    } else {
                        throw new Error(`Unknown operation: ${operation.operation}`);
                    }
                    
                    // Update performance metrics
                    const executionTime = Date.now() - startTime;
                    this.assignmentSystem.updatePerformanceMetrics(
                        operation.assignedAgent, 
                        true, 
                        executionTime
                    );
                    
                    return result;
                } catch (error) {
                    // Update performance metrics for failure
                    const executionTime = Date.now() - startTime;
                    this.assignmentSystem.updatePerformanceMetrics(
                        operation.assignedAgent, 
                        false, 
                        executionTime
                    );
                    throw error;
                } finally {
                    // Release agent
                    this.assignmentSystem.releaseAgent(operation.assignedAgent);
                }
            },
            operation.dependencies
        );
    }

    private async createFile(filePath: string, operation: FileOperation, agent?: Agent): Promise<any> {
        const enhancedPrompt = `You are a ${agent?.name || 'General'} specializing in: ${agent?.specialization.join(', ') || 'general development'}.

Create ${operation.fileName} with the following requirements:
${operation.prompt}

Guidelines:
- Generate ONLY clean, executable code without markdown formatting
- Follow best practices for ${path.extname(operation.fileName).slice(1)} files
- Include appropriate comments and documentation within the code
- Ensure code is production-ready and well-structured
- Consider integration with other project files
- Do NOT wrap code in markdown code blocks
- Return pure code content only`;

        const aiResponse = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
        
        // Extract clean code and explanation
        const { code, explanation } = this.extractCodeContent(aiResponse, operation.fileName);
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write only clean code to file
        fs.writeFileSync(filePath, code);
        
        // Send explanation to chat
        await this.sendExplanationToChat(explanation, operation.fileName, agent?.name || 'General');
        
        // Open file in editor
        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
        
        return {
            fileName: operation.fileName,
            linesCreated: code.split('\n').length,
            agent: agent?.name || 'General'
        };
    }

    private async editFile(filePath: string, operation: FileOperation, agent?: Agent): Promise<any> {
        let existingContent = '';
        
        try {
            existingContent = fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            // File doesn't exist, create it instead
            return await this.createFile(filePath, operation, agent);
        }
        
        const enhancedPrompt = `You are a ${agent?.name || 'General'} specializing in: ${agent?.specialization.join(', ') || 'general development'}.

Edit ${operation.fileName} according to the following requirements:
${operation.prompt}

Current file content:
${existingContent}

Guidelines:
- Generate ONLY clean, executable code without markdown formatting
- Maintain existing functionality while implementing changes
- Follow best practices for ${path.extname(operation.fileName).slice(1)} files
- Preserve important comments and structure
- Return the complete updated file content
- Do NOT wrap code in markdown code blocks
- Return pure code content only`;

        const aiResponse = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
        
        // Extract clean code and explanation
        const { code, explanation } = this.extractCodeContent(aiResponse, operation.fileName);
        
        // Write only clean code to file
        fs.writeFileSync(filePath, code);
        
        // Send explanation to chat
        await this.sendExplanationToChat(explanation, operation.fileName, agent?.name || 'General');
        
        // Open updated file in editor
        const uri = vscode.Uri.file(filePath);
        await vscode.window.showTextDocument(uri);
        
        return {
            fileName: operation.fileName,
            linesChanged: Math.abs(code.split('\n').length - existingContent.split('\n').length),
            agent: agent?.name || 'General'
        };
    }

    private sendCoordinationUpdate(message: string, count: number) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'coordinationUpdate',
                message,
                count
            });
        }
    }

    private sendOperationUpdate(operation: FileOperation, status: string) {
        if (this.webviewView) {
            const agent = this.agents.get(operation.assignedAgent);
            this.webviewView.webview.postMessage({
                type: 'operationUpdate',
                operation: {
                    fileName: operation.fileName,
                    status,
                    agent: agent?.name || 'General',
                    operation: operation.operation
                }
            });
        }
    }

    private formatResults(results: Map<string, any>): string {
        const successful = Array.from(results.entries()).filter(([_, result]) => !result.error);
        const failed = Array.from(results.entries()).filter(([_, result]) => result.error);
        
        let message = `🎯 **Smart Multi-Agent Results:**\n\n`;
        
        if (successful.length > 0) {
            message += `✅ **Successfully processed ${successful.length} files:**\n`;
            successful.forEach(([fileName, result]) => {
                message += `  • ${fileName} (${result.agent}) - ${result.linesCreated || result.linesChanged || 0} lines\n`;
            });
        }
        
        if (failed.length > 0) {
            message += `\n❌ **Failed operations (${failed.length}):**\n`;
            failed.forEach(([fileName, result]) => {
                message += `  • ${fileName}: ${result.error}\n`;
            });
        }
        
        // Add coordination statistics
        const totalOperations = this.operations.size;
        const conflicts = this.conflictHistory.length;
        
        message += `\n📊 **Coordination Stats:**\n`;
        message += `  • Total operations: ${totalOperations}\n`;
        message += `  • Conflicts resolved: ${conflicts}\n`;
        message += `  • Agents utilized: ${new Set(Array.from(this.operations.values()).map(op => op.assignedAgent)).size}\n`;
        
        return message;
    }

    getAgentStatus(): Map<string, Agent> {
        return new Map(this.agents);
    }

    getActiveOperations(): Map<string, FileOperation> {
        return new Map(Array.from(this.operations.entries()).filter(([_, op]) => op.status === 'in-progress'));
    }

    getConflictHistory(): ConflictResolution[] {
        return [...this.conflictHistory];
    }

    clearOperationHistory() {
        this.operations.clear();
        this.conflictHistory.splice(0);
        this.fileLocks.clear();
        
        // Reset agent status
        for (const agent of this.agents.values()) {
            agent.status = 'idle';
            agent.currentTask = undefined;
            agent.workingOn = [];
        }
    }

    // Method for enhanced sidebar compatibility
    public async assignBestAgent(file: any): Promise<any> {
        const fileExt = file.fileName.split('.').pop()?.toLowerCase() || '';
        const content = `${file.fileName} ${file.prompt} ${file.language || ''}`.toLowerCase();

        // Define available agents with their specializations
        const agents = [
            {
                name: 'Frontend Specialist',
                specialization: ['javascript', 'typescript', 'html', 'css', 'react', 'vue', 'angular'],
                model: 'llama-3.3-70b-versatile',
                priority: 8,
                enhancedPrompt: 'As a Frontend Specialist, create clean, modern, and responsive frontend code with best practices.'
            },
            {
                name: 'Backend Specialist',
                specialization: ['python', 'java', 'go', 'rust', 'php', 'node', 'express', 'fastapi'],
                model: 'llama-3.3-70b-versatile',
                priority: 8,
                enhancedPrompt: 'As a Backend Specialist, create robust, scalable server-side code with proper error handling and security.'
            },
            {
                name: 'Database Specialist',
                specialization: ['sql', 'mongodb', 'database', 'schema', 'migration', 'orm'],
                model: 'llama-3.3-70b-versatile',
                priority: 7,
                enhancedPrompt: 'As a Database Specialist, create efficient database schemas and queries with data integrity considerations.'
            },
            {
                name: 'DevOps Specialist',
                specialization: ['docker', 'kubernetes', 'yaml', 'json', 'config', 'deployment', 'ci', 'cd'],
                model: 'llama-3.3-70b-versatile',
                priority: 6,
                enhancedPrompt: 'As a DevOps Specialist, create deployment configurations and infrastructure code following best practices.'
            },
            {
                name: 'Mobile Specialist',
                specialization: ['react-native', 'flutter', 'swift', 'kotlin', 'mobile', 'ios', 'android'],
                model: 'llama-3.3-70b-versatile',
                priority: 7,
                enhancedPrompt: 'As a Mobile Specialist, create mobile-optimized code with platform-specific considerations.'
            },
            {
                name: 'Security Specialist',
                specialization: ['security', 'auth', 'authentication', 'authorization', 'encryption', 'jwt'],
                model: 'llama-3.3-70b-versatile',
                priority: 9,
                enhancedPrompt: 'As a Security Specialist, create secure code with proper authentication, authorization, and data protection.'
            }
        ];

        // Find the best matching agent
        for (const agent of agents) {
            if (agent.specialization.some(spec => content.includes(spec) || fileExt === spec)) {
                return agent;
            }
        }

        // Default to frontend specialist if no specific match
        return agents[0];
    }

    // Static methods for backward compatibility
    static async processMultiAgentCommand(prompt: string): Promise<string> {
        const coordinator = SmartAgentCoordinator.getInstance();
        return await coordinator.processMultiAgentRequest(prompt);
    }

    static setWebviewView(view: vscode.WebviewView) {
        const coordinator = SmartAgentCoordinator.getInstance();
        coordinator.setWebviewView(view);
    }
}