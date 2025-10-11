import * as vscode from 'vscode';
import { generateCode } from './codegenerator';

/**
 * Voice command types and intents
 */
export enum VoiceCommandType {
    CODE_GENERATION = 'code_generation',
    DEBUG_ANALYSIS = 'debug_analysis',
    REFACTOR = 'refactor',
    EXPLAIN = 'explain',
    NAVIGATE = 'navigate',
    TEST_GENERATE = 'test_generate',
    DOCUMENTATION = 'documentation',
    SEARCH = 'search'
}

export interface VoiceCommand {
    id: string;
    transcript: string;
    confidence: number;
    intent: VoiceCommandType;
    parameters: any;
    timestamp: Date;
    context?: {
        currentFile?: string;
        selectedText?: string;
        cursorPosition?: vscode.Position;
        visibleRange?: vscode.Range;
    };
}

export interface VoiceResponse {
    commandId: string;
    success: boolean;
    result?: any;
    error?: string;
    audioFeedback?: string;
    textFeedback?: string;
    codeChanges?: Array<{
        file: string;
        changes: string;
    }>;
}

/**
 * Speech recognition interface (Web Speech API or external service)
 */
export interface SpeechRecognition {
    start(): void;
    stop(): void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

/**
 * Voice + Code Mode System
 * Enables hands-free coding through voice commands
 */
export class VoiceCodeMode {
    private isListening = false;
    private isEnabled = false;
    private recognition: SpeechRecognition | null = null;
    private currentCommand: VoiceCommand | null = null;
    private commandHistory: VoiceCommand[] = [];
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;
    private webviewPanel: vscode.WebviewPanel | null = null;

    // Voice command patterns for intent recognition
    private commandPatterns = new Map<VoiceCommandType, RegExp[]>([
        [VoiceCommandType.CODE_GENERATION, [
            /create\s+(.+)/i,
            /generate\s+(.+)/i,
            /write\s+(.+)/i,
            /add\s+(.+)/i,
            /implement\s+(.+)/i
        ]],
        [VoiceCommandType.DEBUG_ANALYSIS, [
            /debug\s+(.+)/i,
            /analyze\s+error/i,
            /fix\s+(.+)/i,
            /troubleshoot\s+(.+)/i,
            /what's\s+wrong/i
        ]],
        [VoiceCommandType.REFACTOR, [
            /refactor\s+(.+)/i,
            /optimize\s+(.+)/i,
            /improve\s+(.+)/i,
            /clean\s+up\s+(.+)/i,
            /reorganize\s+(.+)/i
        ]],
        [VoiceCommandType.EXPLAIN, [
            /explain\s+(.+)/i,
            /describe\s+(.+)/i,
            /what\s+does\s+(.+)/i,
            /how\s+does\s+(.+)/i,
            /tell\s+me\s+about\s+(.+)/i
        ]],
        [VoiceCommandType.NAVIGATE, [
            /go\s+to\s+(.+)/i,
            /find\s+(.+)/i,
            /show\s+me\s+(.+)/i,
            /open\s+(.+)/i,
            /navigate\s+to\s+(.+)/i
        ]],
        [VoiceCommandType.TEST_GENERATE, [
            /test\s+(.+)/i,
            /create\s+tests\s+for\s+(.+)/i,
            /generate\s+tests/i,
            /add\s+unit\s+tests/i
        ]],
        [VoiceCommandType.DOCUMENTATION, [
            /document\s+(.+)/i,
            /add\s+comments\s+to\s+(.+)/i,
            /create\s+documentation/i,
            /generate\s+docs/i
        ]],
        [VoiceCommandType.SEARCH, [
            /search\s+for\s+(.+)/i,
            /find\s+all\s+(.+)/i,
            /locate\s+(.+)/i,
            /where\s+is\s+(.+)/i
        ]]
    ]);

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Voice Code Mode');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.setupStatusBar();
        this.initializeSpeechRecognition();
    }

