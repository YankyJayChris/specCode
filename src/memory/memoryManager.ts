import * as path from "path";
import * as fs from "fs";
import { KiroFolderManager } from "../utils/kiroFolder";

export interface MemoryEntry {
  timestamp: number;
  content: string;
  type: "decision" | "note" | "convention" | "learning";
  tags?: string[];
}

export class MemoryManager {
  private folderManager: KiroFolderManager;

  constructor(folderManager: KiroFolderManager) {
    this.folderManager = folderManager;
  }

  // ── Workspace Memory ──────────────────────────────────────────────────────

  getWorkspaceMemory(): string {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return "";
    }

    const workspaceMemoryPath = path.join(memoryPath, "workspace.md");
    return this.folderManager.safeReadFile(workspaceMemoryPath) || "";
  }

  updateWorkspaceMemory(content: string): boolean {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return false;
    }

    const workspaceMemoryPath = path.join(memoryPath, "workspace.md");
    return this.folderManager.safeWriteFile(workspaceMemoryPath, content);
  }

  appendWorkspaceMemory(
    note: string,
    type: "decision" | "note" | "convention" | "learning" = "note",
  ): boolean {
    const current = this.getWorkspaceMemory();
    const timestamp = new Date().toISOString();
    const entry = `\n## ${type.charAt(0).toUpperCase() + type.slice(1)} - ${timestamp}\n\n${note}\n`;

    return this.updateWorkspaceMemory(current + entry);
  }

  // ── Spec Memory ───────────────────────────────────────────────────────────

  getSpecMemory(specId: string): string {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return "";
    }

    const specMemoryPath = path.join(memoryPath, "specs", `${specId}.md`);
    return this.folderManager.safeReadFile(specMemoryPath) || "";
  }

  appendSpecMemory(
    specId: string,
    note: string,
    type: "decision" | "note" | "convention" | "learning" = "note",
  ): boolean {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return false;
    }

    const specMemoryPath = path.join(memoryPath, "specs", `${specId}.md`);
    const current =
      this.folderManager.safeReadFile(specMemoryPath) ||
      `# Memory for Spec: ${specId}\n\n`;

    const timestamp = new Date().toISOString();
    const entry = `\n## ${type.charAt(0).toUpperCase() + type.slice(1)} - ${timestamp}\n\n${note}\n`;

    return this.folderManager.safeWriteFile(specMemoryPath, current + entry);
  }

  updateSpecMemory(specId: string, content: string): boolean {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return false;
    }

    const specMemoryPath = path.join(memoryPath, "specs", `${specId}.md`);
    return this.folderManager.safeWriteFile(specMemoryPath, content);
  }

  // ── Combined Memory Context ───────────────────────────────────────────────

  getMemoryContext(specId?: string): string {
    let context = "";

    // Always include workspace memory
    const workspaceMemory = this.getWorkspaceMemory();
    if (workspaceMemory.trim()) {
      context += "# Workspace Memory\n\n" + workspaceMemory + "\n\n";
    }

    // Include spec-specific memory if provided
    if (specId) {
      const specMemory = this.getSpecMemory(specId);
      if (specMemory.trim()) {
        context += "# Spec Memory\n\n" + specMemory + "\n\n";
      }
    }

    return context;
  }

  // ── Memory Management ─────────────────────────────────────────────────────

  clearSpecMemory(specId: string): boolean {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return false;
    }

    const specMemoryPath = path.join(memoryPath, "specs", `${specId}.md`);
    return this.folderManager.safeDeleteFile(specMemoryPath);
  }

  clearWorkspaceMemory(): boolean {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return false;
    }

    const workspaceMemoryPath = path.join(memoryPath, "workspace.md");
    const defaultContent =
      "# Workspace Memory\n\nProject conventions and key decisions will be recorded here automatically.\n";
    return this.folderManager.safeWriteFile(
      workspaceMemoryPath,
      defaultContent,
    );
  }

  getAllSpecMemories(): { specId: string; content: string }[] {
    const memoryPath = this.folderManager.getMemoryPath();
    if (!memoryPath) {
      return [];
    }

    const specsMemoryPath = path.join(memoryPath, "specs");
    if (!fs.existsSync(specsMemoryPath)) {
      return [];
    }

    const memories: { specId: string; content: string }[] = [];

    try {
      const files = fs.readdirSync(specsMemoryPath);
      for (const file of files) {
        if (file.endsWith(".md")) {
          const specId = file.replace(".md", "");
          const content = this.getSpecMemory(specId);
          if (content.trim()) {
            memories.push({ specId, content });
          }
        }
      }
    } catch (error) {
      console.error("Error reading spec memories:", error);
    }

    return memories;
  }

  // ── Auto-Learning ─────────────────────────────────────────────────────────

  recordDecision(
    specId: string | null,
    decision: string,
    context?: string,
  ): boolean {
    const fullNote = context ? `${decision}\n\nContext: ${context}` : decision;

    if (specId) {
      return this.appendSpecMemory(specId, fullNote, "decision");
    } else {
      return this.appendWorkspaceMemory(fullNote, "decision");
    }
  }

  recordLearning(specId: string | null, learning: string): boolean {
    if (specId) {
      return this.appendSpecMemory(specId, learning, "learning");
    } else {
      return this.appendWorkspaceMemory(learning, "learning");
    }
  }

  recordConvention(convention: string): boolean {
    return this.appendWorkspaceMemory(convention, "convention");
  }
}
