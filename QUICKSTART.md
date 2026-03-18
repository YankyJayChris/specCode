# Spec-Code Quick Start Guide

## Installation

### From VSIX (Current Method)

```bash
# Navigate to the extension folder
cd spec-code

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npx vsce package

# Install in VS Code
code --install-extension spec-code-1.0.0.vsix
```

### Development Mode

```bash
# Open in VS Code
code .

# Press F5 to launch extension host
```

## First Steps

### 1. Open Spec-Code Panel

Click the ghost icon (👻) in the VS Code activity bar.

### 2. Add Your AI Model

**Option A: Via Command Palette**
1. Press `Ctrl+Shift+P`
2. Type "Spec-Code: Add AI Model"
3. Follow the prompts

**Option B: Via Settings**
1. Open Settings (`Ctrl+,`)
2. Search "Spec-Code"
3. Edit `specCode.models`

**Example - OpenAI:**
```json
{
  "specCode.models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "modelName": "gpt-4",
      "apiKey": "sk-your-api-key",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": true
    }
  ],
  "specCode.defaultRequirementsModel": "gpt-4",
  "specCode.defaultDesignModel": "gpt-4",
  "specCode.defaultExecutionModel": "gpt-4"
}
```

### 3. Create Your First Spec

1. Click "New Spec" in the sidebar
2. Enter name: `user-authentication`
3. Enter description: `User login and signup system`

### 4. Generate Requirements

1. Click "Generate Requirements"
2. Enter prompt: `Create a user authentication system with email/password login, signup, and password reset`
3. Wait for generation
4. Review `requirements.md`
5. Click "Approve" or provide feedback

### 5. Generate Design

1. Click "Generate Design"
2. Review `design.md`
3. Approve to proceed

### 6. Generate Implementation Plan

1. Click "Generate Implementation Plan"
2. Review `tasks.md`
3. Mark any tasks as optional
4. Click "Execute"

### 7. Monitor Execution

1. Approve terminal commands as prompted
2. Review generated code
3. Check the Output channel for progress

## Common Tasks

### Switch to Vibe Coding Mode

1. Open chat (`Ctrl+Shift+K`)
2. Click "Vibe" button
3. Type your prompt

### Create an Agent Hook

1. Go to "Agent Hooks" section
2. Click "New Hook"
3. Configure:
   - Event: "On File Save"
   - Pattern: "*.ts"
   - Prompt: "Check for type errors"

### Add Steering Guidelines

1. Go to "Agent Steering" section
2. Click "New Steering"
3. Edit the markdown with your coding standards

### Add MCP Server

1. Go to "MCP Servers" section
2. Click "Add MCP Server"
3. Choose from built-in servers or add custom

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` | Open Spec-Code chat |
| `Ctrl+Shift+P` | Access all commands |

## Troubleshooting

### Model Not Working

1. Check API key is correct
2. Verify model name is valid
3. Test connection via Command Palette
4. Check Output panel for errors

### Hooks Not Firing

1. Verify hook is enabled
2. Check file pattern matches
3. Review "Spec-Code Hooks" output channel

### Execution Stuck

1. Check for pending command approval
2. Review "Spec-Code Agent" output channel
3. Cancel and restart if needed

## Next Steps

- Read the full [Usage Guide](docs/USAGE.md)
- Explore [Architecture](docs/ARCHITECTURE.md)
- Check out [Contributing](CONTRIBUTING.md)

---

Happy coding with Spec-Code! 🚀
