# Copilot - AI-Powered Coding Assistant

A comprehensive VS Code extension providing advanced AI-powered coding assistance with multiple AI providers, real-time analysis, and intelligent automation features.

## 🚀 Features

### Multi-Provider AI Integration
- **5 AI Providers**: Groq, Together.ai, OpenRouter, Mistral, Cerebras
- **20+ Models**: From lightweight to enterprise-grade models
- **Smart Model Selection**: Choose optimal models for different tasks
- **Web Search Integration**: Enhanced AI responses with real-time web data

### Core Capabilities
- **In-File Chat**: `Ctrl+J` for instant AI assistance
- **Sidebar Panel**: Dedicated AI chat with provider/model selection
- **Context Awareness**: Project-wide understanding and conversation history
- **Real-time Processing**: Streaming responses with copy/delete functionality

### Advanced Code Operations
- **Smart Code Generation**: Natural language to code conversion
- **Error Fixing**: Intelligent diagnostic resolution
- **Code Review**: Comprehensive analysis with scoring
- **Performance Optimization**: Bottleneck detection and improvements
- **Refactoring**: Advanced code restructuring and modernization

### File & Project Management
- **Multi-File Generation**: Create entire project structures
- **NLP File Creation**: Generate files from natural language descriptions
- **Directory Analysis**: Comprehensive project structure evaluation
- **Template System**: Reusable code generation templates

### Shell & Terminal Integration
- **NLP Command Processing**: Execute shell commands via natural language
- **Priority-based Execution**: Smart command queuing
- **Terminal Management**: Automatic reuse and status monitoring
- **Parallel Processing**: Intelligent concurrent command execution

## 📋 Requirements

- **VS Code**: 1.101.0 or higher
- **Node.js**: 16+ (for backend server and CLI)
- **Git**: Required for Git integration features
- **Internet**: Required for AI model access
- **API Keys**: At least one AI provider API key

## ⚙️ Setup

### Quick Start
1. Install the extension
2. Set up API keys in `.env` file
3. Open AI Chat sidebar panel
4. Select your preferred AI provider and model
5. Start coding with AI assistance!

### Environment Configuration
Create `.env` file in project root:
```
GROQ_API_KEY=your_groq_key
TOGETHER_API_KEY=your_together_key
OPENROUTER_API_KEY=your_openrouter_key
MISTRAL_API_KEY=your_mistral_key
CEREBRAS_API_KEY=your_cerebras_key
```

### Backend Server
```bash
cd backend-server
npm install
npm start
```

### CLI Access
```bash
npm run cli
```

## 🎯 Available Models

### Groq
- Meta/Llama-4-Maverick-17B
- LLaMA 3.3-70B Versatile
- Deepseek R1 Distill
- Gemma2-9B IT

### Together.ai
- Deepseek R1 (0528)
- Meta/Llama-3.3-70B-Turbo
- LGAI Exaone-3.5-32B

### OpenRouter
- Mistral 7B
- Code LLaMA 13B

### Mistral
- Small, Medium, Large (latest)

### Cerebras
- LLaMA-4 Scout 17B
- LLaMA 3.1-8B, 3.3-70B
- QWEN-3 32B, 235B
- DeepSeek R1 (preview)

## 🔧 Commands & Shortcuts

### Core Features
- `Ctrl+J`: In-file chat assistance
- `coding.openChat`: Open AI chat panel
- `coding.generateCode`: Generate code from description
- `coding.fixSelectedError`: Fix selected code errors
- `coding.clearChatHistory`: Clear conversation history

### File Generation (4 commands)
- `coding.generateMultipleFiles`: Multi-file generation
- `coding.nlpFileGeneration`: Natural language file creation
- `coding.multiAgentGeneration`: Multi-agent file generation

### Testing & Analysis (6 commands)
- `coding.generateTests`: Generate smart tests
- `coding.analyzeCoverage`: Test coverage analysis
- `coding.analyzePerformance`: Performance analysis
- `coding.reviewCurrentFile`: File review with scoring
- `coding.quickScan`: Quick code scan
- `coding.analyzeError`: Error analysis

### Git Integration (4 commands)
- `coding.generateCommitMessage`: AI commit messages
- `coding.analyzeCodeChanges`: Git change analysis
- `coding.suggestBranchName`: Branch name suggestions
- `coding.generatePRDescription`: PR descriptions

### Documentation (3 commands)
- `coding.generateDocumentation`: Smart documentation
- `coding.generateReadme`: Project README generation
- `coding.generateApiDocs`: API documentation

### Refactoring & Optimization (5 commands)
- `coding.refactorSelection`: Advanced refactoring
- `coding.optimizeCode`: Code optimization
- `coding.addLogging`: Add logging statements
- `coding.addErrorHandling`: Add error handling
- `coding.convertToAsync`: Convert to async/await

## 📊 Extension Settings

This extension contributes the following settings:

* `coding.apiEndpoint`: Configure AI API endpoint
* `coding.defaultProvider`: Set default AI provider
* `coding.enableWebSearch`: Enable/disable web search integration

## 🐛 Known Issues

- Backend server required for full functionality
- API keys needed for AI provider access
- Some features require internet connection

## 📝 Release Notes

### [Unreleased] - Version 0.0.1

**Initial Release Features:**
- Multi-provider AI integration (5 providers, 20+ models)
- Enhanced sidebar with model selection and web search
- 60+ intelligent commands across 15 categories
- Advanced shell command processing with NLP
- CLI interface for batch operations
- Comprehensive file generation system
- Real-time code analysis and review
- Project-aware context understanding
- Performance profiling and optimization
- Automated documentation generation

**Command Categories:**
- Coding Tools (7 commands)
- Problem Fixer & Diagnostics (8 commands)
- Code Review & Analysis (4 commands)
- Search & Navigation (4 commands)
- File Generation (4 commands)
- Testing & Coverage (2 commands)
- Git Integration (4 commands)
- Documentation (3 commands)
- Refactoring (2 commands)
- Performance Analysis (2 commands)

---

## 📚 Resources

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
* [VS Code Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy coding with AI assistance!**