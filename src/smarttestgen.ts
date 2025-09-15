import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface TestSuite {
    fileName: string;
    tests: TestCase[];
    coverage: CoverageInfo;
}

interface TestCase {
    name: string;
    code: string;
    type: 'unit' | 'integration' | 'edge';
}

interface CoverageInfo {
    functions: string[];
    branches: number;
    statements: number;
    uncoveredLines: number[];
}

export class SmartTestGenerator {
    private static instance: SmartTestGenerator;
    
    static getInstance(): SmartTestGenerator {
        if (!SmartTestGenerator.instance) {
            SmartTestGenerator.instance = new SmartTestGenerator();
        }
        return SmartTestGenerator.instance;
    }

    async analyzeCodeForTesting(code: string, language: string): Promise<TestSuite> {
        const functions = this.extractFunctions(code, language);
        const complexity = this.calculateComplexity(code);
        
        const prompt = `Analyze this ${language} code and generate comprehensive test cases:

${code}

Generate tests for:
1. All public functions/methods
2. Edge cases and error conditions
3. Integration scenarios
4. Performance critical paths

Return JSON format:
{
    "tests": [
        {
            "name": "test_function_name",
            "code": "test implementation",
            "type": "unit|integration|edge"
        }
    ],
    "coverage": {
        "functions": ["function1", "function2"],
        "branches": 5,
        "statements": 20,
        "uncoveredLines": [10, 15]
    }
}`;

        const response = await callAI(prompt);
        return this.parseTestResponse(response, functions);
    }

    private extractFunctions(code: string, language: string): string[] {
        const functions: string[] = [];
        const patterns = {
            typescript: /(?:function\s+|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|class\s+\w+|interface\s+\w+)/g,
            python: /(?:def\s+\w+|class\s+\w+)/g,
            javascript: /(?:function\s+|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)|class\s+\w+)/g,
            java: /(?:public|private|protected)?\s*(?:static\s+)?(?:void|int|String|boolean|\w+)\s+\w+\s*\(/g
        };

        const pattern = patterns[language as keyof typeof patterns];
        if (pattern) {
            const matches = code.match(pattern);
            if (matches) {
                functions.push(...matches.map(m => m.trim()));
            }
        }
        return functions;
    }

