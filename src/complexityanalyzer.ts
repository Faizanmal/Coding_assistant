import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
  codeSmells: CodeSmell[];
  performanceIssues: PerformanceIssue[];
}

interface CodeSmell {
  type: string;
  severity: 'high' | 'medium' | 'low';
  line: number;
  description: string;
  suggestion: string;
}

interface PerformanceIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  description: string;
  impact: string;
  suggestion: string;
}

/**
 * Complexity & Performance Analyzer
 * Identifies code smells, cyclomatic complexity, and performance bottlenecks
 */
export class ComplexityAnalyzer {

  /**
   * Analyze current file for complexity and performance issues
   */
  public static async analyzeCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;
    const fileName = vscode.workspace.asRelativePath(editor.document.fileName);

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing code complexity and performance...',
      cancellable: false
    }, async () => {
      try {
        const metrics = await this.analyzeCode(code, language, fileName);
        await this.displayComplexityReport(metrics, fileName);
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
      }
    });
  }

  /**
   * Analyze selected code only
   */
  public static async analyzeSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('No code selected');
      return;
    }

    const code = editor.document.getText(selection);
    const language = editor.document.languageId;
    const fileName = vscode.workspace.asRelativePath(editor.document.fileName);

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing selected code...',
      cancellable: false
    }, async () => {
      try {
        const metrics = await this.analyzeCode(code, language, `${fileName} (selection)`);
        await this.displayComplexityReport(metrics, `${fileName} (selection)`);
      } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
      }
    });
  }

  /**
   * Analyze code using LLM for complexity and performance metrics
   */
  private static async analyzeCode(code: string, language: string, fileName: string): Promise<ComplexityMetrics> {
    const prompt = `You are a code quality expert. Analyze this ${language} code for complexity and performance issues:

File: ${fileName}
Code:
\`\`\`${language}
${code}
\`\`\`

Provide a detailed analysis including:

1. **Complexity Metrics:**
   - Cyclomatic Complexity (1-10+ scale)
   - Cognitive Complexity (1-10+ scale)
   - Lines of Code count
   - Maintainability Index (0-100 scale)

2. **Code Smells:** Look for:
   - Long functions/methods
   - Too many parameters
   - Duplicate code
   - Magic numbers
   - Deep nesting
   - Large classes
   - Poor naming
   - Tight coupling
   - God objects

3. **Performance Issues:** Look for:
   - Inefficient algorithms (O(n²) vs O(n))
   - Memory leaks
   - Unnecessary loops/iterations
   - String concatenation in loops
   - Blocking operations
   - Database N+1 queries
   - Large object creation
   - Inefficient data structures

Format as JSON:
{
  "cyclomaticComplexity": 5,
  "cognitiveComplexity": 7,
  "linesOfCode": 120,
  "maintainabilityIndex": 65,
  "codeSmells": [
    {
      "type": "Long Function",
      "severity": "high",
      "line": 25,
      "description": "Function has 50 lines, consider breaking it down",
      "suggestion": "Extract smaller functions for specific responsibilities"
    }
  ],
  "performanceIssues": [
    {
      "type": "Inefficient Algorithm",
      "severity": "high",
      "line": 35,
      "description": "Nested loops causing O(n²) complexity",
      "impact": "Performance degrades quadratically with input size",
      "suggestion": "Use a hash map to achieve O(n) complexity"
    }
  ]
}

Return only valid JSON, no other text.`;

    try {
      const response = await getLLMCompletion(prompt);
      return JSON.parse(response || '{}') as ComplexityMetrics;
    } catch (error) {
      console.error('Error parsing complexity analysis:', error);
      return {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        linesOfCode: code.split('\n').length,
        maintainabilityIndex: 50,
        codeSmells: [],
        performanceIssues: []
      };
    }
  }

  /**
   * Display complexity and performance report
   */
  private static async displayComplexityReport(metrics: ComplexityMetrics, fileName: string): Promise<void> {
    const complexityLevel = this.getComplexityLevel(metrics.cyclomaticComplexity);
    const maintainabilityLevel = this.getMaintainabilityLevel(metrics.maintainabilityIndex);
    
    const content = `# 📊 Complexity & Performance Analysis: ${fileName}

## 🎯 Overall Metrics

| Metric | Value | Status |
|--------|--------|---------|
| **Cyclomatic Complexity** | ${metrics.cyclomaticComplexity} | ${complexityLevel.emoji} ${complexityLevel.label} |
| **Cognitive Complexity** | ${metrics.cognitiveComplexity} | ${this.getCognitiveLevel(metrics.cognitiveComplexity).emoji} ${this.getCognitiveLevel(metrics.cognitiveComplexity).label} |
| **Lines of Code** | ${metrics.linesOfCode} | ${this.getLOCLevel(metrics.linesOfCode).emoji} ${this.getLOCLevel(metrics.linesOfCode).label} |
| **Maintainability Index** | ${metrics.maintainabilityIndex}/100 | ${maintainabilityLevel.emoji} ${maintainabilityLevel.label} |

## 💡 Recommendations

${this.generateRecommendations(metrics)}

## 🔍 Code Smells (${metrics.codeSmells.length} found)

${metrics.codeSmells.length === 0 ? '✅ **No code smells detected!**' : metrics.codeSmells.map(smell => `
### ${this.getSeverityEmoji(smell.severity)} ${smell.type} (Line ${smell.line})

**Severity**: ${smell.severity.toUpperCase()}  
**Description**: ${smell.description}  
**💡 Suggestion**: ${smell.suggestion}

---
`).join('')}

## ⚡ Performance Issues (${metrics.performanceIssues.length} found)

${metrics.performanceIssues.length === 0 ? '✅ **No performance issues detected!**' : metrics.performanceIssues.map(issue => `
### ${this.getPerformanceSeverityEmoji(issue.severity)} ${issue.type} (Line ${issue.line})

**Severity**: ${issue.severity.toUpperCase()}  
**Description**: ${issue.description}  
**💥 Impact**: ${issue.impact}  
**🚀 Suggestion**: ${issue.suggestion}

---
`).join('')}

## 📈 Complexity Guidelines

### Cyclomatic Complexity
- **1-10**: ✅ Simple, easy to test
- **11-20**: ⚠️ Moderate complexity, consider refactoring
- **21-50**: 🟠 High complexity, refactoring recommended
- **50+**: 🔴 Very high complexity, refactoring required

### Cognitive Complexity
- **1-15**: ✅ Easy to understand
- **16-25**: ⚠️ Moderate cognitive load
- **26+**: 🔴 High cognitive load, hard to understand

### Maintainability Index
- **85-100**: ✅ Excellent maintainability
- **65-84**: ⚠️ Good maintainability
- **20-64**: 🟠 Fair maintainability
- **0-19**: 🔴 Poor maintainability

## 🛠️ Suggested Refactoring Actions

${this.generateRefactoringActions(metrics)}

*Analysis generated on ${new Date().toLocaleString()}*
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);

    // Show summary notification
    const highIssues = metrics.codeSmells.filter(s => s.severity === 'high').length +
                      metrics.performanceIssues.filter(p => p.severity === 'critical' || p.severity === 'high').length;
    
    if (highIssues > 0) {
      vscode.window.showWarningMessage(`Found ${highIssues} high-priority issues to address`);
    } else if (metrics.codeSmells.length > 0 || metrics.performanceIssues.length > 0) {
      vscode.window.showInformationMessage(`Analysis complete: ${metrics.codeSmells.length + metrics.performanceIssues.length} issues found`);
    } else {
      vscode.window.showInformationMessage('✅ Code analysis looks good!');
    }
  }

  /**
   * Generate optimal refactor suggestions
   */
  public static async generateRefactorSuggestions(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection.isEmpty ? undefined : selection);
    const language = editor.document.languageId;

    if (!code.trim()) {
      vscode.window.showErrorMessage('No code selected');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating refactor suggestions...',
      cancellable: false
    }, async () => {
      try {
        const prompt = `Analyze this ${language} code and provide optimal refactoring suggestions:

\`\`\`${language}
${code}
\`\`\`

Provide specific, actionable refactoring steps to:
1. Reduce complexity
2. Improve performance
3. Enhance readability
4. Follow best practices
5. Improve maintainability

For each suggestion, provide:
- What to refactor
- Why it improves the code
- How to implement it
- Before/after example if helpful`;

        const suggestions = await getLLMCompletion(prompt);
        
        const content = `# 🔄 Refactoring Suggestions

${suggestions}

## Quick Actions
Try these VS Code refactoring commands:
- **Extract Method**: Select code → Right-click → Refactor → Extract Method
- **Extract Variable**: Select expression → Right-click → Refactor → Extract Variable
- **Rename Symbol**: F2 on any symbol
- **Move to New File**: Select class/function → Right-click → Refactor → Move to New File
`;

        const doc = await vscode.workspace.openTextDocument({
          content,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
        
      } catch (error) {
        vscode.window.showErrorMessage(`Refactor analysis failed: ${error}`);
      }
    });
  }

  // Helper methods
  private static getComplexityLevel(complexity: number) {
    if (complexity <= 10) {
      return { emoji: '✅', label: 'Simple' };
    }
    if (complexity <= 20) {
      return { emoji: '⚠️', label: 'Moderate' };
    }
    if (complexity <= 50) {
      return { emoji: '🟠', label: 'High' };
    }
    return { emoji: '🔴', label: 'Very High' };
  }

  private static getCognitiveLevel(complexity: number) {
    if (complexity <= 15) {
      return { emoji: '✅', label: 'Easy to understand' };
    }
    if (complexity <= 25) {
      return { emoji: '⚠️', label: 'Moderate cognitive load' };
    }
    return { emoji: '🔴', label: 'High cognitive load' };
  }

  private static getLOCLevel(loc: number) {
    if (loc <= 50) {
      return { emoji: '✅', label: 'Concise' };
    }
    if (loc <= 200) {
      return { emoji: '⚠️', label: 'Moderate size' };
    }
    if (loc <= 500) {
      return { emoji: '🟠', label: 'Large' };
    }
    return { emoji: '🔴', label: 'Very large' };
  }

  private static getMaintainabilityLevel(index: number) {
    if (index >= 85) {
      return { emoji: '✅', label: 'Excellent' };
    }
    if (index >= 65) {
      return { emoji: '⚠️', label: 'Good' };
    }
    if (index >= 20) {
      return { emoji: '🟠', label: 'Fair' };
    }
    return { emoji: '🔴', label: 'Poor' };
  }

  private static getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '❓';
    }
  }

  private static getPerformanceSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '💥';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '❓';
    }
  }

  private static generateRecommendations(metrics: ComplexityMetrics): string {
    const recommendations = [];

    if (metrics.cyclomaticComplexity > 20) {
      recommendations.push('🔄 **High cyclomatic complexity detected** - Consider breaking down complex functions into smaller, single-responsibility functions');
    }

    if (metrics.cognitiveComplexity > 25) {
      recommendations.push('🧠 **High cognitive complexity** - Simplify conditional logic and reduce nesting levels');
    }

    if (metrics.maintainabilityIndex < 65) {
      recommendations.push('🛠️ **Low maintainability** - Focus on improving code structure, reducing complexity, and adding documentation');
    }

    if (metrics.codeSmells.filter(s => s.severity === 'high').length > 0) {
      recommendations.push('👃 **Address high-severity code smells** - These indicate structural issues that impact code quality');
    }

    if (metrics.performanceIssues.filter(p => p.severity === 'critical' || p.severity === 'high').length > 0) {
      recommendations.push('⚡ **Critical performance issues found** - Address these to improve application performance');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ **Code quality looks good!** - Continue following best practices');
    }

    return recommendations.map(rec => `- ${rec}`).join('\n');
  }

  private static generateRefactoringActions(metrics: ComplexityMetrics): string {
    const actions = [];

    if (metrics.cyclomaticComplexity > 15) {
      actions.push('1. **Extract Methods** - Break down large functions into smaller, focused methods');
      actions.push('2. **Reduce Conditional Complexity** - Consider using polymorphism or strategy pattern');
    }

    if (metrics.codeSmells.some(s => s.type.includes('Duplicate'))) {
      actions.push('3. **Extract Common Code** - Create reusable functions/classes for duplicate logic');
    }

    if (metrics.performanceIssues.some(p => p.type.includes('Loop'))) {
      actions.push('4. **Optimize Loops** - Consider more efficient algorithms or data structures');
    }

    if (actions.length === 0) {
      actions.push('✅ No immediate refactoring actions needed');
    }

    return actions.join('\n');
  }
}

export function registerComplexityAnalyzerCommands(context: vscode.ExtensionContext) {
  const analyzeCurrentFileCommand = vscode.commands.registerCommand('coding.analyzeComplexity', async () => {
    await ComplexityAnalyzer.analyzeCurrentFile();
  });

  const analyzeSelectionCommand = vscode.commands.registerCommand('coding.analyzeComplexitySelection', async () => {
    await ComplexityAnalyzer.analyzeSelection();
  });

  const generateRefactorCommand = vscode.commands.registerCommand('coding.generateRefactorSuggestions', async () => {
    await ComplexityAnalyzer.generateRefactorSuggestions();
  });

  context.subscriptions.push(
    analyzeCurrentFileCommand,
    analyzeSelectionCommand,
    generateRefactorCommand
  );
}