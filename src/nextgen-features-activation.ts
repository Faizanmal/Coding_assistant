import * as vscode from 'vscode';
import { registerNextGenFeatureCommands } from './nextgen-features';

/**
 * This file updates the extension.ts file to register the new NextGen feature commands.
 * Add the following import to the top of your extension.ts file:
 * 
 * import { registerNextGenFeatureCommands } from './nextgen-features';
 * 
 * Then, add this line inside your activate function:
 * 
 * // Register NextGen Advanced Features
 * registerNextGenFeatureCommands(context);
 * 
 * Also make sure that the following types are correctly imported or defined elsewhere in your project:
 * - EnhancedCodebaseUnderstanding
 * - ProjectKnowledgeSystem
 */

/**
 * Extension activation point - when loaded, this module exports functionality
 * to enhance the main extension with NextGen features
 */
export function activateNextGenFeatures(context: vscode.ExtensionContext): void {
    console.log('Activating NextGen Features...');
    
    // Register all NextGen feature commands
    registerNextGenFeatureCommands(context);
    
    // Add commands to package.json
    console.log('NextGen Features activated successfully!');
}

// The following commands need to be added to your package.json contributes.commands section:

/**
{
  "command": "coding.augmentedIntelligenceProcess",
  "title": "🧠 Process with Augmented Intelligence",
  "category": "NextGen AI"
},
{
  "command": "coding.setAugmentedIntelligenceModel",
  "title": "🧠 Configure AI Models",
  "category": "NextGen AI"
},
{
  "command": "coding.viewAugmentedIntelligenceMetrics",
  "title": "📊 View AI Metrics",
  "category": "NextGen AI"
},
{
  "command": "coding.createFileFromTemplate",
  "title": "📄 Create File from Template",
  "category": "Quick Dev"
},
{
  "command": "coding.createProjectFromTemplate",
  "title": "🏗️ Create Project from Template",
  "category": "Quick Dev"
},
{
  "command": "coding.generateCommitMessage",
  "title": "📝 Generate Commit Message",
  "category": "Quick Dev"
},
{
  "command": "coding.analyzeFile",
  "title": "🔍 Analyze File",
  "category": "Quick Dev"
},
{
  "command": "coding.applyMultiFileTransformation",
  "title": "🔄 Multi-File Transformation",
  "category": "Quick Dev"
},
{
  "command": "coding.runProjectAnalysis",
  "title": "📊 Run Project Analysis",
  "category": "Project Awareness"
},
{
  "command": "coding.showSecurityIssues",
  "title": "🔒 Show Security Issues",
  "category": "Project Awareness"
},
{
  "command": "coding.showPerformanceIssues",
  "title": "⚡ Show Performance Issues",
  "category": "Project Awareness"
},
{
  "command": "coding.visualizeProjectStructure",
  "title": "📈 Visualize Project Structure",
  "category": "Project Awareness"
},
{
  "command": "coding.showNextGenFeatures",
  "title": "🚀 Show NextGen Features Dashboard",
  "category": "NextGen"
},
{
  "command": "coding.createNextGenConfig",
  "title": "⚙️ Create NextGen Configuration",
  "category": "NextGen"
}
*/