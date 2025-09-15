# AI-Powered Coding Assistant

A comprehensive VS Code extension that provides advanced AI-powered coding assistance with multiple AI providers, real-time analysis, and intelligent automation features.

## 🚀 Advanced Features

### Real-time Code Analysis
- **Live Error Detection**: Automatically analyzes code as you type and provides intelligent suggestions
- **Performance Monitoring**: Identifies potential bottlenecks and optimization opportunities
- **Code Quality Assessment**: Real-time feedback on code maintainability and best practices

### Advanced Refactoring Assistant
- **Smart Refactoring**: Extract methods, variables, and optimize code structure
- **Performance Optimization**: Automatically improve code performance
- **Modern Syntax Conversion**: Update legacy code to modern standards
- **Error Handling Integration**: Add comprehensive error handling patterns

### Intelligent Documentation Generator
- **Auto Documentation**: Generate JSDoc, Sphinx, XML documentation automatically
- **README Generation**: Create comprehensive project documentation
- **API Documentation**: Generate detailed API docs from code analysis
- **Inline Comments**: Smart comment generation for complex code sections

### Performance Profiler Integration
- **Bottleneck Detection**: Identify performance issues in your code
- **Benchmark Generation**: Create performance tests automatically
- **Optimization Suggestions**: Get specific recommendations for improvements
- **Memory Usage Analysis**: Track and optimize memory consumption

### Smart Git Integration
- **AI Commit Messages**: Generate meaningful commit messages from code changes
- **Branch Name Suggestions**: Intelligent branch naming based on work description
- **Pull Request Descriptions**: Comprehensive PR descriptions with testing guidelines
- **Code Change Analysis**: Understand the impact of your changes

### Advanced Code Completion
- **Context-Aware Suggestions**: Intelligent completions based on project context
- **Multi-Language Support**: Works with JavaScript, TypeScript, Python, Java, C++, and more
- **Pattern Recognition**: Learns from your coding patterns for better suggestions

## 📋 Requirements

- VS Code 1.101.0 or higher
- Node.js 16+ (for backend server)
- Git (for Git integration features)
- Internet connection (for AI model access)

### Setup
1. Install the extension from VS Code marketplace
2. Configure your preferred AI provider from the sidebar:
   - **Groq**: Meta/Llama, LLaMA 3.3, Deepseek R1, Gemma
   - **Together.ai**: Deepseek R1, Meta/Llama-Turbo, LGAI x1
   - **OpenRouter**: Mistral 7B, Code LLaMA
   - **Mistral**: Small, Medium, Large models
   - **Cerebras**: LLaMA‑4 Scout, LLaMA 3.1‑8B, LLaMA 3.3‑70B, QWEN‑3, DeepSeek R1
3. Start the backend server: `cd backend-server && npm start`
4. Begin coding with AI assistance!

## ⚙️ Commands & Shortcuts

### Core Features
- `Ctrl+J`: In-file chat for quick assistance
- **AI Chat Panel**: Multi-provider AI chat with web search integration
- **Smart Model Selection**: Choose from 20+ AI models across 5 providers
- `coding.openChat`: Open AI chat panel
- `coding.generateCode`: Generate code from description
- `coding.fixSelectedError`: Fix selected code errors
- **Web Search Integration**: Enable web search for enhanced AI responses

### Advanced Refactoring
- `coding.refactorSelection`: Advanced refactor selected code
- `coding.suggestRefactorings`: Get refactoring suggestions

### Documentation
- `coding.generateDocumentation`: Generate smart documentation
- `coding.generateReadme`: Create project README
- `coding.generateApiDocs`: Generate API documentation

### Performance Analysis
- `coding.analyzePerformance`: Analyze code performance
- `coding.generateBenchmark`: Create performance benchmarks

### Git Integration
- `coding.generateCommitMessage`: AI-powered commit messages
- `coding.analyzeCodeChanges`: Analyze git changes
- `coding.suggestBranchName`: Suggest branch names
- `coding.generatePRDescription`: Generate PR descriptions

