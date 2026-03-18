import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Spec, Task } from '../specs/specTypes';
import { LLMManager, Message } from '../llm/llmManager';
import { MCPClient } from '../mcp/mcpClient';
import { SteeringManager } from '../steering/steeringManager';
import { KiroFolderManager } from '../utils/kiroFolder';

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

    constructor(
        private llmManager: LLMManager,
        private mcpClient: MCPClient,
        private steeringManager: SteeringManager,
        private kiroFolder: KiroFolderManager
    ) {
        this.outputChannel = vscode.window.createOutputChannel('Spec-Code Agent');
    }

    async executeSpec(spec: Spec): Promise<void> {
        if (this.isExecuting) {
            vscode.window.showWarningMessage('Agent is already executing a spec');
            return;
        }

        this.isExecuting = true;
        this.currentSpecId = spec.id;

        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`=== Starting Execution: ${spec.name} ===\n`);

        try {
            for (const task of spec.tasks) {
                if (task.status === 'completed' || task.status === 'skipped') {
                    continue;
                }

                if (task.optional) {
                    const result = await vscode.window.showInformationMessage(
                        `Skip optional task: ${task.description}?`,
                        'Skip',
                        'Execute'
                    );
                    if (result === 'Skip') {
                        task.status = 'skipped';
                        continue;
                    }
                }

                await this.executeTask(spec.id, task.id);
            }

            vscode.window.showInformationMessage(`Spec "${spec.name}" execution completed!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Execution failed: ${error}`);
        } finally {
            this.isExecuting = false;
            this.currentSpecId = null;
        }
    }

    async executeTask(specId: string, taskId: string): Promise<void> {
        const spec = this.kiroFolder.getSpec(specId);
        if (!spec) throw new Error('Spec not found');

        const task = spec.tasks.find(t => t.id === taskId);
        if (!task) throw new Error('Task not found');

        // Check dependencies
        for (const depId of task.dependencies) {
            const dep = spec.tasks.find(t => t.id === depId);
            if (dep && dep.status !== 'completed') {
                throw new Error(`Dependency ${depId} not completed`);
            }
        }

        task.status = 'in_progress';
        task.startedAt = Date.now();
        this.outputChannel.appendLine(`\n[Task] ${task.description}`);

        const modelId = await this.llmManager.getDefaultModelForPhase('execution');
        const steering = await this.steeringManager.getCombinedSteering();
        const requirements = spec.files.requirements ? fs.readFileSync(spec.files.requirements, 'utf-8') : '';
        const design = spec.files.design ? fs.readFileSync(spec.files.design, 'utf-8') : '';

        // Get available tools
        const tools = this.getAvailableTools();
        const mcpTools = await this.mcpClient.getTools();
        const allTools = [...tools, ...mcpTools];

        const systemPrompt = `You are an expert software developer executing a specific task. Follow the steering guidelines and use available tools to complete the task.

${steering}

## Project Context

### Requirements
${requirements}

### Design
${design}

## Current Task
${task.description}

Expected Outcome: ${task.expectedOutcome}

Execute this task step by step. Use the available tools to:
1. Read and understand existing code
2. Create or modify files
3. Run commands (with user approval)
4. Search the codebase

Always explain your actions before taking them.`;

        const messages: Message[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Execute the task: ${task.description}` }
        ];

        let maxIterations = 20;
        let iteration = 0;

        while (iteration < maxIterations) {
            iteration++;

            const response = await this.llmManager.generateWithTools(modelId, messages, allTools);

            // Add assistant response to messages
            messages.push({
                role: 'assistant',
                content: response.content
            });

            this.outputChannel.appendLine(`\n[Agent] ${response.content}`);

            // Handle tool calls
            if (response.toolCalls && response.toolCalls.length > 0) {
                const toolResults: ToolResult[] = [];

                for (const toolCall of response.toolCalls) {
                    const result = await this.executeTool(toolCall);
                    toolResults.push({
                        toolCallId: toolCall.id,
                        result: result
                    });
                }

                // Add tool results to messages
                messages.push({
                    role: 'user',
                    content: toolResults.map(tr => `[Tool Result: ${tr.toolCallId}]\n${tr.result}`).join('\n\n')
                });
            } else {
                // No tool calls, task might be complete
                break;
            }
        }

        task.status = 'completed';
        task.completedAt = Date.now();
        this.outputChannel.appendLine(`\n[Task Complete] ${task.description}`);
    }

    private getAvailableTools(): any[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'read_file',
                    description: 'Read the contents of a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Relative path to the file'
                            }
                        },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'write_file',
                    description: 'Write content to a file (creates if not exists)',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Relative path to the file'
                            },
                            content: {
                                type: 'string',
                                description: 'Content to write'
                            }
                        },
                        required: ['path', 'content']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'edit_file',
                    description: 'Edit a specific part of a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Relative path to the file'
                            },
                            oldString: {
                                type: 'string',
                                description: 'String to replace'
                            },
                            newString: {
                                type: 'string',
                                description: 'Replacement string'
                            }
                        },
                        required: ['path', 'oldString', 'newString']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'run_command',
                    description: 'Run a terminal command (requires user approval)',
                    parameters: {
                        type: 'object',
                        properties: {
                            command: {
                                type: 'string',
                                description: 'Command to run'
                            },
                            cwd: {
                                type: 'string',
                                description: 'Working directory (optional)'
                            }
                        },
                        required: ['command']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'search_files',
                    description: 'Search for files matching a pattern',
                    parameters: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: 'Glob pattern to search'
                            },
                            contentPattern: {
                                type: 'string',
                                description: 'Optional text to search within files'
                            }
                        },
                        required: ['pattern']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'list_directory',
                    description: 'List contents of a directory',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Relative path to directory'
                            }
                        },
                        required: ['path']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_diagnostics',
                    description: 'Get TypeScript/eslint diagnostics for a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: {
                                type: 'string',
                                description: 'Relative path to file'
                            }
                        },
                        required: ['path']
                    }
                }
            }
        ];
    }

    private async executeTool(toolCall: any): Promise<string> {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        try {
            switch (functionName) {
                case 'read_file':
                    return await this.toolReadFile(args.path);
                case 'write_file':
                    return await this.toolWriteFile(args.path, args.content);
                case 'edit_file':
                    return await this.toolEditFile(args.path, args.oldString, args.newString);
                case 'run_command':
                    return await this.toolRunCommand(args.command, args.cwd);
                case 'search_files':
                    return await this.toolSearchFiles(args.pattern, args.contentPattern);
                case 'list_directory':
                    return await this.toolListDirectory(args.path);
                case 'get_diagnostics':
                    return await this.toolGetDiagnostics(args.path);
                default:
                    // Try MCP tools
                    return await this.mcpClient.executeTool(functionName, args);
            }
        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }

    private async toolReadFile(filePath: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const fullPath = path.join(workspaceRoot, filePath);
        
        // Security check
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Access denied: path outside workspace');
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        return fs.readFileSync(fullPath, 'utf-8');
    }

    private async toolWriteFile(filePath: string, content: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const fullPath = path.join(workspaceRoot, filePath);
        
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Access denied: path outside workspace');
        }

        // Create directory if needed
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content);
        
        // Open the file in editor
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc);

        return `File written: ${filePath}`;
    }

    private async toolEditFile(filePath: string, oldString: string, newString: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const fullPath = path.join(workspaceRoot, filePath);
        
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Access denied: path outside workspace');
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        let content = fs.readFileSync(fullPath, 'utf-8');
        
        if (!content.includes(oldString)) {
            throw new Error('Old string not found in file');
        }

        content = content.replace(oldString, newString);
        fs.writeFileSync(fullPath, content);

        return `File edited: ${filePath}`;
    }

    private async toolRunCommand(command: string, cwd?: string): Promise<string> {
        // Check if command matches trusted patterns
        const config = vscode.workspace.getConfiguration('specCode');
        const autoApprove = config.get<boolean>('autoApproveTrustedCommands', false);
        const trustedPatterns = config.get<string[]>('trustedCommandPatterns', []);

        const isTrusted = trustedPatterns.some(pattern => {
            try {
                const regex = new RegExp(pattern);
                return regex.test(command);
            } catch {
                return false;
            }
        });

        if (!autoApprove || !isTrusted) {
            // Request approval
            const commandId = uuidv4();
            
            const approved = await new Promise<boolean>((resolve) => {
                this.pendingCommands.set(commandId, {
                    id: commandId,
                    command,
                    cwd: cwd || '',
                    resolve
                });

                vscode.window.showWarningMessage(
                    `Approve command: ${command}`,
                    { modal: true },
                    'Approve',
                    'Cancel',
                    'Trust Pattern'
                ).then(result => {
                    if (result === 'Approve') {
                        resolve(true);
                    } else if (result === 'Trust Pattern') {
                        vscode.commands.executeCommand('specCode.trustPattern', command);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            });

            this.pendingCommands.delete(commandId);

            if (!approved) {
                return 'Command cancelled by user';
            }
        }

        // Execute command
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        const workingDir = cwd ? path.join(workspaceRoot || '', cwd) : workspaceRoot;

        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            
            exec(command, { cwd: workingDir }, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    resolve(`Command failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`);
                } else {
                    resolve(`Command executed successfully:\n${stdout}${stderr ? '\nStderr: ' + stderr : ''}`);
                }
            });
        });
    }

    private async toolSearchFiles(pattern: string, contentPattern?: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const { glob } = require('glob');
        const files = await glob(pattern, { cwd: workspaceRoot });

        if (contentPattern) {
            const matchingFiles: string[] = [];
            for (const file of files) {
                const fullPath = path.join(workspaceRoot, file);
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        if (content.includes(contentPattern)) {
                            matchingFiles.push(file);
                        }
                    } catch {
                        // Skip binary files
                    }
                }
            }
            return `Found ${matchingFiles.length} files:\n${matchingFiles.join('\n')}`;
        }

        return `Found ${files.length} files:\n${files.join('\n')}`;
    }

    private async toolListDirectory(dirPath: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const fullPath = path.join(workspaceRoot, dirPath);
        
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Access denied: path outside workspace');
        }

        if (!fs.existsSync(fullPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }

        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const lines = entries.map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`);
        
        return `Contents of ${dirPath}:\n${lines.join('\n')}`;
    }

    private async toolGetDiagnostics(filePath: string): Promise<string> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace open');

        const fullPath = path.join(workspaceRoot, filePath);
        const uri = vscode.Uri.file(fullPath);

        // Wait a moment for diagnostics to update
        await new Promise(resolve => setTimeout(resolve, 500));

        const diagnostics = vscode.languages.getDiagnostics(uri);
        
        if (diagnostics.length === 0) {
            return 'No diagnostics found';
        }

        const lines = diagnostics.map(d => {
            const severity = ['Error', 'Warning', 'Info', 'Hint'][d.severity] || 'Unknown';
            return `[${severity}] Line ${d.range.start.line + 1}: ${d.message}`;
        });

        return `Diagnostics for ${filePath}:\n${lines.join('\n')}`;
    }

    approveCommand(commandId: string): void {
        const pending = this.pendingCommands.get(commandId);
        if (pending) {
            pending.resolve(true);
        }
    }

    cancelCommand(commandId: string): void {
        const pending = this.pendingCommands.get(commandId);
        if (pending) {
            pending.resolve(false);
        }
    }

    isExecutingSpec(): boolean {
        return this.isExecuting;
    }

    getCurrentSpecId(): string | null {
        return this.currentSpecId;
    }
}
