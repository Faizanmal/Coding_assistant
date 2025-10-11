import * as vscode from 'vscode';

/**
 * File Access Request
 */
interface FileAccessRequest {
    agentId: string;
    filePath: string;
    timestamp: number;
}

/**
 * Agent Coordinator
 * 
 * Manages coordination between Looping and Replacing agents.
 * Ensures no file conflicts and maintains file access control.
 */
export class AgentCoordinator {
    private fileAccessMap: Map<string, string> = new Map(); // filePath -> agentId
    private accessQueue: Map<string, FileAccessRequest[]> = new Map(); // filePath -> queue
    private agentRegistry: Map<string, any> = new Map(); // agentId -> agent info

    /**
     * Request access to a file
     */
    public async requestFileAccess(agentId: string, filePath: string): Promise<boolean> {
        const normalizedPath = this.normalizePath(filePath);

        // Check if file is currently being accessed
        if (this.fileAccessMap.has(normalizedPath)) {
            const currentAgent = this.fileAccessMap.get(normalizedPath);
            
            // If same agent, allow access
            if (currentAgent === agentId) {
                return true;
            }

            // Different agent - add to queue
            await this.addToQueue(agentId, normalizedPath);
            return false;
        }

        // Grant access
        this.fileAccessMap.set(normalizedPath, agentId);
        this.registerAccess(agentId, normalizedPath);
        
        return true;
    }

    /**
     * Release access to a file
     */
    public async releaseFileAccess(agentId: string, filePath: string): Promise<void> {
        const normalizedPath = this.normalizePath(filePath);

        // Verify the agent has access
        const currentAgent = this.fileAccessMap.get(normalizedPath);
        if (currentAgent !== agentId) {
            return;
        }

        // Release access
        this.fileAccessMap.delete(normalizedPath);
        this.unregisterAccess(agentId, normalizedPath);

        // Process queue
        await this.processQueue(normalizedPath);
    }

    /**
     * Add agent to access queue
     */
    private async addToQueue(agentId: string, filePath: string): Promise<void> {
        if (!this.accessQueue.has(filePath)) {
            this.accessQueue.set(filePath, []);
        }

        const queue = this.accessQueue.get(filePath)!;
        
        // Check if already in queue
        if (queue.some(req => req.agentId === agentId)) {
            return;
        }

        queue.push({
            agentId,
            filePath,
            timestamp: Date.now()
        });
    }

    /**
     * Process the access queue for a file
     */
    private async processQueue(filePath: string): Promise<void> {
        const queue = this.accessQueue.get(filePath);
        
        if (!queue || queue.length === 0) {
            return;
        }

        // Get the next request
        const nextRequest = queue.shift()!;

        // Grant access to next agent
        this.fileAccessMap.set(filePath, nextRequest.agentId);
        this.registerAccess(nextRequest.agentId, filePath);

        // Notify the agent (if notification system is available)
        // This would trigger the agent to retry its operation
    }

    /**
     * Check if a file is currently being modified
     */
    public isFileBeingModified(filePath: string): boolean {
        const normalizedPath = this.normalizePath(filePath);
        return this.fileAccessMap.has(normalizedPath);
    }

    /**
     * Get the agent currently accessing a file
     */
    public getFileAccessAgent(filePath: string): string | undefined {
        const normalizedPath = this.normalizePath(filePath);
        return this.fileAccessMap.get(normalizedPath);
    }

    /**
     * Register an agent
     */
    public registerAgent(agentId: string, agentType: 'looping' | 'replacing', metadata?: any): void {
        this.agentRegistry.set(agentId, {
            agentId,
            type: agentType,
            metadata: metadata || {},
            registeredAt: Date.now(),
            fileAccesses: []
        });
    }

    /**
     * Unregister an agent
     */
    public unregisterAgent(agentId: string): void {
        // Release all file accesses for this agent
        const agentInfo = this.agentRegistry.get(agentId);
        if (agentInfo) {
            for (const filePath of agentInfo.fileAccesses) {
                this.releaseFileAccess(agentId, filePath);
            }
        }

        this.agentRegistry.delete(agentId);
    }