    /**
     * Enable voice code mode
     */
    async enable(): Promise<boolean> {
        try {
            if (!this.recognition) {
                const success = await this.initializeSpeechRecognition();
                if (!success) {
                    vscode.window.showErrorMessage('Speech recognition is not available in this environment');
                    return false;
                }
            }

            this.isEnabled = true;
            this.statusBarItem.show();
            this.outputChannel.appendLine('Voice Code Mode enabled');
            
            vscode.window.showInformationMessage(
                'Voice Code Mode enabled! Click the microphone icon or use "Start Voice Commands" to begin.',
                'Start Listening'
            ).then(selection => {
                if (selection === 'Start Listening') {
                    this.startListening();
                }
            });

            return true;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to enable voice mode: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Disable voice code mode
     */
    disable(): void {
        this.stopListening();
        this.isEnabled = false;
        this.statusBarItem.hide();
        this.outputChannel.appendLine('Voice Code Mode disabled');
        vscode.window.showInformationMessage('Voice Code Mode disabled');
    }

    /**
     * Toggle voice code mode
     */
    toggle(): Promise<boolean> {
        if (this.isEnabled) {
            this.disable();
            return Promise.resolve(false);
        } else {
            return this.enable();
        }
    }

    /**
     * Start listening for voice commands
     */
    startListening(): void {
        if (!this.recognition || !this.isEnabled) {
            vscode.window.showWarningMessage('Voice recognition is not available');
            return;
        }

        if (this.isListening) {
            return;
        }

        try {
            this.isListening = true;
            this.updateStatusBar();
            this.recognition.start();
            this.outputChannel.appendLine('Started listening for voice commands');
            
            // Show visual feedback
            this.showVoiceInterface();
        } catch (error) {
            this.outputChannel.appendLine(`Failed to start listening: ${(error as Error).message}`);
            this.isListening = false;
            this.updateStatusBar();
        }
    }

    /**
     * Stop listening for voice commands
     */
    stopListening(): void {
        if (!this.isListening || !this.recognition) {
            return;
        }

        try {
            this.recognition.stop();
            this.isListening = false;
            this.updateStatusBar();
            this.outputChannel.appendLine('Stopped listening for voice commands');
            
            if (this.webviewPanel) {
                this.webviewPanel.dispose();
                this.webviewPanel = null;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to stop listening: ${(error as Error).message}`);
        }
    }

    /**
     * Process voice command transcript
     */
    private async processVoiceCommand(transcript: string, confidence: number): Promise<void> {
        this.outputChannel.appendLine(`Processing voice command: "${transcript}" (confidence: ${Math.round(confidence * 100)}%)`);

        // Create voice command object
        const command: VoiceCommand = {
            id: this.generateCommandId(),
            transcript: transcript.trim(),
            confidence,
            intent: this.detectIntent(transcript),
            parameters: this.extractParameters(transcript),
            timestamp: new Date(),
            context: this.getCurrentContext()
        };

        this.currentCommand = command;
        this.commandHistory.push(command);

        // Show processing feedback
        this.showProcessingFeedback(command);

        try {
            // Execute the command
            const response = await this.executeVoiceCommand(command);
            
            // Show result
            await this.showCommandResult(response);
            
        } catch (error) {
            const errorResponse: VoiceResponse = {
                commandId: command.id,
                success: false,
                error: (error as Error).message,
                textFeedback: `Sorry, I couldn't execute that command: ${(error as Error).message}`
            };
            
            await this.showCommandResult(errorResponse);
        }
    }

    /**
     * Detect intent from voice transcript
     */
    private detectIntent(transcript: string): VoiceCommandType {
        const lowerTranscript = transcript.toLowerCase();
        
        for (const [intent, patterns] of this.commandPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(lowerTranscript)) {
                    return intent;
                }
            }
        }
        
        return VoiceCommandType.CODE_GENERATION; // Default fallback
    }

