import * as vscode from 'vscode';

interface CodeSmell {
    type: 'complexity' | 'duplication' | 'naming' | 'length' | 'performance' | 'maintenance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    line?: number;
    column?: number;
    suggestion: string;
    rule: string;
}

interface CodeSmellResult {
    file: string;
    smells: CodeSmell[];
    overallScore: number; // 0-100, higher is better
    totalSmells: number;
    criticalSmells: number;
    summary: string;
}

export class CodeSmellDetector {
    private static readonly COMPLEXITY_THRESHOLDS = {
        function: 10,
        class: 20,
        file: 50
    };

    private static readonly LENGTH_THRESHOLDS = {
        function: 30,
        class: 300,
        file: 500,
        line: 120
    };

    static async analyzeFile(document: vscode.TextDocument): Promise<CodeSmellResult> {
        const content = document.getText();
        const lines = content.split('\n');
        const smells: CodeSmell[] = [];

        // Analyze different types of code smells
        smells.push(...this.detectComplexity(content, lines, document.languageId));
        smells.push(...this.detectLongMethods(lines, document.languageId));
        smells.push(...this.detectNamingIssues(lines, document.languageId));
        smells.push(...this.detectDuplication(lines));
        smells.push(...this.detectPerformanceIssues(lines, document.languageId));
        smells.push(...this.detectMaintenanceIssues(lines, document.languageId));

        const criticalSmells = smells.filter(smell => smell.severity === 'critical').length;
        const highSmells = smells.filter(smell => smell.severity === 'high').length;
        const mediumSmells = smells.filter(smell => smell.severity === 'medium').length;
        const lowSmells = smells.filter(smell => smell.severity === 'low').length;

        // Calculate overall score (100 is perfect, 0 is terrible)
        const overallScore = Math.max(0, 100 - (criticalSmells * 20 + highSmells * 10 + mediumSmells * 5 + lowSmells * 2));

        const summary = this.generateSummary(smells.length, criticalSmells, highSmells, overallScore);

        return {
            file: document.fileName,
            smells,
            overallScore,
            totalSmells: smells.length,
            criticalSmells,
            summary
        };
    }

