import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface FileLock {
    fileName: string;
    lockedBy: string;
    lockType: 'read' | 'write' | 'exclusive';
    timestamp: Date;
    operation: string;
    dependencies: string[];
}

interface ConflictPrevention {
    preventFileConflicts: boolean;
    maxConcurrentFileOps: number;
    lockTimeoutMs: number;
    enableDependencyTracking: boolean;
    conflictResolutionStrategy: 'queue' | 'reject' | 'merge';
}

export class ConflictPreventionSystem {
    private static instance: ConflictPreventionSystem;
    private fileLocks: Map<string, FileLock> = new Map();
    private lockQueue: Map<string, Array<{resolve: Function, reject: Function, lockType: string, operation: string}>> = new Map();
    private dependencyGraph: Map<string, Set<string>> = new Map();
    private operationHistory: Map<string, Date> = new Map();
    private config: ConflictPrevention;
    private webviewView: vscode.WebviewView | null = null;

    constructor() {
        this.config = {
            preventFileConflicts: true,
            maxConcurrentFileOps: 3,
            lockTimeoutMs: 30000, // 30 seconds
            enableDependencyTracking: true,
            conflictResolutionStrategy: 'queue'
        };
        
        // Cleanup expired locks every 30 seconds
        setInterval(() => this.cleanupExpiredLocks(), 30000);
    }

    static getInstance(): ConflictPreventionSystem {
        if (!this.instance) {
            this.instance = new ConflictPreventionSystem();
        }
        return this.instance;
    }

    setWebviewView(view: vscode.WebviewView) {
        this.webviewView = view;
    }

    updateConfig(newConfig: Partial<ConflictPrevention>) {
        this.config = { ...this.config, ...newConfig };
    }

    async acquireFileLock(fileName: string, operation: string, lockType: 'read' | 'write' | 'exclusive' = 'write', dependencies: string[] = []): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const normalizedFileName = this.normalizeFileName(fileName);
            
            // Check if file is already locked
            const existingLock = this.fileLocks.get(normalizedFileName);
            
            if (existingLock) {
                if (this.canCoexist(existingLock, lockType)) {
                    // Allow read operations to coexist
                    resolve(true);
                    return;
                }
                
                // Handle conflict based on strategy
                switch (this.config.conflictResolutionStrategy) {
                    case 'queue':
                        this.queueLockRequest(normalizedFileName, lockType, operation, resolve, reject);
                        break;
                    case 'reject':
                        this.sendConflictNotification(normalizedFileName, existingLock, operation);
                        reject(new Error(`File ${fileName} is locked by ${existingLock.lockedBy} for ${existingLock.operation}`));
                        break;
                    case 'merge':
                        // Attempt to merge operations
                        this.attemptOperationMerge(normalizedFileName, existingLock, operation, resolve, reject);
                        break;
                }
                return;
            }
            
            // Check dependencies
            if (this.config.enableDependencyTracking && dependencies.length > 0) {
                const dependencyConflict = this.checkDependencyConflicts(normalizedFileName, dependencies);
                if (dependencyConflict) {
                    this.queueLockRequest(normalizedFileName, lockType, operation, resolve, reject);
                    return;
                }
            }
            