### Enhanced File Generation
- `coding.generateMultipleFiles`: Multi-file generation with smart templates
- `coding.nlpFileGeneration`: Natural language file creation
- `coding.multiAgentGeneration`: Multi-agent collaborative file generation
- **Smart Templates**: Express routes, React components, Python modules
- **Batch Processing**: Generate entire project structures from descriptions

### Code Assistant
- `coding.explainCode`: Explain selected code in simple terms
- `coding.generateTestsCmd`: Generate comprehensive unit tests
- `coding.optimizeCode`: Optimize code for performance and readability

### Quick Fixes
- `coding.addLogging`: Add appropriate logging statements
- `coding.addErrorHandling`: Add comprehensive error handling
- `coding.convertToAsync`: Convert code to async/await pattern

### Code Navigation
- `coding.findSimilarCode`: Find similar code patterns in project
- `coding.generateCodeMap`: Generate overview map of codebase

### Snippet Generator
- `coding.generateSnippet`: Generate code from natural language description
- `coding.createBoilerplate`: Create boilerplate code templates
- `coding.generateRegex`: Generate regex patterns with explanations

### Debug Helper
- `coding.analyzeError`: Analyze current errors and provide solutions
- `coding.addDebugLogs`: Add debug logging statements
- `coding.generateBreakpoints`: Suggest optimal breakpoint locations

### Advanced Shell Integration
- `coding.executeShellCommand`: Execute shell commands with NLP processing
- **Priority-based Execution**: Smart command queuing and parallel processing
- **Terminal Management**: Automatic terminal reuse and status monitoring
- **Real-time Monitoring**: Track command execution and dependencies

### Enhanced Analysis Tools
- `coding.analyzeDirectory`: Comprehensive directory structure analysis
- `coding.smartSearch`: Intelligent file and folder search
- `coding.semanticSearch`: Semantic code search across projects
- **Codebase Awareness**: Project-wide context understanding

### Instant Reviewer
- `coding.reviewCurrentFile`: Comprehensive code review with scoring
- `coding.quickScan`: Quick scan of selected code for issues
- **Auto Code Review**: Continuous background analysis
- **Coverage Analysis**: Smart test coverage recommendations

## 🎯 Advanced Capabilities

### Multi-Provider AI Support
- **5 AI Providers**: Groq, Together.ai, OpenRouter, Mistral, Cerebras
- **20+ Models**: From lightweight to enterprise-grade models
- **Smart Switching**: Seamlessly switch between providers and models
- **Cost Optimization**: Choose models based on task complexity

### Enhanced User Experience
- **Sidebar Integration**: Dedicated AI chat panel with provider selection
- **Context Preservation**: Maintains conversation history across sessions
- **Multi-File Context**: Understands relationships between project files
- **Real-time Feedback**: Instant responses with streaming support

### CLI Integration
- **Command Line Interface**: Access AI features from terminal
- **Batch Operations**: Process multiple files simultaneously
- **Project Analysis**: Generate comprehensive project reports
- **Template System**: Reusable code generation templates

## 🔧 Configuration

### Environment Setup
Create a `.env` file in the project root:
```
GROQ_API_KEY=your_groq_key
TOGETHER_API_KEY=your_together_key
OPENROUTER_API_KEY=your_openrouter_key
MISTRAL_API_KEY=your_mistral_key
CEREBRAS_API_KEY=your_cerebras_key
```

### Backend Server
The extension includes a Node.js backend server for enhanced processing:
```bash
cd backend-server
npm install
npm start
```

## 📊 Performance & Analytics

- **Real-time Analysis**: Live code quality assessment
- **Performance Profiling**: Identify bottlenecks and optimization opportunities
- **Memory Tracking**: Monitor resource usage patterns
- **Benchmark Generation**: Automated performance testing

## Release Notes

### 0.0.1 (Current)
- Multi-provider AI integration (Groq, Together.ai, OpenRouter, Mistral, Cerebras)
- Enhanced sidebar with model selection
- Web search integration for AI responses
- Advanced shell command processing
- CLI interface for batch operations
- Comprehensive file generation system
- Real-time code analysis and review
- Project-aware context understanding

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
