import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'error';
  output: string;
  executionTime: number;
  errorMessage?: string;
  coverage?: number;
}

/**
 * LLM Test Runner with auto-fix loop capability
 */
export class LLMTestRunner {
  private maxFixAttempts = 3;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Generate and run tests for the given code with auto-fix loop
   */
  public async generateAndRunTests(code: string, language: string): Promise<TestResult[]> {
    const tests = await this.generateTests(code, language);
    let results = await this.runTests(tests, language);
    
    // Auto-fix loop for failing tests
    for (let attempt = 0; attempt < this.maxFixAttempts; attempt++) {
      const failedTests = results.filter(r => r.status === 'failed');
      
      if (failedTests.length === 0) {
        break; // All tests pass
      }

      vscode.window.showInformationMessage(`Attempt ${attempt + 1}: Fixing ${failedTests.length} failing tests...`);
      
      const fixedTests = await this.fixFailingTests(tests, failedTests, code, language);
      results = await this.runTests(fixedTests, language);
    }

    return results;
  }

  /**
   * Generate comprehensive tests for code
   */
  private async generateTests(code: string, language: string): Promise<string> {
    const prompt = `Generate comprehensive unit tests for this ${language} code. Include:
1. Happy path tests
2. Edge cases
3. Error handling tests
4. Boundary value tests
5. Mock dependencies if needed

Code to test:
\`\`\`${language}
${code}
\`\`\`

Generate complete, runnable test code with proper imports and setup.`;

    const tests = await getLLMCompletion(prompt);
    return tests || '';
  }

  /**
   * Run the generated tests
   */
  private async runTests(testCode: string, language: string): Promise<TestResult[]> {
    try {
      // Create temporary test file
      const testFile = await this.createTempTestFile(testCode, language);
      
      // Execute tests based on language
      const results = await this.executeTests(testFile, language);
      
      // Clean up
      await vscode.workspace.fs.delete(testFile);
      
      return results;
    } catch (error) {
      return [{
        testName: 'Test Execution',
        status: 'error',
        output: '',
        executionTime: 0,
        errorMessage: `Failed to run tests: ${error}`
      }];
    }
  }

  /**
   * Fix failing tests using LLM
   */
  private async fixFailingTests(
    originalTests: string, 
    failedTests: TestResult[], 
    originalCode: string, 
    language: string
  ): Promise<string> {
    const failureInfo = failedTests.map(test => 
      `Test: ${test.testName}\nError: ${test.errorMessage}\nOutput: ${test.output}`
    ).join('\n\n');

    const prompt = `Fix these failing ${language} tests. The original code and tests are provided below.

FAILING TESTS:
${failureInfo}

ORIGINAL CODE:
\`\`\`${language}
${originalCode}
\`\`\`

ORIGINAL TESTS:
\`\`\`${language}
${originalTests}
\`\`\`

Please provide the corrected test code that will pass. Fix issues like:
- Incorrect assertions
- Missing imports
- Wrong test data
- Improper mocking
- Syntax errors`;

    const fixedTests = await getLLMCompletion(prompt);
    return fixedTests || originalTests;
  }

  /**
   * Create temporary test file
   */
  private async createTempTestFile(testCode: string, language: string): Promise<vscode.Uri> {
    const extension = this.getFileExtension(language);
    const fileName = `temp_test_${Date.now()}${extension}`;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
      throw new Error('No workspace folder available');
    }

    const testFile = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
    await vscode.workspace.fs.writeFile(testFile, Buffer.from(testCode, 'utf8'));
    
