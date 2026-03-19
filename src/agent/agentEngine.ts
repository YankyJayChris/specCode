import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { glob } from "glob";
import { v4 as uuidv4 } from "uuid";
import { Spec } from "../specs/specTypes";
import { LLMManager, Message } from "../llm/llmManager";
import { MCPClient } from "../mcp/mcpClient";
import { SteeringManager } from "../steering/steeringManager";
import { SpecCodeFolderManager } from "../utils/specCodeFolder";
import { MemoryManager } from "../memory/memoryManager";
import { SessionManager } from "../session/sessionManager";
import { HookEngine } from "../hooks/hookEngine";

interface PendingCommand {
  id: string;
  command: string;
  cwd: string;
  resolve: (value: boolean) => void;
}

interface ToolResult {
  toolCallId: string;
  result: string;
}

export class AgentEngine {
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private isExecuting: boolean = false;
  private currentSpecId: string | null = null;
  private outputChannel: vscode.OutputChannel;
  private hookEngine?: HookEngine;

  constructor(
    private llmManager: LLMManager,
    private mcpClient: MCPClient,
    private steeringManager: SteeringManager,
    private specCodeFolder: SpecCodeFolderManager,
    private memoryManager: MemoryManager,
    private sessionManager: SessionManager,
  ) {
    this.outputChannel = vscode.window.createOutputChannel("Spec-Code Agent");
  }

  async executeSpec(spec: Spec): Promise<void> {
    if (this.isExecuting) {
      vscode.window.showWarningMessage("Agent is already executing a spec");
      return;
    }

    this.isExecuting = true;
    this.currentSpecId = spec.id;

    this.outputChannel.clear();
    this.outputChannel.show();
    this.outputChannel.appendLine(`=== Starting Execution: ${spec.name} ===\n`);

    // Start a session for this execution
    const session = this.sessionManager.startSession(
      spec.id,
      undefined,
      "execution",
    );

    try {
      for (const task of spec.tasks) {
        if (task.status === "completed" || task.status === "skipped") {
          continue;
        }

        if (task.optional) {
          const result = await vscode.window.showInformationMessage(
            `Skip optional task: ${task.description}?`,
            "Skip",
            "Execute",
          );
          if (result === "Skip") {
            task.status = "skipped";
            continue;
          }
        }

        await this.executeTask(spec.id, task.id, session.id);
      }

      this.sessionManager.endSession(
        session.id,
        `Completed execution of ${spec.tasks.filter((t) => t.status === "completed").length}/${spec.tasks.length} tasks.`,
      );
      vscode.window.showInformationMessage(
        `Spec "${spec.name}" execution completed!`,
      );
    } catch (error) {
      this.sessionManager.endSession(session.id, `Execution failed: ${error}`);
      vscode.window.showErrorMessage(`Execution failed: ${error}`);
    } finally {
      this.isExecuting = false;
      this.currentSpecId = null;
    }
  }

  async executeTask(
    specId: string,
    taskId: string,
    sessionId?: string,
  ): Promise<void> {
    const spec = this.specCodeFolder.getSpec(specId);
    if (!spec) {
      throw new Error("Spec not found");
    }

    const task = spec.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check dependencies
    for (const depId of task.dependencies) {
      const dep = spec.tasks.find((t) => t.id === depId);
      if (dep && dep.status !== "completed") {
        throw new Error(`Dependency ${depId} not completed`);
      }
    }

    // Create or reuse session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const session = this.sessionManager.startSession(
        specId,
        taskId,
        "execution",
      );
      activeSessionId = session.id;
    }

    task.status = "in_progress";
    task.startedAt = Date.now();
    task.sessionId = activeSessionId;
    this.outputChannel.appendLine(`\n[Task] ${task.description}`);

    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const steering = await this.steeringManager.getCombinedSteering();
    const memory = this.memoryManager.getMemoryContext(specId);
    const requirements = spec.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";
    const design = spec.files.design
      ? fs.readFileSync(spec.files.design, "utf-8")
      : "";

    // Restore prior session context (last 6 messages)
    const currentSession = this.sessionManager.getCurrentSession();
    const priorMessages = currentSession?.messages.slice(-6) || [];

    const tools = this.getAvailableTools();
    const mcpTools = await this.mcpClient.getTools();
    const allTools = [...tools, ...mcpTools];

    const systemPrompt = `You are an expert software developer executing a specific task.

${steering}

${memory ? `## Memory (Prior Context)\n${memory}\n` : ""}

## Project Context
### Requirements
${requirements}

### Design
${design}

## Current Task
${task.description}

Expected Outcome: ${task.expectedOutcome}

