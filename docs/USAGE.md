# Spec-Code Usage Guide

This guide covers how to use Spec-Code effectively for spec-driven AI development.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Adding AI Models](#adding-ai-models)
3. [Creating Specs](#creating-specs)
4. [The 4-Phase Workflow](#the-4-phase-workflow)
5. [Spec Templates](#spec-templates)
6. [Memory System](#memory-system)
7. [Session Management](#session-management)
8. [Agent Methods](#agent-methods)
9. [Agent Hooks](#agent-hooks)
10. [Agent Steering](#agent-steering)
11. [MCP Servers](#mcp-servers)
12. [Vibe Coding Mode](#vibe-coding-mode)
13. [Tips and Best Practices](#tips-and-best-practices)

## Getting Started

### Installation

1. Install Spec-Code from the VS Code Marketplace
2. Reload VS Code
3. Click the ghost icon (👻) in the activity bar

### First Launch

On first launch, Spec-Code will:

1. Create a `.specCode/` folder in your workspace (migrates from `.kiro/` if exists)
2. Show a welcome message with quick actions
3. Prompt you to add an AI model

## Adding AI Models

### Via Settings UI

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "Spec-Code"
3. Click "Edit in settings.json"
4. Add your model configuration

### Via Command Palette

1. Press `Ctrl+Shift+P`
2. Type "Spec-Code: Add AI Model"
3. Follow the prompts

### Example Configurations

#### OpenAI GPT-4

```json
{
  "specCode.models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "modelName": "gpt-4",
      "apiKey": "sk-...",
      "temperature": 0.7,
      "maxTokens": 4096,
      "supportsTools": true,
      "supportsVision": true
    }
  ]
}
```

#### Anthropic Claude 3.5 Sonnet

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
      "supportsTools": true,
      "supportsVision": true
    }
  ]
}
```

#### Ollama (Local)

```json
{
  "specCode.models": [
    {
      "id": "ollama-llama2",
      "name": "Ollama Llama 2",
      "provider": "ollama",
      "modelName": "llama2",
      "baseUrl": "http://localhost:11434/v1",
      "temperature": 0.7,
      "maxTokens": 2048,
      "supportsTools": false,
      "supportsVision": false
    }
  ]
}
```

### Testing Connection

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Spec-Code: Test Model Connection"
3. Select your model
4. View the test result

## Creating Specs

### From the Sidebar

1. Open Spec-Code panel (ghost icon)
2. Click "New Spec" button
3. Enter spec name (lowercase, hyphens allowed)
4. Enter description

### From Chat

1. Open Spec-Code chat (`Ctrl+Shift+K`)
2. Type your feature description
3. Click "Create Spec" when prompted

### Spec Naming Conventions

- Use lowercase letters, numbers, and hyphens
- Be descriptive: `user-authentication` not `auth`
- Use verb-noun format: `send-email-notifications`

## The 4-Phase Workflow

### Phase 1: Requirements

**Purpose**: Define what needs to be built

**Input**: Your feature description

**Output**: `requirements.md` with:

- User stories (EARS format)
- Acceptance criteria
- In/out of scope
- Edge cases
- Assumptions and dependencies

**Actions**:

- Review the generated requirements
- Click "Approve" to proceed
- Or provide feedback to regenerate

**Example**:

```markdown
## User Stories

### US-001: User can log in with email and password

- **Priority**: Must have
- **Acceptance Criteria**:
  1. User can enter email and password
  2. System validates credentials
  3. User receives JWT token on success
```

### Phase 2: Design

**Purpose**: Define how to build it

**Input**: Approved requirements

**Output**: `design.md` with:

- Architecture overview
- Component breakdown
- Data models
- API endpoints
- Sequence diagrams (Mermaid)
- Error handling strategy
- Technology choices

**Actions**:

- Review technical design
- Override any choices (e.g., "Use Node 20 instead of 18")
- Approve to proceed

**Example**:

```markdown
## Architecture

We'll use a layered architecture:

- **API Layer**: Express.js routes
- **Service Layer**: Business logic
- **Data Layer**: Prisma ORM with PostgreSQL

## API Endpoints

### POST /api/auth/login

- **Description**: Authenticate user
- **Request**: `{ email: string, password: string }`
- **Response**: `{ token: string, user: User }`
```

### Phase 3: Implementation Plan

**Purpose**: Break work into trackable tasks

**Input**: Approved design

**Output**: `tasks.md` with:

- Discrete tasks
- Expected outcomes
- Dependencies
- Optional flags

**Actions**:

- Review task list
- Mark tasks as optional
- Reorder if needed
- Click "Execute" to start

**Example**:

```markdown
### Task 1: Create database schema

- **Description**: Set up Prisma schema with User model
- **Expected Outcome**: schema.prisma with User table
- **Dependencies**: None
- **Optional**: false

### Task 2: Implement login endpoint

- **Description**: Create POST /api/auth/login
- **Expected Outcome**: Working login with JWT
- **Dependencies**: Task 1
- **Optional**: false
```

### Phase 4: Execution

**Purpose**: AI implements the tasks

**Process**:

1. AI reads task description
2. AI uses tools to implement
3. Terminal commands require approval
4. Files are created/modified
5. Progress shown in real-time

**Actions**:

- Approve terminal commands
- Review generated code
- Provide feedback mid-execution
- Pause/resume as needed

## Spec Templates

### Using Templates

Spec-Code includes 6 built-in templates to jumpstart your development:

1. **REST API** - Backend API with authentication, CRUD operations
2. **React Component** - Frontend component with props, state, and styling
3. **CLI Tool** - Command-line application with argument parsing
4. **Database Migration** - Schema changes and data transformations
5. **Bug Fix** - Systematic approach to identifying and fixing issues
6. **Fullstack Feature** - Complete feature spanning frontend and backend

### Creating from Template

1. Click "New Spec from Template" in sidebar
2. Select template from the list
3. Enter spec name
4. Template guidance is automatically included in memory

### Template Benefits

- **Faster Setup**: Pre-configured requirements structure
- **Best Practices**: Built-in conventions and patterns
- **Consistent Quality**: Proven approaches for common scenarios
- **Learning Tool**: See examples of well-structured specs

## Memory System

### Workspace Memory

Located at `.specCode/memory/workspace.md`, this file contains:

- Project-wide conventions and decisions
- Technology stack choices
- Architecture patterns
- Team agreements

### Per-Spec Memory

Each spec gets its own memory file at `.specCode/memory/specs/<spec-id>.md`:

- Spec-specific decisions and context
- Task completion notes
- Template guidance (if used)
- Progress tracking

### Automatic Recording

Memory is automatically updated when:

- Specs are created or completed
- Tasks are finished
- Important decisions are made
- Templates are applied

### Memory in AI Prompts

Memory content is automatically injected into AI prompts to provide:

- Consistent context across sessions
- Accumulated project knowledge
- Previous decisions and rationale
- Template-specific guidance

## Session Management

### What are Sessions?

Sessions track individual conversations and task executions:

- **Conversation History**: All messages between you and AI
- **Token Tracking**: Usage and estimated costs
- **Task Context**: Which spec and task being worked on
- **Timestamps**: When work started and completed

### Session Types

- **Execution Sessions**: Created during task execution
- **Chat Sessions**: Created during vibe coding mode
- **Manual Sessions**: Created via "New Session" command

### Session Tree View

The Sessions panel shows:

- Active sessions (currently running)
- Recent sessions (last 10)
- Sessions grouped by spec
- Token usage and duration

### Resuming Sessions

1. Click on a session in the Sessions panel
2. Or use "Resume Session" command
3. Previous context is restored automatically
4. Continue conversation where you left off

## Agent Methods

### Code Analysis Methods

#### Explain Code (`Ctrl+Shift+E`)

- Select code in editor
- Right-click → "Explain Code"
- Get detailed explanation of functionality and patterns

#### Ask About Code (`Ctrl+Shift+A`)

- Select code and ask specific questions
- Context-aware responses using project memory
- Useful for understanding complex logic

#### Review Current File

- Comprehensive code review of entire file
- Checks for security, performance, best practices
- Provides actionable feedback with line references

### Code Generation Methods

#### Generate Tests (`Ctrl+Shift+T`)

- Creates comprehensive unit tests
- Detects testing framework automatically
- Includes edge cases and error conditions
- Mocks external dependencies

#### Generate Documentation

- Creates JSDoc, docstrings, or README sections
- Includes usage examples and API documentation
- Follows language-specific conventions

#### Fix Code (`Ctrl+Shift+F`)

- Automatically fixes common issues
- Handles syntax errors, type issues, style problems
- Returns corrected code with explanation

### Git Integration Methods

#### Generate Commit Message (`Ctrl+Shift+G`)

- Analyzes staged changes (`git diff --staged`)
- Creates conventional commit messages
- Includes spec context if available
- Editable before committing

#### Review Changes

- Reviews all uncommitted changes
- Compares against requirements and design
- Identifies potential issues or improvements
- Security and performance analysis

## Agent Hooks

### Creating a Hook

1. Open Spec-Code panel
2. Go to "Agent Hooks" section
3. Click "New Hook"
4. Configure:
   - Name: "Type Check on Save"
   - Event: "On File Save"
   - Pattern: "\*.ts"
   - Prompt: "Check for type errors and suggest fixes"

### Example Hooks

#### Type Check TypeScript

```json
{
  "name": "Type Check TypeScript",
  "eventType": "onDidSaveTextDocument",
  "filePattern": "*.ts",
  "prompt": "Check this TypeScript file for type errors. If issues found, explain them and suggest fixes.",
  "enabled": true
}
```

#### Lint JavaScript

```json
{
  "name": "Lint JavaScript",
  "eventType": "onDidSaveTextDocument",
  "filePattern": "*.{js,jsx}",
  "prompt": "Review this code for style issues, potential bugs, and best practice violations.",
  "enabled": true
}
```

#### Documentation Reminder

```json
{
  "name": "Documentation Check",
  "eventType": "onDidCreateFiles",
  "filePattern": "*.{ts,js}",
  "prompt": "This is a new file. Check if it has proper JSDoc documentation. If missing, provide a template.",
  "enabled": true
}
```

## Agent Steering

### Creating Steering Documents

1. Open Spec-Code panel
2. Go to "Agent Steering" section
3. Click "New Steering"
4. Choose scope (Workspace or Global)
5. Edit the markdown file

### Workspace vs Global

- **Workspace**: Applies to current project only
- **Global**: Applies to all projects (in `~/.kiro/steering/`)

### Example Steering Document

```markdown
# Project Steering

## Coding Style

- Use TypeScript with strict mode
- Prefer functional programming
- Max function length: 30 lines
- Use destructuring for props

## Naming Conventions

- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE

## Technology Stack

- Frontend: React + TypeScript
- Styling: Tailwind CSS
- State: Zustand
- API: React Query

## Architecture

- Use custom hooks for logic
- Keep components presentational
- Implement proper error boundaries
```

### AGENTS.md Compatibility

If you have an `AGENTS.md` file in your workspace, Spec-Code will automatically import it as a steering document with highest priority.

## MCP Servers

### Adding an MCP Server

1. Open Spec-Code panel
2. Go to "MCP Servers" section
3. Click "Add MCP Server"
4. Configure transport and connection

### Built-in MCP Servers

Install with one click:

- **Filesystem**: File operations
- **GitHub**: GitHub API access
- **PostgreSQL**: Database queries
- **SQLite**: Local database access
- **Fetch**: HTTP requests

### Example: Filesystem MCP

```json
{
  "name": "Filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
}
```

### Using MCP Tools

Once connected, MCP tools are automatically available to the AI agent during execution. The agent will:

1. Discover available tools
2. Select appropriate tools for tasks
3. Call tools with correct parameters
4. Use results to complete tasks

## Vibe Coding Mode

### When to Use

- Quick prototypes
- One-off tasks
- Exploring ideas
- Learning new concepts

### How to Switch

1. Open Spec-Code chat
2. Click "Vibe" button in header
3. Type your prompt

### Example Prompts

```
"Generate a React component for a todo list"
```

```
"Explain how async/await works in JavaScript"
```

```
"Refactor this function to use reduce instead of for loop"
```

## Tips and Best Practices

### Writing Good Specs

1. **Be specific**: "User can log in" → "User can log in with email/password, Google OAuth, or GitHub OAuth"
2. **Include context**: Mention existing code, patterns, or constraints
3. **Define success**: What does "done" look like?
4. **Consider edge cases**: Empty states, errors, limits

### Reviewing AI Output

1. **Requirements**: Check for missing scenarios
2. **Design**: Verify technology choices match your stack
3. **Tasks**: Ensure logical ordering and dependencies
4. **Code**: Review for security, performance, and style

### Managing Costs

1. Use cheaper models for simple tasks
2. Set token limits in model config
3. Enable cost tracking
4. Review usage regularly

### Terminal Commands

1. **Never auto-approve** destructive commands
2. **Trust patterns** for safe commands like `npm install`
3. **Review** each command before approving
4. **Cancel** if unsure

### Steering Effectiveness

1. **Be specific**: "Use async/await" not "Write good code"
2. **Include examples**: Show preferred patterns
3. **Update regularly**: As project evolves
4. **Keep concise**: AI has context limits

### Troubleshooting

#### Model Not Responding

- Check API key
- Verify model name
- Test connection
- Check rate limits

#### Hooks Not Firing

- Verify hook is enabled
- Check file pattern
- Ensure event type matches
- Review output channel

#### MCP Connection Failed

- Verify server is running
- Check URL/command
- Review error message
- Try reconnecting

#### Execution Stuck

- Check for pending command approval
- Review output channel for errors
- Cancel and restart if needed
- Check task dependencies

### Keyboard Shortcuts

| Shortcut                     | Action              |
| ---------------------------- | ------------------- |
| `Ctrl+Shift+K`               | Open Spec-Code chat |
| `Ctrl+Shift+P` → "Spec-Code" | Access all commands |

### Command Palette Commands

- `Spec-Code: Open Chat`
- `Spec-Code: New Spec`
- `Spec-Code: Add AI Model`
- `Spec-Code: Open Settings`
- `Spec-Code: Test Model Connection`

---

For more help, see [README.md](../README.md) or open an issue on GitHub.
