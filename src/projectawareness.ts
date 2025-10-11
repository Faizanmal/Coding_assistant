import * as vscode from 'vscode';
import { getprojectcontext } from './extension';
import { generateCodeUnified } from './sidebar';

export class ProjectAwareness {

    public static async analyzeProject(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return '❌ No workspace folder open. Please open a project folder to analyze.';
        }

        const projectcontext = await getprojectcontext();

        const analysisPrompt = `Analyze this project structure and provide insights:

${projectcontext}

Provide:
1. 📊 **Project Type**: What kind of project this is
2. 🛠️ **Tech Stack**: Technologies and frameworks used
3. 📁 **File Structure**: Current organization
4. ✅ **Strengths**: What's well implemented
5. ⚠️ **Issues**: Potential problems or missing elements
6. 💡 **Recommendations**: Suggested improvements

Format as markdown with clear sections.`;

        try {
            const analysis = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', analysisPrompt);
            return `📊 **Project Analysis**\n\n${analysis}`;
        } catch (error: any) {
            return `❌ Failed to analyze project: ${error.message}`;
        }
    }

    public static async suggestProjectFiles(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return '❌ No workspace folder open. Please open a project folder to get suggestions.';
        }

        const projectcontext = await getprojectcontext();

        const suggestionPrompt = `Based on this project structure, suggest missing files that should be added:

${projectcontext}

Analyze what's missing and suggest files in this format:

**Essential Missing Files:**
- filename.ext: description of what it should contain

**Recommended Files:**
- filename.ext: description of what it should contain

**Optional Enhancements:**
- filename.ext: description of what it should contain

For each suggestion, provide the exact command to generate it:
'generate files: filename.ext:detailed description'

Focus on:
- Configuration files
- Documentation files
- Security files
- Testing files
- Deployment files
- Missing core functionality files`;

        try {
            const suggestions = await generateCodeUnified('groq', 'llama-3.3-70b-versatile', suggestionPrompt);
            return `💡 **File Suggestions for Your Project**\n\n${suggestions}`;
        } catch (error: any) {
            return `❌ Failed to generate suggestions: ${error.message}`;
        }
    }
}