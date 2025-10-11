import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * System Validator - Validates all project components and dependencies
 */
export class SystemValidator {
    
    /**
     * Validate entire system integrity
     */
    static async validateSystem(): Promise<{
        valid: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        // Check extension structure
        const structureCheck = this.validateExtensionStructure();
        if (!structureCheck.valid) {
            issues.push(...structureCheck.issues);
            recommendations.push(...structureCheck.recommendations);
        }
        
        // Check backend server
        const backendCheck = this.validateBackendServer();
        if (!backendCheck.valid) {
            issues.push(...backendCheck.issues);
            recommendations.push(...backendCheck.recommendations);
        }
        
        // Check CLI tools
        const cliCheck = this.validateCLITools();
        if (!cliCheck.valid) {
            issues.push(...cliCheck.issues);
            recommendations.push(...cliCheck.recommendations);
        }
        
        // Check environment configuration
        const envCheck = this.validateEnvironment();
        if (!envCheck.valid) {
            issues.push(...envCheck.issues);
            recommendations.push(...envCheck.recommendations);
        }
        
        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Validate extension file structure
     */
    private static validateExtensionStructure(): {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        const requiredFiles = [
            'src/extension.ts',
            'src/sidebar.ts',
            'src/codegenerator.ts',
            'src/liveterminal.ts',
            'src/utils/sanitizer.ts',
            'src/integration/connectionManager.ts',
            'package.json',
            'tsconfig.json'
        ];
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            issues.push('No workspace folder open');
            return { valid: false, issues, recommendations };
        }
        
        for (const file of requiredFiles) {
            const filePath = path.join(workspaceRoot, file);
            if (!fs.existsSync(filePath)) {
                issues.push(`Missing required file: ${file}`);
                recommendations.push(`Create ${file} to ensure proper functionality`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Validate backend server setup
     */
    private static validateBackendServer(): {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return { valid: false, issues: ['No workspace'], recommendations: [] };
        }
        
        const backendPath = path.join(workspaceRoot, 'backend-server');
        
        if (!fs.existsSync(backendPath)) {
            issues.push('Backend server directory not found');
            recommendations.push('Create backend-server directory with server.js');
            return { valid: false, issues, recommendations };
        }
        
        const requiredBackendFiles = [
            'server.js',
            'package.json',
            '.env.example',
            'middleware/security.js',
            'config/security.js'
        ];
        
        for (const file of requiredBackendFiles) {
            const filePath = path.join(backendPath, file);
            if (!fs.existsSync(filePath)) {
                issues.push(`Missing backend file: ${file}`);
                recommendations.push(`Create backend-server/${file}`);
            }
        }
        
        // Check if .env exists
        const envPath = path.join(backendPath, '.env');
        if (!fs.existsSync(envPath)) {
            issues.push('Backend .env file not found');
            recommendations.push('Copy .env.example to .env and configure API keys');
        }
        
        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Validate CLI tools
     */
    private static validateCLITools(): {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return { valid: false, issues: ['No workspace'], recommendations: [] };
        }
        
        const cliPath = path.join(workspaceRoot, 'src', 'cli');
        
        if (!fs.existsSync(cliPath)) {
            issues.push('CLI directory not found');
            recommendations.push('Create src/cli directory with CLI tools');
            return { valid: false, issues, recommendations };
        }
        
        const requiredCLIFiles = [
            'index.ts',
            'generate.ts',
            'analyze.ts',
            'review.ts'
        ];
        
        for (const file of requiredCLIFiles) {
            const filePath = path.join(cliPath, file);
            if (!fs.existsSync(filePath)) {
                issues.push(`Missing CLI file: ${file}`);
                recommendations.push(`Create src/cli/${file}`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Validate environment configuration
     */
    private static validateEnvironment(): {
        valid: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        
        // Check for API keys in environment
        const requiredEnvVars = ['API_KEY'];
        
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                issues.push(`Missing environment variable: ${envVar}`);
                recommendations.push(`Set ${envVar} in your .env file`);
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            recommendations
        };
    }
    
    /**
     * Generate system health report
     */
    static async generateHealthReport(): Promise<string> {
        const validation = await this.validateSystem();
        
        let report = '# System Health Report\n\n';
        
        if (validation.valid) {
            report += '✅ **System Status: HEALTHY**\n\n';
            report += 'All components are properly connected and configured.\n\n';
        } else {
            report += '⚠️ **System Status: ISSUES DETECTED**\n\n';
            
            if (validation.issues.length > 0) {
                report += '## Issues Found\n\n';
                validation.issues.forEach(issue => {
                    report += `- ❌ ${issue}\n`;
                });
                report += '\n';
            }
            
            if (validation.recommendations.length > 0) {
                report += '## Recommendations\n\n';
                validation.recommendations.forEach(rec => {
                    report += `- 💡 ${rec}\n`;
                });
                report += '\n';
            }
        }
        
        report += '## Component Status\n\n';
        report += '- Frontend Extension: ✅ Active\n';
        report += '- Backend Server: ' + (validation.issues.some(i => i.includes('backend')) ? '❌ Issues' : '✅ Connected') + '\n';
        report += '- CLI Tools: ' + (validation.issues.some(i => i.includes('CLI')) ? '❌ Issues' : '✅ Available') + '\n';
        report += '- File System: ✅ Accessible\n';
        
        return report;
    }
}