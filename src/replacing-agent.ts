import * as vscode from 'vscode';
import { FixSuggestion } from './looping-agent';
import { SidebarChatMessenger } from './sidebar-chat-messenger';

/**
 * File Verification Result
 */
interface VerificationResult {
    isValid: boolean;
    conflicts: string[];
    syntaxErrors: vscode.Diagnostic[];
}

/**
 * Replacing Agent
 * 
 * Safely applies code changes, verifies no conflicts, and ensures file integrity.
 * Performs multiple validation steps before committing changes.
 */
export class ReplacingAgent {
    private isActive: boolean = true;
    private replacementsApplied: number = 0;
    private replacementsFailed: number = 0;

    constructor(
        private agentId: string,
        private filePath: string,
        private messenger: SidebarChatMessenger
    ) {}

    /**
     * Apply fixes to the file
     */
    public async applyFixes(fixes: FixSuggestion[]): Promise<void> {
        if (!this.isActive) {
            throw new Error('Agent is not active');
        }

        await this.messenger.sendMessage(
            `🔧 **Agent ${this.agentId}**: Preparing to apply ${fixes.length} fix(es)...`,
            'info'
        );

        // Sort fixes by position (from bottom to top to avoid range shifts)
        fixes.sort((a, b) => b.range.start.line - a.range.start.line);

        const document = await vscode.workspace.openTextDocument(this.filePath);
        const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

        // Create a backup of the original content
        const originalContent = document.getText();

        try {
            // Apply fixes one by one with validation
            for (const fix of fixes) {
                await this.applySingleFix(editor, fix, originalContent);
            }

            // Final validation after all fixes
            await this.performFinalValidation(editor.document);

            // Save the document
            await editor.document.save();

            await this.messenger.sendMessage(
                `✅ **Agent ${this.agentId}**: Successfully applied ${this.replacementsApplied} fix(es)`,
                'success'
            );

        } catch (error) {
            // Rollback on error
            await this.rollback(editor, originalContent);
            this.replacementsFailed++;
            
            await this.messenger.sendMessage(
                `❌ **Agent ${this.agentId}**: Failed to apply fixes: ${error}`,
                'error'
            );
            
            throw error;
        }
    }

    /**
     * Apply a single fix with validation
     */
    private async applySingleFix(
        editor: vscode.TextEditor,
        fix: FixSuggestion,
        originalContent: string
    ): Promise<void> {
        const document = editor.document;

        // Pre-apply validation
        const preValidation = await this.validateBeforeApply(document, fix);
        if (!preValidation.isValid) {
            await this.messenger.sendMessage(
                `⚠️ **Agent ${this.agentId}**: Skipping fix due to validation issues: ${preValidation.conflicts.join(', ')}`,
                'warning'
            );
            return;
        }

        // Apply the fix
        const success = await editor.edit((editBuilder) => {
            if (fix.type === 'correction') {
                // Replace existing code
                editBuilder.replace(fix.range, fix.suggestedCode);
            } else {
                // Insert new code
                const insertPosition = fix.range.start;
                editBuilder.insert(insertPosition, fix.suggestedCode + '\n');
            }
        }, {
            undoStopBefore: true,
            undoStopAfter: true
        });

        if (!success) {
            throw new Error('Failed to apply edit');
        }

        // Post-apply validation
        const postValidation = await this.validateAfterApply(editor.document, fix);
        if (!postValidation.isValid) {
            // Undo the change
            await vscode.commands.executeCommand('undo');
            
            await this.messenger.sendMessage(
                `⚠️ **Agent ${this.agentId}**: Reverted fix due to post-validation issues`,
                'warning'
            );
            return;
        }

        this.replacementsApplied++;
        
        await this.messenger.sendMessage(
            `✓ Applied fix: ${fix.explanation} (confidence: ${Math.round(fix.confidence * 100)}%)`,
            'info'
        );
    }

    /**
     * Validate before applying a fix
     */
    private async validateBeforeApply(
        document: vscode.TextDocument,
        fix: FixSuggestion
    ): Promise<VerificationResult> {
        const conflicts: string[] = [];

        // Check if the range is still valid
        if (fix.range.start.line >= document.lineCount) {
            conflicts.push('Range out of bounds');
        }

        // Check if the original code matches (for corrections)
        if (fix.type === 'correction' && fix.originalCode) {
            const currentCode = document.getText(fix.range);
            if (currentCode !== fix.originalCode) {
                conflicts.push('Original code has changed');
            }
        }

        // Check for syntax validity of suggested code
        const syntaxValid = await this.checkSyntax(fix.suggestedCode, document.languageId);
        if (!syntaxValid) {
            conflicts.push('Suggested code has syntax errors');
        }

        return {
            isValid: conflicts.length === 0,
            conflicts,
            syntaxErrors: []
        };
    }

