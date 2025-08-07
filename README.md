# 💡 AI Coding – VS Code Extension

AI Coding Assistant is a powerful VS Code extension that supercharges your development workflow using state-of-the-art AI models. Whether you're coding, debugging, generating, or learning – this extension provides intelligent assistance **right inside the editor and CLI**.

---

## ✨ Features

### 🧠 In-Editor AI Tools
1. **Inline Code Suggestions** – Get context-aware code completions as you type.
2. **In-Editor Code Generator** – Generate new code blocks directly in the editor.
3. **Code Corrector & Replacer** – Select buggy code and replace it with an AI-generated correct version.
4. **Code Explainer** – Understand complex code via AI-powered explanations shown in a dedicated chat panel.
5. **Chat Interface (Sidebar & Panel)** – Ask coding questions, troubleshoot, or brainstorm right within VS Code.
6. **Chat History Management** – Automatically stores your chats. You can delete specific chats or clear all.
7. **Multiple Model Providers** – Choose between:
   - **Groq**
   - **Together.ai**
   - **Cerebras**
   - **OpenAI**
   - **Mistral**
   - **Meta (LLaMA and others)**
8. **Markdown Styling Highlighter** – Beautifully renders markdown responses from the AI.
9. **Tavily Web Search Integration** – Fetch real-time info from the web to enhance your prompts.

---

## ⚙️ CLI Commands

You don’t need to open VS Code to use the extension – it comes with a powerful CLI interface.

```bash
# Format:
$ myext <command> [options]
````

### 🔧 Command List

| Command         | Description                                                                   |
| --------------- | ----------------------------------------------------------------------------- |
| `analyze`       | Analyze a file/folder for issues and output a detailed log.                   |
| `ask`           | Live terminal chat with AI (context-aware).                                   |
| `explain-diffs` | Explain the difference between two files.                                     |
| `generate`      | Generate code from predefined templates.                                      |
| `generatefile`  | Generate multiple code files at once.                                         |
| `generateTest`  | Create test cases for the given code automatically.                           |
| `code-refactor` | Refactor code in a specific file intelligently.                               |
| `replace`       | Replace incorrect code with a corrected version.                              |
| `ask_context`   | Full project-aware querying using embeddings (class/function level chunking). |

---

## 🚀 Installation

1. Clone the repository.
2. Follow the setup instructions to configure API keys for model providers.
3. Enable optional Tavily integration for web search.

---

## 🔐 Model Configuration

To use multiple providers, create a .env file in root directory and fill & ceate Apis keys <br> Get API Keys from thier Official sites:

```.env
API_KEY='Groq-Api-here'
Together_api='together api here'
Open_router_api='openAI api here'
Mistral_api='mistral api here'
Cerebras_api='cerebras api here'
Tavily_api='tavily api here'
Hug_face='HuggingFace Secret Token here'
---

## 🧩 Roadmap

* [ ] Add Git diff view in explain-diffs
* [ ] Enable multi-turn CLI chat memory
* [ ] VS Code snippets integration
* [ ] Plugin marketplace for user-generated templates/models

---

## 📄 License

MIT License

---

## 🤝 Contributing

Pull requests and feature suggestions are welcome! Open an issue or create a PR if you'd like to contribute.

---

## 🔗 Connect

Built with ❤️ by Malik Faizan
GitHub: [github.com/faizanmal](https://github.com/faizanmal)
LinkedIn: [linkedin.com/in/faizan](https://linkedin.com/in/faizanmalikdelhi)

