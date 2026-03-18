import * as vscode from 'vscode';
import { SpecsProvider } from './providers/specsProvider';
import { HooksProvider } from './providers/hooksProvider';
import { SteeringProvider } from './providers/steeringProvider';
import { MCPProvider } from './providers/mcpProvider';
import { ChatWebviewProvider } from './webview/chatWebview';
import { SpecManager } from './specs/specManager';
import { HookEngine } from './hooks/hookEngine';
import { SteeringManager } from './steering/steeringManager';
import { MCPClient } from './mcp/mcpClient';
import { LLMManager } from './llm/llmManager';
import { AgentEngine } from './agent/agentEngine';
import { KiroFolderManager } from './utils/kiroFolder';
import { registerCommands } from './commands';

let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    console.log('Spec-Code extension is now active!');

    // Initialize core managers
    const kiroFolderManager = new KiroFolderManager();
    const llmManager = new LLMManager(context);
    const mcpClient = new MCPClient(context);
    const steeringManager = new SteeringManager(kiroFolderManager);
    const specManager = new SpecManager(kiroFolderManager, llmManager, steeringManager);
    const hookEngine = new HookEngine(context, kiroFolderManager, llmManager, steeringManager);
    const agentEngine = new AgentEngine(llmManager, mcpClient, steeringManager, kiroFolderManager);

    // Initialize .kiro folder structure
    kiroFolderManager.initializeWorkspace();

    // Register tree data providers
    const specsProvider = new SpecsProvider(specManager);
    const hooksProvider = new HooksProvider(hookEngine);
    const steeringProvider = new SteeringProvider(steeringManager);
    const mcpProvider = new MCPProvider(mcpClient);

    vscode.window.registerTreeDataProvider('specCode.specs', specsProvider);
    vscode.window.registerTreeDataProvider('specCode.hooks', hooksProvider);
    vscode.window.registerTreeDataProvider('specCode.steering', steeringProvider);
    vscode.window.registerTreeDataProvider('specCode.mcp', mcpProvider);

    // Register chat webview provider
    const chatWebviewProvider = new ChatWebviewProvider(
        context.extensionUri,
        specManager,
        agentEngine,
        llmManager
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('specCode.chat', chatWebviewProvider)
    );

    // Register all commands
    registerCommands(context, {
        specsProvider,
        hooksProvider,
        steeringProvider,
        mcpProvider,
        specManager,
        hookEngine,
        steeringManager,
        mcpClient,
        llmManager,
        agentEngine,
        chatWebviewProvider,
        kiroFolderManager
    });

    // Start hook engine
    hookEngine.start();

    // Refresh providers periodically
    setInterval(() => {
        specsProvider.refresh();
        hooksProvider.refresh();
        steeringProvider.refresh();
        mcpProvider.refresh();
    }, 5000);

    // Show welcome message
    vscode.window.showInformationMessage(
        'Spec-Code is ready! Open the Spec-Code panel to start spec-driven development.',
        'Open Chat',
        'Add Model'
    ).then(selection => {
        if (selection === 'Open Chat') {
            vscode.commands.executeCommand('specCode.openChat');
        } else if (selection === 'Add Model') {
            vscode.commands.executeCommand('specCode.addModel');
        }
    });
}

export function deactivate() {
    console.log('Spec-Code extension is now deactivated');
}

export function getExtensionContext(): vscode.ExtensionContext {
    return extensionContext;
}