    /**
     * Validate after applying a fix
     */
    private async validateAfterApply(
        document: vscode.TextDocument,
        fix: FixSuggestion
    ): Promise<VerificationResult> {
        const conflicts: string[] = [];

        // Wait a bit for diagnostics to update
        await this.sleep(500);

        // Check for new errors introduced by the fix
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const newErrors = diagnostics.filter(d => 
            d.severity === vscode.DiagnosticSeverity.Error &&
            this.isInOrNearRange(d.range, fix.range)
        );

        if (newErrors.length > 0) {
            conflicts.push(`Introduced ${newErrors.length} new error(s)`);
        }

        // Verify file can be parsed
        const canParse = await this.verifyFileIntegrity(document);
        if (!canParse) {
            conflicts.push('File integrity check failed');
        }

        return {
            isValid: conflicts.length === 0,
            conflicts,
            syntaxErrors: newErrors
        };
    }

    /**
     * Perform final validation after all fixes
     */
    private async performFinalValidation(document: vscode.TextDocument): Promise<void> {
        // Wait for diagnostics to update
        await this.sleep(1000);

        // Check for critical errors
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        const criticalErrors = diagnostics.filter(d => 
            d.severity === vscode.DiagnosticSeverity.Error
        );

        if (criticalErrors.length > 0) {
            await this.messenger.sendMessage(
                `⚠️ **Agent ${this.agentId}**: ${criticalErrors.length} error(s) remain after fixes`,
                'warning'
            );
        }

        // Verify file structure is intact
        const structureValid = await this.verifyFileStructure(document);
        if (!structureValid) {
            throw new Error('File structure validation failed');
        }
    }

    /**
     * Check if a position is in or near a range
     */
    private isInOrNearRange(range: vscode.Range, targetRange: vscode.Range): boolean {
        const buffer = 5; // lines
        return (
            range.start.line >= targetRange.start.line - buffer &&
            range.end.line <= targetRange.end.line + buffer
        );
    }

    /**
     * Check syntax of code snippet
     */
    private async checkSyntax(code: string, languageId: string): Promise<boolean> {
        // Basic syntax check - can be enhanced with language-specific parsers
        try {
            // For TypeScript/JavaScript, check for balanced braces
            if (languageId === 'typescript' || languageId === 'javascript') {
                const openBraces = (code.match(/\{/g) || []).length;
                const closeBraces = (code.match(/\}/g) || []).length;
                const openParens = (code.match(/\(/g) || []).length;
                const closeParens = (code.match(/\)/g) || []).length;
                
                return openBraces === closeBraces && openParens === closeParens;
            }

            // For Python, check basic indentation
            if (languageId === 'python') {
                const lines = code.split('\n');
                for (const line of lines) {
                    const spaces = line.match(/^\s*/)?.[0].length || 0;
                    if (spaces % 4 !== 0 && line.trim().length > 0) {
                        return false;
                    }
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verify file integrity (can be parsed without critical errors)
     */
    private async verifyFileIntegrity(document: vscode.TextDocument): Promise<boolean> {
        try {
            // Check if the file is too corrupted
            const text = document.getText();
            
            // Basic checks
            if (text.length === 0) {
                return false;
            }

            // Language-specific checks
            if (document.languageId === 'typescript' || document.languageId === 'javascript') {
                // Check for severely unbalanced braces
                const openBraces = (text.match(/\{/g) || []).length;
                const closeBraces = (text.match(/\}/g) || []).length;
                
                if (Math.abs(openBraces - closeBraces) > 3) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verify file structure is intact
     */
    private async verifyFileStructure(document: vscode.TextDocument): Promise<boolean> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            // If we can get symbols, the structure is likely valid
            return symbols !== undefined;
        } catch {
            // If symbol provider fails, do basic check
            return this.verifyFileIntegrity(document);
        }
    }

    /**
     * Rollback changes to original content
     */
    private async rollback(editor: vscode.TextEditor, originalContent: string): Promise<void> {
        await this.messenger.sendMessage(
            `🔄 **Agent ${this.agentId}**: Rolling back changes...`,
            'warning'
        );

        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length)
        );

        await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, originalContent);
        });

        await this.messenger.sendMessage(
            `✅ **Agent ${this.agentId}**: Successfully rolled back changes`,
            'info'
        );
    }

    /**
     * Helper: Sleep for a specified time
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get agent statistics
     */
    public getStats(): { replacementsApplied: number; replacementsFailed: number } {
        return {
            replacementsApplied: this.replacementsApplied,
            replacementsFailed: this.replacementsFailed
        };
    }

    /**
     * Stop the agent
     */
    public stop(): void {
        this.isActive = false;
    }

    /**
     * Check if agent is active
     */
    public isAgentActive(): boolean {
        return this.isActive;
    }
}
