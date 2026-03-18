import * as vscode from 'vscode';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface MCPServer {
    id: string;
    name: string;
    transport: 'http' | 'stdio';
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    status: 'connected' | 'disconnected' | 'error';
    tools: MCPTool[];
    lastError?: string;
}

export interface MCPTool {
    name: string;
    description: string;
    parameters: any;
}

export class MCPClient {
    private servers: Map<string, MCPServer> = new Map();
    private _onServersChanged = new vscode.EventEmitter<void>();
    public readonly onServersChanged = this._onServersChanged.event;

    constructor(private context: vscode.ExtensionContext) {
        this.loadServers();
    }

    private async loadServers() {
        const config = vscode.workspace.getConfiguration('specCode');
        const serversConfig = config.get<Record<string, any>>('mcpServers', {});
        
        for (const [id, serverConfig] of Object.entries(serversConfig)) {
            const server: MCPServer = {
                id,
                name: serverConfig.name || id,
                transport: serverConfig.transport || 'http',
                url: serverConfig.url,
                command: serverConfig.command,
                args: serverConfig.args || [],
                env: serverConfig.env || {},
                status: 'disconnected',
                tools: []
            };
            
            this.servers.set(id, server);
            
            // Try to connect
            await this.connectServer(server);
        }
    }

    private async saveServers() {
        const config = vscode.workspace.getConfiguration('specCode');
        const serversConfig: Record<string, any> = {};
        
        for (const [id, server] of this.servers) {
            serversConfig[id] = {
                name: server.name,
                transport: server.transport,
                url: server.url,
                command: server.command,
                args: server.args,
                env: server.env
            };
        }
        
        await config.update('mcpServers', serversConfig, true);
    }

    async addServer(config: Partial<MCPServer>): Promise<MCPServer> {
        const server: MCPServer = {
            id: uuidv4(),
            name: config.name || 'Unnamed Server',
            transport: config.transport || 'http',
            url: config.url,
            command: config.command,
            args: config.args || [],
            env: config.env || {},
            status: 'disconnected',
            tools: []
        };

        this.servers.set(server.id, server);
        await this.saveServers();
        await this.connectServer(server);
        
        this._onServersChanged.fire();
        return server;
    }

    async removeServer(id: string): Promise<void> {
        this.servers.delete(id);
        await this.saveServers();
        this._onServersChanged.fire();
    }

    async connectServer(server: MCPServer): Promise<void> {
        try {
            if (server.transport === 'http' && server.url) {
                // Connect to HTTP/SSE server
                const response = await axios.get(`${server.url}/tools`, { timeout: 5000 });
                
                if (response.data && response.data.tools) {
                    server.tools = response.data.tools;
                }
                
                server.status = 'connected';
                server.lastError = undefined;
            } else if (server.transport === 'stdio' && server.command) {
                // For STDIO transport, we'd spawn a process
                // This is a simplified implementation
                server.status = 'connected';
                server.tools = []; // Would be discovered via stdio
            }
        } catch (error: any) {
            server.status = 'error';
            server.lastError = error.message;
        }
        
        this._onServersChanged.fire();
    }

    async refreshServers(): Promise<void> {
        for (const server of this.servers.values()) {
            await this.connectServer(server);
        }
    }

    async getTools(): Promise<any[]> {
        const tools: any[] = [];
        
        for (const server of this.servers.values()) {
            if (server.status === 'connected') {
                for (const tool of server.tools) {
                    tools.push({
                        type: 'function',
                        function: {
                            name: `${server.name}_${tool.name}`,
                            description: `[${server.name}] ${tool.description}`,
                            parameters: tool.parameters
                        }
                    });
                }
            }
        }
        
        return tools;
    }

    async executeTool(toolName: string, args: any): Promise<string> {
        // Find which server has this tool
        for (const server of this.servers.values()) {
            if (server.status !== 'connected') continue;
            
            const prefix = `${server.name}_`;
            if (toolName.startsWith(prefix)) {
                const actualToolName = toolName.slice(prefix.length);
                
                if (server.transport === 'http' && server.url) {
                    try {
                        const response = await axios.post(
                            `${server.url}/tools/${actualToolName}`,
                            args,
                            { timeout: 30000 }
                        );
                        
                        return JSON.stringify(response.data, null, 2);
                    } catch (error: any) {
                        return `Error calling ${toolName}: ${error.message}`;
                    }
                }
            }
        }
        
        return `Tool ${toolName} not found`;
    }

    getServers(): MCPServer[] {
        return Array.from(this.servers.values());
    }

    getServer(id: string): MCPServer | undefined {
        return this.servers.get(id);
    }

    // Install from MCP directory
    async installFromDirectory(serverName: string): Promise<void> {
        // This would integrate with a public MCP server directory
        // For now, we'll have some built-in common servers
        const knownServers: Record<string, Partial<MCPServer>> = {
            'filesystem': {
                name: 'Filesystem',
                transport: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
            },
            'github': {
                name: 'GitHub',
                transport: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github']
            },
            'postgres': {
                name: 'PostgreSQL',
                transport: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb']
            },
            'sqlite': {
                name: 'SQLite',
                transport: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-sqlite', './database.db']
            },
            'fetch': {
                name: 'Fetch',
                transport: 'stdio',
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-fetch']
            },
            'aws-docs': {
                name: 'AWS Documentation',
                transport: 'http',
                url: 'https://mcp.aws.amazon.com/sse'
            }
        };

        const serverConfig = knownServers[serverName];
        if (serverConfig) {
            await this.addServer(serverConfig);
        } else {
            throw new Error(`Unknown server: ${serverName}`);
        }
    }

    getAvailableDirectoryServers(): string[] {
        return [
            'filesystem',
            'github',
            'postgres',
            'sqlite',
            'fetch',
            'aws-docs'
        ];
    }
}
