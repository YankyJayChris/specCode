# Kiro: Spec-Driven AI Development for VS Code

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Kiro** brings the full power of agentic IDE capabilities to any standard VS Code installation (including VSCodium). Experience spec-driven AI development with complete model freedom—use OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Alibaba Qwen, Moonshot Kimi, Ollama, LM Studio, or any OpenAI-compatible endpoint.

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
- **🤖 Multi-Provider Support**: 10+ AI providers with seamless switching
- **⚙️ Provider Management**: Intuitive setup interface with templates
- **🔍 Auto-Discovery**: Automatic detection of local AI services
- **📊 Provider Monitoring**: Real-time health and performance tracking
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
- **Provider Setup Interface**: Dedicated webview for managing AI providers
- **Provider Switcher**: Quick provider selection in sidebar with status indicators
- **Chat Webview**: Interactive AI chat with real-time updates and provider switching
- **Memory System**: Workspace and per-spec memory persistence
- **Session Management**: Track conversations, tokens, and costs per task
- **File Explorer Integration**: `.kiro/` folder with automatic migration from `.specCode/`
- **Command Palette**: All commands accessible via `Ctrl+Shift+P`
- **Keyboard Shortcuts**: `Ctrl+Shift+K` to open chat
- **Editor Context Menus**: Right-click for "Ask About Selection", "Generate Tests", etc.

## 🚀 Quick Start

### Installation

1. Install from the VS Code Marketplace (coming soon)
2. Or install from VSIX:
   ```bash
   code --install-extension kiro-1.0.0.vsix
   ```

### Setup Your First Provider

1. **Open the Kiro panel**: Click the ghost icon in the activity bar
2. **Add your AI provider**: Click "Provider Setup" to open the configuration interface
3. **Choose a template**: Select from 14+ pre-configured provider templates
4. **Enter credentials**: Add your API key (stored securely in VS Code)
5. **Test connection**: Verify your provider is working correctly

### Provider Setup Examples

#### Claude 3.5 Sonnet (Recommended)

```
Provider: Anthropic Claude
Template: Claude 3.5 Sonnet
API Key: sk-ant-... (from console.anthropic.com)
Features: Tools ✅ Vision ✅ Streaming ✅
```

#### Local Ollama Setup

```
Provider: Ollama
Template: Ollama Llama 2
Base URL: http://localhost:11434/v1
Features: Local ✅ Free ✅ Privacy ✅
```

#### Google Gemini Pro

```
Provider: Google Gemini
Template: Gemini Pro
API Key: AI... (from aistudio.google.com)
Features: Tools ✅ Vision ✅ Fast ✅
```

### Create Your First Spec

1. **Create your first spec**: Click "New Spec" and describe what you want to build
2. **Follow the workflow**: Approve each phase as AI generates requirements, design, and tasks
3. **Monitor execution**: Watch as AI implements your spec with your approval

### Example Workflow

```
You: "Create a user authentication system with login, signup, and password reset"

Kiro: [Generates requirements.md with EARS user stories]
You: [Review and approve]

Kiro: [Generates design.md with architecture and API specs]
You: [Review and approve]

Kiro: [Generates tasks.md with implementation plan]
You: [Click Execute]

Kiro: [Executes tasks, asks for command approval]
```

## ⚙️ Provider Configuration

### Supported Providers

| Provider                     | Status | Tools | Vision | Streaming | Auto-Discovery |
| ---------------------------- | ------ | ----- | ------ | --------- | -------------- |
| **Anthropic Claude**         | ✅     | ✅    | ✅     | ✅        | ❌             |
| **OpenAI GPT**               | ✅     | ✅    | ✅     | ✅        | ❌             |
| **Google Gemini**            | ✅     | ✅    | ✅     | ✅        | ❌             |
| **xAI Grok**                 | ✅     | ✅    | ❌     | ✅        | ❌             |
| **Alibaba Qwen**             | ✅     | ✅    | ✅     | ✅        | ❌             |
| **Moonshot Kimi**            | ✅     | ✅    | ❌     | ✅        | ❌             |
| **Ollama**                   | ✅     | ⚠️    | ❌     | ✅        | ✅             |
| **LM Studio**                | ✅     | ⚠️    | ❌     | ✅        | ✅             |
| **Azure OpenAI**             | ✅     | ✅    | ✅     | ✅        | ❌             |
| **Custom OpenAI-compatible** | ✅     | ⚠️    | ⚠️     | ⚠️        | ❌             |

