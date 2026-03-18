import * as vscode from 'vscode';
import { HookEngine, Hook } from '../hooks/hookEngine';

export class HooksProvider implements vscode.TreeDataProvider<HookTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HookTreeItem | undefined | null | void> = new vscode.EventEmitter<HookTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HookTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private hookEngine: HookEngine) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HookTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HookTreeItem): Thenable<HookTreeItem[]> {
        if (!element) {
            const hooks = this.hookEngine.getHooks();
            return Promise.resolve(hooks.map(hook => new HookTreeItem(hook)));
        }

        return Promise.resolve([]);
    }
}

export class HookTreeItem extends vscode.TreeItem {
    constructor(public readonly hook: Hook) {
        super(hook.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.contextValue = 'hook';
        this.iconPath = this.getIconPath();
        
        if (hook.path) {
            this.command = {
                command: 'vscode.open',
                title: 'Edit Hook',
                arguments: [vscode.Uri.file(hook.path)]
            };
        }
    }

    private getTooltip(): string {
        const lines = [
            `Event: ${this.formatEventType(this.hook.eventType)}`,
            `Pattern: ${this.hook.filePattern}`,
            `Status: ${this.hook.enabled ? 'Enabled' : 'Disabled'}`,
            `Runs: ${this.hook.runCount}`
        ];
        
        if (this.hook.lastRun) {
            const lastRun = new Date(this.hook.lastRun);
            lines.push(`Last run: ${lastRun.toLocaleString()}`);
        }
        
        lines.push('', 'Prompt:', this.hook.prompt.substring(0, 200) + '...');
        
        return lines.join('\n');
    }

    private getDescription(): string {
        const parts: string[] = [];
        
        parts.push(this.formatEventType(this.hook.eventType));
        parts.push(`"${this.hook.filePattern}"`);
        
        if (this.hook.runCount > 0) {
            parts.push(`${this.hook.runCount} runs`);
        }
        
        return parts.join(' • ');
    }

    private getIconPath(): vscode.ThemeIcon {
        if (!this.hook.enabled) {
            return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
        }
        
        switch (this.hook.eventType) {
            case 'onDidSaveTextDocument':
                return new vscode.ThemeIcon('save');
            case 'onDidCreateFiles':
                return new vscode.ThemeIcon('new-file');
            case 'onDidDeleteFiles':
                return new vscode.ThemeIcon('trash');
            case 'onGitCommit':
                return new vscode.ThemeIcon('git-commit');
            case 'onTerminalCommand':
                return new vscode.ThemeIcon('terminal');
            default:
                return new vscode.ThemeIcon('zap');
        }
    }

    private formatEventType(eventType: string): string {
        const map: Record<string, string> = {
            'onDidSaveTextDocument': 'On Save',
            'onDidCreateFiles': 'On Create',
            'onDidDeleteFiles': 'On Delete',
            'onGitCommit': 'On Git Commit',
            'onTerminalCommand': 'On Terminal'
        };
        return map[eventType] || eventType;
    }
}
