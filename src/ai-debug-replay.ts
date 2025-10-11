import * as vscode from 'vscode';
import { generateCode } from './codegenerator';
import * as fs from 'fs/promises';

/**
 * Debug session types and states
 */
export enum DebugSessionType {
    NODEJS = 'node',
    PYTHON = 'python',
    JAVA = 'java',
    CSHARP = 'csharp',
    GO = 'go',
    GENERIC = 'generic'
}

export enum DebugEventType {
    STEP = 'step',
    BREAKPOINT = 'breakpoint',
    VARIABLE_CHANGE = 'variableChange',
    FUNCTION_CALL = 'functionCall',
    EXCEPTION = 'exception',
    LOG_MESSAGE = 'logMessage',
    STACK_FRAME = 'stackFrame'
}

/**
 * Debug event captured during debugging session
 */
export interface DebugEvent {
    id: string;
    type: DebugEventType;
    timestamp: Date;
    location: {
        file: string;
        line: number;
        column?: number;
        function?: string;
    };
    data: {
        variables?: { [name: string]: any };
        stackTrace?: string[];
        message?: string;
        expression?: string;
        value?: any;
        oldValue?: any;
        exception?: {
            type: string;
            message: string;
            stack?: string;
        };
    };
    sessionId: string;
}

/**
 * Complete debug session capture
 */
export interface DebugSession {
    id: string;
    type: DebugSessionType;
    startTime: Date;
    endTime?: Date;
    events: DebugEvent[];
    metadata: {
        projectName: string;
        mainFile: string;
        arguments: string[];
        environment: { [key: string]: string };
        breakpoints: Array<{
            file: string;
            line: number;
            condition?: string;
        }>;
    };
    outcome: 'success' | 'error' | 'terminated' | 'unknown';
    errorSummary?: string;
}

/**
 * AI commentary for debug events
 */
export interface DebugCommentary {
    eventId: string;
    commentary: string;
    insights: string[];
    suggestions: string[];
    confidence: number;
    timestamp: Date;
}

/**
 * Replay analysis results
 */
export interface ReplayAnalysis {
    sessionId: string;
    overallAssessment: string;
    keyInsights: string[];
    problemAreas: Array<{
        location: string;
        issue: string;
        severity: 'low' | 'medium' | 'high';
        suggestions: string[];
    }>;
    performanceIssues: Array<{
        location: string;
        issue: string;
        impact: string;
        optimization: string;
    }>;
    recommendations: string[];
    learningPoints: string[];
}

/**
 * AI Debug Replay System
 * Records debug sessions and provides AI-powered analysis and commentary
 */