### Provider Templates

Choose from 14+ pre-configured templates:

**Cloud Providers:**

- Claude 3.5 Sonnet (recommended for coding)
- Claude 3 Haiku (fast and cost-effective)
- GPT-4 Turbo (latest OpenAI model)
- GPT-4 (most capable OpenAI model)
- Gemini Pro (Google's multimodal AI)
- Qwen Turbo & Max (Chinese-optimized)
- Kimi Chat (long context support)
- xAI Grok (real-time capabilities)

**Local Providers:**

- Ollama Llama 2 (privacy-focused)
- Ollama Code Llama (code-specialized)
- LM Studio (any local model)

### Provider Setup Interface

Access via the "Provider Setup" button in the Kiro sidebar:

**Features:**

- Template-based setup with guided instructions
- Real-time connection testing
- Provider health monitoring
- Configuration import/export
- Auto-discovery of local services
- Phase-specific provider selection
- Cost and performance tracking

### Advanced Configuration

Configure providers programmatically via VS Code settings:

```json
{
  "kiro.providers": [
    {
      "id": "claude-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022",
      "apiKey": "sk-ant-...",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": true,
      "supportsVision": true,
      "supportsStreaming": true,
      "providerSettings": {
        "systemPromptHandling": "separate"
      }
    }
  ],
  "kiro.activeProvider": "claude-sonnet",
  "kiro.phaseProviders": {
    "requirements": "claude-sonnet",
    "design": "gpt-4-turbo",
    "execution": "claude-sonnet"
  }
}
```

### Provider-Specific Features

**Claude (Anthropic):**

- System message handling options
- Advanced reasoning capabilities
- Code generation excellence

**Gemini (Google):**

- Configurable safety settings
- Multimodal input support
- Fast inference speeds

**Qwen (Alibaba):**

- Chinese language optimization
- Multilingual capabilities
- Cost-effective pricing

**Kimi (Moonshot):**

- Long context windows (up to 200K tokens)
- Extended conversation memory
- Document analysis capabilities

**Ollama/LM Studio:**

- Complete privacy (local processing)
- No API costs
- Offline functionality
- Custom model support

### Provider Troubleshooting

**Common Issues:**

1. **Connection Failed**
   - Verify API key is correct
   - Check network connectivity
   - Ensure provider service is available
   - Review proxy settings if in corporate environment

2. **Model Not Found**
   - Confirm model name matches provider's API
   - Check if model requires special access
   - Verify account has sufficient credits

3. **Rate Limiting**
   - Reduce request frequency
   - Upgrade to higher tier plan
   - Use multiple providers for load balancing

4. **Local Provider Issues**
   - Ensure Ollama/LM Studio is running
   - Check correct port configuration
   - Verify model is loaded and available

**Getting Help:**

- Use the "Test Connection" feature in Provider Setup
- Check the "Kiro" output channel for detailed error logs
- Review provider documentation links in templates

### Agent Steering

Create `.kiro/steering/` markdown files to guide AI behavior:

```markdown
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
.kiro/
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
├── providers/                 # Provider configurations
│   ├── templates/             # Custom templates
│   └── settings.json          # Provider preferences
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
  "kiro.trustedCommandPatterns": [
    "^npm (install|run|test)",
    "^git (add|commit|push)"
  ]
}
```

## 🧪 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/kiro.git
cd kiro

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

- **Issues**: [GitHub Issues](https://github.com/yourusername/kiro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/kiro/discussions)
- **Discord**: [Join our community](https://discord.gg/kiro)

---

**Happy coding with Kiro!** 🚀
