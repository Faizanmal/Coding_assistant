import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import { EnhancedNLPEngine } from './enhanced-nlp-engine';
import { IntentRecognitionSystem } from './intentrecognition';
import { SmartAgentCoordinator } from './smartagentcoordinator';

// Natural Language Command Types
interface ConversationalCommand {
    originalInput: string;
    processedInput: string;
    commandType: 'create' | 'modify' | 'query' | 'execute' | 'navigate' | 'configure';
    parameters: { [key: string]: any };
    confidence: number;
    suggestedActions: string[];
    requiresConfirmation: boolean;
}

interface ConversationContext {
    sessionId: string;
    messageHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
        intent?: string;
        actions?: string[];
    }>;
    userPreferences: {
        communicationStyle: 'direct' | 'verbose' | 'technical' | 'casual';
        expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
        preferredTechnologies: string[];
    };
    currentProject: {
        type?: string;
        technologies?: string[];
        files?: string[];
        progress?: number;
    };
    ongoingTasks: string[];
}

export class NaturalLanguageCommandProcessor {
    private static instance: NaturalLanguageCommandProcessor;
    private enhancedNLP: EnhancedNLPEngine;
    private intentSystem: IntentRecognitionSystem;
    private agentCoordinator: SmartAgentCoordinator;
    private conversationContexts: Map<string, ConversationContext> = new Map();
    private webviewView?: vscode.WebviewView;

    // Conversational patterns for natural command processing
    private commandPatterns = [
        {
            pattern: /^(create|make|build|generate)\s+(.+)/i,
            type: 'create' as const,
            extractor: (match: RegExpMatchArray) => ({ target: match[2] })
        },
        {
            pattern: /^(edit|modify|update|change)\s+(.+)/i,
            type: 'modify' as const,
            extractor: (match: RegExpMatchArray) => ({ target: match[2] })
        },
        {
            pattern: /^(what|how|where|why|when)\s+(.+)/i,
            type: 'query' as const,
            extractor: (match: RegExpMatchArray) => ({ question: match[2] })
        },
        {
            pattern: /^(run|execute|start)\s+(.+)/i,
            type: 'execute' as const,
            extractor: (match: RegExpMatchArray) => ({ command: match[2] })
        },
        {
            pattern: /^(show|open|goto|navigate)\s+(.+)/i,
            type: 'navigate' as const,
            extractor: (match: RegExpMatchArray) => ({ target: match[2] })
        },
        {
            pattern: /^(set|configure|setup)\s+(.+)/i,
            type: 'configure' as const,
            extractor: (match: RegExpMatchArray) => ({ config: match[2] })
        }
    ];

