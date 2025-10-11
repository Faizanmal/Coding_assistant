import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { SecurityUtils } from './utils/sanitizer';
import * as path from 'path';
import * as fs from 'fs';

// --- TYPE DEFINITIONS ---

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  description: string;
  file: string;
  line: number;
  column?: number;
  suggestion: string;
  cwe?: string;
  owasp?: string;
  cvss?: number;
  fixCode?: string;
  references?: string[];
}

interface SecurityAudit {
  timestamp: Date;
  totalFiles: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
  securityScore: number;
  complianceStatus: {
    owasp: boolean;
    soc2: boolean;
    gdpr: boolean;
    pci: boolean;
  };
  recommendations: string[];
}

/**
 * Advanced Security & Vulnerability Scanner
 * Enterprise-grade security scanning with OWASP compliance, automated fixes, and comprehensive reporting.
 */
export class SecurityScanner {

  // --- CONSTANTS AND MAPPINGS ---

  private static readonly SECURITY_PATTERNS = {
    // OWASP Top 10 2023 patterns
    injection: [
      /(['"`])\s*\+\s*.*\+\s*\1/g, // String concatenation in queries
      /\bexec\s*\(/gi, // Dynamic execution
      /\beval\s*\(/gi, // Eval usage
      /process\.env\[\s*['"`]([^'"`]+)['"`]\s*\]/g, // Unsafe env access
      /\$\{[^}]*\}/g, // Template injection
    ],
    cryptographic: [
      /md5|sha1/gi, // Weak hashing
      /\.createHash\(['"`](md5|sha1)['"`]\)/gi,
      /Math\.random\(\)/gi, // Weak random
      /\bDES\b|\bRC4\b/gi, // Weak ciphers
    ],
    hardcodedSecrets: [
      /(['"`])[A-Za-z0-9_]{20,}(['"`])/g, // Potential API keys/secrets
      /password\s*[=:]\s*['"`][^'"`]+['"`]/gi,
      /secret\s*[=:]\s*['"`][^'"`]+['"`]/gi,
      /token\s*[=:]\s*['"`][^'"`]+['"`]/gi,
      /key\s*[=:]\s*['"`][^'"`]+['"`]/gi,
    ],
    pathTraversal: [
      /\.\.\//g,
      /path\.join\([^)]*\.\.[^)]*\)/gi,
      /fs\.readFile\([^)]*\+[^)]*\)/gi,
    ],
    xss: [
      /innerHTML\s*=/gi,
      /document\.write\s*\(/gi,
      /\$\(\s*['"`][^'"`]*['"`]\s*\)\.html\s*\(/gi,
      /dangerouslySetInnerHTML/gi,
    ],
    csrf: [
      // Simplified patterns; real detection is more complex
      /fetch\s*\([^)]*method\s*:\s*['"`]POST['"`]/gi,
      /\$\.post\s*\(/gi,
      /XMLHttpRequest.*POST/gi,
    ],
    insecureDeserialization: [
      /JSON\.parse\([^)]*\)/gi,
      /eval\s*\(\s*JSON\.parse/gi,
      /pickle\.loads/gi, // Python
      /yaml\.load\(/gi, // YAML
    ],
    sensitiveData: [
      /console\.log\([^)]*password[^)]*\)/gi,
      /console\.log\([^)]*secret[^)]*\)/gi,
      /console\.log\([^)]*token[^)]*\)/gi,
      /alert\([^)]*password[^)]*\)/gi,
    ],
    improperAuth: [
      /if\s*\(\s*password\s*===?\s*['"`][^'"`]*['"`]\s*\)/gi,
      /auth\s*=\s*true/gi,
      /isAdmin\s*=\s*['"`]true['"`]/gi,
    ],
    insecureComponents: [
      // These patterns just identify package usage; actual vulnerability depends on version.
      /require\s*\(\s*['"`][^'"`]*['"`]\s*\)/g,
      /import\s+.*from\s+['"`][^'"`]*['"`]/g,
    ]
  };

  private static readonly OWASP_MAPPING: { [key: string]: string } = {
    injection: 'A03:2021 - Injection',
    cryptographic: 'A02:2021 - Cryptographic Failures',
    hardcodedSecrets: 'A07:2021 - Identification and Authentication Failures',
    pathTraversal: 'A01:2021 - Broken Access Control',
    xss: 'A03:2021 - Injection',
    csrf: 'A01:2021 - Broken Access Control',
    insecureDeserialization: 'A08:2021 - Software and Data Integrity Failures',
    sensitiveData: 'A09:2021 - Security Logging and Monitoring Failures',
    improperAuth: 'A07:2021 - Identification and Authentication Failures',
    insecureComponents: 'A06:2021 - Vulnerable and Outdated Components'
  };

  private static readonly COMPLIANCE_RULES = {
    soc2: {
      requireHttps: true,
      requireEncryption: true,
      requireAuditLogging: true,
      requireAccessControl: true,
    },
    gdpr: {
      requireDataProtection: true,
      requireConsentManagement: true,
      requireDataMinimization: true,
      requireRightToErasure: true,
    },
    pci: {
      requireStrongCrypto: true,
      requireSecureNetwork: true,
      requireVulnerabilityManagement: true,
      requireRegularTesting: true,
    }
  };


  // --- PUBLIC COMMAND METHODS ---

  /**
   * Scans the currently active file for security vulnerabilities.
   */
  public static async scanCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const document = editor.document;
    const code = document.getText();
    const language = document.languageId;
    const fileName = document.fileName;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🔍 Advanced Security Scan',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Analyzing code patterns...' });
        const staticIssues = await this.performStaticAnalysis(code, fileName);

        progress.report({ message: 'AI-powered vulnerability detection...' });
        const aiIssues = await this.performAiAnalysis(code, language, fileName);

        progress.report({ message: 'Generating security report...' });
        const allIssues = [...staticIssues, ...aiIssues];
        await this.displayAdvancedSecurityReport(allIssues, fileName);

        const config = vscode.workspace.getConfiguration('coding');
        if (config.get('security.autoFix', false) && allIssues.some(i => i.fixCode)) {
          await this.offerAutomaticFixes(allIssues, editor);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Security scan failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  /**
   * Performs a comprehensive security audit of the entire workspace.
   */
  public static async scanWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found.');
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🛡️ Comprehensive Security Audit',
      cancellable: true
    }, async (progress, token) => {
      try {
        progress.report({ message: 'Discovering files...' });
        const files = await vscode.workspace.findFiles(
          '**/*.{ts,js,py,java,cpp,cs,go,php,rb,jsx,tsx,vue,svelte}',
          '**/node_modules/**'
        );

        if (token.isCancellationRequested) {return;}

        const allIssues: SecurityIssue[] = [];
        const auditData: Omit<SecurityAudit, 'securityScore' | 'complianceStatus' | 'recommendations'> = {
          timestamp: new Date(),
          totalFiles: files.length,
          totalIssues: 0,
          criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 0, infoIssues: 0,
        };

        for (let i = 0; i < files.length; i++) {
          if (token.isCancellationRequested) {return;}

          const file = files[i];
          const relativePath = vscode.workspace.asRelativePath(file);
          progress.report({
            message: `Scanning ${relativePath} (${i + 1}/${files.length})`,
            increment: (1 / files.length) * 100
          });

          try {
            const content = (await vscode.workspace.fs.readFile(file)).toString();
            const language = this.getLanguageFromFile(file.fsPath);

            const staticIssues = await this.performStaticAnalysis(content, file.fsPath);
            const aiIssues = await this.performAiAnalysis(content, language, file.fsPath);
            const fileIssues = [...staticIssues, ...aiIssues];

            allIssues.push(...fileIssues);
            fileIssues.forEach(issue => {
              auditData.totalIssues++;
              switch (issue.severity) {
                case 'critical': auditData.criticalIssues++; break;
                case 'high': auditData.highIssues++; break;
                case 'medium': auditData.mediumIssues++; break;
                case 'low': auditData.lowIssues++; break;
                case 'info': auditData.infoIssues++; break;
              }
            });
          } catch (error) {
            console.error(`Error scanning ${file.fsPath}:`, SecurityUtils.sanitizeLogInput(String(error)));
          }
        }

        const fullAuditData = {
          ...auditData,
          securityScore: this.calculateSecurityScore(auditData),
          complianceStatus: await this.checkCompliance(allIssues),
          recommendations: this.generateRecommendations(allIssues)
        };

        await this.displaySecurityAuditReport(fullAuditData, allIssues);
      } catch (error) {
        vscode.window.showErrorMessage(`Security audit failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  /**
   * Applies an AI-generated security fix to the selected code.
   */
  public static async applySecurityFix(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    const selectedCode = editor.document.getText(selection);

    if (selection.isEmpty || !selectedCode.trim()) {
      vscode.window.showErrorMessage('No code selected to fix.');
      return;
    }

    const securityIssue = await vscode.window.showInputBox({
      prompt: 'Describe the security issue to fix',
      placeHolder: 'e.g., SQL injection, hardcoded password, XSS...'
    });

    if (!securityIssue) {return;}

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🤖 Generating Security Fix...',
      cancellable: false
    }, async () => {
      try {
        const language = editor.document.languageId;
        const prompt = `You are a security expert. Fix the following security vulnerability in this ${language} code.
        
        Security Issue: ${securityIssue}
        
        Vulnerable Code:
        \`\`\`${language}
        ${selectedCode}
        \`\`\`
        
        Provide only the secure, corrected version of the code. Maintain original functionality and include comments explaining the security improvements. Do not include any other text, explanations, or markdown formatting.`;

        const fixedCode = await getLLMCompletion(prompt);
        if (fixedCode) {
          await editor.edit(editBuilder => {
            editBuilder.replace(selection, fixedCode);
          });
          vscode.window.showInformationMessage('✅ Security fix applied!');
        } else {
          vscode.window.showWarningMessage('Could not generate a security fix.');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Security fix failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  // --- ANALYSIS AND SCANNING LOGIC ---

  /**
   * Performs static code analysis using predefined regex patterns.
   */
  private static async performStaticAnalysis(code: string, filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    for (const [category, patterns] of Object.entries(this.SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          const lineNumber = code.substring(0, match.index).split('\n').length;
          const columnNumber = match.index - code.lastIndexOf('\n', match.index - 1);

          issues.push({
            severity: this.getSeverityForCategory(category),
            type: `[SAST] ${category}`,
            description: this.getDescriptionForCategory(category, match[0]),
            file: filePath,
            line: lineNumber,
            column: columnNumber,
            suggestion: this.getSuggestionForCategory(category),
            cwe: this.getCWEForCategory(category),
            owasp: this.OWASP_MAPPING[category],
            cvss: this.getCVSSScore(category),
            references: this.getReferencesForCategory(category)
          });
        }
      }
    }

    if (path.basename(filePath) === 'package.json') {
      const dependencyIssues = await this.scanDependencies(code, filePath);
      issues.push(...dependencyIssues);
    }

    return issues;
  }

  /**
   * Performs AI-powered vulnerability scanning.
   */
  private static async performAiAnalysis(code: string, language: string, fileName: string): Promise<SecurityIssue[]> {
    try {
      const securityPrompt = `
        Perform a comprehensive security analysis of the following ${language} code from the file "${fileName}".
        Identify vulnerabilities based on OWASP Top 10, CWE, and general security best practices.
        
        Code to analyze:
        \`\`\`${language}
        ${code}
        \`\`\`
        
        Return ONLY a valid JSON array of security issue objects with the following structure:
        [
          {
            "severity": "critical|high|medium|low|info",
            "type": "[AI] Vulnerability Type",
            "description": "A detailed description of the issue and its potential impact.",
            "line": <line_number>,
            "suggestion": "A clear, actionable suggestion on how to fix the vulnerability.",
            "cwe": "CWE-XXX",
            "owasp": "AXX:2021 - Category"
          }
        ]
        
        If no issues are found, return an empty array: []. Do not add any other text.`;

      const response = await getLLMCompletion(securityPrompt);
      
      if (!response) {
        console.warn('AI security scan returned no response');
        return [];
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/\n?```$/, '').trim();
      
      const aiIssues: any[] = JSON.parse(cleanResponse || '[]');
      
      return aiIssues.map(issue => ({
        ...issue,
        file: fileName,
        references: issue.cwe ? [`https://cwe.mitre.org/data/definitions/${issue.cwe.split('-')[1]}.html`] : [],
      }));
    } catch (error) {
      console.error('AI security scan failed or returned invalid format:', SecurityUtils.sanitizeLogInput(String(error)));
      return [];
    }
  }

  /**
   * Scans package.json for known vulnerable dependencies.
   */
  private static async scanDependencies(packageJsonContent: string, filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    try {
      const packageData = JSON.parse(packageJsonContent);
      const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };

      // NOTE: In a real-world scenario, this would use a live vulnerability database API (e.g., Snyk, npm audit).
      const knownVulnerabilities: { [key: string]: { version: string; cve: string; severity: 'critical' | 'high' | 'medium' | 'low' } } = {
        'lodash': { version: '<4.17.21', cve: 'CVE-2021-23337', severity: 'high' },
        'axios': { version: '<0.21.2', cve: 'CVE-2021-3749', severity: 'medium' },
        'node-fetch': { version: '<2.6.7', cve: 'CVE-2022-0235', severity: 'high' },
        'minimist': { version: '<1.2.6', cve: 'CVE-2021-44906', severity: 'critical' }
      };

      for (const [pkg, version] of Object.entries(dependencies as { [key: string]: string })) {
        if (knownVulnerabilities[pkg]) {
          const vuln = knownVulnerabilities[pkg];
          // A real implementation would use semver to compare versions.
          issues.push({
            severity: vuln.severity,
            type: 'Vulnerable Dependency',
            description: `Vulnerable dependency detected: ${pkg}@${version}. Known vulnerability ${vuln.cve} affects versions ${vuln.version}.`,
            file: filePath,
            line: 1, // Point to the top of the file
            suggestion: `Update ${pkg} to the latest secure version.`,
            cwe: 'CWE-937',
            owasp: 'A06:2021 - Vulnerable and Outdated Components',
            cvss: vuln.severity === 'critical' ? 9.8 : vuln.severity === 'high' ? 7.5 : 5.3,
            references: [`https://nvd.nist.gov/vuln/detail/${vuln.cve}`]
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan dependencies:', SecurityUtils.sanitizeLogInput(String(error)));
    }
    return issues;
  }

  // --- REPORTING AND UI ---

  /**
   * Displays the security report for a single file scan.
   */
  private static async displayAdvancedSecurityReport(issues: SecurityIssue[], filePath: string): Promise<void> {
    const critical = issues.filter(i => i.severity === 'critical').length;
    const high = issues.filter(i => i.severity === 'high').length;
    const medium = issues.filter(i => i.severity === 'medium').length;
    const low = issues.filter(i => i.severity === 'low').length;

    const title = `Security Scan Report for ${path.basename(filePath)}`;
    const summary = `
## 📊 Summary
- 🔴 **Critical**: ${critical}
- 🟠 **High**: ${high}
- 🟡 **Medium**: ${medium}
- 🔵 **Low**: ${low}
- **Total Issues**: ${issues.length}
`;
    await this.generateAndShowReport(title, summary, issues);

    if (critical > 0 || high > 0) {
      vscode.window.showWarningMessage(`Scan found ${critical} critical and ${high} high severity issues in ${path.basename(filePath)}!`);
    } else if (issues.length > 0) {
      vscode.window.showInformationMessage(`Scan found ${issues.length} issues to review in ${path.basename(filePath)}.`);
    } else {
      vscode.window.showInformationMessage('✅ No security issues found!');
    }
  }

  /**
   * Displays the comprehensive security audit report for the workspace.
   */
  private static async displaySecurityAuditReport(audit: SecurityAudit, issues: SecurityIssue[]): Promise<void> {
    const title = 'Workspace Security Audit Report';
    const summary = `
## 🛡️ Audit Overview
- **Security Score**: ${audit.securityScore}/100
- **Total Files Scanned**: ${audit.totalFiles}
- **Timestamp**: ${audit.timestamp.toLocaleString()}

## 📊 Issue Summary
- 🔴 **Critical**: ${audit.criticalIssues}
- 🟠 **High**: ${audit.highIssues}
- 🟡 **Medium**: ${audit.mediumIssues}
- 🔵 **Low**: ${audit.lowIssues}
- **Total Issues**: ${audit.totalIssues}

## ✅ Compliance Status
- **OWASP Top 10**: ${audit.complianceStatus.owasp ? '🟢 Passing' : '🔴 Failing'}
- **SOC 2**: ${audit.complianceStatus.soc2 ? '🟢 Passing' : '🔴 Failing'}
- **GDPR**: ${audit.complianceStatus.gdpr ? '🟢 Passing' : '🔴 Failing'}
- **PCI-DSS**: ${audit.complianceStatus.pci ? '🟢 Passing' : '🔴 Failing'}

## 💡 Recommendations
${audit.recommendations.length > 0 ? audit.recommendations.map(r => `- ${r}`).join('\n') : '- No specific recommendations.'}
`;
    await this.generateAndShowReport(title, summary, issues);
  }

  /**
   * Helper to generate and display a markdown report.
   */
  private static async generateAndShowReport(title: string, summary: string, issues: SecurityIssue[]): Promise<void> {
    const sortedIssues = [...issues].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const details = sortedIssues.length === 0 ? '✅ **No security issues found!**' : sortedIssues.map(issue => `
### ${this.getSeverityEmoji(issue.severity)} ${issue.type} (${issue.severity.toUpperCase()})
- **File**: \`${vscode.workspace.asRelativePath(issue.file)}\`
- **Line**: ${issue.line}
- **OWASP**: ${issue.owasp || 'N/A'} | **CWE**: ${issue.cwe || 'N/A'}

**Description**: ${issue.description}

**💡 Suggestion**: ${issue.suggestion}
---`).join('');

    const content = `# 🔒 ${title}\n${summary}\n## 🔍 Detailed Findings\n${details}`;
    const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  /**
   * Prompts the user to apply available automated fixes.
   */
  private static async offerAutomaticFixes(issues: SecurityIssue[], editor: vscode.TextEditor): Promise<void> {
    const fixableIssues = issues.filter(i => i.fixCode);
    const choice = await vscode.window.showInformationMessage(
      `Found ${fixableIssues.length} issues with available auto-fixes. Apply them?`,
      'Apply All', 'Cancel'
    );

    if (choice === 'Apply All') {
      await editor.edit(editBuilder => {
        fixableIssues.forEach(issue => {
          const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, editor.document.lineAt(issue.line - 1).text.length);
          editBuilder.replace(range, issue.fixCode!);
        });
      });
      vscode.window.showInformationMessage('Applied all available security fixes.');
    }
  }

  // --- HELPER AND UTILITY METHODS ---

  private static calculateSecurityScore(audit: Pick<SecurityAudit, 'totalFiles' | 'totalIssues' | 'criticalIssues' | 'highIssues' | 'mediumIssues' | 'lowIssues' | 'infoIssues'>): number {
    if (audit.totalIssues === 0) {return 100;}

    const weightedScore = (
      (audit.criticalIssues * 20) +
      (audit.highIssues * 10) +
      (audit.mediumIssues * 5) +
      (audit.lowIssues * 2) +
      (audit.infoIssues * 1)
    );

    // Assume max penalty of 20 points per file on average for normalization
    const maxPossiblePenalty = Math.max(audit.totalFiles * 20, weightedScore);
    const score = 100 - ((weightedScore / maxPossiblePenalty) * 100);

    return Math.max(0, Math.round(score));
  }

  private static async checkCompliance(issues: SecurityIssue[]): Promise<SecurityAudit['complianceStatus']> {
    const hasIssueType = (type: string) => issues.some(issue => issue.type.toLowerCase().includes(type));
    const hasCriticalOrHigh = issues.some(issue => ['critical', 'high'].includes(issue.severity));

    return {
      owasp: !hasCriticalOrHigh,
      soc2: !hasIssueType('secret') && !hasIssueType('sensitive') && !hasCriticalOrHigh,
      gdpr: !hasIssueType('sensitive') && !hasIssueType('auth'),
      pci: !hasIssueType('cryptographic') && !hasIssueType('secret') && !hasCriticalOrHigh,
    };
  }

  private static generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>();
    const issueTypes = new Set(issues.map(issue => issue.type.toLowerCase()));

    issueTypes.forEach(type => {
      if (type.includes('secret')) {recommendations.add('Implement a robust secrets management solution (e.g., Vault, AWS Secrets Manager) and remove all hardcoded credentials.');}
      if (type.includes('cryptographic')) {recommendations.add('Upgrade to modern, strong cryptographic algorithms (e.g., AES-256, SHA-256) and review key management practices.');}
      if (type.includes('injection')) {recommendations.add('Use parameterized queries or prepared statements for all database interactions and validate/sanitize all user inputs.');}
      if (type.includes('xss')) {recommendations.add('Implement context-aware output encoding and a strong Content Security Policy (CSP).');}
      if (type.includes('dependency')) {recommendations.add('Integrate automated dependency scanning (like npm audit or Snyk) into your CI/CD pipeline.');}
    });

    if (issues.length > 10) {
      recommendations.add('Establish a formal security champions program and provide ongoing security training for developers.');
    }
    return Array.from(recommendations);
  }

  // Static analysis helper methods
  private static getSeverityForCategory(category: string): SecurityIssue['severity'] {
    switch (category) {
      case 'injection':
      case 'hardcodedSecrets':
      case 'pathTraversal': return 'high';
      case 'cryptographic':
      case 'xss':
      case 'insecureDeserialization':
      case 'improperAuth': return 'medium';
      case 'csrf':
      case 'sensitiveData': return 'low';
      case 'insecureComponents': return 'info';
      default: return 'info';
    }
  }
  
  private static getDescriptionForCategory(category: string, match: string): string {
    const descriptions: { [key: string]: string } = {
        injection: `Potential injection vulnerability detected. The code appears to build a query or command using string concatenation with variable input: \`${match}\`. This can lead to SQLi, command injection, or other attacks.`,
        cryptographic: `Use of a weak or outdated cryptographic algorithm detected: \`${match}\`. Algorithms like MD5, SHA1, and DES are considered insecure and should be replaced with stronger alternatives.`,
        hardcodedSecrets: `A hardcoded secret or credential may be present: \`${match}\`. Storing sensitive data like API keys or passwords in source code is a major security risk.`,
        pathTraversal: `Potential path traversal vulnerability. The code uses relative path specifiers ('../') or concatenates user input into file paths, which could allow access to unintended files: \`${match}\`.`,
        xss: `Potential Cross-Site Scripting (XSS) vulnerability. The code writes unescaped data to the DOM using a dangerous property or method like \`${match}\`.`,
        sensitiveData: `Sensitive data may be exposed in logs or alerts: \`${match}\`. This could leak confidential information to unauthorized parties.`,
    };
    return descriptions[category] || `A potential security issue of type '${category}' was found with the code: \`${match}\`.`;
  }
  
  private static getSuggestionForCategory(category: string): string {
    const suggestions: { [key: string]: string } = {
        injection: 'Use parameterized queries, prepared statements, or an ORM to interact with databases. Sanitize and validate all input used in system commands.',
        cryptographic: 'Replace weak algorithms with strong, modern alternatives like SHA-256 (for hashing) or AES-256 (for encryption). Use a secure random number generator instead of Math.random().',
        hardcodedSecrets: 'Externalize secrets using environment variables, a .env file (added to .gitignore), or a dedicated secrets management service.',
        pathTraversal: 'Normalize file paths after combining them with user input and ensure the resulting path is within the intended directory.',
        xss: 'Use a templating engine that performs context-aware auto-escaping. Sanitize any user-provided HTML before rendering it. Implement a strong Content Security Policy (CSP).',
    };
    return suggestions[category] || 'Review the code and relevant security best practices to mitigate this issue.';
  }
  
  private static getCWEForCategory(category: string): string | undefined {
      const mapping: { [key: string]: string } = {
          injection: 'CWE-89', cryptographic: 'CWE-327', hardcodedSecrets: 'CWE-798', 
          pathTraversal: 'CWE-22', xss: 'CWE-79', insecureDeserialization: 'CWE-502'
      };
      return mapping[category];
  }
  
  private static getCVSSScore(category: string): number | undefined {
      const mapping: { [key: string]: number } = {
          injection: 8.8, cryptographic: 7.5, hardcodedSecrets: 7.5, 
          pathTraversal: 7.5, xss: 6.1, insecureDeserialization: 9.8
      };
      return mapping[category];
  }

  private static getReferencesForCategory(category: string): string[] {
      const cwe = this.getCWEForCategory(category);
      const owasp = this.OWASP_MAPPING[category];
      const refs = [];
      if (owasp) {refs.push(`https://owasp.org/Top10/2021/${owasp.split(' ')[0]}_${owasp.split(' - ')[1].replace(/ /g, '_')}/`);}
      if (cwe) {refs.push(`https://cwe.mitre.org/data/definitions/${cwe.split('-')[1]}.html`);}
      return refs;
  }

  private static getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      case 'info': return '⚪️';
      default: return '❓';
    }
  }

  private static getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    const langMap: { [key: string]: string } = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'java': 'java', 'cpp': 'cpp', 'cs': 'csharp', 'go': 'go',
      'php': 'php', 'rb': 'ruby', 'vue': 'vue', 'svelte': 'svelte'
    };
    return langMap[ext] || ext;
  }
}

// --- EXTENSION REGISTRATION ---

export function registerSecurityScannerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('coding.scanCurrentFile', () => SecurityScanner.scanCurrentFile()),
    vscode.commands.registerCommand('coding.scanWorkspace', () => SecurityScanner.scanWorkspace()),
    vscode.commands.registerCommand('coding.applySecurityFix', () => SecurityScanner.applySecurityFix())
  );
}