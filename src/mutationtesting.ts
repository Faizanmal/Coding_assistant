import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MutationResult {
  original: string;
  mutated: string;
  lineNumber: number;
  type: MutationType;
  killed: boolean;
  testOutput: string;
}

enum MutationType {
  ARITHMETIC = 'arithmetic',
  RELATIONAL = 'relational',
  LOGICAL = 'logical',
  ASSIGNMENT = 'assignment',
  UNARY = 'unary'
}

export class MutationTestingHelper {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Mutation Testing Helper');
  }

  /**
   * Performs mutation testing on a selected code file
   */
  async performMutationTesting(filePath: string): Promise<MutationResult[]> {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    const mutations = this.generateMutations(fileContent);
    const results: MutationResult[] = [];

    this.outputChannel.show();
    this.outputChannel.appendLine(`🧬 Starting mutation testing on: ${path.basename(filePath)}`);
    this.outputChannel.appendLine(`📊 Generated ${mutations.length} mutations`);

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      this.outputChannel.appendLine(`\n🔬 Testing mutation ${i + 1}/${mutations.length}: ${mutation.type}`);
      
      // Create temporary mutated file
      const tempFilePath = await this.createMutatedFile(filePath, mutation);
      
      try {
        // Run tests against mutated code
        const testResult = await this.runTests(tempFilePath);
        const killed = testResult.exitCode !== 0;
        
        results.push({
          original: mutation.original,
          mutated: mutation.mutated,
          lineNumber: mutation.lineNumber,
          type: mutation.type,
          killed,
          testOutput: testResult.stdout + testResult.stderr
        });

        this.outputChannel.appendLine(`${killed ? '✅ Killed' : '❌ Survived'}: Line ${mutation.lineNumber}`);
        
      } catch (error) {
        this.outputChannel.appendLine(`⚠️  Error testing mutation: ${error}`);
      } finally {
        // Clean up temporary file
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }

    await this.showMutationReport(results);
    return results;
  }

  /**
   * Generates mutations for the given code
   */
  private generateMutations(code: string): Array<{original: string, mutated: string, lineNumber: number, type: MutationType}> {
    const lines = code.split('\n');
    const mutations: Array<{original: string, mutated: string, lineNumber: number, type: MutationType}> = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Arithmetic operator mutations
      const arithmeticMutations = this.mutateArithmeticOperators(line);
      arithmeticMutations.forEach(mutation => {
        mutations.push({
          original: line,
          mutated: mutation,
          lineNumber,
          type: MutationType.ARITHMETIC
        });
      });

      // Relational operator mutations
      const relationalMutations = this.mutateRelationalOperators(line);
      relationalMutations.forEach(mutation => {
        mutations.push({
          original: line,
          mutated: mutation,
          lineNumber,
          type: MutationType.RELATIONAL
        });
      });

      // Logical operator mutations
      const logicalMutations = this.mutateLogicalOperators(line);
      logicalMutations.forEach(mutation => {
        mutations.push({
          original: line,
          mutated: mutation,
          lineNumber,
          type: MutationType.LOGICAL
        });
      });

      // Assignment operator mutations
      const assignmentMutations = this.mutateAssignmentOperators(line);
      assignmentMutations.forEach(mutation => {
        mutations.push({
          original: line,
          mutated: mutation,
          lineNumber,
          type: MutationType.ASSIGNMENT
        });
      });

      // Unary operator mutations
      const unaryMutations = this.mutateUnaryOperators(line);
      unaryMutations.forEach(mutation => {
        mutations.push({
          original: line,
          mutated: mutation,
          lineNumber,
          type: MutationType.UNARY
        });
      });
    });

    return mutations;
  }

  private mutateArithmeticOperators(line: string): string[] {
    const mutations: string[] = [];
    const operators = [
      { from: '+', to: ['-', '*', '/', '%'] },
      { from: '-', to: ['+', '*', '/', '%'] },
      { from: '*', to: ['+', '-', '/', '%'] },
      { from: '/', to: ['+', '-', '*', '%'] },
      { from: '%', to: ['+', '-', '*', '/'] }
    ];

    operators.forEach(op => {
      if (line.includes(op.from)) {
        op.to.forEach(replacement => {
          mutations.push(line.replace(op.from, replacement));
        });
      }
    });

    return mutations;
  }

  private mutateRelationalOperators(line: string): string[] {
    const mutations: string[] = [];
    const operators = [
      { from: '==', to: ['!=', '>', '<', '>=', '<='] },
      { from: '!=', to: ['==', '>', '<', '>=', '<='] },
      { from: '>', to: ['<', '>=', '<=', '==', '!='] },
      { from: '<', to: ['>', '>=', '<=', '==', '!='] },
      { from: '>=', to: ['<', '>', '<=', '==', '!='] },
      { from: '<=', to: ['<', '>', '>=', '==', '!='] }
    ];

    operators.forEach(op => {
      if (line.includes(op.from)) {
        op.to.forEach(replacement => {
          mutations.push(line.replace(op.from, replacement));
        });
      }
    });

    return mutations;
  }

  private mutateLogicalOperators(line: string): string[] {
    const mutations: string[] = [];
    const operators = [
      { from: '&&', to: ['||'] },
      { from: '||', to: ['&&'] }
    ];

    operators.forEach(op => {
      if (line.includes(op.from)) {
        op.to.forEach(replacement => {
          mutations.push(line.replace(op.from, replacement));
        });
      }
    });

    return mutations;
  }

  private mutateAssignmentOperators(line: string): string[] {
    const mutations: string[] = [];
    const operators = [
      { from: '+=', to: ['-=', '*=', '/='] },
      { from: '-=', to: ['+=', '*=', '/='] },
      { from: '*=', to: ['+=', '-=', '/='] },
      { from: '/=', to: ['+=', '-=', '*='] }
    ];

    operators.forEach(op => {
      if (line.includes(op.from)) {
        op.to.forEach(replacement => {
          mutations.push(line.replace(op.from, replacement));
        });
      }
    });

    return mutations;
  }

  private mutateUnaryOperators(line: string): string[] {
    const mutations: string[] = [];
    
    // Remove increment/decrement operators
    if (line.includes('++')) {
      mutations.push(line.replace('++', ''));
    }
    if (line.includes('--')) {
      mutations.push(line.replace('--', ''));
    }
    
    // Negate boolean expressions
    if (line.includes('!')) {
      mutations.push(line.replace('!', ''));
    } else if (line.match(/\s*if\s*\(/)) {
      mutations.push(line.replace(/if\s*\(/, 'if (!'));
    }

    return mutations;
  }

  private async createMutatedFile(originalPath: string, mutation: any): Promise<string> {
    const fileContent = await fs.promises.readFile(originalPath, 'utf8');
    const lines = fileContent.split('\n');
    lines[mutation.lineNumber - 1] = mutation.mutated;
    const mutatedContent = lines.join('\n');
    
    const tempPath = originalPath.replace(/(\.[^.]+)$/, '.mutated$1');
    await fs.promises.writeFile(tempPath, mutatedContent);
    
    return tempPath;
  }

  private async runTests(filePath: string): Promise<{exitCode: number, stdout: string, stderr: string}> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    try {
      // Try different test runners based on project type
      let command = '';
      const packageJsonPath = path.join(workspaceFolder, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        
        if (packageJson.scripts?.test) {
          command = 'npm test';
        } else if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
          command = 'npx jest';
        } else if (packageJson.devDependencies?.mocha || packageJson.dependencies?.mocha) {
          command = 'npx mocha';
        } else if (packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest) {
          command = 'npx vitest run';
        }
      }

      if (!command) {
        // Fallback commands based on file extension
        const ext = path.extname(filePath);
        switch (ext) {
          case '.py':
            command = 'python -m pytest';
            break;
          case '.java':
            command = 'mvn test';
            break;
          case '.cs':
            command = 'dotnet test';
            break;
          default:
            command = 'npm test';
        }
      }

      const result = await execAsync(command, { cwd: workspaceFolder });
      return {
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error: any) {
      return {
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message
      };
    }
  }

  private async showMutationReport(results: MutationResult[]): Promise<void> {
    const killed = results.filter(r => r.killed).length;
    const survived = results.filter(r => !r.killed).length;
    const mutationScore = killed / results.length * 100;

    const reportContent = `
# Mutation Testing Report

## Summary
- **Total Mutations**: ${results.length}
- **Killed**: ${killed}
- **Survived**: ${survived}
- **Mutation Score**: ${mutationScore.toFixed(2)}%

## Quality Assessment
${mutationScore >= 80 ? '🎯 **Excellent** - Your tests are very robust!' : 
  mutationScore >= 60 ? '✅ **Good** - Your tests catch most issues.' : 
  mutationScore >= 40 ? '⚠️  **Moderate** - Consider adding more test cases.' : 
  '❌ **Poor** - Your tests need significant improvement.'}

## Survived Mutations (Need Attention)
${results.filter(r => !r.killed).map(r => `
### Line ${r.lineNumber}: ${r.type}
**Original**: \`${r.original.trim()}\`  
**Mutated**: \`${r.mutated.trim()}\`  
**Recommendation**: Add test case to verify this logic path.
`).join('\n')}

