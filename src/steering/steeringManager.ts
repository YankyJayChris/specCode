import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import { SpecCodeFolderManager } from "../utils/specCodeFolder";

export interface SteeringDocument {
  id: string;
  name: string;
  scope: "workspace" | "global";
  content: string;
  path: string;
  enabled: boolean;
  priority: number;
}

export const DEFAULT_STEERING_TEMPLATE = `# Agent Steering Document

This document guides the AI agent's behavior when generating code and making decisions.

## Coding Style

### General Principles
- Write clean, readable, maintainable code
- Follow the DRY (Don't Repeat Yourself) principle
- Prefer explicit over implicit
- Optimize for readability over cleverness

### Naming Conventions
- Use descriptive, intention-revealing names
- Functions: verbNoun format (e.g., \`getUserById\`)
- Variables: camelCase (e.g., \`userName\`)
- Constants: UPPER_SNAKE_CASE (e.g., \`MAX_RETRY_COUNT\`)
- Classes: PascalCase (e.g., \`UserService\`)

### Code Organization
- Keep functions small and focused (max 20-30 lines)
- One class per file (generally)
- Group related functionality
- Import order: external libraries, internal modules, relative imports

## Technology Preferences

### Runtime & Language
- Prefer Node.js 20+ for server-side
- Use TypeScript with strict mode enabled
- Target ES2022

### Framework Preferences
- Backend: Express.js or Fastify
- Frontend: React with TypeScript
- Testing: Jest or Vitest

### Package Management
- Use npm or pnpm
- Keep dependencies up to date
- Pin critical dependency versions

## Architecture Patterns

### API Design
- RESTful principles
- Consistent error responses
- Proper HTTP status codes
- Version your APIs (e.g., /v1/users)

### Error Handling
- Use custom error classes
- Always handle async errors
- Log errors with context
- Never swallow errors silently

### Data Access
- Use repository pattern for database access
- Validate all inputs
- Sanitize user inputs to prevent injection

## Security Guidelines

- Never commit secrets to version control
- Use environment variables for configuration
- Validate and sanitize all user inputs
- Implement proper authentication and authorization
- Use HTTPS in production
- Keep dependencies updated for security patches

## Testing Requirements

- Write unit tests for business logic
- Write integration tests for APIs
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use meaningful test descriptions

## Documentation

- Document public APIs with JSDoc
- Include examples in documentation
- Keep README files up to date
- Document complex business logic

## Performance Considerations

- Avoid N+1 query problems
- Use caching where appropriate
- Optimize database queries
- Consider pagination for large datasets
- Profile code before optimizing

## Git Conventions

### Commit Messages
- Use conventional commits format
- Example: \`feat: add user authentication\`
- Example: \`fix: resolve login timeout issue\`

### Branching
- main: production-ready code
- develop: integration branch
- feature/*: new features
- bugfix/*: bug fixes
- hotfix/*: urgent production fixes
`;

export class SteeringManager {
  private steeringDocs: Map<string, SteeringDocument> = new Map();

  constructor(private specCodeFolder: SpecCodeFolderManager) {
    this.loadSteeringDocuments();
  }

  private async loadSteeringDocuments() {
    // Load workspace steering
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (workspaceRoot) {
      const workspaceSteeringPath = path.join(
        workspaceRoot,
        SpecCodeFolderManager.FOLDER_NAME,
        "steering",
      );
      if (fs.existsSync(workspaceSteeringPath)) {
        await this.loadSteeringFromDirectory(
          workspaceSteeringPath,
          "workspace",
        );
      } else {
        fs.mkdirSync(workspaceSteeringPath, { recursive: true });
      }
    }

    // Load global steering
    const globalSteeringPath = this.getGlobalSteeringPath();
    if (fs.existsSync(globalSteeringPath)) {
      await this.loadSteeringFromDirectory(globalSteeringPath, "global");
    } else {
      fs.mkdirSync(globalSteeringPath, { recursive: true });
    }
  }

  private getGlobalSteeringPath(): string {
    const config = vscode.workspace.getConfiguration("specCode");
    const customPath = config.get<string>(
      "globalSteeringPath",
      "~/.specCode/steering",
    );

    if (customPath.startsWith("~")) {
      const homedir = os.homedir();
      return customPath.replace("~", homedir);
    }

    return customPath;
  }

