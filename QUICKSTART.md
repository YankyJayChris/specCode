# SpecCode Quick Start Guide

## Installation

### From VSIX (Current Method)

```bash
# Navigate to the extension folder
cd specCode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npx vsce package

# Install in VS Code
code --install-extension specCode-1.0.0.vsix
```

### Development Mode

```bash
# Open in VS Code
code .

# Press F5 to launch extension host
```

## First Steps

### 1. Open SpecCode Panel

Click the ghost icon (👻) in the VS Code activity bar.

### 2. Set Up Your First AI Provider

**Option A: Via Provider Setup Interface (Recommended)**

1. Click "Provider Setup" in the SpecCode sidebar
2. Choose from 14+ provider templates:
   - **Claude 3.5 Sonnet** (recommended for coding)
   - **GPT-4 Turbo** (latest OpenAI model)
   - **Gemini Pro** (Google's multimodal AI)
   - **Ollama Llama 2** (local, privacy-focused)
   - **Qwen Turbo** (Chinese-optimized)
   - **Kimi Chat** (long context support)
3. Follow the guided setup instructions
4. Test your connection
5. Set as active provider

**Option B: Via Command Palette**

1. Press `Ctrl+Shift+P`
2. Type "SpecCode: Add Provider"
3. Follow the prompts

**Option C: Via Settings (Advanced)**

1. Open Settings (`Ctrl+,`)
2. Search "SpecCode"
3. Edit `specCode.providers`

**Example - Claude 3.5 Sonnet Setup:**

```json
{
  "specCode.providers": [
    {
      "id": "claude-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022",
      "apiKey": "sk-ant-your-api-key",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": true,
      "supportsVision": true,
      "supportsStreaming": true
    }
  ],
  "specCode.activeProvider": "claude-sonnet"
}
```

**Example - Local Ollama Setup:**

```json
{
  "specCode.providers": [
    {
      "id": "ollama-llama2",
      "name": "Ollama Llama 2",
      "provider": "ollama",
      "modelName": "llama2",
      "baseUrl": "http://localhost:11434/v1",
      "apiKey": "",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": false,
      "supportsStreaming": true
    }
  ]
}
```

### 3. Auto-Discover Local Providers (Optional)

If you have Ollama or LM Studio running:

1. Click "Discover Providers" in the Provider Setup interface
2. SpecCode will automatically detect running services
3. Choose which models to add
4. One-click setup for discovered providers

### 4. Configure Phase-Specific Providers (Optional)

Use different providers for different workflow phases:

1. In Provider Setup, go to "Phase Configuration"
2. Set providers for each phase:
   - **Requirements**: Claude Sonnet (best for understanding)
   - **Design**: GPT-4 Turbo (excellent architecture)
   - **Execution**: Claude Sonnet (superior coding)
   - **Hooks**: Local Ollama (fast, private)

### 5. Create Your First Spec

**Option A: From Template**

1. Click "New Spec from Template" in the sidebar
2. Choose from 6 built-in templates:
   - REST API
   - React Component
   - CLI Tool
   - Database Migration
   - Bug Fix
   - Fullstack Feature
3. Enter name: `user-authentication`

**Option B: From Scratch**

1. Click "New Spec" in the sidebar
2. Enter name: `user-authentication`
3. Enter description: `User login and signup system`

### 6. Generate Requirements

1. Click "Generate Requirements"
2. Enter prompt: `Create a user authentication system with email/password login, signup, and password reset`
3. Wait for generation
4. Review `requirements.md`
5. Click "Approve" or provide feedback

### 7. Generate Design

1. Click "Generate Design"
2. Review `design.md`
3. Approve to proceed

### 8. Generate Implementation Plan

1. Click "Generate Implementation Plan"
2. Review `tasks.md`
3. Mark any tasks as optional
4. Click "Execute"

### 9. Monitor Execution

1. Approve terminal commands as prompted
2. Review generated code
3. Check the Output channel for progress

## Common Tasks

### Switch Between Providers

**Quick Switch:**

1. Click the provider name in the sidebar
2. Select from your configured providers
3. Status indicator shows provider health

**Advanced Switch:**

1. Open Provider Setup interface
2. View provider performance metrics
3. Test connections before switching
4. Set different providers per phase

### Monitor Provider Health

1. Check status indicators in sidebar:
   - 🟢 Online and healthy
   - 🟡 Slow response times
   - 🔴 Offline or errors
   - ⚪ Testing connection

2. View detailed metrics in Provider Setup:
   - Response times
   - Success rates
   - Error counts
   - Cost tracking

### Import/Export Provider Configurations

**Export for Team Sharing:**

1. Open Provider Setup
2. Click "Export Configuration"
3. Share JSON file with team (API keys excluded)

**Import Team Configuration:**

1. Open Provider Setup
2. Click "Import Configuration"
3. Select team's JSON file
4. Add your own API keys

### Use Spec Templates

1. Click "New Spec from Template"
2. Choose template (REST API, React Component, etc.)
3. Enter spec name
4. Template guidance automatically included

### Switch to Vibe Coding Mode

1. Open chat (`Ctrl+Shift+K`)
2. Click "Vibe" button
3. Type your prompt
4. Provider shown in chat header

### Generate Tests for Current File

1. Open a code file
2. Press `Ctrl+Shift+T`
3. Or right-click → "Generate Tests"
4. Uses your active provider

### Explain Selected Code

1. Select code in editor
2. Press `Ctrl+Shift+E`
3. Or right-click → "Explain Code"
4. Response uses active provider

### Generate Commit Message

1. Stage your changes (`git add`)
2. Press `Ctrl+Shift+G`
3. Review and edit the generated message
4. Uses active provider for generation

### View Memory and Sessions

1. Click "Sessions" in sidebar to see conversation history
2. Use "View Memory" to see project context
3. Resume previous sessions to continue work
4. Sessions track provider usage and costs

### Create an Agent Hook

1. Go to "Agent Hooks" section
2. Click "New Hook"
3. Configure:
   - Event: "On File Save"
   - Pattern: "\*.ts"
   - Prompt: "Check for type errors"
   - Provider: Choose specific provider or use active

### Add Steering Guidelines

1. Go to "Agent Steering" section
2. Click "New Steering"
3. Edit the markdown with your coding standards
4. Guidelines apply to all providers

### Add MCP Server

1. Go to "MCP Servers" section
2. Click "Add MCP Server"
3. Choose from built-in servers or add custom
4. MCP tools available to all providers

## Keyboard Shortcuts

| Shortcut       | Action                  |
| -------------- | ----------------------- |
| `Ctrl+Shift+K` | Open SpecCode chat          |
| `Ctrl+Shift+E` | Explain selected code   |
| `Ctrl+Shift+F` | Fix selected code       |
| `Ctrl+Shift+G` | Generate commit message |
| `Ctrl+Shift+A` | Ask about selection     |
| `Ctrl+Shift+T` | Generate tests          |
| `Ctrl+Shift+P` | Access all commands     |

## Troubleshooting

### Provider Issues

**Provider Not Working:**

1. Check API key is correct in Provider Setup
2. Verify model name matches provider's API
3. Test connection via Provider Setup interface
4. Check "SpecCode" output channel for detailed errors
5. Ensure account has sufficient credits/quota

**Connection Failed:**

1. Verify network connectivity
2. Check firewall/proxy settings
3. Ensure provider service is available
4. Try switching to a different provider temporarily

**Local Provider Issues:**

1. Ensure Ollama/LM Studio is running
2. Check correct port configuration (11434 for Ollama, 1234 for LM Studio)
3. Verify model is loaded and available
4. Use "Discover Providers" to auto-detect

**Rate Limiting:**

1. Check provider status in sidebar
2. Reduce request frequency
3. Upgrade to higher tier plan
4. Use multiple providers for load balancing

### Model Not Working

1. Check API key is correct
2. Verify model name is valid
3. Test connection via Command Palette
4. Check Output panel for errors

### Hooks Not Firing

1. Verify hook is enabled
2. Check file pattern matches
3. Review "SpecCode Hooks" output channel

### Execution Stuck

1. Check for pending command approval
2. Review "SpecCode Agent" output channel
3. Cancel and restart if needed
4. Try switching to a different provider

## Next Steps

- Read the full [Usage Guide](docs/USAGE.md)
- Explore [Architecture](docs/ARCHITECTURE.md)
- Check out [Contributing](CONTRIBUTING.md)

---

**Happy coding with SpecCode!** 🚀