Use available tools to read/write files and run commands. Always explain before acting.`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      // Restore prior session messages
      ...priorMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: `Execute: ${task.description}` },
    ];

    // Log to session
    this.sessionManager.addMessage(
      activeSessionId,
      "user",
      `Execute task: ${task.description}`,
    );

    const maxIterations = 20;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const response = await this.llmManager.generateWithTools(
        modelId,
        messages,
        allTools,
      );

      messages.push({ role: "assistant", content: response.content });
      this.outputChannel.appendLine(`\n[Agent] ${response.content}`);

      // Log assistant response to session
      this.sessionManager.addMessage(
        activeSessionId,
        "assistant",
        response.content,
        {
          toolCalls: response.toolCalls,
        },
      );

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults: ToolResult[] = [];

        for (const toolCall of response.toolCalls) {
          const result = await this.executeTool(toolCall);
          toolResults.push({ toolCallId: toolCall.id, result });
        }

        messages.push({
          role: "user",
          content: toolResults
            .map((tr) => `[Tool Result: ${tr.toolCallId}]\n${tr.result}`)
            .join("\n\n"),
        });
      } else {
        break;
      }
    }

    task.status = "completed";
    task.completedAt = Date.now();

    // Record completion in memory
    this.memoryManager.appendSpecMemory(
      specId,
      `Task "${task.description}" completed in ${Math.round((Date.now() - (task.startedAt || Date.now())) / 1000)}s.`,
      "note",
    );

    this.outputChannel.appendLine(`\n[Task Complete] ${task.description}`);

    if (!sessionId) {
      this.sessionManager.endSession(
        activeSessionId,
        `Task "${task.description}" completed.`,
      );
    }
  }

  async generateCommitMessage(specId?: string): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const diff: string = await new Promise((resolve, reject) => {
      exec(
        "git diff --staged",
        { cwd: workspaceRoot },
        (err: any, stdout: string) => {
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        },
      );
    });

    if (!diff.trim()) {
      throw new Error(
        "No staged changes found. Stage your changes first (git add).",
      );
    }

    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const spec = specId ? this.specCodeFolder.getSpec(specId) : undefined;
    const memory = this.memoryManager.getMemoryContext(specId);

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert at writing git commit messages.
Use conventional commits format: type(scope): description
Types: feat, fix, refactor, test, docs, chore, style, perf
Keep subject line under 72 characters. Be specific about what changed and why.
${memory ? `\nProject context:\n${memory}` : ""}`,
      },
      {
        role: "user",
        content: `Write a commit message for these staged changes:

\`\`\`diff
${diff.substring(0, 4000)}
\`\`\`
${spec ? `\nThis is part of spec: ${spec.name}` : ""}`,
      },
    ]);

    return response.content.trim();
  }

  async reviewChanges(specId?: string): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const diff: string = await new Promise((resolve, reject) => {
      exec(
        "git diff HEAD",
        { cwd: workspaceRoot },
        (err: any, stdout: string) => {
          if (err) {
            reject(err);
          } else {
            resolve(stdout);
          }
        },
      );
    });

    if (!diff.trim()) {
      return "No uncommitted changes to review.";
    }

    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const spec = specId ? this.specCodeFolder.getSpec(specId) : undefined;
    const requirements = spec?.files.requirements
      ? fs.readFileSync(spec.files.requirements, "utf-8")
      : "";
    const steering = await this.steeringManager.getCombinedSteering();

    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are an expert code reviewer. Review changes for correctness, security, and alignment with requirements.
