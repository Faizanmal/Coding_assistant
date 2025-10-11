import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

/**
 * Architecture and Dependency Visualizer
 * Generates Mermaid/PlantUML diagrams for module dependencies, call graphs, and class hierarchies
 */
export class ArchitectureVisualizer {

  /**
   * Generate project architecture diagram
   */
  public static async generateArchitectureDiagram(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const diagramType = await vscode.window.showQuickPick([
      { label: 'Module Dependencies', description: 'Show how modules depend on each other' },
      { label: 'Class Hierarchy', description: 'Show class inheritance and relationships' },
      { label: 'Call Graph', description: 'Show function/method call relationships' },
      { label: 'Component Architecture', description: 'High-level component structure' }
    ], { placeHolder: 'Select diagram type' });

    if (!diagramType) {
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Generating ${diagramType.label} diagram...`,
      cancellable: false
    }, async () => {
      try {
        const projectStructure = await this.analyzeProjectStructure();
        const diagram = await this.generateDiagram(diagramType.label, projectStructure);
        await this.displayDiagram(diagram, diagramType.label);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate diagram: ${error}`);
      }
    });
  }

  /**
   * Analyze project structure for diagram generation
   */
  private static async analyzeProjectStructure(): Promise<any> {
    const workspaceFolder = vscode.workspace.workspaceFolders![0];
    const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java,cpp,cs,go}', '**/node_modules/**');
    
    const structure = {
      files: [] as string[],
      modules: new Set<string>(),
      classes: new Set<string>(),
      functions: new Set<string>(),
      imports: [] as Array<{file: string, import: string}>,
      exports: [] as Array<{file: string, export: string}>
    };

    for (const file of files.slice(0, 50)) { // Limit for performance
      try {
        const content = (await vscode.workspace.fs.readFile(file)).toString();
        const relativePath = vscode.workspace.asRelativePath(file);
        
        structure.files.push(relativePath);
        
        // Parse imports/exports
        const imports = this.extractImports(content);
        const exports = this.extractExports(content);
        const classes = this.extractClasses(content);
        const functions = this.extractFunctions(content);
        
        structure.imports.push(...imports.map(imp => ({ file: relativePath, import: imp })));
        structure.exports.push(...exports.map(exp => ({ file: relativePath, export: exp })));
        
        classes.forEach(cls => structure.classes.add(cls));
        functions.forEach(func => structure.functions.add(func));
        
      } catch (error) {
        console.error(`Error analyzing ${file.fsPath}:`, error);
      }
    }

    return {
      ...structure,
      modules: Array.from(structure.modules),
      classes: Array.from(structure.classes),
      functions: Array.from(structure.functions)
    };
  }

  /**
   * Generate diagram using LLM
   */
  private static async generateDiagram(type: string, structure: any): Promise<string> {
    const prompt = `Generate a ${type} diagram in Mermaid syntax for this project structure:

Files: ${structure.files.slice(0, 20).join(', ')}
Classes: ${structure.classes.slice(0, 15).join(', ')}
Functions: ${structure.functions.slice(0, 20).join(', ')}

Import relationships:
${structure.imports.slice(0, 30).map((imp: any) => `${imp.file} imports ${imp.import}`).join('\n')}

Generate a clear, well-organized Mermaid diagram that shows the ${type.toLowerCase()}. Use appropriate Mermaid syntax (graph TD, classDiagram, etc.).

Return ONLY the Mermaid code, no explanations.`;

    const response = await getLLMCompletion(prompt);
    return response || 'graph TD\n    A[No diagram generated]';
  }

  /**
   * Display the generated diagram
   */
  private static async displayDiagram(diagram: string, title: string): Promise<void> {
    const content = `# ${title}

\`\`\`mermaid
${diagram}
\`\`\`

## How to View
1. Install the "Markdown Preview Mermaid Support" extension
2. Or copy the Mermaid code to https://mermaid.live
3. Or use any Mermaid-compatible viewer

## Diagram Code
\`\`\`
${diagram}
\`\`\`
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  // Helper methods for parsing code structure
  private static extractImports(content: string): string[] {
    const imports = [];
    const importRegex = /(?:import|from)\s+['""]([^'"]+)['""]|require\s*\(\s*['""]([^'"]+)['"]\s*\)/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }
    
    return imports;
  }

  private static extractExports(content: string): string[] {
    const exports = [];
    const exportRegex = /export\s+(?:class|function|const|let|var)\s+(\w+)|module\.exports\s*=\s*(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1] || match[2]);
    }
    
    return exports;
  }

  private static extractClasses(content: string): string[] {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private static extractFunctions(content: string): string[] {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*\(.*?\)\s*(?:=>|{)|def\s+(\w+))/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2] || match[3]);
    }
    
    return functions;
  }
}

export function registerArchitectureVisualizerCommands(context: vscode.ExtensionContext) {
  const generateArchitectureCommand = vscode.commands.registerCommand('coding.generateArchitectureDiagram', async () => {
    await ArchitectureVisualizer.generateArchitectureDiagram();
  });

  const generateCallGraphCommand = vscode.commands.registerCommand('coding.generateCallGraph', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;

    const prompt = `Generate a call graph in Mermaid format for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Show function calls as arrows between functions. Use Mermaid flowchart syntax.`;

    try {
      const diagram = await getLLMCompletion(prompt);
      const content = `# Call Graph

\`\`\`mermaid
${diagram}
\`\`\`
`;

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate call graph: ${error}`);
    }
  });

  const generateClassDiagramCommand = vscode.commands.registerCommand('coding.generateClassDiagram', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;

    const prompt = `Generate a UML class diagram in Mermaid format for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include class relationships, inheritance, composition, and aggregation. Use proper Mermaid classDiagram syntax.`;

    try {
      const diagram = await getLLMCompletion(prompt);
      const content = `# Class Diagram

\`\`\`mermaid
${diagram}
\`\`\`
`;

      const doc = await vscode.workspace.openTextDocument({
        content,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate class diagram: ${error}`);
    }
  });

  context.subscriptions.push(
    generateArchitectureCommand,
    generateCallGraphCommand,
    generateClassDiagramCommand
  );
}