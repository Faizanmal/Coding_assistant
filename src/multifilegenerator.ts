import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { generateCode } from './codegenerator';
import { EditTracker } from './edittracker';

interface FileGenerationRequest {
    fileName: string;
    prompt: string;
    language?: string;
}

export class MultiFileGenerator {
    static async generateMultipleFiles(requests: FileGenerationRequest[], useMultiAgent = false): Promise<void> {
        // Start batch operation tracking
        const operationId = EditTracker.startBatchOperation(
            `Generate ${requests.length} files: ${requests.map(r => r.fileName).join(', ')}`,
            useMultiAgent ? 'MultiAgentGenerator' : 'MultiFileGenerator'
        );
        
        if (useMultiAgent) {
            const { MultiAgentGenerator } = await import('./multiagentgenerator');
            const tasks = requests.map(req => ({
                fileName: req.fileName,
                prompt: req.prompt,
                language: req.language || this.getLanguageFromExtension(path.extname(req.fileName))
            }));
            
            // Track all files in this batch operation
            requests.forEach(req => {
                EditTracker.trackAgentOperation(req.fileName, operationId, 'MultiAgentGenerator');
            });
            
            await MultiAgentGenerator.generateWithAgents(tasks);
            
            // Finish batch operation
            EditTracker.finishBatchOperation(operationId);
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            EditTracker.rejectBatchOperation(operationId);
            throw new Error('No workspace folder open');
        }

        const results: { file: string; success: boolean; error?: string }[] = [];

        for (const request of requests) {
            try {
                const filePath = path.join(workspaceFolder.uri.fsPath, request.fileName);
                
                if (fs.existsSync(filePath)) {
                    results.push({ 
                        file: request.fileName, 
                        success: false, 
                        error: 'File already exists' 
                    });
                    continue;
                }

                const enhancedPrompt = this.buildEnhancedPrompt(request.fileName, request.prompt, request.language);
                const code = await generateCode(enhancedPrompt, 'llama-3.3-70b-versatile');
                
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Clean the code output
                const cleanCode = code.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
                const linesCount = cleanCode.split('\n').length;
                fs.writeFileSync(filePath, cleanCode, 'utf8');
                
                // Track the file operation with line count
                EditTracker.trackAgentOperation(request.fileName, operationId, 'MultiFileGenerator');
                EditTracker.updateFileLineCount(request.fileName, linesCount, true);
                
                // Open the created file
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
                results.push({ file: request.fileName, success: true });

            } catch (error: any) {
                results.push({ 
                    file: request.fileName, 
                    success: false, 
                    error: error.message 
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        // Finish batch operation
        EditTracker.finishBatchOperation(operationId);
        
        if (successCount > 0) {
            vscode.window.showInformationMessage(
                `✅ Generated ${successCount} files successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
            );
        }
        
        if (failCount > 0) {
            const failures = results.filter(r => !r.success);
            vscode.window.showErrorMessage(
                `❌ Failed to generate: ${failures.map(f => f.file).join(', ')}`
            );
        }
    }

    static parseMultiFilePrompt(prompt: string): FileGenerationRequest[] | null {
        // Pattern: "generate files: file1.js:prompt1, file2.py:prompt2"
        const multiFilePattern = /generate\s+files?\s*:\s*(.+)/i;
        const match = prompt.match(multiFilePattern);
        
        if (!match) {return null;}

        const fileSpecs = match[1].split(',').map(spec => spec.trim());
        const requests: FileGenerationRequest[] = [];

        for (const spec of fileSpecs) {
            const colonIndex = spec.indexOf(':');
            if (colonIndex === -1) {continue;}

            const fileName = spec.substring(0, colonIndex).trim();
            const filePrompt = spec.substring(colonIndex + 1).trim();
            
            if (fileName && filePrompt) {
                const ext = path.extname(fileName).toLowerCase();
                const language = this.getLanguageFromExtension(ext);
                
                requests.push({
                    fileName,
                    prompt: filePrompt,
                    language
                });
            }
        }

        return requests.length > 0 ? requests : null;
    }

    private static buildEnhancedPrompt(fileName: string, userPrompt: string, language?: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const fileType = this.getFileTypeContext(ext);
        
        // Get current project context
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let projectContext = '';
        if (workspaceFolder) {
            try {
                const files = fs.readdirSync(workspaceFolder.uri.fsPath);
                const packageJson = files.find(f => f === 'package.json');
                const requirements = files.find(f => f === 'requirements.txt');
                const existingFiles = files.filter(f => !f.startsWith('.')).slice(0, 10);
                
                projectContext = `\n**CURRENT PROJECT CONTEXT:**\n- Existing files: ${existingFiles.join(', ')}\n`;
                if (packageJson) {projectContext += '- Project type: Node.js/JavaScript\n';}
                if (requirements) {projectContext += '- Project type: Python\n';}
            } catch (e) {
                // Ignore errors
            }
        }
        
        return `Create a PRODUCTION-READY, COMPLETE ${fileName} file that integrates with the current project.

${projectContext}
Requirements: ${userPrompt}

${fileType.instructions}

IMPORTANT GUIDELINES:
- Write FULL, COMPLETE, PRODUCTION-READY code (not demo/example code)
- Include ALL necessary imports, dependencies, and configurations
- Add comprehensive error handling and validation
- Include proper logging and debugging features
- Add detailed comments explaining complex logic
- Follow industry best practices and design patterns
- Make code scalable, maintainable, and performant
- Include security considerations where applicable
- Add proper type definitions (if applicable)
- Include configuration options and environment variables

Provide ONLY the complete code content, no explanations or markdown formatting.`;
    }

    private static getFileTypeContext(ext: string): { instructions: string } {
        const contexts: { [key: string]: { instructions: string } } = {
            '.js': {
                instructions: `For JavaScript files:
- Use modern ES6+ syntax with proper module exports
- Include comprehensive error handling with try-catch blocks
- Add input validation and sanitization
- Include proper async/await patterns where needed
- Add JSDoc comments for functions and classes
- Include configuration management
- Add logging with different levels (info, warn, error)
- Follow Node.js best practices if server-side`
            },
            '.ts': {
                instructions: `For TypeScript files:
- Use strict TypeScript with proper type definitions
- Create interfaces and types for all data structures
- Include comprehensive error handling with custom error classes
- Add proper generic types where applicable
- Include decorators if using frameworks like Angular/NestJS
- Add proper import/export statements
- Include configuration interfaces
- Follow SOLID principles`
            },
            '.py': {
                instructions: `For Python files:
- Use type hints and proper docstrings
- Include comprehensive error handling with custom exceptions
- Add logging with proper configuration
- Follow PEP 8 style guidelines
- Include proper class structures with __init__, __str__, __repr__
- Add configuration management with environment variables
- Include proper imports and requirements
- Add unit test compatibility`
            },
            '.java': {
                instructions: `For Java files:
- Use proper package declarations and imports
- Include comprehensive exception handling
- Add proper class structure with constructors, getters, setters
- Include logging with SLF4J or similar
- Follow Java naming conventions
- Add proper annotations where applicable
- Include configuration management
- Follow SOLID principles and design patterns`
            },
            '.html': {
                instructions: `For HTML files:
- Create semantic, accessible HTML5 structure
- Include proper meta tags, viewport, and SEO elements
- Add ARIA attributes for accessibility
- Include proper form validation
- Add responsive design considerations
- Include proper script and stylesheet links
- Add proper error handling for forms
- Include security headers and CSP considerations`
            },
            '.css': {
                instructions: `For CSS files:
- Create responsive, mobile-first design
- Use CSS Grid and Flexbox for layouts
- Include CSS custom properties (variables)
- Add proper browser compatibility
- Include hover, focus, and active states
- Add proper typography and spacing systems
- Include dark mode support where applicable
- Follow BEM or similar naming conventions`
            },
            '.json': {
                instructions: `For JSON files:
- Create well-structured, valid JSON
- Include all necessary configuration options
- Add proper nesting and organization
- Include environment-specific configurations
- Add proper validation schemas where applicable
- Include comprehensive settings and options
- Follow JSON best practices for performance`
            },
            '.md': {
                instructions: `For Markdown files:
- Create comprehensive documentation
- Include proper headings, code blocks, and formatting
- Add installation, usage, and configuration instructions
- Include examples and troubleshooting sections
- Add proper links, images, and references
- Include API documentation if applicable
- Add contributing guidelines and license information`
            }
        };
        
        return contexts[ext] || {
            instructions: `Create a complete, production-ready file with:
- Proper structure and organization
- Comprehensive functionality
- Error handling and validation
- Detailed comments and documentation
- Industry best practices
- Scalable and maintainable code`
        };
    }

    private static getLanguageFromExtension(ext: string): string {
        const langMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.html': 'html',
            '.css': 'css',
            '.json': 'json',
            '.md': 'markdown'
        };
        return langMap[ext] || 'text';
    }
}