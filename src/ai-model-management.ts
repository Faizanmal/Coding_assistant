import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { callAI } from './codegenerator';

/**
 * Advanced AI Model Management System
 * Comprehensive system for managing custom AI models, fine-tuning, A/B testing, and performance monitoring
 */

export interface AIModel {
    id: string;
    name: string;
    version: string;
    type: 'base' | 'fine_tuned' | 'custom' | 'ensemble';
    provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'local' | 'custom';
    capabilities: string[];
    status: 'active' | 'training' | 'deprecated' | 'testing';
    metadata: {
        created_at: Date;
        updated_at: Date;
        parameters: number;
        training_data_size?: number;
        accuracy_score?: number;
        latency_ms?: number;
        cost_per_token?: number;
    };
    config: {
        max_tokens: number;
        temperature: number;
        top_p: number;
        frequency_penalty: number;
        presence_penalty: number;
        stop_sequences?: string[];
        system_prompt?: string;
    };
    fallback_models?: string[];
    usage_stats: {
        total_requests: number;
        success_rate: number;
        avg_response_time: number;
        last_used: Date;
    };
}

export interface ModelExperiment {
    id: string;
    name: string;
    description: string;
    models: {
        model_id: string;
        weight: number;
        variant_name: string;
    }[];
    start_date: Date;
    end_date?: Date;
    status: 'draft' | 'running' | 'completed' | 'paused';
    metrics: {
        response_quality: number;
        user_satisfaction: number;
        response_time: number;
        success_rate: number;
        cost_efficiency: number;
    };
    hypothesis: string;
    results?: {
        winner: string;
        confidence: number;
        statistical_significance: boolean;
        recommendations: string[];
    };
}

export interface ModelFineTuningJob {
    id: string;
    model_id: string;
    base_model: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    training_data: {
        dataset_id: string;
        size: number;
        format: 'jsonl' | 'csv' | 'parquet';
        validation_split: number;
    };
    hyperparameters: {
        learning_rate: number;
        batch_size: number;
        epochs: number;
        warmup_steps: number;
        weight_decay: number;
    };
    progress: {
        current_epoch: number;
        total_epochs: number;
        training_loss: number;
        validation_loss: number;
        estimated_completion: Date;
    };
    created_at: Date;
    completed_at?: Date;
    metrics?: {
        final_loss: number;
        perplexity: number;
        bleu_score?: number;
        rouge_score?: number;
    };
}

export interface ModelPerformanceMetrics {
    model_id: string;
    timestamp: Date;
    request_count: number;
    success_rate: number;
    avg_response_time: number;
    avg_tokens_per_request: number;
    error_rate: number;
    cost_per_request: number;
    user_satisfaction_score: number;
    quality_metrics: {
        relevance: number;
        accuracy: number;
        coherence: number;
        completeness: number;
    };
}

