import * as vscode from 'vscode';

/**
 * Message types for sidebar chat
 */
export type MessageType = 'info' | 'success' | 'warning' | 'error' | 'system' | 'progress';

/**
 * Message structure
 */
export interface ChatMessage {
    type: MessageType;
    content: string;
    timestamp: Date;
    metadata?: any;
}

/**
 * Sidebar Chat Messenger
 * 
 * Handles sending progress updates and messages to the sidebar chat panel.
 * Integrates with the existing chat panel system.
 */
export class SidebarChatMessenger {
    private messageHistory: ChatMessage[] = [];
    private maxHistorySize: number = 100;

    constructor(private chatPanel?: any) {
        // chatPanel is the existing sidebar chat panel instance
    }

    /**
     * Send a message to the sidebar chat
     */
    public async sendMessage(content: string, type: MessageType = 'info', metadata?: any): Promise<void> {
        const message: ChatMessage = {
            type,
            content,
            timestamp: new Date(),
            metadata
        };

        // Add to history
        this.messageHistory.push(message);
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory.shift();
        }

        // Send to chat panel if available
        if (this.chatPanel) {
            await this.sendToChatPanel(message);
        } else {
            // Fallback to output channel
            this.sendToOutputChannel(message);
        }
    }

    /**
     * Send progress update
     */
    public async sendProgress(
        current: number,
        total: number,
        message: string,
        metadata?: any
    ): Promise<void> {
        const percentage = Math.round((current / total) * 100);
        const progressMessage = `[${current}/${total}] ${percentage}% - ${message}`;
        
        await this.sendMessage(progressMessage, 'progress', {
            current,
            total,
            percentage,
            ...metadata
        });
    }

    /**
     * Send error message
     */
    public async sendError(error: Error | string, context?: string): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : error;
        const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;
        
        await this.sendMessage(fullMessage, 'error', {
            error: error instanceof Error ? error.stack : undefined,
            context
        });
    }

    /**
     * Send success message
     */
    public async sendSuccess(message: string, metadata?: any): Promise<void> {
        await this.sendMessage(message, 'success', metadata);
    }

    /**
     * Send info message
     */
    public async sendInfo(message: string, metadata?: any): Promise<void> {
        await this.sendMessage(message, 'info', metadata);
    }

    /**
     * Send warning message
     */
    public async sendWarning(message: string, metadata?: any): Promise<void> {
        await this.sendMessage(message, 'warning', metadata);
    }

    /**
     * Send system message
     */
    public async sendSystem(message: string, metadata?: any): Promise<void> {
        await this.sendMessage(message, 'system', metadata);
    }

    /**
     * Send formatted code block
     */
    public async sendCodeBlock(code: string, language: string = '', title?: string): Promise<void> {
        const formattedCode = `\`\`\`${language}\n${code}\n\`\`\``;
        const message = title ? `**${title}**\n${formattedCode}` : formattedCode;
        
        await this.sendMessage(message, 'info', { code, language });
    }

    /**
     * Send batch of messages
     */
    public async sendBatch(messages: Array<{ content: string; type: MessageType }>): Promise<void> {
        for (const msg of messages) {
            await this.sendMessage(msg.content, msg.type);
        }
    }

    /**
     * Send to chat panel
     */
    private async sendToChatPanel(message: ChatMessage): Promise<void> {
        try {
            // Format message for chat panel
            const formattedMessage = this.formatMessageForChat(message);

            // If chat panel has a method to receive messages
            if (typeof this.chatPanel?.addMessage === 'function') {
                await this.chatPanel.addMessage(formattedMessage);
            } else if (typeof this.chatPanel?.postMessage === 'function') {
                await this.chatPanel.postMessage({
                    type: 'addMessage',
                    message: formattedMessage
                });
            } else if (typeof this.chatPanel?._panel?.webview?.postMessage === 'function') {
                // Direct webview access
                await this.chatPanel._panel.webview.postMessage({
                    type: 'addMessage',
                    message: formattedMessage
                });
            } else {
                // Fallback to output channel
                this.sendToOutputChannel(message);
            }
        } catch (error) {
            // Fallback to output channel on error
            this.sendToOutputChannel(message);
        }
    }

    /**
     * Format message for chat display
     */
    private formatMessageForChat(message: ChatMessage): any {
        const icon = this.getIconForType(message.type);
        const timestamp = message.timestamp.toLocaleTimeString();

        return {
            role: 'assistant',
            content: `${icon} ${message.content}`,
            timestamp: message.timestamp.toISOString(),
            metadata: {
                type: message.type,
                ...message.metadata
            }
        };
    }

    /**
     * Get icon for message type
     */
    private getIconForType(type: MessageType): string {
        const icons: Record<MessageType, string> = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            system: '🔧',
            progress: '⏳'
        };
        return icons[type] || 'ℹ️';
    }

    /**
     * Send to output channel (fallback)
     */
    private sendToOutputChannel(message: ChatMessage): void {
        const channel = this.getOutputChannel();
        const timestamp = message.timestamp.toLocaleTimeString();
        const typeLabel = message.type.toUpperCase();
        
        channel.appendLine(`[${timestamp}] [${typeLabel}] ${message.content}`);
    }

    /**
     * Get or create output channel
     */
    private getOutputChannel(): vscode.OutputChannel {
        if (!SidebarChatMessenger.outputChannel) {
            SidebarChatMessenger.outputChannel = vscode.window.createOutputChannel('Continuous Error Fixer');
        }
        return SidebarChatMessenger.outputChannel;
    }

    private static outputChannel: vscode.OutputChannel | null = null;

    /**
     * Get message history
     */
    public getHistory(count?: number): ChatMessage[] {
        if (count) {
            return this.messageHistory.slice(-count);
        }
        return [...this.messageHistory];
    }

    /**
     * Clear message history
     */
    public clearHistory(): void {
        this.messageHistory = [];
    }

    /**
     * Get messages by type
     */
    public getMessagesByType(type: MessageType): ChatMessage[] {
        return this.messageHistory.filter(msg => msg.type === type);
    }

    /**
     * Get statistics
     */
    public getStats(): Record<MessageType, number> {
        const stats: Record<MessageType, number> = {
            info: 0,
            success: 0,
            warning: 0,
            error: 0,
            system: 0,
            progress: 0
        };

        for (const message of this.messageHistory) {
            stats[message.type]++;
        }

        return stats;
    }

    /**
     * Export message history
     */
    public exportHistory(): string {
        return this.messageHistory
            .map(msg => {
                const timestamp = msg.timestamp.toLocaleString();
                return `[${timestamp}] [${msg.type.toUpperCase()}] ${msg.content}`;
            })
            .join('\n');
    }

    /**
     * Set chat panel (for late binding)
     */
    public setChatPanel(chatPanel: any): void {
        this.chatPanel = chatPanel;
    }

    /**
     * Show output channel
     */
    public showOutputChannel(): void {
        this.getOutputChannel().show();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.messageHistory = [];
    }
}