    /**
     * Register file access for an agent
     */
    private registerAccess(agentId: string, filePath: string): void {
        const agentInfo = this.agentRegistry.get(agentId);
        if (agentInfo && !agentInfo.fileAccesses.includes(filePath)) {
            agentInfo.fileAccesses.push(filePath);
        }
    }

    /**
     * Unregister file access for an agent
     */
    private unregisterAccess(agentId: string, filePath: string): void {
        const agentInfo = this.agentRegistry.get(agentId);
        if (agentInfo) {
            agentInfo.fileAccesses = agentInfo.fileAccesses.filter((fp: string) => fp !== filePath);
        }
    }

    /**
     * Get all active agents
     */
    public getActiveAgents(): any[] {
        return Array.from(this.agentRegistry.values());
    }

    /**
     * Get agent information
     */
    public getAgentInfo(agentId: string): any | undefined {
        return this.agentRegistry.get(agentId);
    }

    /**
     * Check for potential conflicts
     */
    public async detectConflicts(agentId: string, filePath: string): Promise<string[]> {
        const conflicts: string[] = [];
        const normalizedPath = this.normalizePath(filePath);

        // Check if file is being accessed
        if (this.fileAccessMap.has(normalizedPath)) {
            const currentAgent = this.fileAccessMap.get(normalizedPath);
            if (currentAgent !== agentId) {
                conflicts.push(`File is currently being modified by agent ${currentAgent}`);
            }
        }

        // Check for pending changes in VS Code
        const document = await this.getDocument(filePath);
        if (document && document.isDirty) {
            conflicts.push('File has unsaved changes');
        }

        // Check if file is in conflict state (git)
        if (await this.isFileInGitConflict(filePath)) {
            conflicts.push('File is in git merge conflict state');
        }

        return conflicts;
    }

    /**
     * Safely wait for file access
     */
    public async waitForFileAccess(
        agentId: string,
        filePath: string,
        maxWaitTime: number = 30000
    ): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const hasAccess = await this.requestFileAccess(agentId, filePath);
            if (hasAccess) {
                return true;
            }

            // Wait before retrying
            await this.sleep(1000);
        }

        return false;
    }

    /**
     * Get coordination statistics
     */
    public getStats(): {
        activeFileAccesses: number;
        queuedRequests: number;
        registeredAgents: number;
    } {
        let totalQueuedRequests = 0;
        for (const queue of this.accessQueue.values()) {
            totalQueuedRequests += queue.length;
        }

        return {
            activeFileAccesses: this.fileAccessMap.size,
            queuedRequests: totalQueuedRequests,
            registeredAgents: this.agentRegistry.size
        };
    }

    /**
     * Helper: Normalize file path
     */
    private normalizePath(filePath: string): string {
        return filePath.replace(/\\/g, '/').toLowerCase();
    }

    /**
     * Helper: Get document
     */
    private async getDocument(filePath: string): Promise<vscode.TextDocument | undefined> {
        try {
            const uri = vscode.Uri.file(filePath);
            return await vscode.workspace.openTextDocument(uri);
        } catch {
            return undefined;
        }
    }

    /**
     * Helper: Check if file is in git conflict
     */
    private async isFileInGitConflict(filePath: string): Promise<boolean> {
        try {
            const document = await this.getDocument(filePath);
            if (!document) {
                return false;
            }

            const text = document.getText();
            return text.includes('<<<<<<<') && text.includes('>>>>>>>');
        } catch {
            return false;
        }
    }

    /**
     * Helper: Sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up old queue entries
     */
    public cleanupOldRequests(maxAge: number = 300000): void {
        const now = Date.now();

        for (const [filePath, queue] of this.accessQueue.entries()) {
            const filtered = queue.filter(req => now - req.timestamp < maxAge);
            
            if (filtered.length === 0) {
                this.accessQueue.delete(filePath);
            } else {
                this.accessQueue.set(filePath, filtered);
            }
        }
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.fileAccessMap.clear();
        this.accessQueue.clear();
        this.agentRegistry.clear();
    }
}
