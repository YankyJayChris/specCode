import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { SpecsProvider } from "./providers/specsProvider";
import { HooksProvider } from "./providers/hooksProvider";
import { SteeringProvider } from "./providers/steeringProvider";
import { MCPProvider } from "./providers/mcpProvider";
import { SessionProvider } from "./providers/sessionProvider";
import { SpecManager } from "./specs/specManager";
import { HookEngine } from "./hooks/hookEngine";
import { SteeringManager } from "./steering/steeringManager";
import { MCPClient } from "./mcp/mcpClient";
import { LLMManager, ModelConfig } from "./llm/llmManager";
import { MemoryManager } from "./memory/memoryManager";
import { SessionManager } from "./session/sessionManager";
import { AgentEngine } from "./agent/agentEngine";
import { ChatWebviewProvider } from "./webview/chatWebview";
import { ProviderSetupWebviewProvider } from "./webview/providerSetupWebview";
import { ProviderSwitcherProvider } from "./providers/providerSwitcherProvider";
import { SpecCodeFolderManager } from "./utils/specCodeFolder";
import { Spec, SpecPhase } from "./specs/specTypes";

interface CommandContext {
  specsProvider: SpecsProvider;
  hooksProvider: HooksProvider;
  steeringProvider: SteeringProvider;
  mcpProvider: MCPProvider;
  sessionProvider: SessionProvider;
  providerSwitcherProvider: ProviderSwitcherProvider;
  specManager: SpecManager;
  hookEngine: HookEngine;
  steeringManager: SteeringManager;
  mcpClient: MCPClient;
  llmManager: LLMManager;
  memoryManager: MemoryManager;
  sessionManager: SessionManager;
  agentEngine: AgentEngine;
  chatWebviewProvider: ChatWebviewProvider;
  providerSetupWebviewProvider: ProviderSetupWebviewProvider;
  specCodeFolderManager: SpecCodeFolderManager;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  cmdCtx: CommandContext,
) {
  // ==================== CHAT COMMANDS ====================

  const openChat = vscode.commands.registerCommand("specCode.openChat", () => {
    cmdCtx.chatWebviewProvider.show();
  });

  // ==================== SESSION COMMANDS ====================

  const newSession = vscode.commands.registerCommand(
    "specCode.newSession",
    async () => {
      const specs = cmdCtx.specManager.getSpecs();
      if (specs.length === 0) {
        vscode.window.showErrorMessage(
          "No specs available. Create a spec first.",
        );
        return;
      }

      const selectedSpec = await vscode.window.showQuickPick(
        specs.map((s) => ({ label: s.name, value: s.id })),
        { placeHolder: "Select spec for this session" },
      );

      if (selectedSpec) {
        const phase = await vscode.window.showQuickPick(
          [
            { label: "Requirements", value: "requirements" },
            { label: "Design", value: "design" },
            { label: "Tasks", value: "tasks" },
            { label: "Execution", value: "execution" },
          ],
          { placeHolder: "Select session phase" },
        );

        if (phase) {
          cmdCtx.sessionManager.startSession(
            selectedSpec.value,
            undefined,
            phase.value,
          );
          cmdCtx.sessionProvider.refresh();
          vscode.window.showInformationMessage(
            `Started session for ${selectedSpec.label}`,
          );
        }
      }
    },
  );
  const viewSessions = vscode.commands.registerCommand(
    "specCode.viewSessions",
    async () => {
      const sessions = cmdCtx.sessionManager.getAllSessions();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage("No sessions found");
        return;
      }

      const selected = await vscode.window.showQuickPick(
        sessions.map((s) => ({
          label: `${s.specId} - ${s.phase}`,
          description: `${s.status} • ${new Date(s.startedAt).toLocaleString()}`,
          detail: s.id,
        })),
        { placeHolder: "Select session to view" },
      );

      if (selected) {
        cmdCtx.chatWebviewProvider.show();
        // Load session context in chat
      }
    },
  );

  const endSession = vscode.commands.registerCommand(
    "specCode.endSession",
    async (sessionId?: string) => {
      if (!sessionId) {
        const sessions = cmdCtx.sessionManager
          .getAllSessions()
          .filter((s) => s.status === "active");

        if (sessions.length === 0) {
          vscode.window.showInformationMessage("No active sessions");
          return;
        }

        const selected = await vscode.window.showQuickPick(
          sessions.map((s) => ({
            label: `${s.specId} - ${s.phase}`,
            description: s.status,
            detail: s.id,
          })),
          { placeHolder: "Select session to end" },
        );
        sessionId = selected?.detail;
      }

      if (sessionId) {
        const summary = await vscode.window.showInputBox({
          prompt: "Enter session summary (optional)",
        });
        cmdCtx.sessionManager.endSession(sessionId, summary);
        cmdCtx.sessionProvider.refresh();
        vscode.window.showInformationMessage("Session ended");
      }
    },
  );

  // ==================== MEMORY COMMANDS ====================

  const viewMemory = vscode.commands.registerCommand(
    "specCode.viewMemory",
    async (specId?: string) => {
      if (!specId) {
        const specs = cmdCtx.specManager.getSpecs();
        const selected = await vscode.window.showQuickPick(
          specs.map((s) => ({ label: s.name, value: s.id })),
          { placeHolder: "Select spec to view memory" },
        );
        specId = selected?.value;
      }

      if (specId) {
        const memory = cmdCtx.memoryManager.getMemoryContext(specId);
        if (memory) {
          const doc = await vscode.workspace.openTextDocument({
            content: memory,
            language: "markdown",
          });
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showInformationMessage("No memory found for this spec");
        }
      }
    },
  );

  const clearMemory = vscode.commands.registerCommand(
    "specCode.clearMemory",
    async (specId?: string) => {
      if (!specId) {
        const specs = cmdCtx.specManager.getSpecs();
        const selected = await vscode.window.showQuickPick(
          specs.map((s) => ({ label: s.name, value: s.id })),
          { placeHolder: "Select spec to clear memory" },
        );
        specId = selected?.value;
      }

      if (specId) {
        const result = await vscode.window.showWarningMessage(
          "Clear all memory for this spec?",
          { modal: true },
          "Clear",
        );
        if (result === "Clear") {
          cmdCtx.memoryManager.clearSpecMemory(specId);
          vscode.window.showInformationMessage("Memory cleared");
        }
      }
    },
  );

  // ==================== CODE ASSISTANCE COMMANDS ====================

  const explainCode = vscode.commands.registerCommand(
    "specCode.explainCode",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);
      const language = editor.document.languageId;

      const explanation = await cmdCtx.agentEngine.explainCode(code, language);

      const doc = await vscode.workspace.openTextDocument({
        content: explanation,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    },
  );

  const fixCode = vscode.commands.registerCommand(
    "specCode.fixCode",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);
      const language = editor.document.languageId;

      const issue = await vscode.window.showInputBox({
        prompt: "Describe the issue (optional)",
        placeHolder: 'e.g., "syntax error", "performance issue"',
      });

      const fixedCode = await cmdCtx.agentEngine.fixCode(code, language, issue);

      const doc = await vscode.workspace.openTextDocument({
        content: fixedCode,
        language: language,
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    },
  );

  const askAboutCode = vscode.commands.registerCommand(
    "specCode.askAboutCode",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      const code = selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(selection);
      const language = editor.document.languageId;

      const question = await vscode.window.showInputBox({
        prompt: "What would you like to know about this code?",
        placeHolder:
          'e.g., "How does this function work?", "What are potential issues?"',
      });

      if (question) {
        const answer = await cmdCtx.agentEngine.askAboutCode(
          code,
          language,
          question,
        );

        const doc = await vscode.workspace.openTextDocument({
          content: `# Question: ${question}\n\n${answer}`,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      }
    },
  );

  const generateCommitMessage = vscode.commands.registerCommand(
    "specCode.generateCommitMessage",
    async () => {
      try {
        const message = await cmdCtx.agentEngine.generateCommitMessage();
        const result = await vscode.window.showInformationMessage(
          `Generated commit message: "${message}"`,
          "Copy to Clipboard",
          "Open Git",
        );

        if (result === "Copy to Clipboard") {
          await vscode.env.clipboard.writeText(message);
          vscode.window.showInformationMessage(
            "Commit message copied to clipboard",
          );
        } else if (result === "Open Git") {
          vscode.commands.executeCommand("workbench.view.scm");
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate commit message: ${error}`,
        );
      }
    },
  );

  const reviewChanges = vscode.commands.registerCommand(
    "specCode.reviewChanges",
    async () => {
      try {
        const review = await cmdCtx.agentEngine.reviewChanges();

        const doc = await vscode.workspace.openTextDocument({
          content: review,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to review changes: ${error}`);
      }
    },
  );

  // ==================== SPEC COMMANDS ====================

  const newSpec = vscode.commands.registerCommand(
    "specCode.newSpec",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter spec name (e.g., "user-authentication")',
        validateInput: (value) => {
          if (!value) {
            return "Name is required";
          }
          if (!/^[a-z0-9-]+$/.test(value)) {
            return "Use lowercase letters, numbers, and hyphens only";
          }
          return null;
        },
      });

      if (name) {
        const description = await vscode.window.showInputBox({
          prompt: "Enter a brief description of this feature",
        });

        await cmdCtx.specManager.createSpec(name, description || "");
        cmdCtx.specsProvider.refresh();
        vscode.window.showInformationMessage(`Created spec: ${name}`);
      }
    },
  );

  const editSpec = vscode.commands.registerCommand(
    "specCode.editSpec",
    (spec: Spec) => {
      if (spec && spec.path) {
        vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(spec.path),
        );
      }
    },
  );

  const deleteSpec = vscode.commands.registerCommand(
    "specCode.deleteSpec",
    async (spec: Spec) => {
      if (spec) {
        const result = await vscode.window.showWarningMessage(
          `Delete spec "${spec.name}"?`,
          { modal: true },
          "Delete",
        );
        if (result === "Delete") {
          await cmdCtx.specManager.deleteSpec(spec.id);
          cmdCtx.specsProvider.refresh();
        }
      }
    },
  );

  const generateRequirements = vscode.commands.registerCommand(
    "specCode.generateRequirements",
    async (spec: Spec) => {
      if (!spec) {
        return;
      }

      const prompt = await vscode.window.showInputBox({
        prompt: "Describe the feature you want to build",
        placeHolder:
          'e.g., "Create a user authentication system with login, signup, and password reset"',
      });

      if (prompt) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Generating Requirements...",
            cancellable: false,
          },
          async () => {
            try {
              await cmdCtx.specManager.generateRequirements(spec.id, prompt);
              cmdCtx.specsProvider.refresh();
              vscode.window.showInformationMessage(
                "Requirements generated! Please review and approve.",
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to generate requirements: ${error}`,
              );
            }
          },
        );
      }
    },
  );

  const generateDesign = vscode.commands.registerCommand(
    "specCode.generateDesign",
    async (spec: Spec) => {
      if (!spec) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Design...",
          cancellable: false,
        },
        async () => {
          try {
            await cmdCtx.specManager.generateDesign(spec.id);
            cmdCtx.specsProvider.refresh();
            vscode.window.showInformationMessage(
              "Design generated! Please review and approve.",
            );
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to generate design: ${error}`,
            );
          }
        },
      );
    },
  );

  const generateTasks = vscode.commands.registerCommand(
    "specCode.generateTasks",
    async (spec: Spec) => {
      if (!spec) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Implementation Plan...",
          cancellable: false,
        },
        async () => {
          try {
            await cmdCtx.specManager.generateTasks(spec.id);
            cmdCtx.specsProvider.refresh();
            vscode.window.showInformationMessage(
              "Implementation plan generated! Ready to execute.",
            );
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to generate tasks: ${error}`,
            );
          }
        },
      );
    },
  );

  const executeTasks = vscode.commands.registerCommand(
    "specCode.executeTasks",
    async (spec: Spec) => {
      if (!spec) {
        return;
      }

      const result = await vscode.window.showInformationMessage(
        "Start executing tasks? This will modify your workspace files.",
        { modal: true },
        "Execute",
        "Review First",
      );

      if (result === "Execute") {
        cmdCtx.agentEngine.executeSpec(spec);
      } else if (result === "Review First") {
        const tasksPath = path.join(spec.path, "tasks.md");
        if (fs.existsSync(tasksPath)) {
          const doc = await vscode.workspace.openTextDocument(tasksPath);
          await vscode.window.showTextDocument(doc);
        }
      }
    },
  );

  const approvePhase = vscode.commands.registerCommand(
    "specCode.approvePhase",
    async (spec: Spec, phase: SpecPhase) => {
      if (spec && phase) {
        await cmdCtx.specManager.approvePhase(spec.id, phase);
        cmdCtx.specsProvider.refresh();
      }
    },
  );

  const regeneratePhase = vscode.commands.registerCommand(
    "specCode.regeneratePhase",
    async (spec: Spec, phase: SpecPhase) => {
      if (!spec || !phase) {
        return;
      }

      const feedback = await vscode.window.showInputBox({
        prompt: "What would you like to change?",
      });

      if (feedback) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Regenerating ${phase}...`,
            cancellable: false,
          },
          async () => {
            try {
              await cmdCtx.specManager.regeneratePhase(
                spec.id,
                phase,
                feedback,
              );
              cmdCtx.specsProvider.refresh();
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to regenerate: ${error}`);
            }
          },
        );
      }
    },
  );
  // ==================== HOOK COMMANDS ====================

  const newHook = vscode.commands.registerCommand(
    "specCode.newHook",
    async () => {
      const examples = cmdCtx.hookEngine.getExampleHooks();
      const selected = await vscode.window.showQuickPick(
        [
          {
            label: "Custom Hook",
            description: "Create a custom hook",
            value: null,
          },
          ...examples.map((ex) => ({
            label: ex.name,
            description: ex.description,
            value: ex.config,
          })),
        ],
        { placeHolder: "Select hook type or create custom" },
      );

      if (selected) {
        if (selected.value) {
          // Use example
          await cmdCtx.hookEngine.createHook(selected.value);
          cmdCtx.hooksProvider.refresh();
          vscode.window.showInformationMessage(
            `Created hook: ${selected.label}`,
          );
        } else {
          // Create custom
          const name = await vscode.window.showInputBox({
            prompt: "Enter hook name",
            validateInput: (value) => (value ? null : "Name is required"),
          });

          if (name) {
            const eventType = await vscode.window.showQuickPick(
              [
                { label: "File Edited", value: "fileEdited" },
                { label: "File Created", value: "fileCreated" },
                { label: "File Deleted", value: "fileDeleted" },
                { label: "User Triggered", value: "userTriggered" },
                { label: "Prompt Submit", value: "promptSubmit" },
                { label: "Agent Stop", value: "agentStop" },
                { label: "Pre Tool Use", value: "preToolUse" },
                { label: "Post Tool Use", value: "postToolUse" },
                { label: "Pre Task Execution", value: "preTaskExecution" },
                { label: "Post Task Execution", value: "postTaskExecution" },
              ],
              { placeHolder: "Select trigger event" },
            );

            if (eventType) {
              let patterns: string[] | undefined;
              let toolTypes: string[] | undefined;

              if (
                ["fileEdited", "fileCreated", "fileDeleted"].includes(
                  eventType.value,
                )
              ) {
                const pattern = await vscode.window.showInputBox({
                  prompt: "File patterns (comma-separated)",
                  placeHolder: "*.ts, *.js, src/**/*.py",
                });
                patterns = pattern
                  ? pattern.split(",").map((p) => p.trim())
                  : ["*"];
              }

              if (["preToolUse", "postToolUse"].includes(eventType.value)) {
                const toolType = await vscode.window.showInputBox({
                  prompt:
                    "Tool types (comma-separated: read, write, shell, web, spec, * or regex patterns)",
                  placeHolder: "write, .*sql.*",
                });
                toolTypes = toolType
                  ? toolType.split(",").map((t) => t.trim())
                  : ["*"];
              }

              const actionType = await vscode.window.showQuickPick(
                [
                  { label: "Ask Agent", value: "askAgent" },
                  { label: "Run Command", value: "runCommand" },
                ],
                { placeHolder: "Select action type" },
              );

              if (actionType) {
                let prompt: string | undefined;
                let command: string | undefined;

                if (actionType.value === "askAgent") {
                  prompt = await vscode.window.showInputBox({
                    prompt: "Enter the agent prompt for this hook",
                    placeHolder:
                      'e.g., "Review this change for potential issues"',
                  });
                } else {
                  command = await vscode.window.showInputBox({
                    prompt: "Enter the command to run",
                    placeHolder: 'e.g., "npm run lint", "git add ."',
                  });
                }

                await cmdCtx.hookEngine.createHook({
                  name,
                  version: "1.0.0",
                  when: {
                    type: eventType.value as any,
                    patterns,
                    toolTypes,
                  },
                  then: {
                    type: actionType.value as any,
                    prompt,
                    command,
                  },
                  enabled: true,
                });
                cmdCtx.hooksProvider.refresh();
                vscode.window.showInformationMessage(`Created hook: ${name}`);
              }
            }
          }
        }
      }
    },
  );

  const editHook = vscode.commands.registerCommand(
    "specCode.editHook",
    (hook: any) => {
      if (hook && hook.path) {
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.file(hook.path),
        );
      }
    },
  );

  const toggleHook = vscode.commands.registerCommand(
    "specCode.toggleHook",
    async (hook: any) => {
      if (hook) {
        await cmdCtx.hookEngine.toggleHook(hook.id);
        cmdCtx.hooksProvider.refresh();
      }
    },
  );

  const deleteHook = vscode.commands.registerCommand(
    "specCode.deleteHook",
    async (hook: any) => {
      if (hook) {
        const result = await vscode.window.showWarningMessage(
          `Delete hook "${hook.name}"?`,
          { modal: true },
          "Delete",
        );
        if (result === "Delete") {
          await cmdCtx.hookEngine.deleteHook(hook.id);
          cmdCtx.hooksProvider.refresh();
        }
      }
    },
  );

  const triggerHook = vscode.commands.registerCommand(
    "specCode.triggerHook",
    async (hook?: any) => {
      if (!hook) {
        const hooks = cmdCtx.hookEngine
          .getHooks()
          .filter((h) => h.when.type === "userTriggered");
        const selected = await vscode.window.showQuickPick(
          hooks.map((h) => ({
            label: h.name,
            description: h.description,
            value: h,
          })),
          { placeHolder: "Select hook to trigger" },
        );
        hook = selected?.value;
      }

      if (hook) {
        await cmdCtx.hookEngine.triggerHook("userTriggered", {
          hookId: hook.id,
        });
        vscode.window.showInformationMessage(`Triggered hook: ${hook.name}`);
      }
    },
  );

  // ==================== STEERING COMMANDS ====================

  const newSteering = vscode.commands.registerCommand(
    "specCode.newSteering",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter steering document name",
        validateInput: (value) => (value ? null : "Name is required"),
      });

      if (name) {
        const scope = await vscode.window.showQuickPick(
          [
            { label: "Workspace", value: "workspace" },
            { label: "Global", value: "global" },
          ],
          { placeHolder: "Select scope" },
        );

        if (scope) {
          await cmdCtx.steeringManager.createSteeringDocument(
            name,
            scope.value as "workspace" | "global",
          );
          cmdCtx.steeringProvider.refresh();
        }
      }
    },
  );

  const editSteering = vscode.commands.registerCommand(
    "specCode.editSteering",
    (steering: any) => {
      if (steering && steering.path) {
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.file(steering.path),
        );
      }
    },
  );

  // ==================== MCP COMMANDS ====================

  const addMCPServer = vscode.commands.registerCommand(
    "specCode.addMCPServer",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter server name",
        validateInput: (value) => (value ? null : "Name is required"),
      });

      if (name) {
        const transport = await vscode.window.showQuickPick(
          [
            { label: "HTTP/SSE", value: "http" },
            { label: "STDIO", value: "stdio" },
          ],
          { placeHolder: "Select transport type" },
        );

        if (transport) {
          const config: any = { name, transport: transport.value };

          if (transport.value === "http") {
            const url = await vscode.window.showInputBox({
              prompt: "Enter server URL",
              placeHolder: "http://localhost:3000/sse",
            });
            config.url = url;
          } else {
            const command = await vscode.window.showInputBox({
              prompt: "Enter command to run",
              placeHolder: "npx @modelcontextprotocol/server-filesystem",
            });
            config.command = command;
          }

          await cmdCtx.mcpClient.addServer(config);
          cmdCtx.mcpProvider.refresh();
        }
      }
    },
  );

  const removeMCPServer = vscode.commands.registerCommand(
    "specCode.removeMCPServer",
    async (server: any) => {
      if (server) {
        const result = await vscode.window.showWarningMessage(
          `Remove MCP server "${server.name}"?`,
          { modal: true },
          "Remove",
        );
        if (result === "Remove") {
          await cmdCtx.mcpClient.removeServer(server.id);
          cmdCtx.mcpProvider.refresh();
        }
      }
    },
  );

  const refreshMCP = vscode.commands.registerCommand(
    "specCode.refreshMCP",
    async () => {
      await cmdCtx.mcpClient.refreshServers();
      cmdCtx.mcpProvider.refresh();
      vscode.window.showInformationMessage("MCP servers refreshed");
    },
  );

  // ==================== SETTINGS COMMANDS ====================

  const openSettings = vscode.commands.registerCommand(
    "specCode.openSettings",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "specCode",
      );
    },
  );

  const openProviderSetup = vscode.commands.registerCommand(
    "specCode.openProviderSetup",
    () => {
      cmdCtx.providerSetupWebviewProvider.show();
    },
  );

  const addModel = vscode.commands.registerCommand(
    "specCode.addModel",
    async () => {
      // Redirect to the new addProvider command which uses templates
      vscode.commands.executeCommand("specCode.addProvider");
    },
  );

  const testModel = vscode.commands.registerCommand(
    "specCode.testModel",
    async (modelId: string) => {
      if (!modelId) {
        const models = cmdCtx.llmManager.getModels();
        const selected = await vscode.window.showQuickPick(
          models.map((m) => ({
            label: m.name,
            description: m.provider,
            value: m.id,
          })),
          { placeHolder: "Select model to test" },
        );
        if (selected) {
          modelId = selected.value;
        } else {
          return;
        }
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Testing model connection...",
          cancellable: false,
        },
        async () => {
          try {
            const result = await cmdCtx.llmManager.testModel(modelId);
            if (result.success) {
              vscode.window.showInformationMessage(
                `Connection successful! Response: "${result.response?.substring(0, 100)}..."`,
              );
            } else {
              vscode.window.showErrorMessage(
                `Connection failed: ${result.error}`,
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Test failed: ${error}`);
          }
        },
      );
    },
  );

  // ==================== NEW PROVIDER MANAGEMENT COMMANDS ====================

  const addProvider = vscode.commands.registerCommand(
    "specCode.addProvider",
    async () => {
      const templates = await cmdCtx.llmManager.getProviderTemplates();

      const selected = await vscode.window.showQuickPick(
        templates.map((template) => ({
          label: template.name,
          description: template.description,
          detail: template.helpText,
          value: template,
        })),
        { placeHolder: "Select a provider template" },
      );

      if (!selected) {
        return;
      }

      const template = selected.value;
      const name = await vscode.window.showInputBox({
        prompt: "Enter a name for this provider configuration",
        value: template.name,
      });

      if (!name) {
        return;
      }

      const id = `${template.provider}-${Date.now()}`;
      let apiKey = "";

      if (template.requiredFields.includes("apiKey")) {
        apiKey =
          (await vscode.window.showInputBox({
            prompt: `Enter API key for ${template.name}`,
            password: true,
            placeHolder: "Your API key will be stored securely",
          })) || "";

        if (!apiKey) {
          vscode.window.showErrorMessage(
            "API key is required for this provider",
          );
          return;
        }
      }

      let baseUrl = template.defaultSettings.baseUrl;
      if (["ollama", "lmstudio", "custom"].includes(template.provider)) {
        baseUrl =
          (await vscode.window.showInputBox({
            prompt: "Enter base URL",
            value: template.defaultSettings.baseUrl || "",
            placeHolder:
              template.provider === "ollama"
                ? "http://localhost:11434/v1"
                : template.provider === "lmstudio"
                  ? "http://localhost:1234/v1"
                  : "http://localhost:3000/v1",
          })) || template.defaultSettings.baseUrl;
      }

      const modelName = await vscode.window.showInputBox({
        prompt: "Enter model name",
        value: template.defaultSettings.modelName || "",
        placeHolder: "e.g., claude-3-5-sonnet-20241022",
      });

      if (!modelName) {
        vscode.window.showErrorMessage("Model name is required");
        return;
      }

      try {
        await cmdCtx.llmManager.createFromTemplate(template.id, {
          id,
          name,
          apiKey,
          baseUrl,
          modelName,
        });

        vscode.window.showInformationMessage(`Added provider: ${name}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to add provider: ${error}`);
      }
    },
  );

  const editProvider = vscode.commands.registerCommand(
    "specCode.editProvider",
    async (providerId?: string) => {
      if (!providerId) {
        const models = cmdCtx.llmManager.getModels();
        const selected = await vscode.window.showQuickPick(
          models.map((m) => ({
            label: m.name,
            description: `${m.provider} • ${m.modelName}`,
            value: m.id,
          })),
          { placeHolder: "Select provider to edit" },
        );
        providerId = selected?.value;
      }

      if (!providerId) {
        return;
      }

      const provider = cmdCtx.llmManager.getModel(providerId);
      if (!provider) {
        vscode.window.showErrorMessage("Provider not found");
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: "Provider name",
        value: provider.name,
      });

      if (!name) {
        return;
      }

      const modelName = await vscode.window.showInputBox({
        prompt: "Model name",
        value: provider.modelName,
      });

      if (!modelName) {
        return;
      }

      const updateApiKey = await vscode.window.showQuickPick(
        [
          { label: "Keep current API key", value: false },
          { label: "Update API key", value: true },
        ],
        { placeHolder: "API key options" },
      );

      let apiKey: string | undefined;
      if (updateApiKey?.value) {
        apiKey = await vscode.window.showInputBox({
          prompt: "Enter new API key",
          password: true,
          placeHolder: "Leave empty to remove API key",
        });
      }

      try {
        const updates: Partial<ModelConfig> = {
          name,
          modelName,
        };

        if (apiKey !== undefined) {
          updates.apiKey = apiKey;
        }

        await cmdCtx.llmManager.updateProvider(providerId, updates);
        vscode.window.showInformationMessage(`Updated provider: ${name}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to update provider: ${error}`);
      }
    },
  );

  const removeProvider = vscode.commands.registerCommand(
    "specCode.removeProvider",
    async (providerId?: string) => {
      if (!providerId) {
        const models = cmdCtx.llmManager.getModels();
        const selected = await vscode.window.showQuickPick(
          models.map((m) => ({
            label: m.name,
            description: `${m.provider} • ${m.modelName}`,
            value: m.id,
          })),
          { placeHolder: "Select provider to remove" },
        );
        providerId = selected?.value;
      }

      if (!providerId) {
        return;
      }

      const provider = cmdCtx.llmManager.getModel(providerId);
      if (!provider) {
        vscode.window.showErrorMessage("Provider not found");
        return;
      }

      const result = await vscode.window.showWarningMessage(
        `Remove provider "${provider.name}"? This will also delete the stored API key.`,
        { modal: true },
        "Remove",
      );

      if (result === "Remove") {
        try {
          await cmdCtx.llmManager.removeProvider(providerId);
          vscode.window.showInformationMessage(
            `Removed provider: ${provider.name}`,
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to remove provider: ${error}`);
        }
      }
    },
  );

  const switchProvider = vscode.commands.registerCommand(
    "specCode.switchProvider",
    async () => {
      const models = cmdCtx.llmManager.getModels();
      const activeProvider = cmdCtx.llmManager.getActiveProvider();

      const selected = await vscode.window.showQuickPick(
        models.map((m) => ({
          label: m.name,
          description: `${m.provider} • ${m.modelName}`,
          detail: m.id === activeProvider?.id ? "Currently active" : "",
          value: m.id,
        })),
        { placeHolder: "Select provider to activate" },
      );

      if (selected && selected.value !== activeProvider?.id) {
        try {
          await cmdCtx.llmManager.setActiveProvider(selected.value);
          vscode.window.showInformationMessage(
            `Switched to provider: ${selected.label}`,
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to switch provider: ${error}`);
        }
      }
    },
  );

  const testProvider = vscode.commands.registerCommand(
    "specCode.testProvider",
    async (providerId?: string) => {
      if (!providerId) {
        const models = cmdCtx.llmManager.getModels();
        const selected = await vscode.window.showQuickPick(
          models.map((m) => ({
            label: m.name,
            description: `${m.provider} • ${m.modelName}`,
            value: m.id,
          })),
          { placeHolder: "Select provider to test" },
        );
        providerId = selected?.value;
      }

      if (!providerId) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Testing provider connection...",
          cancellable: false,
        },
        async () => {
          try {
            const result = await cmdCtx.llmManager.testProviderConnection(
              providerId!,
              30000,
            );
            if (result.success) {
              vscode.window.showInformationMessage(
                `Connection successful! Response: "${result.response?.substring(0, 100)}..."`,
              );
            } else {
              vscode.window.showErrorMessage(
                `Connection failed: ${result.error}`,
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Test failed: ${error}`);
          }
        },
      );
    },
  );

  const discoverProviders = vscode.commands.registerCommand(
    "specCode.discoverProviders",
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Discovering local providers...",
          cancellable: false,
        },
        async () => {
          try {
            const discovered = await cmdCtx.llmManager.discoverLocalProviders();

            if (discovered.length === 0) {
              vscode.window.showInformationMessage(
                "No local providers found. Make sure Ollama or LM Studio is running.",
              );
              return;
            }

            const selected = await vscode.window.showQuickPick(
              discovered.map((provider) => ({
                label: provider.name,
                description: `${provider.provider} • ${provider.modelName}`,
                detail: "Auto-discovered local provider",
                value: provider,
              })),
              {
                placeHolder: "Select providers to add",
                canPickMany: true,
              },
            );

            if (selected && selected.length > 0) {
              let addedCount = 0;
              for (const item of selected) {
                try {
                  await cmdCtx.llmManager.addProvider(item.value);
                  addedCount++;
                } catch (error) {
                  console.error(
                    `Failed to add provider ${item.value.name}:`,
                    error,
                  );
                }
              }

              vscode.window.showInformationMessage(
                `Added ${addedCount} local provider(s)`,
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(`Discovery failed: ${error}`);
          }
        },
      );
    },
  );

  const importProviderConfig = vscode.commands.registerCommand(
    "specCode.importProviderConfig",
    async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          "JSON files": ["json"],
        },
        title: "Select provider configuration file to import",
      });

      if (fileUri && fileUri[0]) {
        try {
          const fileContent = await vscode.workspace.fs.readFile(fileUri[0]);
          const configJson = Buffer.from(fileContent).toString("utf8");

          await cmdCtx.llmManager.importConfiguration(configJson);
        } catch (error) {
          vscode.window.showErrorMessage(`Import failed: ${error}`);
        }
      }
    },
  );

  const exportProviderConfig = vscode.commands.registerCommand(
    "specCode.exportProviderConfig",
    async () => {
      try {
        const configJson = await cmdCtx.llmManager.exportConfiguration();

        const saveUri = await vscode.window.showSaveDialog({
          filters: {
            "JSON files": ["json"],
          },
          defaultUri: vscode.Uri.file("provider-config.json"),
          title: "Export provider configuration",
        });

        if (saveUri) {
          await vscode.workspace.fs.writeFile(
            saveUri,
            Buffer.from(configJson, "utf8"),
          );
          vscode.window.showInformationMessage(
            `Configuration exported to ${saveUri.fsPath}`,
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Export failed: ${error}`);
      }
    },
  );

  const clearCredentials = vscode.commands.registerCommand(
    "specCode.clearCredentials",
    async () => {
      const result = await vscode.window.showWarningMessage(
        "Clear all stored API keys? This action cannot be undone.",
        { modal: true },
        "Clear All",
      );

      if (result === "Clear All") {
        try {
          await cmdCtx.llmManager.clearAllSecureCredentials();
          vscode.window.showInformationMessage(
            "All API keys cleared from secure storage",
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to clear credentials: ${error}`,
          );
        }
      }
    },
  );

  // ==================== PROVIDER SWITCHER COMMANDS ====================

  const activateProvider = vscode.commands.registerCommand(
    "specCode.activateProvider",
    async (providerId: string) => {
      if (!providerId) {
        vscode.window.showErrorMessage("Provider ID is required");
        return;
      }

      try {
        // Validate provider before activation
        const provider = cmdCtx.llmManager.getModel(providerId);
        if (!provider) {
          vscode.window.showErrorMessage("Provider not found");
          return;
        }

        // Test connection before activation
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Validating provider: ${provider.name}...`,
            cancellable: false,
          },
          async () => {
            const testResult = await cmdCtx.llmManager.testProviderConnection(
              providerId,
              10000, // 10 second timeout
            );

            if (!testResult.success) {
              throw new Error(
                `Provider validation failed: ${testResult.error}`,
              );
            }

            await cmdCtx.llmManager.setActiveProvider(providerId);
          },
        );

        cmdCtx.providerSwitcherProvider.refresh();
        vscode.window.showInformationMessage(
          `Activated provider: ${provider.name}`,
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate provider: ${error}`);
      }
    },
  );

  const setPhaseProvider = vscode.commands.registerCommand(
    "specCode.setPhaseProvider",
    async (phase: string) => {
      if (!phase) {
        vscode.window.showErrorMessage("Phase is required");
        return;
      }

      const providers = cmdCtx.llmManager.getModels();
      if (providers.length === 0) {
        vscode.window.showErrorMessage("No providers configured");
        return;
      }

      const currentProviderId = await cmdCtx.llmManager.getPhaseProvider(phase);

      const options = [
        {
          label: "Use Active Provider",
          description: "Use the currently active provider for this phase",
          value: "",
        },
        ...providers.map((provider) => ({
          label: provider.name,
          description: `${provider.provider} • ${provider.modelName}`,
          detail: provider.id === currentProviderId ? "Currently selected" : "",
          value: provider.id,
        })),
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: `Select provider for ${phase} phase`,
      });

      if (selected !== undefined) {
        try {
          if (selected.value) {
            // Validate the selected provider
            const testResult = await cmdCtx.llmManager.testProviderConnection(
              selected.value,
              5000, // 5 second timeout for phase provider validation
            );

            if (!testResult.success) {
              const proceed = await vscode.window.showWarningMessage(
                `Provider validation failed: ${testResult.error}\n\nSet anyway?`,
                { modal: true },
                "Set Anyway",
                "Cancel",
              );

              if (proceed !== "Set Anyway") {
                return;
              }
            }

            await cmdCtx.llmManager.setPhaseProvider(phase, selected.value);
            vscode.window.showInformationMessage(
              `Set ${selected.label} as provider for ${phase} phase`,
            );
          } else {
            // Clear phase-specific provider (use active provider)
            await cmdCtx.llmManager.setPhaseProvider(phase, "");
            vscode.window.showInformationMessage(
              `${phase} phase will now use the active provider`,
            );
          }

          cmdCtx.providerSwitcherProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to set phase provider: ${error}`,
          );
        }
      }
    },
  );

  const refreshProviderStatus = vscode.commands.registerCommand(
    "specCode.refreshProviderStatus",
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Refreshing provider status...",
          cancellable: false,
        },
        async () => {
          try {
            await cmdCtx.llmManager.refreshProviderAvailability();
            cmdCtx.providerSwitcherProvider.refresh();
            vscode.window.showInformationMessage("Provider status refreshed");
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to refresh provider status: ${error}`,
            );
          }
        },
      );
    },
  );

  // ==================== TASK COMMANDS ====================

  const startTask = vscode.commands.registerCommand(
    "specCode.startTask",
    async (specId: string, taskId: string) => {
      await cmdCtx.agentEngine.executeTask(specId, taskId);
    },
  );

  const toggleTaskOptional = vscode.commands.registerCommand(
    "specCode.toggleTaskOptional",
    async (specId: string, taskId: string) => {
      await cmdCtx.specManager.toggleTaskOptional(specId, taskId);
      cmdCtx.specsProvider.refresh();
    },
  );

  // ==================== NEW COMMANDS ====================

  const newSpecFromTemplate = vscode.commands.registerCommand(
    "specCode.newSpecFromTemplate",
    async () => {
      const { SPEC_TEMPLATES } = await import("./specs/specTypes");

      const selected = await vscode.window.showQuickPick(
        SPEC_TEMPLATES.map((template) => ({
          label: template.name,
          description: template.description,
          detail: template.steeringHints,
          value: template,
        })),
        { placeHolder: "Select a spec template" },
      );

      if (selected) {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter spec name (e.g., "user-authentication")',
          validateInput: (value) => {
            if (!value) {
              return "Name is required";
            }
            if (!/^[a-z0-9-]+$/.test(value)) {
              return "Use lowercase letters, numbers, and hyphens only";
            }
            return null;
          },
        });

        if (name) {
          await cmdCtx.specManager.createSpecFromTemplate(name, selected.value);
          cmdCtx.specsProvider.refresh();
          vscode.window.showInformationMessage(
            `Created spec: ${name} from ${selected.value.name} template`,
          );
        }
      }
    },
  );

  const generateTests = vscode.commands.registerCommand(
    "specCode.generateTests",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const code = editor.document.getText();
      const language = editor.document.languageId;
      const filePath = editor.document.fileName;

      try {
        const tests = await cmdCtx.agentEngine.generateTests(
          code,
          language,
          filePath,
        );

        const testFileName = filePath.replace(
          /\.(ts|js|py|java|cs)$/,
          ".test.$1",
        );
        const doc = await vscode.workspace.openTextDocument({
          content: tests,
          language: language,
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        const result = await vscode.window.showInformationMessage(
          "Tests generated! Save to file?",
          "Save",
          "Copy to Clipboard",
        );

        if (result === "Save") {
          const uri = vscode.Uri.file(testFileName);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(tests));
          vscode.window.showInformationMessage(
            `Tests saved to ${testFileName}`,
          );
        } else if (result === "Copy to Clipboard") {
          await vscode.env.clipboard.writeText(tests);
          vscode.window.showInformationMessage("Tests copied to clipboard");
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate tests: ${error}`);
      }
    },
  );

  const generateDocs = vscode.commands.registerCommand(
    "specCode.generateDocs",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const code = editor.document.getText();
      const language = editor.document.languageId;
      const filePath = editor.document.fileName;

      try {
        const docs = await cmdCtx.agentEngine.generateDocs(
          code,
          language,
          filePath,
        );

        const doc = await vscode.workspace.openTextDocument({
          content: docs,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        const result = await vscode.window.showInformationMessage(
          "Documentation generated!",
          "Insert Inline",
          "Copy to Clipboard",
        );

        if (result === "Insert Inline") {
          const position = new vscode.Position(0, 0);
          await editor.edit((editBuilder) => {
            editBuilder.insert(position, docs + "\n\n");
          });
        } else if (result === "Copy to Clipboard") {
          await vscode.env.clipboard.writeText(docs);
          vscode.window.showInformationMessage(
            "Documentation copied to clipboard",
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate documentation: ${error}`,
        );
      }
    },
  );

  const reviewCurrentFile = vscode.commands.registerCommand(
    "specCode.reviewCurrentFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const code = editor.document.getText();
      const language = editor.document.languageId;
      const filePath = editor.document.fileName;

      try {
        const review = await cmdCtx.agentEngine.reviewFile(
          code,
          language,
          filePath,
        );

        const doc = await vscode.workspace.openTextDocument({
          content: review,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to review file: ${error}`);
      }
    },
  );

  const askAboutSelection = vscode.commands.registerCommand(
    "specCode.askAboutSelection",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage("No text selected");
        return;
      }

      const code = editor.document.getText(selection);
      const language = editor.document.languageId;

      const question = await vscode.window.showInputBox({
        prompt: "What would you like to know about this code?",
        placeHolder:
          'e.g., "How does this work?", "What are potential issues?"',
      });

      if (question) {
        try {
          // Open chat and send the question with code context
          cmdCtx.chatWebviewProvider.show();
          cmdCtx.chatWebviewProvider.sendMessage(
            `${question}\n\n\`\`\`${language}\n${code}\n\`\`\``,
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to ask about selection: ${error}`,
          );
        }
      }
    },
  );

  const clearSpecMemory = vscode.commands.registerCommand(
    "specCode.clearSpecMemory",
    async (specId?: string) => {
      if (!specId) {
        const specs = cmdCtx.specManager.getSpecs();
        const selected = await vscode.window.showQuickPick(
          specs.map((s) => ({ label: s.name, value: s.id })),
          { placeHolder: "Select spec to clear memory" },
        );
        specId = selected?.value;
      }

      if (specId) {
        const result = await vscode.window.showWarningMessage(
          "Clear all memory for this spec?",
          { modal: true },
          "Clear",
        );
        if (result === "Clear") {
          cmdCtx.memoryManager.clearSpecMemory(specId);
          vscode.window.showInformationMessage("Spec memory cleared");
        }
      }
    },
  );

  const resumeSession = vscode.commands.registerCommand(
    "specCode.resumeSession",
    async (sessionId?: string) => {
      if (!sessionId) {
        const sessions = cmdCtx.sessionManager
          .getAllSessions()
          .filter((s) => s.status === "paused" || s.status === "completed");

        const selected = await vscode.window.showQuickPick(
          sessions.map((s) => ({
            label: `${s.specId} - ${s.phase}`,
            description: `${new Date(s.startedAt).toLocaleString()} • ${s.totalTokens} tokens`,
            detail: s.id,
          })),
          { placeHolder: "Select session to resume" },
        );
        sessionId = selected?.detail;
      }

      if (sessionId) {
        const session = cmdCtx.sessionManager.resumeSession(sessionId);
        if (session) {
          cmdCtx.chatWebviewProvider.show();
          vscode.window.showInformationMessage(
            `Resumed session: ${session.specId}`,
          );
        } else {
          vscode.window.showErrorMessage("Failed to resume session");
        }
      }
    },
  );

  const approveCommand = vscode.commands.registerCommand(
    "specCode.approveCommand",
    (commandId: string) => {
      cmdCtx.agentEngine.approveCommand(commandId);
    },
  );

  const cancelCommand = vscode.commands.registerCommand(
    "specCode.cancelCommand",
    (commandId: string) => {
      cmdCtx.agentEngine.cancelCommand(commandId);
    },
  );

  const trustPattern = vscode.commands.registerCommand(
    "specCode.trustPattern",
    async (pattern: string) => {
      if (!pattern) {
        pattern =
          (await vscode.window.showInputBox({
            prompt: "Enter regex pattern to trust",
            placeHolder: "^npm (install|run)",
          })) || "";
      }

      if (pattern) {
        const config = vscode.workspace.getConfiguration("specCode");
        const patterns = config.get<string[]>("trustedCommandPatterns", []);
        patterns.push(pattern);
        await config.update("trustedCommandPatterns", patterns, true);
        vscode.window.showInformationMessage(
          `Added trusted pattern: ${pattern}`,
        );
      }
    },
  );

  // Register all disposables
  context.subscriptions.push(
    openChat,
    newSession,
    viewSessions,
    endSession,
    viewMemory,
    clearMemory,
    explainCode,
    fixCode,
    askAboutCode,
    generateCommitMessage,
    reviewChanges,
    newSpec,
    editSpec,
    deleteSpec,
    generateRequirements,
    generateDesign,
    generateTasks,
    executeTasks,
    approvePhase,
    regeneratePhase,
    newHook,
    editHook,
    toggleHook,
    deleteHook,
    triggerHook,
    newSteering,
    editSteering,
    addMCPServer,
    removeMCPServer,
    refreshMCP,
    openSettings,
    openProviderSetup,
    addModel,
    testModel,
    startTask,
    toggleTaskOptional,
    approveCommand,
    cancelCommand,
    trustPattern,
    // New commands
    newSpecFromTemplate,
    generateTests,
    generateDocs,
    reviewCurrentFile,
    askAboutSelection,
    clearSpecMemory,
    resumeSession,
    // New provider management commands
    addProvider,
    editProvider,
    removeProvider,
    switchProvider,
    testProvider,
    discoverProviders,
    importProviderConfig,
    exportProviderConfig,
    clearCredentials,
    // Provider switcher commands
    activateProvider,
    setPhaseProvider,
    refreshProviderStatus,
  );
}
