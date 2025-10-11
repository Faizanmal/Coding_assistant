import * as vscode from 'vscode';
import { ConnectivityHub, FeatureMessage } from '../connectivity-hub';


/**
 * Connectivity Integration Test
 * 
 * This test verifies that all features are properly connected and maintain flow
 * between different components as designed.
 */

export class ConnectivityIntegrationTest {
    private connectivityHub: ConnectivityHub | null = null;
  flowOrchestrator: any;

    constructor(private context: vscode.ExtensionContext) {}

    async runAllTests(): Promise<boolean> {
        try {
            vscode.window.showInformationMessage('🧪 Starting Connectivity Integration Tests...');
            
            // Test 1: Connectivity Hub Initialization
            if (!await this.testConnectivityHubInitialization()) {
                return false;
            }
            

            

            
            // Test 4: Message Routing
            if (!await this.testMessageRouting()) {
                return false;
            }
            

            
            vscode.window.showInformationMessage('✅ All Connectivity Integration Tests Passed!');
            return true;
            
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Connectivity Test Failed: ${error}`);
            return false;
        }
    }

    private async testConnectivityHubInitialization(): Promise<boolean> {
        try {
            this.connectivityHub = ConnectivityHub.getInstance(this.context);
            await this.connectivityHub.initialize();
            
            const status = this.connectivityHub.getSystemStatus();
            if (status.connectivity !== 'connected') {
                throw new Error('Connectivity Hub failed to connect');
            }
            
            vscode.window.showInformationMessage('✅ Connectivity Hub Initialization Test Passed');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Connectivity Hub Test Failed: ${error}`);
            return false;
        }
    }





    private async testMessageRouting(): Promise<boolean> {
        try {
            if (!this.connectivityHub) {
                throw new Error('Connectivity hub not initialized');
            }
            
            // Test message routing
            const testMessage: FeatureMessage = {
                source: 'test',
                target: 'all',
                type: 'data',
                command: 'testMessage',
                payload: { test: true },
                timestamp: new Date(),
                priority: 'medium'
            };
            
            await this.connectivityHub.routeMessage(testMessage);
            
            vscode.window.showInformationMessage('✅ Message Routing Test Passed');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Message Routing Test Failed: ${error}`);
            return false;
        }
    }



    generateTestReport(): string {
        let report = '# Connectivity Integration Test Report\n\n';
        
        if (this.connectivityHub) {
            const status = this.connectivityHub.getSystemStatus();
            report += '## Connectivity Hub Status\n';
            report += `- System Status: ${status.connectivity}\n`;
            report += `- Active Providers: ${status.activeProviders.join(', ')}\n`;
            report += `- NLP Engine: ${status.nlpEngineStatus}\n`;
            report += `- Message Queue: ${status.messageQueueLength} messages\n\n`;
        }
        
        if (this.flowOrchestrator) {
            const metrics = this.flowOrchestrator.getMetrics();
            const providers = this.flowOrchestrator.getProviderStatus();
            
            report += '## Sidebar Flow Orchestrator Status\n';
            report += `- Active Provider: ${metrics.activeProvider}\n`;
            report += `- Messages Throughput: ${metrics.messagesThroughput}\n`;
            report += `- Provider Switches: ${metrics.providerSwitches}\n\n`;
            
            report += '## Provider Status\n';
            for (const [name, status] of providers) {
                report += `- ${name}: ${status.status} (${status.messageCount} messages)\n`;
            }
        }
        
        return report;
    }
}

// Export command for testing
export async function runConnectivityTests(context: vscode.ExtensionContext): Promise<void> {
    const tester = new ConnectivityIntegrationTest(context);
    const success = await tester.runAllTests();
    
    if (success) {
        const report = tester.generateTestReport();
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
}