export class AIModelManager {
    private models: Map<string, AIModel> = new Map();
    private experiments: Map<string, ModelExperiment> = new Map();
    private fineTuningJobs: Map<string, ModelFineTuningJob> = new Map();
    private performanceMetrics: ModelPerformanceMetrics[] = [];
    private currentModel: string = 'default';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeDefaultModels();
        this.startPerformanceMonitoring();
    }

    /**
     * Initialize default AI models
     */
    private initializeDefaultModels(): void {
        const defaultModels: AIModel[] = [
            {
                id: 'gpt-4-turbo',
                name: 'GPT-4 Turbo',
                version: '1.0',
                type: 'base',
                provider: 'openai',
                capabilities: ['code_generation', 'code_review', 'documentation', 'debugging'],
                status: 'active',
                metadata: {
                    created_at: new Date(),
                    updated_at: new Date(),
                    parameters: 175000000000,
                    accuracy_score: 0.95,
                    latency_ms: 2000,
                    cost_per_token: 0.00003
                },
                config: {
                    max_tokens: 4000,
                    temperature: 0.1,
                    top_p: 0.9,
                    frequency_penalty: 0.0,
                    presence_penalty: 0.0,
                    system_prompt: 'You are an expert software developer assistant.'
                },
                fallback_models: ['gpt-3.5-turbo', 'claude-3'],
                usage_stats: {
                    total_requests: 0,
                    success_rate: 0,
                    avg_response_time: 0,
                    last_used: new Date()
                }
            },
            {
                id: 'claude-3-sonnet',
                name: 'Claude 3 Sonnet',
                version: '1.0',
                type: 'base',
                provider: 'anthropic',
                capabilities: ['code_analysis', 'security_review', 'refactoring', 'documentation'],
                status: 'active',
                metadata: {
                    created_at: new Date(),
                    updated_at: new Date(),
                    parameters: 200000000000,
                    accuracy_score: 0.93,
                    latency_ms: 1800,
                    cost_per_token: 0.000015
                },
                config: {
                    max_tokens: 4000,
                    temperature: 0.0,
                    top_p: 1.0,
                    frequency_penalty: 0.0,
                    presence_penalty: 0.0,
                    system_prompt: 'You are a meticulous code reviewer and security expert.'
                },
                fallback_models: ['gpt-4-turbo'],
                usage_stats: {
                    total_requests: 0,
                    success_rate: 0,
                    avg_response_time: 0,
                    last_used: new Date()
                }
            },
            {
                id: 'custom-code-model',
                name: 'Custom Code Assistant',
                version: '1.0',
                type: 'fine_tuned',
                provider: 'custom',
                capabilities: ['code_completion', 'bug_detection', 'optimization'],
                status: 'testing',
                metadata: {
                    created_at: new Date(),
                    updated_at: new Date(),
                    parameters: 13000000000,
                    training_data_size: 500000,
                    accuracy_score: 0.88,
                    latency_ms: 500,
                    cost_per_token: 0.00001
                },
                config: {
                    max_tokens: 2000,
                    temperature: 0.2,
                    top_p: 0.95,
                    frequency_penalty: 0.1,
                    presence_penalty: 0.1
                },
                usage_stats: {
                    total_requests: 0,
                    success_rate: 0,
                    avg_response_time: 0,
                    last_used: new Date()
                }
            }
        ];

        defaultModels.forEach(model => this.models.set(model.id, model));
    }

    /**
     * Create a new AI model configuration
     */
    async createModel(modelConfig: Omit<AIModel, 'id' | 'usage_stats'>): Promise<AIModel> {
        const model: AIModel = {
            ...modelConfig,
            id: crypto.randomUUID(),
            usage_stats: {
                total_requests: 0,
                success_rate: 0,
                avg_response_time: 0,
                last_used: new Date()
            }
        };

        this.models.set(model.id, model);
        await this.saveModelConfiguration(model);

        vscode.window.showInformationMessage(`✅ Model "${model.name}" created successfully`);
        return model;
    }

    /**
     * Start fine-tuning job for a model
     */
    async startFineTuning(
        baseModelId: string,
        trainingDataset: string,
        hyperparameters: ModelFineTuningJob['hyperparameters']
    ): Promise<ModelFineTuningJob> {
        const jobId = crypto.randomUUID();
        const job: ModelFineTuningJob = {
            id: jobId,
            model_id: crypto.randomUUID(),
            base_model: baseModelId,
            status: 'pending',
            training_data: {
                dataset_id: trainingDataset,
                size: 10000, // Mock size
                format: 'jsonl',
                validation_split: 0.2
            },
            hyperparameters,
            progress: {
                current_epoch: 0,
                total_epochs: hyperparameters.epochs,
                training_loss: 0,
                validation_loss: 0,
                estimated_completion: new Date(Date.now() + hyperparameters.epochs * 3600000) // 1 hour per epoch
            },
            created_at: new Date()
        };

        this.fineTuningJobs.set(jobId, job);

        // Simulate training process
        this.simulateTraining(job);

        vscode.window.showInformationMessage(`🚀 Fine-tuning job started for model ${baseModelId}`);
        return job;
    }

    /**
     * Simulate model training process
     */
    private async simulateTraining(job: ModelFineTuningJob): Promise<void> {
        job.status = 'running';
        
        const updateInterval = setInterval(async () => {
            job.progress.current_epoch++;
            job.progress.training_loss = Math.max(0.1, 2.0 - (job.progress.current_epoch * 0.2));
            job.progress.validation_loss = Math.max(0.15, 2.2 - (job.progress.current_epoch * 0.18));

            if (job.progress.current_epoch >= job.progress.total_epochs) {
                clearInterval(updateInterval);
                job.status = 'completed';
                job.completed_at = new Date();
                job.metrics = {
                    final_loss: job.progress.training_loss,
                    perplexity: Math.exp(job.progress.training_loss),
                    bleu_score: 0.75 + Math.random() * 0.2,
                    rouge_score: 0.70 + Math.random() * 0.25
                };

                // Create the fine-tuned model
                await this.createFineTunedModel(job);
                
                vscode.window.showInformationMessage(`✅ Fine-tuning completed for job ${job.id}`);
            }
        }, 5000); // Update every 5 seconds for demo
    }

    /**
     * Create a fine-tuned model from completed training job
     */
    private async createFineTunedModel(job: ModelFineTuningJob): Promise<void> {
        const baseModel = this.models.get(job.base_model);
        if (!baseModel) {return;}

        const fineTunedModel: AIModel = {
            id: job.model_id,
            name: `${baseModel.name} (Fine-tuned)`,
            version: '1.0',
            type: 'fine_tuned',
            provider: baseModel.provider,
            capabilities: baseModel.capabilities,
            status: 'active',
            metadata: {
                created_at: new Date(),
                updated_at: new Date(),
                parameters: baseModel.metadata.parameters,
                training_data_size: job.training_data.size,
                accuracy_score: Math.min(0.98, baseModel.metadata.accuracy_score! + 0.05),
                latency_ms: baseModel.metadata.latency_ms,
                cost_per_token: baseModel.metadata.cost_per_token
            },
            config: baseModel.config,
            fallback_models: [job.base_model],
            usage_stats: {
                total_requests: 0,
                success_rate: 0,
                avg_response_time: 0,
                last_used: new Date()
            }
        };

        this.models.set(fineTunedModel.id, fineTunedModel);
    }

    /**
     * Start A/B testing experiment
     */
    async startExperiment(
        name: string,
        description: string,
        modelConfigs: ModelExperiment['models'],
        hypothesis: string
    ): Promise<ModelExperiment> {
        const experiment: ModelExperiment = {
            id: crypto.randomUUID(),
            name,
            description,
            models: modelConfigs,
            start_date: new Date(),
            status: 'running',
            metrics: {
                response_quality: 0,
                user_satisfaction: 0,
                response_time: 0,
                success_rate: 0,
                cost_efficiency: 0
            },
            hypothesis
        };

        this.experiments.set(experiment.id, experiment);
        
        vscode.window.showInformationMessage(`🧪 A/B test experiment "${name}" started`);
        return experiment;
    }

    /**
     * Get model for request based on current experiment
     */
    getModelForRequest(userId: string): string {
        // Check if user is in any active experiments
        for (const experiment of this.experiments.values()) {
            if (experiment.status === 'running') {
                // Use consistent hashing to assign user to variant
                const hash = crypto.createHash('md5').update(userId + experiment.id).digest('hex');
                const hashValue = parseInt(hash.substring(0, 8), 16) % 100;

                let cumulative = 0;
                for (const model of experiment.models) {
                    cumulative += model.weight;
                    if (hashValue < cumulative) {
                        return model.model_id;
                    }
                }
            }
        }

        return this.currentModel;
    }

    /**
     * Track model usage and performance
     */
    async trackModelUsage(
        modelId: string,
        responseTime: number,
        success: boolean,
        tokensUsed: number,
        userSatisfaction?: number
    ): Promise<void> {
        const model = this.models.get(modelId);
        if (!model) {return;}

        // Update model usage stats
        model.usage_stats.total_requests++;
        model.usage_stats.avg_response_time = 
            (model.usage_stats.avg_response_time * (model.usage_stats.total_requests - 1) + responseTime) / 
            model.usage_stats.total_requests;
        
        if (success) {
            model.usage_stats.success_rate = 
                (model.usage_stats.success_rate * (model.usage_stats.total_requests - 1) + 1) / 
                model.usage_stats.total_requests;
        } else {
            model.usage_stats.success_rate = 
                (model.usage_stats.success_rate * (model.usage_stats.total_requests - 1)) / 
                model.usage_stats.total_requests;
        }

        model.usage_stats.last_used = new Date();

        // Record performance metrics
        const metric: ModelPerformanceMetrics = {
            model_id: modelId,
            timestamp: new Date(),
            request_count: 1,
            success_rate: success ? 1 : 0,
            avg_response_time: responseTime,
            avg_tokens_per_request: tokensUsed,
            error_rate: success ? 0 : 1,
            cost_per_request: (model.metadata.cost_per_token || 0) * tokensUsed,
            user_satisfaction_score: userSatisfaction || 0,
            quality_metrics: {
                relevance: userSatisfaction || 0.8,
                accuracy: userSatisfaction || 0.8,
                coherence: userSatisfaction || 0.8,
                completeness: userSatisfaction || 0.8
            }
        };

        this.performanceMetrics.push(metric);

        // Keep only last 1000 metrics
        if (this.performanceMetrics.length > 1000) {
            this.performanceMetrics = this.performanceMetrics.slice(-1000);
        }
    }

    /**
     * Get model performance analytics
     */
    getModelAnalytics(modelId?: string): any {
        const metrics = modelId 
            ? this.performanceMetrics.filter(m => m.model_id === modelId)
            : this.performanceMetrics;

        if (metrics.length === 0) {
            return { error: 'No metrics available' };
        }

        const totalRequests = metrics.reduce((sum, m) => sum + m.request_count, 0);
        const avgResponseTime = metrics.reduce((sum, m) => sum + m.avg_response_time, 0) / metrics.length;
        const successRate = metrics.reduce((sum, m) => sum + m.success_rate, 0) / metrics.length;
        const avgCost = metrics.reduce((sum, m) => sum + m.cost_per_request, 0) / metrics.length;
        const avgSatisfaction = metrics.reduce((sum, m) => sum + m.user_satisfaction_score, 0) / metrics.length;

        return {
            total_requests: totalRequests,
            avg_response_time: avgResponseTime,
            success_rate: successRate,
            avg_cost_per_request: avgCost,
            user_satisfaction: avgSatisfaction,
            quality_metrics: {
                relevance: metrics.reduce((sum, m) => sum + m.quality_metrics.relevance, 0) / metrics.length,
                accuracy: metrics.reduce((sum, m) => sum + m.quality_metrics.accuracy, 0) / metrics.length,
                coherence: metrics.reduce((sum, m) => sum + m.quality_metrics.coherence, 0) / metrics.length,
                completeness: metrics.reduce((sum, m) => sum + m.quality_metrics.completeness, 0) / metrics.length
            }
        };
    }

    /**
     * Show model management dashboard
     */
    async showModelDashboard(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'modelDashboard',
            'AI Model Management Dashboard',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.generateModelDashboardHTML();

        // Handle webview messages
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'switchModel':
                    this.currentModel = message.modelId;
                    vscode.window.showInformationMessage(`Switched to model: ${message.modelId}`);
                    break;
                case 'startFineTuning':
                    await this.showFineTuningDialog();
                    break;
                case 'startExperiment':
                    await this.showExperimentDialog();
                    break;
                case 'viewMetrics':
                    const analytics = this.getModelAnalytics(message.modelId);
                    vscode.window.showInformationMessage(`Model Analytics: ${JSON.stringify(analytics, null, 2)}`);
                    break;
            }
        });
    }

    /**
     * Generate model dashboard HTML
     */
    private generateModelDashboardHTML(): string {
        const modelsArray = Array.from(this.models.values());
        const experimentsArray = Array.from(this.experiments.values());
        const fineTuningArray = Array.from(this.fineTuningJobs.values());

        return `<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #6B73FF 0%, #9B59B6 100%);
            padding: 30px;
            border-radius: 12px;
            color: white;
            margin-bottom: 30px;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .section {
            background: #252526;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #6B73FF;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #6B73FF;
        }
        .model-card {
            background: #2d2d30;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #6B73FF;
        }
        .model-card.active {
            border-left-color: #4CAF50;
            background: #2d4a3e;
        }
        .model-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .model-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin: 10px 0;
        }
        .stat-item {
            background: #1e1e1e;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
        }
        .stat-value {
            font-size: 16px;
            font-weight: bold;
            color: #6B73FF;
        }
        .stat-label {
            font-size: 11px;
            color: #888;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-active { background: #4CAF50; color: white; }
        .status-training { background: #FF9800; color: white; }
        .status-testing { background: #2196F3; color: white; }
        .status-deprecated { background: #666; color: white; }
        .btn {
            background: #6B73FF;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 4px;
            font-size: 12px;
        }
        .btn:hover {
            background: #5a63d9;
        }
        .btn.secondary {
            background: #666;
        }
        .experiment-item {
            background: #2d2d30;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: #6B73FF;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 AI Model Management Dashboard</h1>
        <p>Manage AI models, fine-tuning, and A/B experiments</p>
    </div>

    <div class="dashboard-grid">
        <div class="section">
            <h2>🤖 Available Models</h2>
            ${modelsArray.map(model => `
                <div class="model-card ${model.id === this.currentModel ? 'active' : ''}">
                    <div class="model-name">${model.name}</div>
                    <div class="status-badge status-${model.status}">${model.status}</div>
                    <div class="model-stats">
                        <div class="stat-item">
                            <div class="stat-value">${model.usage_stats.total_requests}</div>
                            <div class="stat-label">Requests</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(model.usage_stats.success_rate * 100).toFixed(1)}%</div>
                            <div class="stat-label">Success Rate</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${model.usage_stats.avg_response_time.toFixed(0)}ms</div>
                            <div class="stat-label">Avg Response</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${(model.metadata.accuracy_score! * 100).toFixed(1)}%</div>
                            <div class="stat-label">Accuracy</div>
                        </div>
                    </div>
                    <div>
                        <button class="btn" onclick="switchModel('${model.id}')">
                            ${model.id === this.currentModel ? 'Current' : 'Switch'}
                        </button>
                        <button class="btn secondary" onclick="viewMetrics('${model.id}')">Metrics</button>
                    </div>
                </div>
            `).join('')}
            
            <div style="margin-top: 20px;">
                <button class="btn" onclick="startFineTuning()">Start Fine-Tuning</button>
                <button class="btn" onclick="startExperiment()">Start A/B Test</button>
            </div>
        </div>

        <div class="section">
            <h2>🧪 Active Experiments</h2>
            ${experimentsArray.length > 0 ? experimentsArray.map(exp => `
                <div class="experiment-item">
                    <strong>${exp.name}</strong>
                    <div style="color: #888; font-size: 12px; margin: 5px 0;">${exp.description}</div>
                    <div class="status-badge status-${exp.status}">${exp.status}</div>
                    <div style="margin-top: 10px;">
                        Models: ${exp.models.map(m => m.variant_name).join(', ')}
                    </div>
                </div>
            `).join('') : '<div style="color: #888;">No active experiments</div>'}
        </div>

        <div class="section">
            <h2>🔧 Fine-Tuning Jobs</h2>
            ${fineTuningArray.length > 0 ? fineTuningArray.slice(-5).map(job => `
                <div class="experiment-item">
                    <strong>Job ${job.id.substring(0, 8)}</strong>
                    <div class="status-badge status-${job.status}">${job.status}</div>
                    ${job.status === 'running' ? `
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(job.progress.current_epoch / job.progress.total_epochs) * 100}%"></div>
                        </div>
                        <div style="font-size: 12px; color: #888;">
                            Epoch ${job.progress.current_epoch}/${job.progress.total_epochs} | 
                            Loss: ${job.progress.training_loss.toFixed(3)}
                        </div>
                    ` : ''}
                </div>
            `).join('') : '<div style="color: #888;">No fine-tuning jobs</div>'}
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function switchModel(modelId) {
            vscode.postMessage({
                command: 'switchModel',
                modelId: modelId
            });
        }

        function startFineTuning() {
            vscode.postMessage({
                command: 'startFineTuning'
            });
        }

        function startExperiment() {
            vscode.postMessage({
                command: 'startExperiment'
            });
        }

        function viewMetrics(modelId) {
            vscode.postMessage({
                command: 'viewMetrics',
                modelId: modelId
            });
        }
    </script>
</body>
</html>`;
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        setInterval(() => {
            // Cleanup old metrics
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
            this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
        }, 60 * 60 * 1000); // Every hour
    }

    /**
     * Show fine-tuning dialog
     */
    private async showFineTuningDialog(): Promise<void> {
        const baseModel = await vscode.window.showQuickPick(
            Array.from(this.models.values()).map(m => ({ label: m.name, description: m.id })),
            { placeHolder: 'Select base model for fine-tuning' }
        );

        if (baseModel) {
            await this.startFineTuning(baseModel.description!, 'custom-dataset', {
                learning_rate: 0.0001,
                batch_size: 16,
                epochs: 10,
                warmup_steps: 100,
                weight_decay: 0.01
            });
        }
    }

    /**
     * Show experiment dialog
     */
    private async showExperimentDialog(): Promise<void> {
        const name = await vscode.window.showInputBox({ prompt: 'Experiment name' });
        if (!name) {return;}

        const description = await vscode.window.showInputBox({ prompt: 'Experiment description' });
        if (!description) {return;}

        const models = Array.from(this.models.values())
            .filter(m => m.status === 'active')
            .slice(0, 2)
            .map((m, i) => ({
                model_id: m.id,
                weight: 50,
                variant_name: `Variant ${String.fromCharCode(65 + i)}`
            }));

        await this.startExperiment(name, description, models, 'Testing model performance differences');
    }

    /**
     * Save model configuration
     */
    private async saveModelConfiguration(model: AIModel): Promise<void> {
        const configs = this.context.globalState.get('ai_models', {}) as Record<string, AIModel>;
        configs[model.id] = model;
        await this.context.globalState.update('ai_models', configs);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        // Clean up resources
    }
}

