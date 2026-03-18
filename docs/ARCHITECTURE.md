# Spec-Code Architecture

This document describes the internal architecture of the Spec-Code extension.

## Overview

Spec-Code is built as a VS Code extension using the following architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension                         │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                        │
│  ├── Sidebar Tree Views (Specs, Hooks, Steering, MCP)           │
│  ├── Chat Webview                                               │
│  └── Command Palette Integration                                │
├─────────────────────────────────────────────────────────────────┤
│  Core Layer                                                      │
│  ├── SpecManager (4-phase workflow)                             │
│  ├── AgentEngine (tool execution)                               │
│  ├── HookEngine (event-driven automation)                       │
│  ├── SteeringManager (context injection)                        │
│  └── MCPClient (external tools)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Integration Layer                                               │
│  ├── LLMManager (multi-provider AI)                             │
│  ├── VS Code APIs (workspace, terminal, files)                  │
│  └── File System (.kiro folder)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### SpecManager

Manages the 4-phase spec-driven development workflow:

```typescript
class SpecManager {
    async generateRequirements(specId: string, prompt: string): Promise<void>
    async generateDesign(specId: string): Promise<void>
    async generateTasks(specId: string): Promise<void>
    async approvePhase(specId: string, phase: SpecPhase): Promise<void>
    async regeneratePhase(specId: string, phase: SpecPhase, feedback: string): Promise<void>
}
```

**Responsibilities:**
- Create and manage specs
- Generate requirements using EARS syntax
- Generate technical design documents
- Create implementation task lists
- Track phase approval status

### AgentEngine

Executes tasks using AI with tool calling:

```typescript
class AgentEngine {
    async executeSpec(spec: Spec): Promise<void>
    async executeTask(specId: string, taskId: string): Promise<void>
    private async executeTool(toolCall: any): Promise<string>
}
```

**Built-in Tools:**
- `read_file` - Read file contents
- `write_file` - Create/modify files
- `edit_file` - Replace text in files
- `run_command` - Execute terminal commands (with approval)
- `search_files` - Search by pattern
- `list_directory` - List directory contents
- `get_diagnostics` - Get TypeScript errors

**Security:**
- File access restricted to workspace
- Commands require user approval
- Trusted patterns can be configured

### LLMManager

Unified interface for multiple AI providers:

```typescript
class LLMManager {
    async generate(modelId: string, messages: Message[]): Promise<LLMResponse>
    async generateWithTools(modelId: string, messages: Message[], tools: any[]): Promise<LLMResponse>
    async streamGenerate(modelId: string, messages: Message[], onChunk: (chunk: string) => void): Promise<void>
}
```

**Supported Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3.x)
- Google (Gemini)
- xAI (Grok)
- Ollama (local)
- LM Studio (local)
- Azure OpenAI
- Custom OpenAI-compatible

### HookEngine

Event-driven automation system:

```typescript
class HookEngine {
    async createHook(config: Partial<Hook>): Promise<Hook>
    private async handleFileEvent(eventType: string, filePath: string): Promise<void>
    private async executeHook(hook: Hook, filePath: string): Promise<void>
}
```

**Event Types:**
- `onDidSaveTextDocument` - File saved
- `onDidCreateFiles` - File created
- `onDidDeleteFiles` - File deleted
- `onGitCommit` - Git commit
- `onTerminalCommand` - Terminal command executed

### SteeringManager

Manages context injection for AI prompts:

```typescript
class SteeringManager {
    async getCombinedSteering(): Promise<string>
    async createSteeringDocument(name: string, scope: 'workspace' | 'global'): Promise<SteeringDocument>
}
```

**Priority Order:**
1. AGENTS.md (highest)
2. Workspace steering documents
3. Global steering documents (lowest)

### MCPClient

Implements Model Context Protocol:

```typescript
class MCPClient {
    async addServer(config: Partial<MCPServer>): Promise<MCPServer>
    async getTools(): Promise<any[]>
    async executeTool(toolName: string, args: any): Promise<string>
}
```

**Transport Types:**
- HTTP/SSE - Remote servers
- STDIO - Local process-based servers

## Data Flow

### Spec Creation Flow