            // Acquire lock
            this.createLock(normalizedFileName, operation, lockType, dependencies);
            this.sendLockNotification(normalizedFileName, operation, 'acquired');
            resolve(true);
        });
    }

    releaseFileLock(fileName: string, operation: string): boolean {
        const normalizedFileName = this.normalizeFileName(fileName);
        const lock = this.fileLocks.get(normalizedFileName);
        
        if (!lock) {
            return false;
        }
        
        // Verify the lock belongs to this operation
        if (lock.operation !== operation) {
            return false;
        }
        
        this.fileLocks.delete(normalizedFileName);
        this.sendLockNotification(normalizedFileName, operation, 'released');
        
        // Process queued requests
        this.processLockQueue(normalizedFileName);
        
        return true;
    }

    private createLock(fileName: string, operation: string, lockType: 'read' | 'write' | 'exclusive', dependencies: string[]) {
        const lock: FileLock = {
            fileName,
            lockedBy: operation,
            lockType,
            timestamp: new Date(),
            operation,
            dependencies
        };
        
        this.fileLocks.set(fileName, lock);
        
        // Update dependency graph
        if (this.config.enableDependencyTracking) {
            this.updateDependencyGraph(fileName, dependencies);
        }
    }

    private canCoexist(existingLock: FileLock, requestedLockType: string): boolean {
        // Multiple read locks can coexist
        if (existingLock.lockType === 'read' && requestedLockType === 'read') {
            return true;
        }
        
        // Exclusive locks cannot coexist with anything
        if (existingLock.lockType === 'exclusive' || requestedLockType === 'exclusive') {
            return false;
        }
        
        // Write locks cannot coexist with other write locks
        return false;
    }

    private queueLockRequest(fileName: string, lockType: string, operation: string, resolve: Function, reject: Function) {
        if (!this.lockQueue.has(fileName)) {
            this.lockQueue.set(fileName, []);
        }
        
        const queue = this.lockQueue.get(fileName)!;
        queue.push({ resolve, reject, lockType, operation });
        
        // Timeout handling
        setTimeout(() => {
            const index = queue.findIndex(req => req.operation === operation);
            if (index !== -1) {
                queue.splice(index, 1);
                reject(new Error(`Lock timeout for ${fileName}`));
            }
        }, this.config.lockTimeoutMs);
        
        this.sendConflictNotification(fileName, this.fileLocks.get(fileName)!, operation);
    }

    private processLockQueue(fileName: string) {
        const queue = this.lockQueue.get(fileName);
        if (!queue || queue.length === 0) {
            return;
        }
        
        const nextRequest = queue.shift()!;
        
        // Try to acquire lock for next request
        this.createLock(fileName, nextRequest.operation, nextRequest.lockType as any, []);
        nextRequest.resolve(true);
        
        this.sendLockNotification(fileName, nextRequest.operation, 'acquired');
    }

    private checkDependencyConflicts(fileName: string, dependencies: string[]): boolean {
        for (const dep of dependencies) {
            const normalizedDep = this.normalizeFileName(dep);
            if (this.fileLocks.has(normalizedDep)) {
                return true;
            }
        }
        return false;
    }

    private updateDependencyGraph(fileName: string, dependencies: string[]) {
        if (!this.dependencyGraph.has(fileName)) {
            this.dependencyGraph.set(fileName, new Set());
        }
        
        const deps = this.dependencyGraph.get(fileName)!;
        dependencies.forEach(dep => deps.add(this.normalizeFileName(dep)));
    }

    private attemptOperationMerge(fileName: string, existingLock: FileLock, newOperation: string, resolve: Function, reject: Function) {
        // Simple merge logic - for now, just queue the operation
        // In the future, this could analyze operations to see if they can be combined
        this.queueLockRequest(fileName, 'write', newOperation, resolve, reject);
    }

    private cleanupExpiredLocks() {
        const now = new Date();
        const expiredLocks: string[] = [];
        
        for (const [fileName, lock] of this.fileLocks) {
            const age = now.getTime() - lock.timestamp.getTime();
            if (age > this.config.lockTimeoutMs * 2) { // Double timeout for cleanup
                expiredLocks.push(fileName);
            }
        }
        
        expiredLocks.forEach(fileName => {
            const lock = this.fileLocks.get(fileName);
            if (lock) {
                this.fileLocks.delete(fileName);
                this.sendLockNotification(fileName, lock.operation, 'expired');
                this.processLockQueue(fileName);
            }
        });
    }

    private normalizeFileName(fileName: string): string {
        return path.normalize(fileName.toLowerCase());
    }

    private sendLockNotification(fileName: string, operation: string, status: 'acquired' | 'released' | 'expired') {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'lockUpdate',
                data: {
                    fileName,
                    operation,
                    status,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    private sendConflictNotification(fileName: string, existingLock: FileLock, newOperation: string) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'conflictDetected',
                data: {
                    fileName,
                    existingOperation: existingLock.operation,
                    newOperation,
                    lockType: existingLock.lockType,
                    queuePosition: this.lockQueue.get(fileName)?.length || 0
                }
            });
        }
    }

    // Public methods for integration
    async safeFileOperation<T>(fileName: string, operation: string, operationFn: () => Promise<T>, dependencies: string[] = []): Promise<T> {
        const lockAcquired = await this.acquireFileLock(fileName, operation, 'write', dependencies);
        
        if (!lockAcquired) {
            throw new Error(`Failed to acquire lock for ${fileName}`);
        }
        
        try {
            const result = await operationFn();
            return result;
        } finally {
            this.releaseFileLock(fileName, operation);
        }
    }

    async safeMultiFileOperation<T>(files: string[], operation: string, operationFn: () => Promise<T>): Promise<T> {
        // Sort files to prevent deadlock
        const sortedFiles = [...files].sort();
        const lockPromises = sortedFiles.map(file => this.acquireFileLock(file, operation, 'write'));
        
        try {
            await Promise.all(lockPromises);
            const result = await operationFn();
            return result;
        } finally {
            // Release locks in reverse order
            sortedFiles.reverse().forEach(file => {
                this.releaseFileLock(file, operation);
            });
        }
    }

    checkFileStatus(fileName: string): {
        locked: boolean;
        lockedBy?: string;
        operation?: string;
        queuePosition?: number;
    } {
        const normalizedFileName = this.normalizeFileName(fileName);
        const lock = this.fileLocks.get(normalizedFileName);
        const queue = this.lockQueue.get(normalizedFileName);
        
        return {
            locked: !!lock,
            lockedBy: lock?.lockedBy,
            operation: lock?.operation,
            queuePosition: queue?.length || 0
        };
    }

    getSystemStatus(): {
        activeLocks: number;
        queuedOperations: number;
        config: ConflictPrevention;
        recentConflicts: number;
    } {
        const queuedOps = Array.from(this.lockQueue.values()).reduce((sum, queue) => sum + queue.length, 0);
        
        return {
            activeLocks: this.fileLocks.size,
            queuedOperations: queuedOps,
            config: { ...this.config },
            recentConflicts: this.getRecentConflictsCount()
        };
    }

    private getRecentConflictsCount(): number {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        let count = 0;
        
        for (const timestamp of this.operationHistory.values()) {
            if (timestamp > oneHourAgo) {
                count++;
            }
        }
        
        return count;
    }

    clearAllLocks(): void {
        // Emergency clear - use with caution
        this.fileLocks.clear();
        this.lockQueue.clear();
        this.dependencyGraph.clear();
        
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'systemReset',
                message: 'All file locks cleared'
            });
        }
    }

    // Integration with existing multi-agent system
    async createSafeMultiAgentOperation(operations: Array<{fileName: string, operation: string}>, executorFn: () => Promise<any>): Promise<any> {
        const files = operations.map(op => op.fileName);
        const operationId = `multi-agent-${Date.now()}`;
        
        return await this.safeMultiFileOperation(files, operationId, executorFn);
    }

    // Dependency analysis
    analyzeDependencies(files: string[]): Map<string, string[]> {
        const analysis = new Map<string, string[]>();
        
        for (const file of files) {
            const deps: string[] = [];
            const normalizedFile = this.normalizeFileName(file);
            
            // Check dependency graph
            const graphDeps = this.dependencyGraph.get(normalizedFile);
            if (graphDeps) {
                deps.push(...Array.from(graphDeps));
            }
            
            // Infer dependencies based on file types and naming
            deps.push(...this.inferFileDependencies(file, files));
            
            analysis.set(file, deps);
        }
        
        return analysis;
    }

    private inferFileDependencies(file: string, allFiles: string[]): string[] {
        const deps: string[] = [];
        const fileName = path.basename(file, path.extname(file)).toLowerCase();
        const fileExt = path.extname(file).toLowerCase();
        
        // Test files depend on source files
        if (fileName.includes('test') || fileName.includes('spec')) {
            const sourceFile = allFiles.find(f => {
                const sourceName = path.basename(f, path.extname(f)).toLowerCase();
                return sourceName === fileName.replace(/[._-]?(test|spec)[._-]?/g, '') && 
                       path.extname(f).toLowerCase() === fileExt;
            });
            if (sourceFile) {
                deps.push(sourceFile);
            }
        }
        
        // Config files are often dependencies
        if (fileName.includes('config') || fileName === 'package' || fileName === 'requirements') {
            // Config files typically don't depend on others, but others depend on them
            return deps;
        }
        
        // Component files might depend on styles
        if (fileExt === '.js' || fileExt === '.jsx' || fileExt === '.ts' || fileExt === '.tsx') {
            const styleFile = allFiles.find(f => {
                const styleName = path.basename(f, path.extname(f)).toLowerCase();
                const styleExt = path.extname(f).toLowerCase();
                return styleName === fileName && (styleExt === '.css' || styleExt === '.scss' || styleExt === '.less');
            });
            if (styleFile) {
                deps.push(styleFile);
            }
        }
        
        return deps;
    }
}

// Export singleton instance for easy access
export const conflictPrevention = ConflictPreventionSystem.getInstance();