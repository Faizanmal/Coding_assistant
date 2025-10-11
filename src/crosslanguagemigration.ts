import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationMapping {
  sourceLanguage: string;
  targetLanguage: string;
  patterns: PatternMapping[];
  libraries: LibraryMapping[];
  syntaxRules: SyntaxRule[];
}

interface PatternMapping {
  sourcePattern: string;
  targetPattern: string;
  description: string;
  confidence: number;
  context?: string;
}

interface LibraryMapping {
  sourceLibrary: string;
  targetLibrary: string;
  migrationNotes: string;
  equivalentMethods: { [key: string]: string };
}

interface SyntaxRule {
  category: string;
  sourceExample: string;
  targetExample: string;
  explanation: string;
}

interface MigrationResult {
  migratedCode: string;
  confidence: number;
  issues: MigrationIssue[];
  suggestions: string[];
  unmappedConstructs: string[];
}

interface MigrationIssue {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  originalCode: string;
  suggestedFix?: string;
}

export class CrossLanguageMigrationHelper {
  private mappings: Map<string, MigrationMapping> = new Map();
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeMappings();
  }

  private initializeMappings() {
    // JavaScript to TypeScript
    this.mappings.set('javascript-typescript', {
      sourceLanguage: 'javascript',
      targetLanguage: 'typescript',
      patterns: [
        {
          sourcePattern: 'function\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{',
          targetPattern: 'function $1($2): ReturnType {',
          description: 'Add return type annotations to functions',
          confidence: 0.8
        },
        {
          sourcePattern: '(const|let|var)\\s+(\\w+)\\s*=',
          targetPattern: '$1 $2: Type =',
          description: 'Add type annotations to variables',
          confidence: 0.7
        },
        {
          sourcePattern: 'class\\s+(\\w+)\\s*\\{',
          targetPattern: 'class $1 {',
          description: 'Class declaration (no change needed)',
          confidence: 1.0
        }
      ],
      libraries: [
        {
          sourceLibrary: 'lodash',
          targetLibrary: 'lodash',
          migrationNotes: 'Install @types/lodash for TypeScript definitions',
          equivalentMethods: {}
        }
      ],
      syntaxRules: [
        {
          category: 'Variable Declaration',
          sourceExample: 'const name = "John";',
          targetExample: 'const name: string = "John";',
          explanation: 'Add explicit type annotations for better type safety'
        },
        {
          category: 'Function Parameters',
          sourceExample: 'function greet(name) { return "Hello " + name; }',
          targetExample: 'function greet(name: string): string { return "Hello " + name; }',
          explanation: 'Add parameter types and return type annotations'
        }
      ]
    });

    // Python to JavaScript
    this.mappings.set('python-javascript', {
      sourceLanguage: 'python',
      targetLanguage: 'javascript',
      patterns: [
        {
          sourcePattern: 'def\\s+(\\w+)\\s*\\(([^)]*)\\):',
          targetPattern: 'function $1($2) {',
          description: 'Convert Python function to JavaScript function',
          confidence: 0.9
        },
        {
          sourcePattern: 'class\\s+(\\w+)(?:\\(([^)]*)\\))?:',
          targetPattern: 'class $1$2 {',
          description: 'Convert Python class to JavaScript class',
          confidence: 0.8
        },
        {
          sourcePattern: 'if\\s+__name__\\s*==\\s*["\']__main__["\']:',
          targetPattern: 'if (require.main === module) {',
          description: 'Convert main execution guard',
          confidence: 0.7
        },
        {
          sourcePattern: 'print\\(([^)]*)\\)',
          targetPattern: 'console.log($1)',
          description: 'Convert print statements to console.log',
          confidence: 1.0
        }
      ],
      libraries: [
        {
          sourceLibrary: 'requests',
          targetLibrary: 'fetch / axios',
          migrationNotes: 'Use native fetch() API or install axios for HTTP requests',
          equivalentMethods: {
            'requests.get()': 'fetch(url)',
            'requests.post()': 'fetch(url, { method: "POST", body: data })'
          }
        },
        {
          sourceLibrary: 'json',
          targetLibrary: 'JSON (native)',
          migrationNotes: 'Use native JSON.parse() and JSON.stringify()',
          equivalentMethods: {
            'json.loads()': 'JSON.parse()',
            'json.dumps()': 'JSON.stringify()'
          }
        }
      ],
      syntaxRules: [
        {
          category: 'Indentation',
          sourceExample: 'if condition:\n    do_something()',
          targetExample: 'if (condition) {\n    doSomething();\n}',
          explanation: 'Python uses indentation, JavaScript uses braces'
        },
        {
          category: 'Boolean Values',
          sourceExample: 'True, False, None',
          targetExample: 'true, false, null',
          explanation: 'Boolean and null value differences'
        }
      ]
    });

    // Java to C#
    this.mappings.set('java-csharp', {
      sourceLanguage: 'java',
      targetLanguage: 'csharp',
      patterns: [
        {
          sourcePattern: 'public\\s+class\\s+(\\w+)\\s*\\{',
          targetPattern: 'public class $1 {',
          description: 'Class declaration (minimal changes)',
          confidence: 0.95
        },
        {
          sourcePattern: 'System\\.out\\.println\\(([^)]*)\\)',
          targetPattern: 'Console.WriteLine($1)',
          description: 'Convert print statements',
          confidence: 1.0
        },
        {
          sourcePattern: 'String\\s+(\\w+)',
          targetPattern: 'string $1',
          description: 'Convert String type to lowercase string',
          confidence: 1.0
        }
      ],
      libraries: [
        {
          sourceLibrary: 'java.util.List',
          targetLibrary: 'System.Collections.Generic.List',
          migrationNotes: 'Use generic List<T> in C#',
          equivalentMethods: {
            'add()': 'Add()',
            'size()': 'Count',
            'get()': '[]'
          }
        }
      ],
      syntaxRules: [
        {
          category: 'Properties',
          sourceExample: 'getName() / setName()',
          targetExample: 'public string Name { get; set; }',
          explanation: 'C# uses properties instead of getter/setter methods'
        }
      ]
    });

    // Add more language mappings as needed
    this.addAdditionalMappings();
  }

  private addAdditionalMappings() {
    // TypeScript to Python
    this.mappings.set('typescript-python', {
      sourceLanguage: 'typescript',
      targetLanguage: 'python',
      patterns: [
        {
          sourcePattern: 'function\\s+(\\w+)\\s*\\([^)]*\\)\\s*:\\s*\\w+\\s*\\{',
          targetPattern: 'def $1():',
          description: 'Convert TypeScript function to Python function',
          confidence: 0.8
        },
        {
          sourcePattern: 'console\\.log\\(([^)]*)\\)',
          targetPattern: 'print($1)',
          description: 'Convert console.log to print',
          confidence: 1.0
        },
        {
          sourcePattern: 'interface\\s+(\\w+)\\s*\\{',
          targetPattern: 'class $1:',
          description: 'Convert interface to class (with @dataclass decorator)',
          confidence: 0.7,
          context: 'from dataclasses import dataclass\n@dataclass\n'
        }
      ],
      libraries: [
        {
          sourceLibrary: 'axios',
          targetLibrary: 'requests',
          migrationNotes: 'Use requests library for HTTP calls',
          equivalentMethods: {
            'axios.get()': 'requests.get()',
            'axios.post()': 'requests.post()'
          }
        }
      ],
      syntaxRules: [
        {
          category: 'Variable Declaration',
          sourceExample: 'const name: string = "John";',
          targetExample: 'name = "John"',
          explanation: 'Python uses dynamic typing, no explicit type declarations needed'
        }
      ]
    });
  }

  async migrateCode(sourceCode: string, sourceLanguage: string, targetLanguage: string): Promise<MigrationResult> {
    const mappingKey = `${sourceLanguage}-${targetLanguage}`;
    const mapping = this.mappings.get(mappingKey);

    if (!mapping) {
      throw new Error(`No migration mapping found for ${sourceLanguage} to ${targetLanguage}`);
    }

    let migratedCode = sourceCode;
    const issues: MigrationIssue[] = [];
    const suggestions: string[] = [];
    const unmappedConstructs: string[] = [];
    let totalConfidence = 0;
    let patternMatches = 0;

    // Apply pattern mappings
    for (const pattern of mapping.patterns) {
      const regex = new RegExp(pattern.sourcePattern, 'gm');
      const matches = migratedCode.match(regex);
      
      if (matches) {
        patternMatches += matches.length;
        totalConfidence += pattern.confidence * matches.length;
        
        migratedCode = migratedCode.replace(regex, pattern.targetPattern);
        
        if (pattern.confidence < 0.8) {
          issues.push({
            line: -1, // Would need line tracking for exact positions
            severity: 'warning',
            message: `Pattern migration with low confidence: ${pattern.description}`,
            originalCode: matches[0]
          });
        }
      }
    }

    // Add library migration suggestions
    for (const libMapping of mapping.libraries) {
      if (sourceCode.includes(libMapping.sourceLibrary)) {
        suggestions.push(
          `Consider migrating from '${libMapping.sourceLibrary}' to '${libMapping.targetLibrary}': ${libMapping.migrationNotes}`
        );
      }
    }

    // Apply language-specific transformations
    migratedCode = await this.applyAdvancedTransformations(migratedCode, mapping);

    // Use LLM for complex transformations
    const enhancedResult = await this.enhanceWithLLM(migratedCode, sourceLanguage, targetLanguage, sourceCode);

    const avgConfidence = patternMatches > 0 ? totalConfidence / patternMatches : 0.5;

    return {
      migratedCode: enhancedResult.code,
      confidence: Math.min(avgConfidence, enhancedResult.confidence),
      issues: [...issues, ...enhancedResult.issues],
      suggestions: [...suggestions, ...enhancedResult.suggestions],
      unmappedConstructs
    };
  }

  private applyAdvancedTransformations(code: string, mapping: MigrationMapping): string {
    let transformedCode = code;

    // Language-specific transformations
    if (mapping.targetLanguage === 'python') {
      // Convert JavaScript/TypeScript style to Python
      transformedCode = transformedCode
        .replace(/\{/g, ':')
        .replace(/\}/g, '')
        .replace(/;$/gm, '')
        .replace(/&&/g, ' and ')
        .replace(/\|\|/g, ' or ')
        .replace(/!/g, ' not ')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False')
        .replace(/null/g, 'None');
    } else if (mapping.targetLanguage === 'javascript' || mapping.targetLanguage === 'typescript') {
      // Convert Python style to JavaScript
      transformedCode = transformedCode
        .replace(/:/g, ' {')
        .replace(/True/g, 'true')
        .replace(/False/g, 'false')
        .replace(/None/g, 'null')
        .replace(/ and /g, ' && ')
        .replace(/ or /g, ' || ')
        .replace(/ not /g, ' !');
    }

    return transformedCode;
  }

  private async enhanceWithLLM(
    basicMigration: string, 
    sourceLanguage: string, 
    targetLanguage: string, 
    originalCode: string
  ): Promise<{
    code: string;
    confidence: number;
    issues: MigrationIssue[];
    suggestions: string[];
  }> {
    try {
      const prompt = `You are an expert software engineer specializing in cross-language code migration.

Original ${sourceLanguage} code:
\`\`\`${sourceLanguage}
${originalCode}
\`\`\`

Basic migration attempt to ${targetLanguage}:
\`\`\`${targetLanguage}
${basicMigration}
\`\`\`

Please provide:
1. An improved, idiomatic ${targetLanguage} version
2. Confidence level (0-100%)
3. Any issues or warnings
4. Best practices suggestions specific to ${targetLanguage}

Focus on:
- Language-specific idioms and patterns
- Standard library usage
- Performance considerations
- Maintainability
- Error handling patterns

Return a JSON response with the structure:
{
  "migratedCode": "improved code here",
  "confidence": 85,
  "issues": [{"severity": "warning", "message": "description", "line": 1}],
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

      const response = await this.getLLMCompletion(prompt);
      const result = JSON.parse(response);
      
      return {
        code: result.migratedCode || basicMigration,
        confidence: (result.confidence || 50) / 100,
        issues: result.issues || [],
        suggestions: result.suggestions || []
      };
    } catch (error) {
      return {
        code: basicMigration,
        confidence: 0.5,
        issues: [{
          line: -1,
          severity: 'warning',
          message: 'LLM enhancement unavailable, using basic pattern matching only',
          originalCode: ''
        }],
        suggestions: ['Consider manual review of the migrated code']
      };
    }
  }

  async getMigrationSuggestions(sourceLanguage: string): Promise<string[]> {
    const availableTargets: string[] = [];
    
    for (const [key] of this.mappings) {
      const [source] = key.split('-');
      if (source === sourceLanguage) {
        const target = key.split('-')[1];
        availableTargets.push(target);
      }
    }

    return availableTargets;
  }

  getMigrationComplexity(sourceLanguage: string, targetLanguage: string): {
    complexity: 'low' | 'medium' | 'high';
    reasoning: string;
    estimatedAccuracy: number;
  } {
    const mappingKey = `${sourceLanguage}-${targetLanguage}`;
    const mapping = this.mappings.get(mappingKey);

    if (!mapping) {
      return {
        complexity: 'high',
        reasoning: 'No direct migration mapping available',
        estimatedAccuracy: 0.3
      };
    }

    // Calculate complexity based on pattern confidence and language similarity
    const avgConfidence = mapping.patterns.reduce((sum, p) => sum + p.confidence, 0) / mapping.patterns.length;
    const libraryComplexity = mapping.libraries.length > 5 ? 0.7 : 0.9;

    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let reasoning = '';
    
    if (avgConfidence > 0.8 && libraryComplexity > 0.8) {
      complexity = 'low';
      reasoning = 'Languages are syntactically similar with high pattern match confidence';
    } else if (avgConfidence > 0.6) {
      complexity = 'medium';
      reasoning = 'Moderate syntactic differences, some manual adjustments may be needed';
    } else {
      complexity = 'high';
      reasoning = 'Significant language paradigm differences, extensive manual review required';
    }

    return {
      complexity,
      reasoning,
      estimatedAccuracy: avgConfidence * libraryComplexity
    };
  }

  async generateMigrationReport(
    sourceFile: string, 
    sourceLanguage: string, 
    targetLanguage: string
  ): Promise<string> {
    try {
      const sourceCode = await fs.promises.readFile(sourceFile, 'utf8');
      const result = await this.migrateCode(sourceCode, sourceLanguage, targetLanguage);
      const complexity = this.getMigrationComplexity(sourceLanguage, targetLanguage);

      const report = `# Migration Report: ${sourceLanguage} → ${targetLanguage}

## File: ${path.basename(sourceFile)}

### Migration Summary
- **Confidence Level**: ${Math.round(result.confidence * 100)}%
- **Complexity**: ${complexity.complexity}
- **Estimated Accuracy**: ${Math.round(complexity.estimatedAccuracy * 100)}%

### Reasoning
${complexity.reasoning}

## Issues Found (${result.issues.length})
${result.issues.map(issue => 
  `- **${issue.severity.toUpperCase()}**: ${issue.message}${issue.suggestedFix ? '\n  *Suggested Fix*: ' + issue.suggestedFix : ''}`
).join('\n')}

## Recommendations (${result.suggestions.length})
${result.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}

${result.unmappedConstructs.length > 0 ? `## Unmapped Constructs
${result.unmappedConstructs.map(construct => `- ${construct}`).join('\n')}` : ''}

## Migrated Code

\`\`\`${targetLanguage}
${result.migratedCode}
\`\`\`

## Next Steps
1. Review the migrated code carefully
2. Test functionality thoroughly
3. Address any high-priority issues
4. Consider the recommendations for best practices
5. Update dependencies and imports as needed

*Note: This is an automated migration. Manual review and testing are essential.*`;

      return report;
    } catch (error) {
      return `# Migration Error

Failed to generate migration report: ${error}

Please ensure:
- The source file exists and is readable
- The source language is correctly identified
- The target language is supported`;
    }
  }

  private async getLLMCompletion(prompt: string): Promise<string> {
    try {
      // @ts-ignore
      return await (global as any).getLLMCompletion?.(prompt) || '{"migratedCode":"// Migration unavailable","confidence":0,"issues":[],"suggestions":[]}';
    } catch (error) {
      return '{"migratedCode":"// Migration unavailable","confidence":0,"issues":[],"suggestions":[]}';
    }
  }
}

