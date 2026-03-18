# Change Log

All notable changes to the "Spec-Code" extension will be documented in this file.

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Spec-Code
- Full 4-phase spec-driven development workflow
  - Requirements generation with EARS standard
  - Design generation with architecture and diagrams
  - Implementation plan with trackable tasks
  - Execution with agent tool calling
- Multi-model AI support
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic Claude (3.5 Sonnet, 3 Opus, 3 Haiku)
  - Google Gemini
  - xAI Grok
  - Ollama (local models)
  - LM Studio (local models)
  - Azure OpenAI
  - Custom OpenAI-compatible endpoints
- Agent Hooks system
  - Event-driven automations
  - File save/create/delete triggers
  - Git commit hooks
  - Custom prompt templates
- Agent Steering
  - Workspace-level steering documents
  - Global steering documents
  - AGENTS.md compatibility
  - Automatic context injection
- MCP (Model Context Protocol) support
  - HTTP/SSE transport
  - STDIO transport
  - Tool discovery and execution
  - One-click server installation
- Interactive chat webview
  - Spec-Driven mode
  - Vibe Coding mode
  - Real-time streaming responses
  - Multimodal support (images)
- Terminal command approval system
  - Per-command approval
  - Trusted pattern matching
  - Global auto-approval setting
- Cost tracking
  - Token usage monitoring
  - Cost estimation per model
- VS Code integration
  - Sidebar tree views (Specs, Hooks, Steering, MCP)
  - Command palette integration
  - Keyboard shortcuts
  - File explorer integration
- Security features
  - Secure API key storage
  - Workspace-scoped file access
  - Command approval workflow

### Security
- API keys stored in VS Code SecretStorage
- File operations restricted to workspace
- Terminal commands require approval by default