```
User Input
    ↓
SpecManager.createSpec()
    ↓
.kiro/specs/<name>/ folder created
    ↓
metadata.json saved
    ↓
UI updated via SpecsProvider
```

### Requirements Generation Flow

```
User: "Create auth system"
    ↓
SpecManager.generateRequirements()
    ↓
LLMManager.generate() with EARS prompt
    ↓
SteeringManager.getCombinedSteering() injected
    ↓
requirements.md written
    ↓
UI shows "Ready for review"
```

### Task Execution Flow

```
User clicks "Execute"
    ↓
AgentEngine.executeSpec()
    ↓
For each task:
    ↓
    LLMManager.generateWithTools()
    ↓
    Tool selected → executeTool()
    ↓
    If run_command → show approval dialog
    ↓
    Return result to LLM
    ↓
Task marked complete
```

## File Structure

### .kiro Folder

```
.kiro/
├── specs/
│   └── feature-name/
│       ├── requirements.md    # Generated requirements
│       ├── design.md          # Generated design
│       ├── tasks.md           # Generated tasks
│       └── metadata.json      # Spec state
├── steering/
│   ├── coding-style.md        # Code conventions
│   └── architecture.md        # Architecture rules
├── hooks/
│   └── type-check.json        # Hook definitions
├── mcp.json                   # MCP configurations
└── settings/                  # Extension settings
```

### metadata.json Schema

```json
{
  "id": "uuid",
  "name": "spec-name",
  "description": "Spec description",
  "phase": "requirements|design|tasks|execution",
  "phaseStatus": "pending|generating|ready|approved|executing|completed|error",
  "createdAt": 1234567890,
  "updatedAt": 1234567890,
  "files": {
    "requirements": "/path/to/requirements.md",
    "design": "/path/to/design.md",
    "tasks": "/path/to/tasks.md"
  },
  "tasks": [...],
  "metadata": {
    "modelId": "model-uuid",
    "tokenCount": 1000,
    "costEstimate": 0.05
  }
}
```

## Extension Points

### Adding a New LLM Provider

1. Update `ModelConfig.provider` type
2. Add client initialization in `LLMManager.initializeClient()`
3. Implement generation method in `LLMManager.generate()`

### Adding a New Tool

1. Define tool schema in `AgentEngine.getAvailableTools()`
2. Implement handler in `AgentEngine.executeTool()`
3. Add security checks if needed

### Adding a New Hook Event

1. Add event type to `Hook.eventType`
2. Register listener in `HookEngine.start()`
3. Update UI in `HooksProvider`

## Performance Considerations

### Caching

- Steering documents cached in memory
- MCP tool list cached per session
- File contents read on-demand

### Rate Limiting

- Respects provider rate limits
- Exponential backoff on errors
- Request queue for concurrent calls

### Streaming

- LLM responses streamed when possible
- UI updates in real-time
- Reduces perceived latency

## Security Model

### API Keys

- Stored in VS Code SecretStorage
- Never logged or exposed
- Per-workspace isolation

### File Access

```typescript
isWithinWorkspace(targetPath: string): boolean {
    const resolvedPath = path.resolve(targetPath);
    const resolvedWorkspace = path.resolve(workspaceRoot);
    return resolvedPath.startsWith(resolvedWorkspace);
}
```

### Command Approval

```typescript
// Check trusted patterns
const isTrusted = trustedPatterns.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(command);
});

// Show approval dialog if not trusted
if (!isTrusted) {
    const approved = await showApprovalDialog(command);
}
```

## Testing Strategy

### Unit Tests

- Test individual components in isolation
- Mock LLM responses
- Mock VS Code APIs

### Integration Tests

- Test full workflow end-to-end
- Use real file system (temp directory)
- Mock external APIs

### Manual Testing

- Test UI interactions
- Verify command palette
- Check keyboard shortcuts

## Future Architecture

### Planned Improvements

1. **Plugin System**: Allow custom tools and hooks
2. **Collaboration**: Real-time spec sharing
3. **CI/CD Integration**: Run specs in pipelines
4. **Analytics**: Opt-in usage tracking
5. **Caching Layer**: Persistent LLM response cache

---

For more details, see the source code in `src/`.
