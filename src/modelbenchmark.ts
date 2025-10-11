import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';

interface ModelPerformance {
  provider: string;
  model: string;
  avgLatency: number;
  successRate: number;
  qualityScore: number;
  totalRequests: number;
  failureCount: number;
  lastUsed: number;
}

/**
 * Model Benchmarking Panel for comparing different LLM responses
 */
export class ModelBenchmarkProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'coding.modelBenchmark';
  private _view?: vscode.WebviewView;
  private benchmarkResults: ModelPerformance[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.loadBenchmarkData();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'runBenchmark':
            this.runBenchmark(message.prompt, message.models);
            break;
          case 'clearResults':
            this.clearBenchmarkData();
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Benchmark</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .benchmark-form { background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); margin: 10px 0; padding: 15px; border-radius: 5px; }
        .result-item { border: 1px solid var(--vscode-panel-border); margin: 10px 0; padding: 15px; border-radius: 5px; }
        .model-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
        .performance-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 10px 0; }
        .metric { background: var(--vscode-textCodeBlock-background); padding: 8px; border-radius: 3px; text-align: center; }
        .metric-label { font-size: 11px; color: var(--vscode-descriptionForeground); }
        .metric-value { font-size: 16px; font-weight: bold; }
        .response-text { background: var(--vscode-textCodeBlock-background); padding: 10px; border-radius: 3px; margin: 8px 0; max-height: 150px; overflow-y: auto; }
        .button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer; margin: 2px; }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        input, textarea, select { width: 100%; padding: 8px; margin: 4px 0; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; }
        .quality-bar { height: 6px; background: var(--vscode-progressBar-background); border-radius: 3px; overflow: hidden; }
        .quality-fill { height: 100%; transition: width 0.3s ease; }
        .quality-excellent { background: #28a745; }
        .quality-good { background: #ffc107; }
        .quality-poor { background: #dc3545; }
    </style>
</head>
<body>
    <h2>🏆 Model Benchmark</h2>
    
    <div class="benchmark-form">
        <h3>Run Benchmark Test</h3>
        <textarea id="benchmarkPrompt" rows="3" placeholder="Enter prompt to test across models..."></textarea>
        <div>
            <label><input type="checkbox" value="groq-llama" checked> Groq Llama</label>
            <label><input type="checkbox" value="openai-gpt4" checked> OpenAI GPT-4</label>
            <label><input type="checkbox" value="mistral-large" checked> Mistral Large</label>
            <label><input type="checkbox" value="anthropic-claude" checked> Anthropic Claude</label>
        </div>
        <button class="button" onclick="runBenchmark()">Run Benchmark</button>
        <button class="button" onclick="clearResults()">Clear Results</button>
    </div>

    <div id="results">
        <h3>📊 Performance Overview</h3>
        ${this.generateOverviewHtml()}
        
        <h3>📈 Detailed Results</h3>
        <div id="detailed-results">
            <!-- Detailed results will be populated here -->
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function runBenchmark() {
            const prompt = document.getElementById('benchmarkPrompt').value;
            const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
            const models = Array.from(checkboxes).map(cb => cb.value);
            
            if (prompt.trim() && models.length > 0) {
                vscode.postMessage({ command: 'runBenchmark', prompt, models });
            }
        }

        function clearResults() {
            if (confirm('Clear all benchmark results?')) {
                vscode.postMessage({ command: 'clearResults' });
            }
        }
    </script>
</body>
</html>`;
  }

  private generateOverviewHtml(): string {
    if (this.benchmarkResults.length === 0) {
      return '<p>No benchmark data available. Run a benchmark test to see results.</p>';
    }

    const sortedResults = [...this.benchmarkResults].sort((a, b) => b.qualityScore - a.qualityScore);
    
    return sortedResults.map(result => `
      <div class="result-item">
        <div class="model-header">
          <span>${result.provider} - ${result.model}</span>
          <span>Quality: ${(result.qualityScore * 100).toFixed(1)}%</span>
        </div>
        <div class="performance-metrics">
          <div class="metric">
            <div class="metric-label">Avg Latency</div>
            <div class="metric-value">${result.avgLatency}ms</div>
          </div>
          <div class="metric">
            <div class="metric-label">Success Rate</div>
            <div class="metric-value">${(result.successRate * 100).toFixed(1)}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Total Requests</div>
            <div class="metric-value">${result.totalRequests}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Failures</div>
            <div class="metric-value">${result.failureCount}</div>
          </div>
        </div>
        <div class="quality-bar">
          <div class="quality-fill ${this.getQualityClass(result.qualityScore)}" 
               style="width: ${result.qualityScore * 100}%"></div>
        </div>
      </div>
    `).join('');
  }

  private getQualityClass(score: number): string {
    if (score >= 0.8) {
      return 'quality-excellent';
    }
    if (score >= 0.6) {
      return 'quality-good';
    }
    return 'quality-poor';
  }

  private async runBenchmark(prompt: string, models: string[]) {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Running model benchmark...',
      cancellable: false
    }, async (progress) => {
      const results = [];

      for (const model of models) {
        progress.report({ message: `Testing ${model}...` });
        
        const startTime = Date.now();
        try {
          const response = await this.queryModel(model, prompt);
          const latency = Date.now() - startTime;
          
          // Calculate quality score (simplified)
          const qualityScore = this.calculateQualityScore(response, prompt);
          
          results.push({
            provider: model.split('-')[0],
            model: model.split('-')[1] || model,
            response,
            latency,
            qualityScore,
            success: true
          });

          // Update performance tracking
          this.updateModelPerformance(model, latency, true, qualityScore);
          
        } catch (error) {
          results.push({
            provider: model.split('-')[0],
            model: model.split('-')[1] || model,
            response: `Error: ${error}`,
            latency: Date.now() - startTime,
            qualityScore: 0,
            success: false
          });

          this.updateModelPerformance(model, Date.now() - startTime, false, 0);
        }
      }

      // Display results
      this.showBenchmarkResults(prompt, results);
      this.refresh();
    });
  }

  private async queryModel(model: string, prompt: string): Promise<string> {
    // This would integrate with your existing model providers
    // For now, simulate with the current getLLMCompletion
    const response = await getLLMCompletion(`[${model}] ${prompt}`);
    return response || 'No response';
  }

  private calculateQualityScore(response: string, prompt: string): number {
    // Simplified quality scoring
    let score = 0.5; // Base score

    // Length appropriateness (not too short, not too long)
    const responseLength = response.length;
    if (responseLength > 50 && responseLength < 2000) {
      score += 0.2;
    }

    // Contains code (if prompt suggests coding task)
    if (prompt.toLowerCase().includes('code') && response.includes('```')) {
      score += 0.2;
    }

    // Structured response
    if (response.includes('\n') && response.length > 100) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private updateModelPerformance(model: string, latency: number, success: boolean, qualityScore: number) {
    const [provider, modelName] = model.split('-');
    let perf = this.benchmarkResults.find(p => p.provider === provider && p.model === modelName);
    
    if (!perf) {
      perf = {
        provider,
        model: modelName,
        avgLatency: latency,
        successRate: success ? 1 : 0,
        qualityScore,
        totalRequests: 1,
        failureCount: success ? 0 : 1,
        lastUsed: Date.now()
      };
      this.benchmarkResults.push(perf);
    } else {
      perf.totalRequests++;
      perf.avgLatency = (perf.avgLatency * (perf.totalRequests - 1) + latency) / perf.totalRequests;
      perf.successRate = (perf.totalRequests - perf.failureCount) / perf.totalRequests;
      perf.qualityScore = (perf.qualityScore * (perf.totalRequests - 1) + qualityScore) / perf.totalRequests;
      if (!success) {
        perf.failureCount++;
      }
      perf.lastUsed = Date.now();
    }

    this.saveBenchmarkData();
  }

  private async showBenchmarkResults(prompt: string, results: any[]) {
    const content = `# Model Benchmark Results

## Prompt
\`\`\`
${prompt}
\`\`\`

## Results

${results.map(result => `
### ${result.provider} - ${result.model}
- **Latency**: ${result.latency}ms
- **Quality Score**: ${(result.qualityScore * 100).toFixed(1)}%
- **Status**: ${result.success ? '✅ Success' : '❌ Failed'}

**Response:**
\`\`\`
${result.response}
\`\`\`
`).join('\n')}
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  private loadBenchmarkData() {
    const data = this.context.globalState.get<ModelPerformance[]>('modelBenchmarkResults', []);
    this.benchmarkResults = data;
  }

  private saveBenchmarkData() {
    this.context.globalState.update('modelBenchmarkResults', this.benchmarkResults);
  }

  private clearBenchmarkData() {
    this.benchmarkResults = [];
    this.saveBenchmarkData();
    this.refresh();
  }

  private refresh() {
    if (this._view) {
      this._view.webview.html = this.getHtmlForWebview(this._view.webview);
    }
  }
}

export function registerModelBenchmarkCommands(context: vscode.ExtensionContext) {
  const provider = new ModelBenchmarkProvider(context.extensionUri, context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ModelBenchmarkProvider.viewType, provider),
    vscode.commands.registerCommand('coding.openModelBenchmark', () => {
      vscode.commands.executeCommand('workbench.view.extension.coding-model-benchmark');
    }),
    vscode.commands.registerCommand('coding.quickModelCompare', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Enter prompt to compare across models',
        placeHolder: 'Write a function to sort an array...'
      });

      if (prompt) {
        // Simulate running benchmark with default models
        provider.resolveWebviewView = (webviewView) => {
          webviewView.webview.postMessage({
            command: 'runBenchmark',
            prompt,
            models: ['groq-llama', 'openai-gpt4', 'mistral-large']
          });
        };
      }
    })
  );
}