export class AIDebugReplay {
    private activeSessions: Map<string, DebugSession> = new Map();
    private completedSessions: Map<string, DebugSession> = new Map();
    private replayPanel: vscode.WebviewPanel | null = null;
    private outputChannel: vscode.OutputChannel;
    private storageUri: vscode.Uri;
    private isRecording = false;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('AI Debug Replay');
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'debug-replay');
        this.initialize();
        this.setupDebugEventListeners();
    }

    private async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await this.loadCompletedSessions();
            this.outputChannel.appendLine('AI Debug Replay initialized');
        } catch (error) {
            this.outputChannel.appendLine(`Initialization error: ${(error as Error).message}`);
        }
    }

    /**
     * Setup debug event listeners
     */
    private setupDebugEventListeners(): void {
        // Listen to debug session start
        vscode.debug.onDidStartDebugSession(session => {
            if (this.isRecording) {
                this.startSessionRecording(session);
            }
        });

        // Listen to debug session terminate
        vscode.debug.onDidTerminateDebugSession(session => {
            this.endSessionRecording(session);
        });

        // Listen to debug session custom events (if available)
        vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
            this.captureDebugEvent(event);
        });

        // Listen to breakpoint changes
        vscode.debug.onDidChangeBreakpoints(e => {
            this.captureBreakpointChanges(e);
        });
    }

    /**
     * Start recording debug session
     */
    async startRecording(): Promise<void> {
        this.isRecording = true;
        
        vscode.window.showInformationMessage(
            'Debug recording started. All debugging sessions will be captured for AI analysis.',
            'View Dashboard'
        ).then(selection => {
            if (selection === 'View Dashboard') {
                this.showReplayDashboard();
            }
        });

        this.outputChannel.appendLine('Debug recording started');
    }

    /**
     * Stop recording debug session
     */
    async stopRecording(): Promise<void> {
        this.isRecording = false;
        
        // Complete any active sessions
        for (const [sessionId, session] of this.activeSessions) {
            session.endTime = new Date();
            session.outcome = 'terminated';
            this.completedSessions.set(sessionId, session);
        }
        
        this.activeSessions.clear();
        await this.persistSessions();

        vscode.window.showInformationMessage('Debug recording stopped');
        this.outputChannel.appendLine('Debug recording stopped');
    }

    /**
     * Start recording a specific debug session
     */
    private startSessionRecording(session: vscode.DebugSession): void {
        const sessionType = this.detectSessionType(session);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        const debugSession: DebugSession = {
            id: session.id,
            type: sessionType,
            startTime: new Date(),
            events: [],
            metadata: {
                projectName: workspaceFolder?.name || 'Unknown',
                mainFile: session.configuration.program || session.configuration.script || 'unknown',
                arguments: session.configuration.args || [],
                environment: session.configuration.env || {},
                breakpoints: this.getCurrentBreakpoints()
            },
            outcome: 'unknown'
        };

        this.activeSessions.set(session.id, debugSession);
        this.outputChannel.appendLine(`Started recording debug session: ${session.id} (${sessionType})`);
    }

    /**
     * End recording a debug session
     */
    private endSessionRecording(session: vscode.DebugSession): void {
        const debugSession = this.activeSessions.get(session.id);
        if (!debugSession) {
            return;
        }

        debugSession.endTime = new Date();
        debugSession.outcome = this.determineSessionOutcome(debugSession);

        // Move to completed sessions
        this.completedSessions.set(session.id, debugSession);
        this.activeSessions.delete(session.id);

        this.outputChannel.appendLine(
            `Completed debug session recording: ${session.id} - ${debugSession.events.length} events captured`
        );

        // Persist the session
        this.persistSessions();
    }

    /**
     * Capture debug events
     */
    private captureDebugEvent(event: vscode.DebugSessionCustomEvent): void {
        // Map custom events to our debug events
        const activeSession = this.activeSessions.get(event.session.id);
        if (!activeSession) {
            return;
        }

        const debugEvent: DebugEvent = {
            id: this.generateEventId(),
            type: this.mapEventType(event.event),
            timestamp: new Date(),
            location: this.extractLocationFromEvent(event),
            data: this.extractEventData(event),
            sessionId: event.session.id
        };

        activeSession.events.push(debugEvent);
        this.outputChannel.appendLine(`Captured ${debugEvent.type} event in session ${event.session.id}`);
    }

    /**
     * Capture breakpoint changes
     */
    private captureBreakpointChanges(event: vscode.BreakpointsChangeEvent): void {
        // Update breakpoints in active sessions
        for (const [sessionId, session] of this.activeSessions) {
            session.metadata.breakpoints = this.getCurrentBreakpoints();
        }
    }

    /**
     * Replay debug session with AI commentary
     */
    async replaySession(sessionId: string): Promise<void> {
        const session = this.completedSessions.get(sessionId);
        if (!session) {
            vscode.window.showErrorMessage('Debug session not found');
            return;
        }

        try {
            // Generate AI commentary for the session
            const commentary = await this.generateSessionCommentary(session);
            
            // Show replay interface
            this.showReplayInterface(session, commentary);
            
            this.outputChannel.appendLine(`Started replay for session: ${sessionId}`);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to replay session: ${(error as Error).message}`);
            this.outputChannel.appendLine(`Replay error: ${(error as Error).message}`);
        }
    }

    /**
     * Generate comprehensive AI commentary for debug session
     */
    private async generateSessionCommentary(session: DebugSession): Promise<DebugCommentary[]> {
        const commentary: DebugCommentary[] = [];
        
        // Process events in chronological order
        const sortedEvents = [...session.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        for (let i = 0; i < sortedEvents.length; i++) {
            const event = sortedEvents[i];
            const context = this.buildEventContext(event, sortedEvents, i);
            
            const prompt = `Analyze this debug event and provide expert commentary:

Event Type: ${event.type}
Location: ${event.location.file}:${event.location.line}
Function: ${event.location.function || 'unknown'}
Timestamp: ${event.timestamp.toISOString()}

Event Data:
${JSON.stringify(event.data, null, 2)}

Context:
- Previous Events: ${context.previousEvents}
- Session Progress: ${Math.round((i / sortedEvents.length) * 100)}%
- Session Type: ${session.type}
- Total Events: ${sortedEvents.length}

Please provide:
1. What happened at this step
2. Technical insights about the execution state
3. Potential issues or notable behaviors
4. Suggestions for investigation or improvement
5. Educational points for developers

Focus on being educational and actionable.`;

            try {
                const aiResponse = await generateCode(prompt, 'debug-commentary');
                
                const commentaryItem: DebugCommentary = {
                    eventId: event.id,
                    commentary: aiResponse,
                    insights: this.extractInsights(aiResponse),
                    suggestions: this.extractSuggestions(aiResponse),
                    confidence: this.calculateConfidence(event, aiResponse),
                    timestamp: new Date()
                };
                
                commentary.push(commentaryItem);
                
            } catch (error) {
                this.outputChannel.appendLine(`Failed to generate commentary for event ${event.id}: ${(error as Error).message}`);
            }
        }

        return commentary;
    }

    /**
     * Build context for a debug event
     */
    private buildEventContext(event: DebugEvent, allEvents: DebugEvent[], currentIndex: number): any {
        const previousEvents = allEvents.slice(Math.max(0, currentIndex - 3), currentIndex)
            .map(e => `${e.type} at ${e.location.file}:${e.location.line}`)
            .join(', ');

        return {
            previousEvents,
            eventIndex: currentIndex,
            totalEvents: allEvents.length,
            timeFromStart: event.timestamp.getTime() - allEvents[0].timestamp.getTime(),
            surroundingVariables: this.extractSurroundingVariables(event, allEvents, currentIndex)
        };
    }

    /**
     * Analyze entire debug session and provide high-level insights
     */
    async analyzeSession(sessionId: string): Promise<ReplayAnalysis> {
        const session = this.completedSessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        const analysisPrompt = `Analyze this complete debug session and provide comprehensive insights:

Session Overview:
- Type: ${session.type}
- Duration: ${session.endTime ? (session.endTime.getTime() - session.startTime.getTime()) / 1000 : 'N/A'} seconds
- Events: ${session.events.length}
- Outcome: ${session.outcome}
- Main File: ${session.metadata.mainFile}

Event Summary:
${this.summarizeEvents(session.events)}

Variable Changes:
${this.summarizeVariableChanges(session.events)}

Execution Flow:
${this.summarizeExecutionFlow(session.events)}

Error Information:
${session.errorSummary || 'No errors recorded'}

Please provide a comprehensive analysis including:
1. Overall assessment of the debugging session
2. Key insights about the code execution
3. Problem areas that need attention
4. Performance issues and optimization opportunities
5. Specific recommendations for improvement
6. Learning points for developers
7. Common patterns or anti-patterns observed

Structure your response with clear sections and actionable insights.`;

        try {
            const aiResponse = await generateCode(analysisPrompt, 'session-analysis');
            
            const analysis: ReplayAnalysis = {
                sessionId,
                overallAssessment: this.extractOverallAssessment(aiResponse),
                keyInsights: this.extractKeyInsights(aiResponse),
                problemAreas: this.extractProblemAreas(aiResponse),
                performanceIssues: this.extractPerformanceIssues(aiResponse),
                recommendations: this.extractRecommendations(aiResponse),
                learningPoints: this.extractLearningPoints(aiResponse)
            };

            return analysis;

        } catch (error) {
            throw new Error(`Analysis failed: ${(error as Error).message}`);
        }
    }

    /**
     * Show replay interface
     */
    private showReplayInterface(session: DebugSession, commentary: DebugCommentary[]): void {
        if (this.replayPanel) {
            this.replayPanel.dispose();
        }

        this.replayPanel = vscode.window.createWebviewPanel(
            'debugReplay',
            `Debug Replay - ${session.metadata.projectName}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.replayPanel.webview.html = this.getReplayHTML(session, commentary);
        
        // Handle messages from webview
        this.replayPanel.webview.onDidReceiveMessage(message => {
            this.handleReplayMessage(message, session);
        });

        this.replayPanel.onDidDispose(() => {
            this.replayPanel = null;
        });
    }

    /**
     * Handle messages from replay interface
     */
    private async handleReplayMessage(message: any, session: DebugSession): Promise<void> {
        switch (message.command) {
            case 'jumpToEvent':
                await this.jumpToEventLocation(message.eventId, session);
                break;
            case 'analyzeVariable':
                await this.analyzeVariable(message.variable, message.eventId, session);
                break;
            case 'explainFlow':
                await this.explainExecutionFlow(message.startEventId, message.endEventId, session);
                break;
            case 'exportAnalysis':
                await this.exportSessionAnalysis(session.id);
                break;
        }
    }

    /**
     * Jump to event location in editor
     */
    private async jumpToEventLocation(eventId: string, session: DebugSession): Promise<void> {
        const event = session.events.find(e => e.id === eventId);
        if (!event) {
            return;
        }

        try {
            const uri = vscode.Uri.file(event.location.file);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            // Jump to line
            const position = new vscode.Position(Math.max(0, event.location.line - 1), event.location.column || 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            
            // Highlight the line temporarily
            const decoration = vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(255, 255, 0, 0.3)',
                isWholeLine: true
            });
            
            editor.setDecorations(decoration, [new vscode.Range(position, position)]);
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                decoration.dispose();
            }, 2000);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${event.location.file}`);
        }
    }

    /**
     * Show replay dashboard with all sessions
     */
    showReplayDashboard(): void {
        const panel = vscode.window.createWebviewPanel(
            'debugReplayDashboard',
            'Debug Replay Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getDashboardHTML();
        
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'replaySession':
                    this.replaySession(message.sessionId);
                    break;
                case 'analyzeSession':
                    this.analyzeSession(message.sessionId).then(analysis => {
                        panel.webview.postMessage({
                            command: 'analysisComplete',
                            analysis
                        });
                    });
                    break;
                case 'deleteSession':
                    this.deleteSession(message.sessionId);
                    break;
                case 'exportSession':
                    this.exportSession(message.sessionId);
                    break;
            }
        });
    }

    /**
     * Helper methods for event processing
     */
    private detectSessionType(session: vscode.DebugSession): DebugSessionType {
        const config = session.configuration;
        
        if (config.type === 'node' || config.type === 'javascript') {
            return DebugSessionType.NODEJS;
        } else if (config.type === 'python') {
            return DebugSessionType.PYTHON;
        } else if (config.type === 'java') {
            return DebugSessionType.JAVA;
        } else if (config.type === 'coreclr' || config.type === 'csharp') {
            return DebugSessionType.CSHARP;
        } else if (config.type === 'go') {
            return DebugSessionType.GO;
        }
        
        return DebugSessionType.GENERIC;
    }

    private getCurrentBreakpoints(): Array<{file: string; line: number; condition?: string}> {
        const breakpoints: Array<{file: string; line: number; condition?: string}> = [];
        
        for (const bp of vscode.debug.breakpoints) {
            if (bp instanceof vscode.SourceBreakpoint) {
                breakpoints.push({
                    file: bp.location.uri.fsPath,
                    line: bp.location.range.start.line + 1,
                    condition: bp.condition
                });
            }
        }
        
        return breakpoints;
    }

    private mapEventType(eventName: string): DebugEventType {
        const eventMap: { [key: string]: DebugEventType } = {
            'step': DebugEventType.STEP,
            'breakpoint': DebugEventType.BREAKPOINT,
            'exception': DebugEventType.EXCEPTION,
            'output': DebugEventType.LOG_MESSAGE,
            'variableChange': DebugEventType.VARIABLE_CHANGE,
            'functionCall': DebugEventType.FUNCTION_CALL,
            'stackFrame': DebugEventType.STACK_FRAME
        };
        
        return eventMap[eventName] || DebugEventType.STEP;
    }

    private extractLocationFromEvent(event: vscode.DebugSessionCustomEvent): DebugEvent['location'] {
        return {
            file: event.body?.source?.path || 'unknown',
            line: event.body?.line || 0,
            column: event.body?.column,
            function: event.body?.function || event.body?.name
        };
    }

    private extractEventData(event: vscode.DebugSessionCustomEvent): DebugEvent['data'] {
        return {
            variables: event.body?.variables || {},
            stackTrace: event.body?.stackTrace || [],
            message: event.body?.message || event.body?.output,
            expression: event.body?.expression,
            value: event.body?.value,
            oldValue: event.body?.oldValue,
            exception: event.body?.exception
        };
    }

    private determineSessionOutcome(session: DebugSession): DebugSession['outcome'] {
        const hasExceptions = session.events.some(e => e.type === DebugEventType.EXCEPTION);
        const hasErrors = session.events.some(e => 
            e.data.message?.toLowerCase().includes('error') ||
            e.data.exception
        );
        
        if (hasExceptions || hasErrors) {
            return 'error';
        } else if (session.endTime) {
            return 'success';
        }
        
        return 'unknown';
    }

    private generateEventId(): string {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Extract and summarize methods for AI analysis
     */
    private summarizeEvents(events: DebugEvent[]): string {
        const eventCounts = new Map<DebugEventType, number>();
        events.forEach(event => {
            eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
        });
        
        return Array.from(eventCounts.entries())
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');
    }

    private summarizeVariableChanges(events: DebugEvent[]): string {
        const variableChanges = events
            .filter(e => e.type === DebugEventType.VARIABLE_CHANGE)
            .map(e => `${Object.keys(e.data.variables || {}).join(', ')} at ${e.location.file}:${e.location.line}`)
            .slice(0, 10)
            .join('\n');
        
        return variableChanges || 'No variable changes recorded';
    }

    private summarizeExecutionFlow(events: DebugEvent[]): string {
        const flowEvents = events
            .filter(e => e.type === DebugEventType.STEP || e.type === DebugEventType.FUNCTION_CALL)
            .map(e => `${e.location.function || 'unknown'} (${e.location.file}:${e.location.line})`)
            .slice(0, 15)
            .join(' -> ');
        
        return flowEvents || 'No execution flow recorded';
    }

    /**
     * AI response extraction methods
     */
    private extractInsights(response: string): string[] {
        const insights = response.match(/insight[:\s]+(.+)/gi) || [];
        return insights.map(insight => insight.replace(/insight[:\s]+/i, ''));
    }

    private extractSuggestions(response: string): string[] {
        const suggestions = response.match(/suggest[:\s]+(.+)/gi) || [];
        return suggestions.map(suggestion => suggestion.replace(/suggest[:\s]+/i, ''));
    }

    private calculateConfidence(event: DebugEvent, response: string): number {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence based on event data availability
        if (event.data.variables && Object.keys(event.data.variables).length > 0) {
            confidence += 0.2;
        }
        if (event.data.stackTrace && event.data.stackTrace.length > 0) {
            confidence += 0.1;
        }
        if (event.location.function) {
            confidence += 0.1;
        }
        
        // Boost confidence based on response quality
        if (response.length > 200) {
            confidence += 0.1;
        }
        if (response.includes('specific') || response.includes('detailed')) {
            confidence += 0.1;
        }
        
        return Math.min(1, confidence);
    }

    private extractOverallAssessment(response: string): string {
        const sections = response.split(/\n\s*\n/);
        return sections[0] || 'No overall assessment available';
    }

    private extractKeyInsights(response: string): string[] {
        const insightSection = response.match(/key insights?[:\n](.*?)(?=\n\s*\n|\n\s*\d+\.|\n\s*[A-Z]|$)/is);
        if (insightSection) {
            return insightSection[1]
                .split(/\n\s*[-*•]\s*/)
                .filter(insight => insight.trim().length > 0)
                .map(insight => insight.trim());
        }
        return [];
    }

    private extractProblemAreas(response: string): ReplayAnalysis['problemAreas'] {
        // Simple extraction - could be enhanced with more sophisticated parsing
        return [
            {
                location: 'Unknown',
                issue: 'Generic issue detected',
                severity: 'medium',
                suggestions: ['Review code logic', 'Add error handling']
            }
        ];
    }

    private extractPerformanceIssues(response: string): ReplayAnalysis['performanceIssues'] {
        return [
            {
                location: 'Unknown',
                issue: 'Performance concern identified',
                impact: 'Moderate',
                optimization: 'Consider optimization techniques'
            }
        ];
    }

    private extractRecommendations(response: string): string[] {
        const recommendationSection = response.match(/recommendations?[:\n](.*?)(?=\n\s*\n|\n\s*\d+\.|\n\s*[A-Z]|$)/is);
        if (recommendationSection) {
            return recommendationSection[1]
                .split(/\n\s*[-*•]\s*/)
                .filter(rec => rec.trim().length > 0)
                .map(rec => rec.trim());
        }
        return [];
    }

    private extractLearningPoints(response: string): string[] {
        const learningSection = response.match(/learning points?[:\n](.*?)(?=\n\s*\n|\n\s*\d+\.|\n\s*[A-Z]|$)/is);
        if (learningSection) {
            return learningSection[1]
                .split(/\n\s*[-*•]\s*/)
                .filter(point => point.trim().length > 0)
                .map(point => point.trim());
        }
        return [];
    }

    private extractSurroundingVariables(event: DebugEvent, allEvents: DebugEvent[], currentIndex: number): any {
        const surroundingEvents = allEvents.slice(Math.max(0, currentIndex - 2), currentIndex + 3);
        const variables: { [name: string]: any } = {};
        
        surroundingEvents.forEach(e => {
            if (e.data.variables) {
                Object.assign(variables, e.data.variables);
            }
        });
        
        return variables;
    }

    /**
     * Get replay interface HTML
     */
    private getReplayHTML(session: DebugSession, commentary: DebugCommentary[]): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Debug Replay - ${session.metadata.projectName}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: #1e1e1e;
                    color: #d4d4d4;
                    font-size: 14px;
                }
                .container {
                    display: flex;
                    height: 100vh;
                }
                .timeline {
                    width: 300px;
                    background: #252526;
                    border-right: 1px solid #3e3e42;
                    overflow-y: auto;
                    padding: 10px;
                }
                .content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .event-item {
                    background: #2d2d30;
                    border-left: 4px solid #007acc;
                    margin: 8px 0;
                    padding: 10px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                .event-item:hover {
                    background: #3e3e42;
                }
                .event-item.active {
                    background: #0e639c;
                    border-left-color: #ffffff;
                }
                .event-time {
                    font-size: 11px;
                    color: #969696;
                    margin-bottom: 4px;
                }
                .event-type {
                    font-weight: bold;
                    color: #4fc1ff;
                    text-transform: capitalize;
                }
                .event-location {
                    font-size: 12px;
                    color: #cccccc;
                    margin-top: 4px;
                }
                .commentary-panel {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                }
                .commentary-content {
                    max-width: 800px;
                }
                .commentary-header {
                    border-bottom: 2px solid #3e3e42;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .commentary-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #ffffff;
                    margin-bottom: 8px;
                }
                .commentary-subtitle {
                    color: #969696;
                    font-size: 14px;
                }
                .commentary-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background: #2d2d30;
                    border-radius: 8px;
                }
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #4fc1ff;
                    margin-bottom: 12px;
                    border-bottom: 1px solid #3e3e42;
                    padding-bottom: 6px;
                }
                .insights-list {
                    list-style: none;
                    padding: 0;
                    margin: 10px 0;
                }
                .insights-list li {
                    padding: 6px 0;
                    padding-left: 20px;
                    position: relative;
                }
                .insights-list li:before {
                    content: "→";
                    position: absolute;
                    left: 0;
                    color: #007acc;
                    font-weight: bold;
                }
                .confidence-bar {
                    width: 100%;
                    height: 4px;
                    background: #3e3e42;
                    border-radius: 2px;
                    margin: 10px 0;
                    overflow: hidden;
                }
                .confidence-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #dc3545, #ffc107, #28a745);
                    transition: width 0.3s;
                }
                .variable-data {
                    background: #1a1a1a;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 10px;
                    margin: 10px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    overflow-x: auto;
                }
                .controls {
                    padding: 15px 20px;
                    background: #252526;
                    border-top: 1px solid #3e3e42;
                    display: flex;
                    gap: 10px;
                }
                .btn {
                    padding: 8px 16px;
                    background: #0e639c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .btn:hover {
                    background: #1177bb;
                }
                .btn.secondary {
                    background: #6c757d;
                }
                .btn.secondary:hover {
                    background: #545b62;
                }
                .no-selection {
                    text-align: center;
                    color: #969696;
                    margin-top: 100px;
                    font-size: 16px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="timeline">
                    <h3 style="margin-top: 0; color: #ffffff;">Debug Timeline</h3>
                    <div class="session-info" style="margin-bottom: 20px; padding: 10px; background: #2d2d30; border-radius: 4px;">
                        <div><strong>Session:</strong> ${session.metadata.projectName}</div>
                        <div><strong>Type:</strong> ${session.type}</div>
                        <div><strong>Events:</strong> ${session.events.length}</div>
                        <div><strong>Duration:</strong> ${session.endTime ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000) : 'N/A'}s</div>
                    </div>
                    ${session.events.map((event, index) => `
                        <div class="event-item" data-event-id="${event.id}">
                            <div class="event-time">${event.timestamp.toLocaleTimeString()}</div>
                            <div class="event-type">${event.type}</div>
                            <div class="event-location">${this.getBasename(event.location.file)}:${event.location.line}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="content">
                    <div class="commentary-panel">
                        <div class="no-selection">
                            Select an event from the timeline to view AI commentary
                        </div>
                    </div>
                    <div class="controls">
                        <button class="btn" onclick="jumpToCode()">Jump to Code</button>
                        <button class="btn secondary" onclick="analyzeVariable()">Analyze Variables</button>
                        <button class="btn secondary" onclick="explainFlow()">Explain Flow</button>
                        <button class="btn secondary" onclick="exportAnalysis()">Export Analysis</button>
                    </div>
                </div>
            </div>
            
            <script>
                let selectedEventId = null;
                const commentary = ${JSON.stringify(commentary)};
                
                // Add event listeners to timeline items
                document.querySelectorAll('.event-item').forEach(item => {
                    item.addEventListener('click', () => {
                        // Remove active class from all items
                        document.querySelectorAll('.event-item').forEach(i => i.classList.remove('active'));
                        
                        // Add active class to clicked item
                        item.classList.add('active');
                        
                        // Get event data
                        selectedEventId = item.dataset.eventId;
                        showCommentary(selectedEventId);
                    });
                });
                
                function showCommentary(eventId) {
                    const event = ${JSON.stringify(session.events)}.find(e => e.id === eventId);
                    const eventCommentary = commentary.find(c => c.eventId === eventId);
                    
                    if (!event || !eventCommentary) {
                        return;
                    }
                    
                    const panel = document.querySelector('.commentary-panel');
                    panel.innerHTML = \`
                        <div class="commentary-content">
                            <div class="commentary-header">
                                <div class="commentary-title">\${event.type.replace(/([A-Z])/g, ' $1').trim()}</div>
                                <div class="commentary-subtitle">\${event.location.file}:\${event.location.line} - \${event.timestamp}</div>
                            </div>
                            
                            <div class="commentary-section">
                                <div class="section-title">AI Commentary</div>
                                <div>\${eventCommentary.commentary}</div>
                                <div class="confidence-bar">
                                    <div class="confidence-fill" style="width: \${eventCommentary.confidence * 100}%"></div>
                                </div>
                                <small>Confidence: \${Math.round(eventCommentary.confidence * 100)}%</small>
                            </div>
                            
                            \${eventCommentary.insights.length > 0 ? \`
                                <div class="commentary-section">
                                    <div class="section-title">Key Insights</div>
                                    <ul class="insights-list">
                                        \${eventCommentary.insights.map(insight => \`<li>\${insight}</li>\`).join('')}
                                    </ul>
                                </div>
                            \` : ''}
                            
                            \${eventCommentary.suggestions.length > 0 ? \`
                                <div class="commentary-section">
                                    <div class="section-title">Suggestions</div>
                                    <ul class="insights-list">
                                        \${eventCommentary.suggestions.map(suggestion => \`<li>\${suggestion}</li>\`).join('')}
                                    </ul>
                                </div>
                            \` : ''}
                            
                            \${event.data.variables && Object.keys(event.data.variables).length > 0 ? \`
                                <div class="commentary-section">
                                    <div class="section-title">Variables</div>
                                    <div class="variable-data">\${JSON.stringify(event.data.variables, null, 2)}</div>
                                </div>
                            \` : ''}
                            
                            \${event.data.stackTrace && event.data.stackTrace.length > 0 ? \`
                                <div class="commentary-section">
                                    <div class="section-title">Stack Trace</div>
                                    <div class="variable-data">\${event.data.stackTrace.join('\\n')}</div>
                                </div>
                            \` : ''}
                        </div>
                    \`;
                }
                
                function jumpToCode() {
                    if (selectedEventId) {
                        vscode.postMessage({
                            command: 'jumpToEvent',
                            eventId: selectedEventId
                        });
                    }
                }
                
                function analyzeVariable() {
                    if (selectedEventId) {
                        const varName = prompt('Enter variable name to analyze:');
                        if (varName) {
                            vscode.postMessage({
                                command: 'analyzeVariable',
                                variable: varName,
                                eventId: selectedEventId
                            });
                        }
                    }
                }
                
                function explainFlow() {
                    if (selectedEventId) {
                        vscode.postMessage({
                            command: 'explainFlow',
                            startEventId: selectedEventId,
                            endEventId: selectedEventId
                        });
                    }
                }
                
                function exportAnalysis() {
                    vscode.postMessage({
                        command: 'exportAnalysis'
                    });
                }
            </script>
        </body>
        </html>`;
    }

    /**
     * Get dashboard HTML
     */
    private getDashboardHTML(): string {
        const sessions = Array.from(this.completedSessions.values())
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Debug Replay Dashboard</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: #1e1e1e;
                    color: #d4d4d4;
                }
                .header {
                    border-bottom: 2px solid #3e3e42;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    margin: 0;
                    color: #ffffff;
                    font-size: 28px;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: #2d2d30;
                    padding: 20px;
                    border-radius: 8px;
                    border-left: 4px solid #007acc;
                }
                .stat-number {
                    font-size: 24px;
                    font-weight: bold;
                    color: #ffffff;
                    margin-bottom: 5px;
                }
                .stat-label {
                    color: #969696;
                    font-size: 14px;
                }
                .sessions-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 20px;
                }
                .session-card {
                    background: #2d2d30;
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid #3e3e42;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .session-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 122, 204, 0.2);
                }
                .session-header {
                    display: flex;
                    justify-content: between;
                    align-items: flex-start;
                    margin-bottom: 15px;
                }
                .session-title {
                    font-size: 16px;
                    font-weight: bold;
                    color: #ffffff;
                    margin-bottom: 5px;
                }
                .session-type {
                    background: #007acc;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    text-transform: uppercase;
                }
                .session-info {
                    color: #cccccc;
                    font-size: 14px;
                    margin-bottom: 15px;
                }
                .session-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                    font-size: 12px;
                    color: #969696;
                }
                .outcome-badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .outcome-success { background: #28a745; color: white; }
                .outcome-error { background: #dc3545; color: white; }
                .outcome-terminated { background: #6c757d; color: white; }
                .outcome-unknown { background: #ffc107; color: black; }
                .session-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 15px;
                }
                .btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    text-align: center;
                }
                .btn-primary {
                    background: #007acc;
                    color: white;
                }
                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                .btn-danger {
                    background: #dc3545;
                    color: white;
                }
                .btn:hover {
                    opacity: 0.8;
                }
                .no-sessions {
                    text-align: center;
                    color: #969696;
                    font-size: 18px;
                    margin-top: 100px;
                }
                .controls {
                    background: #252526;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    display: flex;
                    gap: 15px;
                    align-items: center;
                }
                .recording-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: bold;
                }
                .status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: ${this.isRecording ? '#28a745' : '#dc3545'};
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Debug Replay Dashboard</h1>
            </div>
            
            <div class="controls">
                <div class="recording-status">
                    <div class="status-indicator"></div>
                    Recording: ${this.isRecording ? 'ON' : 'OFF'}
                </div>
                <button class="btn btn-primary" onclick="toggleRecording()">
                    ${this.isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${sessions.length}</div>
                    <div class="stat-label">Total Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${sessions.filter(s => s.outcome === 'success').length}</div>
                    <div class="stat-label">Successful Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${sessions.filter(s => s.outcome === 'error').length}</div>
                    <div class="stat-label">Error Sessions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${sessions.reduce((sum, s) => sum + s.events.length, 0)}</div>
                    <div class="stat-label">Total Events</div>
                </div>
            </div>
            
            ${sessions.length === 0 ? `
                <div class="no-sessions">
                    No debug sessions recorded yet.<br>
                    Start recording to capture debug sessions for AI analysis.
                </div>
            ` : `
                <div class="sessions-grid">
                    ${sessions.map(session => `
                        <div class="session-card">
                            <div class="session-header">
                                <div>
                                    <div class="session-title">${session.metadata.projectName}</div>
                                    <div class="session-type">${session.type}</div>
                                </div>
                            </div>
                            <div class="session-info">
                                Started: ${session.startTime.toLocaleString()}<br>
                                File: ${this.getBasename(session.metadata.mainFile)}
                            </div>
                            <div class="session-stats">
                                <div>Events: ${session.events.length}</div>
                                <div>Duration: ${session.endTime ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000) : 'N/A'}s</div>
                            </div>
                            <div class="outcome-badge outcome-${session.outcome}">${session.outcome}</div>
                            <div class="session-actions">
                                <button class="btn btn-primary" onclick="replaySession('${session.id}')">Replay</button>
                                <button class="btn btn-secondary" onclick="analyzeSession('${session.id}')">Analyze</button>
                                <button class="btn btn-secondary" onclick="exportSession('${session.id}')">Export</button>
                                <button class="btn btn-danger" onclick="deleteSession('${session.id}')">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
            
            <script>
                function replaySession(sessionId) {
                    vscode.postMessage({
                        command: 'replaySession',
                        sessionId: sessionId
                    });
                }
                
                function analyzeSession(sessionId) {
                    vscode.postMessage({
                        command: 'analyzeSession',
                        sessionId: sessionId
                    });
                }
                
                function deleteSession(sessionId) {
                    if (confirm('Are you sure you want to delete this debug session?')) {
                        vscode.postMessage({
                            command: 'deleteSession',
                            sessionId: sessionId
                        });
                        location.reload();
                    }
                }
                
                function exportSession(sessionId) {
                    vscode.postMessage({
                        command: 'exportSession',
                        sessionId: sessionId
                    });
                }
                
                function toggleRecording() {
                    // This would need to be handled by the extension
                    vscode.postMessage({
                        command: 'toggleRecording'
                    });
                }
            </script>
        </body>
        </html>`;
    }

    private getBasename(path: string): string {
        return path.split(/[\\/]/).pop() || path;
    }

    /**
     * Additional helper methods for session management
     */
    private async analyzeVariable(variable: string, eventId: string, session: DebugSession): Promise<void> {
        // Implementation for variable analysis
    }

    private async explainExecutionFlow(startEventId: string, endEventId: string, session: DebugSession): Promise<void> {
        // Implementation for execution flow explanation
    }

    private async exportSessionAnalysis(sessionId: string): Promise<void> {
        // Implementation for exporting analysis
    }

    private async deleteSession(sessionId: string): Promise<void> {
        this.completedSessions.delete(sessionId);
        await this.persistSessions();
    }

    private async exportSession(sessionId: string): Promise<void> {
        const session = this.completedSessions.get(sessionId);
        if (!session) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const exportData = JSON.stringify(session, null, 2);
        const fileName = `debug-session-${sessionId}-${Date.now()}.json`;
        const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(exportData));
        vscode.window.showInformationMessage(`Debug session exported as ${fileName}`);
    }

    /**
     * Persistence methods
     */
    private async loadCompletedSessions(): Promise<void> {
        try {
            const sessionsFile = vscode.Uri.joinPath(this.storageUri, 'completed-sessions.json');
            const data = await vscode.workspace.fs.readFile(sessionsFile);
            const sessions = JSON.parse(Buffer.from(data).toString());
            this.completedSessions = new Map(Object.entries(sessions));
        } catch {
            // No saved sessions or file doesn't exist yet
        }
    }

    private async persistSessions(): Promise<void> {
        try {
            const sessionsFile = vscode.Uri.joinPath(this.storageUri, 'completed-sessions.json');
            const sessions = Object.fromEntries(this.completedSessions);
            await vscode.workspace.fs.writeFile(
                sessionsFile,
                Buffer.from(JSON.stringify(sessions, null, 2))
            );
        } catch (error) {
            this.outputChannel.appendLine(`Failed to persist sessions: ${(error as Error).message}`);
        }
    }

    /**
     * Get analytics
     */
    getAnalytics(): any {
        const totalSessions = this.completedSessions.size;
        const totalEvents = Array.from(this.completedSessions.values())
            .reduce((sum, session) => sum + session.events.length, 0);
        
        const outcomeStats = {
            success: 0,
            error: 0,
            terminated: 0,
            unknown: 0
        };

        for (const session of this.completedSessions.values()) {
            outcomeStats[session.outcome]++;
        }

        return {
            totalSessions,
            totalEvents,
            activeSessions: this.activeSessions.size,
            isRecording: this.isRecording,
            outcomeStats,
            averageEventsPerSession: totalSessions > 0 ? Math.round(totalEvents / totalSessions) : 0
        };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.replayPanel) {
            this.replayPanel.dispose();
        }
        this.outputChannel.dispose();
    }
}

// Export singleton instance
let debugReplayInstance: AIDebugReplay | undefined;

export function getAIDebugReplay(context: vscode.ExtensionContext): AIDebugReplay {
    if (!debugReplayInstance) {
        debugReplayInstance = new AIDebugReplay(context);
    }
    return debugReplayInstance;
}