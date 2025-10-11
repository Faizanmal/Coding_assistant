import * as vscode from 'vscode';
import { generateCode } from './codegenerator';

/**
 * Diagram types supported by the whiteboard
 */
export enum DiagramType {
    FLOWCHART = 'flowchart',
    SEQUENCE = 'sequence',
    CLASS = 'class',
    ER = 'er',
    COMPONENT = 'component',
    STATE = 'state',
    GANTT = 'gantt',
    MINDMAP = 'mindmap'
}

/**
 * Drawing element types
 */
export enum ElementType {
    RECTANGLE = 'rectangle',
    CIRCLE = 'circle',
    DIAMOND = 'diamond',
    ARROW = 'arrow',
    TEXT = 'text',
    LINE = 'line',
    CONNECTOR = 'connector'
}

/**
 * Drawing element definition
 */
export interface DrawingElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    color?: string;
    style?: any;
    connections?: string[]; // Connected element IDs
    metadata?: {
        codeType?: string;
        language?: string;
        parameters?: string[];
        returnType?: string;
    };
}

/**
 * Whiteboard canvas state
 */
export interface WhiteboardState {
    id: string;
    name: string;
    elements: DrawingElement[];
    connections: Array<{
        from: string;
        to: string;
        type: 'flow' | 'data' | 'inheritance' | 'composition';
        label?: string;
    }>;
    diagramType: DiagramType;
    metadata: {
        created: Date;
        lastModified: Date;
        version: number;
        tags: string[];
    };
}

/**
 * Code generation configuration
 */
export interface CodeGenConfig {
    targetLanguage: string;
    framework?: string;
    includeComments: boolean;
    includeTests: boolean;
    codeStyle: 'functional' | 'object-oriented' | 'procedural';
    outputFormat: 'files' | 'single-file' | 'skeleton';
}

/**
 * Interactive Whiteboard for Flow Design and Code Generation
 */