## Killed Mutations (Good Coverage)
${results.filter(r => r.killed).slice(0, 5).map(r => `
- Line ${r.lineNumber}: ${r.type} mutation detected ✅
`).join('\n')}
${results.filter(r => r.killed).length > 5 ? `... and ${results.filter(r => r.killed).length - 5} more` : ''}
    `;

    const doc = await vscode.workspace.openTextDocument({
      content: reportContent,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerMutationTestingCommands(context: vscode.ExtensionContext) {
  const mutationTester = new MutationTestingHelper();

  const testFileCommand = vscode.commands.registerCommand('coding.mutationTestFile', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active file to test');
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;
    const supportedExtensions = ['.js', '.ts', '.py', '.java', '.cs', '.cpp', '.c'];
    const fileExt = path.extname(filePath);

    if (!supportedExtensions.includes(fileExt)) {
      vscode.window.showWarningMessage(`Mutation testing not supported for ${fileExt} files yet`);
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Running Mutation Tests',
      cancellable: true
    }, async (progress, token) => {
      try {
        progress.report({ increment: 0, message: 'Analyzing code...' });
        const results = await mutationTester.performMutationTesting(filePath);
        progress.report({ increment: 100, message: 'Complete!' });
        
        vscode.window.showInformationMessage(
          `Mutation testing complete! Score: ${(results.filter(r => r.killed).length / results.length * 100).toFixed(1)}%`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Mutation testing failed: ${error}`);
      }
    });
  });

  const testWorkspaceCommand = vscode.commands.registerCommand('coding.mutationTestWorkspace', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cs}', '**/node_modules/**');
    const selectedFile = await vscode.window.showQuickPick(
      files.map(file => ({
        label: path.basename(file.fsPath),
        description: vscode.workspace.asRelativePath(file),
        uri: file
      })),
      { placeHolder: 'Select a file for mutation testing' }
    );

    if (selectedFile) {
      vscode.commands.executeCommand('vscode.open', selectedFile.uri);
      setTimeout(() => {
        vscode.commands.executeCommand('coding.mutationTestFile');
      }, 500);
    }
  });

  context.subscriptions.push(testFileCommand, testWorkspaceCommand);
  context.subscriptions.push(mutationTester);
}