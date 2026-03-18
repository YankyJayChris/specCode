import * as vscode from "vscode";
import { HookEngine, Hook } from "../hooks/hookEngine";

export class HooksProvider implements vscode.TreeDataProvider<HookTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    HookTreeItem | undefined | null | void
  > = new vscode.EventEmitter<HookTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    HookTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

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
      return Promise.resolve(hooks.map((hook) => new HookTreeItem(hook)));
    }

    return Promise.resolve([]);
  }
}

export class HookTreeItem extends vscode.TreeItem {
  constructor(public readonly hook: Hook) {
    super(hook.name, vscode.TreeItemCollapsibleState.None);

    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
    this.contextValue = "hook";
    this.iconPath = this.getIconPath();

    if (hook.path) {
      this.command = {
        command: "vscode.open",
        title: "Edit Hook",
        arguments: [vscode.Uri.file(hook.path)],
      };
    }
  }

  private getTooltip(): string {
    const lines = [
      `Event: ${this.formatEventType(this.hook.when.type)}`,
      `Patterns: ${this.hook.when.patterns?.join(", ") || "All files"}`,
      `Status: ${this.hook.enabled ? "Enabled" : "Disabled"}`,
      `Runs: ${this.hook.runCount}`,
    ];

    if (this.hook.when.toolTypes) {
      lines.push(`Tool Types: ${this.hook.when.toolTypes.join(", ")}`);
    }

    if (this.hook.lastRun) {
      const lastRun = new Date(this.hook.lastRun);
      lines.push(`Last run: ${lastRun.toLocaleString()}`);
    }

    const prompt =
      this.hook.then.prompt || this.hook.then.command || "No action defined";
    lines.push("", "Action:", prompt.substring(0, 200) + "...");

    return lines.join("\n");
  }

  private getDescription(): string {
    const parts: string[] = [];

    parts.push(this.formatEventType(this.hook.when.type));

    if (this.hook.when.patterns) {
      parts.push(
        `"${this.hook.when.patterns[0]}${this.hook.when.patterns.length > 1 ? "..." : ""}"`,
      );
    }

    if (this.hook.runCount > 0) {
      parts.push(`${this.hook.runCount} runs`);
    }

    return parts.join(" • ");
  }

  private getIconPath(): vscode.ThemeIcon {
    if (!this.hook.enabled) {
      return new vscode.ThemeIcon(
        "circle-slash",
        new vscode.ThemeColor("disabledForeground"),
      );
    }

    switch (this.hook.when.type) {
      case "fileEdited":
        return new vscode.ThemeIcon("save");
      case "fileCreated":
        return new vscode.ThemeIcon("new-file");
      case "fileDeleted":
        return new vscode.ThemeIcon("trash");
      case "preToolUse":
      case "postToolUse":
        return new vscode.ThemeIcon("tools");
      case "preTaskExecution":
      case "postTaskExecution":
        return new vscode.ThemeIcon("play");
      case "userTriggered":
        return new vscode.ThemeIcon("hand");
      case "promptSubmit":
        return new vscode.ThemeIcon("comment");
      case "agentStop":
        return new vscode.ThemeIcon("stop");
      default:
        return new vscode.ThemeIcon("zap");
    }
  }

  private formatEventType(eventType: string): string {
    const map: Record<string, string> = {
      fileEdited: "On Save",
      fileCreated: "On Create",
      fileDeleted: "On Delete",
      userTriggered: "Manual",
      promptSubmit: "On Prompt",
      agentStop: "On Stop",
      preToolUse: "Pre Tool",
      postToolUse: "Post Tool",
      preTaskExecution: "Pre Task",
      postTaskExecution: "Post Task",
    };
    return map[eventType] || eventType;
  }
}
