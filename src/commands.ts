import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SpecsProvider } from './providers/specsProvider';
import { HooksProvider } from './providers/hooksProvider';
import { SteeringProvider } from './providers/steeringProvider';
import { MCPProvider } from './providers/mcpProvider';
import { SpecManager } from './specs/specManager';
import { HookEngine } from './hooks/hookEngine';
import { SteeringManager } from './steering/steeringManager';
import { MCPClient } from './mcp/mcpClient';
import { LLMManager } from './llm/llmManager';
import { AgentEngine } from './agent/agentEngine';
import { ChatWebviewProvider } from './webview/chatWebview';
import { KiroFolderManager } from './utils/kiroFolder';
import { Spec, SpecPhase } from './specs/specTypes';

interface CommandContext {
    specsProvider: SpecsProvider;
    hooksProvider: HooksProvider;
    steeringProvider: SteeringProvider;
    mcpProvider: MCPProvider;
    specManager: SpecManager;
    hookEngine: HookEngine;
    steeringManager: SteeringManager;
    mcpClient: MCPClient;
    llmManager: LLMManager;
    agentEngine: AgentEngine;
    chatWebviewProvider: ChatWebviewProvider;
    kiroFolderManager: KiroFolderManager;
}

export function registerCommands(context: vscode.ExtensionContext, cmdCtx: CommandContext) {
    
    // ==================== CHAT COMMANDS ====================
    
    const openChat = vscode.commands.registerCommand('specCode.openChat', () => {
        cmdCtx.chatWebviewProvider.show();
    });

    // ==================== SPEC COMMANDS ====================

    const newSpec = vscode.commands.registerCommand('specCode.newSpec', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter spec name (e.g., "user-authentication")',
            validateInput: (value) => {
                if (!value) return 'Name is required';
                if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
                return null;
            }
        });

        if (name) {
            const description = await vscode.window.showInputBox({
                prompt: 'Enter a brief description of this feature'
            });

            await cmdCtx.specManager.createSpec(name, description || '');
            cmdCtx.specsProvider.refresh();
            vscode.window.showInformationMessage(`Created spec: ${name}`);
        }
    });

    const editSpec = vscode.commands.registerCommand('specCode.editSpec', (spec: Spec) => {
        if (spec && spec.path) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(spec.path));
        }
    });

    const deleteSpec = vscode.commands.registerCommand('specCode.deleteSpec', async (spec: Spec) => {
        if (spec) {
            const result = await vscode.window.showWarningMessage(
                `Delete spec "${spec.name}"?`,
                { modal: true },
                'Delete'
            );
            if (result === 'Delete') {
                await cmdCtx.specManager.deleteSpec(spec.id);
                cmdCtx.specsProvider.refresh();
            }
        }
    });

    const generateRequirements = vscode.commands.registerCommand('specCode.generateRequirements', async (spec: Spec) => {
        if (!spec) return;
        
        const prompt = await vscode.window.showInputBox({
            prompt: 'Describe the feature you want to build',
            placeHolder: 'e.g., "Create a user authentication system with login, signup, and password reset"'
        });

        if (prompt) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generating Requirements...',
                cancellable: false
            }, async (progress) => {
                try {
                    await cmdCtx.specManager.generateRequirements(spec.id, prompt);
                    cmdCtx.specsProvider.refresh();
                    vscode.window.showInformationMessage('Requirements generated! Please review and approve.');
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to generate requirements: ${error}`);
                }
            });
        }
    });

    const generateDesign = vscode.commands.registerCommand('specCode.generateDesign', async (spec: Spec) => {
        if (!spec) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Design...',
            cancellable: false
        }, async () => {
            try {
                await cmdCtx.specManager.generateDesign(spec.id);
                cmdCtx.specsProvider.refresh();
                vscode.window.showInformationMessage('Design generated! Please review and approve.');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate design: ${error}`);
            }
        });
    });

    const generateTasks = vscode.commands.registerCommand('specCode.generateTasks', async (spec: Spec) => {
        if (!spec) return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating Implementation Plan...',
            cancellable: false
        }, async () => {
            try {
                await cmdCtx.specManager.generateTasks(spec.id);
                cmdCtx.specsProvider.refresh();
                vscode.window.showInformationMessage('Implementation plan generated! Ready to execute.');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate tasks: ${error}`);
            }
        });
    });

    const executeTasks = vscode.commands.registerCommand('specCode.executeTasks', async (spec: Spec) => {
        if (!spec) return;

        const result = await vscode.window.showInformationMessage(
            'Start executing tasks? This will modify your workspace files.',
            { modal: true },
            'Execute',
            'Review First'
        );

        if (result === 'Execute') {
            cmdCtx.agentEngine.executeSpec(spec);
        } else if (result === 'Review First') {
            const tasksPath = path.join(spec.path, 'tasks.md');
            if (fs.existsSync(tasksPath)) {
                const doc = await vscode.workspace.openTextDocument(tasksPath);
                await vscode.window.showTextDocument(doc);
            }
        }
    });

    const approvePhase = vscode.commands.registerCommand('specCode.approvePhase', async (spec: Spec, phase: SpecPhase) => {
        if (spec && phase) {
            await cmdCtx.specManager.approvePhase(spec.id, phase);
            cmdCtx.specsProvider.refresh();
        }
    });

    const regeneratePhase = vscode.commands.registerCommand('specCode.regeneratePhase', async (spec: Spec, phase: SpecPhase) => {
        if (!spec || !phase) return;

        const feedback = await vscode.window.showInputBox({
            prompt: 'What would you like to change?'
        });

        if (feedback) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Regenerating ${phase}...`,
                cancellable: false
            }, async () => {
                try {
                    await cmdCtx.specManager.regeneratePhase(spec.id, phase, feedback);
                    cmdCtx.specsProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to regenerate: ${error}`);
                }
            });
        }
    });

    // ==================== HOOK COMMANDS ====================

    const newHook = vscode.commands.registerCommand('specCode.newHook', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter hook name',
            validateInput: (value) => value ? null : 'Name is required'
        });

        if (name) {
            const eventType = await vscode.window.showQuickPick([
                { label: 'On File Save', value: 'onDidSaveTextDocument' },
                { label: 'On File Create', value: 'onDidCreateFiles' },
                { label: 'On File Delete', value: 'onDidDeleteFiles' },
                { label: 'On Git Commit', value: 'onGitCommit' },
                { label: 'On Terminal Command', value: 'onTerminalCommand' }
            ], { placeHolder: 'Select trigger event' });

            if (eventType) {
                const filePattern = await vscode.window.showInputBox({
                    prompt: 'File pattern to match (e.g., "*.ts", leave empty for all)',
                    placeHolder: '*.ts'
                });

                const prompt = await vscode.window.showInputBox({
                    prompt: 'Enter the agent prompt for this hook',
                    placeHolder: 'e.g., "Run type check and fix any errors"'
                });

                await cmdCtx.hookEngine.createHook({
                    name,
                    eventType: eventType.value,
                    filePattern: filePattern || '*',
                    prompt: prompt || '',
                    enabled: true
                });
                cmdCtx.hooksProvider.refresh();
            }
        }
    });

    const editHook = vscode.commands.registerCommand('specCode.editHook', (hook: any) => {
        if (hook && hook.path) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(hook.path));
        }
    });

    const toggleHook = vscode.commands.registerCommand('specCode.toggleHook', async (hook: any) => {
        if (hook) {
            await cmdCtx.hookEngine.toggleHook(hook.id);
            cmdCtx.hooksProvider.refresh();
        }
    });

    const deleteHook = vscode.commands.registerCommand('specCode.deleteHook', async (hook: any) => {
        if (hook) {
            const result = await vscode.window.showWarningMessage(
                `Delete hook "${hook.name}"?`,
                { modal: true },
                'Delete'
            );
            if (result === 'Delete') {
                await cmdCtx.hookEngine.deleteHook(hook.id);
                cmdCtx.hooksProvider.refresh();
            }
        }
    });

    // ==================== STEERING COMMANDS ====================

    const newSteering = vscode.commands.registerCommand('specCode.newSteering', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter steering document name',
            validateInput: (value) => value ? null : 'Name is required'
        });

        if (name) {
            const scope = await vscode.window.showQuickPick([
                { label: 'Workspace', value: 'workspace' },
                { label: 'Global', value: 'global' }
            ], { placeHolder: 'Select scope' });

            if (scope) {
                await cmdCtx.steeringManager.createSteeringDocument(name, scope.value as 'workspace' | 'global');
                cmdCtx.steeringProvider.refresh();
            }
        }
    });

    const editSteering = vscode.commands.registerCommand('specCode.editSteering', (steering: any) => {
        if (steering && steering.path) {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(steering.path));
        }
    });

    // ==================== MCP COMMANDS ====================

    const addMCPServer = vscode.commands.registerCommand('specCode.addMCPServer', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter server name',
            validateInput: (value) => value ? null : 'Name is required'
        });

        if (name) {
            const transport = await vscode.window.showQuickPick([
                { label: 'HTTP/SSE', value: 'http' },
                { label: 'STDIO', value: 'stdio' }
            ], { placeHolder: 'Select transport type' });

            if (transport) {
                let config: any = { name, transport: transport.value };

                if (transport.value === 'http') {
                    const url = await vscode.window.showInputBox({
                        prompt: 'Enter server URL',
                        placeHolder: 'http://localhost:3000/sse'
                    });
                    config.url = url;
                } else {
                    const command = await vscode.window.showInputBox({
                        prompt: 'Enter command to run',
                        placeHolder: 'npx @modelcontextprotocol/server-filesystem'
                    });
                    config.command = command;
                }

                await cmdCtx.mcpClient.addServer(config);
                cmdCtx.mcpProvider.refresh();
            }
        }
    });

    const removeMCPServer = vscode.commands.registerCommand('specCode.removeMCPServer', async (server: any) => {
        if (server) {
            const result = await vscode.window.showWarningMessage(
                `Remove MCP server "${server.name}"?`,
                { modal: true },
                'Remove'
            );
            if (result === 'Remove') {
                await cmdCtx.mcpClient.removeServer(server.id);
                cmdCtx.mcpProvider.refresh();
            }
        }
    });

    const refreshMCP = vscode.commands.registerCommand('specCode.refreshMCP', async () => {
        await cmdCtx.mcpClient.refreshServers();
        cmdCtx.mcpProvider.refresh();
        vscode.window.showInformationMessage('MCP servers refreshed');
    });

    // ==================== SETTINGS COMMANDS ====================

    const openSettings = vscode.commands.registerCommand('specCode.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'specCode');
    });

    const addModel = vscode.commands.registerCommand('specCode.addModel', async () => {
        const provider = await vscode.window.showQuickPick([
            { label: 'OpenAI', value: 'openai' },
            { label: 'Anthropic Claude', value: 'anthropic' },
            { label: 'Google Gemini', value: 'google' },
            { label: 'xAI Grok', value: 'xai' },
            { label: 'Ollama (Local)', value: 'ollama' },
            { label: 'LM Studio (Local)', value: 'lmstudio' },
            { label: 'Azure OpenAI', value: 'azure' },
            { label: 'Custom (OpenAI-compatible)', value: 'custom' }
        ], { placeHolder: 'Select AI provider' });

        if (!provider) return;

        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for this model configuration',
            value: `${provider.label} - Default`
        });

        if (!name) return;

        const modelName = await vscode.window.showInputBox({
            prompt: 'Enter model name',
            placeHolder: provider.value === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
                       provider.value === 'openai' ? 'gpt-4' :
                       provider.value === 'google' ? 'gemini-pro' :
                       provider.value === 'ollama' ? 'llama2' : 'model-name'
        });

        if (!modelName) return;

        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter API key (leave empty for local models)',
            password: true
        });

        let baseUrl: string | undefined;
        if (['ollama', 'lmstudio', 'custom'].includes(provider.value)) {
            baseUrl = await vscode.window.showInputBox({
                prompt: 'Enter base URL',
                placeHolder: provider.value === 'ollama' ? 'http://localhost:11434' :
                           provider.value === 'lmstudio' ? 'http://localhost:1234/v1' :
                           'http://localhost:3000/v1'
            });
        }

        const temperature = await vscode.window.showInputBox({
            prompt: 'Temperature (0.0 - 1.0)',
            value: '0.7'
        });

        const maxTokens = await vscode.window.showInputBox({
            prompt: 'Max tokens',
            value: '4096'
        });

        const supportsTools = await vscode.window.showQuickPick([
            { label: 'Yes', value: true },
            { label: 'No', value: false }
        ], { placeHolder: 'Does this model support tool/function calling?' });

        const model = {
            id: `model-${Date.now()}`,
            name,
            provider: provider.value,
            modelName,
            apiKey: apiKey || '',
            baseUrl: baseUrl || '',
            temperature: parseFloat(temperature || '0.7'),
            maxTokens: parseInt(maxTokens || '4096'),
            supportsTools: supportsTools?.value || false,
            supportsVision: false
        };

        await cmdCtx.llmManager.addModel(model);
        vscode.window.showInformationMessage(`Added model: ${name}`);
    });

    const testModel = vscode.commands.registerCommand('specCode.testModel', async (modelId: string) => {
        if (!modelId) {
            const models = cmdCtx.llmManager.getModels();
            const selected = await vscode.window.showQuickPick(
                models.map(m => ({ label: m.name, description: m.provider, value: m.id })),
                { placeHolder: 'Select model to test' }
            );
            if (selected) {
                modelId = selected.value;
            } else {
                return;
            }
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Testing model connection...',
            cancellable: false
        }, async () => {
            try {
                const result = await cmdCtx.llmManager.testModel(modelId);
                if (result.success) {
                    vscode.window.showInformationMessage(`Connection successful! Response: "${result.response?.substring(0, 100)}..."`);
                } else {
                    vscode.window.showErrorMessage(`Connection failed: ${result.error}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Test failed: ${error}`);
            }
        });
    });

    // ==================== TASK COMMANDS ====================

    const startTask = vscode.commands.registerCommand('specCode.startTask', async (specId: string, taskId: string) => {
        await cmdCtx.agentEngine.executeTask(specId, taskId);
    });

    const toggleTaskOptional = vscode.commands.registerCommand('specCode.toggleTaskOptional', async (specId: string, taskId: string) => {
        await cmdCtx.specManager.toggleTaskOptional(specId, taskId);
        cmdCtx.specsProvider.refresh();
    });

    // ==================== TERMINAL COMMANDS ====================

    const approveCommand = vscode.commands.registerCommand('specCode.approveCommand', (commandId: string) => {
        cmdCtx.agentEngine.approveCommand(commandId);
    });

    const cancelCommand = vscode.commands.registerCommand('specCode.cancelCommand', (commandId: string) => {
        cmdCtx.agentEngine.cancelCommand(commandId);
    });

    const trustPattern = vscode.commands.registerCommand('specCode.trustPattern', async (pattern: string) => {
        if (!pattern) {
            pattern = await vscode.window.showInputBox({
                prompt: 'Enter regex pattern to trust',
                placeHolder: '^npm (install|run)'
            }) || '';
        }
        
        if (pattern) {
            const config = vscode.workspace.getConfiguration('specCode');
            const patterns = config.get<string[]>('trustedCommandPatterns', []);
            patterns.push(pattern);
            await config.update('trustedCommandPatterns', patterns, true);
            vscode.window.showInformationMessage(`Added trusted pattern: ${pattern}`);
        }
    });

    // Register all disposables
    context.subscriptions.push(
        openChat,
        newSpec, editSpec, deleteSpec,
        generateRequirements, generateDesign, generateTasks, executeTasks,
        approvePhase, regeneratePhase,
        newHook, editHook, toggleHook, deleteHook,
        newSteering, editSteering,
        addMCPServer, removeMCPServer, refreshMCP,
        openSettings, addModel, testModel,
        startTask, toggleTaskOptional,
        approveCommand, cancelCommand, trustPattern
    );
}
