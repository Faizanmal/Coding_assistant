import * as vscode from 'vscode';

/**
 * Highlight.io Integration for VSCode Extension Debugging
 * 
 * This utility provides comprehensive debugging capabilities including:
 * - Session recording for webview interactions
 * - Error tracking and reporting
 * - Performance monitoring
 * - Real-time debugging insights
 */
export class HighlightConfig {
    private static instance: HighlightConfig;
    private projectId: string;
    private isInitialized: boolean = false;

    private constructor() {
        // Use the provided project ID with fallback to environment
        this.projectId = process.env.HIGHLIGHT_PROJECT_ID || 
                        vscode.workspace.getConfiguration('coding').get('highlight.projectId') || 
                        '6gl5km7e';
    }

    public static getInstance(): HighlightConfig {
        if (!HighlightConfig.instance) {
            HighlightConfig.instance = new HighlightConfig();
        }
        return HighlightConfig.instance;
    }

    /**
     * Initialize Highlight.io for webview debugging
     * Returns JavaScript code to inject into webview
     */
    public initializeWebview(): string {
        const highlightScript = `
            <script src="https://unpkg.com/highlight.run/dist/index.js"></script>
            <script>
                try {
                    // Import and initialize Highlight.io with your specific configuration
                    const { H } = window.Highlight || window;
                    
                    H.init('${this.projectId}', {
                        serviceName: "vscode-extension-webview",
                        tracingOrigins: true,
                        environment: 'development',
                        networkRecording: {
                            enabled: true,
                            recordHeadersAndBody: true,
                            urlBlocklist: [
                                "https://www.googleapis.com/identitytoolkit",
                                "https://securetoken.googleapis.com",
                                "vscode-webview://",
                                "vscode-resource://"
                            ]
                        },
                        enableStrictPrivacy: false,
                        enableCanvasRecording: true,
                        enablePerformanceRecording: true,
                        sessionShortcut: true
                    });

                    // Track webview load
                    H.track('VSCode Webview Loaded', {
                        webview: 'sidebar',
                        serviceName: 'vscode-extension-webview',
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    });

                    // Enhanced button click tracking
                    function trackButtonClick(buttonId, action) {
                        console.log('Button clicked:', buttonId, action);
                        H.track('Button Click', {
                            buttonId: buttonId,
                            action: action,
                            serviceName: 'vscode-extension-webview',
                            timestamp: new Date().toISOString(),
                            url: window.location.href
                        });
                    }

                    // Enhanced error tracking
                    window.addEventListener('error', (event) => {
                        console.error('JavaScript Error:', event.error);
                        H.consumeError(event.error, {
                            source: 'webview',
                            serviceName: 'vscode-extension-webview',
                            filename: event.filename,
                            lineno: event.lineno,
                            colno: event.colno
                        });
                    });

                    // Track unhandled promise rejections
                    window.addEventListener('unhandledrejection', (event) => {
                        console.error('Unhandled Promise Rejection:', event.reason);
                        H.consumeError(new Error(event.reason), {
                            source: 'webview-promise',
                            serviceName: 'vscode-extension-webview',
                            type: 'unhandled-rejection'
                        });
                    });

                    // Expose tracking functions globally with H reference
                    window.highlightTrack = {
                        buttonClick: trackButtonClick,
                        customEvent: (eventName, properties) => {
                            H.track(eventName, {
                                ...properties,
                                serviceName: 'vscode-extension-webview'
                            });
                        },
                        error: (error, properties) => {
                            H.consumeError(error, {
                                ...properties,
                                serviceName: 'vscode-extension-webview'
                            });
                        },
                        // Direct access to H for advanced usage
                        H: H
                    };

                    console.log('✅ Highlight.io initialized successfully');
                } catch (error) {
                    console.error('❌ Failed to initialize Highlight.io:', error);
                }
            </script>
        `;

        return highlightScript;
    }

    /**
     * Get Highlight.io initialization script for HTML injection
     */
    public getWebviewScript(): string {
        return this.initializeWebview();
    }

