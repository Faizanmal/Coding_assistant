import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { CodeDiffViewer } from './codediffviewer';

export class ChatFileManager {
    private static workspaceRoot: string = '';
    private static fileOperations: Map<string, any> = new Map();

    static initialize() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            this.workspaceRoot = workspace.uri.fsPath;
        }
    }

    static async processFileCommand(command: string): Promise<string | null> {
        const cmd = command.toLowerCase().trim();
        
        // File creation
        if (this.isCreateCommand(cmd)) {
            return await this.handleFileCreation(command);
        }
        
        // File editing/modification
        if (this.isEditCommand(cmd)) {
            return await this.handleFileEdit(command);
        }
        
        // File override/replacement
        if (this.isOverrideCommand(cmd)) {
            return await this.handleFileOverride(command);
        }
        
        // File management (copy, move, rename)
        if (this.isManageCommand(cmd)) {
            return await this.handleFileManagement(command);
        }
        
        // File reading/display
        if (this.isReadCommand(cmd)) {
            return await this.handleFileRead(command);
        }
        
        return null; // Not a file command
    }

    private static isCreateCommand(cmd: string): boolean {
        return cmd.includes('create') || cmd.includes('make') || cmd.includes('generate') || cmd.includes('new file');
    }

    private static isEditCommand(cmd: string): boolean {
        return cmd.includes('edit') || cmd.includes('modify') || cmd.includes('update') || cmd.includes('change') || cmd.includes('add to');
    }

    private static isOverrideCommand(cmd: string): boolean {
        return cmd.includes('override') || cmd.includes('replace') || cmd.includes('overwrite') || cmd.includes('rewrite');
    }

    private static isManageCommand(cmd: string): boolean {
        return cmd.includes('copy') || cmd.includes('move') || cmd.includes('rename') || cmd.includes('delete') || cmd.includes('duplicate');
    }

    private static isReadCommand(cmd: string): boolean {
        return cmd.includes('show') || cmd.includes('read') || cmd.includes('display') || cmd.includes('open') || cmd.includes('view');
    }

    private static async handleFileCreation(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        const content = this.extractContent(command);
        
        if (!fileName) {
            return '❌ Please specify a file name. Example: "create app.js with express server"';
        }

        try {
            const targetPath = this.getCorrectFilePath(fileName);
            const relativePath = path.relative(this.workspaceRoot, targetPath);
            
            if (fs.existsSync(targetPath)) {
                const confirm = await vscode.window.showWarningMessage(
                    `File "${relativePath}" already exists. Overwrite?`,
                    'Yes', 'No'
                );
                if (confirm !== 'Yes') {
                    return '❌ File creation cancelled.';
                }
            }

            let fileContent = '';
            if (content) {
                const projectContext = this.getProjectContext();
                const prompt = `Create file content for "${fileName}" in directory "${path.dirname(relativePath)}"

Project Context: ${projectContext}

Requirements: ${content}

Return only the file content:`;
                fileContent = await generateCode(prompt, 'llama-3.3-70b-versatile');
            } else {
                fileContent = this.getDefaultContent(fileName);
            }

            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(targetPath, fileContent);
            await vscode.window.showTextDocument(vscode.Uri.file(targetPath));
            
            return `✅ Created "${relativePath}" in correct directory.

**Location:** ${relativePath}
**Preview:**
\`\`\`
${fileContent.slice(0, 200)}${fileContent.length > 200 ? '...' : ''}
\`\`\``;
        } catch (error: any) {
            return `❌ Error creating file: ${error.message}`;
        }
    }

    private static async handleFileEdit(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        const modification = this.extractModification(command);
        
        if (!fileName) {
            return '❌ Please specify a file name to edit.';
        }

        const filePath = await this.findFilePath(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found in project.`;
        }

        try {
            const currentContent = fs.readFileSync(filePath, 'utf8');
            
            if (!modification) {
                // Just open the file for editing
                await vscode.window.showTextDocument(vscode.Uri.file(filePath));
                return `✅ Opened "${fileName}" for editing.`;
            }

            const prompt = `Modify this file based on the request: "${modification}"

Current content:
${currentContent}

Return the complete modified file content:`;
            const modifiedContent = await generateCode(prompt, 'llama-3.3-70b-versatile');
            
            // Show diff before applying
            await CodeDiffViewer.showDiff(currentContent, modifiedContent, `Edit: ${fileName}`);
            
            const apply = await vscode.window.showInformationMessage(
                'Apply changes to file?',
                'Apply', 'Cancel'
            );
            
            if (apply === 'Apply') {
                fs.writeFileSync(filePath, modifiedContent);
                return `✅ Applied changes to "${fileName}".`;
            }
            
            return '❌ Changes not applied.';
        } catch (error: any) {
            return `❌ Error editing file: ${error.message}`;
        }
    }

    private static async handleFileOverride(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        const newContent = this.extractContent(command);
        
        if (!fileName) {
            return '❌ Please specify a file name to override.';
        }

        const filePath = await this.findFilePath(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found in project.`;
        }

        try {
            const currentContent = fs.readFileSync(filePath, 'utf8');
            let replacementContent = '';
            
            if (newContent) {
                const prompt = `Create complete replacement content for "${fileName}" with requirements: ${newContent}\n\nReturn only the file content:`;
                replacementContent = await generateCode(prompt, 'llama-3.3-70b-versatile');
            } else {
                return '❌ Please specify what to replace the file content with.';
            }

            // Show diff before overriding
            await CodeDiffViewer.showDiff(currentContent, replacementContent, `Override: ${fileName}`);
            
            const confirm = await vscode.window.showWarningMessage(
                `Override entire content of "${fileName}"?`,
                'Override', 'Cancel'
            );
            
            if (confirm === 'Override') {
                fs.writeFileSync(filePath, replacementContent);
                await vscode.window.showTextDocument(vscode.Uri.file(filePath));
                return `✅ Overrode "${fileName}" with new content.`;
            }
            
            return '❌ File override cancelled.';
        } catch (error: any) {
            return `❌ Error overriding file: ${error.message}`;
        }
    }

    private static async handleFileManagement(command: string): Promise<string> {
        const cmd = command.toLowerCase();
        
        if (cmd.includes('delete') || cmd.includes('remove')) {
            return await this.handleFileDelete(command);
        }
        
        if (cmd.includes('copy') || cmd.includes('duplicate')) {
            return await this.handleFileCopy(command);
        }
        
        if (cmd.includes('move') || cmd.includes('rename')) {
            return await this.handleFileMove(command);
        }
        
        return '❌ Unknown file management operation.';
    }

    private static async handleFileDelete(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        if (!fileName) {
            return '❌ Please specify a file name to delete.';
        }

        const filePath = await this.findFilePath(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found.`;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Delete "${fileName}"?`,
            { modal: true },
            'Delete', 'Cancel'
        );

        if (confirm === 'Delete') {
            try {
                fs.unlinkSync(filePath);
                return `✅ Deleted "${fileName}".`;
            } catch (error: any) {
                return `❌ Error deleting file: ${error.message}`;
            }
        }

        return '❌ File deletion cancelled.';
    }

    private static async handleFileCopy(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        const targetName = this.extractTargetName(command) || `copy_of_${fileName}`;
        
        if (!fileName) {
            return '❌ Please specify a file name to copy.';
        }

        const sourcePath = await this.findFilePath(fileName);
        if (!sourcePath) {
            return `❌ File "${fileName}" not found.`;
        }

        try {
            const targetPath = path.join(this.workspaceRoot, targetName);
            fs.copyFileSync(sourcePath, targetPath);
            return `✅ Copied "${fileName}" to "${targetName}".`;
        } catch (error: any) {
            return `❌ Error copying file: ${error.message}`;
        }
    }

    private static async handleFileMove(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        const targetName = this.extractTargetName(command);
        
        if (!fileName || !targetName) {
            return '❌ Please specify both source and target file names.';
        }

        const sourcePath = await this.findFilePath(fileName);
        if (!sourcePath) {
            return `❌ File "${fileName}" not found.`;
        }

        try {
            const targetPath = path.join(this.workspaceRoot, targetName);
            fs.renameSync(sourcePath, targetPath);
            return `✅ Moved/renamed "${fileName}" to "${targetName}".`;
        } catch (error: any) {
            return `❌ Error moving file: ${error.message}`;
        }
    }

    private static async handleFileRead(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        if (!fileName) {
            return '❌ Please specify a file name to read.';
        }

        const filePath = await this.findFilePath(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found.`;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            await vscode.window.showTextDocument(vscode.Uri.file(filePath));
            
            return `✅ Opened "${fileName}"

**Content:**
\`\`\`
${content.slice(0, 1000)}${content.length > 1000 ? '\n... (truncated)' : ''}
\`\`\``;
        } catch (error: any) {
            return `❌ Error reading file: ${error.message}`;
        }
    }

    private static extractFileName(command: string): string | null {
        const patterns = [
            /(?:file|create|edit|override|delete|copy|move|show|open)\s+["']?([^"'\s]+\.[^"'\s]+)["']?/i,
            /["']([^"']+\.[^"']+)["']/,
            /\b([a-zA-Z0-9_/-]+\.[a-zA-Z0-9]+)\b/
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1];}
        }
        
        return null;
    }

    private static extractContent(command: string): string | null {
        const patterns = [
            /(?:with|containing|that has)\s+(.+)/i,
            /(?:create|make|override)\s+[^"'\s]+\s+(.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return null;
    }

    private static extractModification(command: string): string | null {
        const patterns = [
            /(?:to|by)\s+(.+)/i,
            /(?:edit|modify|update)\s+[^"'\s]+\s+(.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return null;
    }

    private static extractTargetName(command: string): string | null {
        const patterns = [
            /(?:to|as)\s+["']?([^"'\s]+\.[^"'\s]+)["']?/i,
            /(?:copy|move|rename)\s+[^"'\s]+\s+(?:to|as)\s+["']?([^"'\s]+)["']?/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1];}
        }
        
        return null;
    }

    private static async findFilePath(fileName: string): Promise<string | null> {
        if (fileName.includes('/') || fileName.includes('\\')) {
            const fullPath = path.resolve(this.workspaceRoot, fileName);
            if (fs.existsSync(fullPath)) {return fullPath;}
        }

        try {
            const results = await vscode.workspace.findFiles(
                `**/${fileName}`,
                '**/node_modules/**',
                10
            );
            
            if (results.length > 0) {
                return results[0].fsPath;
            }
            
            const caseInsensitiveResults = await vscode.workspace.findFiles(
                `**/*`,
                '**/node_modules/**',
                1000
            );
            
            for (const result of caseInsensitiveResults) {
                const baseName = path.basename(result.fsPath);
                if (baseName.toLowerCase() === fileName.toLowerCase()) {
                    return result.fsPath;
                }
            }
        } catch (error) {
            console.error('VS Code search failed:', error);
        }
        
        return null;
    }

    private static getDefaultContent(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        
        switch (ext) {
            case '.js':
                return '// JavaScript file\nconsole.log("Hello World");';
            case '.ts':
                return '// TypeScript file\nconsole.log("Hello World");';
            case '.py':
                return '# Python file\nprint("Hello World")';
            case '.html':
                return '<!DOCTYPE html>\n<html>\n<head>\n    <title>Page Title</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n</body>\n</html>';
            case '.css':
                return '/* CSS file */\nbody {\n    font-family: Arial, sans-serif;\n}';
            case '.json':
                return '{\n    "name": "example",\n    "version": "1.0.0"\n}';
            case '.md':
                return '# Title\n\nContent goes here.';
            default:
                return '// New file\n';
        }
    }

    private static getCorrectFilePath(fileName: string): string {
        if (fileName.includes('/') || fileName.includes('\\')) {
            return path.resolve(this.workspaceRoot, fileName);
        }

        const ext = path.extname(fileName).toLowerCase();
        const baseName = path.basename(fileName, ext);
        let targetDir = this.workspaceRoot;
        
        if (baseName.toLowerCase().includes('component') || ext === '.tsx' || ext === '.jsx') {
            if (this.directoryExists('src/components')) {
                targetDir = path.join(this.workspaceRoot, 'src', 'components');
            } else if (this.directoryExists('components')) {
                targetDir = path.join(this.workspaceRoot, 'components');
            } else if (this.directoryExists('src')) {
                targetDir = path.join(this.workspaceRoot, 'src');
            }
        }
        else if (baseName.toLowerCase().includes('test') || baseName.toLowerCase().includes('spec')) {
            if (this.directoryExists('src/test')) {
                targetDir = path.join(this.workspaceRoot, 'src', 'test');
            } else if (this.directoryExists('test')) {
                targetDir = path.join(this.workspaceRoot, 'test');
            }
        }
        else if (ext === '.css' || ext === '.scss') {
            if (this.directoryExists('src/styles')) {
                targetDir = path.join(this.workspaceRoot, 'src', 'styles');
            } else if (this.directoryExists('styles')) {
                targetDir = path.join(this.workspaceRoot, 'styles');
            }
        }
        else if (['.js', '.ts', '.py'].includes(ext) && !this.isConfigFile(fileName)) {
            if (this.directoryExists('src')) {
                targetDir = path.join(this.workspaceRoot, 'src');
            }
        }
        
        return path.join(targetDir, fileName);
    }

    private static directoryExists(relativePath: string): boolean {
        return fs.existsSync(path.join(this.workspaceRoot, relativePath));
    }

    private static isConfigFile(fileName: string): boolean {
        const configFiles = ['package.json', 'tsconfig.json', '.env'];
        return configFiles.includes(fileName.toLowerCase());
    }

    private static getProjectContext(): string {
        const hasPackageJson = fs.existsSync(path.join(this.workspaceRoot, 'package.json'));
        const hasSrcDir = fs.existsSync(path.join(this.workspaceRoot, 'src'));
        return `Project: ${hasPackageJson ? 'Node.js' : 'Generic'}, Structure: ${hasSrcDir ? 'src/' : 'root'}`;
    }
}