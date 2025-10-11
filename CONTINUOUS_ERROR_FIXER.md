# Continuous Error Fixer System

## Overview

The Continuous Error Fixer is an advanced autonomous system that continuously monitors your workspace for coding issues and automatically fixes them. It uses VS Code's Global Search API (Diagnostics API) to detect errors in real-time and coordinates between intelligent agents to resolve them.

## Architecture

### System Components

#### 1. **Continuous Error Fixer (Main Controller)**
- **File**: `src/continuous-error-fixer.ts`
- **Purpose**: Main orchestration engine that manages the continuous loop
- **Responsibilities**:
  - Listens to VS Code diagnostics changes in real-time
  - Maintains an error queue for processing
  - Spawns and manages Looping and Replacing agents
  - Provides status updates via the sidebar chat
  - Controls the main processing loop

#### 2. **Looping Agents**
- **File**: `src/looping-agent.ts`
- **Purpose**: Detect and analyze errors, generate fix suggestions
- **Responsibilities**:
  - Analyze diagnostic errors from VS Code
  - Determine fix type: correction or generation
  - Generate code fixes with confidence scores
  - Support multiple languages (TypeScript, JavaScript, Python, etc.)
  - Provide detailed explanations for each fix

**Fix Types**:
- **Correction**: Fix existing code (syntax errors, type mismatches, etc.)
- **Generation**: Create new code (missing functions, classes, imports)

#### 3. **Replacing Agents**
- **File**: `src/replacing-agent.ts`
- **Purpose**: Safely apply code changes without corruption
- **Responsibilities**:
  - Validate fixes before applying them
  - Apply changes with rollback capability
  - Verify file integrity after changes
  - Check for new errors introduced by fixes
  - Ensure no conflicts with existing logic

**Safety Features**:
- Pre-apply validation
- Post-apply verification
- Automatic rollback on failure
- Syntax checking
- File structure validation

#### 4. **Agent Coordinator**
- **File**: `src/agent-coordinator.ts`
- **Purpose**: Manage coordination between agents
- **Responsibilities**:
  - Control file access to prevent conflicts
  - Maintain access queues for contested files
  - Register and track all agents
  - Detect potential conflicts
  - Ensure thread-safe operations

**Coordination Features**:
- File locking mechanism
- Request queuing system
- Conflict detection
- Agent lifecycle management

#### 5. **Sidebar Chat Messenger**
- **File**: `src/sidebar-chat-messenger.ts`
- **Purpose**: Send progress updates to the sidebar
- **Responsibilities**:
  - Format and send messages to chat panel
  - Display progress updates
  - Show error/success/warning notifications
  - Maintain message history
  - Provide multiple output channels

## How It Works

### 1. Initialization
```
User activates Continuous Error Fixer
    ↓
System sets up diagnostics listener
    ↓
Initial workspace scan performed
    ↓
Main processing loop starts
```

### 2. Error Detection Flow
```
VS Code detects error in file
    ↓
Diagnostic event triggered
    ↓
Error added to queue
    ↓
Sidebar notification sent
```

### 3. Error Processing Flow
```
Main loop processes queue (every 5 seconds)
    ↓
Looping Agent created for file
    ↓
Agent analyzes diagnostics
    ↓
Fix suggestions generated
    ↓
Replacing Agent requested
```

### 4. Fix Application Flow
```
Replacing Agent requests file access
    ↓
Coordinator grants access (if available)
    ↓
Pre-validation performed
    ↓
Fix applied to file
    ↓
Post-validation performed
    ↓
File saved (or rollback if failed)
    ↓
Access released
```

### 5. Agent Coordination
```
Agent A requests file access
    ↓
File already locked by Agent B?
    ├─ Yes → Add to queue, wait
    └─ No  → Grant access immediately
         ↓
    Agent A performs operation
         ↓
    Agent A releases access
         ↓
    Process queue for next agent
```

## Usage

### Commands

1. **Start Continuous Error Fixer**
   - Command: `coding-assistant.startContinuousFixer`
   - Shortcut: Command Palette → "🔄 Start Continuous Error Fixer"
   - Starts the continuous monitoring and fixing loop