    /**
     * Extract parameters from transcript based on intent
     */
    private extractParameters(transcript: string): any {
        const lowerTranscript = transcript.toLowerCase();
        const params: any = {};

        // Extract common parameters
        if (lowerTranscript.includes('function')) {
            params.type = 'function';
        } else if (lowerTranscript.includes('class')) {
            params.type = 'class';
        } else if (lowerTranscript.includes('interface')) {
            params.type = 'interface';
        } else if (lowerTranscript.includes('variable')) {
            params.type = 'variable';
        }

        // Extract language hints
        const languages = ['typescript', 'javascript', 'python', 'java', 'react', 'vue', 'angular'];
        for (const lang of languages) {
            if (lowerTranscript.includes(lang)) {
                params.language = lang;
                break;
            }
        }

        // Extract specific patterns based on intent
        params.description = transcript;
        
        return params;
    }

    /**
     * Get current editor context
     */
    private getCurrentContext(): VoiceCommand['context'] {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {};
        }

        return {
            currentFile: editor.document.fileName,
            selectedText: editor.document.getText(editor.selection),
            cursorPosition: editor.selection.active,
            visibleRange: editor.visibleRanges[0]
        };
    }

    /**
     * Execute voice command based on intent
     */
    private async executeVoiceCommand(command: VoiceCommand): Promise<VoiceResponse> {
        this.outputChannel.appendLine(`Executing ${command.intent} command: ${command.transcript}`);

        switch (command.intent) {
            case VoiceCommandType.CODE_GENERATION:
                return await this.handleCodeGeneration(command);
            case VoiceCommandType.DEBUG_ANALYSIS:
                return await this.handleDebugAnalysis(command);
            case VoiceCommandType.REFACTOR:
                return await this.handleRefactor(command);
            case VoiceCommandType.EXPLAIN:
                return await this.handleExplain(command);
            case VoiceCommandType.NAVIGATE:
                return await this.handleNavigate(command);
            case VoiceCommandType.TEST_GENERATE:
                return await this.handleTestGenerate(command);
            case VoiceCommandType.DOCUMENTATION:
                return await this.handleDocumentation(command);
            case VoiceCommandType.SEARCH:
                return await this.handleSearch(command);
            default:
                throw new Error(`Unknown command intent: ${command.intent}`);
        }
    }

    /**
     * Handle code generation commands
     */
    private async handleCodeGeneration(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const prompt = `Generate code based on voice command: ${command.transcript}
        Current file: ${command.context?.currentFile}
        Language: ${command.parameters.language || 'auto-detect'}
        Context: ${command.context?.selectedText || 'No selection'}
        
        Please provide clean, production-ready code.`;

        const result = await generateCode(prompt, 'voice-generated');
        
        // Insert generated code at cursor position
        const position = editor.selection.active;
        await editor.edit(editBuilder => {
            editBuilder.insert(position, result);
        });

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Generated code based on: "${command.transcript}"`,
            codeChanges: [{
                file: editor.document.fileName,
                changes: result
            }]
        };
    }

    /**
     * Handle debug analysis commands
     */
    private async handleDebugAnalysis(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const selectedText = command.context?.selectedText || editor.document.getText();
        
        const prompt = `Debug and analyze this code:
        ${selectedText}
        
        Voice request: ${command.transcript}
        
        Provide:
        1. Issue identification
        2. Root cause analysis
        3. Fix suggestions
        4. Prevention strategies`;

        const result = await generateCode(prompt, 'debug-analysis');

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Debug analysis complete for: "${command.transcript}"`,
            audioFeedback: 'Debug analysis completed. Check the output panel for details.'
        };
    }

    /**
     * Handle refactoring commands
     */
    private async handleRefactor(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const selectedText = command.context?.selectedText || '';
        if (!selectedText) {
            throw new Error('Please select code to refactor');
        }

        const prompt = `Refactor this code based on voice request:
        Code: ${selectedText}
        Request: ${command.transcript}
        
        Provide improved, clean code with better:
        - Structure
        - Performance
        - Readability
        - Maintainability`;

        const result = await generateCode(prompt, 'refactor');

        // Replace selected text with refactored code
        await editor.edit(editBuilder => {
            editBuilder.replace(editor.selection, result);
        });

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Code refactored based on: "${command.transcript}"`,
            codeChanges: [{
                file: editor.document.fileName,
                changes: result
            }]
        };
    }

    /**
     * Handle explanation commands
     */
    private async handleExplain(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const selectedText = command.context?.selectedText || editor.document.getText();
        
        const prompt = `Explain this code in simple terms:
        ${selectedText}
        
        Voice request: ${command.transcript}
        
        Provide clear explanation covering:
        - What the code does
        - How it works
        - Key concepts used
        - Potential improvements`;

        const result = await generateCode(prompt, 'explanation');

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Code explanation for: "${command.transcript}"`,
            audioFeedback: 'Code explanation complete. Check the output panel for details.'
        };
    }

    /**
     * Handle navigation commands
     */
    private async handleNavigate(command: VoiceCommand): Promise<VoiceResponse> {
        const transcript = command.transcript.toLowerCase();
        
        // Extract target from transcript
        let target = '';
        const navigationPatterns = [
            /go\s+to\s+(.+)/i,
            /find\s+(.+)/i,
            /open\s+(.+)/i,
            /show\s+me\s+(.+)/i
        ];

        for (const pattern of navigationPatterns) {
            const match = transcript.match(pattern);
            if (match) {
                target = match[1].trim();
                break;
            }
        }

        if (target.includes('function')) {
            // Navigate to function
            await vscode.commands.executeCommand('workbench.action.gotoSymbol');
        } else if (target.includes('file')) {
            // Navigate to file
            await vscode.commands.executeCommand('workbench.action.quickOpen');
        } else if (target.includes('line')) {
            // Navigate to line
            await vscode.commands.executeCommand('workbench.action.gotoLine');
        } else {
            // General search
            await vscode.commands.executeCommand('workbench.action.findInFiles');
        }

        return {
            commandId: command.id,
            success: true,
            textFeedback: `Navigation command executed: "${command.transcript}"`,
            audioFeedback: `Navigating to ${target}`
        };
    }

    /**
     * Handle test generation commands
     */
    private async handleTestGenerate(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const selectedText = command.context?.selectedText || '';
        const currentFile = command.context?.currentFile || '';
        
        const prompt = `Generate comprehensive tests for this code:
        File: ${currentFile}
        Code: ${selectedText}
        Request: ${command.transcript}
        
        Create tests that cover:
        - Happy path scenarios
        - Edge cases
        - Error conditions
        - Boundary values`;

        const result = await generateCode(prompt, 'test-generation');

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Tests generated for: "${command.transcript}"`,
            audioFeedback: 'Test generation complete. Check the output for the generated tests.'
        };
    }

    /**
     * Handle documentation commands
     */
    private async handleDocumentation(command: VoiceCommand): Promise<VoiceResponse> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        const selectedText = command.context?.selectedText || editor.document.getText();
        
        const prompt = `Add comprehensive documentation to this code:
        ${selectedText}
        
        Request: ${command.transcript}
        
        Include:
        - Function/class documentation
        - Parameter descriptions
        - Return value descriptions
        - Usage examples
        - Inline comments for complex logic`;

        const result = await generateCode(prompt, 'documentation');

        return {
            commandId: command.id,
            success: true,
            result: result,
            textFeedback: `Documentation generated for: "${command.transcript}"`,
            audioFeedback: 'Documentation generation complete.'
        };
    }

    /**
     * Handle search commands
     */
    private async handleSearch(command: VoiceCommand): Promise<VoiceResponse> {
        const transcript = command.transcript.toLowerCase();
        
        // Extract search term
        let searchTerm = '';
        const searchPatterns = [
            /search\s+for\s+(.+)/i,
            /find\s+all\s+(.+)/i,
            /locate\s+(.+)/i,
            /where\s+is\s+(.+)/i
        ];

        for (const pattern of searchPatterns) {
            const match = transcript.match(pattern);
            if (match) {
                searchTerm = match[1].trim();
                break;
            }
        }

        // Execute search
        await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: searchTerm,
            triggerSearch: true
        });

        return {
            commandId: command.id,
            success: true,
            textFeedback: `Searching for: "${searchTerm}"`,
            audioFeedback: `Searching for ${searchTerm} in the workspace`
        };
    }

    /**
     * Initialize speech recognition
     */
    private async initializeSpeechRecognition(): Promise<boolean> {
        try {
            // Check if running in web context (VS Code Web/Codespaces)
            if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
                // Web Speech API (Chrome/Edge)
                const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
                
                if (SpeechRecognition) {
                    this.recognition = new SpeechRecognition();
                    if (this.recognition) {
                        this.recognition.continuous = false;
                        this.recognition.interimResults = false;
                        this.recognition.lang = 'en-US';

                        this.recognition.onresult = (event: any) => {
                            const transcript = event.results[0][0].transcript;
                            const confidence = event.results[0][0].confidence;
                            this.processVoiceCommand(transcript, confidence);
                        };

                        this.recognition.onerror = (event: any) => {
                            this.outputChannel.appendLine(`Speech recognition error: ${event.error}`);
                            this.isListening = false;
                            this.updateStatusBar();
                        };

                        this.recognition.onend = () => {
                            this.isListening = false;
                            this.updateStatusBar();
                        };
                    }
                }

                return true;
            } else {
                // Desktop VS Code - show guidance for external setup
                this.outputChannel.appendLine('Speech recognition requires web browser environment or external setup');
                return false;
            }
        } catch (error) {
            this.outputChannel.appendLine(`Failed to initialize speech recognition: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Show voice interface
     */
    private showVoiceInterface(): void {
        if (this.webviewPanel) {
            this.webviewPanel.reveal();
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            'voiceCodeInterface',
            'Voice Code Mode',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.webviewPanel.webview.html = this.getVoiceInterfaceHTML();
        
        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = null;
        });
    }

    /**
     * Get voice interface HTML
     */
    private getVoiceInterfaceHTML(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Voice Code Mode</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .voice-container {
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                .microphone {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 30px;
                    animation: pulse 2s infinite;
                }
                .microphone.listening {
                    background: rgba(255, 87, 87, 0.3);
                    border-color: rgba(255, 87, 87, 0.5);
                    animation: listening 1s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                @keyframes listening {
                    0% { transform: scale(1); background: rgba(255, 87, 87, 0.3); }
                    50% { transform: scale(1.1); background: rgba(255, 87, 87, 0.5); }
                    100% { transform: scale(1); background: rgba(255, 87, 87, 0.3); }
                }
                .status {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .commands {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    padding: 20px;
                    margin-top: 30px;
                    text-align: left;
                }
                .commands h3 {
                    margin-top: 0;
                    color: rgba(255, 255, 255, 0.9);
                }
                .commands ul {
                    list-style: none;
                    padding: 0;
                }
                .commands li {
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                .commands li:last-child {
                    border-bottom: none;
                }
                .feedback {
                    margin-top: 20px;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="voice-container">
                <div class="microphone ${this.isListening ? 'listening' : ''}">
                    🎤
                </div>
                <div class="status">
                    ${this.isListening ? 'Listening...' : 'Ready to Listen'}
                </div>
                <div class="feedback" id="feedback">
                    Say a command to get started!
                </div>
                
                <div class="commands">
                    <h3>Voice Commands</h3>
                    <ul>
                        <li><strong>Generate:</strong> "Create a function that..."</li>
                        <li><strong>Debug:</strong> "Debug this error"</li>
                        <li><strong>Refactor:</strong> "Optimize this code"</li>
                        <li><strong>Explain:</strong> "Explain what this does"</li>
                        <li><strong>Navigate:</strong> "Go to function main"</li>
                        <li><strong>Test:</strong> "Generate tests for this"</li>
                        <li><strong>Document:</strong> "Add comments to this"</li>
                        <li><strong>Search:</strong> "Find all references to user"</li>
                    </ul>
                </div>
            </div>
            
            <script>
                // This would contain JavaScript for real-time updates
                // In actual implementation, this would communicate with the extension
            </script>
        </body>
        </html>`;
    }

    /**
     * Show processing feedback
     */
    private showProcessingFeedback(command: VoiceCommand): void {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Processing voice command: "${command.transcript}"`,
            cancellable: false
        }, async () => {
            // Visual feedback while processing
            return new Promise(resolve => setTimeout(resolve, 1000));
        });
    }

    /**
     * Show command result
     */
    private async showCommandResult(response: VoiceResponse): Promise<void> {
        if (response.success) {
            if (response.textFeedback) {
                vscode.window.showInformationMessage(response.textFeedback);
            }
            
            if (response.result) {
                this.outputChannel.appendLine(`Command Result:\n${response.result}`);
                this.outputChannel.show();
            }
        } else {
            vscode.window.showErrorMessage(response.textFeedback || response.error || 'Command failed');
        }

        // Update webview with feedback
        if (this.webviewPanel) {
            this.webviewPanel.webview.postMessage({
                type: 'commandResult',
                success: response.success,
                feedback: response.textFeedback || response.error
            });
        }
    }

    /**
     * Setup status bar
     */
    private setupStatusBar(): void {
        this.statusBarItem.command = 'voice-code-mode.toggle';
        this.updateStatusBar();
    }

    /**
     * Update status bar display
     */
    private updateStatusBar(): void {
        if (this.isListening) {
            this.statusBarItem.text = '$(record) Listening';
            this.statusBarItem.tooltip = 'Voice Code Mode is listening - Click to stop';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (this.isEnabled) {
            this.statusBarItem.text = '$(mic) Voice Mode';
            this.statusBarItem.tooltip = 'Voice Code Mode is ready - Click to start listening';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(mic-off) Voice Off';
            this.statusBarItem.tooltip = 'Voice Code Mode is disabled - Click to enable';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    /**
     * Generate unique command ID
     */
    private generateCommandId(): string {
        return `voice_cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get command history
     */
    getCommandHistory(): VoiceCommand[] {
        return this.commandHistory.slice(-20); // Return last 20 commands
    }

    /**
     * Get analytics
     */
    getAnalytics(): any {
        const totalCommands = this.commandHistory.length;
        const intentCounts = new Map<VoiceCommandType, number>();
        
        for (const command of this.commandHistory) {
            intentCounts.set(command.intent, (intentCounts.get(command.intent) || 0) + 1);
        }

        const avgConfidence = this.commandHistory.length > 0
            ? this.commandHistory.reduce((sum, cmd) => sum + cmd.confidence, 0) / this.commandHistory.length
            : 0;

        return {
            totalCommands,
            averageConfidence: Math.round(avgConfidence * 100) / 100,
            intentDistribution: Object.fromEntries(intentCounts),
            isCurrentlyEnabled: this.isEnabled,
            isCurrentlyListening: this.isListening
        };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stopListening();
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
        if (this.webviewPanel) {
            this.webviewPanel.dispose();
        }
    }
}

// Export singleton instance
let voiceCodeModeInstance: VoiceCodeMode | undefined;

export function getVoiceCodeMode(context: vscode.ExtensionContext): VoiceCodeMode {
    if (!voiceCodeModeInstance) {
        voiceCodeModeInstance = new VoiceCodeMode(context);
    }
    return voiceCodeModeInstance;
}