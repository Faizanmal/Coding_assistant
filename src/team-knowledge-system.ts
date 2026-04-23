import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { callAI } from './codegenerator';

interface KnowledgeEntry {
    id: string;
    title: string;
    description: string;
    category: 'pattern' | 'best-practice' | 'pitfall' | 'decision' | 'lesson-learned';
    author: string;
    timestamp: number;
    tags: string[];
    context: string;
    relatedEntries: string[];
    ratings: number[];
    views: number;
}

interface TeamPattern {
    name: string;
    description: string;
    codeExample: string;
    applicableTo: string[]; // languages/frameworks
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    frequency: number;
    lastUsed: number;
    contributors: string[];
}

interface CodeDecision {
    id: string;
    title: string;
    context: string;
    decision: string;
    alternatives: string[];
    rationale: string;
    consequences: string[];
    author: string;
    timestamp: number;
    affectedFiles: string[];
    status: 'active' | 'deprecated' | 'under-review';
}

interface BestPracticeRule {
    id: string;
    name: string;
    description: string;
    rationale: string;
    checkCode: string; // Code to check if practice is followed
    examples: { good: string; bad: string };
    severity: 'error' | 'warning' | 'info';
    applicable: string[]; // languages/frameworks
    enforceable: boolean;
}

export class TeamKnowledgeSystem {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private knowledgeBase: Map<string, KnowledgeEntry> = new Map();
    private patterns: Map<string, TeamPattern> = new Map();
    private decisions: Map<string, CodeDecision> = new Map();
    private bestPractices: Map<string, BestPracticeRule> = new Map();
    private storageDir: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Team Knowledge System');
        this.storageDir = path.join(context.globalStorageUri.fsPath, 'team-knowledge');
        
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }

        this.loadKnowledge();
    }

    /**
     * Load knowledge from storage
     */
    private loadKnowledge() {
        try {
            const basePath = path.join(this.storageDir, 'knowledge.json');
            if (fs.existsSync(basePath)) {
                const data = JSON.parse(fs.readFileSync(basePath, 'utf-8'));
                data.entries?.forEach((entry: KnowledgeEntry) => {
                    this.knowledgeBase.set(entry.id, entry);
                });
                data.patterns?.forEach((pattern: TeamPattern) => {
                    this.patterns.set(pattern.name, pattern);
                });
                data.decisions?.forEach((decision: CodeDecision) => {
                    this.decisions.set(decision.id, decision);
                });
                data.bestPractices?.forEach((practice: BestPracticeRule) => {
                    this.bestPractices.set(practice.id, practice);
                });
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error loading knowledge: ${error}`);
        }
    }

    /**
     * Save knowledge to storage
     */
    private saveKnowledge() {
        try {
            const data = {
                entries: Array.from(this.knowledgeBase.values()),
                patterns: Array.from(this.patterns.values()),
                decisions: Array.from(this.decisions.values()),
                bestPractices: Array.from(this.bestPractices.values()),
                lastUpdated: Date.now()
            };
            fs.writeFileSync(
                path.join(this.storageDir, 'knowledge.json'),
                JSON.stringify(data, null, 2)
            );
        } catch (error) {
            this.outputChannel.appendLine(`Error saving knowledge: ${error}`);
        }
    }

    /**
     * Record a lesson learned
     */
    async recordLessonLearned(
        title: string,
        description: string,
        context: string,
        author: string
    ): Promise<KnowledgeEntry | null> {
        try {
            // Use AI to enhance the lesson
            const prompt = `Enhance this lesson learned entry:

Title: ${title}
Description: ${description}
Context: ${context}

Generate:
1. Better title (if needed)
2. Category (pattern/best-practice/pitfall/decision/lesson-learned)
3. Key tags (3-5)
4. Better description

Format as JSON:
{
    "title": "title",
    "category": "lesson-learned",
    "tags": ["tag1", "tag2"],
    "description": "enhanced description"
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                return null;
            }

            const enhanced = JSON.parse(jsonMatch[0]);
            const id = `lesson-${Date.now()}`;

            const entry: KnowledgeEntry = {
                id,
                title: enhanced.title,
                description: enhanced.description,
                category: enhanced.category,
                author,
                timestamp: Date.now(),
                tags: enhanced.tags,
                context,
                relatedEntries: [],
                ratings: [],
                views: 0
            };

            this.knowledgeBase.set(id, entry);
            this.saveKnowledge();

            this.outputChannel.appendLine(`📚 Lesson learned recorded: ${entry.title}`);
            return entry;
        } catch (error) {
            this.outputChannel.appendLine(`Error recording lesson: ${error}`);
            return null;
        }
    }

    /**
     * Record architectural decision
     */
    async recordArchitecturalDecision(
        title: string,
        context: string,
        decision: string,
        author: string,
        affectedFiles: string[]
    ): Promise<CodeDecision | null> {
        try {
            // Use AI to analyze decision
            const prompt = `Analyze this architectural decision:

Title: ${title}
Context: ${context}
Decision: ${decision}
Affected Files: ${affectedFiles.join(', ')}

Provide:
1. Alternative approaches (3)
2. Rationale for this decision
3. Potential consequences

Format as JSON:
{
    "alternatives": ["alt1", "alt2", "alt3"],
    "rationale": "explanation",
    "consequences": ["consequence1", "consequence2"]
}`;

            const response = await callAI(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                return null;
            }

            const analysis = JSON.parse(jsonMatch[0]);
            const id = `decision-${Date.now()}`;

            const codeDecision: CodeDecision = {
                id,
                title,
                context,
                decision,
                alternatives: analysis.alternatives,
                rationale: analysis.rationale,
                consequences: analysis.consequences,
                author,
                timestamp: Date.now(),
                affectedFiles,
                status: 'active'
            };

            this.decisions.set(id, codeDecision);
            this.saveKnowledge();

            this.outputChannel.appendLine(`🏗️ Architectural decision recorded: ${title}`);
            return codeDecision;
        } catch (error) {
            this.outputChannel.appendLine(`Error recording decision: ${error}`);
            return null;
        }
    }

    /**
     * Record a team pattern
     */
    async recordTeamPattern(
        name: string,
        description: string,
        codeExample: string,
        applicableTo: string[],
        author: string
    ): Promise<TeamPattern | null> {
        try {
            // Check if pattern exists
            if (this.patterns.has(name)) {
                const existing = this.patterns.get(name)!;
                existing.frequency += 1;
                existing.lastUsed = Date.now();
                existing.contributors.push(author);
                this.saveKnowledge();
                return existing;
            }

            const pattern: TeamPattern = {
                name,
                description,
                codeExample,
                applicableTo,
                difficulty: 'intermediate',
                frequency: 1,
                lastUsed: Date.now(),
                contributors: [author]
            };

            this.patterns.set(name, pattern);
            this.saveKnowledge();

            this.outputChannel.appendLine(`✨ Team pattern recorded: ${name}`);
            return pattern;
        } catch (error) {
            this.outputChannel.appendLine(`Error recording pattern: ${error}`);
            return null;
        }
    }

    /**
     * Add best practice rule
     */
    async addBestPractice(
        name: string,
        description: string,
        rationale: string,
        examples: { good: string; bad: string },
        applicable: string[]
    ): Promise<BestPracticeRule | null> {
        try {
            const id = `bp-${Date.now()}`;

            const rule: BestPracticeRule = {
                id,
                name,
                description,
                rationale,
                checkCode: '', // Could be implemented with code inspection
                examples,
                severity: 'warning',
                applicable,
                enforceable: true
            };

            this.bestPractices.set(id, rule);
            this.saveKnowledge();

            this.outputChannel.appendLine(`✅ Best practice added: ${name}`);
            return rule;
        } catch (error) {
            this.outputChannel.appendLine(`Error adding best practice: ${error}`);
            return null;
        }
    }

    /**
     * Get related knowledge entries
     */
    async findRelatedKnowledge(query: string): Promise<KnowledgeEntry[]> {
        const related: KnowledgeEntry[] = [];

        for (const entry of this.knowledgeBase.values()) {
            if (entry.tags.some(t => t.includes(query)) ||
                entry.description.toLowerCase().includes(query.toLowerCase())) {
                related.push(entry);
            }
        }

        return related;
    }

    /**
     * Show team knowledge dashboard
     */
    async showKnowledgeDashboard() {
        const panel = vscode.window.createWebviewPanel(
            'teamKnowledge',
            'Team Knowledge Center',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const entriesCount = this.knowledgeBase.size;
        const patternsCount = this.patterns.size;
        const decisionsCount = this.decisions.size;
        const practicesCount = this.bestPractices.size;

        const topPatterns = Array.from(this.patterns.values())
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);

        const recentDecisions = Array.from(this.decisions.values())
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);

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
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin: 20px 0;
        }
        .stat-box {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-number {
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 12px;
            color: #858585;
        }
        .section {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        h2 {
            color: #667eea;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .item {
            background: #1e1e1e;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid #667eea;
        }
        .item-title {
            font-weight: bold;
            margin-bottom: 3px;
        }
        .item-meta {
            font-size: 11px;
            color: #858585;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 Team Knowledge Center</h1>
        <p style="color: rgba(255,255,255,0.7); margin-top: 10px;">
            Centralized repository of team patterns, decisions, and best practices
        </p>
    </div>

    <div class="stats">
        <div class="stat-box">
            <div class="stat-number">${entriesCount}</div>
            <div class="stat-label">Knowledge Entries</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${patternsCount}</div>
            <div class="stat-label">Team Patterns</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${decisionsCount}</div>
            <div class="stat-label">Decisions</div>
        </div>
        <div class="stat-box">
            <div class="stat-number">${practicesCount}</div>
            <div class="stat-label">Best Practices</div>
        </div>
    </div>

    ${topPatterns.length > 0 ? `
    <div class="section">
        <h2>🌟 Top Team Patterns</h2>
        ${topPatterns.map(p => `
            <div class="item">
                <div class="item-title">${p.name}</div>
                <div class="item-meta">Used ${p.frequency} times | ${p.contributors.join(', ')}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${recentDecisions.length > 0 ? `
    <div class="section">
        <h2>🏗️ Recent Decisions</h2>
        ${recentDecisions.map(d => `
            <div class="item">
                <div class="item-title">${d.title}</div>
                <div class="item-meta">By ${d.author} | ${new Date(d.timestamp).toLocaleDateString()}</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>📖 Getting Started</h2>
        <div class="item">
            <div class="item-title">Add a New Lesson Learned</div>
            <div class="item-meta">Use the command: "Record Lesson Learned"</div>
        </div>
        <div class="item">
            <div class="item-title">Document Architectural Decision</div>
            <div class="item-meta">Use the command: "Record Architectural Decision"</div>
        </div>
        <div class="item">
            <div class="item-title">Share a Team Pattern</div>
            <div class="item-meta">Use the command: "Record Team Pattern"</div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Get statistics
     */
    getStatistics() {
        return {
            totalEntries: this.knowledgeBase.size,
            totalPatterns: this.patterns.size,
            totalDecisions: this.decisions.size,
            totalBestPractices: this.bestPractices.size,
            mostFrequentPattern: Array.from(this.patterns.values())
                .sort((a, b) => b.frequency - a.frequency)[0]?.name || 'None'
        };
    }

    dispose() {
        this.outputChannel.dispose();
    }
}

/**
 * Register team knowledge commands
 */
export function registerTeamKnowledgeCommands(context: vscode.ExtensionContext) {
    const knowledgeSystem = new TeamKnowledgeSystem(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.knowledge.recordLesson', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Lesson title'
            });
            if (!title) {return;}

            const description = await vscode.window.showInputBox({
                prompt: 'Description'
            });
            if (!description) {return;}

            const author = 'Current User'; // Could be enhanced to get actual user

            const editor = vscode.window.activeTextEditor;
            const context = editor ? editor.document.fileName : 'General';

            const lesson = await knowledgeSystem.recordLessonLearned(title, description, context, author);
            if (lesson) {
                vscode.window.showInformationMessage(`✅ Lesson recorded: ${lesson.title}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.knowledge.recordDecision', async () => {
            const title = await vscode.window.showInputBox({
                prompt: 'Decision title'
            });
            if (!title) {return;}

            const decision = await vscode.window.showInputBox({
                prompt: 'What was decided?'
            });
            if (!decision) {return;}

            const author = 'Current User';
            const editor = vscode.window.activeTextEditor;
            const file = editor?.document.fileName || 'Unknown';

            const recorded = await knowledgeSystem.recordArchitecturalDecision(
                title,
                'Editor context',
                decision,
                author,
                [file]
            );

            if (recorded) {
                vscode.window.showInformationMessage(`✅ Decision recorded: ${recorded.title}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.knowledge.recordPattern', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Pattern name'
            });
            if (!name) {return;}

            const description = await vscode.window.showInputBox({
                prompt: 'Pattern description'
            });
            if (!description) {return;}

            const editor = vscode.window.activeTextEditor;
            const code = editor ? editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection) : '';

            const author = 'Current User';

            const pattern = await knowledgeSystem.recordTeamPattern(
                name,
                description,
                code,
                ['typescript', 'javascript'],
                author
            );

            if (pattern) {
                vscode.window.showInformationMessage(`✅ Pattern recorded: ${pattern.name}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('coding.knowledge.showDashboard', async () => {
            await knowledgeSystem.showKnowledgeDashboard();
        })
    );
}