2. **Stop Continuous Error Fixer**
   - Command: `coding-assistant.stopContinuousFixer`
   - Shortcut: Command Palette → "🛑 Stop Continuous Error Fixer"
   - Stops all agents and clears the queue

3. **Toggle Continuous Error Fixer**
   - Command: `coding-assistant.toggleContinuousFixer`
   - Shortcut: Command Palette → "🔀 Toggle Continuous Error Fixer"
   - Toggles the system on/off
   - Also available via status bar item

4. **Show Fixer Status**
   - Command: `coding-assistant.showFixerStatus`
   - Shortcut: Command Palette → "📊 Show Continuous Fixer Status"
   - Displays current system status

### Status Bar

The status bar item shows the current state:
- **Active**: `$(sync~spin) Error Fixer Active` (orange background)
- **Inactive**: `$(bug) Error Fixer Off`

Click the status bar item to toggle the system.

## Sidebar Chat Messages

The system sends various types of messages to the sidebar:

### Message Types

- **🚀 System Messages**: System start/stop notifications
- **🔍 Info Messages**: Error detection, agent activation
- **✅ Success Messages**: Successful fixes applied
- **⚠️ Warning Messages**: Skipped fixes, low confidence
- **❌ Error Messages**: Failed operations
- **⏳ Progress Messages**: Operation progress updates

### Example Messages

```
🚀 Continuous Error Fixer Started
Scanning workspace for errors...

📊 Found 5 total error(s) across 3 file(s)

🔍 Detected 2 error(s) in `src/example.ts`

🤖 Looping Agent activated for `src/example.ts`

🔧 Replacing Agent activated for `src/example.ts`

✓ Applied fix: Added missing semicolon (confidence: 95%)

✅ Successfully applied 2 fix(es)
```

## Configuration

### Loop Interval
The main loop processes errors every **5 seconds** (configurable in `continuous-error-fixer.ts`):

```typescript
this.loopInterval = setInterval(async () => {
    // Process errors
}, 5000); // Change this value to adjust frequency
```

### Confidence Threshold
Fixes with confidence below **50%** are skipped (configurable in `looping-agent.ts`):

```typescript
if (confidence < 0.5) {
    // Skip low confidence fixes
}
```

### Message History
The sidebar messenger maintains the last **100 messages** (configurable in `sidebar-chat-messenger.ts`):

```typescript
private maxHistorySize: number = 100;
```

## Supported Languages

The system supports multiple programming languages with language-specific fixes:

### TypeScript/JavaScript
- Missing semicolons
- Undefined variables
- Type mismatches
- Missing imports
- Unbalanced braces/parentheses

### Python
- Indentation errors
- Missing colons
- Undefined names
- Import issues

### Generic Support
- Basic syntax cleanup for other languages

## Safety Features

### 1. **Pre-Application Validation**
- Verify range is still valid
- Check original code hasn't changed
- Validate syntax of suggested code

### 2. **Post-Application Verification**
- Check for new errors introduced
- Verify file can be parsed
- Validate file structure integrity

### 3. **Automatic Rollback**
- Backup original content before changes
- Rollback on validation failure
- Restore file to working state

### 4. **File Locking**
- Prevent concurrent modifications
- Queue competing requests
- Ensure data consistency

### 5. **Error Handling**
- Graceful degradation on failures
- Comprehensive error logging
- User notifications for issues

## Advanced Features

### Conflict Prevention
The Agent Coordinator prevents conflicts by:
- Implementing file-level locking
- Maintaining access queues
- Detecting git merge conflicts
- Checking for unsaved changes

### Intelligent Fix Selection
Looping Agents use sophisticated algorithms to:
- Analyze error context
- Determine appropriate fix type
- Calculate confidence scores
- Generate language-specific solutions

### Real-Time Monitoring
The system monitors in real-time by:
- Listening to diagnostic changes
- Processing errors as they occur
- Maintaining an active error queue
- Providing live status updates

## API Reference

### ContinuousErrorFixer

```typescript
class ContinuousErrorFixer {
    constructor(context: vscode.ExtensionContext, chatPanel?: any)
    
    // Control methods
    start(): Promise<void>
    stop(): Promise<void>
    toggle(): Promise<void>
    
    // Status method
    getStatus(): {
        isRunning: boolean;
        activeLoopingAgents: number;
        activeReplacingAgents: number;
        queuedErrors: number;
    }
    
    // Cleanup
    dispose(): void
}
```