    static async analyzeWorkspace(): Promise<CodeSmellResult[]> {
        const results: CodeSmellResult[] = [];
        
        const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs}', '**/node_modules/**');
        
        for (const file of files.slice(0, 20)) { // Limit to 20 files for performance
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const result = await this.analyzeFile(document);
                results.push(result);
            } catch (error) {
                console.error(`Error analyzing ${file.fsPath}:`, error);
            }
        }

        return results;
    }

    private static detectComplexity(content: string, lines: string[], languageId: string): CodeSmell[] {
        const smells: CodeSmell[] = [];
        
        // Detect cyclomatic complexity indicators
        const complexityIndicators = [
            'if\\s*\\(',
            'else\\s+if\\s*\\(',
            'while\\s*\\(',
            'for\\s*\\(',
            'switch\\s*\\(',
            'case\\s+.*:',
            'catch\\s*\\(',
            '&&', '\\|\\|',
            '\\?.*:'
        ];

        lines.forEach((line, index) => {
            let complexity = 0;
            complexityIndicators.forEach(indicator => {
                const matches = line.match(new RegExp(indicator, 'g'));
                if (matches) {
                    complexity += matches.length;
                }
            });

            if (complexity > 5) {
                smells.push({
                    type: 'complexity',
                    severity: complexity > 10 ? 'critical' : complexity > 7 ? 'high' : 'medium',
                    message: `High cyclomatic complexity detected (${complexity} decision points)`,
                    line: index + 1,
                    suggestion: 'Consider breaking this into smaller functions or using early returns',
                    rule: 'complexity-limit'
                });
            }
        });

        return smells;
    }

    private static detectLongMethods(lines: string[], languageId: string): CodeSmell[] {
        const smells: CodeSmell[] = [];
        
        // Patterns for function/method detection by language
        const functionPatterns = {
            javascript: /^(\s*)(function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\([^)]*\)\s*\{)/,
            typescript: /^(\s*)(function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\([^)]*\)\s*[:{])/,
            python: /^(\s*)def\s+\w+\s*\(/,
            java: /^(\s*)(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,
            csharp: /^(\s*)(public|private|protected|internal)?\s*(static\s+)?\w+\s+\w+\s*\(/
        };

        const pattern = functionPatterns[languageId as keyof typeof functionPatterns] || 
                        functionPatterns.javascript;

        let currentFunction: {start: number, name: string, indentLevel: number} | null = null;

        lines.forEach((line, index) => {
            const functionMatch = line.match(pattern);
            
            if (functionMatch) {
                // End previous function if any
                if (currentFunction) {
                    const functionLength = index - currentFunction.start;
                    if (functionLength > this.LENGTH_THRESHOLDS.function) {
                        smells.push({
                            type: 'length',
                            severity: functionLength > 100 ? 'critical' : functionLength > 60 ? 'high' : 'medium',
                            message: `Long method detected (${functionLength} lines)`,
                            line: currentFunction.start + 1,
                            suggestion: 'Consider breaking this method into smaller, focused methods',
                            rule: 'method-length'
                        });
                    }
                }

                // Start new function tracking
                currentFunction = {
                    start: index,
                    name: line.trim(),
                    indentLevel: functionMatch[1].length
                };
            }

            // Check for end of function (simplified heuristic)
            if (currentFunction && line.trim() === '}' && 
                line.indexOf('}') <= currentFunction.indentLevel) {
                const functionLength = index - currentFunction.start + 1;
                if (functionLength > this.LENGTH_THRESHOLDS.function) {
                    smells.push({
                        type: 'length',
                        severity: functionLength > 100 ? 'critical' : functionLength > 60 ? 'high' : 'medium',
                        message: `Long method detected (${functionLength} lines)`,
                        line: currentFunction.start + 1,
                        suggestion: 'Consider breaking this method into smaller, focused methods',
                        rule: 'method-length'
                    });
                }
                currentFunction = null;
            }
        });

        return smells;
    }

    private static detectNamingIssues(lines: string[], languageId: string): CodeSmell[] {
        const smells: CodeSmell[] = [];
        
        const badNamingPatterns = [
            { pattern: /\b[a-z][a-z0-9]*[0-9]+\b/g, message: 'Variable name ends with numbers', severity: 'low' as const },
            { pattern: /\b[a-z]{1,2}\b(?!\s*[=:])/g, message: 'Very short variable name', severity: 'medium' as const },
            { pattern: /\b(data|info|item|obj|temp|tmp|foo|bar|baz)\b/g, message: 'Non-descriptive variable name', severity: 'medium' as const },
            { pattern: /\b[A-Z][A-Z_]+[a-z]/g, message: 'Inconsistent casing', severity: 'low' as const }
        ];

        lines.forEach((line, index) => {
            badNamingPatterns.forEach(pattern => {
                const matches = line.match(pattern.pattern);
                if (matches) {
                    matches.forEach(match => {
                        smells.push({
                            type: 'naming',
                            severity: pattern.severity,
                            message: `${pattern.message}: "${match}"`,
                            line: index + 1,
                            column: line.indexOf(match),
                            suggestion: 'Use descriptive, meaningful names that explain the purpose',
                            rule: 'naming-convention'
                        });
                    });
                }
            });

            // Check for long lines
            if (line.length > this.LENGTH_THRESHOLDS.line) {
                smells.push({
                    type: 'length',
                    severity: line.length > 150 ? 'high' : 'medium',
                    message: `Long line detected (${line.length} characters)`,
                    line: index + 1,
                    suggestion: 'Break long lines into multiple lines for better readability',
                    rule: 'line-length'
                });
            }
        });

        return smells;
    }

    private static detectDuplication(lines: string[]): CodeSmell[] {
        const smells: CodeSmell[] = [];
        const lineMap = new Map<string, number[]>();
        
        // Track non-empty, non-comment lines
        lines.forEach((line, index) => {
            const cleanLine = line.trim();
            if (cleanLine && !cleanLine.startsWith('//') && !cleanLine.startsWith('/*') && 
                !cleanLine.startsWith('#') && !cleanLine.startsWith('*')) {
                if (lineMap.has(cleanLine)) {
                    lineMap.get(cleanLine)!.push(index);
                } else {
                    lineMap.set(cleanLine, [index]);
                }
            }
        });

        // Report duplications
        lineMap.forEach((lineNumbers, content) => {
            if (lineNumbers.length > 2 && content.length > 20) {
                smells.push({
                    type: 'duplication',
                    severity: lineNumbers.length > 4 ? 'high' : 'medium',
                    message: `Duplicated code found (${lineNumbers.length} occurrences)`,
                    line: lineNumbers[0] + 1,
                    suggestion: 'Extract duplicated code into a reusable function or constant',
                    rule: 'no-duplication'
                });
            }
        });

        return smells;
    }

    private static detectPerformanceIssues(lines: string[], languageId: string): CodeSmell[] {
        const smells: CodeSmell[] = [];
        
        const performanceAntiPatterns = [
            { pattern: /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g, message: 'Nested loops detected', severity: 'medium' as const },
            { pattern: /\.length\s*(?:===?|!==?|[<>]=?)\s*0/g, message: 'Inefficient length check', severity: 'low' as const },
            { pattern: /\+\=\s*["'`][^"'`]*["'`]/g, message: 'String concatenation in loop (potential)', severity: 'medium' as const },
            { pattern: /document\.getElementById|document\.querySelector/g, message: 'DOM query in potential loop', severity: 'low' as const }
        ];

        lines.forEach((line, index) => {
            performanceAntiPatterns.forEach(pattern => {
                if (pattern.pattern.test(line)) {
                    smells.push({
                        type: 'performance',
                        severity: pattern.severity,
                        message: pattern.message,
                        line: index + 1,
                        suggestion: 'Consider optimizing this code for better performance',
                        rule: 'performance-optimization'
                    });
                }
            });
        });

        return smells;
    }

    private static detectMaintenanceIssues(lines: string[], languageId: string): CodeSmell[] {
        const smells: CodeSmell[] = [];
        
        lines.forEach((line, index) => {
            // Magic numbers
            const magicNumberPattern = /(?<![a-zA-Z_])[0-9]{2,}(?![a-zA-Z_])/g;
            const magicNumbers = line.match(magicNumberPattern);
            if (magicNumbers && !line.includes('//') && !line.includes('#')) {
                magicNumbers.forEach(number => {
                    if (!['100', '200', '404', '500'].includes(number)) {
                        smells.push({
                            type: 'maintenance',
                            severity: 'low',
                            message: `Magic number detected: ${number}`,
                            line: index + 1,
                            column: line.indexOf(number),
                            suggestion: 'Replace magic numbers with named constants',
                            rule: 'no-magic-numbers'
                        });
                    }
                });
            }

            // TODO comments
            if (line.toLowerCase().includes('todo') || line.toLowerCase().includes('fixme')) {
                smells.push({
                    type: 'maintenance',
                    severity: 'low',
                    message: 'TODO/FIXME comment found',
                    line: index + 1,
                    suggestion: 'Address TODO/FIXME comments or convert to proper issue tracking',
                    rule: 'no-todo-comments'
                });
            }

            // Dead code indicators
            if (line.trim().startsWith('//') && line.length > 50 && 
                (line.includes('function') || line.includes('class') || line.includes('{'))) {
                smells.push({
                    type: 'maintenance',
                    severity: 'medium',
                    message: 'Commented out code detected',
                    line: index + 1,
                    suggestion: 'Remove commented out code or use version control',
                    rule: 'no-dead-code'
                });
            }
        });

        return smells;
    }

    private static generateSummary(totalSmells: number, criticalSmells: number, highSmells: number, score: number): string {
        if (score >= 90) {
            return 'Excellent code quality! Very few issues detected.';
        } else if (score >= 75) {
            return 'Good code quality with some minor improvements needed.';
        } else if (score >= 60) {
            return 'Moderate code quality. Consider addressing the identified issues.';
        } else if (score >= 40) {
            return 'Below average code quality. Multiple issues need attention.';
        } else {
            return 'Poor code quality. Significant refactoring recommended.';
        }
    }

    static generateReport(results: CodeSmellResult[]): string {
        let report = '# 🔍 Code Smell Detection Report\n\n';
        report += `Generated: ${new Date().toLocaleString()}\n`;
        report += `Files Analyzed: ${results.length}\n\n`;

        // Overall statistics
        const totalSmells = results.reduce((sum, result) => sum + result.totalSmells, 0);
        const totalCritical = results.reduce((sum, result) => sum + result.criticalSmells, 0);
        const averageScore = results.length > 0 
            ? results.reduce((sum, result) => sum + result.overallScore, 0) / results.length
            : 0;

        report += '## 📊 Overall Statistics\n\n';
        report += `- **Total Code Smells**: ${totalSmells}\n`;
        report += `- **Critical Issues**: ${totalCritical}\n`;
        report += `- **Average Quality Score**: ${averageScore.toFixed(1)}/100\n\n`;

        // Worst files
        const worstFiles = results
            .sort((a, b) => a.overallScore - b.overallScore)
            .slice(0, 5);

        report += '## 🚨 Files Needing Attention\n\n';
        worstFiles.forEach((file, index) => {
            report += `${index + 1}. **${file.file}** (Score: ${file.overallScore})\n`;
            report += `   - ${file.totalSmells} issues (${file.criticalSmells} critical)\n`;
            report += `   - ${file.summary}\n\n`;
        });

        // Detailed findings
        report += '## 🔍 Detailed Findings\n\n';
        results.forEach(result => {
            if (result.smells.length > 0) {
                report += `### ${result.file}\n\n`;
                result.smells.slice(0, 10).forEach(smell => {
                    const severityIcon = {
                        'critical': '🔴',
                        'high': '🟠',
                        'medium': '🟡',
                        'low': '🔵'
                    }[smell.severity];

                    report += `${severityIcon} **${smell.type.toUpperCase()}** (Line ${smell.line}): ${smell.message}\n`;
                    report += `   💡 *${smell.suggestion}*\n\n`;
                });
            }
        });

        return report;
    }
}