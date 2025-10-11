import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { MultiFileGenerator } from './multifilegenerator';
import { NLPFileGenerator } from './nlpfilegenerator';
import { SmartMultiAgent } from './smartmultiagent';

export class NLPProjectController {
    private static workspaceRoot: string = '';
    private static projectFiles: Map<string, string> = new Map();
    private static fileTree: any = {};

    static async initialize() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            this.workspaceRoot = workspace.uri.fsPath;
            await this.scanProject();
        }
    }

    static async processNLPCommand(command: string): Promise<string> {
        const cmd = command.toLowerCase().trim();
        
        // Multi-agent operations
        if (cmd.includes('multi-agent') || cmd.includes('agents') || cmd.includes('specialized')) {
            return await this.handleMultiAgentOperation(command);
        }
        
        // File operations
        if (cmd.includes('show') || cmd.includes('open') || cmd.includes('display')) {
            return await this.handleFileDisplay(command);
        }
        
        // File search
        if (cmd.includes('find') || cmd.includes('search') || cmd.includes('locate')) {
            return await this.handleFileSearch(command);
        }
        
        // File modification
        if (cmd.includes('edit') || cmd.includes('modify') || cmd.includes('change') || cmd.includes('update')) {
            return await this.handleFileModification(command);
        }
        
        // File creation (enhanced with multi-agent support)
        if (cmd.includes('create') || cmd.includes('make') || cmd.includes('generate') || cmd.includes('add')) {
            return await this.handleSmartFileCreation(command);
        }
        
        // Project analysis
        if (cmd.includes('analyze') || cmd.includes('summary') || cmd.includes('overview') || cmd.includes('structure')) {
            return await this.handleProjectAnalysis(command);
        }
        
        // File deletion
        if (cmd.includes('delete') || cmd.includes('remove')) {
            return await this.handleFileDeletion(command);
        }
        
        return await this.handleProjectAwareQuery(command);
    }

    private static async handleFileDisplay(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        if (!fileName) {
            return '❌ Please specify a file name to display.';
        }
        
        const filePath = this.findFile(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found in project.`;
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            await vscode.window.showTextDocument(vscode.Uri.file(filePath));
            return `✅ Opened "${fileName}"\n\n**File Content Preview:**\n\`\`\`\n${content.slice(0, 500)}${content.length > 500 ? '...' : ''}\n\`\`\``;
        } catch (error: any) {
            return `❌ Error reading file: ${error.message}`;
        }
    }

    private static async handleFileSearch(command: string): Promise<string> {
        const searchTerm = this.extractSearchTerm(command);
        if (!searchTerm) {
            return '❌ Please specify what to search for.';
        }
        
        const results: string[] = [];
        
        // Search file names
        for (const [fileName, filePath] of this.projectFiles) {
            if (fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push(`📄 **${fileName}** - ${filePath}`);
            }
        }
        
        // Search file contents
        for (const [fileName, filePath] of this.projectFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const lines = content.split('\n');
                    const matchingLines = lines.filter(line => 
                        line.toLowerCase().includes(searchTerm.toLowerCase())
                    ).slice(0, 3);
                    
                    if (matchingLines.length > 0) {
                        results.push(`🔍 **${fileName}**:\n${matchingLines.map(line => `  • ${line.trim()}`).join('\n')}`);
                    }
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        if (results.length === 0) {
            return `❌ No results found for "${searchTerm}"`;
        }
        
        return `🔍 **Search Results for "${searchTerm}":**\n\n${results.slice(0, 10).join('\n\n')}`;
    }

    private static async handleFileModification(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        if (!fileName) {
            return '❌ Please specify a file name to modify.';
        }
        
        const filePath = this.findFile(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found.`;
        }
        
        const modification = this.extractModification(command);
        if (!modification) {
            return '❌ Please specify what changes to make.';
        }
        
        try {
            const currentContent = fs.readFileSync(filePath, 'utf8');
            const prompt = `Modify this file based on the request: "${modification}"\n\nCurrent content:\n${currentContent}\n\nReturn only the modified code:`;
            
            const modifiedContent = await generateCode(prompt, 'llama-3.3-70b-versatile');
            
            // Show diff before applying
            await vscode.commands.executeCommand('coding.showCodeDiff');
            
            return `✅ Generated modifications for "${fileName}". Use the diff viewer to review and apply changes.`;
        } catch (error: any) {
            return `❌ Error modifying file: ${error.message}`;
        }
    }

    private static async handleSmartFileCreation(command: string): Promise<string> {
        const multiFileRequests = MultiFileGenerator.parseMultiFilePrompt(command);
        if (multiFileRequests) {
            return await this.handleMultiFileGeneration(command, multiFileRequests);
        }
        
        if (NLPFileGenerator.isNLPFileRequest(command)) {
            return await this.handleNLPFileGeneration(command);
        }
        
        const fileName = this.extractFileName(command) || this.generateFileName(command);
        const description = this.extractDescription(command);
        
        if (!description) {
            return '❌ Please describe what the file should contain.';
        }
        
        try {
            const projectContext = this.getProjectContextForFile(fileName);
            const prompt = `Create a file named "${fileName}" for this project:\n\nProject Context:\n${projectContext}\n\nRequirements: ${description}\n\nReturn only the file content:`;
            const content = await generateCode(prompt, 'llama-3.3-70b-versatile');
            
            const filePath = path.join(this.workspaceRoot, fileName);
            fs.writeFileSync(filePath, content);
            
            await vscode.window.showTextDocument(vscode.Uri.file(filePath));
            await this.scanProject();
            
            return `✅ Created "${fileName}" with project-aware content.`;
        } catch (error: any) {
            return `❌ Error creating file: ${error.message}`;
        }
    }
    
    private static async handleMultiAgentOperation(command: string): Promise<string> {
        try {
            const projectContext = this.getFullProjectContext();
            const agentResult = await SmartMultiAgent.processMultiAgentCommand(command, projectContext);
            
            if (command.includes('create') || command.includes('generate') || command.includes('build')) {
                const enhancedCommand = `${command}\n\nCurrent Project State:\n${projectContext}`;
                const requests = await NLPFileGenerator.parseNaturalLanguage(enhancedCommand);
                
                if (requests && requests.length > 0) {
                    await MultiFileGenerator.generateMultipleFiles(requests, true);
                    await this.scanProject();
                    return `${agentResult}\n\n✅ Generated ${requests.length} files based on agent recommendations.`;
                }
            }
            
            return agentResult;
        } catch (error: any) {
            return `❌ Multi-agent operation failed: ${error.message}`;
        }
    }
    
    private static async handleMultiFileGeneration(command: string, requests: any[]): Promise<string> {
        try {
            const projectContext = this.getFullProjectContext();
            const useMultiAgent = command.includes('agent') || command.includes('specialized');
            
            const enhancedRequests = requests.map(req => ({
                ...req,
                prompt: `${req.prompt}\n\nProject Context:\n${projectContext}`
            }));
            
            await MultiFileGenerator.generateMultipleFiles(enhancedRequests, useMultiAgent);
            await this.scanProject();
            
            return `✅ Generated ${requests.length} files${useMultiAgent ? ' with specialized agents' : ''} based on current project state.`;
        } catch (error: any) {
            return `❌ Multi-file generation failed: ${error.message}`;
        }
    }
    
    private static async handleNLPFileGeneration(command: string): Promise<string> {
        try {
            const projectContext = this.getFullProjectContext();
            const enhancedCommand = `${command}\n\nCurrent Project State:\n${projectContext}`;
            
            const result = await NLPFileGenerator.generateFromNLP(enhancedCommand);
            await this.scanProject();
            
            return result;
        } catch (error: any) {
            return `❌ NLP file generation failed: ${error.message}`;
        }
    }

    private static async handleProjectAnalysis(command: string): Promise<string> {
        const fileCount = this.projectFiles.size;
        const fileTypes = new Map<string, number>();
        
        for (const fileName of this.projectFiles.keys()) {
            const ext = path.extname(fileName);
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
        }
        
        const topTypes = Array.from(fileTypes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([ext, count]) => `  • ${ext || 'no extension'}: ${count} files`)
            .join('\n');
        
        return `📊 **Project Analysis:**\n\n` +
               `📁 **Total Files:** ${fileCount}\n\n` +
               `📄 **File Types:**\n${topTypes}\n\n` +
               `🏗️ **Project Structure:**\n${this.getProjectStructure()}`;
    }

    private static async handleFileDeletion(command: string): Promise<string> {
        const fileName = this.extractFileName(command);
        if (!fileName) {
            return '❌ Please specify a file name to delete.';
        }
        
        const filePath = this.findFile(fileName);
        if (!filePath) {
            return `❌ File "${fileName}" not found.`;
        }
        
        const confirm = await vscode.window.showWarningMessage(
            `Delete "${fileName}"?`,
            { modal: true },
            'Yes', 'No'
        );
        
        if (confirm === 'Yes') {
            try {
                fs.unlinkSync(filePath);
                await this.scanProject();
                return `✅ Deleted "${fileName}"`;
            } catch (error: any) {
                return `❌ Error deleting file: ${error.message}`;
            }
        }
        
        return '❌ File deletion cancelled.';
    }

    private static async handleProjectAwareQuery(command: string): Promise<string> {
        const fullContext = this.getFullProjectContext();
        const recentFiles = Array.from(this.projectFiles.entries())
            .slice(0, 10)
            .map(([name, filePath]) => `${name}: ${path.relative(this.workspaceRoot, filePath)}`)
            .join('\n');
        
        const prompt = `Answer this question about the project: "${command}"\n\nProject Context:\n${fullContext}\n\nRecent Files:\n${recentFiles}\n\nProject Root: ${this.workspaceRoot}`;
        
        try {
            const response = await generateCode(prompt, 'llama-3.3-70b-versatile');
            return `🤖 **Project-Aware Response:**\n\n${response}`;
        } catch (error: any) {
            return `❌ Error processing query: ${error.message}`;
        }
    }

    private static async scanProject() {
        this.projectFiles.clear();
        if (!this.workspaceRoot) {return;}
        
        const scanDir = (dir: string) => {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                        scanDir(fullPath);
                    } else if (stat.isFile()) {
                        this.projectFiles.set(item, fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };
        
        scanDir(this.workspaceRoot);
    }

    private static extractFileName(command: string): string | null {
        const patterns = [
            /(?:file|open|show|edit|modify|create|delete)\s+["']?([^"'\s]+\.[^"'\s]+)["']?/i,
            /["']([^"']+\.[^"']+)["']/,
            /\b([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)\b/
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1];}
        }
        
        return null;
    }

    private static extractSearchTerm(command: string): string | null {
        const patterns = [
            /(?:find|search|locate)\s+["']?([^"'\n]+)["']?/i,
            /for\s+["']?([^"'\n]+)["']?/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return null;
    }

    private static extractModification(command: string): string | null {
        const patterns = [
            /(?:to|by|with)\s+(.+)/i,
            /(?:edit|modify|change|update)\s+[^"'\s]+\s+(.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return command;
    }

    private static extractDescription(command: string): string | null {
        const patterns = [
            /(?:with|containing|that)\s+(.+)/i,
            /(?:create|make|generate)\s+[^"'\s]+\s+(.+)/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {return match[1].trim();}
        }
        
        return command;
    }

    private static generateFileName(command: string): string {
        const projectType = this.detectProjectType();
        
        if (command.includes('component')) {
            return projectType.includes('React') ? 'Component.tsx' : 'component.js';
        }
        if (command.includes('test')) {
            return projectType.includes('Python') ? 'test.py' : 'test.js';
        }
        if (command.includes('config')) {return 'config.json';}
        if (command.includes('style')) {return 'styles.css';}
        if (command.includes('api')) {
            return projectType.includes('Python') ? 'api.py' : 'api.js';
        }
        if (command.includes('route')) {
            return projectType.includes('Python') ? 'routes.py' : 'routes.js';
        }
        
        if (projectType.includes('Python')) {return 'newfile.py';}
        if (projectType.includes('React')) {return 'newfile.tsx';}
        return 'newfile.js';
    }

    private static findFile(fileName: string): string | null {
        for (const [name, path] of this.projectFiles) {
            if (name.toLowerCase() === fileName.toLowerCase() || 
                name.toLowerCase().includes(fileName.toLowerCase())) {
                return path;
            }
        }
        return null;
    }

    private static getProjectStructure(): string {
        const structure: string[] = [];
        const dirs = new Set<string>();
        
        for (const filePath of this.projectFiles.values()) {
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const dir = path.dirname(relativePath);
            if (dir !== '.') {dirs.add(dir);}
        }
        
        Array.from(dirs).sort().slice(0, 10).forEach(dir => {
            structure.push(`  📁 ${dir}`);
        });
        
        return structure.join('\n') || '  📄 Files in root directory';
    }
    
    private static getProjectContextForFile(fileName: string): string {
        const fileExt = path.extname(fileName);
        const relatedFiles: string[] = [];
        
        for (const [name, filePath] of this.projectFiles) {
            if (path.extname(name) === fileExt || 
                name.includes(path.basename(fileName, fileExt))) {
                relatedFiles.push(`${name}: ${path.relative(this.workspaceRoot, filePath)}`);
            }
        }
        
        return `Project Type: ${this.detectProjectType()}\nRelated Files:\n${relatedFiles.slice(0, 5).join('\n')}`;
    }
    
    private static getFullProjectContext(): string {
        const fileTypes = new Map<string, number>();
        const keyFiles: string[] = [];
        
        for (const [fileName, filePath] of this.projectFiles) {
            const ext = path.extname(fileName);
            fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
            
            if (['package.json', 'tsconfig.json', 'README.md', 'main.py', 'app.js', 'index.js'].includes(fileName)) {
                keyFiles.push(`${fileName}: ${path.relative(this.workspaceRoot, filePath)}`);
            }
        }
        
        const topTypes = Array.from(fileTypes.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([ext, count]) => `${ext}: ${count}`)
            .join(', ');
        
        return `Project Type: ${this.detectProjectType()}\nFile Types: ${topTypes}\nKey Files:\n${keyFiles.join('\n')}\nTotal Files: ${this.projectFiles.size}`;
    }
    
    private static detectProjectType(): string {
        if (this.projectFiles.has('package.json')) {return 'Node.js/JavaScript';}
        if (this.projectFiles.has('requirements.txt') || this.projectFiles.has('pyproject.toml')) {return 'Python';}
        if (this.projectFiles.has('Cargo.toml')) {return 'Rust';}
        if (this.projectFiles.has('go.mod')) {return 'Go';}
        if (this.projectFiles.has('pom.xml')) {return 'Java/Maven';}
        if (Array.from(this.projectFiles.keys()).some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {return 'React';}
        if (Array.from(this.projectFiles.keys()).some(f => f.endsWith('.vue'))) {return 'Vue.js';}
        return 'Generic';
    }
}