### LoopingAgent

```typescript
class LoopingAgent {
    constructor(agentId: string, filePath: string, messenger: SidebarChatMessenger)
    
    // Main method
    analyzeDiagnostics(diagnostics: vscode.Diagnostic[]): Promise<FixSuggestion[]>
    
    // Control
    stop(): void
    isAgentActive(): boolean
    
    // Stats
    getStats(): { analysisCount: number; fixesGenerated: number }
}
```

### ReplacingAgent

```typescript
class ReplacingAgent {
    constructor(agentId: string, filePath: string, messenger: SidebarChatMessenger)
    
    // Main method
    applyFixes(fixes: FixSuggestion[]): Promise<void>
    
    // Control
    stop(): void
    isAgentActive(): boolean
    
    // Stats
    getStats(): { replacementsApplied: number; replacementsFailed: number }
}
```

### AgentCoordinator

```typescript
class AgentCoordinator {
    // File access control
    requestFileAccess(agentId: string, filePath: string): Promise<boolean>
    releaseFileAccess(agentId: string, filePath: string): Promise<void>
    waitForFileAccess(agentId: string, filePath: string, maxWaitTime?: number): Promise<boolean>
    
    // Agent management
    registerAgent(agentId: string, agentType: 'looping' | 'replacing', metadata?: any): void
    unregisterAgent(agentId: string): void
    
    // Conflict detection
    detectConflicts(agentId: string, filePath: string): Promise<string[]>
    isFileBeingModified(filePath: string): boolean
    
    // Utilities
    getStats(): { activeFileAccesses: number; queuedRequests: number; registeredAgents: number }
    dispose(): void
}
```

### SidebarChatMessenger

```typescript
class SidebarChatMessenger {
    constructor(chatPanel?: any)
    
    // Message methods
    sendMessage(content: string, type: MessageType, metadata?: any): Promise<void>
    sendProgress(current: number, total: number, message: string, metadata?: any): Promise<void>
    sendError(error: Error | string, context?: string): Promise<void>
    sendSuccess(message: string, metadata?: any): Promise<void>
    sendInfo(message: string, metadata?: any): Promise<void>
    sendWarning(message: string, metadata?: any): Promise<void>
    sendSystem(message: string, metadata?: any): Promise<void>
    sendCodeBlock(code: string, language?: string, title?: string): Promise<void>
    
    // Utilities
    getHistory(count?: number): ChatMessage[]
    clearHistory(): void
    exportHistory(): string
    showOutputChannel(): void
    dispose(): void
}
```

## Troubleshooting

### Issue: Fixes Not Being Applied
**Possible Causes**:
- Low confidence scores
- File access conflicts
- Validation failures

**Solutions**:
- Lower confidence threshold
- Check sidebar messages for details
- Ensure no external file locks

### Issue: Too Many Notifications
**Solutions**:
- Adjust loop interval to reduce frequency
- Filter message types in messenger

### Issue: System Performance Impact
**Solutions**:
- Increase loop interval
- Reduce number of concurrent agents
- Process fewer files at once

### Issue: Incorrect Fixes
**Solutions**:
- Improve fix generation logic
- Add language-specific patterns
- Increase validation checks

## Best Practices

1. **Monitor the sidebar chat** for real-time feedback
2. **Review fixes** before committing to version control
3. **Use with caution** in production code
4. **Start with small projects** to test behavior
5. **Customize confidence thresholds** based on your needs
6. **Keep backups** of important files
7. **Stop the system** when making large manual changes

## Future Enhancements

- [ ] Machine learning for better fix suggestions
- [ ] User feedback integration
- [ ] Custom fix patterns/rules
- [ ] Multi-file refactoring support
- [ ] Integration with code review tools
- [ ] Batch fix suggestions before applying
- [ ] Undo/redo for applied fixes
- [ ] Fix history and analytics

## Contributing

To extend the system:

1. Add new fix patterns in `looping-agent.ts`
2. Implement language-specific validators in `replacing-agent.ts`
3. Add new message types in `sidebar-chat-messenger.ts`
4. Extend coordination logic in `agent-coordinator.ts`

## License

Part of the Coding Assistant extension.
