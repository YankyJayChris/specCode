import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { KiroFolderManager } from "../utils/kiroFolder";
import { LLMManager } from "../llm/llmManager";
import { SteeringManager } from "../steering/steeringManager";

export interface Hook {
  id: string;
  name: string;
  version: string;
  description?: string;
  when: {
    type:
      | "fileEdited"
      | "fileCreated"
      | "fileDeleted"
      | "userTriggered"
      | "promptSubmit"
      | "agentStop"
      | "preToolUse"
      | "postToolUse"
      | "preTaskExecution"
      | "postTaskExecution";
    patterns?: string[];
    toolTypes?: string[];
  };
  then: {
    type: "askAgent" | "runCommand";
    prompt?: string;
    command?: string;
    timeout?: number;
  };
  enabled: boolean;
  path?: string;
  lastRun?: number;
  runCount: number;
}

export class HookEngine {
  private hooks: Map<string, Hook> = new Map();
  private disposables: vscode.Disposable[] = [];
  private outputChannel: vscode.OutputChannel;
  private isRunning: boolean = false;
  private pendingHooks: Map<
    string,
    { resolve: (value: any) => void; reject: (error: any) => void }
  > = new Map();

  constructor(
    private context: vscode.ExtensionContext,
    private kiroFolder: KiroFolderManager,
    private llmManager: LLMManager,
    private steeringManager: SteeringManager,
  ) {
    this.outputChannel = vscode.window.createOutputChannel("Spec-Code Hooks");
    this.loadHooks();
  }

  private async loadHooks() {
    const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const hooksFolder = path.join(
      workspaceRoot,
      KiroFolderManager.FOLDER_NAME,
      "hooks",
    );

    if (!fs.existsSync(hooksFolder)) {
      fs.mkdirSync(hooksFolder, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(hooksFolder, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        const hookPath = path.join(hooksFolder, entry.name);
        try {
          const data = JSON.parse(fs.readFileSync(hookPath, "utf-8"));

          // Migrate old format to new format if needed
          let hook: Hook;
          if (data.eventType) {
            // Old format - migrate
            hook = {
              id: data.id || uuidv4(),
              name: data.name,
              version: "1.0.0",
              description: data.description || `Hook for ${data.eventType}`,
              when: {
                type: this.migrateEventType(data.eventType),
                patterns: data.filePattern ? [data.filePattern] : undefined,
              },
              then: {
                type: "askAgent",
                prompt: data.prompt,
              },
              enabled: data.enabled ?? true,
              path: hookPath,
              runCount: data.runCount || 0,
              lastRun: data.lastRun,
            };
            // Save migrated format
            await this.saveHook(hook);
          } else {
            // New format
            hook = {
              ...data,
              path: hookPath,
              runCount: data.runCount || 0,
            };
          }

          this.hooks.set(hook.id, hook);
        } catch (error) {
          console.error(`Failed to load hook ${entry.name}:`, error);
        }
      }
    }
  }

  private migrateEventType(oldType: string): Hook["when"]["type"] {
    switch (oldType) {
      case "onDidSaveTextDocument":
        return "fileEdited";
      case "onDidCreateFiles":
        return "fileCreated";
      case "onDidDeleteFiles":
        return "fileDeleted";
      case "onGitCommit":
        return "postTaskExecution";
      case "onTerminalCommand":
        return "preToolUse";
      default:
        return "fileEdited";
    }
  }

  private async saveHook(hook: Hook): Promise<void> {
    const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const hooksFolder = path.join(
      workspaceRoot,
      KiroFolderManager.FOLDER_NAME,
      "hooks",
    );
    if (!fs.existsSync(hooksFolder)) {
      fs.mkdirSync(hooksFolder, { recursive: true });
    }

    const hookPath = path.join(hooksFolder, `${hook.id}.json`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { path: _path, ...data } = hook;
    fs.writeFileSync(hookPath, JSON.stringify(data, null, 2));

    hook.path = hookPath;
  }

  async createHook(config: Partial<Hook>): Promise<Hook> {
    const hook: Hook = {
      id: uuidv4(),
      name: config.name || "Unnamed Hook",
      version: config.version || "1.0.0",
      description: config.description,
      when: config.when || {
        type: "fileEdited",
        patterns: ["*"],
      },
      then: config.then || {
        type: "askAgent",
        prompt: "Review this change",
      },
      enabled: config.enabled ?? true,
      runCount: 0,
    };

    this.hooks.set(hook.id, hook);
    await this.saveHook(hook);

    return hook;
  }

  async deleteHook(id: string): Promise<void> {
    const hook = this.hooks.get(id);
    if (hook && hook.path && fs.existsSync(hook.path)) {
      fs.unlinkSync(hook.path);
    }
    this.hooks.delete(id);
  }

  async toggleHook(id: string): Promise<void> {
    const hook = this.hooks.get(id);
    if (hook) {
      hook.enabled = !hook.enabled;
      await this.saveHook(hook);
    }
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    const config = vscode.workspace.getConfiguration("specCode");
    if (!config.get<boolean>("enableHooks", true)) {
      return;
    }

    this.isRunning = true;

    // Register file save listener
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.handleFileEvent(
          "fileEdited",
          document.uri.fsPath,
          document.getText(),
        );
      }),
    );

