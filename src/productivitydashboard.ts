import * as vscode from 'vscode';

interface CodingSession {
    startTime: Date;
    endTime?: Date;
    linesAdded: number;
    linesDeleted: number;
    filesModified: string[];
    languagesUsed: string[];
    duration: number; // in milliseconds
}

interface ProductivityMetrics {
    totalSessions: number;
    totalCodingTime: number; // in milliseconds
    totalLinesWritten: number;
    totalLinesDeleted: number;
    filesModified: number;
    languagesUsed: Set<string>;
    averageSessionDuration: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
    dailyStats: Map<string, {
        duration: number;
        linesWritten: number;
        filesModified: number;
    }>;
    weeklyStats: Map<string, number>;
    monthlyStats: Map<string, number>;
}

export class ProductivityDashboard {
    private static context: vscode.ExtensionContext;
    private static currentSession: CodingSession | null = null;
    private static sessions: CodingSession[] = [];
    private static readonly STORAGE_KEY = 'codingProductivityData';
    private static readonly SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    private static lastActivityTime = Date.now();
    private static activityWatcher: vscode.Disposable | null = null;

    static initialize(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadData();
        this.startTrackingActivity();
    }

    private static loadData() {
        const storedData = this.context.globalState.get(this.STORAGE_KEY, []);
        this.sessions = storedData.map((session: any) => ({
            ...session,
            startTime: new Date(session.startTime),
            endTime: session.endTime ? new Date(session.endTime) : undefined
        }));
    }

    private static saveData() {
        // Keep only last 1000 sessions to prevent storage bloat
        if (this.sessions.length > 1000) {
            this.sessions = this.sessions.slice(-1000);
        }
        this.context.globalState.update(this.STORAGE_KEY, this.sessions);
    }