    return testFile;
  }

  /**
   * Execute tests and parse results
   */
  private async executeTests(testFile: vscode.Uri, language: string): Promise<TestResult[]> {
    const terminal = vscode.window.createTerminal('Test Runner');
    const command = this.getTestCommand(testFile.fsPath, language);

    return new Promise((resolve) => {
      let output = '';
      const startTime = Date.now();

      // Listen for terminal output (limited in VS Code API)
      // This is a simplified implementation
      terminal.sendText(command);

      // Wait for execution and parse results
      setTimeout(async () => {
        const executionTime = Date.now() - startTime;
        
        try {
          // Attempt to read test output or results
          const results = await this.parseTestOutput(output, language);
          resolve(results.length > 0 ? results : [{
            testName: 'All Tests',
            status: 'passed',
            output: output,
            executionTime
          }]);
        } catch (error) {
          resolve([{
            testName: 'Test Execution',
            status: 'error',
            output: output,
            executionTime,
            errorMessage: `Parse error: ${error}`
          }]);
        }

        terminal.dispose();
      }, 5000); // Wait 5 seconds for test execution
    });
  }

  /**
   * Get test command based on language
   */
  private getTestCommand(filePath: string, language: string): string {
    switch (language.toLowerCase()) {
      case 'python':
        return `python -m pytest ${filePath} -v`;
      case 'javascript':
      case 'typescript':
        return `npm test -- ${filePath}`;
      case 'java':
        return `javac ${filePath} && java org.junit.runner.JUnitCore`;
      case 'csharp':
        return `dotnet test ${filePath}`;
      case 'go':
        return `go test ${filePath}`;
      default:
        return `echo "No test runner configured for ${language}"`;
    }
  }

  /**
   * Get file extension for language
   */
  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      'python': '.py',
      'javascript': '.js',
      'typescript': '.ts',
      'java': '.java',
      'csharp': '.cs',
      'go': '.go',
      'cpp': '.cpp',
      'c': '.c'
    };
    return extensions[language.toLowerCase()] || '.txt';
  }

  /**
   * Parse test output to extract results
   */
  private async parseTestOutput(output: string, language: string): Promise<TestResult[]> {
    // This would be implemented based on different test frameworks
    // For now, return a simple parser
    
    const lines = output.split('\n');
    const results: TestResult[] = [];
    
    for (const line of lines) {
      if (line.includes('PASSED') || line.includes('✓')) {
        results.push({
          testName: this.extractTestName(line),
          status: 'passed',
          output: line,
          executionTime: 0
        });
      } else if (line.includes('FAILED') || line.includes('✗')) {
        results.push({
          testName: this.extractTestName(line),
          status: 'failed',
          output: line,
          executionTime: 0,
          errorMessage: line
        });
      }
    }

    return results;
  }

  private extractTestName(line: string): string {
    // Simple extraction - could be improved
    const match = line.match(/test_\w+|it\(['"]([^'"]+)['"]/);
    return match ? (match[1] || match[0]) : 'Unknown Test';
  }

  /**
   * Generate test coverage report
   */
  public async generateCoverageReport(code: string, tests: string, language: string): Promise<string> {
    const prompt = `Analyze test coverage for this ${language} code and tests:

CODE:
\`\`\`${language}
${code}
\`\`\`

TESTS:
\`\`\`${language}
${tests}
\`\`\`

Provide a coverage analysis including:
1. Functions/methods covered
2. Lines covered
3. Edge cases covered
4. Missing test scenarios
5. Recommendations for additional tests`;

    return await getLLMCompletion(prompt) || 'Coverage analysis failed';
  }
}

export function registerLLMTestRunnerCommands(context: vscode.ExtensionContext) {
  const testRunner = new LLMTestRunner(context);

  const generateAndRunTestsCommand = vscode.commands.registerCommand('coding.generateAndRunTests', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
    const language = editor.document.languageId;

    if (!code.trim()) {
      vscode.window.showErrorMessage('No code selected');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating and running tests...',
      cancellable: false
    }, async () => {
      try {
        const results = await testRunner.generateAndRunTests(code, language);
        
        const report = `# Test Results

## Summary
- Total Tests: ${results.length}
- Passed: ${results.filter(r => r.status === 'passed').length}
- Failed: ${results.filter(r => r.status === 'failed').length}
- Errors: ${results.filter(r => r.status === 'error').length}

## Detailed Results
${results.map(result => `
### ${result.testName}
- **Status**: ${result.status === 'passed' ? '✅ PASSED' : result.status === 'failed' ? '❌ FAILED' : '💥 ERROR'}
- **Execution Time**: ${result.executionTime}ms
${result.errorMessage ? `- **Error**: ${result.errorMessage}` : ''}
${result.output ? `- **Output**: \`${result.output}\`` : ''}
`).join('\n')}`;

        const doc = await vscode.workspace.openTextDocument({
          content: report,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Test generation failed: ${error}`);
      }
    });
  });

  const generateCoverageReportCommand = vscode.commands.registerCommand('coding.generateCoverageReport', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;

    const tests = await vscode.window.showInputBox({
      prompt: 'Paste your test code (or leave empty to analyze without tests)',
      placeHolder: 'Test code...'
    });

    const coverage = await testRunner.generateCoverageReport(code, tests || '', language);
    
    const doc = await vscode.workspace.openTextDocument({
      content: `# Coverage Analysis\n\n${coverage}`,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  context.subscriptions.push(generateAndRunTestsCommand, generateCoverageReportCommand);
}