import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { SecurityUtils } from '../utils/sanitizer';

/**
 * Connection Manager - Ensures all components are properly connected
 */
export class ConnectionManager {
    private static backendUrl = 'http://127.0.0.1:5000';
    private static isBackendConnected = false;
    private static connectionCheckInterval: NodeJS.Timeout | null = null;

    /**
     * Initialize all connections and verify system integrity
     */
    static async initialize(): Promise<boolean> {
        console.log('🔗 Initializing connection manager...');
        
        // Check backend connection (non-critical)
        const backendStatus = await this.checkBackendConnection();
        
        // Start periodic health checks only if backend is available
        if (backendStatus) {
            this.startHealthChecks();
        }
        
        // Verify CLI integration (non-critical)
        const cliStatus = this.verifyCLIIntegration();
        
        // Check file system permissions (critical)
        const fsStatus = await this.checkFileSystemAccess();
        
        // Only show warnings for critical components
        if (!fsStatus) {
            vscode.window.showWarningMessage('⚠️ File system access issue detected');
        } else {
            // Extension works fine without backend/CLI
            console.log('✅ Core systems ready. Backend:', backendStatus ? 'connected' : 'optional', '| CLI:', cliStatus ? 'available' : 'optional');
        }
        
        return fsStatus; // Only require file system access
    }

    /**
     * Check backend server connection
     */
    static async checkBackendConnection(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
            
            const response = await fetch(`${this.backendUrl}/health`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json() as { status: string };
                this.isBackendConnected = data.status === 'healthy';
                console.log('✅ Backend server connected');
                return true;
            }
        } catch (error: any) {
            // Backend is optional, don't log as error
            console.log('🔌 Backend server not available (optional)');
            this.isBackendConnected = false;
        }
        
        return false;
    }

    /**
     * Verify CLI integration is working
     */
    static verifyCLIIntegration(): boolean {
        try {
            const { spawn } = require('child_process');
            const cliPath = require('path').join(__dirname, '..', 'cli', 'index.js');
            
            if (require('fs').existsSync(cliPath)) {
                console.log('✅ CLI integration verified');
                return true;
            }
        } catch (error: any) {
            // CLI is optional, don't log as error
            console.log('🔌 CLI integration not available (optional)');
        }
        
        return false;
    }

    /**
     * Check file system access permissions
     */
    static async checkFileSystemAccess(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.log('⚠️ No workspace folder open');
                return false;
            }
            
            // Test read access
            await vscode.workspace.fs.readDirectory(workspaceFolder.uri);
            
            // Test write access with temp file
            const tempFile = vscode.Uri.joinPath(workspaceFolder.uri, '.temp-connection-test');
            await vscode.workspace.fs.writeFile(tempFile, Buffer.from('test'));
            await vscode.workspace.fs.delete(tempFile);
            
            console.log('✅ File system access verified');
            return true;
        } catch (error: any) {
            console.log('❌ File system access issue:', SecurityUtils.sanitizeLogInput(error.message));
            return false;
        }
    }

    /**
     * Start periodic health checks
     */
    static startHealthChecks(): void {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        this.connectionCheckInterval = setInterval(async () => {
            await this.checkBackendConnection();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop health checks
     */
    static stopHealthChecks(): void {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    /**
     * Get connection status
     */
    static getConnectionStatus(): {
        backend: boolean;
        cli: boolean;
        filesystem: boolean;
    } {
        return {
            backend: this.isBackendConnected,
            cli: this.verifyCLIIntegration(),
            filesystem: true // Assume true if extension is running
        };
    }

    /**
     * Send request to backend with error handling
     */
    static async sendToBackend(endpoint: string, data: any): Promise<any> {
        if (!this.isBackendConnected) {
            throw new Error('Backend server not connected');
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(`${this.backendUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Backend request failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error: any) {
            console.error('Backend request error:', SecurityUtils.sanitizeLogInput(error.message));
            throw error;
        }
    }

    /**
     * Cleanup connections
     */
    static cleanup(): void {
        this.stopHealthChecks();
        this.isBackendConnected = false;
    }
}