    private static startTrackingActivity() {
        // Track text document changes
        this.activityWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
            this.recordActivity(event.document);
        });

        // Start initial session if user is active
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            this.startSession();
        }

        // Monitor editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.recordActivity(editor.document);
            } else {
                this.pauseSession();
            }
        });

        // Auto-save data periodically
        setInterval(() => {
            this.saveData();
        }, 60000); // Save every minute
    }

    private static recordActivity(document: vscode.TextDocument) {
        const now = Date.now();
        this.lastActivityTime = now;

        // Start session if not active
        if (!this.currentSession) {
            this.startSession();
        }

        // Extend current session
        if (this.currentSession && document.fileName) {
            const fileName = document.fileName;
            if (!this.currentSession.filesModified.includes(fileName)) {
                this.currentSession.filesModified.push(fileName);
            }

            const languageId = document.languageId;
            if (!this.currentSession.languagesUsed.includes(languageId)) {
                this.currentSession.languagesUsed.push(languageId);
            }

            // Estimate lines changed (rough approximation)
            this.currentSession.linesAdded += 1; // Simplified for now
        }

        // Check for session timeout
        this.checkSessionTimeout();
    }

    private static startSession() {
        if (this.currentSession) {
            this.endSession();
        }

        this.currentSession = {
            startTime: new Date(),
            linesAdded: 0,
            linesDeleted: 0,
            filesModified: [],
            languagesUsed: [],
            duration: 0
        };
    }

    private static pauseSession() {
        if (this.currentSession) {
            this.currentSession.duration = Date.now() - this.currentSession.startTime.getTime();
        }
    }

    private static endSession() {
        if (this.currentSession) {
            this.currentSession.endTime = new Date();
            this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();
            this.sessions.push(this.currentSession);
            this.currentSession = null;
            this.saveData();
        }
    }

    private static checkSessionTimeout() {
        const now = Date.now();
        if (this.currentSession && (now - this.lastActivityTime) > this.SESSION_TIMEOUT) {
            this.endSession();
        }
    }

    static getProductivityMetrics(): ProductivityMetrics {
        const metrics: ProductivityMetrics = {
            totalSessions: this.sessions.length,
            totalCodingTime: 0,
            totalLinesWritten: 0,
            totalLinesDeleted: 0,
            filesModified: 0,
            languagesUsed: new Set(),
            averageSessionDuration: 0,
            mostProductiveHour: 0,
            mostProductiveDay: '',
            dailyStats: new Map(),
            weeklyStats: new Map(),
            monthlyStats: new Map()
        };

        if (this.sessions.length === 0) {
            return metrics;
        }

        // Calculate basic metrics
        const allFiles = new Set<string>();
        const hourlyStats = new Array(24).fill(0);
        const dailyStats = new Map<string, {duration: number, linesWritten: number, filesModified: number}>();
        const weeklyStats = new Map<string, number>();
        const monthlyStats = new Map<string, number>();

        this.sessions.forEach(session => {
            metrics.totalCodingTime += session.duration;
            metrics.totalLinesWritten += session.linesAdded;
            metrics.totalLinesDeleted += session.linesDeleted;

            session.filesModified.forEach(file => allFiles.add(file));
            session.languagesUsed.forEach(lang => metrics.languagesUsed.add(lang));

            // Hourly stats
            const hour = session.startTime.getHours();
            hourlyStats[hour] += session.duration;

            // Daily stats
            const dayKey = session.startTime.toISOString().split('T')[0];
            const existing = dailyStats.get(dayKey) || {duration: 0, linesWritten: 0, filesModified: 0};
            existing.duration += session.duration;
            existing.linesWritten += session.linesAdded;
            existing.filesModified += session.filesModified.length;
            dailyStats.set(dayKey, existing);

            // Weekly stats
            const weekKey = this.getWeekKey(session.startTime);
            weeklyStats.set(weekKey, (weeklyStats.get(weekKey) || 0) + session.duration);

            // Monthly stats
            const monthKey = session.startTime.toISOString().substring(0, 7); // YYYY-MM
            monthlyStats.set(monthKey, (monthlyStats.get(monthKey) || 0) + session.duration);
        });

        metrics.filesModified = allFiles.size;
        metrics.averageSessionDuration = metrics.totalCodingTime / this.sessions.length;
        metrics.mostProductiveHour = hourlyStats.indexOf(Math.max(...hourlyStats));
        metrics.dailyStats = dailyStats;
        metrics.weeklyStats = weeklyStats;
        metrics.monthlyStats = monthlyStats;

        // Find most productive day
        let maxDuration = 0;
        let mostProductiveDay = '';
        dailyStats.forEach((stats, day) => {
            if (stats.duration > maxDuration) {
                maxDuration = stats.duration;
                mostProductiveDay = day;
            }
        });
        metrics.mostProductiveDay = mostProductiveDay;

        return metrics;
    }

    private static getWeekKey(date: Date): string {
        const year = date.getFullYear();
        const week = this.getWeekNumber(date);
        return `${year}-W${week.toString().padStart(2, '0')}`;
    }

    private static getWeekNumber(date: Date): number {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }

    static getTodayStats(): {
        codingTime: number;
        linesWritten: number;
        filesModified: number;
        sessionsCount: number;
        languages: string[];
    } {
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = this.sessions.filter(session => 
            session.startTime.toISOString().split('T')[0] === today
        );

        const languages = new Set<string>();
        const files = new Set<string>();
        let codingTime = 0;
        let linesWritten = 0;

        todaySessions.forEach(session => {
            codingTime += session.duration;
            linesWritten += session.linesAdded;
            session.filesModified.forEach(file => files.add(file));
            session.languagesUsed.forEach(lang => languages.add(lang));
        });

        return {
            codingTime,
            linesWritten,
            filesModified: files.size,
            sessionsCount: todaySessions.length,
            languages: Array.from(languages)
        };
    }

    static getWeeklyTrend(): Array<{date: string, duration: number, productivity: number}> {
        const trend = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            
            const dayStats = this.sessions.filter(session => 
                session.startTime.toISOString().split('T')[0] === dateKey
            );
            
            const duration = dayStats.reduce((sum, session) => sum + session.duration, 0);
            const productivity = dayStats.reduce((sum, session) => sum + session.linesAdded, 0);
            
            trend.push({
                date: dateKey,
                duration,
                productivity
            });
        }
        
        return trend;
    }

    static generateReport(): string {
        const metrics = this.getProductivityMetrics();
        const todayStats = this.getTodayStats();
        const weeklyTrend = this.getWeeklyTrend();

        let report = '# 📊 Productivity Dashboard Report\n\n';
        report += `Generated: ${new Date().toLocaleString()}\n\n`;

        // Today's Stats
        report += '## 🎯 Today\'s Performance\n\n';
        report += `- **Coding Time**: ${this.formatDuration(todayStats.codingTime)}\n`;
        report += `- **Lines Written**: ${todayStats.linesWritten}\n`;
        report += `- **Files Modified**: ${todayStats.filesModified}\n`;
        report += `- **Sessions**: ${todayStats.sessionsCount}\n`;
        report += `- **Languages**: ${todayStats.languages.join(', ')}\n\n`;

        // Overall Stats
        report += '## 📈 Overall Statistics\n\n';
        report += `- **Total Sessions**: ${metrics.totalSessions}\n`;
        report += `- **Total Coding Time**: ${this.formatDuration(metrics.totalCodingTime)}\n`;
        report += `- **Lines Written**: ${metrics.totalLinesWritten.toLocaleString()}\n`;
        report += `- **Files Modified**: ${metrics.filesModified}\n`;
        report += `- **Languages Used**: ${Array.from(metrics.languagesUsed).join(', ')}\n`;
        report += `- **Average Session**: ${this.formatDuration(metrics.averageSessionDuration)}\n`;
        report += `- **Most Productive Hour**: ${metrics.mostProductiveHour}:00\n`;
        report += `- **Most Productive Day**: ${metrics.mostProductiveDay}\n\n`;

        // Weekly Trend
        report += '## 📊 Weekly Trend\n\n';
        weeklyTrend.forEach((day, index) => {
            const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            report += `- **${dayName} (${day.date})**: ${this.formatDuration(day.duration)} | ${day.productivity} lines\n`;
        });

        // Productivity Tips
        report += '\n## 💡 Productivity Insights\n\n';
        if (metrics.mostProductiveHour >= 9 && metrics.mostProductiveHour <= 11) {
            report += '- You\'re most productive in the morning! Consider scheduling complex tasks then.\n';
        } else if (metrics.mostProductiveHour >= 14 && metrics.mostProductiveHour <= 16) {
            report += '- Your peak productivity is in the afternoon. Great for tackling challenging problems!\n';
        }

        if (metrics.averageSessionDuration > 2 * 60 * 60 * 1000) { // 2 hours
            report += '- Your sessions are quite long. Consider taking breaks every 90 minutes.\n';
        }

        if (todayStats.codingTime < metrics.averageSessionDuration) {
            report += '- Today\'s coding time is below your average. You might want to focus more!\n';
        }

        return report;
    }

    private static formatDuration(milliseconds: number): string {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    static clearData() {
        this.sessions = [];
        this.currentSession = null;
        this.saveData();
    }

    static dispose() {
        if (this.activityWatcher) {
            this.activityWatcher.dispose();
        }
        this.endSession();
    }
}
