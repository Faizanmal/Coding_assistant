// Main webview module exports
// This file provides a clean interface to all webview functionality

// Core providers
export { EnhancedSidebarProvider } from './enhanced-sidebar-provider';
export { LightweightSidebarProvider } from './lightweight-sidebar-provider';

// Utilities
export { WebviewHtmlGenerator } from './html-generator';
export { WebviewMessageHandlers } from './message-handlers';
export { SidebarUtils } from './sidebar-utils';
export { generateCodeUnified } from './code-generation';

// Types
export * from './types';

// Default exports for backward compatibility
// export { EnhancedSidebarProvider as ChatSidebarViewProvider };
// export { LightweightSidebarProvider as SimpleSidebarViewProvider };

// Factory function to create appropriate sidebar provider
// export function createSidebarProvider(
//     type: 'enhanced' | 'lightweight',
//     context: vscode.ExtensionContext,
//     highlighter?: any,
//     projectContext?: string
// ) {
//     if (type === 'enhanced') {
//         return new EnhancedSidebarProvider(context, highlighter, projectContext || '');
//     } else {
//         return new LightweightSidebarProvider(context);
//     }
// }

import * as vscode from 'vscode';