// Provider for migration webview
class MigrationHelperProvider implements vscode.WebviewViewProvider {
  private webview?: vscode.WebviewView;
  private migrationHelper: CrossLanguageMigrationHelper;

  constructor(private context: vscode.ExtensionContext) {
    this.migrationHelper = new CrossLanguageMigrationHelper(context);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webview = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getWebviewContent();
    this.setupMessageHandling();
  }

  private setupMessageHandling() {
    this.webview?.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'migrateCode':
          await this.handleMigrateCode(message.code, message.sourceLanguage, message.targetLanguage);
          break;
        case 'getMigrationComplexity':
          await this.handleGetComplexity(message.sourceLanguage, message.targetLanguage);
          break;
        case 'getSupportedLanguages':
          await this.handleGetSupportedLanguages();
          break;
      }
    });
  }

  private async handleMigrateCode(code: string, sourceLanguage: string, targetLanguage: string) {
    try {
      const result = await this.migrationHelper.migrateCode(code, sourceLanguage, targetLanguage);
      this.webview?.webview.postMessage({
        type: 'migrationResult',
        data: result
      });
    } catch (error) {
      this.webview?.webview.postMessage({
        type: 'migrationError',
        error: `Migration failed: ${error}`
      });
    }
  }

  private async handleGetComplexity(sourceLanguage: string, targetLanguage: string) {
    const complexity = this.migrationHelper.getMigrationComplexity(sourceLanguage, targetLanguage);
    this.webview?.webview.postMessage({
      type: 'complexityResult',
      data: complexity
    });
  }

  private async handleGetSupportedLanguages() {
    const languages = ['javascript', 'typescript', 'python', 'java', 'csharp'];
    this.webview?.webview.postMessage({
      type: 'supportedLanguages',
      data: languages
    });
  }

  private getWebviewContent(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cross-Language Migration</title>
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            padding: 10px; 
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        .section {
            margin-bottom: 20px;
            padding: 15px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .section h3 {
            margin: 0 0 15px 0;
            color: var(--vscode-textLink-foreground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        select, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
        }
        textarea {
            font-family: var(--vscode-editor-font-family);
            height: 200px;
            resize: vertical;
        }
        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .complexity-card {
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .complexity-level {
            font-weight: bold;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            display: inline-block;
            margin-bottom: 8px;
        }
        .complexity-low { background: #4CAF50; color: white; }
        .complexity-medium { background: #FF9800; color: white; }
        .complexity-high { background: #F44336; color: white; }
        .result-section {
            display: none;
        }
        .result-section.visible {
            display: block;
        }
        .confidence-bar {
            width: 100%;
            height: 8px;
            background: var(--vscode-progressBar-background);
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        .confidence-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .issue-item {
            padding: 8px;
            border-radius: 3px;
            margin: 5px 0;
            border-left: 3px solid;
        }
        .issue-error { border-left-color: #F44336; background: rgba(244, 67, 54, 0.1); }
        .issue-warning { border-left-color: #FF9800; background: rgba(255, 152, 0, 0.1); }
        .issue-info { border-left-color: #2196F3; background: rgba(33, 150, 243, 0.1); }
        .code-block {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 15px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            overflow-x: auto;
            margin: 10px 0;
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            margin-bottom: 15px;
        }
        .tab {
            padding: 8px 16px;
            background: transparent;
            border: none;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        .tab.active {
            border-bottom-color: var(--vscode-textLink-foreground);
            color: var(--vscode-textLink-foreground);
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="section">
        <h3>🔄 Cross-Language Migration Helper</h3>
        
        <div class="form-group">
            <label for="sourceLanguage">Source Language:</label>
            <select id="sourceLanguage" onchange="updateComplexity()">
                <option value="">Select source language...</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
            </select>
        </div>

        <div class="form-group">
            <label for="targetLanguage">Target Language:</label>
            <select id="targetLanguage" onchange="updateComplexity()">
                <option value="">Select target language...</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
            </select>
        </div>

        <div id="complexityInfo" class="complexity-card" style="display: none;">
            <div id="complexityLevel" class="complexity-level"></div>
            <div id="complexityReason"></div>
            <div id="complexityAccuracy"></div>
        </div>

        <div class="form-group">
            <label for="sourceCode">Source Code:</label>
            <textarea id="sourceCode" placeholder="Paste your source code here..."></textarea>
        </div>

        <button class="btn" onclick="migrateCode()" id="migrateBtn" disabled>🔄 Migrate Code</button>
        <button class="btn" onclick="getActiveEditorCode()">📝 Use Active Editor</button>
    </div>

    <div id="results" class="result-section">
        <div class="section">
            <h3>📊 Migration Results</h3>
            
            <div class="tabs">
                <button class="tab active" onclick="showTab('migrated')">Migrated Code</button>
                <button class="tab" onclick="showTab('issues')">Issues</button>
                <button class="tab" onclick="showTab('suggestions')">Suggestions</button>
            </div>

            <div class="confidence-bar">
                <div class="confidence-fill" id="confidenceFill"></div>
            </div>
            <div id="confidenceText">Confidence: 0%</div>

            <div id="migrated-tab" class="tab-content active">
                <div class="code-block" id="migratedCode">Migrated code will appear here...</div>
            </div>

            <div id="issues-tab" class="tab-content">
                <div id="issuesList">No issues found</div>
            </div>

            <div id="suggestions-tab" class="tab-content">
                <div id="suggestionsList">No suggestions available</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTab = 'migrated';

        function updateComplexity() {
            const sourceLanguage = document.getElementById('sourceLanguage').value;
            const targetLanguage = document.getElementById('targetLanguage').value;
            const migrateBtn = document.getElementById('migrateBtn');

            if (sourceLanguage && targetLanguage && sourceLanguage !== targetLanguage) {
                migrateBtn.disabled = false;
                vscode.postMessage({
                    type: 'getMigrationComplexity',
                    sourceLanguage,
                    targetLanguage
                });
            } else {
                migrateBtn.disabled = true;
                document.getElementById('complexityInfo').style.display = 'none';
            }
        }

        function migrateCode() {
            const sourceLanguage = document.getElementById('sourceLanguage').value;
            const targetLanguage = document.getElementById('targetLanguage').value;
            const sourceCode = document.getElementById('sourceCode').value;

            if (!sourceCode.trim()) {
                alert('Please enter source code to migrate');
                return;
            }

            document.getElementById('migrateBtn').disabled = true;
            document.getElementById('migrateBtn').textContent = '🔄 Migrating...';

            vscode.postMessage({
                type: 'migrateCode',
                code: sourceCode,
                sourceLanguage,
                targetLanguage
            });
        }

        function getActiveEditorCode() {
            // This would need to be implemented to get code from active editor
            alert('This feature requires extension API integration');
        }

        function showTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content and mark tab as active
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
            currentTab = tabName;
        }

        function displayComplexity(complexity) {
            const complexityInfo = document.getElementById('complexityInfo');
            const complexityLevel = document.getElementById('complexityLevel');
            const complexityReason = document.getElementById('complexityReason');
            const complexityAccuracy = document.getElementById('complexityAccuracy');

            complexityLevel.textContent = complexity.complexity.toUpperCase();
            complexityLevel.className = 'complexity-level complexity-' + complexity.complexity;
            complexityReason.textContent = complexity.reasoning;
            complexityAccuracy.textContent = \`Estimated Accuracy: \${Math.round(complexity.estimatedAccuracy * 100)}%\`;
            
            complexityInfo.style.display = 'block';
        }

        function displayMigrationResult(result) {
            document.getElementById('results').classList.add('visible');
            
            // Update confidence
            const confidence = Math.round(result.confidence * 100);
            document.getElementById('confidenceFill').style.width = confidence + '%';
            document.getElementById('confidenceFill').style.background = 
                confidence > 70 ? '#4CAF50' : confidence > 40 ? '#FF9800' : '#F44336';
            document.getElementById('confidenceText').textContent = \`Confidence: \${confidence}%\`;

            // Update migrated code
            document.getElementById('migratedCode').textContent = result.migratedCode;

            // Update issues
            const issuesList = document.getElementById('issuesList');
            if (result.issues.length === 0) {
                issuesList.innerHTML = '<div>✅ No issues found</div>';
            } else {
                issuesList.innerHTML = result.issues.map(issue => \`
                    <div class="issue-item issue-\${issue.severity}">
                        <strong>\${issue.severity.toUpperCase()}:</strong> \${issue.message}
                        \${issue.suggestedFix ? '<br><em>Suggested Fix:</em> ' + issue.suggestedFix : ''}
                    </div>
                \`).join('');
            }

            // Update suggestions
            const suggestionsList = document.getElementById('suggestionsList');
            if (result.suggestions.length === 0) {
                suggestionsList.innerHTML = '<div>No additional suggestions</div>';
            } else {
                suggestionsList.innerHTML = result.suggestions.map(suggestion => \`
                    <div style="margin: 10px 0; padding: 8px; background: var(--vscode-textCodeBlock-background); border-radius: 3px;">
                        💡 \${suggestion}
                    </div>
                \`).join('');
            }

            // Re-enable button
            document.getElementById('migrateBtn').disabled = false;
            document.getElementById('migrateBtn').textContent = '🔄 Migrate Code';
        }

        // Message handling
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'complexityResult':
                    displayComplexity(message.data);
                    break;
                case 'migrationResult':
                    displayMigrationResult(message.data);
                    break;
                case 'migrationError':
                    alert('Migration Error: ' + message.error);
                    document.getElementById('migrateBtn').disabled = false;
                    document.getElementById('migrateBtn').textContent = '🔄 Migrate Code';
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}

export function registerMigrationHelperCommands(context: vscode.ExtensionContext) {
  const migrationHelper = new CrossLanguageMigrationHelper(context);
  const provider = new MigrationHelperProvider(context);

  // Register webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('migrationHelper', provider)
  );

  // Quick migration command
  const quickMigrateCommand = vscode.commands.registerCommand('coding.quickMigrate', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const sourceCode = activeEditor.document.getText();
    if (!sourceCode.trim()) {
      vscode.window.showWarningMessage('No code to migrate');
      return;
    }

    // Determine source language from file extension
    const sourceLanguage = getLanguageFromExtension(activeEditor.document.fileName);
    if (!sourceLanguage) {
      vscode.window.showWarningMessage('Unable to determine source language');
      return;
    }

    // Get available target languages
    const availableTargets = await migrationHelper.getMigrationSuggestions(sourceLanguage);
    if (availableTargets.length === 0) {
      vscode.window.showInformationMessage(`No migration targets available for ${sourceLanguage}`);
      return;
    }

    // Let user select target language
    const targetLanguage = await vscode.window.showQuickPick(
      availableTargets.map(lang => ({ label: lang, value: lang })),
      { placeHolder: `Migrate ${sourceLanguage} code to...` }
    );

    if (!targetLanguage) {
      return;
    }

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "🔄 Migrating Code",
        cancellable: false
      }, async (progress) => {
        progress.report({ message: `${sourceLanguage} → ${targetLanguage.value}` });
        
        const result = await migrationHelper.migrateCode(sourceCode, sourceLanguage, targetLanguage.value);
        
        // Create new document with migrated code
        const doc = await vscode.workspace.openTextDocument({
          content: result.migratedCode,
          language: getVSCodeLanguageId(targetLanguage.value)
        });

        await vscode.window.showTextDocument(doc);
        
        // Show summary
        const confidence = Math.round(result.confidence * 100);
        const issueCount = result.issues.length;
        
        vscode.window.showInformationMessage(
          `Migration completed! Confidence: ${confidence}%${issueCount > 0 ? `, ${issueCount} issues found` : ''}`
        );
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Migration failed: ${error}`);
    }
  });

  // Generate migration report command
  const generateReportCommand = vscode.commands.registerCommand('coding.generateMigrationReport', async () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.isUntitled) {
      vscode.window.showWarningMessage('Please save the file first');
      return;
    }

    const sourceLanguage = getLanguageFromExtension(activeEditor.document.fileName);
    if (!sourceLanguage) {
      vscode.window.showWarningMessage('Unable to determine source language');
      return;
    }

    const availableTargets = await migrationHelper.getMigrationSuggestions(sourceLanguage);
    if (availableTargets.length === 0) {
      vscode.window.showInformationMessage(`No migration targets available for ${sourceLanguage}`);
      return;
    }

    const targetLanguage = await vscode.window.showQuickPick(
      availableTargets.map(lang => ({ label: lang, value: lang })),
      { placeHolder: 'Generate migration report for...' }
    );

    if (!targetLanguage) {
      return;
    }

    try {
      const report = await migrationHelper.generateMigrationReport(
        activeEditor.document.fileName,
        sourceLanguage,
        targetLanguage.value
      );

      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: 'markdown'
      });

      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
    }
  });

  context.subscriptions.push(quickMigrateCommand, generateReportCommand);
}

function getLanguageFromExtension(fileName: string): string | undefined {
  const ext = path.extname(fileName).toLowerCase();
  const languageMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cs': 'csharp'
  };
  return languageMap[ext];
}

function getVSCodeLanguageId(language: string): string {
  const languageMap: { [key: string]: string } = {
    'javascript': 'javascript',
    'typescript': 'typescript', 
    'python': 'python',
    'java': 'java',
    'csharp': 'csharp'
  };
  return languageMap[language] || 'plaintext';
}