    private calculateComplexity(code: string): number {
        const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch'];
        return complexityKeywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = code.match(regex);
            return count + (matches ? matches.length : 0);
        }, 1);
    }

    private parseTestResponse(response: string, functions: string[]): TestSuite {
        try {
            const cleaned = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);
            
            return {
                fileName: 'generated_tests',
                tests: parsed.tests || [],
                coverage: parsed.coverage || {
                    functions,
                    branches: 0,
                    statements: 0,
                    uncoveredLines: []
                }
            };
        } catch (error) {
            return {
                fileName: 'generated_tests',
                tests: [{
                    name: 'basic_test',
                    code: '// Generated test placeholder',
                    type: 'unit'
                }],
                coverage: {
                    functions,
                    branches: 0,
                    statements: 0,
                    uncoveredLines: []
                }
            };
        }
    }

    async generateTestFile(testSuite: TestSuite, language: string): Promise<string> {
        const templates = {
            typescript: this.generateTypeScriptTest(testSuite),
            javascript: this.generateJavaScriptTest(testSuite),
            python: this.generatePythonTest(testSuite),
            java: this.generateJavaTest(testSuite)
        };

        return templates[language as keyof typeof templates] || templates.typescript;
    }

    private generateTypeScriptTest(testSuite: TestSuite): string {
        return `import { describe, it, expect } from '@jest/globals';

describe('${testSuite.fileName}', () => {
${testSuite.tests.map(test => `
    it('${test.name}', () => {
        ${test.code}
    });`).join('\n')}
});

// Coverage: ${testSuite.coverage.functions.length} functions
// Complexity: ${testSuite.coverage.branches} branches, ${testSuite.coverage.statements} statements
`;
    }

    private generatePythonTest(testSuite: TestSuite): string {
        return `import unittest
from unittest.mock import Mock, patch

class Test${testSuite.fileName.charAt(0).toUpperCase() + testSuite.fileName.slice(1)}(unittest.TestCase):
${testSuite.tests.map(test => `
    def ${test.name}(self):
        """${test.type} test"""
        ${test.code.replace(/\n/g, '\n        ')}`).join('\n')}

if __name__ == '__main__':
    unittest.main()
`;
    }

    private generateJavaScriptTest(testSuite: TestSuite): string {
        return this.generateTypeScriptTest(testSuite).replace('import { describe, it, expect } from \'@jest/globals\';', 'const { describe, it, expect } = require(\'@jest/globals\');');
    }

    private generateJavaTest(testSuite: TestSuite): string {
        return `import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

class ${testSuite.fileName.charAt(0).toUpperCase() + testSuite.fileName.slice(1)}Test {
${testSuite.tests.map(test => `
    @Test
    void ${test.name}() {
        ${test.code}
    }`).join('\n')}
}
`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const generator = SmartTestGenerator.getInstance();

    // Generate tests for current file
    const generateTests = vscode.commands.registerCommand('coding.generateTests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const code = editor.document.getText();
        const language = editor.document.languageId;
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating smart tests...",
            cancellable: false
        }, async () => {
            const testSuite = await generator.analyzeCodeForTesting(code, language);
            const testContent = await generator.generateTestFile(testSuite, language);
            
            const testFileName = `${path.basename(editor.document.fileName, path.extname(editor.document.fileName))}.test${path.extname(editor.document.fileName)}`;
            const testUri = vscode.Uri.file(path.join(path.dirname(editor.document.fileName), testFileName));
            
            const testDoc = await vscode.workspace.openTextDocument({
                content: testContent,
                language: language
            });
            
            await vscode.window.showTextDocument(testDoc, vscode.ViewColumn.Beside);
            
            vscode.window.showInformationMessage(
                `Generated ${testSuite.tests.length} tests covering ${testSuite.coverage.functions.length} functions`
            );
        });
    });

    // Analyze test coverage
    const analyzeCoverage = vscode.commands.registerCommand('coding.analyzeCoverage', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder');
            return;
        }

        const files = await vscode.workspace.findFiles('**/*.{ts,js,py,java}', '**/node_modules/**');
        const testFiles = await vscode.workspace.findFiles('**/*.{test,spec}.{ts,js,py,java}', '**/node_modules/**');
        
        const coverage = {
            totalFiles: files.length,
            testedFiles: testFiles.length,
            coveragePercentage: Math.round((testFiles.length / files.length) * 100)
        };

        const panel = vscode.window.createWebviewPanel(
            'testCoverage',
            'Test Coverage Analysis',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .metric { margin: 10px 0; padding: 15px; border-radius: 5px; }
                    .good { background-color: #d4edda; }
                    .warning { background-color: #fff3cd; }
                    .danger { background-color: #f8d7da; }
                </style>
            </head>
            <body>
                <h1>Test Coverage Report</h1>
                <div class="metric ${coverage.coveragePercentage > 80 ? 'good' : coverage.coveragePercentage > 50 ? 'warning' : 'danger'}">
                    <h3>Overall Coverage: ${coverage.coveragePercentage}%</h3>
                    <p>Tested Files: ${coverage.testedFiles} / ${coverage.totalFiles}</p>
                </div>
                <div class="metric">
                    <h3>Recommendations</h3>
                    <ul>
                        ${coverage.coveragePercentage < 50 ? '<li>⚠️ Low test coverage detected. Consider adding more tests.</li>' : ''}
                        ${coverage.coveragePercentage > 80 ? '<li>✅ Good test coverage!</li>' : ''}
                        <li>Use "Generate Tests" command to create comprehensive test suites</li>
                    </ul>
                </div>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(generateTests, analyzeCoverage);
}