import * as vscode from "vscode";
import { SpecsProvider } from "./providers/specsProvider";
import { HooksProvider } from "./providers/hooksProvider";
import { SteeringProvider } from "./providers/steeringProvider";
import { MCPProvider } from "./providers/mcpProvider";
import { SessionProvider } from "./providers/sessionProvider";
import { ChatWebviewProvider } from "./webview/chatWebview";
import { ProviderSetupWebviewProvider } from "./webview/providerSetupWebview";
import { ProviderSwitcherProvider } from "./providers/providerSwitcherProvider";
import { SpecManager } from "./specs/specManager";
import { HookEngine } from "./hooks/hookEngine";
import { SteeringManager } from "./steering/steeringManager";
import { MCPClient } from "./mcp/mcpClient";
import { LLMManager } from "./llm/llmManager";
import { MemoryManager } from "./memory/memoryManager";
import { SessionManager } from "./session/sessionManager";
import { AgentEngine } from "./agent/agentEngine";
import { SpecCodeFolderManager } from "./utils/specCodeFolder";
import { registerCommands } from "./commands";

let extensionContext: vscode.ExtensionContext;

async function initializeProviderDiscovery(
  llmManager: LLMManager,
): Promise<void> {
  try {
    // Discover local providers on startup
    const discovered = await llmManager.discoverLocalProviders();

    if (discovered.length > 0) {
      const message = `Found ${discovered.length} local provider(s). Would you like to configure them?`;
      const result = await vscode.window.showInformationMessage(
        message,
        "Configure Now",
        "Later",
      );

      if (result === "Configure Now") {
        vscode.commands.executeCommand("specCode.openProviderSetup");
      }
    }
  } catch (error) {
    console.error("Failed to discover local providers:", error);
  }
}

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  console.log("Spec-Code extension is now active!");

  // Initialize core managers
  const specCodeFolderManager = new SpecCodeFolderManager();
  const llmManager = new LLMManager(context);
  const mcpClient = new MCPClient(context);
  const steeringManager = new SteeringManager(specCodeFolderManager);
  const memoryManager = new MemoryManager(specCodeFolderManager);
  const sessionManager = new SessionManager(specCodeFolderManager);
  const specManager = new SpecManager(
    specCodeFolderManager,
    llmManager,
    steeringManager,
    memoryManager,
  );
  const hookEngine = new HookEngine(
    context,
    specCodeFolderManager,
    llmManager,
    steeringManager,
  );
  const agentEngine = new AgentEngine(
    llmManager,
    mcpClient,
    steeringManager,
    specCodeFolderManager,
    memoryManager,
    sessionManager,
  );

  // Initialize .specCode folder structure
  specCodeFolderManager.initializeWorkspace();

  // Register tree data providers
  const specsProvider = new SpecsProvider(specManager);
  const hooksProvider = new HooksProvider(hookEngine);
  const steeringProvider = new SteeringProvider(steeringManager);
  const mcpProvider = new MCPProvider(mcpClient);
  const sessionProvider = new SessionProvider(
    sessionManager,
    specCodeFolderManager,
  );
  const providerSwitcherProvider = new ProviderSwitcherProvider(llmManager);

  vscode.window.registerTreeDataProvider("specCode.specs", specsProvider);
  vscode.window.registerTreeDataProvider("specCode.hooks", hooksProvider);
  vscode.window.registerTreeDataProvider("specCode.steering", steeringProvider);
  vscode.window.registerTreeDataProvider("specCode.mcp", mcpProvider);
  vscode.window.registerTreeDataProvider("specCode.sessions", sessionProvider);
  vscode.window.registerTreeDataProvider(
    "specCode.providerSwitcher",
    providerSwitcherProvider,
  );

  // Register chat webview provider
  const chatWebviewProvider = new ChatWebviewProvider(
    context.extensionUri,
    specManager,
    agentEngine,
    llmManager,
    sessionManager,
    memoryManager,
  );

  // Register provider setup webview provider
  const providerSetupWebviewProvider = new ProviderSetupWebviewProvider(
    context.extensionUri,
    llmManager,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "specCode.chat",
      chatWebviewProvider,
    ),
    vscode.window.registerWebviewViewProvider(
      "specCode.providerSetup",
      providerSetupWebviewProvider,
    ),
  );

  // Register all commands
  registerCommands(context, {
    specsProvider,
    hooksProvider,
    steeringProvider,
    mcpProvider,
    sessionProvider,
    providerSwitcherProvider,
    specManager,
    hookEngine,
    steeringManager,
    mcpClient,
    llmManager,
    memoryManager,
    sessionManager,
    agentEngine,
    chatWebviewProvider,
    providerSetupWebviewProvider,
    specCodeFolderManager,
  });

  // Start hook engine
  hookEngine.start();

  // Integrate hooks with agent engine
  agentEngine.setHookEngine(hookEngine);

  // Initialize provider discovery on extension startup
  initializeProviderDiscovery(llmManager);

  // Refresh providers periodically
  setInterval(() => {
    specsProvider.refresh();
    hooksProvider.refresh();
    steeringProvider.refresh();
    mcpProvider.refresh();
    sessionProvider.refresh();
    providerSwitcherProvider.refresh();
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