    /**
     * Initialize Highlight.io on the extension side (Node.js)
     */
    public async initializeExtension(): Promise<void> {
        try {
            // For VSCode extensions, we'll focus on webview tracking
            // Node.js SDK integration can be added later if needed
            this.isInitialized = true;
            console.log('✅ Highlight.io extension tracking initialized with project ID:', this.projectId);
            console.log('ℹ️ Node.js SDK integration available for advanced server-side tracking');
        } catch (error) {
            console.error('❌ Failed to initialize Highlight.io extension tracking:', error);
        }
    }

    /**
     * Track extension events
     */
    public trackEvent(eventName: string, properties: Record<string, any> = {}): void {
        if (!this.isInitialized) {
            console.warn('Highlight.io not initialized, skipping event tracking');
            return;
        }

        try {
            // Log to console for debugging
            console.log(`📊 Tracking: ${eventName}`, properties);
            
            // In a real implementation, you'd send this to Highlight.io
            // For now, we'll log it for debugging purposes
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }

    /**
     * Get Content Security Policy directives for Highlight.io
     */
    public getCSPDirectives(): string {
        return `
            script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://static.highlight.io;
            connect-src 'self' https://pub.highlight.io https://otel.highlight.io:4318 https://static.highlight.io;
            img-src 'self' data: https://static.highlight.io;
            style-src 'unsafe-inline' https://static.highlight.io;
        `;
    }

    /**
     * Generate enhanced HTML with Highlight.io integration
     */
    public enhanceWebviewHTML(baseHTML: string): string {
        const highlightScript = this.getWebviewScript();
        
        // Insert Highlight.io script before closing head tag
        const enhancedHTML = baseHTML.replace(
            '</head>', 
            `${highlightScript}</head>`
        );

        return enhancedHTML;
    }

    /**
     * Create debugging dashboard HTML
     */
    public createDebugDashboard(): string {
        return `
            <div id="highlight-debug-dashboard" style="background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 12px;">
                <h4>🔍 Highlight.io Debug Dashboard</h4>
                <div id="debug-info">
                    <p>Project ID: ${this.projectId}</p>
                    <p>Status: <span id="highlight-status">Initializing...</span></p>
                    <p>Session: <span id="session-id">Loading...</span></p>
                </div>
                <button onclick="testHighlightTracking()" style="padding: 5px 10px; margin: 5px;">
                    Test Tracking
                </button>
                <button onclick="triggerTestError()" style="padding: 5px 10px; margin: 5px;">
                    Test Error
                </button>
            </div>
            <script>
                function testHighlightTracking() {
                    if (window.highlightTrack && window.highlightTrack.H) {
                        window.highlightTrack.customEvent('Debug Dashboard Test', {
                            source: 'debug-dashboard',
                            testType: 'manual-test',
                            timestamp: new Date().toISOString()
                        });
                        console.log('✅ Test tracking event sent with service:', 'vscode-extension-webview');
                    } else {
                        console.warn('❌ Highlight tracking not available');
                    }
                }

                function triggerTestError() {
                    try {
                        throw new Error('Test error from debug dashboard');
                    } catch (error) {
                        if (window.highlightTrack) {
                            window.highlightTrack.error(error, { source: 'debug-dashboard' });
                        }
                        console.error('Test error triggered:', error);
                    }
                }

                // Update status when Highlight.io is ready
                setTimeout(() => {
                    const statusElement = document.getElementById('highlight-status');
                    const sessionElement = document.getElementById('session-id');
                    
                    if (window.highlightTrack && window.highlightTrack.H && window.highlightTrack.H.getSessionURL) {
                        statusElement.textContent = 'Connected ✅ (Service: vscode-extension-webview)';
                        sessionElement.innerHTML = '<a href="' + window.highlightTrack.H.getSessionURL() + '" target="_blank">View Session</a>';
                    } else {
                        statusElement.textContent = 'Disconnected ❌';
                        sessionElement.textContent = 'N/A';
                    }
                }, 2000);
            </script>
        `;
    }
}

/**
 * Helper function to get Highlight.io instance
 */
export function getHighlight(): HighlightConfig {
    return HighlightConfig.getInstance();
}