    // Register file create listener
    this.disposables.push(
      vscode.workspace.onDidCreateFiles((event) => {
        for (const uri of event.files) {
          this.handleFileEvent("fileCreated", uri.fsPath);
        }
      }),
    );

    // Register file delete listener
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((event) => {
        for (const uri of event.files) {
          this.handleFileEvent("fileDeleted", uri.fsPath);
        }
      }),
    );
  }

  stop(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.isRunning = false;
  }

  async triggerHook(
    eventType: Hook["when"]["type"],
    context?: any,
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration("specCode");
    if (!config.get<boolean>("enableHooks", true)) {
      return;
    }

    // Find matching hooks
    for (const hook of this.hooks.values()) {
      if (!hook.enabled) {
        continue;
      }
      if (hook.when.type !== eventType) {
        continue;
      }

      // Execute hook
      await this.executeHook(hook, context);
    }
  }

  async triggerToolHook(
    eventType: "preToolUse" | "postToolUse",
    toolName: string,
    args?: any,
  ): Promise<any> {
    const config = vscode.workspace.getConfiguration("specCode");
    if (!config.get<boolean>("enableHooks", true)) {
      return;
    }

    // Find matching hooks
    for (const hook of this.hooks.values()) {
      if (!hook.enabled) {
        continue;
      }
      if (hook.when.type !== eventType) {
        continue;
      }

      // Check tool type matching
      if (hook.when.toolTypes) {
        const matches = hook.when.toolTypes.some((pattern) => {
          if (
            ["read", "write", "shell", "web", "spec", "*"].includes(pattern)
          ) {
            return this.matchToolCategory(toolName, pattern);
          } else {
            // Regex pattern for MCP tools
            try {
              return new RegExp(pattern).test(toolName);
            } catch {
              return false;
            }
          }
        });

        if (!matches) {
          continue;
        }
      }

      // Execute hook and wait for result
      const result = await this.executeHook(hook, { toolName, args });

      // For preToolUse hooks, check if access is denied
      if (eventType === "preToolUse" && result && typeof result === "string") {
        if (
          result.toLowerCase().includes("denied") ||
          result.toLowerCase().includes("not allowed") ||
          result.toLowerCase().includes("forbidden")
        ) {
          throw new Error(`Hook "${hook.name}" denied access: ${result}`);
        }
      }
    }
  }

  private matchToolCategory(toolName: string, category: string): boolean {
    switch (category) {
      case "*":
        return true;
      case "read":
        return [
          "read_file",
          "list_directory",
          "search_files",
          "get_diagnostics",
        ].includes(toolName);
      case "write":
        return ["write_file", "edit_file"].includes(toolName);
      case "shell":
        return ["run_command"].includes(toolName);
      case "web":
        return toolName.startsWith("web_") || toolName.includes("http");
      case "spec":
        return toolName.includes("spec") || toolName.includes("task");
      default:
        return false;
    }
  }

  private async handleFileEvent(
    eventType: "fileEdited" | "fileCreated" | "fileDeleted",
    filePath: string,
    content?: string,
  ): Promise<void> {
    const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    // Get relative path
    const relativePath = path.relative(workspaceRoot, filePath);

    // Find matching hooks
    for (const hook of this.hooks.values()) {
      if (!hook.enabled) {
        continue;
      }
      if (hook.when.type !== eventType) {
        continue;
      }

      // Check file pattern
      if (
        hook.when.patterns &&
        !this.matchPatterns(relativePath, hook.when.patterns)
      ) {
        continue;
      }

      // Execute hook
      await this.executeHook(hook, { filePath: relativePath, content });
    }
  }

  private matchPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.matchPattern(filePath, pattern));
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like matching
    if (pattern === "*") {
      return true;
    }
    if (pattern === filePath) {
      return true;
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, "<<DOUBLESTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".")
      .replace(/<<DOUBLESTAR>>/g, ".*");

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    } catch {
      return false;
    }
  }

  private async executeHook(hook: Hook, context?: any): Promise<any> {
    this.outputChannel.appendLine(`[Hook: ${hook.name}] Triggered`);

    try {
      if (hook.then.type === "askAgent") {
        return await this.executeAgentHook(hook, context);
      } else if (hook.then.type === "runCommand") {
        return await this.executeCommandHook(hook);
      }
    } catch (error: any) {
      this.outputChannel.appendLine(
        `[Hook: ${hook.name}] Error: ${error.message}`,
      );
      throw error;
    }
  }

  private async executeAgentHook(hook: Hook, context?: any): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("hooks");
    const steering = await this.steeringManager.getCombinedSteering();

    const systemPrompt = `You are an expert developer assistant running as an automated hook.

${steering}

Execute the following prompt in the given context.`;

    let userPrompt = hook.then.prompt || "Review this change";

    if (context) {
      userPrompt += `\n\n## Context\n${JSON.stringify(context, null, 2)}`;
    }

    const response = await this.llmManager.generate(modelId, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    this.outputChannel.appendLine(
      `[Hook: ${hook.name}] Response:\n${response.content}\n`,
    );

    // Update hook stats
    hook.lastRun = Date.now();
    hook.runCount++;
    await this.saveHook(hook);

    return response.content;
  }

  private async executeCommandHook(hook: Hook): Promise<string> {
    if (!hook.then.command) {
      throw new Error("Command hook missing command");
    }

    const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
    const timeout = hook.then.timeout || 60000; // 60 seconds default

    return new Promise((resolve, reject) => {
      exec(
        hook.then.command!,
        {
          cwd: workspaceRoot,
          timeout,
        },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            const result = `Command failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`;
            this.outputChannel.appendLine(`[Hook: ${hook.name}] ${result}`);
            reject(new Error(result));
          } else {
            const result = `Command executed:\n${stdout}${stderr ? "\nStderr: " + stderr : ""}`;
            this.outputChannel.appendLine(`[Hook: ${hook.name}] ${result}`);

            // Update hook stats
            hook.lastRun = Date.now();
            hook.runCount++;
            this.saveHook(hook);

            resolve(result);
          }
        },
      );
    });
  }

  getHooks(): Hook[] {
    return Array.from(this.hooks.values());
  }

  getHook(id: string): Hook | undefined {
    return this.hooks.get(id);
  }

  // Example hooks that users can create
  getExampleHooks(): {
    name: string;
    description: string;
    config: Partial<Hook>;
  }[] {
    return [
      {
        name: "Type Check on Save",
        description: "Run TypeScript type checking when .ts files are saved",
        config: {
          name: "Type Check TypeScript",
          version: "1.0.0",
          when: {
            type: "fileEdited",
            patterns: ["*.ts", "*.tsx"],
          },
          then: {
            type: "askAgent",
            prompt:
              "Check this TypeScript file for type errors. If there are issues, explain them clearly and suggest fixes. Focus on the most critical errors first.",
          },
        },
      },
      {
        name: "Lint on Save",
        description:
          "Check code style when JavaScript/TypeScript files are saved",
        config: {
          name: "Lint JavaScript/TypeScript",
          version: "1.0.0",
          when: {
            type: "fileEdited",
            patterns: ["*.js", "*.ts", "*.jsx", "*.tsx"],
          },
          then: {
            type: "askAgent",
            prompt:
              "Review this code for style issues, potential bugs, and best practice violations. Suggest specific improvements.",
          },
        },
      },
      {
        name: "Review Write Operations",
        description: "Review all file write operations for safety",
        config: {
          name: "Review Write Operations",
          version: "1.0.0",
          when: {
            type: "preToolUse",
            toolTypes: ["write"],
          },
          then: {
            type: "askAgent",
            prompt:
              "Review this write operation for safety and correctness. Check if the changes align with project standards and won't break existing functionality.",
          },
        },
      },
      {
        name: "Run Tests After Task",
        description: "Automatically run tests after completing spec tasks",
        config: {
          name: "Run Tests After Task",
          version: "1.0.0",
          when: {
            type: "postTaskExecution",
          },
          then: {
            type: "runCommand",
            command: "npm test",
            timeout: 120000,
          },
        },
      },
      {
        name: "Documentation Check",
        description: "Ensure new files have proper documentation",
        config: {
          name: "Check Documentation",
          version: "1.0.0",
          when: {
            type: "fileCreated",
            patterns: ["src/**/*.ts", "src/**/*.js", "**/*.py"],
          },
          then: {
            type: "askAgent",
            prompt:
              "This is a new file. Check if it has proper documentation (JSDoc comments, module description, etc.). If documentation is missing or insufficient, provide a template.",
          },
        },
      },
    ];
  }
}
