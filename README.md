# Spec-Code: Kiro-Compatible Spec-Driven AI Development for VS Code

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Spec-Code** brings the full power of Kiro's agentic IDE capabilities to any standard VS Code installation (including VSCodium). Experience spec-driven AI development with complete model freedom—use OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Ollama, LM Studio, or any OpenAI-compatible endpoint.

![Spec-Code Demo](docs/demo.png)

## 🎯 What is Spec-Driven Development?

Spec-Driven Development (SDD) transforms how you build software with AI:

1. **Requirements** → AI generates comprehensive requirements using EARS syntax
2. **Design** → Technical architecture with diagrams, data models, and API specs
3. **Implementation Plan** → Discrete, trackable tasks with dependencies
4. **Execution** → AI agent executes tasks with your approval at every step

The result? Production-ready, verifiable code with human-readable specs for stakeholders.

## ✨ Features

### 🔥 Core Capabilities

- **📝 4-Phase Spec Workflow**: Requirements → Design → Tasks → Execution
- **🤖 Multi-Model Support**: OpenAI, Claude, Gemini, Grok, Ollama, LM Studio, and more
- **🎣 Agent Hooks**: Event-driven automations (on save, on create, on git commit)
- **🧭 Agent Steering**: Workspace + global markdown documents guide AI behavior
- **🔌 MCP Servers**: Full Model Context Protocol support for external tools
- **💬 Two Modes**: Spec-Driven for structured work, Vibe Coding for quick tasks
- **🔒 Terminal Command Approval**: Approve or trust patterns before execution
- **📊 Cost Tracking**: Token usage and estimated costs per request
- **🧠 Memory System**: Persistent workspace and per-spec memory
- **📈 Session Management**: Track conversations, tokens, and costs per task
- **📋 Spec Templates**: 6 built-in templates (REST API, React Component, CLI Tool, etc.)
- **🔧 Enhanced Agent Methods**: Generate tests, docs, review code, explain code, fix code

### 🎨 VS Code Integration

- **Sidebar Panel**: Ghost icon with Specs, Hooks, Steering, Sessions, and MCP sections
- **Chat Webview**: Interactive AI chat with real-time updates
- **Memory System**: Workspace and per-spec memory persistence
- **Session Management**: Track conversations, tokens, and costs per task
- **File Explorer Integration**: `.specCode/` folder with automatic migration from `.kiro/`
- **Command Palette**: All commands accessible via `Ctrl+Shift+P`
- **Keyboard Shortcuts**: `Ctrl+Shift+K` to open chat
- **Editor Context Menus**: Right-click for "Ask About Selection", "Generate Tests", etc.

## 🚀 Quick Start

### Installation

1. Install from the VS Code Marketplace (coming soon)
2. Or install from VSIX:
   ```bash
   code --install-extension spec-code-1.0.0.vsix
   ```

### Setup

1. **Open the Spec-Code panel**: Click the ghost icon in the activity bar
2. **Add your AI model**: Click "Add Model" and configure your provider
3. **Create your first spec**: Click "New Spec" and describe what you want to build
4. **Follow the workflow**: Approve each phase as AI generates requirements, design, and tasks

### Example Workflow

```
You: "Create a user authentication system with login, signup, and password reset"

Spec-Code: [Generates requirements.md with EARS user stories]
You: [Review and approve]

Spec-Code: [Generates design.md with architecture and API specs]
You: [Review and approve]

Spec-Code: [Generates tasks.md with implementation plan]
You: [Click Execute]

Spec-Code: [Executes tasks, asks for command approval]
```

## ⚙️ Configuration

### Adding AI Models

Configure unlimited models via Settings (`Ctrl+,` → search "Spec-Code"):

