import * as vscode from 'vscode';
import { callAI } from './codegenerator';

interface QueryResult {
    intent: string;
    action: string;
    parameters: any;
    confidence: number;
    response?: string;
}

export class NaturalLanguageInterface {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private conversationHistory: Array<{ query: string; result: QueryResult }> = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('NL Interface');
    }

    /**
     * Process natural language query
     */
    async processQuery(query: string): Promise<QueryResult> {
        try {
            // Detect intent using AI
            const intent = await this.detectIntent(query);
            
            // Execute appropriate action
            const result = await this.executeAction(intent);
            
            // Store in conversation history
            this.conversationHistory.push({ query, result });
            
            return result;
        } catch (error) {
            this.outputChannel.appendLine(`Error processing query: ${error}`);
            throw error;
        }
    }

    /**
     * Detect user intent from natural language
     */
    private async detectIntent(query: string): Promise<QueryResult> {
        const prompt = `Analyze this natural language query from a developer and determine the intent and action to perform:

Query: "${query}"

Available actions:
- find_memory_leaks: Scan code for memory leaks
- find_security_issues: Scan for security vulnerabilities  
- refactor_module: Refactor code to use specific patterns
- optimize_performance: Analyze and optimize performance
- generate_tests: Generate unit tests
- explain_code: Explain code functionality
- find_bugs: Find potential bugs
- migrate_code: Migrate to new framework/library
- analyze_dependencies: Analyze project dependencies
- generate_docs: Generate documentation
- fix_errors: Fix compilation/runtime errors
- improve_code_quality: Suggest code quality improvements

Return JSON:
{
    "intent": "what user wants",
    "action": "action_name",
    "parameters": {
        "target": "file/module/function",
        "options": {}
    },
    "confidence": 0.95
}`;

        const response = await callAI(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return {
            intent: 'unknown',
            action: 'help',
            parameters: {},
            confidence: 0
        };
    }

    /**
     * Execute the determined action
     */
    private async executeAction(intent: QueryResult): Promise<QueryResult> {
        const { action, parameters } = intent;

        try {
            switch (action) {
                case 'find_memory_leaks':
                    return await this.findMemoryLeaks(parameters);
                
                case 'find_security_issues':
                    return await this.findSecurityIssues(parameters);
                
                case 'refactor_module':
                    return await this.refactorModule(parameters);
                
                case 'optimize_performance':
                    return await this.optimizePerformance(parameters);
                
                case 'generate_tests':
                    return await this.generateTests(parameters);
                
                case 'explain_code':
                    return await this.explainCode(parameters);
                
                case 'find_bugs':
                    return await this.findBugs(parameters);
                
                case 'migrate_code':
                    return await this.migrateCode(parameters);
                
                case 'analyze_dependencies':
                    return await this.analyzeDependencies(parameters);
                
                case 'generate_docs':
                    return await this.generateDocs(parameters);
                
                case 'fix_errors':
                    return await this.fixErrors(parameters);
                
                case 'improve_code_quality':
                    return await this.improveCodeQuality(parameters);
                
                default:
                    return {
                        ...intent,
                        response: 'I can help with that! Could you be more specific?'
                    };
            }
        } catch (error) {
            return {
                ...intent,
                response: `Error executing action: ${error}`
            };
        }
    }

    /**
     * Find memory leaks
     */
    private async findMemoryLeaks(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.performance.analyzeFile');
        
        return {
            intent: 'find_memory_leaks',
            action: 'find_memory_leaks',
            parameters: params,
            confidence: 1.0,
            response: '🔍 Analyzing code for memory leaks...'
        };
    }

    /**
     * Find security issues
     */
    private async findSecurityIssues(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.security.scanFile');
        
        return {
            intent: 'find_security_issues',
            action: 'find_security_issues',
            parameters: params,
            confidence: 1.0,
            response: '🔒 Scanning for security vulnerabilities...'
        };
    }

    /**
     * Refactor module
     */
    private async refactorModule(params: any): Promise<QueryResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                intent: 'refactor_module',
                action: 'refactor_module',
                parameters: params,
                confidence: 1.0,
                response: 'Please open a file to refactor'
            };
        }

        const code = editor.document.getText();
        const language = editor.document.languageId;
        
        const refactoringPrompt = `Refactor this ${language} code to ${params.pattern || 'modern best practices'}:

\`\`\`${language}
${code}
\`\`\`

Provide refactored code with explanations.`;

        const refactoredCode = await callAI(refactoringPrompt);
        
        // Show in new editor
        const doc = await vscode.workspace.openTextDocument({
            content: refactoredCode,
            language
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        return {
            intent: 'refactor_module',
            action: 'refactor_module',
            parameters: params,
            confidence: 1.0,
            response: '✨ Code refactored! Check the new editor.'
        };
    }

    /**
     * Optimize performance
     */
    private async optimizePerformance(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.performance.analyzeFile');
        
        return {
            intent: 'optimize_performance',
            action: 'optimize_performance',
            parameters: params,
            confidence: 1.0,
            response: '⚡ Analyzing performance and suggesting optimizations...'
        };
    }

    /**
     * Generate tests
     */
    private async generateTests(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.generateAndRunTests');
        
        return {
            intent: 'generate_tests',
            action: 'generate_tests',
            parameters: params,
            confidence: 1.0,
            response: '🧪 Generating unit tests...'
        };
    }

    /**
     * Explain code
     */
    private async explainCode(params: any): Promise<QueryResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                intent: 'explain_code',
                action: 'explain_code',
                parameters: params,
                confidence: 1.0,
                response: 'Please select code to explain'
            };
        }

        const selection = editor.selection;
        const code = editor.document.getText(selection.isEmpty ? undefined : selection);
        const language = editor.document.languageId;

        const explanationPrompt = `Explain this ${language} code in detail:

\`\`\`${language}
${code}
\`\`\`

Provide:
1. What it does
2. How it works
3. Key algorithms/patterns used
4. Potential issues
5. Suggestions for improvement`;

        const explanation = await callAI(explanationPrompt);
        
        // Show in output channel
        this.outputChannel.clear();
        this.outputChannel.appendLine('Code Explanation\n');
        this.outputChannel.appendLine('='.repeat(50));
        this.outputChannel.appendLine(explanation);
        this.outputChannel.show();

        return {
            intent: 'explain_code',
            action: 'explain_code',
            parameters: params,
            confidence: 1.0,
            response: '📖 Code explanation generated! Check the output panel.'
        };
    }

    /**
     * Find bugs
     */
    private async findBugs(params: any): Promise<QueryResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                intent: 'find_bugs',
                action: 'find_bugs',
                parameters: params,
                confidence: 1.0,
                response: 'Please open a file to analyze'
            };
        }

        const code = editor.document.getText();
        const language = editor.document.languageId;

        const bugPrompt = `Analyze this ${language} code for potential bugs:

\`\`\`${language}
${code}
\`\`\`

Find:
1. Logic errors
2. Edge cases not handled
3. Type mismatches
4. Null/undefined issues
5. Concurrency problems
6. Resource leaks

For each bug, provide:
- Line number
- Description
- Severity
- Suggested fix`;

        const bugs = await callAI(bugPrompt);
        
        this.outputChannel.clear();
        this.outputChannel.appendLine('Bug Analysis Report\n');
        this.outputChannel.appendLine('='.repeat(50));
        this.outputChannel.appendLine(bugs);
        this.outputChannel.show();

        return {
            intent: 'find_bugs',
            action: 'find_bugs',
            parameters: params,
            confidence: 1.0,
            response: '🐛 Bug analysis complete! Check the output panel.'
        };
    }

    /**
     * Migrate code
     */
    private async migrateCode(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.migration.start');
        
        return {
            intent: 'migrate_code',
            action: 'migrate_code',
            parameters: params,
            confidence: 1.0,
            response: '🔄 Starting migration wizard...'
        };
    }

    /**
     * Analyze dependencies
     */
    private async analyzeDependencies(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.dependency.analyze');
        
        return {
            intent: 'analyze_dependencies',
            action: 'analyze_dependencies',
            parameters: params,
            confidence: 1.0,
            response: '📦 Analyzing project dependencies...'
        };
    }

    /**
     * Generate documentation
     */
    private async generateDocs(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.generateDocumentation');
        
        return {
            intent: 'generate_docs',
            action: 'generate_docs',
            parameters: params,
            confidence: 1.0,
            response: '📝 Generating documentation...'
        };
    }

    /**
     * Fix errors
     */
    private async fixErrors(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.autoFixPredictedIssues');
        
        return {
            intent: 'fix_errors',
            action: 'fix_errors',
            parameters: params,
            confidence: 1.0,
            response: '🔧 Attempting to fix errors...'
        };
    }

    /**
     * Improve code quality
     */
    private async improveCodeQuality(params: any): Promise<QueryResult> {
        await vscode.commands.executeCommand('coding.analyzeQuality');
        
        return {
            intent: 'improve_code_quality',
            action: 'improve_code_quality',
            parameters: params,
            confidence: 1.0,
            response: '✨ Analyzing code quality and generating suggestions...'
        };
    }

    /**
     * Show natural language input box
     */
    async showQueryInput() {
        const query = await vscode.window.showInputBox({
            prompt: 'What would you like me to do? (e.g., "Find all memory leaks", "Refactor this to use async/await")',
            placeHolder: 'Describe what you want in plain English...',
            ignoreFocusOut: true
        });

        if (!query) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Processing your request...',
            cancellable: false
        }, async () => {
            const result = await this.processQuery(query);
            
            if (result.response) {
                vscode.window.showInformationMessage(result.response);
            }
        });
    }

    /**
     * Get conversation history
     */
    getHistory(): Array<{ query: string; result: QueryResult }> {
        return this.conversationHistory;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register natural language interface commands
 */
export function registerNaturalLanguageCommands(context: vscode.ExtensionContext) {
    const nlInterface = new NaturalLanguageInterface(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.nl.query', async () => {
            await nlInterface.showQueryInput();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.nl.clearHistory', () => {
            nlInterface.clearHistory();
            vscode.window.showInformationMessage('Conversation history cleared');
        })
    );
}
