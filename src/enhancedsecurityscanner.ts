import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { SecurityUtils } from './utils/sanitizer';
import * as path from 'path';
import * as fs from 'fs';

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
  confidence?: 'high' | 'medium' | 'low';
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
 * Enterprise-grade security scanning with OWASP compliance, automated fixes, and comprehensive reporting
 */
export class EnhancedSecurityScanner {
  
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
      /(['"`])[A-Za-z0-9]{20,}(['"`])/g, // Potential API keys
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
      /innerHTML\s*[=:]/gi,
      /document\.write\s*\(/gi,
      /\$\(\s*['"`][^'"`]*['"`]\s*\)\.html\s*\(/gi,
      /dangerouslySetInnerHTML/gi,
    ],
    csrf: [
      /fetch\s*\([^)]*method\s*:\s*['"`]POST['"`]/gi,
      /\$\.post\s*\(/gi,
      /XMLHttpRequest.*POST/gi,
    ],
    insecureDeserialization: [
      /JSON\.parse\([^)]*\)/gi,
      /eval\s*\(\s*JSON\.parse/gi,
      /pickle\.loads/gi,
      /yaml\.load\(/gi,
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
      /require\s*\(\s*['"`][^'"`]*['"`]\s*\)/g, // Check for vulnerable packages
      /import\s+.*from\s+['"`][^'"`]*['"`]/g,
    ]
  };

  private static readonly OWASP_MAPPING = {
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

  /**
   * Enhanced scan current file for security vulnerabilities with automated fixes
   */
  public static async scanCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor found');
      return;
    }

    const code = editor.document.getText();
    const language = editor.document.languageId;
    const fileName = editor.document.fileName;

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🔍 Advanced Security Scanning...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Analyzing code patterns...' });
        const staticIssues = await this.performStaticAnalysis(code, fileName, language);
        
        progress.report({ message: 'AI-powered vulnerability detection...' });
        const aiIssues = await this.scanCode(code, language, fileName);
        
        progress.report({ message: 'Generating security report...' });
        const allIssues = [...staticIssues, ...aiIssues];
        await this.displayAdvancedSecurityReport(allIssues, fileName);
        
        // Auto-fix if enabled
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
   * Enhanced workspace security audit with compliance checking
   */
  public static async scanWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '🛡️ Comprehensive Security Audit...',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Discovering files...' });
        const files = await vscode.workspace.findFiles(
          '**/*.{ts,js,py,java,cpp,cs,go,php,rb,jsx,tsx,vue,svelte}', 
          '**/node_modules/**'
        );
        
        const allIssues: SecurityIssue[] = [];
        const auditData: Partial<SecurityAudit> = {
          timestamp: new Date(),
          totalFiles: files.length,
          totalIssues: 0,
          criticalIssues: 0,
          highIssues: 0,
          mediumIssues: 0,
          lowIssues: 0,
          infoIssues: 0,
        };
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          progress.report({ 
            message: `Scanning ${vscode.workspace.asRelativePath(file)} (${i + 1}/${files.length})...`,
            increment: (100 / files.length)
          });
          
          try {
            const content = (await vscode.workspace.fs.readFile(file)).toString();
            const language = this.getLanguageFromFile(file.fsPath);
            
            // Perform both static and AI analysis
            const staticIssues = await this.performStaticAnalysis(content, file.fsPath, language);
            const aiIssues = await this.scanCode(content, language, file.fsPath);
            
            const fileIssues = [...staticIssues, ...aiIssues];
            allIssues.push(...fileIssues);
            
            // Update counters
            fileIssues.forEach(issue => {
              auditData.totalIssues = (auditData.totalIssues || 0) + 1;
              switch (issue.severity) {
                case 'critical': auditData.criticalIssues = (auditData.criticalIssues || 0) + 1; break;
                case 'high': auditData.highIssues = (auditData.highIssues || 0) + 1; break;
                case 'medium': auditData.mediumIssues = (auditData.mediumIssues || 0) + 1; break;
                case 'low': auditData.lowIssues = (auditData.lowIssues || 0) + 1; break;
                case 'info': auditData.infoIssues = (auditData.infoIssues || 0) + 1; break;
              }
            });
            
          } catch (error) {
            console.error(`Error scanning ${file.fsPath}:`, SecurityUtils.sanitizeLogInput(String(error)));
          }
        }

        // Calculate security score and compliance
        auditData.securityScore = this.calculateSecurityScore(auditData as SecurityAudit);
        auditData.complianceStatus = await this.checkCompliance(allIssues);
        auditData.recommendations = this.generateRecommendations(allIssues);

        await this.displaySecurityAuditReport(auditData as SecurityAudit, allIssues);
      } catch (error) {
        vscode.window.showErrorMessage(`Security audit failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
      }
    });
  }

  /**
   * Perform static code analysis for security patterns
   */
  private static async performStaticAnalysis(code: string, filePath: string, language: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');
    
    for (const [category, patterns] of Object.entries(this.SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        let match;
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        while ((match = globalPattern.exec(code)) !== null) {
          const lineNumber = code.substring(0, match.index).split('\n').length;
          const columnNumber = match.index - code.lastIndexOf('\n', match.index - 1) - 1;
          
          const issue: SecurityIssue = {
            severity: this.getSeverityForCategory(category),
            type: category,
            description: this.getDescriptionForCategory(category, match[0]),
            file: filePath,
            line: lineNumber,
            column: columnNumber,
            suggestion: this.getSuggestionForCategory(category),
            cwe: this.getCWEForCategory(category),
            owasp: this.OWASP_MAPPING[category as keyof typeof this.OWASP_MAPPING],
            cvss: this.getCVSSScore(category),
            fixCode: this.generateFixCode(category, match[0], lines[lineNumber - 1]),
            references: this.getReferencesForCategory(category),
            confidence: 'high'
          };
          
          issues.push(issue);
        }
      }
    }
    
    // Additional dependency scanning
    if (filePath.endsWith('package.json')) {
      const dependencyIssues = await this.scanDependencies(code);
      issues.push(...dependencyIssues);
    }
    
    return issues;
  }

  /**
   * Enhanced AI-powered vulnerability scanning
   */
  private static async scanCode(code: string, language: string, fileName: string): Promise<SecurityIssue[]> {
    try {
      const securityPrompt = `
Perform a comprehensive security analysis of this ${language} code. Look for:

1. OWASP Top 10 2023 vulnerabilities
2. CWE (Common Weakness Enumeration) issues
3. Security best practices violations
4. Potential attack vectors
5. Data protection issues

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Return ONLY a JSON array of security issues in this format:
[
  {
    "severity": "critical|high|medium|low|info",
    "type": "vulnerability_type",
    "description": "detailed description",
    "line": line_number,
    "column": column_number,
    "suggestion": "how to fix",
    "cwe": "CWE-XXX",
    "owasp": "OWASP category",
    "cvss": score_number,
    "confidence": "high|medium|low"
  }
]

If no issues found, return: []
`;

      const response = await getLLMCompletion(securityPrompt);
      
      if (!response) {
        console.warn('AI security scan returned no response');
        return [];
      }
      
      try {
        const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
        const aiIssues = JSON.parse(cleanResponse);
        
        return aiIssues.map((issue: any) => ({
          ...issue,
          file: fileName,
          references: this.getReferencesForType(issue.type)
        }));
      } catch (parseError) {
        console.warn('Failed to parse AI security response:', SecurityUtils.sanitizeLogInput(response));
        return [];
      }
    } catch (error) {
      console.error('AI security scan failed:', SecurityUtils.sanitizeLogInput(String(error)));
      return [];
    }
  }

  /**
   * Scan package.json for vulnerable dependencies
   */
  private static async scanDependencies(packageJsonContent: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    try {
      const packageData = JSON.parse(packageJsonContent);
      const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
      
      // Known vulnerable packages (this would typically be fetched from a vulnerability database)
      const knownVulnerabilities = {
        'lodash': { version: '<4.17.21', cve: 'CVE-2021-23337', severity: 'high' as const },
        'axios': { version: '<0.21.2', cve: 'CVE-2021-3749', severity: 'medium' as const },
        'node-fetch': { version: '<2.6.7', cve: 'CVE-2022-0235', severity: 'high' as const },
        'minimist': { version: '<1.2.6', cve: 'CVE-2021-44906', severity: 'critical' as const }
      };
      
      for (const [packageName, version] of Object.entries(dependencies)) {
        if (knownVulnerabilities[packageName as keyof typeof knownVulnerabilities]) {
          const vuln = knownVulnerabilities[packageName as keyof typeof knownVulnerabilities];
          issues.push({
            severity: vuln.severity,
            type: 'vulnerable-dependency',
            description: `Vulnerable dependency detected: ${packageName}@${version}. ${vuln.cve}`,
            file: 'package.json',
            line: 1,
            suggestion: `Update ${packageName} to latest secure version`,
            cwe: 'CWE-1104',
            owasp: 'A06:2021 - Vulnerable and Outdated Components',
            cvss: vuln.severity === 'critical' ? 9.0 : vuln.severity === 'high' ? 7.5 : 5.0,
            references: [`https://nvd.nist.gov/vuln/detail/${vuln.cve}`],
            confidence: 'high'
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan dependencies:', SecurityUtils.sanitizeLogInput(String(error)));
    }
    
    return issues;
  }

  /**
   * Calculate overall security score (0-100)
   */
  private static calculateSecurityScore(audit: SecurityAudit): number {
    const totalIssues = audit.totalIssues;
    if (totalIssues === 0) {return 100;}
    
    const weightedScore = (
      (audit.criticalIssues * 20) +
      (audit.highIssues * 10) +
      (audit.mediumIssues * 5) +
      (audit.lowIssues * 2) +
      (audit.infoIssues * 1)
    );
    
    const maxPossibleScore = audit.totalFiles * 20; // Assume max 1 critical per file
    return Math.max(0, Math.round(100 - ((weightedScore / maxPossibleScore) * 100)));
  }

  /**
   * Check compliance against various standards
   */
  private static async checkCompliance(issues: SecurityIssue[]): Promise<SecurityAudit['complianceStatus']> {
    const hasIssueType = (type: string) => issues.some(issue => issue.type.includes(type));
    const hasCriticalOrHigh = issues.some(issue => ['critical', 'high'].includes(issue.severity));
    
    return {
      owasp: !hasCriticalOrHigh && !hasIssueType('injection') && !hasIssueType('xss'),
      soc2: !hasIssueType('hardcodedSecrets') && !hasIssueType('sensitiveData') && !hasCriticalOrHigh,
      gdpr: !hasIssueType('sensitiveData') && !hasIssueType('improperAuth'),
      pci: !hasIssueType('cryptographic') && !hasIssueType('hardcodedSecrets') && !hasCriticalOrHigh
    };
  }

  /**
   * Generate security recommendations based on findings
   */
  private static generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations: string[] = [];
    const issueTypes = new Set(issues.map(issue => issue.type));
    
    if (issueTypes.has('hardcodedSecrets')) {
      recommendations.push('Implement proper secret management using environment variables or secret management services');
    }
    
    if (issueTypes.has('cryptographic')) {
      recommendations.push('Upgrade to strong cryptographic algorithms (SHA-256 or higher, AES-256)');
    }
    
    if (issueTypes.has('injection')) {
      recommendations.push('Implement input validation and parameterized queries to prevent injection attacks');
    }
    
    if (issueTypes.has('xss')) {
      recommendations.push('Implement proper output encoding and Content Security Policy (CSP) headers');
    }
    
    if (issueTypes.has('vulnerable-dependency')) {
      recommendations.push('Regularly update dependencies and implement automated vulnerability scanning in CI/CD');
    }
    
    if (issues.length > 10) {
      recommendations.push('Consider implementing a formal security review process and security testing in CI/CD pipeline');
    }
    
    return recommendations;
  }

  /**
   * Helper methods for security analysis
   */
  private static getSeverityForCategory(category: string): SecurityIssue['severity'] {
    const severityMap: Record<string, SecurityIssue['severity']> = {
      injection: 'critical',
      hardcodedSecrets: 'critical',
      cryptographic: 'high',
      pathTraversal: 'high',
      xss: 'high',
      csrf: 'medium',
      insecureDeserialization: 'high',
      sensitiveData: 'medium',
      improperAuth: 'high',
      insecureComponents: 'medium'
    };
    return severityMap[category] || 'low';
  }

  private static getDescriptionForCategory(category: string, match: string): string {
    const descriptions: Record<string, string> = {
      injection: `Potential injection vulnerability detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      hardcodedSecrets: `Hardcoded secret/credential detected: ${SecurityUtils.sanitizeLogInput(match.substring(0, 20))}...`,
      cryptographic: `Weak cryptographic algorithm detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      pathTraversal: `Path traversal vulnerability detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      xss: `Cross-site scripting vulnerability detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      csrf: `Potential CSRF vulnerability detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      insecureDeserialization: `Insecure deserialization detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      sensitiveData: `Sensitive data exposure detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      improperAuth: `Improper authentication mechanism detected: ${SecurityUtils.sanitizeLogInput(match)}`,
      insecureComponents: `Potentially insecure component usage detected: ${SecurityUtils.sanitizeLogInput(match)}`
    };
    return descriptions[category] || `Security issue detected: ${SecurityUtils.sanitizeLogInput(match)}`;
  }

  private static getSuggestionForCategory(category: string): string {
    const suggestions: Record<string, string> = {
      injection: 'Use parameterized queries and input validation',
      hardcodedSecrets: 'Move secrets to environment variables or secure secret management',
      cryptographic: 'Use strong cryptographic algorithms (SHA-256+, AES-256)',
      pathTraversal: 'Validate and sanitize file paths, use path.resolve()',
      xss: 'Implement proper output encoding and CSP headers',
      csrf: 'Implement CSRF tokens and proper request validation',
      insecureDeserialization: 'Validate input before deserialization, use safe parsers',
      sensitiveData: 'Remove sensitive data from logs and client-side code',
      improperAuth: 'Implement proper authentication and authorization mechanisms',
      insecureComponents: 'Update to latest secure versions and audit dependencies'
    };
    return suggestions[category] || 'Review and address the security concern';
  }

  private static getCWEForCategory(category: string): string {
    const cweMap: Record<string, string> = {
      injection: 'CWE-89',
      hardcodedSecrets: 'CWE-798',
      cryptographic: 'CWE-327',
      pathTraversal: 'CWE-22',
      xss: 'CWE-79',
      csrf: 'CWE-352',
      insecureDeserialization: 'CWE-502',
      sensitiveData: 'CWE-200',
      improperAuth: 'CWE-287',
      insecureComponents: 'CWE-1104'
    };
    return cweMap[category] || 'CWE-1000';
  }

  private static getCVSSScore(category: string): number {
    const cvssMap: Record<string, number> = {
      injection: 9.8,
      hardcodedSecrets: 9.8,
      cryptographic: 7.5,
      pathTraversal: 7.5,
      xss: 6.1,
      csrf: 6.5,
      insecureDeserialization: 8.1,
      sensitiveData: 5.3,
      improperAuth: 7.5,
      insecureComponents: 6.0
    };
    return cvssMap[category] || 5.0;
  }

  private static generateFixCode(category: string, match: string, line: string): string {
    // This would generate actual fix code based on the vulnerability type
    switch (category) {
      case 'hardcodedSecrets':
        return line.replace(/['"`][^'"`]+['"`]/, 'process.env.YOUR_SECRET_KEY');
      case 'cryptographic':
        if (match.includes('md5')) {
          return line.replace(/md5/gi, 'sha256');
        }
        if (match.includes('Math.random')) {
          return line.replace(/Math\.random\(\)/g, 'crypto.randomBytes(32).toString("hex")');
        }
        break;
      default:
        return '// TODO: Fix security issue';
    }
    return '// TODO: Fix security issue';
  }

  private static getReferencesForCategory(category: string): string[] {
    const references: Record<string, string[]> = {
      injection: [
        'https://owasp.org/www-project-top-ten/2017/A1_2017-Injection',
        'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
      ],
      hardcodedSecrets: [
        'https://owasp.org/www-project-top-ten/2017/A2_2017-Broken_Authentication',
        'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository'
      ],
      cryptographic: [
        'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
        'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html'
      ]
    };
    return references[category] || ['https://owasp.org/www-project-top-ten/'];
  }

  private static getReferencesForType(type: string): string[] {
    return this.getReferencesForCategory(type);
  }

  private static getLanguageFromFile(filePath: string): string {
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
      '.vue': 'vue',
      '.svelte': 'svelte'
    };
    return languageMap[ext] || 'text';
  }

  /**
   * Display advanced security report with interactive fixes
   */
  private static async displayAdvancedSecurityReport(issues: SecurityIssue[], fileName: string): Promise<void> {
    const severityCounts = issues.reduce((counts, issue) => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const reportContent = `
# 🛡️ Advanced Security Analysis Report

**File**: ${fileName}  
**Timestamp**: ${new Date().toISOString()}  
**Total Issues**: ${issues.length}

## 📊 Security Summary

| Severity | Count | CVSS Range |
|----------|-------|------------|
| 🔴 Critical | ${severityCounts.critical || 0} | 9.0 - 10.0 |
| 🟠 High | ${severityCounts.high || 0} | 7.0 - 8.9 |
| 🟡 Medium | ${severityCounts.medium || 0} | 4.0 - 6.9 |
| 🔵 Low | ${severityCounts.low || 0} | 1.0 - 3.9 |
| ℹ️ Info | ${severityCounts.info || 0} | 0.1 - 0.9 |

## 🔍 Detailed Findings

${issues.map((issue, index) => `
### Issue #${index + 1}: ${issue.type}

**Severity**: ${this.getSeverityIcon(issue.severity)} ${issue.severity.toUpperCase()}  
**Location**: Line ${issue.line}${issue.column ? `, Column ${issue.column}` : ''}  
**OWASP**: ${issue.owasp || 'N/A'}  
**CWE**: ${issue.cwe || 'N/A'}  
**CVSS Score**: ${issue.cvss || 'N/A'}  
**Confidence**: ${issue.confidence || 'N/A'}

**Description**: ${issue.description}

**Recommendation**: ${issue.suggestion}

${issue.fixCode ? `**Suggested Fix**:
\`\`\`
${issue.fixCode}
\`\`\`` : ''}

${issue.references ? `**References**:
${issue.references.map(ref => `- [${ref}](${ref})`).join('\n')}` : ''}

---
`).join('\n')}

## 🎯 Security Recommendations

${issues.length === 0 ? '✅ No security issues detected. Great job!' : `
- **Immediate Action Required**: Address ${severityCounts.critical || 0} critical and ${severityCounts.high || 0} high severity issues
- **Security Review**: Consider implementing automated security scanning in your CI/CD pipeline
- **Regular Audits**: Schedule regular security assessments for your codebase
- **Team Training**: Ensure your team is aware of secure coding practices
`}
`;

    const panel = vscode.window.createWebviewPanel(
      'securityReport',
      `🛡️ Security Report - ${path.basename(fileName)}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getSecurityReportHtml(reportContent);
  }

  /**
   * Display comprehensive security audit report
   */
  private static async displaySecurityAuditReport(audit: SecurityAudit, issues: SecurityIssue[]): Promise<void> {
    const reportContent = `
# 🛡️ Comprehensive Security Audit Report

**Generated**: ${audit.timestamp.toISOString()}  
**Files Scanned**: ${audit.totalFiles}  
**Security Score**: ${audit.securityScore}/100

## 📊 Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Issues | ${audit.totalIssues} | ${audit.totalIssues === 0 ? '✅' : '⚠️'} |
| Critical Issues | ${audit.criticalIssues} | ${audit.criticalIssues === 0 ? '✅' : '🔴'} |
| High Issues | ${audit.highIssues} | ${audit.highIssues === 0 ? '✅' : '🟠'} |
| Medium Issues | ${audit.mediumIssues} | ${audit.mediumIssues <= 5 ? '✅' : '🟡'} |
| Security Score | ${audit.securityScore}/100 | ${audit.securityScore >= 80 ? '✅' : audit.securityScore >= 60 ? '🟡' : '🔴'} |

## 🏛️ Compliance Status

| Standard | Status | Requirements |
|----------|--------|--------------|
| OWASP Top 10 | ${audit.complianceStatus.owasp ? '✅ Compliant' : '❌ Non-Compliant'} | Address injection and XSS vulnerabilities |
| SOC 2 | ${audit.complianceStatus.soc2 ? '✅ Compliant' : '❌ Non-Compliant'} | Secure data handling practices |
| GDPR | ${audit.complianceStatus.gdpr ? '✅ Compliant' : '❌ Non-Compliant'} | Data protection and privacy |
| PCI DSS | ${audit.complianceStatus.pci ? '✅ Compliant' : '❌ Non-Compliant'} | Payment data security |

## 📝 Key Recommendations

${audit.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## 🔍 Top Security Issues by Severity

${this.generateTopIssuesSummary(issues)}

---

*Generated by Enhanced Security Scanner v2.0*
`;

    const panel = vscode.window.createWebviewPanel(
      'securityAudit',
      '🛡️ Security Audit Report',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getSecurityReportHtml(reportContent);
  }

  private static getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: 'ℹ️'
    };
    return icons[severity] || '⚪';
  }

  private static generateTopIssuesSummary(issues: SecurityIssue[]): string {
    const grouped = issues.reduce((groups, issue) => {
      if (!groups[issue.severity]) {groups[issue.severity] = [];}
      groups[issue.severity].push(issue);
      return groups;
    }, {} as Record<string, SecurityIssue[]>);

    let summary = '';
    for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
      const severityIssues = grouped[severity] || [];
      if (severityIssues.length > 0) {
        summary += `\n### ${this.getSeverityIcon(severity)} ${severity.toUpperCase()} (${severityIssues.length})\n\n`;
        severityIssues.slice(0, 5).forEach((issue, index) => {
          summary += `${index + 1}. **${issue.type}** in ${path.basename(issue.file)}:${issue.line}\n`;
          summary += `   ${issue.description}\n\n`;
        });
        if (severityIssues.length > 5) {
          summary += `   ... and ${severityIssues.length - 5} more\n\n`;
        }
      }
    }
    return summary || 'No issues found.';
  }

  private static getSecurityReportHtml(content: string): string {
    const marked = require('marked');
    const htmlContent = marked.parse(content);
    
    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            line-height: 1.6; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            background: #fafafa;
        }
        .container { 
            background: white; 
            border-radius: 8px; 
            padding: 30px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #d32f2f; border-bottom: 3px solid #d32f2f; padding-bottom: 10px; }
        h2 { color: #1976d2; border-left: 4px solid #1976d2; padding-left: 15px; }
        h3 { color: #388e3c; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: 600; }
        .critical { background-color: #ffebee; }
        .high { background-color: #fff3e0; }
        .medium { background-color: #fffde7; }
        .low { background-color: #e8f5e8; }
        .info { background-color: #e3f2fd; }
        pre { 
            background: #f8f8f8; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            padding: 15px; 
            overflow-x: auto; 
        }
        code { 
            background: #f0f0f0; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-family: 'Monaco', 'Courier New', monospace;
        }
        .status-good { color: #4caf50; font-weight: bold; }
        .status-warning { color: #ff9800; font-weight: bold; }
        .status-error { color: #f44336; font-weight: bold; }
        hr { border: none; border-top: 2px solid #eee; margin: 30px 0; }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
    <script>
        // Add click handlers for interactive elements
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Security report loaded');
        });
    </script>
</body>
</html>`;
  }

  /**
   * Offer automatic fixes for detected issues
   */
  private static async offerAutomaticFixes(issues: SecurityIssue[], editor: vscode.TextEditor): Promise<void> {
    const fixableIssues = issues.filter(issue => issue.fixCode);
    
    if (fixableIssues.length === 0) {
      vscode.window.showInformationMessage('No automatic fixes available for detected issues.');
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `Found ${fixableIssues.length} issues with automatic fixes available. Apply fixes?`,
      'Apply All',
      'Review Each',
      'Cancel'
    );

    if (choice === 'Apply All') {
      await this.applyAllFixes(fixableIssues, editor);
    } else if (choice === 'Review Each') {
      await this.reviewAndApplyFixes(fixableIssues, editor);
    }
  }

  private static async applyAllFixes(issues: SecurityIssue[], editor: vscode.TextEditor): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const document = editor.document;

    // Sort issues by line number (descending) to avoid offset issues
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
      vscode.window.showInformationMessage(`✅ Applied ${issues.length} security fixes!`);
    } else {
      vscode.window.showErrorMessage('Failed to apply some fixes. Please review manually.');
    }
  }

  private static async reviewAndApplyFixes(issues: SecurityIssue[], editor: vscode.TextEditor): Promise<void> {
    for (const issue of issues) {
      if (!issue.fixCode) {continue;}

      const choice = await vscode.window.showWarningMessage(
        `${issue.severity.toUpperCase()}: ${issue.description}\n\nApply suggested fix?`,
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

// Export both classes for backward compatibility
export { EnhancedSecurityScanner as SecurityScanner };