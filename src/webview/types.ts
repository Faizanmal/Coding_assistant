// TypeScript types and interfaces for webview communication
import * as vscode from 'vscode';

// Base message types for webview communication
export interface BaseWebviewMessage {
    command: string;
    [key: string]: any;
}

// Message types from webview to extension
export interface SendPromptMessage extends BaseWebviewMessage {
    command: 'sendPrompt';
    text: string;
    provider: string;
    model: string;
    useWeb: boolean;
    codeOnly?: boolean;
}

export interface DeleteMessageMessage extends BaseWebviewMessage {
    command: 'deleteMessage';
    index: number;
}

export interface TerminalCommandMessage extends BaseWebviewMessage {
    command: 'executeShellCommand' | 'killCommand' | 'createTerminalSession';
    sessionId?: string;
    sessionName?: string;
    commandText?: string;
}

export interface StatusRequestMessage extends BaseWebviewMessage {
    command: 'getTerminalStatus' | 'getRecentCommands' | 'getFrequentCommands' | 'getHistoryStats' | 'exportHistory' | 'clearHistory';
    limit?: number;
    query?: string;
}

export interface ProductivityMessage extends BaseWebviewMessage {
    command: 'getTodayStats' | 'getWeeklyTrend' | 'generateProductivityReport' | 'getProductivityMetrics' | 'clearProductivityData';
}

export interface CodeAnalysisMessage extends BaseWebviewMessage {
    command: 'analyzeCurrentFile' | 'analyzeWorkspace' | 'generateCodeQualityReport';
}

export interface CoordinationMessage extends BaseWebviewMessage {
    command: 'getCoordinationStatus' | 'acceptBatchOperation' | 'rejectBatchOperation';
    operationId?: string;
}

export interface DebugLogMessage extends BaseWebviewMessage {
    command: 'debugLog';
    message: string;
}

export interface WebviewErrorMessage extends BaseWebviewMessage {
    command: 'webviewError';
    error: string;
    stack?: string;
}

export interface WebviewReadyMessage extends BaseWebviewMessage {
    command: 'webviewReady';
    timestamp?: string;
}

// Message types from extension to webview
export interface WebviewUpdateMessage {
    command: 'setupEventListeners' | 'shellResult' | 'shellError';
    result?: any;
    error?: string;
}

export interface StatusUpdateMessage {
    type: 'statusUpdate';
    status: 'idle' | 'running' | 'error';
    runningCommands?: number;
}

export interface CoordinationStatusMessage {
    type: 'coordinationStatus';
    data: {
        agents: Array<[string, any]>;
        activeOperations: Array<[string, any]>;
        conflictHistory: any[];
        systemStatus: any;
    };
}

// Chat history types
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sessionId?: string;
}

export interface ChatHistory extends Array<ChatMessage> {}

// Provider and model configuration
export interface ProviderConfig {
    [provider: string]: {
        [modelKey: string]: string;
    };
}

// Terminal session types
export interface TerminalSession {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'error';
    created: number;
    lastCommand?: string;
}

export interface TerminalStatus {
    status: 'idle' | 'running' | 'error';
    runningCommands: number;
    activeSessions: TerminalSession[];
}

// Command history types
export interface CommandHistoryEntry {
    command: string;
    timestamp: Date;
    sessionName: string;
    exitCode?: number;
    workingDirectory?: string;
}

// Productivity tracking types
export interface ProductivityStats {
    codingTime: number;
    linesWritten: number;
    filesModified: number;
    sessionsCount: number;
    languages: string[];
}

export interface WeeklyTrendData {
    date: string;
    duration: number;
    productivity: number;
}

// Code smell detection types
export interface CodeSmell {
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    line: number;
    message: string;
    suggestion: string;
}

export interface CodeAnalysisResult {
    file: string;
    overallScore: number;
    totalSmells: number;
    criticalSmells: number;
    smells: CodeSmell[];
    summary: string;
}

// Multi-agent coordination types
export interface AgentOperation {
    id: string;
    fileName: string;
    operation: string;
    agent: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    linesProcessed?: number;
    totalLines?: number;
}

export interface BatchOperation {
    id: string;
    description: string;
    agent?: string;
    files: string[];
}

export interface EditUpdate {
    fileName: string;
    line: number;
    action: 'created' | 'added' | 'removed' | 'modified';
    content: string;
    color: string;
    linesAdded?: number;
    linesRemoved?: number;
}

// File generation types
export interface FileGenerationRequest {
    fileName: string;
    prompt: string;
    fileType?: string;
}

// Webview provider interface extensions
export interface EnhancedWebviewViewProvider extends vscode.WebviewViewProvider {
    clearChatHistory(): Promise<void>;
    updateTerminalStatus?(status: TerminalStatus): void;
    showProgressUpdate?(operation: AgentOperation): void;
    showBatchSummary?(operation: BatchOperation, files: any[]): void;
}

// State management types
export interface WebviewState {
    selectedProvider?: string;
    selectedModel?: string;
    theme?: 'light' | 'dark';
    terminalSessions?: TerminalSession[];
    chatHistory?: ChatHistory;
}

// Configuration types
export interface SidebarConfig {
    enableHighlightIntegration: boolean;
    maxChatHistory: number;
    terminalTimeout: number;
    enableAdvancedFeatures: boolean;
    theme: 'light' | 'dark';
}

// Event handler types
export type MessageHandler<T extends BaseWebviewMessage = BaseWebviewMessage> = (
    message: T,
    view: vscode.WebviewView,
    context: vscode.ExtensionContext
) => Promise<void> | void;

export interface MessageHandlerRegistry {
    [command: string]: MessageHandler;
}

// HTML generation types
export interface WebviewHtmlOptions {
    chatBody?: string;
    theme?: 'light' | 'dark';
    enableHighlight?: boolean;
    customStyles?: string;
    customScripts?: string;
}

export interface ClearChatHistoryMessage extends BaseWebviewMessage {
    command: 'clearChatHistory';
}

export interface RefreshCodebaseMessage extends BaseWebviewMessage {
    command: 'refreshCodebase';
}

// Utility types
export type WebviewMessageType = 
    | SendPromptMessage
    | DeleteMessageMessage
    | TerminalCommandMessage
    | StatusRequestMessage
    | ProductivityMessage
    | CodeAnalysisMessage
    | CoordinationMessage
    | ClearChatHistoryMessage
    | RefreshCodebaseMessage;
    
// Include commonly used debug and lifecycle messages from the webview
export type WebviewLifecycleMessageType =
    | DebugLogMessage
    | WebviewErrorMessage
    | WebviewReadyMessage;

export type AllWebviewMessageType = WebviewMessageType | WebviewLifecycleMessageType;

export type ExtensionMessageType = 
    | WebviewUpdateMessage
    | StatusUpdateMessage
    | CoordinationStatusMessage;