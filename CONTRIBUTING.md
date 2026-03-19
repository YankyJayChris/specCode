# Contributing to Spec-Code

Thank you for your interest in contributing to Spec-Code! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 18+
- VS Code 1.85+
- Git

### Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/yourusername/spec-code.git
   cd spec-code
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Open in VS Code:
   ```bash
   code .
   ```

4. Press `F5` to launch the extension in debug mode

## Project Structure

```
spec-code/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── commands.ts           # Command registrations
│   ├── providers/            # Tree view providers
│   │   ├── specsProvider.ts
│   │   ├── hooksProvider.ts
│   │   ├── steeringProvider.ts
│   │   └── mcpProvider.ts
│   ├── specs/                # Spec management
│   │   ├── specManager.ts
│   │   └── specTypes.ts
│   ├── llm/                  # LLM integration
│   │   └── llmManager.ts
│   ├── agent/                # Agent execution
│   │   └── agentEngine.ts
│   ├── hooks/                # Agent hooks
│   │   └── hookEngine.ts
│   ├── steering/             # Agent steering
│   │   └── steeringManager.ts
│   ├── mcp/                  # MCP client
│   │   └── mcpClient.ts
│   ├── utils/                # Utilities
│   │   └── specCodeFolder.ts
│   └── webview/              # Webview UI
│       └── chatWebview.ts
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript config
└── README.md
```

## Coding Guidelines

### TypeScript

- Use strict TypeScript mode
- Prefer interfaces over types
- Use explicit return types for public methods
- Document complex functions with JSDoc

### Code Style

- Use 4 spaces for indentation
- Maximum line length: 100 characters
- Use single quotes for strings
- Trailing commas in objects/arrays

### Naming Conventions

- Classes: `PascalCase`
- Methods/Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private members: `_camelCase` or `#camelCase`
- Interfaces: `PascalCase` with `I` prefix optional

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Place tests in `src/test/`
- Name test files `*.test.ts`
- Use VS Code's test framework

## Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding guidelines

3. **Test your changes** thoroughly

4. **Update documentation** if needed

5. **Commit with clear messages**:
   ```bash
   git commit -m "feat: add new feature"
   ```

   Commit message prefixes:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `style:` - Code style (formatting)
   - `refactor:` - Code refactoring
   - `test:` - Tests
   - `chore:` - Maintenance

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** with:
   - Clear title and description
   - Reference any related issues
   - Screenshots for UI changes
   - Test results

## Reporting Issues

### Bug Reports

Include:
- VS Code version
- Extension version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Clear description
- Use case
- Proposed solution (optional)
- Alternatives considered (optional)

## Areas for Contribution

### High Priority

- [ ] Additional LLM provider support
- [ ] Improved error handling
- [ ] Better test coverage
- [ ] Performance optimizations

### Medium Priority

- [ ] UI/UX improvements
- [ ] Additional MCP server integrations
- [ ] Documentation improvements
- [ ] Translation/localization

### Low Priority

- [ ] Additional themes
- [ ] Custom icons
- [ ] Analytics (opt-in)

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal attacks
- Publishing others' private information

## Questions?

- Join our [Discord](https://discord.gg/specCode)
- Open a [GitHub Discussion](https://github.com/yourusername/specCode/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Spec-Code! 🚀
