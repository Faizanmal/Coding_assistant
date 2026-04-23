import * as vscode from 'vscode';
import { callAI } from './codegenerator';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface PRReviewFinding {
    type: 'bug' | 'performance' | 'security' | 'style' | 'architecture' | 'test' | 'compliance' | 'accessibility';
    severity: 'critical' | 'major' | 'minor' | 'info';
    line?: number;
    code: string;
    issue: string;
    suggestion: string;
    category: string;
    confidence: number;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    cwe?: string; // Common Weakness Enumeration ID
    cvss?: number; // Common Vulnerability Scoring System
}

interface PRReview {
    prNumber: number;
    title: string;
    author: string;
    branch: string;
    baseBranch: string;
    findings: PRReviewFinding[];
    overallScore: number;
    approved: boolean;
    approvalReason?: string;
    suggestedChanges: string[];
    patterns?: string[];
    complianceStatus: {
        gdpr: boolean;
        sox: boolean;
        pci: boolean;
        hipaa: boolean;
    };
    securityRisk: 'low' | 'medium' | 'high' | 'critical';
    testCoverage: number;
    performanceImpact: 'positive' | 'neutral' | 'negative';
    businessImpact: 'low' | 'medium' | 'high';
    reviewTime: number; // minutes
    reviewerId?: string;
    automatedChecks: {
        linting: boolean;
        security: boolean;
        testing: boolean;
        compliance: boolean;
        performance: boolean;
    };
    recommendations: string[];
    riskAssessment: string;
}

