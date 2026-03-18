import * as vscode from 'vscode';
import { MCPClient, MCPServer } from '../mcp/mcpClient';

type MCPItem = MCPTreeItem | MCPToolTreeItem;

export class MCPProvider implements vscode.TreeDataProvider<MCPItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MCPItem | undefined | null | void> = new vscode.EventEmitter<MCPItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MCPItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private mcpClient: MCPClient) {
        // Listen for server changes
        this.mcpClient.onServersChanged(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MCPItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MCPItem): Thenable<MCPItem[]> {
        if (!element) {
            const servers = this.mcpClient.getServers();
            return Promise.resolve(servers.map(server => new MCPTreeItem(server)));
        }

        // If server is connected, show its tools as children
        if (element.contextValue === 'mcpServer' && element.server.status === 'connected') {
            return Promise.resolve(
                element.server.tools.map(tool => new MCPToolTreeItem(element.server, tool))
            );
        }

        return Promise.resolve([]);
    }
}

export class MCPTreeItem extends vscode.TreeItem {
    constructor(public readonly server: MCPServer) {
        super(server.name, vscode.TreeItemCollapsibleState.Collapsed);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.contextValue = 'mcpServer';
        this.iconPath = this.getIconPath();
    }

    private getTooltip(): string {
        const lines = [
            `Name: ${this.server.name}`,
            `Transport: ${this.server.transport}`,
            `Status: ${this.server.status}`,
            `Tools: ${this.server.tools.length}`
        ];
        
        if (this.server.url) {
            lines.push(`URL: ${this.server.url}`);
        }
        
        if (this.server.command) {
            lines.push(`Command: ${this.server.command}`);
        }
        
        if (this.server.lastError) {
            lines.push('', `Error: ${this.server.lastError}`);
        }
        
        return lines.join('\n');
    }

    private getDescription(): string {
        const parts: string[] = [];
        
        parts.push(this.server.transport);
        
        if (this.server.tools.length > 0) {
            parts.push(`${this.server.tools.length} tools`);
        }
        
        return parts.join(' • ');
    }

    private getIconPath(): vscode.ThemeIcon {
        switch (this.server.status) {
            case 'connected':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('problemsErrorIcon.foreground'));
            case 'disconnected':
            default:
                return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('disabledForeground'));
        }
    }
}

export class MCPToolTreeItem extends vscode.TreeItem {
    constructor(
        public readonly server: MCPServer,
        public readonly tool: { name: string; description: string; parameters: any }
    ) {
        super(tool.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = `${tool.name}\n\n${tool.description}`;
        this.description = tool.description.substring(0, 50) + '...';
        this.contextValue = 'mcpTool';
        this.iconPath = new vscode.ThemeIcon('symbol-method');
    }
}