${steering}
Format your review:
## Change Review
### ✅ What's Good
### ⚠️ Concerns
### 🔒 Security Checks
### 📋 Requirements Alignment
### 💡 Recommendations`,
      },
      {
        role: "user",
        content: `Review these changes:\n\`\`\`diff\n${diff.substring(0, 4000)}\n\`\`\`${requirements ? `\n\nRequirements:\n${requirements}` : ""}`,
      },
    ]);

    return response.content;
  }

  async explainCode(code: string, language: string): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content:
          "You are a coding expert. Explain code clearly and concisely. Cover: purpose, how it works, key patterns, potential issues.",
      },
      {
        role: "user",
        content: `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ]);
    return response.content;
  }

  async fixCode(
    code: string,
    language: string,
    issue?: string,
  ): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content:
          "You are a coding expert. Fix the code and return ONLY the corrected code with a brief comment above explaining the fix. No other text.",
      },
      {
        role: "user",
        content: `Fix this ${language} code${issue ? ` (issue: ${issue})` : ""}:\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ]);
    return response.content;
  }

  async askAboutCode(
    code: string,
    language: string,
    question: string,
    specId?: string,
  ): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    const memory = this.memoryManager.getMemoryContext(specId);
    const response = await this.llmManager.generate(modelId, [
      {
        role: "system",
        content: `You are a helpful coding assistant. Answer questions about code clearly and accurately.
${memory ? `\nProject context:\n${memory}` : ""}`,
      },
      {
        role: "user",
        content: `Question: ${question}\n\nCode (${language}):\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ]);
    return response.content;
  }

  private getAvailableTools(): any[] {
    return [
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read the contents of a file",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path to the file",
              },
            },
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "write_file",
          description: "Write content to a file (creates if not exists)",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path to the file",
              },
              content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "edit_file",
          description: "Edit a specific part of a file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string" },
              oldString: { type: "string", description: "String to replace" },
              newString: { type: "string", description: "Replacement string" },
            },
            required: ["path", "oldString", "newString"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "run_command",
          description: "Run a terminal command (requires user approval)",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string", description: "Command to run" },
              cwd: {
                type: "string",
                description: "Working directory (optional)",
              },
            },
            required: ["command"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_files",
          description: "Search for files matching a pattern",
          parameters: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "Glob pattern" },
              contentPattern: {
                type: "string",
                description: "Text to search within files",
              },
            },
            required: ["pattern"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "list_directory",
          description: "List contents of a directory",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Relative path to directory",
              },
            },
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_diagnostics",
          description: "Get TypeScript/eslint diagnostics for a file",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relative path to file" },
            },
            required: ["path"],
          },
        },
      },
    ];
  }

  private async executeTool(toolCall: any): Promise<string> {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    try {
      switch (functionName) {
        case "read_file":
          return await this.toolReadFile(args.path);
        case "write_file":
          return await this.toolWriteFile(args.path, args.content);
        case "edit_file":
          return await this.toolEditFile(
            args.path,
            args.oldString,
            args.newString,
          );
        case "run_command":
          return await this.toolRunCommand(args.command, args.cwd);
        case "search_files":
          return await this.toolSearchFiles(args.pattern, args.contentPattern);
        case "list_directory":
          return await this.toolListDirectory(args.path);
        case "get_diagnostics":
          return await this.toolGetDiagnostics(args.path);
        default:
          return await this.mcpClient.executeTool(functionName, args);
      }
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  private async toolReadFile(filePath: string): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error("Access denied: path outside workspace");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.readFileSync(fullPath, "utf-8");
  }

  private async toolWriteFile(
    filePath: string,
    content: string,
  ): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error("Access denied: path outside workspace");
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
    const doc = await vscode.workspace.openTextDocument(fullPath);
    await vscode.window.showTextDocument(doc);

    return `File written: ${filePath}`;
  }

  private async toolEditFile(
    filePath: string,
    oldString: string,
    newString: string,
  ): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error("Access denied: path outside workspace");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    let content = fs.readFileSync(fullPath, "utf-8");
    if (!content.includes(oldString)) {
      throw new Error("Old string not found in file");
    }

    content = content.replace(oldString, newString);
    fs.writeFileSync(fullPath, content);

    return `File edited: ${filePath}`;
  }

  private async toolRunCommand(command: string, cwd?: string): Promise<string> {
    const config = vscode.workspace.getConfiguration("specCode");
    const autoApprove = config.get<boolean>(
      "autoApproveTrustedCommands",
      false,
    );
    const trustedPatterns = config.get<string[]>("trustedCommandPatterns", []);

    const isTrusted = trustedPatterns.some((pattern) => {
      try {
        return new RegExp(pattern).test(command);
      } catch {
        return false;
      }
    });

    if (!autoApprove || !isTrusted) {
      const commandId = uuidv4();
      const approved = await new Promise<boolean>((resolve) => {
        this.pendingCommands.set(commandId, {
          id: commandId,
          command,
          cwd: cwd || "",
          resolve,
        });

        vscode.window
          .showWarningMessage(
            `Approve command: ${command}`,
            { modal: true },
            "Approve",
            "Cancel",
            "Trust Pattern",
          )
          .then((result) => {
            if (result === "Approve") {
              resolve(true);
            } else if (result === "Trust Pattern") {
              vscode.commands.executeCommand("specCode.trustPattern", command);
              resolve(true);
            } else {
              resolve(false);
            }
          });
      });

      this.pendingCommands.delete(commandId);
      if (!approved) {
        return "Command cancelled by user";
      }
    }

    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    const workingDir = cwd
      ? path.join(workspaceRoot || "", cwd)
      : workspaceRoot;

    return new Promise((resolve) => {
      exec(
        command,
        { cwd: workingDir },
        (error: any, stdout: string, stderr: string) => {
          if (error) {
            resolve(
              `Command failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`,
            );
          } else {
            resolve(
              `Command executed:\n${stdout}${stderr ? "\nStderr: " + stderr : ""}`,
            );
          }
        },
      );
    });
  }

  private async toolSearchFiles(
    pattern: string,
    contentPattern?: string,
  ): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const files = (await glob(pattern, { cwd: workspaceRoot })) as string[];

    if (contentPattern) {
      const matchingFiles: string[] = [];
      for (const file of files) {
        const fullPath = path.join(workspaceRoot, file);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          try {
            if (fs.readFileSync(fullPath, "utf-8").includes(contentPattern)) {
              matchingFiles.push(file);
            }
          } catch {
            // Ignore files that can't be read
          }
        }
      }
      return `Found ${matchingFiles.length} files:\n${matchingFiles.join("\n")}`;
    }

    return `Found ${files.length} files:\n${files.join("\n")}`;
  }

  private async toolListDirectory(dirPath: string): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, dirPath);
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error("Access denied: path outside workspace");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const lines = entries.map(
      (e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`,
    );

    return `Contents of ${dirPath}:\n${lines.join("\n")}`;
  }

  private async toolGetDiagnostics(filePath: string): Promise<string> {
    const workspaceRoot = this.specCodeFolder.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace open");
    }

    const fullPath = path.join(workspaceRoot, filePath);
    const uri = vscode.Uri.file(fullPath);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length === 0) {
      return "No diagnostics found";
    }

    const lines = diagnostics.map((d) => {
      const severity =
        ["Error", "Warning", "Info", "Hint"][d.severity] || "Unknown";
      return `[${severity}] Line ${d.range.start.line + 1}: ${d.message}`;
    });

    return `Diagnostics for ${filePath}:\n${lines.join("\n")}`;
  }

  approveCommand(commandId: string): void {
    this.pendingCommands.get(commandId)?.resolve(true);
  }

  cancelCommand(commandId: string): void {
    this.pendingCommands.get(commandId)?.resolve(false);
  }

  isExecutingSpec(): boolean {
    return this.isExecuting;
  }
  getCurrentSpecId(): string | null {
    return this.currentSpecId;
  }

  async generateTests(
    code: string,
    language: string,
    filePath: string,
  ): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    if (!modelId) {
      throw new Error("No execution model configured");
    }

    const prompt = `Generate comprehensive unit tests for the following ${language} code.

File: ${filePath}

Code:
\`\`\`${language}
${code}
\`\`\`

Requirements:
- Use appropriate testing framework for ${language}
- Include test cases for normal operation, edge cases, and error conditions
- Mock external dependencies
- Follow testing best practices
- Include setup and teardown if needed
- Add descriptive test names and comments

Generate only the test code, no explanations.`;

    const response = await this.llmManager.generate(modelId, [
      { role: "user", content: prompt },
    ]);

    return response.content;
  }

  async generateDocs(
    code: string,
    language: string,
    filePath: string,
  ): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    if (!modelId) {
      throw new Error("No execution model configured");
    }

    const prompt = `Generate comprehensive documentation for the following ${language} code.

File: ${filePath}

Code:
\`\`\`${language}
${code}
\`\`\`

Generate:
- Overview/description of what this code does
- API documentation for public functions/methods
- Usage examples
- Parameter descriptions
- Return value descriptions
- Any important notes or warnings

Use appropriate documentation format for ${language} (JSDoc, docstrings, etc.).`;

    const response = await this.llmManager.generate(modelId, [
      { role: "user", content: prompt },
    ]);

    return response.content;
  }

  async reviewFile(
    code: string,
    language: string,
    filePath: string,
  ): Promise<string> {
    const modelId = await this.llmManager.getDefaultModelForPhase("execution");
    if (!modelId) {
      throw new Error("No execution model configured");
    }

    const prompt = `Perform a comprehensive code review of the following ${language} file.

File: ${filePath}

Code:
\`\`\`${language}
${code}
\`\`\`

Review for:
- Code quality and readability
- Performance issues
- Security vulnerabilities
- Best practices adherence
- Potential bugs
- Maintainability concerns
- Documentation completeness

Provide specific, actionable feedback with line references where applicable.`;

    const response = await this.llmManager.generate(modelId, [
      { role: "user", content: prompt },
    ]);

    return response.content;
  }

  setHookEngine(hookEngine: HookEngine): void {
    this.hookEngine = hookEngine;
  }
}
