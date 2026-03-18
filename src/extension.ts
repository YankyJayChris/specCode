import * as vscode from "vscode";
import { SpecsProvider } from "./providers/specsProvider";
import { HooksProvider } from "./providers/hooksProvider";
import { SteeringProvider } from "./providers/steeringProvider";
import { MCPProvider } from "./providers/mcpProvider";
import { SessionProvider } from "./providers/sessionProvider";
import { ChatWebviewProvider } from "./webview/chatWebview";
import { SpecManager } from "./specs/specManager";
import { HookEngine } from "./hooks/hookEngine";
import { SteeringManager } from "./steering/steeringManager";
import { MCPClient } from "./mcp/mcpClient";
import { LLMManager } from "./llm/llmManager";
import { MemoryManager } from "./memory/memoryManager";
import { SessionManager } from "./session/sessionManager";
import { AgentEngine } from "./agent/agentEngine";
import { KiroFolderManager } from "./utils/kiroFolder";
import { registerCommands } from "./commands";

let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  console.log("Spec-Code extension is now active!");

  // Initialize core managers
  const kiroFolderManager = new KiroFolderManager();
  const llmManager = new LLMManager(context);
  const mcpClient = new MCPClient(context);
  const steeringManager = new SteeringManager(kiroFolderManager);
  const memoryManager = new MemoryManager(kiroFolderManager);
  const sessionManager = new SessionManager(kiroFolderManager);
  const specManager = new SpecManager(
    kiroFolderManager,
    llmManager,
    steeringManager,
    memoryManager,
  );
  const hookEngine = new HookEngine(
    context,
    kiroFolderManager,
    llmManager,
    steeringManager,
  );
  const agentEngine = new AgentEngine(
    llmManager,
    mcpClient,
    steeringManager,
    kiroFolderManager,
    memoryManager,
    sessionManager,
  );

  // Initialize .kiro folder structure
  kiroFolderManager.initializeWorkspace();

  // Register tree data providers
  const specsProvider = new SpecsProvider(specManager);
  const hooksProvider = new HooksProvider(hookEngine);
  const steeringProvider = new SteeringProvider(steeringManager);
  const mcpProvider = new MCPProvider(mcpClient);
  const sessionProvider = new SessionProvider(
    sessionManager,
    kiroFolderManager,
  );

  vscode.window.registerTreeDataProvider("specCode.specs", specsProvider);
  vscode.window.registerTreeDataProvider("specCode.hooks", hooksProvider);
  vscode.window.registerTreeDataProvider("specCode.steering", steeringProvider);
  vscode.window.registerTreeDataProvider("specCode.mcp", mcpProvider);
  vscode.window.registerTreeDataProvider("specCode.sessions", sessionProvider);

  // Register chat webview provider
  const chatWebviewProvider = new ChatWebviewProvider(
    context.extensionUri,
    specManager,
    agentEngine,
    llmManager,
    sessionManager,
    memoryManager,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "specCode.chat",
      chatWebviewProvider,
    ),
  );

  // Register all commands
  registerCommands(context, {
    specsProvider,
    hooksProvider,
    steeringProvider,
    mcpProvider,
    sessionProvider,
    specManager,
    hookEngine,
    steeringManager,
    mcpClient,
    llmManager,
    memoryManager,
    sessionManager,
    agentEngine,
    chatWebviewProvider,
    kiroFolderManager,
  });

  // Start hook engine
  hookEngine.start();

  // Integrate hooks with agent engine
  agentEngine.setHookEngine(hookEngine);

  // Refresh providers periodically
  setInterval(() => {
    specsProvider.refresh();
    hooksProvider.refresh();
    steeringProvider.refresh();
    mcpProvider.refresh();
    sessionProvider.refresh();
  }, 5000);

  // Show welcome message
  vscode.window
    .showInformationMessage(
      "Spec-Code is ready! Open the Spec-Code panel to start spec-driven development.",
      "Open Chat",
      "Add Model",
    )
    .then((selection) => {
      if (selection === "Open Chat") {
        vscode.commands.executeCommand("specCode.openChat");
      } else if (selection === "Add Model") {
        vscode.commands.executeCommand("specCode.addModel");
      }
    });
}

export function deactivate() {
  console.log("Spec-Code extension is now deactivated");
}

export function getExtensionContext(): vscode.ExtensionContext {
  return extensionContext;
}
