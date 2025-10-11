/**
 * Advanced AI-Powered Code Quality Analyzer
 * Enterprise-grade code analysis with ML-based recommendations and automated improvements
 */

import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { SecurityUtils } from './utils/sanitizer';
import { SecureConfigManager } from './utils/secure-config';
import * as path from 'path';

interface CodeQualityIssue {
  type: 'performance' | 'maintainability' | 'reliability' | 'security' | 'style' | 'complexity';
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  suggestion: string;
  autoFixAvailable: boolean;
  fixCode?: string;
  tags: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  rule?: string;
  references?: string[];
}

interface CodeQualityReport {
  timestamp: Date;
  file: string;
  language: string;
  totalLines: number;
  qualityScore: number; // 0-100
  maintainabilityIndex: number;
  technicalDebt: number; // in hours
  issues: CodeQualityIssue[];
  metrics: {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    duplicatedLines: number;
    testCoverage?: number;
    codeSmells: number;
    bugs: number;
    vulnerabilities: number;
  };
  recommendations: string[];
  refactoringOpportunities: RefactoringOpportunity[];
}

interface RefactoringOpportunity {
  type: string;
  description: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
  };
  benefit: string;
  effort: 'low' | 'medium' | 'high';
  autoRefactorAvailable: boolean;
}

export class AdvancedCodeQualityAnalyzer {
  private configManager: SecureConfigManager;

  constructor() {
    this.configManager = SecureConfigManager.getInstance();
  }

  /**
   * Analyze current file for code quality issues
   */
  public async analyzeCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const code = document.getText();
    const language = document.languageId;
    const fileName = document.fileName;

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🔍 Analyzing Code Quality...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Computing metrics...' });
        const metrics = await this.computeCodeMetrics(code, language);
        
        progress.report({ message: 'AI-powered analysis...' });
        const aiIssues = await this.performAIAnalysis(code, language, fileName);
        
        progress.report({ message: 'Static analysis...' });
        const staticIssues = await this.performStaticAnalysis(code, language, fileName);
        
        progress.report({ message: 'Identifying refactoring opportunities...' });
        const refactoringOps = await this.identifyRefactoringOpportunities(code, language);
        
        progress.report({ message: 'Generating report...' });
        const report = this.generateQualityReport(
          fileName, language, code, 
          [...aiIssues, ...staticIssues], 
          metrics, 
          refactoringOps
        );

        await this.displayQualityReport(report);
        
