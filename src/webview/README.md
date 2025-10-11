# Webview Module Structure

This directory contains the modular webview architecture for better code maintainability and organization.

## File Structure

```
webview/
├── index.ts                           # Main exports and factory functions
├── types.ts                          # TypeScript interfaces and types
├── html-generator.ts                 # HTML generation utilities
├── message-handlers.ts               # Message handling logic
├── code-generation.ts                # Unified code generation
├── sidebar-utils.ts                  # Shared utility functions
├── enhanced-sidebar-provider.ts      # Full-featured sidebar (replaces sidebar.ts)
├── lightweight-sidebar-provider.ts   # Simplified sidebar (replaces sidebar_simple.ts)
└── README.md                         # This file
```

## Architecture Overview

### 1. **Types System** (`types.ts`)
- Comprehensive TypeScript interfaces for webview communication
- Message types for both directions (webview ↔ extension)
- Chat history, terminal sessions, and coordination types
- Provider configuration and state management types

### 2. **HTML Generation** (`html-generator.ts`)
- Modular HTML generation with theme support
- Highlight.io integration for debugging
- Responsive design with VS Code theme compatibility
- Reusable components and styling

### 3. **Message Handling** (`message-handlers.ts`)
- Centralized message routing and processing
- Specialized handlers for different command types
- Error handling and validation
- Async operation management

### 4. **Utility Functions** (`sidebar-utils.ts`)
- Shell command execution
- File system operations
- Text processing and formatting
- Validation and helper functions

### 5. **Provider Implementations**

#### Enhanced Sidebar (`enhanced-sidebar-provider.ts`)
- **Full Feature Set**: All advanced capabilities from original sidebar.ts
- **Smart Coordination**: Multi-agent systems and conflict prevention
- **Advanced UI**: Rich progress tracking and status updates
- **Use Case**: Production environments, complex projects

#### Lightweight Sidebar (`lightweight-sidebar-provider.ts`)
- **Essential Features**: Core functionality from sidebar_simple.ts
- **Streamlined UI**: Clean, fast interface
- **Better Performance**: Reduced overhead and complexity
- **Use Case**: Simple projects, development environments

## Migration Guide

### From `sidebar.ts`
```typescript
// Old import
import { ChatSidebarViewProvider } from './sidebar';

// New import (enhanced features)
import { EnhancedSidebarProvider } from './webview';
// or
import { createSidebarProvider } from './webview';
const provider = createSidebarProvider('enhanced', context, highlighter, projectContext);
```

### From `sidebar_simple.ts`
```typescript
// Old import
import { SimpleSidebarViewProvider } from './sidebar_simple';

// New import (lightweight)
import { LightweightSidebarProvider } from './webview';
// or
import { createSidebarProvider } from './webview';
const provider = createSidebarProvider('lightweight', context);
```

## Key Benefits

### 🏗️ **Better Architecture**
- Clear separation of concerns
- Reusable components
- Type-safe interfaces
- Modular design

### 🔧 **Improved Maintainability**
- Single responsibility principle
- Easier debugging and testing
- Better code organization
- Reduced duplication

### ⚡ **Enhanced Performance**
- Lightweight option for simple use cases
- Optimized HTML generation
- Efficient message handling
- Better memory management

### 🔐 **Security & Reliability**
- Input validation and sanitization
- Error boundary handling
- Highlight.io integration for debugging
- Comprehensive logging

### 🎨 **User Experience**
- Consistent theming
- Responsive design
- Better accessibility
- Enhanced visual feedback

## Usage Examples

### Basic Setup
```typescript
import { createSidebarProvider } from './webview';

// Create enhanced sidebar
const enhancedSidebar = createSidebarProvider('enhanced', context, highlighter, projectContext);

// Create lightweight sidebar
const lightweightSidebar = createSidebarProvider('lightweight', context);

// Register with VS Code
vscode.window.registerWebviewViewProvider('coding.sidebarView', enhancedSidebar);
```

### Custom Message Handler
```typescript
import { WebviewMessageHandlers } from './webview';

const handlers = new WebviewMessageHandlers(context, view);
await handlers.initialize();

// Get handler registry for custom routing
const registry = handlers.getHandlerRegistry();
```

### HTML Generation
```typescript
import { WebviewHtmlGenerator } from './webview';

const html = WebviewHtmlGenerator.generateHtml({
    chatBody: chatHistory,
    theme: 'dark',
    enableHighlight: true,
    customStyles: '.my-style { color: red; }'
});
```

## Development Guidelines

### Adding New Features
1. **Types First**: Define interfaces in `types.ts`
2. **Handler Logic**: Implement in `message-handlers.ts`
3. **UI Components**: Add to `html-generator.ts`
4. **Utilities**: Add helpers to `sidebar-utils.ts`
5. **Integration**: Update providers as needed

### Testing
- Each module can be tested independently
- Mock dependencies for unit testing
- Use Highlight.io for debugging webview issues

### Performance Considerations
- Choose appropriate provider (enhanced vs lightweight)
- Minimize HTML generation frequency
- Use debouncing for frequent operations
- Implement proper error boundaries

## Troubleshooting

### Common Issues
1. **Import Errors**: Use the new import paths from `./webview/`
2. **Type Mismatches**: Check `types.ts` for updated interfaces
3. **Missing Features**: Ensure using correct provider (enhanced vs lightweight)
4. **Webview Not Loading**: Check Highlight.io integration and CSP settings

### Debug Tools
- Use Highlight.io dashboard for webview debugging
- Check VS Code developer console for errors
- Enable debug logging in message handlers
- Use webview developer tools (F12 in webview)

## Contributing

When adding new functionality:
1. Follow the established architecture patterns
2. Add appropriate TypeScript types
3. Include error handling
4. Update documentation
5. Test with both provider types

## Future Enhancements

- [ ] Plugin system for custom message handlers
- [ ] Theme customization API
- [ ] Advanced caching for better performance
- [ ] Real-time collaboration features
- [ ] Enhanced accessibility support