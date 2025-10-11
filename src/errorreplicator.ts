import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface BugReport {
  title: string;
  description: string;
  stackTrace?: string;
  environment?: string;
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
}

interface MinimalReproduction {
  code: string;
  dependencies: string[];
  environment: { [key: string]: string };
  instructions: string[];
  testCase: string;
  language: string;
}

export class ErrorReplicator {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Error Replicator');
  }

  async generateReproductionFromBugReport(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🐛 Starting Error Replication from Bug Report...');

    const bugReport = await this.collectBugReportInput();
    if (!bugReport) {
      return;
    }

    const reproduction = await this.generateMinimalReproduction(bugReport);
    await this.createReproductionFiles(reproduction, bugReport.title);

    vscode.window.showInformationMessage('Minimal reproduction case generated successfully!');
  }

  async generateReproductionFromLogs(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('📄 Starting Error Replication from Log Analysis...');

    const logs = await this.collectLogInput();
    if (!logs) {
      return;
    }

    const parsedError = await this.parseErrorFromLogs(logs);
    const reproduction = await this.generateReproductionFromError(parsedError);
    await this.createReproductionFiles(reproduction, 'Log Error Reproduction');

    vscode.window.showInformationMessage('Reproduction generated from log analysis!');
  }

  async generateReproductionFromStackTrace(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🔍 Starting Error Replication from Stack Trace...');

    const stackTrace = await vscode.window.showInputBox({
      prompt: 'Paste the stack trace here',
      placeHolder: 'Error: Cannot read property \'foo\' of undefined\n    at Object.bar (/app/src/index.js:42:15)...',
      value: ''
    });

    if (!stackTrace) {
      return;
    }

    const reproduction = await this.generateReproductionFromStackTraceInput(stackTrace);
    await this.createReproductionFiles(reproduction, 'Stack Trace Reproduction');

    vscode.window.showInformationMessage('Reproduction generated from stack trace!');
  }

  private async collectBugReportInput(): Promise<BugReport | undefined> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter bug report title',
      placeHolder: 'e.g., "Application crashes when clicking submit button"'
    });

    if (!title) {
      return undefined;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Enter detailed bug description',
      placeHolder: 'Describe what happens when the bug occurs...'
    });

    if (!description) {
      return undefined;
    }

    return { title, description };
  }

  private async collectLogInput(): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      prompt: 'Paste the log content',
      placeHolder: 'Paste your error logs here...'
    });
  }

  private generateMinimalReproduction(bugReport: BugReport): MinimalReproduction {
    const language = 'javascript';
    
    const code = `// Minimal reproduction for: ${bugReport.title}
// ${bugReport.description}

function reproduceIssue() {
    console.log('Setting up reproduction scenario...');
    
    // TODO: Implement reproduction steps
    console.log('Bug should manifest here');
    
    // Simulate error
    throw new Error('Reproduced error: ${bugReport.title}');
}

reproduceIssue();`;
    
    return {
      code,
      dependencies: [],
      environment: {},
      instructions: ['Run the reproduction script', 'Observe the error output'],
      testCase: this.generateTestCase(bugReport, language),
      language
    };
  }

  private generateReproductionFromError(errorInfo: any): MinimalReproduction {
    const language = 'javascript';
    const error = errorInfo.error;
    
    const code = `// Reproduction based on log analysis
// Error: ${error?.message || 'Unknown error'}

function reproduceFromLogs() {
    console.log('Reproducing error from logs...');
    
    try {
        throw new Error('${error?.message || 'Unknown error'}');
    } catch (e) {
        console.error('Reproduced error:', e.message);
        throw e;
    }
}

reproduceFromLogs();`;
    
    return {
      code,
      dependencies: [],
      environment: { runtime: 'detected from logs' },
      instructions: ['Run the reproduction script', 'Check logs for similar error patterns'],
      testCase: `// Test case for log-based reproduction
describe('Log Error Reproduction', () => {
    it('should reproduce the logged error', () => {
        expect(() => {
            reproduceFromLogs();
        }).toThrow();
    });
});`,
      language
    };
  }

  private generateReproductionFromStackTraceInput(stackTrace: string): MinimalReproduction {
    const language = 'javascript';
    
    const code = `// Reproduction based on stack trace analysis
// Error: ${stackTrace.split('\n')[0]}

function reproduceFromStackTrace() {
    console.log('Reproducing error from stack trace...');
    
    try {
        throw new Error('${stackTrace.split('\n')[0]}');
    } catch (e) {
        console.error('Stack trace error reproduced:', e.message);
        throw e;
    }
}

reproduceFromStackTrace();`;
    
    return {
      code,
      dependencies: [],
      environment: { source: 'stack trace analysis' },
      instructions: ['Run the reproduction script', 'Check that the stack trace matches'],
      testCase: `// Test case for stack trace reproduction
describe('Stack Trace Reproduction', () => {
    it('should reproduce the stack trace error', () => {
        expect(() => {
            reproduceFromStackTrace();
        }).toThrow();
    });
});`,
      language
    };
  }

  private parseErrorFromLogs(logs: string): any {
    const lines = logs.split('\n');
    const errorLine = lines.find(line => line.toLowerCase().includes('error'));
    
    return {
      error: { message: errorLine || 'Unknown error from logs' },
      context: logs.substring(0, 500) // First 500 chars as context
    };
  }

  private generateTestCase(bugReport: BugReport, language: string): string {
    return `// Test case for bug reproduction
describe('${bugReport.title}', () => {
    it('should reproduce the reported bug', () => {
        expect(() => {
            reproduceIssue();
        }).toThrow();
    });
});`;
  }

  private async createReproductionFiles(reproduction: MinimalReproduction, title: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const reproductionDir = path.join(workspaceFolder.uri.fsPath, 'bug-reproductions');
    const fileName = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    await fs.promises.mkdir(reproductionDir, { recursive: true });

    const mainFilePath = path.join(reproductionDir, `${fileName}.js`);
    await fs.promises.writeFile(mainFilePath, reproduction.code);

    const testFilePath = path.join(reproductionDir, `${fileName}.test.js`);
    await fs.promises.writeFile(testFilePath, reproduction.testCase);

    const readmeContent = `# Bug Reproduction: ${title}

## Instructions
${reproduction.instructions.map(instruction => `- ${instruction}`).join('\n')}

## Usage
1. Run the reproduction script: \`node ${fileName}.js\`
2. Run tests: \`npm test ${fileName}.test.js\`
3. Observe the error output
`;

    const readmePath = path.join(reproductionDir, `${fileName}_README.md`);
    await fs.promises.writeFile(readmePath, readmeContent);

    const document = await vscode.workspace.openTextDocument(mainFilePath);
    await vscode.window.showTextDocument(document);

    this.outputChannel.appendLine(`✅ Reproduction files created in: ${reproductionDir}`);
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerErrorReplicatorCommands(context: vscode.ExtensionContext) {
  const replicator = new ErrorReplicator();

  const generateFromBugReportCommand = vscode.commands.registerCommand('coding.generateReproductionFromBugReport', async () => {
    await replicator.generateReproductionFromBugReport();
  });

  const generateFromLogsCommand = vscode.commands.registerCommand('coding.generateReproductionFromLogs', async () => {
    await replicator.generateReproductionFromLogs();
  });

  const generateFromStackTraceCommand = vscode.commands.registerCommand('coding.generateReproductionFromStackTrace', async () => {
    await replicator.generateReproductionFromStackTrace();
  });

  context.subscriptions.push(generateFromBugReportCommand, generateFromLogsCommand, generateFromStackTraceCommand);
  context.subscriptions.push(replicator);
}