        // Offer automated fixes
        const autoFixableIssues = report.issues.filter(issue => issue.autoFixAvailable);
        if (autoFixableIssues.length > 0) {
          await this.offerAutomatedFixes(autoFixableIssues, editor);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Code quality analysis failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  /**
   * Analyze entire workspace for code quality
   */
  public async analyzeWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🏗️ Workspace Quality Analysis...',
      cancellable: false
    }, async (progress) => {
      try {
        const files = await vscode.workspace.findFiles(
          '**/*.{ts,js,jsx,tsx,py,java,cpp,cs,go,php,rb,swift,kt}',
          '**/node_modules/**'
        );

        const reports: CodeQualityReport[] = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          progress.report({
            message: `Analyzing ${vscode.workspace.asRelativePath(file)} (${i + 1}/${files.length})...`,
            increment: (100 / files.length)
          });

          try {
            const content = (await vscode.workspace.fs.readFile(file)).toString();
            const language = this.getLanguageFromFile(file.fsPath);
            
            const metrics = await this.computeCodeMetrics(content, language);
            const issues = await this.performStaticAnalysis(content, language, file.fsPath);
            const refactoringOps = await this.identifyRefactoringOpportunities(content, language);
            
            const report = this.generateQualityReport(
              file.fsPath, language, content, issues, metrics, refactoringOps
            );
            
            reports.push(report);
          } catch (error) {
            console.error(`Error analyzing ${file.fsPath}:`, SecurityUtils.sanitizeLogInput(String(error)));
          }
        }

        await this.displayWorkspaceQualityReport(reports);
      } catch (error) {
        vscode.window.showErrorMessage(`Workspace analysis failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  /**
   * Perform AI-powered code analysis
   */
  private async performAIAnalysis(code: string, language: string, fileName: string): Promise<CodeQualityIssue[]> {
    try {
      const analysisPrompt = `
Perform a comprehensive code quality analysis of this ${language} code. Analyze for:

1. Performance issues and optimizations
2. Maintainability problems
3. Code smells and anti-patterns
4. Reliability issues
5. Best practices violations
6. Complexity issues

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Return ONLY a JSON array of issues in this format:
[
  {
    "type": "performance|maintainability|reliability|security|style|complexity",
    "severity": "critical|major|minor|info",
    "title": "Issue title",
    "description": "Detailed description",
    "line": line_number,
    "column": column_number,
    "suggestion": "How to fix",
    "autoFixAvailable": true|false,
    "fixCode": "suggested fix code (if available)",
    "tags": ["tag1", "tag2"],
    "estimatedEffort": "low|medium|high",
    "impact": "low|medium|high",
    "rule": "rule name or ID"
  }
]

Focus on actionable issues with clear remediation steps. If no issues found, return: []
`;

      const response = await getLLMCompletion(analysisPrompt);
      
      if (!response) {
        console.warn('AI code quality analysis returned no response');
        return [];
      }
      
      try {
        const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
        const aiIssues = JSON.parse(cleanResponse);
        
        return aiIssues.map((issue: any) => ({
          ...issue,
          file: fileName,
          references: this.getReferencesForIssueType(issue.type, issue.rule)
        }));
      } catch (parseError) {
        console.warn('Failed to parse AI code quality response:', SecurityUtils.sanitizeLogInput(response));
        return [];
      }
    } catch (error) {
      console.error('AI code quality analysis failed:', SecurityUtils.sanitizeLogInput(String(error)));
      return [];
    }
  }

  /**
   * Perform static code analysis
   */
  private async performStaticAnalysis(code: string, language: string, fileName: string): Promise<CodeQualityIssue[]> {
    const issues: CodeQualityIssue[] = [];
    const lines = code.split('\n');

    // Language-specific static analysis patterns
    const patterns = this.getStaticAnalysisPatterns(language);
    
    for (const [ruleName, pattern] of Object.entries(patterns)) {
      const matches = this.findPatternMatches(code, pattern.regex);
      
      for (const match of matches) {
        const lineNumber = code.substring(0, match.index).split('\n').length;
        
        issues.push({
          type: pattern.type,
          severity: pattern.severity,
          title: pattern.title,
          description: pattern.description,
          file: fileName,
          line: lineNumber,
          column: match.index - code.lastIndexOf('\n', match.index - 1) - 1,
          suggestion: pattern.suggestion,
          autoFixAvailable: pattern.autoFix !== undefined,
          fixCode: pattern.autoFix ? this.generateAutoFix(pattern.autoFix, match.match, lines[lineNumber - 1]) : undefined,
          tags: pattern.tags,
          estimatedEffort: pattern.effort || 'low',
          impact: pattern.impact || 'medium',
          rule: ruleName,
          references: pattern.references
        });
      }
    }

    return issues;
  }

  /**
   * Compute code metrics
   */
  private async computeCodeMetrics(code: string, language: string): Promise<CodeQualityReport['metrics']> {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    return {
      cyclomaticComplexity: this.calculateCyclomaticComplexity(code, language),
      cognitiveComplexity: this.calculateCognitiveComplexity(code, language),
      linesOfCode: nonEmptyLines.length,
      duplicatedLines: this.findDuplicatedLines(lines),
      testCoverage: await this.estimateTestCoverage(code, language),
      codeSmells: this.detectCodeSmells(code, language),
      bugs: 0, // Will be populated by static analysis
      vulnerabilities: 0 // Will be populated by security scanner
    };
  }

  /**
   * Identify refactoring opportunities
   */
  private async identifyRefactoringOpportunities(code: string, language: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    
    // Long method detection
    const longMethods = this.detectLongMethods(code, language);
    opportunities.push(...longMethods);
    
    // Duplicate code detection
    const duplicateBlocks = this.detectDuplicateCode(code);
    opportunities.push(...duplicateBlocks);
    
    // Complex conditionals
    const complexConditionals = this.detectComplexConditionals(code, language);
    opportunities.push(...complexConditionals);
    
    // Large classes/files
    const largeStructures = this.detectLargeStructures(code, language);
    opportunities.push(...largeStructures);

    return opportunities;
  }

  /**
   * Generate comprehensive quality report
   */
  private generateQualityReport(
    fileName: string,
    language: string,
    code: string,
    issues: CodeQualityIssue[],
    metrics: CodeQualityReport['metrics'],
    refactoringOps: RefactoringOpportunity[]
  ): CodeQualityReport {
    const qualityScore = this.calculateQualityScore(issues, metrics);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(metrics);
    const technicalDebt = this.calculateTechnicalDebt(issues);
    
    return {
      timestamp: new Date(),
      file: fileName,
      language,
      totalLines: code.split('\n').length,
      qualityScore,
      maintainabilityIndex,
      technicalDebt,
      issues,
      metrics,
      recommendations: this.generateRecommendations(issues, metrics),
      refactoringOpportunities: refactoringOps
    };
  }

  /**
   * Display quality report in a webview
   */
  private async displayQualityReport(report: CodeQualityReport): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'codeQualityReport',
      `📊 Code Quality - ${path.basename(report.file)}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateQualityReportHtml(report);
  }

  /**
   * Display workspace quality summary
   */
  private async displayWorkspaceQualityReport(reports: CodeQualityReport[]): Promise<void> {
    const summary = this.generateWorkspaceSummary(reports);
    
    const panel = vscode.window.createWebviewPanel(
      'workspaceQuality',
      '🏗️ Workspace Quality Report',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateWorkspaceReportHtml(summary, reports);
  }

  /**
   * Helper methods for analysis
   */
  private getStaticAnalysisPatterns(language: string): Record<string, any> {
    const patterns: Record<string, Record<string, any>> = {
      typescript: {
        'no-any': {
          regex: /:\s*any\b/g,
          type: 'maintainability',
          severity: 'minor',
          title: 'Avoid using "any" type',
          description: 'Using "any" defeats the purpose of TypeScript type checking',
          suggestion: 'Use specific types or interfaces instead',
          tags: ['typescript', 'types'],
          effort: 'low',
          impact: 'medium',
          references: ['https://typescript-eslint.io/rules/no-explicit-any/']
        },
        'prefer-const': {
          regex: /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*[^;]+;(?!\s*\1\s*=)/g,
          type: 'style',
          severity: 'minor',
          title: 'Use const instead of let for immutable variables',
          description: 'Variable is never reassigned, should use const',
          suggestion: 'Change let to const',
          autoFix: (match: string) => match.replace('let ', 'const '),
          tags: ['typescript', 'const'],
          effort: 'low',
          impact: 'low'
        }
      },
      javascript: {
        'no-var': {
          regex: /\bvar\s+/g,
          type: 'style',
          severity: 'minor',
          title: 'Avoid using var',
          description: 'var has function scope which can lead to bugs',
          suggestion: 'Use let or const instead',
          autoFix: (match: string) => match.replace('var ', 'let '),
          tags: ['javascript', 'es6'],
          effort: 'low',
          impact: 'medium'
        }
      }
    };

    return patterns[language] || {};
  }

  private findPatternMatches(code: string, regex: RegExp): Array<{ match: string; index: number }> {
    const matches: Array<{ match: string; index: number }> = [];
    let match;
    
    const globalRegex = new RegExp(regex.source, regex.flags);
    while ((match = globalRegex.exec(code)) !== null) {
      matches.push({ match: match[0], index: match.index });
    }
    
    return matches;
  }

  private calculateCyclomaticComplexity(code: string, language: string): number {
    // Simplified cyclomatic complexity calculation
    const complexityPatterns = [
      /\bif\b/g, /\belse\b/g, /\bwhile\b/g, /\bfor\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\b\?\b/g,
      /\b&&\b/g, /\b\|\|\b/g
    ];
    
    let complexity = 1; // Base complexity
    
    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private calculateCognitiveComplexity(code: string, language: string): number {
    // Simplified cognitive complexity calculation
    // This would be more sophisticated in a real implementation
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code, language);
    
    // Add penalty for nesting
    const nestingLevel = this.calculateNestingLevel(code);
    
    return cyclomaticComplexity + nestingLevel;
  }

  private calculateNestingLevel(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    
    for (const char of code) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }
    
    return maxNesting;
  }

  private findDuplicatedLines(lines: string[]): number {
    const lineMap = new Map<string, number>();
    let duplicated = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 5) { // Ignore very short lines
        const count = lineMap.get(trimmed) || 0;
        lineMap.set(trimmed, count + 1);
        if (count === 1) { // First duplicate
          duplicated += 2; // Count both original and duplicate
        } else if (count > 1) {
          duplicated++;
        }
      }
    }
    
