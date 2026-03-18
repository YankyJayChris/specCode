import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Spec } from '../specs/specTypes';

export class KiroFolderManager {
    private specs: Map<string, Spec> = new Map();
    // Folder name used on disk
    static readonly FOLDER_NAME = '.specCode';

    getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    initializeWorkspace(): void {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return;

        const specCodePath = path.join(workspaceRoot, KiroFolderManager.FOLDER_NAME);

        // Migrate from old .kiro folder if it exists
        const oldKiroPath = path.join(workspaceRoot, '.kiro');
        if (fs.existsSync(oldKiroPath) && !fs.existsSync(specCodePath)) {
            try {
                fs.renameSync(oldKiroPath, specCodePath);
                vscode.window.showInformationMessage('Spec-Code: Migrated .kiro folder to .specCode');
            } catch {
                // If rename fails, just create new folder
            }
        }

        // Create folder structure
        const folders = [
            specCodePath,
            path.join(specCodePath, 'specs'),
            path.join(specCodePath, 'steering'),
            path.join(specCodePath, 'hooks'),
            path.join(specCodePath, 'settings'),
            path.join(specCodePath, 'memory'),
            path.join(specCodePath, 'memory', 'specs'),
            path.join(specCodePath, 'sessions'),
        ];

        for (const folder of folders) {
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder, { recursive: true });
            }
        }

        // Create default mcp.json if not exists
        const mcpPath = path.join(specCodePath, 'mcp.json');
        if (!fs.existsSync(mcpPath)) {
            const defaultMcp = {
                servers: {},
                version: '1.0'
            };
            fs.writeFileSync(mcpPath, JSON.stringify(defaultMcp, null, 2));
        }

        // Create default workspace memory if not exists
        const workspaceMemoryPath = path.join(specCodePath, 'memory', 'workspace.md');
        if (!fs.existsSync(workspaceMemoryPath)) {
            fs.writeFileSync(workspaceMemoryPath, '# Workspace Memory\n\nProject conventions and key decisions will be recorded here automatically.\n');
        }

        // Create .gitignore if not exists
        const gitignorePath = path.join(specCodePath, '.gitignore');
        if (!fs.existsSync(gitignorePath)) {
            fs.writeFileSync(gitignorePath, '# Spec-Code internal files\nsettings/\n*.log\nsessions/\n');
        }

        // Set context for views
        vscode.commands.executeCommand('setContext', 'workspaceHasKiroFolder', true);
        vscode.commands.executeCommand('setContext', 'workspaceHasSpecCodeFolder', true);
    }

    getKiroPath(): string | undefined {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return undefined;
        return path.join(workspaceRoot, KiroFolderManager.FOLDER_NAME);
    }

    // Alias for clarity
    getSpecCodePath(): string | undefined {
        return this.getKiroPath();
    }

    getSpecsPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'specs');
    }

    getSteeringPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'steering');
    }

    getHooksPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'hooks');
    }

    getSettingsPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'settings');
    }

    getMcpPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'mcp.json');
    }

    getMemoryPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'memory');
    }

    getSessionsPath(): string | undefined {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return undefined;
        return path.join(kiroPath, 'sessions');
    }

    kiroFolderExists(): boolean {
        const kiroPath = this.getKiroPath();
        if (!kiroPath) return false;
        return fs.existsSync(kiroPath);
    }

    readMcpConfig(): any {
        const mcpPath = this.getMcpPath();
        if (!mcpPath || !fs.existsSync(mcpPath)) {
            return { servers: {}, version: '1.0' };
        }

        try {
            return JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
        } catch {
            return { servers: {}, version: '1.0' };
        }
    }

    writeMcpConfig(config: any): void {
        const mcpPath = this.getMcpPath();
        if (!mcpPath) return;
        fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
    }

    getSpec(specId: string): Spec | undefined {
        return this.specs.get(specId);
    }

    setSpec(spec: Spec): void {
        this.specs.set(spec.id, spec);
    }

    isWithinWorkspace(targetPath: string): boolean {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return false;

        const resolvedPath = path.resolve(targetPath);
        const resolvedWorkspace = path.resolve(workspaceRoot);

        return resolvedPath.startsWith(resolvedWorkspace);
    }

    safeReadFile(filePath: string): string | null {
        if (!this.isWithinWorkspace(filePath)) {
            return null;
        }

        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return null;
        }
    }

    safeWriteFile(filePath: string, content: string): boolean {
        if (!this.isWithinWorkspace(filePath)) {
            return false;
        }

        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content);
            return true;
        } catch {
            return false;
        }
    }

    safeDeleteFile(filePath: string): boolean {
        if (!this.isWithinWorkspace(filePath)) {
            return false;
        }

        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return true;
        } catch {
            return false;
        }
    }

    getRelativePath(absolutePath: string): string {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return absolutePath;
        return path.relative(workspaceRoot, absolutePath);
    }

    getAbsolutePath(relativePath: string): string | undefined {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return undefined;
        return path.join(workspaceRoot, relativePath);
    }
}

// Keep alias for any external callers
export const SpecCodeFolderManager = KiroFolderManager;