    // Conversational flow patterns
    private conversationalPatterns = [
        {
            pattern: /^(i want|i need|i would like|can you|please|help me)\s+(.+)/i,
            processing: 'polite_request',
            confidence: 0.9
        },
        {
            pattern: /^(let's|let us)\s+(.+)/i,
            processing: 'collaborative',
            confidence: 0.8
        },
        {
            pattern: /^(should i|could i|may i)\s+(.+)/i,
            processing: 'seeking_permission',
            confidence: 0.7
        },
        {
            pattern: /^(yes|no|ok|okay|sure|exactly|that's right)/i,
            processing: 'confirmation',
            confidence: 0.95
        }
    ];

    constructor() {
        this.enhancedNLP = EnhancedNLPEngine.getInstance();
        this.intentSystem = IntentRecognitionSystem.getInstance();
        this.agentCoordinator = SmartAgentCoordinator.getInstance();
    }

    static getInstance(): NaturalLanguageCommandProcessor {
        if (!this.instance) {
            this.instance = new NaturalLanguageCommandProcessor();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
        this.enhancedNLP.setWebviewView(view);
    }

    async processConversationalInput(userInput: string, sessionId?: string): Promise<string> {
        try {
            // Get or create conversation context
            const contextId = sessionId || this.generateSessionId();
            const context = this.getOrCreateContext(contextId);

            // Add user message to history
            context.messageHistory.push({
                role: 'user',
                content: userInput,
                timestamp: new Date()
            });

            // Process the input through multiple stages
            const command = await this.parseConversationalCommand(userInput, context);
            
            // Route based on command analysis
            const result = await this.routeConversationalCommand(command, context);

            // Add assistant response to history
            context.messageHistory.push({
                role: 'assistant',
                content: result,
                timestamp: new Date(),
                intent: command.commandType,
                actions: command.suggestedActions
            });

            // Update conversation context
            this.updateConversationContext(context, command);

            return result;

        } catch (error) {
            return `❌ Conversational processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    private async parseConversationalCommand(userInput: string, context: ConversationContext): Promise<ConversationalCommand> {
        const normalized = userInput.trim().toLowerCase();
        
        // Check for conversational patterns first
        const conversationalMatch = this.matchConversationalPattern(normalized);
        
        // If it's a confirmation, handle it specially
        if (conversationalMatch?.processing === 'confirmation') {
            return this.handleConfirmation(userInput, context);
        }

        // Extract command from conversational wrapper
        const extractedCommand = this.extractCommandFromConversation(userInput, conversationalMatch);
        
        // Match against command patterns
        const commandMatch = this.matchCommandPattern(extractedCommand);
        
        // Use AI to enhance command understanding
        const enhancedCommand = await this.enhanceCommandWithAI(userInput, extractedCommand, context);
        
        return {
            originalInput: userInput,
            processedInput: extractedCommand,
            commandType: commandMatch?.type || enhancedCommand.commandType || 'create',
            parameters: {
                ...commandMatch?.parameters,
                ...enhancedCommand.parameters
            },
            confidence: this.calculateCommandConfidence(commandMatch, conversationalMatch, enhancedCommand),
            suggestedActions: enhancedCommand.suggestedActions || [],
            requiresConfirmation: this.shouldRequireConfirmation(enhancedCommand, context)
        };
    }

    private matchConversationalPattern(input: string) {
        for (const pattern of this.conversationalPatterns) {
            const match = input.match(pattern.pattern);
            if (match) {
                return {
                    ...pattern,
                    match: match
                };
            }
        }
        return null;
    }

    private extractCommandFromConversation(input: string, conversationalMatch: any): string {
        if (!conversationalMatch) {
            return input;
        }

        const match = conversationalMatch.match;
        switch (conversationalMatch.processing) {
            case 'polite_request':
                // Extract the actual request from "I want to create..." -> "create..."
                return match[2] || input;
            case 'collaborative':
                // Extract from "let's create..." -> "create..."
                return match[2] || input;
            case 'seeking_permission':
                // Extract from "should I create..." -> "create..."
                return match[2] || input;
            default:
                return input;
        }
    }

    private matchCommandPattern(input: string) {
        for (const pattern of this.commandPatterns) {
            const match = input.match(pattern.pattern);
            if (match) {
                return {
                    type: pattern.type,
                    parameters: pattern.extractor(match)
                };
            }
        }
        return null;
    }

    private async enhanceCommandWithAI(originalInput: string, extractedCommand: string, context: ConversationContext): Promise<any> {
        const recentHistory = context.messageHistory.slice(-3).map(msg => 
            `${msg.role}: ${msg.content}`
        ).join('\n');

        const prompt = `Analyze this conversational command with context:

Original Input: "${originalInput}"
Extracted Command: "${extractedCommand}"
User Expertise: ${context.userPreferences.expertiseLevel}
Current Project: ${JSON.stringify(context.currentProject)}
Recent History: ${recentHistory}

Return JSON analysis:
{
  "commandType": "create|modify|query|execute|navigate|configure",
  "parameters": {
    "target": "what to create/modify",
    "technology": "preferred tech",
    "features": ["feature1", "feature2"],
    "urgency": "low|medium|high"
  },
  "suggestedActions": ["specific action 1", "specific action 2"],
  "requiresConfirmation": true|false,
  "communicationStyle": "direct|verbose|technical|casual",
  "confidence": 0.85
}`;

        try {
            const response = await generateCode(prompt, 'llama-3.3-70b-versatile');
            return JSON.parse(response.replace(/```json\n?|\n?```/g, '').trim());
        } catch (error) {
            console.warn('AI command enhancement failed:', error);
            return {
                commandType: 'create',
                parameters: { target: extractedCommand },
                suggestedActions: [`Process: ${extractedCommand}`],
                requiresConfirmation: false,
                confidence: 0.6
            };
        }
    }

    private handleConfirmation(userInput: string, context: ConversationContext): ConversationalCommand {
        const isPositive = /^(yes|yeah|yep|ok|okay|sure|exactly|that's right|correct|proceed)/i.test(userInput);
        const isNegative = /^(no|nope|nah|cancel|stop|abort|incorrect)/i.test(userInput);

        return {
            originalInput: userInput,
            processedInput: userInput,
            commandType: 'execute',
            parameters: {
                confirmation: isPositive,
                denial: isNegative,
                lastAction: context.ongoingTasks[context.ongoingTasks.length - 1]
            },
            confidence: 0.95,
            suggestedActions: isPositive ? ['Execute pending action'] : ['Cancel pending action'],
            requiresConfirmation: false
        };
    }

    private async routeConversationalCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        // Handle confirmations first
        if (command.parameters.confirmation !== undefined) {
            return this.handleConfirmationResponse(command, context);
        }

        // Route based on command type and complexity
        switch (command.commandType) {
            case 'create':
                return this.handleCreateCommand(command, context);
            case 'modify':
                return this.handleModifyCommand(command, context);
            case 'query':
                return this.handleQueryCommand(command, context);
            case 'execute':
                return this.handleExecuteCommand(command, context);
            case 'navigate':
                return this.handleNavigateCommand(command, context);
            case 'configure':
                return this.handleConfigureCommand(command, context);
            default:
                return this.handleUnknownCommand(command, context);
        }
    }

    private async handleCreateCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const target = command.parameters.target || command.processedInput;
        
        // Check if this should use enhanced NLP
        if (EnhancedNLPEngine.shouldProcessWithEnhancedNLP(target)) {
            this.sendProgressUpdate('🧠 Using Enhanced NLP for complex project creation...', 20);
            return await this.enhancedNLP.processNaturalLanguageInput(target);
        }
        
        // Check if this needs workflow routing
        const routingDecision = await this.intentSystem.routeWorkflowAutomatically(target);
        
        if (routingDecision.shouldUseEnhancedNLP) {
            this.sendProgressUpdate('🚀 Routing to Enhanced NLP Engine...', 30);
            return await this.enhancedNLP.processNaturalLanguageInput(target);
        } else if (routingDecision.routingDecision === 'smart_coordinator') {
            this.sendProgressUpdate('🤖 Using Smart Agent Coordinator...', 30);
            return await this.agentCoordinator.processMultiAgentRequest(target);
        } else if (routingDecision.routingDecision === 'clarification_needed') {
            return this.requestClarification(command, routingDecision, context);
        }
        
        // Fallback to basic handling
        return `📝 **Create Command Processed:**

Target: ${target}
Confidence: ${command.confidence}

This would be processed by the basic creation handler.`;
    }

    private async handleModifyCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const target = command.parameters.target;
        return `✏️ **Modify Command:** Would modify ${target}`;
    }

    private async handleQueryCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const question = command.parameters.question;
        return `❓ **Query Command:** Would answer: ${question}`;
    }

    private async handleExecuteCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const commandToRun = command.parameters.command;
        const commandId = `cmd_${Date.now()}`;

        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'requestCommandConfirmation',
                command: commandToRun,
                commandId: commandId
            });
            return ``; // Return empty string as the confirmation UI will be shown
        } else {
            return `I can run the command 
${commandToRun}
, but I need to be able to show you a confirmation first.`;
        }
    }

    private async handleNavigateCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const target = command.parameters.target;
        return `🧭 **Navigate Command:** Would navigate to: ${target}`;
    }

    private async handleConfigureCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        const config = command.parameters.config;
        return `⚙️ **Configure Command:** Would configure: ${config}`;
    }

    private async handleUnknownCommand(command: ConversationalCommand, context: ConversationContext): Promise<string> {
        return `🤔 **Unknown Command:** I'm not sure how to handle "${command.originalInput}". Could you rephrase or be more specific?`;
    }

    private handleConfirmationResponse(command: ConversationalCommand, context: ConversationContext): string {
        if (command.parameters.confirmation) {
            return `✅ **Confirmed!** Proceeding with the last action...`;
        } else {
            return `❌ **Cancelled** Last action has been cancelled.`;
        }
    }

    private requestClarification(command: ConversationalCommand, routingDecision: any, context: ConversationContext): string {
        let clarification = `🤔 **I need some clarification:**\n\n`;
        clarification += `You said: "${command.originalInput}"\n\n`;
        clarification += `**Questions:**\n`;
        
        routingDecision.reasoning.forEach((reason: string, index: number) => {
            clarification += `${index + 1}. ${reason}\n`;
        });
        
        clarification += `\n**Could you please specify:**\n`;
        clarification += `- What type of project? (website, app, api, etc.)\n`;
        clarification += `- Which technologies? (React, Vue, Node.js, Python, etc.)\n`;
        clarification += `- Any specific features you need?\n`;
        
        return clarification;
    }

    // Helper methods
    private calculateCommandConfidence(commandMatch: any, conversationalMatch: any, enhancedCommand: any): number {
        let confidence = 0.5; // Base confidence
        
        if (commandMatch) {confidence += 0.2;}
        if (conversationalMatch) {confidence += 0.1;}
        if (enhancedCommand.confidence) {confidence += enhancedCommand.confidence * 0.3;}
        
        return Math.min(0.95, confidence);
    }

    private shouldRequireConfirmation(enhancedCommand: any, context: ConversationContext): boolean {
        // Require confirmation for complex operations
        if (enhancedCommand.parameters?.urgency === 'high') {return false;}
        if (context.currentProject.files && context.currentProject.files.length > 5) {return true;}
        if (enhancedCommand.confidence < 0.7) {return true;}
        
        return enhancedCommand.requiresConfirmation || false;
    }

    private getOrCreateContext(sessionId: string): ConversationContext {
        if (!this.conversationContexts.has(sessionId)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            this.conversationContexts.set(sessionId, {
                sessionId,
                messageHistory: [],
                userPreferences: {
                    communicationStyle: 'casual',
                    expertiseLevel: 'intermediate',
                    preferredTechnologies: []
                },
                currentProject: {
                    type: workspaceFolders?.[0]?.name,
                    technologies: [],
                    files: [],
                    progress: 0
                },
                ongoingTasks: []
            });
        }
        return this.conversationContexts.get(sessionId)!;
    }

    private updateConversationContext(context: ConversationContext, command: ConversationalCommand): void {
        // Update user preferences based on commands
        if (command.parameters.technology) {
            const tech = command.parameters.technology;
            if (!context.userPreferences.preferredTechnologies.includes(tech)) {
                context.userPreferences.preferredTechnologies.push(tech);
            }
        }

        // Update current project info
        if (command.commandType === 'create' && command.parameters.target) {
            if (!context.currentProject.files) {
                context.currentProject.files = [];
            }
            // Could extract file names from the target
        }

        // Track ongoing tasks
        if (command.requiresConfirmation) {
            context.ongoingTasks.push(command.commandType + '_' + Date.now());
        }
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private sendProgressUpdate(message: string, percentage: number): void {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'conversationalProgress',
                data: {
                    message,
                    percentage,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    // Static method to check if input should use conversational processing
    static shouldUseConversationalProcessing(input: string): boolean {
        const conversationalIndicators = [
            // Natural conversation starters
            'i want', 'i need', 'can you', 'help me', 'please',
            // Questions
            'how do i', 'what is', 'where can', 'why does',
            // Casual language
            'hey', 'hi', 'hello', 'thanks', 'thank you'
        ];
        
        const inputLower = input.toLowerCase();
        return conversationalIndicators.some(indicator => inputLower.includes(indicator)) ||
               input.endsWith('?') ||
               input.split(' ').length > 8; // Long sentences tend to be conversational
    }

    // Get conversation history for debugging
    getConversationHistory(sessionId: string): ConversationContext | undefined {
        return this.conversationContexts.get(sessionId);
    }

    // Clear old conversations to manage memory
    clearOldConversations(): void {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        for (const [sessionId, context] of this.conversationContexts.entries()) {
            const lastMessage = context.messageHistory[context.messageHistory.length - 1];
            if (lastMessage && lastMessage.timestamp < oneHourAgo) {
                this.conversationContexts.delete(sessionId);
            }
        }
    }
}