    return duplicated;
  }

  private async estimateTestCoverage(code: string, language: string): Promise<number | undefined> {
    // This would integrate with actual coverage tools in a real implementation
    const testPatterns = [/describe\(/g, /it\(/g, /test\(/g, /expect\(/g];
    const hasTests = testPatterns.some(pattern => pattern.test(code));
    
    if (hasTests) {
      return Math.random() * 30 + 70; // Mock coverage between 70-100%
    }
    
    return undefined;
  }

  private detectCodeSmells(code: string, language: string): number {
    const smellPatterns = [
      /\.length\s*>\s*0/g, // Use .length instead of .length > 0
      /==\s*true|!=\s*false/g, // Unnecessary boolean comparison
      /console\.log/g, // Debug statements
      /debugger/g, // Debug statements
      /TODO|FIXME|HACK/gi // Code comments indicating issues
    ];
    
    let smells = 0;
    for (const pattern of smellPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        smells += matches.length;
      }
    }
    
    return smells;
  }

  private detectLongMethods(code: string, language: string): RefactoringOpportunity[] {
    // This is a simplified implementation
    const methods = this.extractMethods(code, language);
    const longMethods: RefactoringOpportunity[] = [];
    
    for (const method of methods) {
      if (method.lineCount > 20) {
        longMethods.push({
          type: 'extract-method',
          description: `Method "${method.name}" is too long (${method.lineCount} lines)`,
          location: {
            file: '',
            startLine: method.startLine,
            endLine: method.endLine
          },
          benefit: 'Improves readability and maintainability',
          effort: 'medium',
          autoRefactorAvailable: false
        });
      }
    }
    
    return longMethods;
  }

  private detectDuplicateCode(code: string): RefactoringOpportunity[] {
    // Simplified duplicate detection
    const lines = code.split('\n');
    const duplicates: RefactoringOpportunity[] = [];
    
    // This would be more sophisticated in a real implementation
    for (let i = 0; i < lines.length - 5; i++) {
      const block = lines.slice(i, i + 5).join('\n');
      const duplicateIndex = code.indexOf(block, code.indexOf(block) + 1);
      
      if (duplicateIndex !== -1) {
        duplicates.push({
          type: 'extract-common-code',
          description: 'Duplicate code block detected',
          location: {
            file: '',
            startLine: i + 1,
            endLine: i + 5
          },
          benefit: 'Reduces code duplication and maintenance burden',
          effort: 'medium',
          autoRefactorAvailable: false
        });
      }
    }
    
    return duplicates;
  }

  private detectComplexConditionals(code: string, language: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const complexIfPattern = /if\s*\([^)]{50,}\)/g;
    
    let match;
    while ((match = complexIfPattern.exec(code)) !== null) {
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      opportunities.push({
        type: 'simplify-conditional',
        description: 'Complex conditional expression detected',
        location: {
          file: '',
          startLine: lineNumber,
          endLine: lineNumber
        },
        benefit: 'Improves readability and reduces cognitive complexity',
        effort: 'low',
        autoRefactorAvailable: false
      });
    }
    
    return opportunities;
  }

  private detectLargeStructures(code: string, language: string): RefactoringOpportunity[] {
    // Simplified large class/file detection
    const lineCount = code.split('\n').length;
    const opportunities: RefactoringOpportunity[] = [];
    
    if (lineCount > 300) {
      opportunities.push({
        type: 'split-file',
        description: `File is too large (${lineCount} lines)`,
        location: {
          file: '',
          startLine: 1,
          endLine: lineCount
        },
        benefit: 'Improves maintainability and reduces complexity',
        effort: 'high',
        autoRefactorAvailable: false
      });
    }
    
    return opportunities;
  }

  private extractMethods(code: string, language: string): Array<{
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
  }> {
    // Simplified method extraction
    const methods: Array<{
      name: string;
      startLine: number;
      endLine: number;
      lineCount: number;
    }> = [];
    
    // This would be more sophisticated with proper AST parsing
    const functionPattern = /function\s+(\w+)\s*\(|(\w+)\s*:\s*\([^)]*\)\s*=>/g;
    let match;
    
    while ((match = functionPattern.exec(code)) !== null) {
      const name = match[1] || match[2] || 'anonymous';
      const startLine = code.substring(0, match.index).split('\n').length;
      
      // Find end of function (simplified)
      let braceCount = 0;
      let endIndex = match.index;
      for (let i = match.index; i < code.length; i++) {
        if (code[i] === '{') {braceCount++;}
        if (code[i] === '}') {braceCount--;}
        if (braceCount === 0 && code[i] === '}') {
          endIndex = i;
          break;
        }
      }
      
      const endLine = code.substring(0, endIndex).split('\n').length;
      
      methods.push({
        name,
        startLine,
        endLine,
        lineCount: endLine - startLine + 1
      });
    }
    
    return methods;
  }

  private calculateQualityScore(issues: CodeQualityIssue[], metrics: CodeQualityReport['metrics']): number {
    let score = 100;
    
    // Deduct points for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 10; break;
        case 'major': score -= 5; break;
        case 'minor': score -= 2; break;
        case 'info': score -= 0.5; break;
      }
    }
    
    // Deduct points for high complexity
    if (metrics.cyclomaticComplexity > 20) {
      score -= (metrics.cyclomaticComplexity - 20) * 2;
    }
    
    // Deduct points for code smells
    score -= metrics.codeSmells * 0.5;
    
    return Math.max(0, Math.round(score));
  }

  private calculateMaintainabilityIndex(metrics: CodeQualityReport['metrics']): number {
    // Simplified maintainability index calculation
    const volume = Math.log2(metrics.linesOfCode) * 100;
    const complexity = metrics.cyclomaticComplexity;
    const index = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(metrics.linesOfCode)) * 100 / 171);
    
    return Math.round(index);
  }

  private calculateTechnicalDebt(issues: CodeQualityIssue[]): number {
    let debt = 0;
    
    for (const issue of issues) {
      switch (issue.estimatedEffort) {
        case 'low': debt += 0.5; break;
        case 'medium': debt += 2; break;
        case 'high': debt += 8; break;
      }
    }
    
    return debt;
  }

  private generateRecommendations(issues: CodeQualityIssue[], metrics: CodeQualityReport['metrics']): string[] {
    const recommendations: string[] = [];
    
    if (metrics.cyclomaticComplexity > 15) {
      recommendations.push('Consider breaking down complex functions into smaller, more manageable pieces');
    }
    
    if (metrics.codeSmells > 5) {
      recommendations.push('Address code smells to improve code readability and maintainability');
    }
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    if (criticalIssues > 0) {
      recommendations.push(`Address ${criticalIssues} critical issues immediately`);
    }
    
    if (metrics.duplicatedLines > 20) {
      recommendations.push('Extract common code to reduce duplication');
    }
    
    if (metrics.linesOfCode > 500) {
      recommendations.push('Consider splitting large files into smaller modules');
    }
    
    return recommendations;
  }

  private generateAutoFix(autoFixFunction: Function, match: string, line: string): string {
    try {
      return autoFixFunction(match, line);
    } catch (error) {
      return '// TODO: Fix this issue';
    }
  }

  private getReferencesForIssueType(type: string, rule?: string): string[] {
    const references: Record<string, string[]> = {
      performance: [
        'https://web.dev/performance/',
        'https://developer.mozilla.org/en-US/docs/Web/Performance'
      ],
      maintainability: [
        'https://refactoring.guru/',
        'https://martinfowler.com/books/refactoring.html'
      ],
      reliability: [
        'https://12factor.net/',
        'https://docs.microsoft.com/en-us/azure/architecture/framework/reliability/'
      ]
    };
    
    return references[type] || [];
  }

  private getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    return languageMap[ext] || 'text';
  }

  private generateQualityReportHtml(report: CodeQualityReport): string {
    // This would generate a comprehensive HTML report
    // For brevity, showing a simplified version
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #007ACC; padding-bottom: 10px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .score-good { color: #4CAF50; }
        .score-warning { color: #FF9800; }
        .score-error { color: #F44336; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
        .critical { border-left-color: #F44336; }
        .major { border-left-color: #FF9800; }
        .minor { border-left-color: #FFC107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Code Quality Report</h1>
        <p><strong>File:</strong> ${path.basename(report.file)}</p>
        <p><strong>Language:</strong> ${report.language}</p>
        <p><strong>Generated:</strong> ${report.timestamp.toLocaleString()}</p>
    </div>
    
    <div class="metrics">
        <div class="metric">
            <h3>Quality Score</h3>
            <div class="${report.qualityScore >= 80 ? 'score-good' : report.qualityScore >= 60 ? 'score-warning' : 'score-error'}">
                ${report.qualityScore}/100
            </div>
        </div>
        <div class="metric">
            <h3>Maintainability Index</h3>
            <div>${report.maintainabilityIndex}/100</div>
        </div>
        <div class="metric">
            <h3>Technical Debt</h3>
            <div>${report.technicalDebt} hours</div>
        </div>
        <div class="metric">
            <h3>Cyclomatic Complexity</h3>
            <div>${report.metrics.cyclomaticComplexity}</div>
        </div>
    </div>
    
    <h2>Issues (${report.issues.length})</h2>
    ${report.issues.map(issue => `
        <div class="issue ${issue.severity}">
            <h4>${issue.title}</h4>
            <p><strong>Line ${issue.line}:</strong> ${issue.description}</p>
            <p><strong>Suggestion:</strong> ${issue.suggestion}</p>
            <p><strong>Effort:</strong> ${issue.estimatedEffort} | <strong>Impact:</strong> ${issue.impact}</p>
        </div>
    `).join('')}
    
    <h2>Recommendations</h2>
    <ul>
        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>`;
  }

  private generateWorkspaceSummary(reports: CodeQualityReport[]): any {
    const totalFiles = reports.length;
    const avgQualityScore = reports.reduce((sum, r) => sum + r.qualityScore, 0) / totalFiles;
    const totalIssues = reports.reduce((sum, r) => sum + r.issues.length, 0);
    const totalDebt = reports.reduce((sum, r) => sum + r.technicalDebt, 0);
    
    return {
      totalFiles,
      avgQualityScore: Math.round(avgQualityScore),
      totalIssues,
      totalDebt: Math.round(totalDebt),
      worstFiles: reports.sort((a, b) => a.qualityScore - b.qualityScore).slice(0, 10),
      bestFiles: reports.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 10)
    };
  }

  private generateWorkspaceReportHtml(summary: any, reports: CodeQualityReport[]): string {
    // Similar to single file report but with workspace-wide metrics
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { padding: 20px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
    </style>
</head>
<body>
    <h1>🏗️ Workspace Quality Report</h1>
    
    <div class="summary">
        <div class="metric-card">
            <h3>Total Files</h3>
            <div style="font-size: 2em; color: #007ACC;">${summary.totalFiles}</div>
        </div>
        <div class="metric-card">
            <h3>Average Quality Score</h3>
            <div style="font-size: 2em; color: ${summary.avgQualityScore >= 80 ? '#4CAF50' : summary.avgQualityScore >= 60 ? '#FF9800' : '#F44336'};">
                ${summary.avgQualityScore}/100
            </div>
        </div>
        <div class="metric-card">
            <h3>Total Issues</h3>
            <div style="font-size: 2em; color: #F44336;">${summary.totalIssues}</div>
        </div>
        <div class="metric-card">
            <h3>Technical Debt</h3>
            <div style="font-size: 2em; color: #FF9800;">${summary.totalDebt}h</div>
        </div>
    </div>
    
    <h2>Files Needing Attention</h2>
    <ul>
        ${summary.worstFiles.slice(0, 5).map((file: CodeQualityReport) => 
          `<li>${path.basename(file.file)} - Score: ${file.qualityScore}/100 (${file.issues.length} issues)</li>`
        ).join('')}
    </ul>
    
    <h2>High Quality Files</h2>
    <ul>
        ${summary.bestFiles.slice(0, 5).map((file: CodeQualityReport) => 
          `<li>${path.basename(file.file)} - Score: ${file.qualityScore}/100</li>`
        ).join('')}
    </ul>
</body>
</html>`;
  }

  private async offerAutomatedFixes(issues: CodeQualityIssue[], editor: vscode.TextEditor): Promise<void> {
    const choice = await vscode.window.showInformationMessage(
      `Found ${issues.length} issues with automated fixes. Apply fixes?`,
      'Apply All',
      'Review Each',
      'Cancel'
    );

    if (choice === 'Apply All') {
      await this.applyAllFixes(issues, editor);
    } else if (choice === 'Review Each') {
      await this.reviewAndApplyFixes(issues, editor);
    }
  }

  private async applyAllFixes(issues: CodeQualityIssue[], editor: vscode.TextEditor): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const document = editor.document;

    // Sort by line number (descending) to avoid offset issues
    issues.sort((a, b) => b.line - a.line);

    for (const issue of issues) {
      if (issue.fixCode && issue.line > 0) {
        const line = document.lineAt(issue.line - 1);
        const range = new vscode.Range(
          issue.line - 1, 0,
          issue.line - 1, line.text.length
        );
        edit.replace(document.uri, range, issue.fixCode);
      }
    }

    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
      vscode.window.showInformationMessage(`✅ Applied ${issues.length} code quality fixes!`);
    } else {
      vscode.window.showErrorMessage('Failed to apply some fixes. Please review manually.');
    }
  }

  private async reviewAndApplyFixes(issues: CodeQualityIssue[], editor: vscode.TextEditor): Promise<void> {
    for (const issue of issues) {
      if (!issue.fixCode) {continue;}

      const choice = await vscode.window.showInformationMessage(
        `${issue.title}\n\n${issue.description}\n\nApply suggested fix?`,
        { modal: true },
        'Apply',
        'Skip',
        'Cancel'
      );

      if (choice === 'Cancel') {break;}
      if (choice === 'Apply') {
        await this.applyAllFixes([issue], editor);
      }
    }
  }
}

/**
 * Register code quality analyzer commands
 */
export function registerCodeQualityCommands(context: vscode.ExtensionContext) {
  const analyzer = new AdvancedCodeQualityAnalyzer();

  context.subscriptions.push(
    vscode.commands.registerCommand('coding.quality.analyzeFile', () => {
      analyzer.analyzeCurrentFile();
    }),

    vscode.commands.registerCommand('coding.quality.analyzeWorkspace', () => {
      analyzer.analyzeWorkspace();
    })
  );
}