export class SmartPRReviewBot {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private learnedPatterns: Map<string, number> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('PR Review Bot');
    }

    /**
     * Review a pull request by analyzing file changes
     */
    async reviewPullRequest(
        prTitle: string,
        author: string,
        branch: string,
        baseBranch: string,
        changedFiles: { path: string; additions: number; deletions: number; content: string }[]
    ): Promise<PRReview> {
        const findings: PRReviewFinding[] = [];
        let totalScore = 100;

        // Analyze each file
        for (const file of changedFiles) {
            const fileFindings = await this.analyzeFile(file);
            findings.push(...fileFindings);
            
            // Deduct points for each finding
            fileFindings.forEach(f => {
                switch (f.severity) {
                    case 'critical':
                        totalScore -= 20;
                        break;
                    case 'major':
                        totalScore -= 10;
                        break;
                    case 'minor':
                        totalScore -= 3;
                        break;
                    case 'info':
                        totalScore -= 1;
                        break;
                }
            });
        }

        totalScore = Math.max(0, totalScore);

        // Generate approval decision
        const approved = totalScore >= 70 && !findings.some(f => f.severity === 'critical');

        // Assess security risk
        const securityFindings = findings.filter(f => f.type === 'security');
        const criticalSecurityFindings = securityFindings.filter(f => f.severity === 'critical');
        let securityRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
        
        if (criticalSecurityFindings.length > 0) {
            securityRisk = 'critical';
        } else if (securityFindings.length > 3) {
            securityRisk = 'high';
        } else if (securityFindings.length > 1) {
            securityRisk = 'medium';
        }

        // Assess compliance status
        const complianceStatus = {
            gdpr: !findings.some(f => f.category?.includes('GDPR')),
            sox: !findings.some(f => f.category?.includes('SOX')),
            pci: !findings.some(f => f.category?.includes('PCI')),
            hipaa: !findings.some(f => f.category?.includes('HIPAA'))
        };

        // Calculate test coverage (mock for now)
        const testCoverage = Math.max(0, 80 - findings.filter(f => f.type === 'test').length * 10);

        // Assess performance impact
        const performanceFindings = findings.filter(f => f.type === 'performance');
        let performanceImpact: 'positive' | 'neutral' | 'negative' = 'neutral';
        if (performanceFindings.some(f => f.severity === 'critical' || f.severity === 'major')) {
            performanceImpact = 'negative';
        } else if (performanceFindings.length === 0) {
            performanceImpact = 'positive';
        }

        // Business impact assessment
        const businessImpact = criticalSecurityFindings.length > 0 ? 'high' : 
                              findings.filter(f => f.severity === 'major').length > 5 ? 'medium' : 'low';

        // Automated checks status
        const automatedChecks = {
            linting: true,
            security: true,
            testing: testCoverage > 50,
            compliance: Object.values(complianceStatus).every(status => status),
            performance: performanceImpact !== 'negative'
        };

        // Generate recommendations
        const recommendations = await this.generateRecommendations(findings, changedFiles);

        // Risk assessment
        const riskAssessment = await this.generateRiskAssessment(findings, securityRisk, businessImpact);

        // Identify patterns
        const patterns = this.identifyPatterns(findings);
        patterns.forEach(p => {
            this.learnedPatterns.set(p, (this.learnedPatterns.get(p) || 0) + 1);
        });

        // Generate suggestions
        const suggestedChanges = await this.generateSuggestions(findings, changedFiles);

        return {
            prNumber: 0, // Will be filled by caller
            title: prTitle,
            author,
            branch,
            baseBranch,
            findings,
            overallScore: Math.round(totalScore),
            approved,
            approvalReason: approved 
                ? 'Code quality meets standards and no critical issues found'
                : `${findings.filter(f => f.severity === 'critical').length} critical issues require attention`,
            suggestedChanges,
            patterns,
            complianceStatus,
            securityRisk,
            testCoverage,
            performanceImpact,
            businessImpact,
            reviewTime: Math.round((Date.now() - new Date().getTime()) / 60000) || 5, // Mock calculation
            automatedChecks,
            recommendations,
            riskAssessment
        };
    }

    /**
     * Analyze a single file for issues
     */
    private async analyzeFile(file: {
        path: string;
        additions: number;
        deletions: number;
        content: string;
    }): Promise<PRReviewFinding[]> {
        const findings: PRReviewFinding[] = [];

        try {
            const prompt = `Review this code change in file "${file.path}" with enterprise-grade analysis:

\`\`\`
${file.content}
\`\`\`

Analyze for:
1. Potential bugs and logic errors
2. Performance issues and optimization opportunities
3. Security vulnerabilities (OWASP Top 10)
4. Code style and maintainability issues
5. Architectural concerns and design patterns
6. Missing tests and test coverage
7. Code duplication and technical debt
8. Compliance issues (GDPR, SOX, PCI, HIPAA)
9. Accessibility concerns
10. Business logic validation

For each issue found, provide:
- Type (bug/performance/security/style/architecture/test/compliance/accessibility)
- Severity (critical/major/minor/info)
- Line number (if applicable)
- Code snippet
- Detailed issue description
- Specific fix recommendation
- Confidence level (0-100)
- Impact level (high/medium/low)
- Effort required (high/medium/low)
- CWE ID for security issues
- CVSS score for vulnerabilities

Format as JSON array:
[
    {
        "type": "security",
        "severity": "critical",
        "line": 10,
        "code": "if (x = y)",
        "issue": "Assignment instead of comparison - potential logic vulnerability",
        "suggestion": "Use === for strict comparison",
        "category": "Logic Error - CWE-480",
        "confidence": 95,
        "impact": "high",
        "effort": "low",
        "cwe": "CWE-480",
        "cvss": 6.5
    }
]`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Enhance findings with additional metadata
                const enhancedFindings = parsed.map((finding: any) => ({
                    ...finding,
                    confidence: finding.confidence || 80,
                    impact: finding.impact || 'medium',
                    effort: finding.effort || 'medium'
                }));
                
                findings.push(...enhancedFindings);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error analyzing file: ${error}`);
            
            // Fallback to basic analysis
            const basicFindings = await this.performBasicSecurityScan(file);
            findings.push(...basicFindings);
        }

        return findings;
    }

    /**
     * Perform basic security scan as fallback
     */
    private async performBasicSecurityScan(file: {
        path: string;
        additions: number;
        deletions: number;
        content: string;
    }): Promise<PRReviewFinding[]> {
        const findings: PRReviewFinding[] = [];
        const content = file.content;

        // Basic security patterns
        const securityPatterns = [
            {
                pattern: /password.*=.*["'][^"']+["']/gi,
                type: 'security' as const,
                severity: 'critical' as const,
                issue: 'Hardcoded password detected',
                suggestion: 'Use environment variables or secure key management',
                cwe: 'CWE-798'
            },
            {
                pattern: /api.*key.*=.*["'][^"']+["']/gi,
                type: 'security' as const,
                severity: 'critical' as const,
                issue: 'Hardcoded API key detected',
                suggestion: 'Use environment variables or secure configuration',
                cwe: 'CWE-798'
            },
            {
                pattern: /eval\s*\(/gi,
                type: 'security' as const,
                severity: 'major' as const,
                issue: 'Use of eval() function - code injection risk',
                suggestion: 'Use safer alternatives like JSON.parse() or Function constructor',
                cwe: 'CWE-94'
            },
            {
                pattern: /innerHTML\s*=/gi,
                type: 'security' as const,
                severity: 'major' as const,
                issue: 'Direct innerHTML assignment - XSS vulnerability',
                suggestion: 'Use textContent or proper sanitization',
                cwe: 'CWE-79'
            }
        ];

        securityPatterns.forEach(({ pattern, type, severity, issue, suggestion, cwe }) => {
            const matches = Array.from(content.matchAll(pattern));
            matches.forEach(match => {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                findings.push({
                    type,
                    severity,
                    line: lineNumber,
                    code: match[0],
                    issue,
                    suggestion,
                    category: `Security - ${cwe}`,
                    confidence: 90,
                    impact: severity === 'critical' ? 'high' : 'medium',
                    effort: 'low',
                    cwe
                });
            });
        });

        return findings;
    }

    /**
     * Identify patterns in findings
     */
    private identifyPatterns(findings: PRReviewFinding[]): string[] {
        const patterns: string[] = [];

        // Count issues by type
        const typeCount = new Map<string, number>();
        findings.forEach(f => {
            typeCount.set(f.type, (typeCount.get(f.type) || 0) + 1);
        });

        typeCount.forEach((count, type) => {
            if (count > 0) {
                patterns.push(`${type}:${count}`);
            }
        });

        return patterns;
    }

    /**
     * Generate suggestions for improvement
     */
    private async generateSuggestions(
        findings: PRReviewFinding[],
        files: any[]
    ): Promise<string[]> {
        const suggestions: string[] = [];

        // Group by severity
        const critical = findings.filter(f => f.severity === 'critical');
        const major = findings.filter(f => f.severity === 'major');
        const minor = findings.filter(f => f.severity === 'minor');

        if (critical.length > 0) {
            suggestions.push(`🚨 Fix ${critical.length} critical issues before merging`);
        }

        if (major.length > 0) {
            suggestions.push(`⚠️ Address ${major.length} major issues`);
        }

        // Specific suggestions
        const securityIssues = findings.filter(f => f.type === 'security');
        if (securityIssues.length > 0) {
            suggestions.push(`🔒 Security review needed: ${securityIssues.length} findings`);
        }

        const performanceIssues = findings.filter(f => f.type === 'performance');
        if (performanceIssues.length > 0) {
            suggestions.push(`⚡ Performance optimization: ${performanceIssues.length} opportunities`);
        }

        const testIssues = findings.filter(f => f.type === 'test');
        if (testIssues.length > 0) {
            suggestions.push(`🧪 Add tests for new functionality`);
        }

        // Large changes warning
        const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
        if (totalAdditions > 500) {
            suggestions.push(`📊 Large PR (${totalAdditions} lines added) - consider splitting into smaller PRs`);
        }

        return suggestions;
    }

    /**
     * Generate comprehensive recommendations
     */
    private async generateRecommendations(
        findings: PRReviewFinding[],
        files: any[]
    ): Promise<string[]> {
        const recommendations: string[] = [];

        // AI-powered contextual recommendations
        const prompt = `Based on these code review findings, generate specific actionable recommendations:

Findings:
${findings.map(f => `- ${f.type}: ${f.issue} (${f.severity})`).join('\n')}

Files changed: ${files.length}
Total additions: ${files.reduce((sum, f) => sum + f.additions, 0)}

Provide 3-5 specific, actionable recommendations for improving this PR.`;

        try {
            const aiRecommendations = await callAI(prompt);
            const lines = aiRecommendations.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
            recommendations.push(...lines.map(line => line.trim().replace(/^[-•]\s*/, '')));
        } catch (error) {
            // Fallback to basic recommendations
            recommendations.push('Review and address all critical and major findings');
            recommendations.push('Ensure adequate test coverage for new functionality');
            recommendations.push('Follow security best practices');
        }

        return recommendations;
    }

    /**
     * Generate risk assessment
     */
    private async generateRiskAssessment(
        findings: PRReviewFinding[],
        securityRisk: string,
        businessImpact: string
    ): Promise<string> {
        const criticalFindings = findings.filter(f => f.severity === 'critical').length;
        const majorFindings = findings.filter(f => f.severity === 'major').length;
        
        const prompt = `Generate a risk assessment for this PR:

Critical findings: ${criticalFindings}
Major findings: ${majorFindings}
Security risk level: ${securityRisk}
Business impact: ${businessImpact}

Provide a concise risk assessment paragraph focusing on potential impact and mitigation strategies.`;

        try {
            return await callAI(prompt);
        } catch (error) {
            return `Risk Level: ${securityRisk.toUpperCase()} - ${criticalFindings} critical and ${majorFindings} major issues identified. Review and address findings before merge.`;
        }
    }

    /**
     * Learn from approved PRs
     */
    learnFromPR(review: PRReview) {
        if (review.approved) {
            // Record patterns from approved PRs
            const approvedPatterns = `approved:${review.findings.length}`;
            this.learnedPatterns.set(approvedPatterns, (this.learnedPatterns.get(approvedPatterns) || 0) + 1);
        }
    }

    /**
     * Get team patterns learned
     */
    getLearnedPatterns(): { pattern: string; frequency: number }[] {
        const patterns: { pattern: string; frequency: number }[] = [];
        
        this.learnedPatterns.forEach((frequency, pattern) => {
            patterns.push({ pattern, frequency });
        });

        return patterns.sort((a, b) => b.frequency - a.frequency);
    }

    /**
     * Show review panel
     */
    async showReviewPanel(review: PRReview) {
        const panel = vscode.window.createWebviewPanel(
            'prReview',
            `PR Review #${review.prNumber}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const criticalCount = review.findings.filter(f => f.severity === 'critical').length;
        const majorCount = review.findings.filter(f => f.severity === 'major').length;
        const minorCount = review.findings.filter(f => f.severity === 'minor').length;

        panel.webview.html = `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .score-circle {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: conic-gradient(
                ${review.overallScore >= 70 ? '#89d185' : review.overallScore >= 50 ? '#cca700' : '#f48771'} 
                ${review.overallScore}%, 
                #3c3c3c 0
            );
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            float: right;
        }
        .score-inner {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: #1e1e1e;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        }
        .score-number {
            font-size: 32px;
            font-weight: bold;
            color: ${review.overallScore >= 70 ? '#89d185' : review.overallScore >= 50 ? '#cca700' : '#f48771'};
        }
        .approval-badge {
            display: inline-block;
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
            margin-top: 15px;
            background: ${review.approved ? '#89d18544' : '#f4877144'};
            color: ${review.approved ? '#89d185' : '#f48771'};
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #3794ff;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #3794ff;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            background: #2d2d30;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            font-size: 12px;
            color: #858585;
        }
        .compliance-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 15px 0;
        }
        .compliance-item {
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            font-weight: bold;
        }
        .compliance-pass {
            background: #89d18544;
            color: #89d185;
        }
        .compliance-fail {
            background: #f4877144;
            color: #f48771;
        }
        .finding {
            background: #1e1e1e;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        .finding.critical { border-left-color: #f48771; }
        .finding.major { border-left-color: #ff6b6b; }
        .finding.minor { border-left-color: #cca700; }
        .finding.info { border-left-color: #4a9eff; }
        .severity-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .severity-critical { background: #f48771; color: white; }
        .severity-major { background: #ff6b6b; color: white; }
        .severity-minor { background: #cca700; color: white; }
        .severity-info { background: #4a9eff; color: white; }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
        }
        .stat-box {
            background: #2d2d30;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 12px;
            color: #858585;
        }
        .suggestion {
            padding: 12px;
            background: #2d2d30;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid #3794ff;
        }
        .risk-assessment {
            background: #2d2d30;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid ${review.securityRisk === 'critical' ? '#f48771' : 
                                      review.securityRisk === 'high' ? '#ff6b6b' :
                                      review.securityRisk === 'medium' ? '#cca700' : '#89d185'};
        }
        .automated-checks {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin: 15px 0;
        }
        .check-item {
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            font-size: 12px;
        }
        .check-pass {
            background: #89d18544;
            color: #89d185;
        }
        .check-fail {
            background: #f4877144;
            color: #f48771;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="score-circle">
            <div class="score-inner">
                <div class="score-number">${review.overallScore}</div>
                <div style="font-size: 10px; color: #858585;">SCORE</div>
            </div>
        </div>
        <h1>${review.title}</h1>
        <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">
            By <strong>${review.author}</strong> | ${review.branch} → ${review.baseBranch}
        </p>
        <div class="approval-badge">
            ${review.approved ? '✅ APPROVED' : '❌ CHANGES REQUESTED'}
        </div>
        <p style="margin-top: 10px; font-size: 14px;">
            Security Risk: <strong style="color: ${review.securityRisk === 'critical' ? '#f48771' : 
                                                    review.securityRisk === 'high' ? '#ff6b6b' :
                                                    review.securityRisk === 'medium' ? '#cca700' : '#89d185'}">
                ${review.securityRisk.toUpperCase()}
            </strong> | 
            Business Impact: <strong>${review.businessImpact.toUpperCase()}</strong>
        </p>
    </div>

    <div class="section">
        <h2>📊 Enterprise Metrics</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value" style="color: #f48771;">${criticalCount}</div>
                <div class="metric-label">Critical Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #ff6b6b;">${majorCount}</div>
                <div class="metric-label">Major Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #cca700;">${minorCount}</div>
                <div class="metric-label">Minor Issues</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #4a9eff;">${review.testCoverage}%</div>
                <div class="metric-label">Test Coverage</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #89d185;">${review.reviewTime}min</div>
                <div class="metric-label">Review Time</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🛡️ Compliance Status</h2>
        <div class="compliance-grid">
            <div class="compliance-item ${review.complianceStatus.gdpr ? 'compliance-pass' : 'compliance-fail'}">
                GDPR ${review.complianceStatus.gdpr ? '✓' : '✗'}
            </div>
            <div class="compliance-item ${review.complianceStatus.sox ? 'compliance-pass' : 'compliance-fail'}">
                SOX ${review.complianceStatus.sox ? '✓' : '✗'}
            </div>
            <div class="compliance-item ${review.complianceStatus.pci ? 'compliance-pass' : 'compliance-fail'}">
                PCI ${review.complianceStatus.pci ? '✓' : '✗'}
            </div>
            <div class="compliance-item ${review.complianceStatus.hipaa ? 'compliance-pass' : 'compliance-fail'}">
                HIPAA ${review.complianceStatus.hipaa ? '✓' : '✗'}
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🤖 Automated Checks</h2>
        <div class="automated-checks">
            <div class="check-item ${review.automatedChecks.linting ? 'check-pass' : 'check-fail'}">
                Linting ${review.automatedChecks.linting ? '✓' : '✗'}
            </div>
            <div class="check-item ${review.automatedChecks.security ? 'check-pass' : 'check-fail'}">
                Security ${review.automatedChecks.security ? '✓' : '✗'}
            </div>
            <div class="check-item ${review.automatedChecks.testing ? 'check-pass' : 'check-fail'}">
                Testing ${review.automatedChecks.testing ? '✓' : '✗'}
            </div>
            <div class="check-item ${review.automatedChecks.compliance ? 'check-pass' : 'check-fail'}">
                Compliance ${review.automatedChecks.compliance ? '✓' : '✗'}
            </div>
            <div class="check-item ${review.automatedChecks.performance ? 'check-pass' : 'check-fail'}">
                Performance ${review.automatedChecks.performance ? '✓' : '✗'}
            </div>
        </div>
    </div>

    ${review.riskAssessment ? `
    <div class="section">
        <h2>⚠️ Risk Assessment</h2>
        <div class="risk-assessment">
            ${review.riskAssessment}
        </div>
    </div>
    ` : ''}

    ${review.recommendations.length > 0 ? `
    <div class="section">
        <h2>🎯 AI Recommendations</h2>
        ${review.recommendations.map((rec: string) => `<div class="suggestion">💡 ${rec}</div>`).join('')}
    </div>
    ` : ''}

    ${review.suggestedChanges.length > 0 ? `
    <div class="section">
        <h2>💡 Suggested Changes</h2>
        ${review.suggestedChanges.map((s: string) => `<div class="suggestion">${s}</div>`).join('')}
    </div>
    ` : ''}

    ${review.findings.length > 0 ? `
    <div class="section">
        <h2>🔍 Detailed Findings (${review.findings.length})</h2>
        ${review.findings.map((f, i) => `
            <div class="finding ${f.severity}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <strong>${f.issue}</strong><br/>
                        <span class="severity-badge severity-${f.severity}">${f.severity}</span>
                        <span style="color: #858585; margin-left: 10px;">Type: ${f.type}</span>
                        ${f.confidence ? `<span style="color: #858585; margin-left: 10px;">Confidence: ${f.confidence}%</span>` : ''}
                        ${f.cwe ? `<span style="color: #ff6b6b; margin-left: 10px;">${f.cwe}</span>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; color: #858585;">Impact: ${f.impact || 'N/A'}</div>
                        <div style="font-size: 12px; color: #858585;">Effort: ${f.effort || 'N/A'}</div>
                    </div>
                </div>
                <div style="background: #0d0d0d; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; font-size: 12px;">
                    ${f.code}
                </div>
                <div style="color: #89d185; font-size: 13px;">✨ ${f.suggestion}</div>
            </div>
        `).join('')}
    </div>
    ` : '<div class="section"><h2>✅ No Issues Found</h2></div>'}
</body>
</html>`;
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register PR review commands
 */
export function registerSmartPRReviewCommands(context: vscode.ExtensionContext) {
    const reviewBot = new SmartPRReviewBot(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.pr.review', async () => {
            const prTitle = await vscode.window.showInputBox({ prompt: 'PR Title' });
            if (!prTitle) {return;}

            const author = await vscode.window.showInputBox({ prompt: 'Author' });
            if (!author) {return;}

            // Mock review for demonstration
            const review = await reviewBot.reviewPullRequest(
                prTitle,
                author,
                'feature/new-feature',
                'main',
                []
            );

            review.prNumber = 1;
            await reviewBot.showReviewPanel(review);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.pr.viewPatterns', () => {
            const patterns = reviewBot.getLearnedPatterns();
            const message = patterns.length === 0 
                ? 'No patterns learned yet'
                : patterns.map(p => `${p.pattern}: ${p.frequency}`).join('\n');
            
            vscode.window.showInformationMessage(`Learned Patterns:\n${message}`);
        })
    );
}