export class InteractiveWhiteboard {
    private whiteboardPanel: vscode.WebviewPanel | null = null;
    private currentState: WhiteboardState | null = null;
    private savedStates: Map<string, WhiteboardState> = new Map();
    private outputChannel: vscode.OutputChannel;
    private storageUri: vscode.Uri;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Interactive Whiteboard');
        this.storageUri = vscode.Uri.joinPath(context.globalStorageUri, 'whiteboard');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await this.loadSavedStates();
            this.outputChannel.appendLine('Interactive Whiteboard initialized');
        } catch (error) {
            this.outputChannel.appendLine(`Initialization error: ${(error as Error).message}`);
        }
    }

    /**
     * Open whiteboard interface
     */
    async openWhiteboard(diagramType: DiagramType = DiagramType.FLOWCHART): Promise<void> {
        if (this.whiteboardPanel) {
            this.whiteboardPanel.reveal();
            return;
        }

        this.whiteboardPanel = vscode.window.createWebviewPanel(
            'interactiveWhiteboard',
            'Interactive Whiteboard',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri]
            }
        );

        // Initialize new whiteboard state
        this.currentState = this.createNewWhiteboardState(diagramType);

        // Set up webview content
        this.whiteboardPanel.webview.html = this.getWhiteboardHTML();

        // Handle messages from webview
        this.whiteboardPanel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message)
        );

        this.whiteboardPanel.onDidDispose(() => {
            this.whiteboardPanel = null;
            this.currentState = null;
        });

        this.outputChannel.appendLine(`Opened whiteboard with ${diagramType} template`);
    }

    /**
     * Handle messages from webview
     */
    private async handleWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case 'updateElements':
                await this.updateElements(message.elements, message.connections);
                break;
            case 'generateCode':
                await this.generateCodeFromDiagram(message.config);
                break;
            case 'saveWhiteboard':
                await this.saveWhiteboard(message.name);
                break;
            case 'loadWhiteboard':
                await this.loadWhiteboard(message.id);
                break;
            case 'exportDiagram':
                await this.exportDiagram(message.format);
                break;
            case 'analyzeDiagram':
                await this.analyzeDiagram();
                break;
            case 'templateRequest':
                await this.loadTemplate(message.templateType);
                break;
        }
    }

    /**
     * Update diagram elements
     */
    private async updateElements(elements: DrawingElement[], connections: any[]): Promise<void> {
        if (!this.currentState) {return;}

        this.currentState.elements = elements;
        this.currentState.connections = connections;
        this.currentState.metadata.lastModified = new Date();
        this.currentState.metadata.version++;

        this.outputChannel.appendLine(`Updated diagram: ${elements.length} elements, ${connections.length} connections`);
    }

    /**
     * Generate code from current diagram
     */
    private async generateCodeFromDiagram(config: CodeGenConfig): Promise<void> {
        if (!this.currentState) {
            vscode.window.showErrorMessage('No active whiteboard found');
            return;
        }

        try {
            const diagramAnalysis = this.analyzeDiagramStructure();
            const codePrompt = this.buildCodeGenerationPrompt(diagramAnalysis, config);
            
            const result = await generateCode(codePrompt, 'whiteboard-generated');
            
            // Create new files or insert code based on config
            if (config.outputFormat === 'files') {
                await this.createCodeFiles(result, config);
            } else {
                await this.insertCodeIntoActiveEditor(result);
            }

            vscode.window.showInformationMessage('Code generated successfully from diagram!');
            this.outputChannel.appendLine('Code generation completed');

        } catch (error) {
            vscode.window.showErrorMessage(`Code generation failed: ${(error as Error).message}`);
            this.outputChannel.appendLine(`Code generation error: ${(error as Error).message}`);
        }
    }

    /**
     * Analyze diagram structure for code generation
     */
    private analyzeDiagramStructure(): any {
        if (!this.currentState) {
            return {};
        }

        const analysis = {
            diagramType: this.currentState.diagramType,
            elements: this.currentState.elements.map(elem => ({
                id: elem.id,
                type: elem.type,
                text: elem.text,
                metadata: elem.metadata
            })),
            connections: this.currentState.connections,
            patterns: this.detectPatterns(),
            complexity: this.calculateComplexity(),
            suggestions: this.generateSuggestions()
        };

        return analysis;
    }

    /**
     * Detect common design patterns in the diagram
     */
    private detectPatterns(): string[] {
        if (!this.currentState) {
            return [];
        }

        const patterns: string[] = [];
        const elements = this.currentState.elements;
        const connections = this.currentState.connections;

        // Detect MVC pattern
        const hasModel = elements.some(e => e.text?.toLowerCase().includes('model'));
        const hasView = elements.some(e => e.text?.toLowerCase().includes('view'));
        const hasController = elements.some(e => e.text?.toLowerCase().includes('controller'));
        if (hasModel && hasView && hasController) {
            patterns.push('MVC');
        }

        // Detect Factory pattern
        const hasFactory = elements.some(e => e.text?.toLowerCase().includes('factory'));
        if (hasFactory) {
            patterns.push('Factory');
        }

        // Detect Observer pattern
        const observerConnections = connections.filter(c => c.label?.toLowerCase().includes('notify'));
        if (observerConnections.length > 0) {
            patterns.push('Observer');
        }

        // Detect Strategy pattern
        const hasStrategy = elements.some(e => e.text?.toLowerCase().includes('strategy'));
        if (hasStrategy) {
            patterns.push('Strategy');
        }

        return patterns;
    }

    /**
     * Calculate diagram complexity
     */
    private calculateComplexity(): number {
        if (!this.currentState) {
            return 0;
        }

        const elementCount = this.currentState.elements.length;
        const connectionCount = this.currentState.connections.length;
        const uniqueTypes = new Set(this.currentState.elements.map(e => e.type)).size;

        // Simple complexity score
        return Math.round((elementCount * 0.3 + connectionCount * 0.5 + uniqueTypes * 0.2) * 10) / 10;
    }

    /**
     * Generate improvement suggestions
     */
    private generateSuggestions(): string[] {
        if (!this.currentState) {
            return [];
        }

        const suggestions: string[] = [];
        const elements = this.currentState.elements;
        const connections = this.currentState.connections;

        // Check for isolated elements
        const connectedElements = new Set();
        connections.forEach(conn => {
            connectedElements.add(conn.from);
            connectedElements.add(conn.to);
        });
        const isolatedCount = elements.length - connectedElements.size;
        if (isolatedCount > 0) {
            suggestions.push(`Consider connecting ${isolatedCount} isolated elements`);
        }

        // Check for overly complex nodes
        const connectionCounts = new Map<string, number>();
        connections.forEach(conn => {
            connectionCounts.set(conn.from, (connectionCounts.get(conn.from) || 0) + 1);
            connectionCounts.set(conn.to, (connectionCounts.get(conn.to) || 0) + 1);
        });
        
        const complexNodes = Array.from(connectionCounts.entries()).filter(([_, count]) => count > 5);
        if (complexNodes.length > 0) {
            suggestions.push('Consider breaking down highly connected components');
        }

        // Check for missing error handling
        const hasErrorHandling = elements.some(e => e.text?.toLowerCase().includes('error') || e.text?.toLowerCase().includes('exception'));
        if (!hasErrorHandling && elements.length > 5) {
            suggestions.push('Consider adding error handling components');
        }

        return suggestions;
    }

    /**
     * Build code generation prompt
     */
    private buildCodeGenerationPrompt(analysis: any, config: CodeGenConfig): string {
        const prompt = `Generate ${config.targetLanguage} code from this diagram analysis:

Diagram Type: ${analysis.diagramType}
Elements: ${JSON.stringify(analysis.elements, null, 2)}
Connections: ${JSON.stringify(analysis.connections, null, 2)}
Detected Patterns: ${analysis.patterns.join(', ')}
Complexity Score: ${analysis.complexity}

Configuration:
- Language: ${config.targetLanguage}
- Framework: ${config.framework || 'None'}
- Style: ${config.codeStyle}
- Include Comments: ${config.includeComments}
- Include Tests: ${config.includeTests}

Requirements:
1. Create ${config.codeStyle} code that reflects the diagram structure
2. Implement proper relationships shown by connections
3. Include error handling and validation
4. Follow best practices for ${config.targetLanguage}
5. ${config.includeComments ? 'Add comprehensive comments' : ''}
6. ${config.includeTests ? 'Include unit tests' : ''}

${analysis.suggestions.length > 0 ? `
Suggestions to consider:
${analysis.suggestions.map((s: string) => `- ${s}`).join('\n')}
` : ''}

Please generate production-ready code with proper structure and documentation.`;

        return prompt;
    }

    /**
     * Create code files from generated content
     */
    private async createCodeFiles(content: string, config: CodeGenConfig): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }

        const workspaceUri = workspaceFolders[0].uri;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const folderName = `whiteboard-generated-${timestamp}`;
        const folderUri = vscode.Uri.joinPath(workspaceUri, folderName);

        await vscode.workspace.fs.createDirectory(folderUri);

        // Parse content and create appropriate files
        const fileExtension = this.getFileExtension(config.targetLanguage);
        
        if (config.outputFormat === 'files') {
            // Split content into logical files
            const files = this.parseContentIntoFiles(content, fileExtension);
            
            for (const [filename, fileContent] of files) {
                const fileUri = vscode.Uri.joinPath(folderUri, filename);
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(fileContent));
            }
        } else {
            // Single file
            const filename = `generated-code.${fileExtension}`;
            const fileUri = vscode.Uri.joinPath(folderUri, filename);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content));
        }

        // Open the generated folder
        await vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: false });
    }

    /**
     * Insert code into active editor
     */
    private async insertCodeIntoActiveEditor(content: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            // Create new untitled document
            const document = await vscode.workspace.openTextDocument({
                content,
                language: 'typescript'
            });
            await vscode.window.showTextDocument(document);
        } else {
            // Insert at cursor position
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, content);
            });
        }
    }

    /**
     * Get file extension for language
     */
    private getFileExtension(language: string): string {
        const extensionMap: { [key: string]: string } = {
            'typescript': 'ts',
            'javascript': 'js',
            'python': 'py',
            'java': 'java',
            'csharp': 'cs',
            'cpp': 'cpp',
            'go': 'go',
            'rust': 'rs',
            'php': 'php',
            'ruby': 'rb',
            'swift': 'swift',
            'kotlin': 'kt'
        };
        
        return extensionMap[language.toLowerCase()] || 'txt';
    }

    /**
     * Parse content into multiple files
     */
    private parseContentIntoFiles(content: string, extension: string): Map<string, string> {
        const files = new Map<string, string>();
        
        // Simple parsing logic - can be enhanced based on language
        const classMatches = content.match(/class\s+(\w+)[^{]*{[^}]*}/gs);
        const interfaceMatches = content.match(/interface\s+(\w+)[^{]*{[^}]*}/gs);
        const functionMatches = content.match(/function\s+(\w+)[^{]*{[^}]*}/gs);

        if (classMatches && classMatches.length > 1) {
            // Multiple classes - separate files
            classMatches.forEach((classCode, index) => {
                const className = classCode.match(/class\s+(\w+)/)?.[1] || `Class${index + 1}`;
                files.set(`${className}.${extension}`, classCode);
            });
        } else if (interfaceMatches && interfaceMatches.length > 1) {
            // Multiple interfaces - separate files
            interfaceMatches.forEach((interfaceCode, index) => {
                const interfaceName = interfaceCode.match(/interface\s+(\w+)/)?.[1] || `Interface${index + 1}`;
                files.set(`${interfaceName}.${extension}`, interfaceCode);
            });
        } else {
            // Single file with all content
            files.set(`main.${extension}`, content);
        }

        // Add tests if detected
        const testMatches = content.match(/test\s+['"]\w+['"][^{]*{[^}]*}/gs);
        if (testMatches) {
            const testContent = testMatches.join('\n\n');
            files.set(`tests.${extension}`, testContent);
        }

        return files;
    }

    /**
     * Save current whiteboard state
     */
    private async saveWhiteboard(name: string): Promise<void> {
        if (!this.currentState) {
            return;
        }

        this.currentState.name = name;
        this.currentState.id = this.generateId();
        this.savedStates.set(this.currentState.id, { ...this.currentState });
        
        await this.persistWhiteboardStates();
        
        vscode.window.showInformationMessage(`Whiteboard saved as "${name}"`);
        this.outputChannel.appendLine(`Saved whiteboard: ${name}`);
    }

    /**
     * Load existing whiteboard
     */
    private async loadWhiteboard(id: string): Promise<void> {
        const state = this.savedStates.get(id);
        if (!state) {
            vscode.window.showErrorMessage('Whiteboard not found');
            return;
        }

        this.currentState = { ...state };
        
        // Update webview
        if (this.whiteboardPanel) {
            this.whiteboardPanel.webview.postMessage({
                command: 'loadState',
                state: this.currentState
            });
        }

        vscode.window.showInformationMessage(`Loaded whiteboard: ${state.name}`);
        this.outputChannel.appendLine(`Loaded whiteboard: ${state.name}`);
    }

    /**
     * Export diagram in various formats
     */
    private async exportDiagram(format: 'svg' | 'png' | 'mermaid' | 'json'): Promise<void> {
        if (!this.currentState) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const exportData = this.generateExportData(format);
        const filename = `diagram-${Date.now()}.${format}`;
        const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, filename);

        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(exportData));
        
        vscode.window.showInformationMessage(`Diagram exported as ${filename}`);
        this.outputChannel.appendLine(`Exported diagram: ${filename}`);
    }

    /**
     * Generate export data for different formats
     */
    private generateExportData(format: string): string {
        if (!this.currentState) {
            return '';
        }

        switch (format) {
            case 'json':
                return JSON.stringify(this.currentState, null, 2);
            
            case 'mermaid':
                return this.generateMermaidDiagram();
            
            case 'svg':
                return this.generateSVGDiagram();
            
            default:
                return JSON.stringify(this.currentState, null, 2);
        }
    }

    /**
     * Generate Mermaid diagram syntax
     */
    private generateMermaidDiagram(): string {
        if (!this.currentState) {
            return '';
        }

        let mermaid = '';
        
        switch (this.currentState.diagramType) {
            case DiagramType.FLOWCHART:
                mermaid = 'flowchart TD\n';
                this.currentState.elements.forEach(elem => {
                    const shape = this.getMermaidShape(elem.type);
                    mermaid += `    ${elem.id}${shape}${elem.text || elem.id}${shape}\n`;
                });
                this.currentState.connections.forEach(conn => {
                    mermaid += `    ${conn.from} --> ${conn.to}\n`;
                });
                break;
            
            case DiagramType.SEQUENCE:
                mermaid = 'sequenceDiagram\n';
                // Add sequence diagram logic
                break;
            
            case DiagramType.CLASS:
                mermaid = 'classDiagram\n';
                // Add class diagram logic
                break;
        }

        return mermaid;
    }

    /**
     * Get Mermaid shape syntax for element type
     */
    private getMermaidShape(elementType: ElementType): string {
        switch (elementType) {
            case ElementType.RECTANGLE:
                return '[';
            case ElementType.CIRCLE:
                return '((';
            case ElementType.DIAMOND:
                return '{';
            default:
                return '[';
        }
    }

    /**
     * Generate SVG diagram
     */
    private generateSVGDiagram(): string {
        if (!this.currentState) {
            return '';
        }

        let svg = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">`;
        
        // Add elements
        this.currentState.elements.forEach(elem => {
            svg += this.generateSVGElement(elem);
        });

        // Add connections
        this.currentState.connections.forEach(conn => {
            const fromElem = this.currentState!.elements.find(e => e.id === conn.from);
            const toElem = this.currentState!.elements.find(e => e.id === conn.to);
            if (fromElem && toElem) {
                svg += this.generateSVGConnection(fromElem, toElem);
            }
        });

        svg += '</svg>';
        return svg;
    }

    /**
     * Generate SVG element
     */
    private generateSVGElement(elem: DrawingElement): string {
        switch (elem.type) {
            case ElementType.RECTANGLE:
                return `<rect x="${elem.x}" y="${elem.y}" width="${elem.width}" height="${elem.height}" 
                        fill="${elem.color || '#e1f5fe'}" stroke="#01579b" stroke-width="2"/>
                        <text x="${elem.x + elem.width/2}" y="${elem.y + elem.height/2}" 
                        text-anchor="middle" dominant-baseline="middle">${elem.text || ''}</text>`;
            
            case ElementType.CIRCLE:
                const radius = Math.min(elem.width, elem.height) / 2;
                return `<circle cx="${elem.x + radius}" cy="${elem.y + radius}" r="${radius}" 
                        fill="${elem.color || '#e8f5e8'}" stroke="#2e7d32" stroke-width="2"/>
                        <text x="${elem.x + radius}" y="${elem.y + radius}" 
                        text-anchor="middle" dominant-baseline="middle">${elem.text || ''}</text>`;
            
            default:
                return '';
        }
    }

    /**
     * Generate SVG connection
     */
    private generateSVGConnection(from: DrawingElement, to: DrawingElement): string {
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + to.height / 2;

        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                stroke="#424242" stroke-width="2" marker-end="url(#arrowhead)"/>`;
    }

    /**
     * Analyze current diagram
     */
    private async analyzeDiagram(): Promise<void> {
        if (!this.currentState) {
            return;
        }

        const analysis = this.analyzeDiagramStructure();
        
        const analysisPrompt = `Analyze this diagram and provide insights:
        
        ${JSON.stringify(analysis, null, 2)}
        
        Provide:
        1. Structural analysis
        2. Design pattern identification
        3. Improvement suggestions
        4. Code generation readiness
        5. Potential issues or missing components`;

        try {
            const result = await generateCode(analysisPrompt, 'diagram-analysis');
            
            // Show analysis in output channel
            this.outputChannel.clear();
            this.outputChannel.appendLine('=== Diagram Analysis ===');
            this.outputChannel.appendLine(result);
            this.outputChannel.show();

            vscode.window.showInformationMessage('Diagram analysis complete. Check the output panel for details.');

        } catch (error) {
            vscode.window.showErrorMessage(`Analysis failed: ${(error as Error).message}`);
        }
    }

    /**
     * Load diagram template
     */
    private async loadTemplate(templateType: string): Promise<void> {
        const template = this.getTemplate(templateType);
        if (!template) {
            vscode.window.showErrorMessage('Template not found');
            return;
        }

        this.currentState = template;
        
        if (this.whiteboardPanel) {
            this.whiteboardPanel.webview.postMessage({
                command: 'loadState',
                state: this.currentState
            });
        }

        vscode.window.showInformationMessage(`Loaded ${templateType} template`);
    }

    /**
     * Get predefined templates
     */
    private getTemplate(templateType: string): WhiteboardState | null {
        const templates: { [key: string]: WhiteboardState } = {
            'mvc': this.createMVCTemplate(),
            'microservices': this.createMicroservicesTemplate(),
            'api': this.createAPITemplate(),
            'database': this.createDatabaseTemplate(),
            'workflow': this.createWorkflowTemplate()
        };

        return templates[templateType] || null;
    }

    /**
     * Create MVC template
     */
    private createMVCTemplate(): WhiteboardState {
        return {
            id: 'mvc-template',
            name: 'MVC Architecture Template',
            diagramType: DiagramType.COMPONENT,
            elements: [
                {
                    id: 'model',
                    type: ElementType.RECTANGLE,
                    x: 50,
                    y: 200,
                    width: 120,
                    height: 80,
                    text: 'Model',
                    color: '#e3f2fd',
                    metadata: { codeType: 'class', language: 'typescript' }
                },
                {
                    id: 'view',
                    type: ElementType.RECTANGLE,
                    x: 250,
                    y: 50,
                    width: 120,
                    height: 80,
                    text: 'View',
                    color: '#f3e5f5',
                    metadata: { codeType: 'component', language: 'typescript' }
                },
                {
                    id: 'controller',
                    type: ElementType.RECTANGLE,
                    x: 250,
                    y: 350,
                    width: 120,
                    height: 80,
                    text: 'Controller',
                    color: '#e8f5e8',
                    metadata: { codeType: 'class', language: 'typescript' }
                }
            ],
            connections: [
                { from: 'controller', to: 'model', type: 'data', label: 'updates' },
                { from: 'model', to: 'view', type: 'data', label: 'notifies' },
                { from: 'view', to: 'controller', type: 'flow', label: 'user input' }
            ],
            metadata: {
                created: new Date(),
                lastModified: new Date(),
                version: 1,
                tags: ['architecture', 'mvc', 'template']
            }
        };
    }

    /**
     * Create other templates...
     */
    private createMicroservicesTemplate(): WhiteboardState {
        // Implementation for microservices template
        return this.createNewWhiteboardState(DiagramType.COMPONENT);
    }

    private createAPITemplate(): WhiteboardState {
        // Implementation for API template
        return this.createNewWhiteboardState(DiagramType.SEQUENCE);
    }

    private createDatabaseTemplate(): WhiteboardState {
        // Implementation for database template
        return this.createNewWhiteboardState(DiagramType.ER);
    }

    private createWorkflowTemplate(): WhiteboardState {
        // Implementation for workflow template
        return this.createNewWhiteboardState(DiagramType.FLOWCHART);
    }

    /**
     * Create new whiteboard state
     */
    private createNewWhiteboardState(diagramType: DiagramType): WhiteboardState {
        return {
            id: this.generateId(),
            name: 'New Whiteboard',
            elements: [],
            connections: [],
            diagramType,
            metadata: {
                created: new Date(),
                lastModified: new Date(),
                version: 1,
                tags: []
            }
        };
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `wb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get whiteboard HTML
     */
    private getWhiteboardHTML(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interactive Whiteboard</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                    display: flex;
                    height: 100vh;
                }
                .toolbar {
                    width: 200px;
                    background: #2d2d30;
                    color: white;
                    padding: 20px;
                    overflow-y: auto;
                }
                .canvas-container {
                    flex: 1;
                    position: relative;
                    background: white;
                }
                #canvas {
                    width: 100%;
                    height: 100%;
                    cursor: crosshair;
                }
                .tool-section {
                    margin-bottom: 20px;
                }
                .tool-section h3 {
                    margin: 0 0 10px 0;
                    color: #cccccc;
                    font-size: 14px;
                    text-transform: uppercase;
                }
                .tool-btn {
                    display: block;
                    width: 100%;
                    padding: 8px 12px;
                    margin: 5px 0;
                    background: #3c3c3c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .tool-btn:hover {
                    background: #4a4a4a;
                }
                .tool-btn.active {
                    background: #007acc;
                }
                .properties-panel {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 250px;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 15px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-size: 12px;
                    font-weight: bold;
                    color: #333;
                }
                .form-group input, .form-group select, .form-group textarea {
                    width: 100%;
                    padding: 6px 8px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    font-size: 12px;
                }
                .action-buttons {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    display: flex;
                    gap: 10px;
                }
                .action-btn {
                    padding: 10px 20px;
                    background: #007acc;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .action-btn:hover {
                    background: #005a9e;
                }
                .action-btn.secondary {
                    background: #6c757d;
                }
                .action-btn.secondary:hover {
                    background: #545b62;
                }
                .templates {
                    margin-top: 20px;
                }
                .template-btn {
                    display: block;
                    width: 100%;
                    padding: 6px 10px;
                    margin: 3px 0;
                    background: #4a4a4a;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                }
                .template-btn:hover {
                    background: #5a5a5a;
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <div class="tool-section">
                    <h3>Drawing Tools</h3>
                    <button class="tool-btn active" data-tool="select">Select</button>
                    <button class="tool-btn" data-tool="rectangle">Rectangle</button>
                    <button class="tool-btn" data-tool="circle">Circle</button>
                    <button class="tool-btn" data-tool="diamond">Diamond</button>
                    <button class="tool-btn" data-tool="text">Text</button>
                    <button class="tool-btn" data-tool="arrow">Arrow</button>
                    <button class="tool-btn" data-tool="line">Line</button>
                </div>
                
                <div class="tool-section">
                    <h3>Diagram Types</h3>
                    <button class="tool-btn" data-diagram="flowchart">Flowchart</button>
                    <button class="tool-btn" data-diagram="sequence">Sequence</button>
                    <button class="tool-btn" data-diagram="class">Class</button>
                    <button class="tool-btn" data-diagram="component">Component</button>
                    <button class="tool-btn" data-diagram="state">State</button>
                </div>
                
                <div class="templates">
                    <h3>Templates</h3>
                    <button class="template-btn" onclick="loadTemplate('mvc')">MVC Architecture</button>
                    <button class="template-btn" onclick="loadTemplate('microservices')">Microservices</button>
                    <button class="template-btn" onclick="loadTemplate('api')">API Design</button>
                    <button class="template-btn" onclick="loadTemplate('database')">Database Schema</button>
                    <button class="template-btn" onclick="loadTemplate('workflow')">Workflow</button>
                </div>
            </div>
            
            <div class="canvas-container">
                <canvas id="canvas"></canvas>
                
                <div class="properties-panel" id="propertiesPanel" style="display: none;">
                    <h3>Element Properties</h3>
                    <div class="form-group">
                        <label for="elemText">Text:</label>
                        <input type="text" id="elemText" placeholder="Element text">
                    </div>
                    <div class="form-group">
                        <label for="elemColor">Color:</label>
                        <input type="color" id="elemColor" value="#e3f2fd">
                    </div>
                    <div class="form-group">
                        <label for="elemType">Code Type:</label>
                        <select id="elemType">
                            <option value="">Select type</option>
                            <option value="function">Function</option>
                            <option value="class">Class</option>
                            <option value="interface">Interface</option>
                            <option value="component">Component</option>
                            <option value="service">Service</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="elemLanguage">Language:</label>
                        <select id="elemLanguage">
                            <option value="typescript">TypeScript</option>
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="csharp">C#</option>
                        </select>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="action-btn secondary" onclick="analyzeWhiteboard()">Analyze</button>
                    <button class="action-btn secondary" onclick="saveWhiteboard()">Save</button>
                    <button class="action-btn" onclick="generateCode()">Generate Code</button>
                </div>
            </div>
            
            <script>
                // Whiteboard drawing and interaction logic
                const canvas = document.getElementById('canvas');
                const ctx = canvas.getContext('2d');
                let currentTool = 'select';
                let elements = [];
                let connections = [];
                let selectedElement = null;
                let isDrawing = false;
                let startX, startY;
                
                // Set canvas size
                function resizeCanvas() {
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;
                    redraw();
                }
                window.addEventListener('resize', resizeCanvas);
                resizeCanvas();
                
                // Tool selection
                document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.querySelector('.tool-btn.active').classList.remove('active');
                        btn.classList.add('active');
                        currentTool = btn.dataset.tool;
                    });
                });
                
                // Canvas event handlers
                canvas.addEventListener('mousedown', handleMouseDown);
                canvas.addEventListener('mousemove', handleMouseMove);
                canvas.addEventListener('mouseup', handleMouseUp);
                canvas.addEventListener('click', handleClick);
                
                function handleMouseDown(e) {
                    const rect = canvas.getBoundingClientRect();
                    startX = e.clientX - rect.left;
                    startY = e.clientY - rect.top;
                    
                    if (currentTool === 'select') {
                        selectedElement = getElementAt(startX, startY);
                        showProperties(selectedElement);
                    } else {
                        isDrawing = true;
                    }
                }
                
                function handleMouseMove(e) {
                    if (!isDrawing) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const currentX = e.clientX - rect.left;
                    const currentY = e.clientY - rect.top;
                    
                    redraw();
                    drawPreview(startX, startY, currentX, currentY);
                }
                
                function handleMouseUp(e) {
                    if (!isDrawing) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const endX = e.clientX - rect.left;
                    const endY = e.clientY - rect.top;
                    
                    createElement(startX, startY, endX, endY);
                    isDrawing = false;
                    
                    updateElements();
                }
                
                function handleClick(e) {
                    if (currentTool !== 'text') return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    const text = prompt('Enter text:');
                    if (text) {
                        elements.push({
                            id: generateId(),
                            type: 'text',
                            x: x - 50,
                            y: y - 10,
                            width: 100,
                            height: 20,
                            text: text,
                            color: '#000000'
                        });
                        redraw();
                        updateElements();
                    }
                }
                
                function createElement(x1, y1, x2, y2) {
                    const element = {
                        id: generateId(),
                        type: currentTool,
                        x: Math.min(x1, x2),
                        y: Math.min(y1, y2),
                        width: Math.abs(x2 - x1),
                        height: Math.abs(y2 - y1),
                        text: '',
                        color: '#e3f2fd',
                        metadata: {}
                    };
                    
                    elements.push(element);
                    redraw();
                }
                
                function drawPreview(x1, y1, x2, y2) {
                    ctx.strokeStyle = '#999';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    
                    switch (currentTool) {
                        case 'rectangle':
                            ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), 
                                         Math.abs(x2 - x1), Math.abs(y2 - y1));
                            break;
                        case 'circle':
                            const radius = Math.sqrt((x2-x1)**2 + (y2-y1)**2) / 2;
                            ctx.beginPath();
                            ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, radius, 0, 2 * Math.PI);
                            ctx.stroke();
                            break;
                        case 'line':
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                            break;
                    }
                    
                    ctx.setLineDash([]);
                }
                
                function redraw() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw connections first
                    connections.forEach(conn => {
                        drawConnection(conn);
                    });
                    
                    // Draw elements
                    elements.forEach(elem => {
                        drawElement(elem);
                        if (elem === selectedElement) {
                            drawSelection(elem);
                        }
                    });
                }
                
                function drawElement(elem) {
                    ctx.fillStyle = elem.color || '#e3f2fd';
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    
                    switch (elem.type) {
                        case 'rectangle':
                            ctx.fillRect(elem.x, elem.y, elem.width, elem.height);
                            ctx.strokeRect(elem.x, elem.y, elem.width, elem.height);
                            break;
                        case 'circle':
                            const radius = Math.min(elem.width, elem.height) / 2;
                            ctx.beginPath();
                            ctx.arc(elem.x + radius, elem.y + radius, radius, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.stroke();
                            break;
                        case 'diamond':
                            ctx.beginPath();
                            ctx.moveTo(elem.x + elem.width/2, elem.y);
                            ctx.lineTo(elem.x + elem.width, elem.y + elem.height/2);
                            ctx.lineTo(elem.x + elem.width/2, elem.y + elem.height);
                            ctx.lineTo(elem.x, elem.y + elem.height/2);
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                            break;
                    }
                    
                    // Draw text
                    if (elem.text) {
                        ctx.fillStyle = '#333';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(elem.text, elem.x + elem.width/2, elem.y + elem.height/2);
                    }
                }
                
                function drawConnection(conn) {
                    const fromElem = elements.find(e => e.id === conn.from);
                    const toElem = elements.find(e => e.id === conn.to);
                    
                    if (!fromElem || !toElem) return;
                    
                    const x1 = fromElem.x + fromElem.width / 2;
                    const y1 = fromElem.y + fromElem.height / 2;
                    const x2 = toElem.x + toElem.width / 2;
                    const y2 = toElem.y + toElem.height / 2;
                    
                    ctx.strokeStyle = '#666';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                    
                    // Draw arrow
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    const arrowLength = 10;
                    ctx.beginPath();
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - arrowLength * Math.cos(angle - Math.PI/6), 
                              y2 - arrowLength * Math.sin(angle - Math.PI/6));
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - arrowLength * Math.cos(angle + Math.PI/6), 
                              y2 - arrowLength * Math.sin(angle + Math.PI/6));
                    ctx.stroke();
                }
                
                function drawSelection(elem) {
                    ctx.strokeStyle = '#007acc';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 3]);
                    ctx.strokeRect(elem.x - 2, elem.y - 2, elem.width + 4, elem.height + 4);
                    ctx.setLineDash([]);
                }
                
                function getElementAt(x, y) {
                    for (let i = elements.length - 1; i >= 0; i--) {
                        const elem = elements[i];
                        if (x >= elem.x && x <= elem.x + elem.width &&
                            y >= elem.y && y <= elem.y + elem.height) {
                            return elem;
                        }
                    }
                    return null;
                }
                
                function showProperties(elem) {
                    const panel = document.getElementById('propertiesPanel');
                    if (elem) {
                        panel.style.display = 'block';
                        document.getElementById('elemText').value = elem.text || '';
                        document.getElementById('elemColor').value = elem.color || '#e3f2fd';
                        document.getElementById('elemType').value = elem.metadata?.codeType || '';
                        document.getElementById('elemLanguage').value = elem.metadata?.language || 'typescript';
                        
                        // Add event listeners for property changes
                        document.getElementById('elemText').onchange = () => {
                            elem.text = document.getElementById('elemText').value;
                            redraw();
                            updateElements();
                        };
                        
                        document.getElementById('elemColor').onchange = () => {
                            elem.color = document.getElementById('elemColor').value;
                            redraw();
                            updateElements();
                        };
                        
                        document.getElementById('elemType').onchange = () => {
                            if (!elem.metadata) elem.metadata = {};
                            elem.metadata.codeType = document.getElementById('elemType').value;
                            updateElements();
                        };
                        
                        document.getElementById('elemLanguage').onchange = () => {
                            if (!elem.metadata) elem.metadata = {};
                            elem.metadata.language = document.getElementById('elemLanguage').value;
                            updateElements();
                        };
                    } else {
                        panel.style.display = 'none';
                    }
                }
                
                function generateId() {
                    return 'elem_' + Math.random().toString(36).substr(2, 9);
                }
                
                function updateElements() {
                    // Send updated elements to extension
                    vscode.postMessage({
                        command: 'updateElements',
                        elements: elements,
                        connections: connections
                    });
                }
                
                function generateCode() {
                    const config = {
                        targetLanguage: 'typescript',
                        framework: 'none',
                        includeComments: true,
                        includeTests: false,
                        codeStyle: 'object-oriented',
                        outputFormat: 'files'
                    };
                    
                    vscode.postMessage({
                        command: 'generateCode',
                        config: config
                    });
                }
                
                function saveWhiteboard() {
                    const name = prompt('Enter whiteboard name:');
                    if (name) {
                        vscode.postMessage({
                            command: 'saveWhiteboard',
                            name: name
                        });
                    }
                }
                
                function analyzeWhiteboard() {
                    vscode.postMessage({
                        command: 'analyzeDiagram'
                    });
                }
                
                function loadTemplate(templateType) {
                    vscode.postMessage({
                        command: 'templateRequest',
                        templateType: templateType
                    });
                }
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'loadState':
                            elements = message.state.elements || [];
                            connections = message.state.connections || [];
                            redraw();
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    /**
     * Load saved states
     */
    private async loadSavedStates(): Promise<void> {
        try {
            const statesFile = vscode.Uri.joinPath(this.storageUri, 'saved-states.json');
            const data = await vscode.workspace.fs.readFile(statesFile);
            const states = JSON.parse(Buffer.from(data).toString());
            this.savedStates = new Map(Object.entries(states));
        } catch {
            // No saved states or file doesn't exist yet
        }
    }

    /**
     * Persist whiteboard states
     */
    private async persistWhiteboardStates(): Promise<void> {
        try {
            const statesFile = vscode.Uri.joinPath(this.storageUri, 'saved-states.json');
            const states = Object.fromEntries(this.savedStates);
            await vscode.workspace.fs.writeFile(
                statesFile,
                Buffer.from(JSON.stringify(states, null, 2))
            );
        } catch (error) {
            this.outputChannel.appendLine(`Failed to persist states: ${(error as Error).message}`);
        }
    }

    /**
     * Get analytics
     */
    getAnalytics(): any {
        return {
            totalWhiteboards: this.savedStates.size,
            currentWhiteboard: this.currentState ? {
                name: this.currentState.name,
                elementCount: this.currentState.elements.length,
                connectionCount: this.currentState.connections.length,
                diagramType: this.currentState.diagramType
            } : null,
            savedWhiteboards: Array.from(this.savedStates.values()).map(state => ({
                id: state.id,
                name: state.name,
                type: state.diagramType,
                lastModified: state.metadata.lastModified
            }))
        };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.whiteboardPanel) {
            this.whiteboardPanel.dispose();
        }
        this.outputChannel.dispose();
    }
}

// Export singleton instance
let whiteboardInstance: InteractiveWhiteboard | undefined;

export function getInteractiveWhiteboard(context: vscode.ExtensionContext): InteractiveWhiteboard {
    if (!whiteboardInstance) {
        whiteboardInstance = new InteractiveWhiteboard(context);
    }
    return whiteboardInstance;
}