/**
 * Register AI model management commands
 */
export function registerAIModelManagementCommands(context: vscode.ExtensionContext): void {
    const modelManager = new AIModelManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.models.dashboard', async () => {
            await modelManager.showModelDashboard();
        }),

        vscode.commands.registerCommand('coding.models.startFineTuning', async () => {
            const baseModel = await vscode.window.showInputBox({ prompt: 'Base model ID' });
            const dataset = await vscode.window.showInputBox({ prompt: 'Training dataset ID' });
            
            if (baseModel && dataset) {
                await modelManager.startFineTuning(baseModel, dataset, {
                    learning_rate: 0.0001,
                    batch_size: 16,
                    epochs: 5,
                    warmup_steps: 100,
                    weight_decay: 0.01
                });
            }
        }),

        vscode.commands.registerCommand('coding.models.startExperiment', async () => {
            const name = await vscode.window.showInputBox({ prompt: 'Experiment name' });
            if (name) {
                await modelManager.startExperiment(
                    name,
                    'Model comparison experiment',
                    [
                        { model_id: 'gpt-4-turbo', weight: 50, variant_name: 'GPT-4' },
                        { model_id: 'claude-3-sonnet', weight: 50, variant_name: 'Claude-3' }
                    ],
                    'Testing response quality differences'
                );
            }
        }),

        vscode.commands.registerCommand('coding.models.analytics', async () => {
            const analytics = modelManager.getModelAnalytics();
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(analytics, null, 2),
                language: 'json'
            });
            await vscode.window.showTextDocument(doc);
        })
    );

    context.subscriptions.push(modelManager);
}