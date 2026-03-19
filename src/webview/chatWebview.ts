import * as vscode from "vscode";
import { SpecManager } from "../specs/specManager";
import { AgentEngine } from "../agent/agentEngine";
import { LLMManager } from "../llm/llmManager";
import { SessionManager } from "../session/sessionManager";
import { MemoryManager } from "../memory/memoryManager";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  mode?: "spec-driven" | "vibe";
  images?: string[];
  tokens?: number;
  specId?: string;
  sessionId?: string;
  providerId?: string;
}

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private messages: ChatMessage[] = [];
  private currentMode: "spec-driven" | "vibe" = "spec-driven";
  private currentSpecId?: string;
  private currentSessionId?: string;
  private streamingMessageId?: string;
  private currentProviderId?: string;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private specManager: SpecManager,
    private agentEngine: AgentEngine,
    private llmManager: LLMManager,
    private sessionManager: SessionManager,
    private memoryManager: MemoryManager,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "sendMessage":
          await this.handleUserMessage(data.content, data.images);
          break;
        case "setMode":
          this.currentMode = data.mode;
          this.postMessage("modeChanged", { mode: data.mode });
          break;
        case "selectProvider":
          await this.handleSelectProvider(data.providerId);
          break;
        case "createSpec":
          await this.handleCreateSpec(data.prompt);
          break;
        case "selectSpec":
          this.currentSpecId = data.specId;
          this.postMessage("specSelected", { specId: data.specId });
          break;
        case "approvePhase":
          await this.handleApprovePhase(data.specId, data.phase);
          break;
        case "regeneratePhase":
          await this.handleRegeneratePhase(data.specId, data.phase);
          break;
        case "executeTask":
          await this.handleExecuteTask(data.specId, data.taskId);
          break;
        case "toggleTaskOptional":
          await this.handleToggleTaskOptional(data.specId, data.taskId);
          break;
        case "loadSpecs":
          await this.sendSpecsList();
          break;
        case "loadSessions":
          await this.sendSessionsList();
          break;
        case "selectSession":
          await this.loadSession(data.sessionId);
          break;
        case "newSession":
          await this.handleNewSession(data.name, data.type);
          break;
        case "endSession":
          await this.handleEndSession(data.sessionId, data.summary);
          break;
        case "clearChat":
          this.messages = [];
          this.postMessage("chatCleared");
          break;
        case "exportChat":
          await this.handleExportChat();
          break;
        case "openSettings":
          vscode.commands.executeCommand("specCode.openSettings");
          break;
        case "addModel":
          vscode.commands.executeCommand("specCode.addModel");
          break;
        case "openProviderSetup":
          vscode.commands.executeCommand("specCode.openProviderSetup");
          break;
        case "testProvider":
          await this.handleTestProvider(data.providerId);
          break;
        case "refreshProviders":
          await this.handleRefreshProviders();
          break;
      }
    });

    // Send initial data
    this.sendSpecsList();
    this.sendSessionsList();
    this.sendModels();
    this.sendProviderStatus();
  }

  show() {
    if (this.view) {
      this.view.show();
    } else {
      vscode.commands.executeCommand("specCode.chat.focus");
    }
  }

  sendMessage(content: string) {
    if (this.view) {
      this.postMessage("userMessage", { content });
    }
  }

  async loadSession(sessionId: string) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return;
    }

    this.currentSessionId = sessionId;
    this.messages = session.messages.map((m) => ({
      id: `msg-${m.timestamp}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
      tokens: m.tokens,
      sessionId: sessionId,
    }));

    this.postMessage("sessionLoaded", {
      sessionId,
      messages: this.messages,
      sessionName: `${session.specId}-${session.phase}`,
      sessionType: session.phase,
    });
  }

  private async handleUserMessage(content: string, images?: string[]) {
    // Start or continue session
    if (!this.currentSessionId) {
      const session = this.sessionManager.startSession(
        this.currentSpecId || "",
        this.currentMode === "spec-driven" ? "execution" : "chat",
        `Chat - ${new Date().toLocaleTimeString()}`,
      );
      this.currentSessionId = session.id;
    }

    // Get the provider to use for this message
    const providerId =
      this.currentProviderId ||
      (await this.llmManager.getDefaultModelForPhase("execution"));

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
      mode: this.currentMode,
      images,
      sessionId: this.currentSessionId,
      providerId,
    };

    this.messages.push(userMessage);
    this.postMessage("addMessage", userMessage);

    // Log to session
    this.sessionManager.addMessage(this.currentSessionId!, "user", content);

    if (this.currentMode === "spec-driven") {
      await this.handleSpecDrivenMessage(content);
    } else {
      await this.handleVibeMessage(content);
    }
  }

  private async handleSpecDrivenMessage(content: string) {
    // Check if we have an active spec
    if (!this.currentSpecId) {
      // Suggest creating a new spec
      this.postMessage("suggestCreateSpec", { prompt: content });
      return;
    }

    const spec = this.specManager.getSpec(this.currentSpecId);
    if (!spec) {
      return;
    }

    // Handle based on current phase
    switch (spec.phase) {
      case "requirements":
        if (spec.phaseStatus === "pending") {
          await this.generateRequirements(spec.id, content);
        }
        break;

      case "design":
        if (spec.phaseStatus === "pending") {
          await this.generateDesign(spec.id);
        }
        break;

      case "tasks":
        if (spec.phaseStatus === "pending") {
          await this.generateTasks(spec.id);
        }
        break;

      case "execution": {
        // Provide guidance during execution
        const response: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `I'm executing the implementation plan for "${spec.name}". You can monitor progress in the Specs panel. Let me know if you'd like to make any adjustments!`,
          timestamp: Date.now(),
          sessionId: this.currentSessionId,
        };
        this.messages.push(response);
        this.postMessage("addMessage", response);
        break;
      }
    }
  }

  private async handleVibeMessage(content: string) {
    this.postMessage("setTyping", true);

    try {
      const modelId =
        this.currentProviderId ||
        (await this.llmManager.getDefaultModelForPhase("execution"));

      // Create streaming message
      this.streamingMessageId = `msg-${Date.now()}`;
      const streamingMessage: ChatMessage = {
        id: this.streamingMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
        providerId: modelId,
      };

      this.messages.push(streamingMessage);
      this.postMessage("addMessage", streamingMessage);

      // Stream the response
      let fullResponse = "";
      await this.llmManager.streamGenerate(
        modelId,
        [{ role: "user", content }],
        (chunk) => {
          fullResponse += chunk;
          this.postMessage("updateStreamingMessage", {
            id: this.streamingMessageId,
            content: fullResponse,
          });
        },
      );

      // Update final message
      streamingMessage.content = fullResponse;
      this.postMessage("finalizeMessage", {
        id: this.streamingMessageId,
        content: fullResponse,
      });

      // Log to session
      if (this.currentSessionId) {
        this.sessionManager.addMessage(
          this.currentSessionId,
          "assistant",
          fullResponse,
        );
      }
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }

    this.streamingMessageId = undefined;
    this.postMessage("setTyping", false);
  }

  private async generateRequirements(specId: string, prompt: string) {
    this.postMessage("setTyping", true);
    try {
      await this.specManager.generateRequirements(specId, prompt);
      this.postMessage("requirementsGenerated", { specId });
      await this.sendSpecsList();

      const response: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          "✅ Requirements generated! Please review the requirements.md file and click **Approve** to proceed to Design phase, or provide feedback to regenerate.",
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
      };
      this.messages.push(response);
      this.postMessage("addMessage", response);
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
    this.postMessage("setTyping", false);
  }

  private async generateDesign(specId: string) {
    this.postMessage("setTyping", true);
    try {
      await this.specManager.generateDesign(specId);
      this.postMessage("designGenerated", { specId });
      await this.sendSpecsList();

      const response: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          "✅ Design generated! Please review the design.md file and click **Approve** to proceed to Implementation Planning.",
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
      };
      this.messages.push(response);
      this.postMessage("addMessage", response);
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
    this.postMessage("setTyping", false);
  }

  private async generateTasks(specId: string) {
    this.postMessage("setTyping", true);
    try {
      await this.specManager.generateTasks(specId);
      this.postMessage("tasksGenerated", { specId });
      await this.sendSpecsList();

      const response: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content:
          "✅ Implementation plan generated! Review the tasks.md file and click **Execute** to start implementation.",
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
      };
      this.messages.push(response);
      this.postMessage("addMessage", response);
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
    this.postMessage("setTyping", false);
  }

  private async handleCreateSpec(prompt: string) {
    const name = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);

    try {
      const spec = await this.specManager.createSpec(name, prompt);
      this.currentSpecId = spec.id;
      this.postMessage("specCreated", { specId: spec.id, name: spec.name });
      await this.sendSpecsList();

      // Start generating requirements
      await this.generateRequirements(spec.id, prompt);
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
  }

  private async handleApprovePhase(specId: string, phase: string) {
    try {
      await this.specManager.approvePhase(specId, phase as any);
      this.postMessage("phaseApproved", { specId, phase });
      await this.sendSpecsList();
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
  }

  private async handleRegeneratePhase(specId: string, phase: string) {
    const feedback = await vscode.window.showInputBox({
      prompt: "What would you like to change?",
    });

    if (feedback) {
      try {
        this.postMessage("setTyping", true);
        await this.specManager.regeneratePhase(specId, phase as any, feedback);
        this.postMessage("phaseRegenerated", { specId, phase });
        await this.sendSpecsList();
      } catch (error: any) {
        this.postMessage("error", { message: error.message });
      }
      this.postMessage("setTyping", false);
    }
  }

  private async handleExecuteTask(specId: string, taskId: string) {
    try {
      await this.agentEngine.executeTask(specId, taskId);
      this.postMessage("taskExecuted", { specId, taskId });
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    }
  }

  private async handleToggleTaskOptional(specId: string, taskId: string) {
    await this.specManager.toggleTaskOptional(specId, taskId);
    await this.sendSpecsList();
  }

  private async handleNewSession(name: string, type: string) {
    const session = this.sessionManager.startSession(
      this.currentSpecId || "",
      type as any,
      name,
    );
    this.currentSessionId = session.id;
    this.messages = [];
    this.postMessage("sessionCreated", { sessionId: session.id, name, type });
    await this.sendSessionsList();
  }

  private async handleEndSession(sessionId: string, summary?: string) {
    this.sessionManager.endSession(sessionId, summary);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
    await this.sendSessionsList();
  }

  private async handleExportChat() {
    const content = this.messages
      .map(
        (m) =>
          `**${m.role.toUpperCase()}** (${new Date(m.timestamp).toLocaleString()})\n${m.content}\n`,
      )
      .join("\n---\n\n");

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
  }

  private async sendSpecsList() {
    const specs = this.specManager.getSpecs();
    this.postMessage("setSpecs", { specs });
  }

  private async sendSessionsList() {
    const sessions = this.sessionManager
      .getAllSessions()
      .filter((s) => s.status === "active");
    this.postMessage("setSessions", { sessions });
  }

  private async sendModels() {
    const models = this.llmManager.getModels();
    const activeProvider = this.llmManager.getActiveProvider();
    this.postMessage("setModels", {
      models,
      activeProviderId: activeProvider?.id,
      currentProviderId: this.currentProviderId,
    });
  }

  private async sendProviderStatus() {
    const models = this.llmManager.getModels();
    const providerStatuses = models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      status: this.llmManager.getProviderStatus(model.id),
      metrics: this.llmManager.getProviderMetrics(model.id),
    }));

    this.postMessage("setProviderStatuses", { providers: providerStatuses });
  }

  private async handleSelectProvider(providerId: string) {
    try {
      const provider = this.llmManager.getModel(providerId);
      if (!provider) {
        this.postMessage("error", { message: "Provider not found" });
        return;
      }

      // Test the provider before selecting it
      this.postMessage("setTyping", true);
      const testResult = await this.llmManager.testProviderConnection(
        providerId,
        10000,
      );

      if (testResult.success) {
        this.currentProviderId = providerId;
        this.postMessage("providerSelected", {
          providerId,
          providerName: provider.name,
        });
        this.sendProviderStatus();
      } else {
        this.postMessage("error", {
          message: `Failed to connect to ${provider.name}: ${testResult.error}`,
        });
      }
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    } finally {
      this.postMessage("setTyping", false);
    }
  }

  private async handleTestProvider(providerId: string) {
    try {
      const provider = this.llmManager.getModel(providerId);
      if (!provider) {
        this.postMessage("error", { message: "Provider not found" });
        return;
      }

      this.postMessage("providerTesting", { providerId });
      const testResult = await this.llmManager.testProviderConnection(
        providerId,
        30000,
      );

      if (testResult.success) {
        this.postMessage("providerTestSuccess", {
          providerId,
          response: testResult.response?.substring(0, 100) + "...",
        });
      } else {
        this.postMessage("providerTestFailed", {
          providerId,
          error: testResult.error,
        });
      }

      this.sendProviderStatus();
    } catch (error: any) {
      this.postMessage("providerTestFailed", {
        providerId,
        error: error.message,
      });
    }
  }

  private async handleRefreshProviders() {
    try {
      this.postMessage("setTyping", true);
      await this.llmManager.refreshProviderAvailability();
      this.sendProviderStatus();
      this.postMessage("providersRefreshed");
    } catch (error: any) {
      this.postMessage("error", { message: error.message });
    } finally {
      this.postMessage("setTyping", false);
    }
  }

  private postMessage(type: string, data?: any) {
    if (this.view) {
      this.view.webview.postMessage({ type, data });
    }
  }
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spec-Code Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .title {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .mode-toggle {
            display: flex;
            gap: 4px;
            background: var(--vscode-input-background);
            padding: 2px;
            border-radius: 4px;
        }

        .mode-btn {
            padding: 4px 12px;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
            transition: all 0.2s;
        }

        .mode-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .mode-btn:hover:not(.active) {
            background: var(--vscode-list-hoverBackground);
        }

        .toolbar {
            padding: 8px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
            flex-wrap: wrap;
        }

        .provider-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto;
        }

        .provider-dropdown {
            padding: 4px 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 12px;
            min-width: 120px;
        }

        .provider-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 4px;
        }

        .provider-status.online { background: var(--vscode-testing-iconPassed); }
        .provider-status.offline { background: var(--vscode-descriptionForeground); }
        .provider-status.error { background: var(--vscode-testing-iconFailed); }
        .provider-status.testing { 
            background: var(--vscode-progressBar-background);
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .toolbar-btn {
            padding: 4px 8px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .toolbar-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            scroll-behavior: smooth;
        }

        .message {
            margin-bottom: 16px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        .message-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
        }

        .message-avatar.user {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message-avatar.assistant {
            background: var(--vscode-symbolIcon-colorForeground);
            color: var(--vscode-editor-background);
        }

        .message-sender {
            font-weight: 600;
            font-size: 13px;
        }

        .message-time {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-left: auto;
        }

        .message-tokens {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
        }

        .message-content {
            padding-left: 32px;
            line-height: 1.6;
        }

        .message-content pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 8px 0;
            border: 1px solid var(--vscode-panel-border);
        }

        .message-content code {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }

        .message-content p {
            margin: 8px 0;
        }

        .message-content ul, .message-content ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        .message-content blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            background: var(--vscode-textBlockQuote-background);
            padding: 8px 12px;
            margin: 8px 0;
        }

        .input-container {
            padding: 12px 16px;
            border-top: 1px solid var(--vscode-panel-border);
            flex-shrink: 0;
        }

        .input-wrapper {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .message-input {
            flex: 1;
            min-height: 44px;
            max-height: 200px;
            padding: 10px 14px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 8px;
            resize: none;
            font-family: inherit;
            font-size: inherit;
            line-height: 1.5;
        }

        .message-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .message-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .send-btn {
            width: 44px;
            height: 44px;
            border: none;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }

        .send-btn:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 12px 16px;
            align-items: center;
            color: var(--vscode-descriptionForeground);
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--vscode-descriptionForeground);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .suggestion-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 16px;
            margin: 8px 0;
        }

        .suggestion-card h4 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .suggestion-card p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 12px;
        }

        .suggestion-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 6px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .specs-list, .sessions-list {
            margin: 8px 0;
        }

        .spec-item, .session-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .spec-item:hover, .session-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .spec-item.active, .session-item.active {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .phase-indicator {
            display: flex;
            gap: 4px;
            margin-top: 4px;
        }

        .phase-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-descriptionForeground);
        }

        .phase-dot.completed {
            background: var(--vscode-testing-iconPassed);
        }

        .phase-dot.current {
            background: var(--vscode-progressBar-background);
        }

        .welcome-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            padding: 32px;
        }

        .welcome-screen h2 {
            margin-bottom: 16px;
            color: var(--vscode-foreground);
        }

        .welcome-screen p {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 24px;
            max-width: 400px;
        }

        .quick-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .status-bar {
            padding: 4px 16px;
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
            padding: 12px;
            border-radius: 6px;
            margin: 8px 0;
        }

        .success-message {
            background: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 6px;
            margin: 8px 0;
        }

        .sidebar {
            width: 250px;
            border-right: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
        }

        .sidebar-section {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .sidebar-section h3 {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .main-content {
            display: flex;
            flex: 1;
        }

        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        @media (max-width: 600px) {
            .sidebar {
                display: none;
            }
            
            .toolbar {
                flex-wrap: wrap;
            }
            
            .mode-toggle {
                order: -1;
                width: 100%;
                margin-bottom: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            <span>👻</span>
            <span>Spec-Code</span>
        </div>
        <div class="mode-toggle">
            <button class="mode-btn active" data-mode="spec-driven">Spec-Driven</button>
            <button class="mode-btn" data-mode="vibe">Vibe</button>
        </div>
    </div>

    <div class="toolbar">
        <button class="toolbar-btn" onclick="clearChat()">
            <span>🗑️</span> Clear
        </button>
        <button class="toolbar-btn" onclick="exportChat()">
            <span>📤</span> Export
        </button>
        <button class="toolbar-btn" onclick="newSession()">
            <span>➕</span> New Session
        </button>
        <button class="toolbar-btn" onclick="viewSessions()">
            <span>📋</span> Sessions
        </button>
        <button class="toolbar-btn" onclick="openSettings()">
            <span>⚙️</span> Settings
        </button>
        
        <div class="provider-selector">
            <span style="font-size: 11px; color: var(--vscode-descriptionForeground);">Provider:</span>
            <select class="provider-dropdown" id="providerSelect" onchange="selectProvider()">
                <option value="">Use Active Provider</option>
            </select>
            <button class="toolbar-btn" onclick="testCurrentProvider()" title="Test Provider">
                <span>🔍</span>
            </button>
            <button class="toolbar-btn" onclick="refreshProviders()" title="Refresh Providers">
                <span>🔄</span>
            </button>
            <button class="toolbar-btn" onclick="openProviderSetup()" title="Provider Setup">
                <span>⚙️</span>
            </button>
        </div>
    </div>

    <div class="main-content">
        <div class="chat-area">
            <div class="chat-container" id="chatContainer">
                <div class="welcome-screen" id="welcomeScreen">
                    <h2>Welcome to Spec-Code</h2>
                    <p>Turn any prompt into production-ready, verifiable code using AI-powered spec-driven development.</p>
                    <div class="quick-actions">
                        <button class="btn btn-primary" onclick="createNewSpec()">New Spec</button>
                        <button class="btn btn-secondary" onclick="switchToVibe()">Vibe Mode</button>
                        <button class="btn btn-secondary" onclick="openSettings()">Add Model</button>
                    </div>
                </div>
            </div>

            <div class="typing-indicator" id="typingIndicator" style="display: none;">
                <span>Thinking</span>
                <span></span>
                <span></span>
                <span></span>
            </div>

            <div class="input-container">
                <div class="input-wrapper">
                    <textarea 
                        class="message-input" 
                        id="messageInput" 
                        placeholder="Describe what you want to build..."
                        rows="1"
                    ></textarea>
                    <button class="send-btn" id="sendBtn" onclick="sendMessage()">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.5 8a.5.5 0 0 1 .5-.5h10.793L8.146 3.854a.5.5 0 1 1 .708-.708l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708-.708L12.793 8.5H2a.5.5 0 0 1-.5-.5z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="status-bar">
        <span id="statusText">Ready</span>
        <span id="sessionInfo"></span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentMode = 'spec-driven';
        let currentSpecId = null;
        let currentSessionId = null;
        let streamingMessageId = null;
        let specs = [];
        let sessions = [];
        let models = [];
        let providerStatuses = [];
        let currentProviderId = null;

        // Mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.dataset.mode;
                vscode.postMessage({ type: 'setMode', mode: currentMode });
                updatePlaceholder();
            });
        });

        function updatePlaceholder() {
            const input = document.getElementById('messageInput');
            if (currentMode === 'spec-driven') {
                input.placeholder = 'Describe what you want to build...';
            } else {
                input.placeholder = 'Ask me anything...';
            }
        }

        // Auto-resize textarea
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        });

        // Send on Enter (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        function sendMessage() {
            const content = messageInput.value.trim();
            if (!content) return;

            vscode.postMessage({ type: 'sendMessage', content });
            messageInput.value = '';
            messageInput.style.height = 'auto';
            
            // Hide welcome screen
            document.getElementById('welcomeScreen').style.display = 'none';
            updateStatus('Sending...');
        }

        function clearChat() {
            vscode.postMessage({ type: 'clearChat' });
        }

        function exportChat() {
            vscode.postMessage({ type: 'exportChat' });
        }

        function newSession() {
            const name = prompt('Session name:') || 'Chat ' + new Date().toLocaleTimeString();
            const type = currentMode === 'spec-driven' ? 'execution' : 'chat';
            vscode.postMessage({ type: 'newSession', name, type });
        }

        function viewSessions() {
            // Show sessions in a modal or sidebar
            showSessionsList();
        }

        function createNewSpec() {
            const prompt = messageInput.value.trim() || 'New Feature';
            vscode.postMessage({ type: 'createSpec', prompt });
            document.getElementById('welcomeScreen').style.display = 'none';
        }

        function switchToVibe() {
            document.querySelector('[data-mode="vibe"]').click();
        }

        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }

        function openProviderSetup() {
            vscode.postMessage({ type: 'openProviderSetup' });
        }

        function selectProvider() {
            const select = document.getElementById('providerSelect');
            const providerId = select.value;
            currentProviderId = providerId || null;
            vscode.postMessage({ type: 'selectProvider', providerId });
        }

        function testCurrentProvider() {
            const select = document.getElementById('providerSelect');
            const providerId = select.value || (models.find(m => m.id === data.activeProviderId)?.id);
            if (providerId) {
                vscode.postMessage({ type: 'testProvider', providerId });
            }
        }

        function refreshProviders() {
            vscode.postMessage({ type: 'refreshProviders' });
        }

        function updateProviderDropdown(data) {
            const select = document.getElementById('providerSelect');
            select.innerHTML = '<option value="">Use Active Provider</option>';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                
                // Add status indicator
                const status = providerStatuses.find(p => p.id === model.id)?.status;
                const statusIcon = getStatusIcon(status?.state || 'offline');
                
                option.textContent = statusIcon + " " + model.name + " (" + model.provider + ")";
                
                if (model.id === data.activeProviderId && !currentProviderId) {
                    option.textContent += ' - Active';
                }
                
                if (model.id === currentProviderId) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
        }

        function getStatusIcon(state) {
            switch (state) {
                case 'online': return '🟢';
                case 'error': return '🔴';
                case 'testing': return '🟡';
                default: return '⚪';
            }
        }

        function showProviderStatus(message, type = 'info') {
            const container = document.getElementById('chatContainer');
            const statusEl = document.createElement('div');
            statusEl.className = type === 'error' ? 'error-message' : 'success-message';
            statusEl.textContent = message;
            container.appendChild(statusEl);
            container.scrollTop = container.scrollHeight;
        }

        function addMessage(message) {
            const container = document.getElementById('chatContainer');
            
            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            messageEl.id = message.id;
            
            const avatar = message.role === 'user' ? '👤' : '👻';
            const sender = message.role === 'user' ? 'You' : 'Spec-Code';
            const time = new Date(message.timestamp).toLocaleTimeString();
            const tokens = message.tokens ? message.tokens + ' tokens' : '';
            
            messageEl.innerHTML = 
                '<div class="message-header">' +
                    '<div class="message-avatar ' + message.role + '">' + avatar + '</div>' +
                    '<span class="message-sender">' + sender + '</span>' +
                    '<span class="message-time">' + time + '</span>' +
                    (tokens ? '<span class="message-tokens">' + tokens + '</span>' : '') +
                '</div>' +
                '<div class="message-content">' + formatContent(message.content) + '</div>';
            
            container.appendChild(messageEl);
            container.scrollTop = container.scrollHeight;
        }

        function formatContent(content) {
            // Enhanced markdown formatting
            return content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                .replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>')
                .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                .replace(/^- (.+)$/gm, '<li>$1</li>')
                .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
                .replace(/\\n\\n/g, '</p><p>')
                .replace(/^(?!<[h|u|p|l])/gm, '<p>')
                .replace(/(?<!>)$/gm, '</p>');
        }

        function updateStreamingMessage(data) {
            const messageEl = document.getElementById(data.id);
            if (messageEl) {
                messageEl.querySelector('.message-content').innerHTML = formatContent(data.content);
                document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
            }
        }

        function finalizeMessage(data) {
            const messageEl = document.getElementById(data.id);
            if (messageEl) {
                messageEl.querySelector('.message-content').innerHTML = formatContent(data.content);
            }
        }

        function setTyping(typing) {
            document.getElementById('typingIndicator').style.display = typing ? 'flex' : 'none';
            updateStatus(typing ? 'Thinking...' : 'Ready');
        }

        function updateStatus(text) {
            document.getElementById('statusText').textContent = text;
        }

        function updateSessionInfo(info) {
            document.getElementById('sessionInfo').textContent = info || '';
        }

        function showError(message) {
            const container = document.getElementById('chatContainer');
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.textContent = 'Error: ' + message;
            container.appendChild(errorEl);
            container.scrollTop = container.scrollHeight;
        }

        function showSuccess(message) {
            const container = document.getElementById('chatContainer');
            const successEl = document.createElement('div');
            successEl.className = 'success-message';
            successEl.textContent = message;
            container.appendChild(successEl);
            container.scrollTop = container.scrollHeight;
        }

        function suggestCreateSpec(data) {
            const container = document.getElementById('chatContainer');
            
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = \`
                <h4>🚀 Start Spec-Driven Development</h4>
                <p>"\${data.prompt.substring(0, 100)}..."</p>
                <div class="suggestion-actions">
                    <button class="btn btn-primary" onclick="createNewSpecFromPrompt('\${data.prompt.replace(/'/g, "\\\\'")}')">Create Spec</button>
                    <button class="btn btn-secondary" onclick="switchToVibe()">Continue in Vibe Mode</button>
                </div>
            \`;
            
            container.appendChild(card);
            container.scrollTop = container.scrollHeight;
        }

        function createNewSpecFromPrompt(prompt) {
            vscode.postMessage({ type: 'createSpec', prompt });
        }

        function showSessionsList() {
            // Implementation for showing sessions list
            console.log('Sessions:', sessions);
        }

        // Message handler
        window.addEventListener('message', event => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'addMessage':
                    addMessage(data);
                    break;
                case 'updateStreamingMessage':
                    updateStreamingMessage(data);
                    break;
                case 'finalizeMessage':
                    finalizeMessage(data);
                    break;
                case 'setTyping':
                    setTyping(data);
                    break;
                case 'suggestCreateSpec':
                    suggestCreateSpec(data);
                    break;
                case 'setSpecs':
                    specs = data.specs;
                    break;
                case 'setSessions':
                    sessions = data.sessions;
                    updateSessionInfo(currentSessionId ? 'Session: ' + (sessions.find(s => s.id === currentSessionId)?.name || 'Unknown') : '');
                    break;
                case 'setModels':
                    models = data.models;
                    updateProviderDropdown(data);
                    break;
                case 'setProviderStatuses':
                    providerStatuses = data.providers;
                    updateProviderDropdown({ activeProviderId: models.find(m => m.id === currentProviderId)?.id });
                    break;
                case 'providerSelected':
                    currentProviderId = data.providerId;
                    showProviderStatus("Switched to provider: " + data.providerName);
                    updateProviderDropdown({ activeProviderId: currentProviderId });
                    break;
                case 'providerTesting':
                    showProviderStatus("Testing provider connection...");
                    break;
                case 'providerTestSuccess':
                    showProviderStatus("Provider test successful: " + data.response);
                    break;
                case 'providerTestFailed':
                    showProviderStatus("Provider test failed: " + data.error, 'error');
                    break;
                case 'providersRefreshed':
                    showProviderStatus('Provider status refreshed');
                    break;
                case 'sessionCreated':
                    currentSessionId = data.sessionId;
                    updateSessionInfo('Session: ' + data.name);
                    showSuccess('Started new ' + data.type + ' session: ' + data.name);
                    break;
                case 'sessionLoaded':
                    currentSessionId = data.sessionId;
                    updateSessionInfo('Session: ' + data.sessionName);
                    // Clear and load messages
                    document.getElementById('chatContainer').innerHTML = '';
                    data.messages.forEach(addMessage);
                    break;
                case 'chatCleared':
                    document.getElementById('chatContainer').innerHTML = '';
                    document.getElementById('welcomeScreen').style.display = 'flex';
                    break;
                case 'specCreated':
                    currentSpecId = data.specId;
                    showSuccess('Created spec: ' + data.name);
                    break;
                case 'requirementsGenerated':
                case 'designGenerated':
                case 'tasksGenerated':
                    showSuccess('Phase completed! Check the Specs panel for details.');
                    break;
                case 'error':
                    showError(data.message);
                    break;
            }
        });

        // Load initial data
        vscode.postMessage({ type: 'loadSpecs' });
        vscode.postMessage({ type: 'loadSessions' });
        updatePlaceholder();
        updateStatus('Ready');
    </script>
</body>
</html>`;
  }
}
