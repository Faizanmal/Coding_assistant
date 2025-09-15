import * as vscode from 'vscode';
import { callLLM } from './cli-api';
import * as cp from 'child_process';
import { promisify } from 'util';

const exec = promisify(cp.exec);

export class SmartGitIntegration {
    
    public static async generateCommitMessage() {
        try {
            const { stdout: diff } = await exec('git diff --cached');
            if (!diff.trim()) {
                vscode.window.showErrorMessage('No staged changes found');
                return;
            }

            const prompt = `Analyze this git diff and generate a concise, descriptive commit message following conventional commits format:

            ${diff}`;

            const commitMessage = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const input = await vscode.window.showInputBox({
                prompt: 'Commit message (edit if needed)',
                value: commitMessage.trim()
            });

            if (input) {
                await exec(`git commit -m "${input}"`);
                vscode.window.showInformationMessage('Changes committed successfully!');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Git operation failed: ' + error);
        }
    }

    public static async analyzeCodeChanges() {
        try {
            const { stdout: diff } = await exec('git diff HEAD~1');
            if (!diff.trim()) {
                vscode.window.showErrorMessage('No recent changes found');
                return;
            }

            const prompt = `Analyze this git diff and provide insights about the changes:
            - What was changed and why
            - Potential impact on the codebase
            - Any risks or concerns
            - Suggestions for improvement

            ${diff}`;

            const analysis = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const panel = vscode.window.createWebviewPanel(
                'gitAnalysis',
                'Git Changes Analysis',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                    .analysis { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>Git Changes Analysis</h1>
                <div class="analysis">${analysis}</div>
            </body>
            </html>`;
        } catch (error) {
            vscode.window.showErrorMessage('Git analysis failed: ' + error);
        }
    }

    public static async suggestBranchName() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const workDescription = await vscode.window.showInputBox({
            prompt: 'Describe what you\'re working on',
            placeHolder: 'e.g., Add user authentication feature'
        });

        if (!workDescription) return;

        const prompt = `Generate a git branch name following best practices for this work description: "${workDescription}"
        Return only the branch name, no explanations.`;

        try {
            const branchName = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const action = await vscode.window.showQuickPick([
                'Create and switch to branch',
                'Just copy branch name'
            ], { placeHolder: 'What would you like to do?' });

            if (action === 'Create and switch to branch') {
                await exec(`git checkout -b ${branchName.trim()}`);
                vscode.window.showInformationMessage(`Switched to new branch: ${branchName.trim()}`);
            } else {
                await vscode.env.clipboard.writeText(branchName.trim());
                vscode.window.showInformationMessage('Branch name copied to clipboard');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Branch name generation failed: ' + error);
        }
    }

    public static async generatePullRequestDescription() {
        try {
            const { stdout: diff } = await exec('git diff main...HEAD');
            if (!diff.trim()) {
                vscode.window.showErrorMessage('No changes found compared to main branch');
                return;
            }

            const prompt = `Generate a comprehensive pull request description for these changes:
            Include:
            - Summary of changes
            - What problem this solves
            - How to test
            - Any breaking changes
            - Checklist items

            Changes:
            ${diff}`;

            const prDescription = await callLLM(prompt, 'groq', 'llama-3.3-70b-versatile');
            
            const panel = vscode.window.createWebviewPanel(
                'prDescription',
                'Pull Request Description',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = `<!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
                    .description { background: #f8f9fa; padding: 15px; border-radius: 5px; }
                    button { padding: 10px 20px; margin: 10px 0; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer; }
                </style>
            </head>
            <body>
                <h1>Pull Request Description</h1>
                <div class="description">${prDescription}</div>
                <button onclick="copyToClipboard()">Copy to Clipboard</button>
                <script>
                    function copyToClipboard() {
                        navigator.clipboard.writeText(\`${prDescription.replace(/`/g, '\\`')}\`);
                        alert('Copied to clipboard!');
                    }
                </script>
            </body>
            </html>`;
        } catch (error) {
            vscode.window.showErrorMessage('PR description generation failed: ' + error);
        }
    }
}