```json
{
  "specCode.models": [
    {
      "id": "claude-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022",
      "apiKey": "sk-ant-...",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": true
    },
    {
      "id": "ollama-llama",
      "name": "Ollama Llama 2",
      "provider": "ollama",
      "modelName": "llama2",
      "baseUrl": "http://localhost:11434/v1",
      "temperature": 0.7,
      "maxTokens": 2048,
      "supportsTools": false
    }
  ],
  "specCode.defaultRequirementsModel": "claude-sonnet",
  "specCode.defaultDesignModel": "claude-sonnet",
  "specCode.defaultExecutionModel": "claude-sonnet"
}
```

### Supported Providers

| Provider         | Setup             | Tools | Vision |
| ---------------- | ----------------- | ----- | ------ |
| OpenAI           | API key           | ✅    | ✅     |
| Anthropic Claude | API key           | ✅    | ✅     |
| Google Gemini    | API key           | ✅    | ✅     |
| xAI Grok         | API key           | ✅    | ❌     |
| Ollama           | Local server      | ⚠️    | ❌     |
| LM Studio        | Local server      | ⚠️    | ❌     |
| Azure OpenAI     | Endpoint + key    | ✅    | ✅     |
| Custom           | OpenAI-compatible | ⚠️    | ⚠️     |

### Agent Steering

Create `.specCode/steering/` markdown files to guide AI behavior:

```markdown
# Project Steering

## Coding Style

- Use TypeScript with strict mode
- Prefer functional programming patterns
- Maximum function length: 30 lines

## Technology Stack

- Backend: Node.js + Express
- Frontend: React + TypeScript
- Database: PostgreSQL with Prisma

## Architecture

- Use repository pattern for data access
- Implement proper error handling with custom classes
- Write tests for all business logic
```

### Agent Hooks

Create automated workflows that trigger on file events:

```json
{
  "name": "Type Check on Save",
  "eventType": "onDidSaveTextDocument",
  "filePattern": "*.ts",
  "prompt": "Check this TypeScript file for type errors and suggest fixes",
  "enabled": true
}
```

### MCP Servers

Add external tools via Model Context Protocol:

```json
{
  "name": "Filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
}
```

Available MCP servers:

- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - PostgreSQL access
- `@modelcontextprotocol/server-sqlite` - SQLite access
- `@modelcontextprotocol/server-fetch` - HTTP requests

## 📁 Folder Structure

```
.specCode/
├── specs/
│   └── feature-name/
│       ├── requirements.md    # EARS requirements
│       ├── design.md          # Technical design
│       ├── tasks.md           # Implementation plan
│       └── metadata.json      # Spec metadata
├── steering/
│   ├── coding-style.md        # Code conventions
│   └── architecture.md        # Architecture guidelines
├── hooks/
│   └── type-check.json        # Hook definitions
├── memory/
│   ├── workspace.md           # Project memory
│   └── specs/                 # Per-spec memory
├── sessions/                  # Session history
├── mcp.json                   # MCP server configs
└── settings/                  # Extension settings
```

## 🛡️ Security

- **API Keys**: Stored securely using VS Code's SecretStorage
- **Terminal Commands**: Require approval unless matching trusted patterns
- **File Access**: Restricted to workspace directory
- **Local Processing**: All AI calls go directly to your configured endpoints

### Trusted Command Patterns

```json
{
  "specCode.trustedCommandPatterns": [
    "^npm (install|run|test)",
    "^git (add|commit|push)"
  ]
}
```

## 🧪 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/spec-code.git
cd spec-code

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in development mode
code --extensionDevelopmentPath=.
```

### Running Tests

```bash
npm test
```

### Packaging

```bash
npm run package
```

## 🗺️ Roadmap

- [ ] GitHub Copilot integration
- [ ] Multi-file editing in webview
- [ ] Diff view for code changes
- [ ] Collaborative specs (real-time sharing)
- [ ] Custom tool definitions
- [ ] Plugin system for custom agents
- [ ] CI/CD integration

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by [Kiro](https://kiro.dev) and their spec-driven development approach
- Built on the [VS Code Extension API](https://code.visualstudio.com/api)
- Uses the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/spec-code/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/spec-code/discussions)
- **Discord**: [Join our community](https://discord.gg/spec-code)

---

**Happy coding with Spec-Code!** 🚀
