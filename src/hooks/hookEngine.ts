import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { KiroFolderManager } from '../utils/kiroFolder';
import { LLMManager } from '../llm/llmManager';
import { SteeringManager } from '../steering/steeringManager';

export interface Hook {
    id: string;
    name: string;
    eventType: 'onDidSaveTextDocument' | 'onDidCreateFiles' | 'onDidDeleteFiles' | 'onGitCommit' | 'onTerminalCommand';
    filePattern: string;
    prompt: string;
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

    constructor(
        private context: vscode.ExtensionContext,
        private kiroFolder: KiroFolderManager,
        private llmManager: LLMManager,
        private steeringManager: SteeringManager
    ) {
        this.outputChannel = vscode.window.createOutputChannel('Spec-Code Hooks');
        this.loadHooks();
    }

    private async loadHooks() {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) return;

        const hooksFolder = path.join(workspaceRoot, '.kiro', 'hooks');
        
        if (!fs.existsSync(hooksFolder)) {
            fs.mkdirSync(hooksFolder, { recursive: true });
            return;
        }

        const entries = fs.readdirSync(hooksFolder, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.json')) {
                const hookPath = path.join(hooksFolder, entry.name);
                try {
                    const data = JSON.parse(fs.readFileSync(hookPath, 'utf-8'));
                    const hook: Hook = {
                        ...data,
                        path: hookPath,
                        runCount: data.runCount || 0
                    };
                    this.hooks.set(hook.id, hook);
                } catch (error) {
                    console.error(`Failed to load hook ${entry.name}:`, error);
                }
            }
        }
    }

    private async saveHook(hook: Hook): Promise<void> {
        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) return;

        const hooksFolder = path.join(workspaceRoot, '.kiro', 'hooks');
        const hookPath = path.join(hooksFolder, `${hook.id}.json`);
        
        const { path: _, ...data } = hook;
        fs.writeFileSync(hookPath, JSON.stringify(data, null, 2));
        
        hook.path = hookPath;
    }

    async createHook(config: Partial<Hook>): Promise<Hook> {
        const hook: Hook = {
            id: uuidv4(),
            name: config.name || 'Unnamed Hook',
            eventType: config.eventType || 'onDidSaveTextDocument',
            filePattern: config.filePattern || '*',
            prompt: config.prompt || '',
            enabled: config.enabled ?? true,
            runCount: 0
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
        if (this.isRunning) return;

        const config = vscode.workspace.getConfiguration('specCode');
        if (!config.get<boolean>('enableHooks', true)) {
            return;
        }

        this.isRunning = true;

        // Register file save listener
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.handleFileEvent('onDidSaveTextDocument', document.uri.fsPath, document.getText());
            })
        );

        // Register file create listener
        this.disposables.push(
            vscode.workspace.onDidCreateFiles((event) => {
                for (const uri of event.files) {
                    this.handleFileEvent('onDidCreateFiles', uri.fsPath);
                }
            })
        );

        // Register file delete listener
        this.disposables.push(
            vscode.workspace.onDidDeleteFiles((event) => {
                for (const uri of event.files) {
                    this.handleFileEvent('onDidDeleteFiles', uri.fsPath);
                }
            })
        );

        // Register git commit listener (if Git extension is available)
        this.registerGitListener();
    }

    stop(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.isRunning = false;
    }

    private registerGitListener(): void {
        // Try to get the Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (gitExtension) {
            const git = gitExtension.exports;
            // Note: This is a simplified approach
            // Full implementation would listen to git state changes
        }
    }

    private async handleFileEvent(
        eventType: Hook['eventType'],
        filePath: string,
        content?: string
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('specCode');
        if (!config.get<boolean>('enableHooks', true)) return;

        const workspaceRoot = this.kiroFolder.getWorkspaceRoot();
        if (!workspaceRoot) return;

        // Get relative path
        const relativePath = path.relative(workspaceRoot, filePath);

        // Find matching hooks
        for (const hook of this.hooks.values()) {
            if (!hook.enabled) continue;
            if (hook.eventType !== eventType) continue;
            
            // Check file pattern
            if (!this.matchPattern(relativePath, hook.filePattern)) continue;

            // Execute hook
            await this.executeHook(hook, relativePath, content);
        }
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        // Simple glob-like matching
        if (pattern === '*') return true;
        if (pattern === filePath) return true;
        
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '<<DOUBLESTAR>>')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/<<DOUBLESTAR>>/g, '.*');
        
        try {
            const regex = new RegExp(regexPattern);
            return regex.test(filePath);
        } catch {
            return false;
        }
    }

    private async executeHook(hook: Hook, filePath: string, content?: string): Promise<void> {
        this.outputChannel.appendLine(`[Hook: ${hook.name}] Triggered by ${filePath}`);

        try {
            const modelId = await this.llmManager.getDefaultModelForPhase('hooks');
            const steering = await this.steeringManager.getCombinedSteering();

            const systemPrompt = `You are an expert developer assistant running as an automated hook.

${steering}

Execute the following prompt in the context of the file change.`;

            const userPrompt = `${hook.prompt}

## Context

File: ${filePath}
${content ? `\nContent:\n\`\`\`\n${content.substring(0, 4000)}\n\`\`\`` : ''}`;

            const response = await this.llmManager.generate(modelId, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]);

            this.outputChannel.appendLine(`[Hook: ${hook.name}] Response:\n${response.content}\n`);

            // Update hook stats
            hook.lastRun = Date.now();
            hook.runCount++;
            await this.saveHook(hook);

            // Show notification for significant actions
            if (response.content.includes('Error') || response.content.includes('Warning')) {
                vscode.window.showWarningMessage(
                    `Hook "${hook.name}" detected issues. Check output for details.`,
                    'Show Output'
                ).then(result => {
                    if (result === 'Show Output') {
                        this.outputChannel.show();
                    }
                });
            }

        } catch (error: any) {
            this.outputChannel.appendLine(`[Hook: ${hook.name}] Error: ${error.message}\n`);
        }
    }

    getHooks(): Hook[] {
        return Array.from(this.hooks.values());
    }

    getHook(id: string): Hook | undefined {
        return this.hooks.get(id);
    }

    // Example hooks that users can create
    getExampleHooks(): { name: string; description: string; config: Partial<Hook> }[] {
        return [
            {
                name: 'Type Check on Save',
                description: 'Run TypeScript type checking when .ts files are saved',
                config: {
                    name: 'Type Check TypeScript',
                    eventType: 'onDidSaveTextDocument',
                    filePattern: '*.ts',
                    prompt: 'Check this TypeScript file for type errors. If there are issues, explain them clearly and suggest fixes. Focus on the most critical errors first.'
                }
            },
            {
                name: 'Lint on Save',
                description: 'Check code style when JavaScript/TypeScript files are saved',
                config: {
                    name: 'Lint JavaScript/TypeScript',
                    eventType: 'onDidSaveTextDocument',
                    filePattern: '*.{js,ts,jsx,tsx}',
                    prompt: 'Review this code for style issues, potential bugs, and best practice violations. Suggest specific improvements.'
                }
            },
            {
                name: 'Documentation Check',
                description: 'Ensure new files have proper documentation',
                config: {
                    name: 'Check Documentation',
                    eventType: 'onDidCreateFiles',
                    filePattern: '*.{ts,js,py}',
                    prompt: 'This is a new file. Check if it has proper documentation (JSDoc comments, module description, etc.). If documentation is missing or insufficient, provide a template.'
                }
            },
            {
                name: 'Test File Reminder',
                description: 'Remind to create tests when implementation files are created',
                config: {
                    name: 'Test Reminder',
                    eventType: 'onDidCreateFiles',
                    filePattern: 'src/**/*.{ts,js}',
                    prompt: 'A new implementation file was created. Remind the developer to create corresponding test files following the project\'s testing conventions. Suggest test file paths and a basic test structure.'
                }
            },
            {
                name: 'Import Organization',
                description: 'Suggest import organization improvements',
                config: {
                    name: 'Organize Imports',
                    eventType: 'onDidSaveTextDocument',
                    filePattern: '*.{ts,tsx}',
                    prompt: 'Review the imports in this file. Suggest improvements for:
1. Removing unused imports
2. Grouping imports (external, internal, relative)
3. Alphabetical ordering within groups
4. Using consistent import styles'
                }
            }
        ];
    }
}
