import * as vscode from 'vscode';

// A map to store the history of variable changes for each debug session.
const variableHistory = new Map<string, Map<string, { value: string; step: number }[]>>();
let stepCounter = 0;

class TimeTravelDebugAdapterTracker implements vscode.DebugAdapterTracker {
    constructor(private session: vscode.DebugSession) {}

    onDidSendMessage(message: any): void {
        if (message.type === 'event' && message.event === 'stopped') {
            stepCounter++;
            this.captureVariableState();
        }
    }

    private async captureVariableState() {
        if (!this.session) {return;}

        try {
            const stackTrace = await this.session.customRequest('stackTrace', { threadId: 1 });
            if (stackTrace && stackTrace.stackFrames.length > 0) {
                const frameId = stackTrace.stackFrames[0].id;
                const scopes = await this.session.customRequest('scopes', { frameId });
                if (scopes && scopes.scopes.length > 0) {
                    const variablesReference = scopes.scopes[0].variablesReference;
                    const variables = await this.session.customRequest('variables', { variablesReference });

                    if (variables && variables.variables) {
                        if (!variableHistory.has(this.session.id)) {
                            variableHistory.set(this.session.id, new Map());
                        }
                        const sessionHistory = variableHistory.get(this.session.id)!;

                        for (const variable of variables.variables) {
                            if (!sessionHistory.has(variable.name)) {
                                sessionHistory.set(variable.name, []);
                            }
                            const history = sessionHistory.get(variable.name)!;
                            history.push({ value: variable.value, step: stepCounter });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error capturing variable state:', error);
        }
    }
}

export function activateTimeTravelDebugger(context: vscode.ExtensionContext) {
    const factory: vscode.DebugAdapterTrackerFactory = {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            return new TimeTravelDebugAdapterTracker(session);
        }
    };

    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', factory));

    context.subscriptions.push(vscode.debug.onDidStartDebugSession(() => {
        stepCounter = 0;
        variableHistory.clear();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('coding.generateDebugSummary', () => {
        const lastSessionId = Array.from(variableHistory.keys()).pop();
        if (!lastSessionId) {
            vscode.window.showInformationMessage('No debugging history found.');
            return;
        }

        const sessionHistory = variableHistory.get(lastSessionId);
        if (!sessionHistory) {
            vscode.window.showInformationMessage('No debugging history for the last session.');
            return;
        }

        let markdown = '# Time-Travel Debugging Summary\n\n';
        const steps = Array.from({ length: stepCounter }, (_, i) => i + 1);
        const variableNames = Array.from(sessionHistory.keys());

        markdown += '| Variable | ' + steps.map(s => `Step ${s}`).join(' | ') + ' |\n';
        markdown += '|:---|' + steps.map(() => ':---').join('|') + '|\n';

        for (const name of variableNames) {
            const history = sessionHistory.get(name)!;
            let row = `| ${name} |`;
            for (const step of steps) {
                const entry = history.find(h => h.step === step);
                row += ` ${entry ? entry.value : ''} |`;
            }
            markdown += row + '\n';
        }

        vscode.workspace.openTextDocument({ content: markdown, language: 'markdown' }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }));
}
