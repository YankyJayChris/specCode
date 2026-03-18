import * as vscode from 'vscode';
import { SteeringManager, SteeringDocument } from '../steering/steeringManager';

export class SteeringProvider implements vscode.TreeDataProvider<SteeringTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SteeringTreeItem | undefined | null | void> = new vscode.EventEmitter<SteeringTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SteeringTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private steeringManager: SteeringManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SteeringTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SteeringTreeItem): Thenable<SteeringTreeItem[]> {
        if (!element) {
            const docs = this.steeringManager.getSteeringDocuments();
            return Promise.resolve(docs.map(doc => new SteeringTreeItem(doc)));
        }

        return Promise.resolve([]);
    }
}

export class SteeringTreeItem extends vscode.TreeItem {
    constructor(public readonly doc: SteeringDocument) {
        super(doc.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.contextValue = 'steering';
        this.iconPath = this.getIconPath();
        
        this.command = {
            command: 'vscode.open',
            title: 'Edit Steering',
            arguments: [vscode.Uri.file(doc.path)]
        };
    }

    private getTooltip(): string {
        const lines = [
            `Scope: ${this.doc.scope}`,
            `Priority: ${this.doc.priority}`,
            `Status: ${this.doc.enabled ? 'Enabled' : 'Disabled'}`,
            '',
            'Content Preview:',
            this.doc.content.substring(0, 300) + '...'
        ];
        return lines.join('\n');
    }

    private getDescription(): string {
        const parts: string[] = [];
        
        parts.push(this.doc.scope);
        
        if (!this.doc.enabled) {
            parts.push('disabled');
        }
        
        return parts.join(' • ');
    }

    private getIconPath(): vscode.ThemeIcon {
        if (!this.doc.enabled) {
            return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
        }
        
        if (this.doc.scope === 'global') {
            return new vscode.ThemeIcon('globe');
        }
        
        return new vscode.ThemeIcon('repo');
    }
}