  private async loadSteeringFromDirectory(
    dirPath: string,
    scope: "workspace" | "global",
  ) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const filePath = path.join(dirPath, entry.name);
        const content = fs.readFileSync(filePath, "utf-8");
        const name = entry.name.replace(".md", "");

        const doc: SteeringDocument = {
          id: uuidv4(),
          name,
          scope,
          content,
          path: filePath,
          enabled: true,
          priority: scope === "global" ? 1 : 2, // Workspace takes precedence
        };

        this.steeringDocs.set(doc.id, doc);
      }
    }
  }

  async createSteeringDocument(
    name: string,
    scope: "workspace" | "global",
  ): Promise<SteeringDocument> {
    let dirPath: string;

    if (scope === "workspace") {
      const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
      if (!workspaceRoot) {
        throw new Error("No workspace open");
      }
      dirPath = path.join(workspaceRoot, ".specCode", "steering");
    } else {
      dirPath = this.getGlobalSteeringPath();
    }

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${name}.md`);

    if (fs.existsSync(filePath)) {
      throw new Error(`Steering document "${name}" already exists`);
    }

    fs.writeFileSync(filePath, DEFAULT_STEERING_TEMPLATE);

    const doc: SteeringDocument = {
      id: uuidv4(),
      name,
      scope,
      content: DEFAULT_STEERING_TEMPLATE,
      path: filePath,
      enabled: true,
      priority: scope === "global" ? 1 : 2,
    };

    this.steeringDocs.set(doc.id, doc);
    return doc;
  }

  async updateSteeringDocument(id: string, content: string): Promise<void> {
    const doc = this.steeringDocs.get(id);
    if (!doc) {
      throw new Error("Steering document not found");
    }

    doc.content = content;
    fs.writeFileSync(doc.path, content);
  }

  async deleteSteeringDocument(id: string): Promise<void> {
    const doc = this.steeringDocs.get(id);
    if (!doc) {
      return;
    }

    if (fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }

    this.steeringDocs.delete(id);
  }

  async toggleSteeringDocument(id: string): Promise<void> {
    const doc = this.steeringDocs.get(id);
    if (doc) {
      doc.enabled = !doc.enabled;
    }
  }

  async getCombinedSteering(): Promise<string> {
    const enabledDocs = Array.from(this.steeringDocs.values())
      .filter((d) => d.enabled)
      .sort((a, b) => b.priority - a.priority);

    if (enabledDocs.length === 0) {
      return DEFAULT_STEERING_TEMPLATE;
    }

    const sections: string[] = [];

    for (const doc of enabledDocs) {
      sections.push(
        `<!-- ${doc.scope.toUpperCase()} STEERING: ${doc.name} -->`,
      );
      sections.push(doc.content);
      sections.push("");
    }

    return sections.join("\n");
  }

  getSteeringDocuments(): SteeringDocument[] {
    return Array.from(this.steeringDocs.values()).sort((a, b) => {
      // Sort by scope (workspace first), then by name
      if (a.scope !== b.scope) {
        return a.scope === "workspace" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  getSteeringDocument(id: string): SteeringDocument | undefined {
    return this.steeringDocs.get(id);
  }

  // Check for AGENTS.md compatibility
  async checkForAgentsMd(): Promise<string | null> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return null;
    }

    const agentsMdPath = path.join(workspaceRoot, "AGENTS.md");
    if (fs.existsSync(agentsMdPath)) {
      return fs.readFileSync(agentsMdPath, "utf-8");
    }

    return null;
  }

  // Import from AGENTS.md
  async importFromAgentsMd(): Promise<void> {
    const content = await this.checkForAgentsMd();
    if (!content) {
      return;
    }

    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const steeringPath = path.join(
      workspaceRoot,
      SpecCodeFolderManager.FOLDER_NAME,
      "steering",
      "AGENTS.md",
    );
    fs.writeFileSync(steeringPath, content);

    const doc: SteeringDocument = {
      id: uuidv4(),
      name: "AGENTS",
      scope: "workspace",
      content,
      path: steeringPath,
      enabled: true,
      priority: 3, // Highest priority for AGENTS.md
    };

    this.steeringDocs.set(doc.id, doc);
  }
}
